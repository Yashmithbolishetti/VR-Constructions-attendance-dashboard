/**
 * VR CONSTRUCTIONS — BIOMETRIC ATTENDANCE INTELLIGENCE
 * Normalized Relational Database Schema Types
 *
 * Designed to map directly to PostgreSQL / Supabase tables with strict relational integrity.
 */

export type DatabaseStatus = 'PROCESSED' | 'NEEDS_REVIEW' | 'FAILED';

/**
 * Table: employees
 * Machine enrollment number (EnNo) is the stable immutable natural key.
 */
export interface DbEmployee {
  id: string; // UUID or string id
  employee_code: string; // EnNo e.g. "101", "102" - UNIQUE
  employee_name: string;
  department?: string;
  designation?: string;
  is_active: boolean;
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
}

/**
 * Table: biometric_imports
 * Tracks every uploaded biometric machine export file with cryptographic file hash.
 */
export interface DbBiometricImport {
  id: string; // UUID
  file_name: string;
  file_hash: string; // SHA-256 or deterministic content digest
  file_size_bytes: number;
  uploaded_at: string; // ISO 8601
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  employee_count: number;
  punch_count: number;
  valid_punch_count: number;
  duplicate_punch_count: number;
  anomaly_punch_count: number;
  status: DatabaseStatus;
  raw_content_preview?: string;
  created_at: string;
}

/**
 * Table: biometric_punches
 * Verbatim raw biometric punches with source row and audit tracking.
 * NEVER modified by manual corrections.
 */
export interface DbBiometricPunch {
  id: string; // UUID
  import_id: string; // FK -> biometric_imports.id
  employee_id: string; // FK -> employees.id
  machine_number: string;
  source_row_number: number;
  employee_code: string; // EnNo
  employee_name_raw: string;
  mode: string;
  io_mode: string;
  punched_at: string; // ISO 8601 e.g. 2026-09-01T09:54:12
  punch_date: string; // YYYY-MM-DD
  punch_time: string; // HH:mm:ss
  is_duplicate: boolean;
  is_valid: boolean;
  anomaly_type?: string;
  raw_line_source: string;
  created_at: string;
}

/**
 * Table: attendance_months
 * Represents one discrete monthly attendance calculation workspace.
 */
export interface DbAttendanceMonth {
  id: string; // e.g. "month-2026-09"
  year: number; // 2026
  month: number; // 9
  month_key: string; // "2026-09"
  month_label: string; // "September 2026"
  date_from: string; // "2026-09-01"
  date_to: string; // "2026-09-30"
  report_date: string; // e.g. "2026-09-05"
  calendar_days_count: number;
  sundays_count: number;
  holidays_count: number;
  expected_working_days: number;
  status: 'DRAFT' | 'CONFIRMED' | 'LOCKED';
  shift_start: string; // "10:00"
  shift_end: string; // "18:00"
  lunch_start: string; // "13:30"
  lunch_end: string; // "14:30"
  lunch_duration_minutes: number; // 60
  grace_minutes: number; // 15
  created_at: string;
  updated_at: string;
}

/**
 * Table: holidays
 * Non-Sunday company and public holidays configured for an attendance month.
 */
export interface DbHoliday {
  id: string;
  attendance_month_id: string; // FK -> attendance_months.id
  holiday_date: string; // YYYY-MM-DD
  holiday_name: string;
  created_at: string;
}

/**
 * Table: leave_records
 * Approved employee leaves subtracted from expected working days.
 */
export interface DbLeaveRecord {
  id: string;
  employee_id: string; // FK -> employees.id
  employee_code: string; // EnNo
  attendance_month_id: string; // FK -> attendance_months.id
  leave_date: string; // YYYY-MM-DD
  leave_type: 'CASUAL' | 'SICK' | 'PERSONAL' | 'EARNED' | 'OTHER';
  notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Table: attendance_days
 * Deterministic calculated daily attendance for each employee and calendar date.
 */
export interface DbAttendanceDay {
  id: string; // e.g. "att-2026-09-01-101"
  attendance_month_id: string; // FK -> attendance_months.id
  employee_id: string; // FK -> employees.id
  employee_code: string; // EnNo
  employee_name: string;
  attendance_date: string; // YYYY-MM-DD
  first_punch?: string; // HH:mm:ss
  last_punch?: string; // HH:mm:ss
  punch_count: number;
  gross_minutes: number;
  lunch_minutes: number;
  net_minutes: number;
  status:
    | 'PRESENT'
    | 'APPROVED_LEAVE'
    | 'HOLIDAY'
    | 'SUNDAY'
    | 'ABSENT'
    | 'SINGLE_PUNCH'
    | 'OUT_PENDING'
    | 'NEEDS_REVIEW';
  is_late: boolean;
  late_minutes: number;
  is_early_departure: boolean;
  early_minutes: number;
  has_anomaly: boolean;
  is_manually_corrected: boolean;
  correction_notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Table: attendance_exceptions
 * Persistent exception records identified by the engine.
 */
export interface DbAttendanceException {
  id: string;
  attendance_month_id: string; // FK -> attendance_months.id
  employee_id: string; // FK -> employees.id
  employee_code: string; // EnNo
  employee_name: string;
  attendance_date: string; // YYYY-MM-DD
  exception_type:
    | 'SINGLE_PUNCH'
    | 'OUT_PENDING'
    | 'ABSENT'
    | 'LATE_ARRIVAL'
    | 'EARLY_DEPARTURE'
    | 'DUPLICATE'
    | 'NEEDS_REVIEW'
    | 'LEAVE_CONFLICT'
    | 'HOLIDAY_WORKED'
    | 'ANOMALY';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Table: attendance_overrides (Audit Trail for Manual Attendance Correction)
 * Preserves the pristine audit trail of manual adjustments without altering raw punches.
 */
export interface DbAttendanceOverride {
  id: string;
  attendance_day_id: string; // FK -> attendance_days.id
  attendance_month_id: string; // FK -> attendance_months.id
  employee_id: string; // FK -> employees.id
  attendance_date: string;
  field_name: 'first_punch' | 'last_punch' | 'status' | 'lunch_minutes';
  original_value: string;
  new_value: string;
  reason: string;
  updated_by: string;
  changed_at: string; // ISO 8601
}
