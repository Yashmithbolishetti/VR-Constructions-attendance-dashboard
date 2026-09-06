/**
 * VR CONSTRUCTIONS — BIOMETRIC ATTENDANCE INTELLIGENCE
 * Core Data Architecture & Domain Model
 *
 * ARCHITECTURAL PRINCIPLES:
 * 1. The biometric raw export file is the immutable source of truth. Original records are never overwritten.
 * 2. Primary Employee Identity is always `employeeId` / `enNo` (enrollment number), never purely name.
 * 3. Clear decoupling: Raw Storage -> Parsed Records -> Calculation Engine -> Presentation ViewModels.
 * 4. Audit Trail: Every calculated attendance record can trace back to underlying biometric punch timestamps.
 */

export type PunchType = 'IN' | 'OUT' | 'UNKNOWN';

export type AttendanceStatus =
  | 'PRESENT'
  | 'APPROVED_LEAVE'
  | 'HOLIDAY'
  | 'SUNDAY'
  | 'ABSENT'
  | 'SINGLE_PUNCH'
  | 'OUT_PENDING'
  | 'NEEDS_REVIEW';

export type ExceptionCategory =
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

export type LeaveType = 'CASUAL' | 'SICK' | 'PERSONAL' | 'EARNED' | 'OTHER';

export type NavigationPage =
  | 'overview'
  | 'upload'
  | 'employees'
  | 'daily-attendance'
  | 'analytics'
  | 'exceptions'
  | 'reports'
  | 'settings';

/**
 * Raw Biometric File Storage
 * Preserves the exact uploaded bytes/text for reproducibility and audit verification.
 */
export interface RawBiometricFile {
  id: string;
  fileName: string;
  name?: string;
  fileSizeBytes: number;
  size?: number;
  mimeType: string;
  uploadedAt: string; // ISO 8601
  rawContent: string; // Verbatim raw string
  content?: string;
  totalLinesDetected: number;
  encoding: string;
  fileFormat: 'TXT' | 'CSV' | 'TSV' | 'DAT';
  detectedDelimiter: string;
}

/**
 * Primary Employee Record
 * EnNo (Enrollment Number / Machine ID) is the immutable primary key.
 */
export interface Employee {
  employeeId: string; // EnNo (e.g., "101", "102")
  name: string;
  designation?: string;
  department?: string;
  isActive: boolean;
  totalPunchesInFile?: number;
}

/**
 * Atomic Biometric Punch Record
 * Direct parsed mapping from machine logs with complete audit traceability.
 */
export interface RawBiometricPunch {
  id: string;
  sourceRowNumber: number;
  sourceRowIndex?: number;
  machineNumber: string;
  enNo: string; // Primary Employee identifier
  employeeId?: string;
  employeeName: string;
  mode: string;
  ioMode?: string;
  iomd: string;
  originalDateTime: string; // e.g. "2026/09/01 09:54:12"
  normalizedTimestamp: string; // ISO 8601 string
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  isDuplicate: boolean;
  isAnomaly: boolean;
  anomalyReason?: string;
  rawLineSource: string; // Complete line from uploaded file
  rawLine?: string;
  recordNo?: string; // Original 'No' field from biometric export
}

/**
 * Parsed Dataset Model
 */
export interface ParsedBiometricDataset {
  file: RawBiometricFile;
  allPunches: RawBiometricPunch[];
  validPunches: RawBiometricPunch[];
  duplicatePunches: RawBiometricPunch[];
  anomalies: RawBiometricPunch[];
  employees: Employee[];
  firstDate: string;
  lastDate: string;
  reportDate: string;
  datesRepresented: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
    totalDays?: number;
  };
  availableMonths: {
    monthKey: string; // "YYYY-MM"
    label: string;    // "September 2026"
    recordCount: number;
    monthLabel?: string;
    punchCount?: number;
  }[];
  punchesByEmployee: Record<string, RawBiometricPunch[]>;
  isSampleData?: boolean;
  summary?: {
    totalRowsDetected: number;
    validRowsCount: number;
    invalidRowsCount: number;
    duplicateRowsCount: number;
    employeesCount: number;
    startDate: string;
    endDate: string;
    dateSpanFormatted: string;
    detectedMonthsCount: number;
    warnings: string[];
  };
}

/**
 * Calculated Daily Attendance Record
 * Derived from paired In/Out punches, office rules, and exception detection.
 */
export interface AttendanceDay {
  id: string;
  date: string; // YYYY-MM-DD
  employeeId: string; // EnNo
  employeeName: string;
  firstPunchIn?: string; // HH:mm:ss
  lastPunchOut?: string; // HH:mm:ss
  rawPunches: RawBiometricPunch[];
  punchCount: number;
  grossMinutes: number;
  grossHours: number; // numeric e.g. 8.25
  lunchDeductionMinutes: number; // e.g. 60
  lunchDeductionHours: number; // e.g. 1.0
  netMinutes: number;
  netHours: number; // gross - lunch
  status: AttendanceStatus;
  isLateArrival: boolean;
  isEarlyDeparture: boolean;
  lateMinutes: number;
  earlyMinutes: number;
  exceptions: AttendanceException[];
  notes?: string;
}

/**
 * Employee Monthly Attendance Summary Profile
 */
export interface EmployeeAttendanceSummary {
  employeeId: string;
  employeeName: string;
  department?: string;
  expectedAttendanceDays: number; // Eligible working days in actual dataset (excluding Sun, Hol, outside dates)
  presentDays: number;
  approvedLeaveDays: number;
  absentDays: number;
  singlePunchDays: number;
  outPendingDays: number;
  sundayDays: number;
  holidayDays: number;
  totalGrossMinutes: number;
  totalNetMinutes: number;
  averageNetHours: number;
  averageNetHoursFormatted: string; // e.g. "7h 02m"
  attendancePercentage: number; // Present Days ÷ Expected Attendance Days × 100
  absencePercentage: number; // Absent Days ÷ Expected Attendance Days × 100
  lateArrivalsCount: number;
  earlyDeparturesCount: number;
  lateDays?: number;
  earlyDepartureDays?: number;
  exceptionsCount: number;
}

/**
 * Exception Record
 */
export interface AttendanceException {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  category: ExceptionCategory;
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  punches?: RawBiometricPunch[];
  isResolved?: boolean;
  resolvedAt?: string;
  resolutionNote?: string;
}

export type BiometricException = AttendanceException;

/**
 * Holiday Configuration Record
 */
export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export type HolidayConfig = Holiday;

/**
 * Employee Leave Record
 */
export interface LeaveRecord {
  id: string;
  employeeId: string; // EnNo
  employeeName: string;
  date: string; // YYYY-MM-DD
  leaveType: LeaveType;
}

/**
 * Office & Work Shift Configuration
 */
export interface OfficeConfig {
  officeName: string;
  officeStart: string; // "10:00"
  officeEnd: string; // "18:00"
  lunchStart: string; // "13:30"
  lunchEnd: string; // "14:30"
  lunchDurationMinutes: number; // 60
  defaultLunchDeductionHours: number; // 1.0
  graceMinutesLate: number; // 15
  halfDayThresholdHours: number; // 4.5
  fullDayThresholdHours: number; // 8.0
  totalEmployeesCount?: number; // Configured workforce head count (e.g. 9)
}

/**
 * Comprehensive Calculation Result for Selected Month
 */
export interface CalculatedMonthData {
  monthKey: string; // "YYYY-MM"
  monthLabel: string; // "September 2026"
  hasImportedData?: boolean; // True if uploaded dataset contains records in this period
  noDataMessage?: string; // Informational message when month has no imported records
  reportDate: string; // YYYY-MM-DD
  startDate: string; // YYYY-MM-DD (Analysis period start within this month)
  endDate: string; // YYYY-MM-DD (Analysis period end within this month)
  dateRangeFormatted?: string; // e.g. "20 Aug 2026 — 31 Aug 2026"
  datasetStartDate?: string; // Earliest date in uploaded dataset
  datasetEndDate?: string; // Latest date in uploaded dataset
  datasetDateRangeFormatted?: string; // e.g. "20 Aug 2026 — 02 Sep 2026"
  calendarDaysCount: number;
  sundaysCount: number;
  holidaysCount: number;
  expectedWorkingDays: number; // Calendar - Sundays - Holidays strictly within analysis period
  configuredEmployeeCount?: number;
  knownEmployeesCount?: number;
  employeeCountDiscrepancy?: boolean;
  discrepancyMessage?: string;
  dailyRecords: AttendanceDay[];
  employeeSummaries: EmployeeAttendanceSummary[];
  exceptions: AttendanceException[];
  kpis: {
    totalEmployees: number;
    workingDays: number;
    avgAttendancePct: number;
    avgNetHours: number;
    totalLeave: number;
    totalAbsences: number;
    incompletePunches: number;
    lateArrivals: number;
  };
}
