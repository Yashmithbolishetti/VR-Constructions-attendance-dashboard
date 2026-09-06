-- VR CONSTRUCTIONS — BIOMETRIC ATTENDANCE INTELLIGENCE
-- Production PostgreSQL / Supabase Relational Database Schema
-- Normalized relational tables with foreign keys, indexes, and Row Level Security (RLS)

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EMPLOYEES MASTER TABLE
-- Natural Key: employee_code (EnNo from biometric hardware)
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_code VARCHAR(64) UNIQUE NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    department VARCHAR(128),
    designation VARCHAR(128),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(employee_name);

-- 2. BIOMETRIC IMPORTS (Track every uploaded file with deterministic hash)
CREATE TABLE IF NOT EXISTS biometric_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    file_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL UNIQUE,
    file_size_bytes BIGINT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    employee_count INTEGER NOT NULL DEFAULT 0,
    punch_count INTEGER NOT NULL DEFAULT 0,
    valid_punch_count INTEGER NOT NULL DEFAULT 0,
    duplicate_punch_count INTEGER NOT NULL DEFAULT 0,
    anomaly_punch_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('PROCESSED', 'NEEDS_REVIEW', 'FAILED')),
    raw_content_preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imports_hash ON biometric_imports(file_hash);
CREATE INDEX IF NOT EXISTS idx_imports_dates ON biometric_imports(date_from, date_to);

-- 3. BIOMETRIC PUNCHES (Raw immutable source logs)
CREATE TABLE IF NOT EXISTS biometric_punches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_id UUID NOT NULL REFERENCES biometric_imports(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    machine_number VARCHAR(32) NOT NULL DEFAULT '1',
    source_row_number INTEGER NOT NULL,
    employee_code VARCHAR(64) NOT NULL,
    employee_name_raw VARCHAR(255) NOT NULL,
    mode VARCHAR(32) NOT NULL DEFAULT '1',
    io_mode VARCHAR(32) NOT NULL DEFAULT '1',
    punched_at TIMESTAMPTZ NOT NULL,
    punch_date DATE NOT NULL,
    punch_time TIME NOT NULL,
    is_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    is_valid BOOLEAN NOT NULL DEFAULT TRUE,
    anomaly_type VARCHAR(64),
    raw_line_source TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_punches_emp_date ON biometric_punches(employee_id, punch_date);
CREATE INDEX IF NOT EXISTS idx_punches_import ON biometric_punches(import_id);
CREATE INDEX IF NOT EXISTS idx_punches_timestamp ON biometric_punches(punched_at);

-- 4. ATTENDANCE MONTHS (Monthly calculation workspaces)
CREATE TABLE IF NOT EXISTS attendance_months (
    id VARCHAR(64) PRIMARY KEY, -- e.g. "month-2026-09"
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    month_key VARCHAR(7) NOT NULL UNIQUE, -- "2026-09"
    month_label VARCHAR(64) NOT NULL, -- "September 2026"
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    report_date DATE NOT NULL,
    calendar_days_count INTEGER NOT NULL DEFAULT 30,
    sundays_count INTEGER NOT NULL DEFAULT 4,
    holidays_count INTEGER NOT NULL DEFAULT 0,
    expected_working_days INTEGER NOT NULL DEFAULT 26,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CONFIRMED', 'LOCKED')),
    shift_start TIME NOT NULL DEFAULT '10:00',
    shift_end TIME NOT NULL DEFAULT '18:00',
    lunch_start TIME NOT NULL DEFAULT '13:30',
    lunch_end TIME NOT NULL DEFAULT '14:30',
    lunch_duration_minutes INTEGER NOT NULL DEFAULT 60,
    grace_minutes INTEGER NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. HOLIDAYS (Registered public/company holidays for a month)
CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_month_id VARCHAR(64) NOT NULL REFERENCES attendance_months(id) ON DELETE CASCADE,
    holiday_date DATE NOT NULL,
    holiday_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_month_holiday_date UNIQUE (attendance_month_id, holiday_date)
);

CREATE INDEX IF NOT EXISTS idx_holidays_month ON holidays(attendance_month_id);

-- 6. LEAVE RECORDS (Approved leaves registered by HR)
CREATE TABLE IF NOT EXISTS leave_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    employee_code VARCHAR(64) NOT NULL,
    attendance_month_id VARCHAR(64) NOT NULL REFERENCES attendance_months(id) ON DELETE CASCADE,
    leave_date DATE NOT NULL,
    leave_type VARCHAR(32) NOT NULL DEFAULT 'CASUAL' CHECK (leave_type IN ('CASUAL', 'SICK', 'PERSONAL', 'EARNED', 'OTHER')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_emp_leave_date UNIQUE (employee_id, leave_date)
);

CREATE INDEX IF NOT EXISTS idx_leaves_month ON leave_records(attendance_month_id);
CREATE INDEX IF NOT EXISTS idx_leaves_emp ON leave_records(employee_id);

-- 7. ATTENDANCE DAYS (Deterministic calculated daily results)
CREATE TABLE IF NOT EXISTS attendance_days (
    id VARCHAR(128) PRIMARY KEY, -- "att-2026-09-01-101"
    attendance_month_id VARCHAR(64) NOT NULL REFERENCES attendance_months(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    employee_code VARCHAR(64) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    attendance_date DATE NOT NULL,
    first_punch TIME,
    last_punch TIME,
    punch_count INTEGER NOT NULL DEFAULT 0,
    gross_minutes INTEGER NOT NULL DEFAULT 0,
    lunch_minutes INTEGER NOT NULL DEFAULT 0,
    net_minutes INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL CHECK (status IN (
        'PRESENT', 'APPROVED_LEAVE', 'HOLIDAY', 'SUNDAY',
        'ABSENT', 'SINGLE_PUNCH', 'OUT_PENDING', 'NEEDS_REVIEW'
    )),
    is_late BOOLEAN NOT NULL DEFAULT FALSE,
    late_minutes INTEGER NOT NULL DEFAULT 0,
    is_early_departure BOOLEAN NOT NULL DEFAULT FALSE,
    early_minutes INTEGER NOT NULL DEFAULT 0,
    has_anomaly BOOLEAN NOT NULL DEFAULT FALSE,
    is_manually_corrected BOOLEAN NOT NULL DEFAULT FALSE,
    correction_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_emp_attendance_date UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_att_days_month ON attendance_days(attendance_month_id);
CREATE INDEX IF NOT EXISTS idx_att_days_date ON attendance_days(attendance_date);
CREATE INDEX IF NOT EXISTS idx_att_days_emp ON attendance_days(employee_id);
CREATE INDEX IF NOT EXISTS idx_att_days_status ON attendance_days(status);

-- 8. ATTENDANCE EXCEPTIONS (Engine detected anomalies & incomplete records)
CREATE TABLE IF NOT EXISTS attendance_exceptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_month_id VARCHAR(64) NOT NULL REFERENCES attendance_months(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    employee_code VARCHAR(64) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    attendance_date DATE NOT NULL,
    exception_type VARCHAR(32) NOT NULL CHECK (exception_type IN (
        'SINGLE_PUNCH', 'OUT_PENDING', 'ABSENT', 'LATE_ARRIVAL',
        'EARLY_DEPARTURE', 'DUPLICATE', 'NEEDS_REVIEW',
        'LEAVE_CONFLICT', 'HOLIDAY_WORKED', 'ANOMALY'
    )),
    severity VARCHAR(16) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(255),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exceptions_month ON attendance_exceptions(attendance_month_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_emp ON attendance_exceptions(employee_id);

-- 9. ATTENDANCE OVERRIDES (Audit trail for manual corrections)
CREATE TABLE IF NOT EXISTS attendance_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_day_id VARCHAR(128) NOT NULL REFERENCES attendance_days(id) ON DELETE CASCADE,
    attendance_month_id VARCHAR(64) NOT NULL REFERENCES attendance_months(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    field_name VARCHAR(32) NOT NULL,
    original_value TEXT NOT NULL,
    new_value TEXT NOT NULL,
    reason TEXT NOT NULL,
    updated_by VARCHAR(255) NOT NULL DEFAULT 'Admin',
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overrides_day ON attendance_overrides(attendance_day_id);

-- ROW LEVEL SECURITY (RLS) POLICIES
-- Ensures authorized company personnel have secure access without leakage
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_punches ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_overrides ENABLE ROW LEVEL SECURITY;

-- Production RLS policies (authenticated app role)
CREATE POLICY "Allow authenticated full access to employees"
    ON employees FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to biometric_imports"
    ON biometric_imports FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to biometric_punches"
    ON biometric_punches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to attendance_months"
    ON attendance_months FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to holidays"
    ON holidays FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to leave_records"
    ON leave_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to attendance_days"
    ON attendance_days FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to attendance_exceptions"
    ON attendance_exceptions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated full access to attendance_overrides"
    ON attendance_overrides FOR ALL TO authenticated USING (true) WITH CHECK (true);
