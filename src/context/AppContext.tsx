import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  NavigationPage,
  OfficeConfig,
  Holiday,
  LeaveRecord,
  RawBiometricFile,
  ParsedBiometricDataset,
  CalculatedMonthData,
  AttendanceDay,
  AttendanceStatus,
  RawBiometricPunch,
  Employee,
} from '../types/attendance';
import {
  DbAttendanceMonth,
  DbBiometricImport,
  DbBiometricPunch,
  DbHoliday,
  DbLeaveRecord,
  DbAttendanceDay,
  DbAttendanceException,
  DbAttendanceOverride,
} from '../types/database';
import { parseBiometricFile } from '../services/attendanceParser';
import { validateBiometricPunches } from '../services/attendanceValidator';
import {
  calculateMonthAttendance,
  normalizeDateString,
  normalizeEnNo,
  isEnNoMatch,
} from '../services/attendanceCalculator';
import { SAMPLE_BIOMETRIC_FILE_NAME, SAMPLE_BIOMETRIC_RAW_TEXT } from '../services/sampleData';
import { DatabaseService, calculateFileHash } from '../services/database';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title?: string;
}

interface AppContextType {
  currentPage: NavigationPage;
  setCurrentPage: (page: NavigationPage) => void;

  // Office Shift Configuration
  officeConfig: OfficeConfig;
  updateOfficeConfig: (newConfig: Partial<OfficeConfig>) => void;

  // Company Holidays
  holidays: Holiday[];
  addHoliday: (holiday: Omit<Holiday, 'id'>) => void;
  removeHoliday: (id: string) => void;

  // Employee Leaves
  leaves: LeaveRecord[];
  addLeaveRecord: (leave: Omit<LeaveRecord, 'id'>) => void;
  addBatchLeaves: (
    records: {
      employeeId: string;
      employeeName: string;
      date: string;
      leaveType: any;
      notes?: string;
    }[]
  ) => void;
  removeLeaveRecord: (id: string) => void;

  // Raw & Parsed Dataset
  uploadedFile: RawBiometricFile | null;
  setUploadedFile: (file: RawBiometricFile | null) => void;
  parsedDataset: ParsedBiometricDataset | null;
  setUploadedFileAndDataset: (dataset: ParsedBiometricDataset) => void;
  resetDataset: () => void;
  loadSampleDataset: () => void;

  // Active Month Selection & Workspaces (Requirement #7, #8, #18)
  availableMonths: DbAttendanceMonth[];
  activeMonthKey: string;
  setActiveMonthKey: (m: string) => void;
  selectedMonthKey: string;
  setSelectedMonthKey: (m: string) => void;

  // Setup Wizard State
  activeSetupStep: number;
  setActiveSetupStep: (step: number) => void;

  // Real Deterministic Calculated Attendance
  calculatedData: CalculatedMonthData | null;

  // Manual Attendance Correction & Audit Trail (Requirement #14 & #15)
  applyAttendanceCorrection: (params: {
    recordId: string;
    employeeId: string;
    date: string;
    newInTime: string;
    newOutTime: string;
    newStatus: AttendanceStatus;
    reason: string;
  }) => Promise<void>;

  // Import Persistence & Pipeline (Requirement #4, #5, #24)
  commitImportToDatabase: () => Promise<{
    success: boolean;
    importId?: string;
    monthKey?: string;
    monthLabel?: string;
    employeeCount?: number;
    workingDays?: number;
    attendanceRecordsCount?: number;
    exceptionsCount?: number;
    error?: string;
  }>;
  loadMonthDataFromDatabase: (monthKey: string) => Promise<boolean>;
  isImportHistoryOpen: boolean;
  setIsImportHistoryOpen: (open: boolean) => void;

  // Employee Profile Modal / View
  selectedEmployeeIdForProfile: string | null;
  setSelectedEmployeeIdForProfile: (id: string | null) => void;

  // Processing & UI Feedback
  isProcessingUpload: boolean;
  setIsProcessingUpload: (val: boolean) => void;
  toasts: ToastNotification[];
  addToast: (message: string, type?: 'success' | 'info' | 'warning' | 'error', title?: string) => void;
  removeToast: (id: string) => void;
  previewSkeletonMode: boolean;
  setPreviewSkeletonMode: (val: boolean | ((prev: boolean) => boolean)) => void;

  // Exception Center Filtering & Resolution (Requirements #16, #18, #19, #33)
  activeExceptionCategory: string;
  setActiveExceptionCategory: (cat: string) => void;
  navigateToExceptions: (category?: string) => void;
  resolvedExceptionsMap: Record<string, { resolved: boolean; resolvedAt: string; resolutionNote: string }>;
  resolveException: (id: string, note: string) => Promise<void>;
  unresolveException: (id: string) => Promise<void>;

  // Employee Directory Filtering & Search (Requirements #10, #33)
  activeEmployeeFilter: string;
  setActiveEmployeeFilter: (filter: string) => void;
  employeeSearchQuery: string;
  setEmployeeSearchQuery: (query: string) => void;
  navigateToEmployees: (filter?: string, search?: string) => void;

  // Daily Attendance Page Navigation & Filtering (Requirements #28, #29, #30, #33)
  dailyAttendanceDate: string | null;
  setDailyAttendanceDate: (date: string | null) => void;
  dailyAttendanceStatusFilter: string | null;
  setDailyAttendanceStatusFilter: (status: string | null) => void;
  navigateToDailyAttendance: (date?: string, statusFilter?: string) => void;

  // Month-to-Month historical comparison data (Requirement #26)
  previousMonthData: CalculatedMonthData | null;
}

const DEFAULT_OFFICE_CONFIG: OfficeConfig = {
  officeName: 'VR Constructions',
  officeStart: '10:00',
  officeEnd: '18:00',
  lunchStart: '13:30',
  lunchEnd: '14:30',
  lunchDurationMinutes: 60,
  defaultLunchDeductionHours: 1.0,
  graceMinutesLate: 15,
  halfDayThresholdHours: 4.5,
  fullDayThresholdHours: 8.0,
};

const INITIAL_HOLIDAYS: Holiday[] = [];
const INITIAL_LEAVES: LeaveRecord[] = [];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<NavigationPage>('overview');
  const [officeConfig, setOfficeConfig] = useState<OfficeConfig>(DEFAULT_OFFICE_CONFIG);
  const [holidays, setHolidays] = useState<Holiday[]>(INITIAL_HOLIDAYS);
  const [leaves, setLeaves] = useState<LeaveRecord[]>(INITIAL_LEAVES);

  const [parsedDataset, setParsedDataset] = useState<ParsedBiometricDataset | null>(null);
  const [availableMonths, setAvailableMonths] = useState<DbAttendanceMonth[]>([]);
  const [masterEmployees, setMasterEmployees] = useState<Employee[]>([]);
  const [activeMonthKey, setActiveMonthKeyState] = useState<string>('');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('');

  const [activeSetupStep, setActiveSetupStep] = useState<number>(1);
  const [selectedEmployeeIdForProfile, setSelectedEmployeeIdForProfile] = useState<string | null>(null);

  const [isProcessingUpload, setIsProcessingUpload] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [previewSkeletonMode, setPreviewSkeletonMode] = useState<boolean>(false);
  const [isImportHistoryOpen, setIsImportHistoryOpen] = useState<boolean>(false);

  // Manual local overrides map: recordId -> partial AttendanceDay
  const [manualDayOverrides, setManualDayOverrides] = useState<Map<string, Partial<AttendanceDay>>>(
    new Map()
  );

  // Exception Center Filtering & Resolution (Requirements #16, #18, #19, #33)
  const [activeExceptionCategory, setActiveExceptionCategory] = useState<string>('all');
  const [resolvedExceptionsMap, setResolvedExceptionsMap] = useState<
    Record<string, { resolved: boolean; resolvedAt: string; resolutionNote: string }>
  >(() => {
    try {
      const saved = localStorage.getItem('vrc_resolved_exceptions_map');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const resolveException = async (id: string, note: string) => {
    const entry = {
      resolved: true,
      resolvedAt: new Date().toISOString(),
      resolutionNote: note.trim() || 'Resolved by management without altering raw punches',
    };
    setResolvedExceptionsMap((prev) => {
      const next = { ...prev, [id]: entry };
      try {
        localStorage.setItem('vrc_resolved_exceptions_map', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to persist resolved exception', e);
      }
      return next;
    });
    addToast('Exception marked as resolved', 'success', 'Audit Logged');
  };

  const unresolveException = async (id: string) => {
    setResolvedExceptionsMap((prev) => {
      const next = { ...prev };
      delete next[id];
      try {
        localStorage.setItem('vrc_resolved_exceptions_map', JSON.stringify(next));
      } catch (e) {
        console.warn('Failed to update resolved exception', e);
      }
      return next;
    });
    addToast('Exception reopened for review', 'info');
  };

  const navigateToExceptions = (category?: string) => {
    if (category) setActiveExceptionCategory(category);
    setCurrentPage('exceptions');
  };

  // Employee Directory Filtering & Search (Requirements #10, #33)
  const [activeEmployeeFilter, setActiveEmployeeFilter] = useState<string>('all');
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>('');

  const navigateToEmployees = (filter?: string, search?: string) => {
    if (filter) setActiveEmployeeFilter(filter);
    if (search !== undefined) setEmployeeSearchQuery(search);
    setCurrentPage('employees');
  };

  // Daily Attendance Page Navigation & Filtering (Requirements #28, #29, #30, #33)
  const [dailyAttendanceDate, setDailyAttendanceDate] = useState<string | null>(null);
  const [dailyAttendanceStatusFilter, setDailyAttendanceStatusFilter] = useState<string | null>(null);

  const navigateToDailyAttendance = (date?: string, statusFilter?: string) => {
    if (date) setDailyAttendanceDate(date);
    if (statusFilter !== undefined) setDailyAttendanceStatusFilter(statusFilter);
    setCurrentPage('daily-attendance');
  };

  const uploadedFile = parsedDataset ? parsedDataset.file : null;

  const addToast = useCallback(
    (
      message: string,
      type: 'success' | 'info' | 'warning' | 'error' = 'info',
      title?: string
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, message, type, title }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Load comprehensive month data from DatabaseService
  const loadMonthDataFromDatabase = useCallback(
    async (mKey: string): Promise<boolean> => {
      try {
        if (!mKey) return false;

        // 1. Try restoring from fast local cache first
        if (typeof window !== 'undefined') {
          try {
            const cachedStr = localStorage.getItem(`vrc_cache_dataset_${mKey}`);
            if (cachedStr) {
              const cached = JSON.parse(cachedStr);
              if (cached && cached.allPunches && cached.allPunches.length > 0) {
                setParsedDataset(cached);
              }
            }
          } catch {
            // cache read ignored
          }
        }

        // 2. Load punches and master employees from DatabaseService
        const punches = await DatabaseService.getAllPunches();
        const storedMonths = await DatabaseService.getAllMonths();
        const allDbEmps = await DatabaseService.getAllEmployees();

        const empNameMap = new Map<string, string>();
        allDbEmps.forEach((e) => {
          if (e.employee_code) empNameMap.set(e.employee_code, e.employee_name);
        });

        if (punches && punches.length > 0) {
          const rawPunches: RawBiometricPunch[] = punches.map((p) => ({
            id: p.id,
            sourceRowNumber: p.source_row_number,
            machineNumber: p.machine_number || '1',
            enNo: p.employee_code,
            employeeName: p.employee_name_raw,
            mode: p.mode || '1',
            iomd: p.io_mode || '1',
            originalDateTime: `${p.punch_date} ${p.punch_time}`,
            normalizedTimestamp: p.punched_at,
            date: p.punch_date,
            time: p.punch_time,
            isDuplicate: p.is_duplicate,
            isAnomaly: !p.is_valid,
            anomalyReason: p.anomaly_type,
            rawLineSource: p.raw_line_source,
          }));

          punches.forEach((p) => {
            if (p.employee_code && !empNameMap.has(p.employee_code)) {
              empNameMap.set(p.employee_code, p.employee_name_raw || `Employee ${p.employee_code}`);
            }
          });

          const employees: Employee[] = Array.from(empNameMap.entries()).map(([code, name]) => ({
            employeeId: code,
            name,
            isActive: true,
            totalPunchesInFile: punches.filter((x) => x.employee_code === code).length,
          }));

          const dates = Array.from(new Set(punches.map((p) => p.punch_date))).sort();
          const firstDate = dates[0] || `${mKey}-01`;
          const lastDate = dates[dates.length - 1] || `${mKey}-30`;

          const punchesByEmployee: Record<string, RawBiometricPunch[]> = {};
          for (const p of rawPunches) {
            const code = p.enNo || p.employeeId || '';
            if (code) {
              if (!punchesByEmployee[code]) punchesByEmployee[code] = [];
              punchesByEmployee[code].push(p);
            }
          }

          const restoredDataset: ParsedBiometricDataset = {
            file: {
              id: `db-${mKey}`,
              fileName: `Biometric_Export_${mKey}.txt`,
              fileSizeBytes: punches.length * 64,
              mimeType: 'text/plain',
              uploadedAt: new Date().toISOString(),
              rawContent: '',
              totalLinesDetected: punches.length,
              encoding: 'utf-8',
              fileFormat: 'TXT',
              detectedDelimiter: '\t',
            },
            allPunches: rawPunches,
            validPunches: rawPunches.filter((p) => !p.isDuplicate && !p.isAnomaly),
            duplicatePunches: rawPunches.filter((p) => p.isDuplicate),
            anomalies: rawPunches.filter((p) => p.isAnomaly),
            employees,
            firstDate,
            lastDate,
            reportDate: lastDate,
            datesRepresented: dates,
            dateRange: {
              startDate: firstDate,
              endDate: lastDate,
              totalDays: dates.length,
            },
            availableMonths: storedMonths.map((sm) => {
              const monthPunchesCount = punches.filter((p) => p.punch_date && p.punch_date.startsWith(sm.month_key)).length;
              return {
                monthKey: sm.month_key,
                label: sm.month_label,
                recordCount: monthPunchesCount,
                monthLabel: sm.month_label,
                punchCount: monthPunchesCount,
              };
            }),
            punchesByEmployee,
          };

          setParsedDataset(restoredDataset);
        }

        // 3. Load all holidays & leaves across all months with normalized date keys and canonical EnNo names
        const allDbHols = await DatabaseService.getAllHolidays();
        setHolidays(
          allDbHols.map((h) => ({
            id: h.id,
            date: normalizeDateString(h.holiday_date),
            name: h.holiday_name,
          }))
        );

        const allDbLeaves = await DatabaseService.getAllLeaves();
        setLeaves(
          allDbLeaves.map((l) => ({
            id: l.id,
            employeeId: l.employee_code,
            employeeName:
              empNameMap.get(l.employee_code) ||
              empNameMap.get(normalizeEnNo(l.employee_code)) ||
              `Employee ${l.employee_code}`,
            date: normalizeDateString(l.leave_date),
            leaveType: l.leave_type as any,
          }))
        );

        // 4. Load overrides
        const overrides = await DatabaseService.getOverridesForMonth(monthId);
        const newMap = new Map<string, Partial<AttendanceDay>>();
        for (const ov of overrides) {
          const prev = newMap.get(ov.attendance_day_id) || {};
          if (ov.field_name === 'first_punch') prev.firstPunchIn = ov.new_value;
          if (ov.field_name === 'last_punch') prev.lastPunchOut = ov.new_value;
          if (ov.field_name === 'status') prev.status = ov.new_value as any;
          newMap.set(ov.attendance_day_id, prev);
        }
        setManualDayOverrides(newMap);

        setActiveMonthKeyState(mKey);
        setSelectedMonthKey(mKey);
        if (typeof window !== 'undefined') {
          localStorage.setItem('vrc_active_month_key', mKey);
        }

        return true;
      } catch (err) {
        console.error(`Failed to load month data for ${mKey}:`, err);
        return false;
      }
    },
    []
  );

  // Hydrate from DatabaseService upon initial mount
  useEffect(() => {
    const hydrateDatabase = async () => {
      try {
        const storedEmps = await DatabaseService.getAllEmployees();
        if (storedEmps && storedEmps.length > 0) {
          setMasterEmployees(
            storedEmps.map((e) => ({
              employeeId: e.employee_code,
              name: e.employee_name,
              designation: e.designation,
              department: e.department,
              isActive: e.is_active ?? true,
            }))
          );
        }

        const storedMonths = await DatabaseService.getAllMonths();
        if (storedMonths && storedMonths.length > 0) {
          setAvailableMonths(storedMonths);
          const savedActiveKey =
            typeof window !== 'undefined' ? localStorage.getItem('vrc_active_month_key') : null;
          const targetKey =
            savedActiveKey && storedMonths.some((m) => m.month_key === savedActiveKey)
              ? savedActiveKey
              : storedMonths[0].month_key;

          await loadMonthDataFromDatabase(targetKey);
        }
      } catch (err) {
        console.warn('Could not auto-hydrate database:', err);
      }
    };

    hydrateDatabase();
  }, [loadMonthDataFromDatabase]);

  const setActiveMonthKey = useCallback(
    async (m: string) => {
      await loadMonthDataFromDatabase(m);
    },
    [loadMonthDataFromDatabase]
  );

  const setUploadedFile = (file: RawBiometricFile | null) => {
    if (!file) {
      resetDataset();
    }
  };

  const setUploadedFileAndDataset = (dataset: ParsedBiometricDataset) => {
    // Run validation pass to catch anomalies and duplicate bounces
    const { validatedPunches } = validateBiometricPunches(dataset.allPunches);

    const enrichedDataset: ParsedBiometricDataset = {
      ...dataset,
      allPunches: validatedPunches,
      validPunches: validatedPunches.filter((p) => !p.isDuplicate && !p.isAnomaly),
      duplicatePunches: validatedPunches.filter((p) => p.isDuplicate),
      anomalies: validatedPunches.filter((p) => p.isAnomaly),
    };

    setParsedDataset(enrichedDataset);

    // Reconcile and retain master employees
    setMasterEmployees((prev) => {
      const map = new Map<string, Employee>();
      prev.forEach((e) => map.set(e.employeeId, { ...e }));
      enrichedDataset.employees.forEach((e) => {
        if (!e.employeeId) return;
        const existing = map.get(e.employeeId);
        if (existing) {
          if (!existing.name || existing.name.startsWith('Employee ')) existing.name = e.name;
        } else {
          map.set(e.employeeId, { ...e });
        }
      });
      return Array.from(map.values());
    });

    // Populate availableMonths so MonthSelector immediately displays all detected months
    const detectedDbMonths: DbAttendanceMonth[] = enrichedDataset.availableMonths.map((m) => {
      const [yStr, mStr] = m.monthKey.split('-');
      const y = parseInt(yStr, 10);
      const mNum = parseInt(mStr, 10);
      return {
        id: `month-${m.monthKey}`,
        year: y,
        month: mNum,
        month_key: m.monthKey,
        month_label: m.label || m.monthLabel || m.monthKey,
        date_from: `${m.monthKey}-01`,
        date_to: `${m.monthKey}-31`,
        report_date: enrichedDataset.lastDate || `${m.monthKey}-31`,
        calendar_days_count: 31,
        sundays_count: 4,
        holidays_count: 0,
        expected_working_days: 26,
        status: 'CONFIRMED',
        shift_start: officeConfig.officeStart,
        shift_end: officeConfig.officeEnd,
        lunch_start: officeConfig.lunchStart,
        lunch_end: officeConfig.lunchEnd,
        lunch_duration_minutes: officeConfig.lunchDurationMinutes,
        grace_minutes: officeConfig.graceMinutesLate,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    setAvailableMonths(detectedDbMonths);

    // Select the month with highest punch volume or first month (do not blindly default to September or latest)
    const sortedByPunches = [...enrichedDataset.availableMonths].sort(
      (a, b) => (b.punchCount || 0) - (a.punchCount || 0)
    );
    const defaultMonth =
      sortedByPunches[0]?.monthKey || enrichedDataset.availableMonths[0]?.monthKey || '';
    setActiveMonthKeyState(defaultMonth);
    setSelectedMonthKey(defaultMonth);
    setActiveSetupStep(2);
  };

  /**
   * Commit the imported dataset and calculated month to the persistent relational database.
   * Fulfills Requirements #4, #6, #7, #24, #25.
   */
  const commitImportToDatabase = async (): Promise<{
    success: boolean;
    importId?: string;
    monthKey?: string;
    monthLabel?: string;
    employeeCount?: number;
    workingDays?: number;
    attendanceRecordsCount?: number;
    exceptionsCount?: number;
    error?: string;
  }> => {
    if (!parsedDataset || !selectedMonthKey) {
      return { success: false, error: 'No dataset or month selected for import.' };
    }

    try {
      setIsProcessingUpload(true);

      const fileName =
        parsedDataset.file.fileName || (parsedDataset.file as any).name || 'Biometric_Export.txt';
      const fileSize =
        parsedDataset.file.fileSizeBytes ||
        (parsedDataset.file as any).size ||
        (parsedDataset.file.rawContent ? parsedDataset.file.rawContent.length : 0);
      const fileContent =
        parsedDataset.file.rawContent ||
        (parsedDataset.file as any).content ||
        `${fileName}:${parsedDataset.allPunches.length}`;

      const fileHash = await calculateFileHash(fileContent, fileName, fileSize);

      const importId = `imp-${Date.now()}`;
      const startDate =
        parsedDataset.firstDate || parsedDataset.dateRange?.startDate || `${selectedMonthKey}-01`;
      const endDate =
        parsedDataset.lastDate || parsedDataset.dateRange?.endDate || `${selectedMonthKey}-30`;
      const reportDate = parsedDataset.reportDate || endDate;

      const importRecord: DbBiometricImport = {
        id: importId,
        file_name: fileName,
        file_hash: fileHash,
        file_size_bytes: fileSize,
        uploaded_at: new Date().toISOString(),
        date_from: startDate,
        date_to: endDate,
        employee_count: parsedDataset.employees.length,
        punch_count: parsedDataset.allPunches.length,
        valid_punch_count: parsedDataset.validPunches.length,
        duplicate_punch_count: parsedDataset.duplicatePunches.length,
        anomaly_punch_count: parsedDataset.anomalies.length,
        status: 'PROCESSED',
        created_at: new Date().toISOString(),
      };

      // Employees
      const employeesToSave = parsedDataset.employees.map((e) => ({
        code: e.employeeId,
        name: e.name,
      }));

      // Punches
      const punchesToSave: DbBiometricPunch[] = parsedDataset.allPunches.map((p) => ({
        id: p.id,
        import_id: importId,
        employee_id: `emp-${p.enNo || p.employeeId}`,
        machine_number: p.machineNumber || '1',
        source_row_number: p.sourceRowNumber || (p as any).sourceRowIndex || 1,
        employee_code: p.enNo || p.employeeId || '',
        employee_name_raw: p.employeeName || '',
        mode: p.mode || '1',
        io_mode: p.iomd || (p as any).ioMode || '1',
        punched_at:
          p.normalizedTimestamp ||
          (p.date && p.time ? `${p.date}T${p.time}` : new Date().toISOString()),
        punch_date: p.date,
        punch_time: p.time,
        is_duplicate: p.isDuplicate || false,
        is_valid: !p.isAnomaly,
        anomaly_type: p.anomalyReason,
        raw_line_source: p.rawLineSource || (p as any).rawLine || '',
        created_at: new Date().toISOString(),
      }));

      const nowIso = new Date().toISOString();
      const monthsToSave: DbAttendanceMonth[] = [];
      const holidaysToSave: DbHoliday[] = [];
      const leavesToSave: DbLeaveRecord[] = [];
      const attendanceDaysToSave: DbAttendanceDay[] = [];
      const exceptionsToSave: DbAttendanceException[] = [];

      // Determine all months present in the biometric dataset
      const monthsToProcess =
        parsedDataset.availableMonths && parsedDataset.availableMonths.length > 0
          ? parsedDataset.availableMonths.map((m) => m.monthKey)
          : [selectedMonthKey];

      for (const mKey of monthsToProcess) {
        const [yStr, mStr] = mKey.split('-');
        const y = parseInt(yStr, 10);
        const m = parseInt(mStr, 10);
        const monthId = `month-${mKey}`;

        // Scoped calculation for each individual month
        const monthCalc = calculateMonthAttendance(
          parsedDataset,
          mKey,
          officeConfig,
          holidays,
          leaves,
          masterEmployees
        );

        const monthRecord: DbAttendanceMonth = {
          id: monthId,
          year: y,
          month: m,
          month_key: mKey,
          month_label: monthCalc.monthLabel,
          date_from: monthCalc.dailyRecords[0]?.date || `${mKey}-01`,
          date_to: monthCalc.dailyRecords[monthCalc.dailyRecords.length - 1]?.date || `${mKey}-31`,
          report_date: monthCalc.reportDate,
          calendar_days_count: monthCalc.calendarDaysCount,
          sundays_count: monthCalc.sundaysCount,
          holidays_count: monthCalc.holidaysCount,
          expected_working_days: monthCalc.expectedWorkingDays,
          status: 'CONFIRMED',
          shift_start: officeConfig.officeStart,
          shift_end: officeConfig.officeEnd,
          lunch_start: officeConfig.lunchStart,
          lunch_end: officeConfig.lunchEnd,
          lunch_duration_minutes: officeConfig.lunchDurationMinutes,
          grace_minutes: officeConfig.graceMinutesLate,
          created_at: nowIso,
          updated_at: nowIso,
        };
        monthsToSave.push(monthRecord);

        // Holidays for this month
        holidays
          .filter((h) => {
            const norm = normalizeDateString(h.date);
            return norm.startsWith(mKey);
          })
          .forEach((h) => {
            const normDate = normalizeDateString(h.date);
            holidaysToSave.push({
              id: h.id || `hol-${mKey}-${normDate}`,
              attendance_month_id: monthId,
              holiday_date: normDate,
              holiday_name: h.name,
              created_at: nowIso,
            });
          });

        // Leaves for this month
        leaves
          .filter((l) => {
            const norm = normalizeDateString(l.date);
            return norm.startsWith(mKey);
          })
          .forEach((l) => {
            const normDate = normalizeDateString(l.date);
            leavesToSave.push({
              id: l.id || `leave-${l.employeeId}-${normDate}`,
              attendance_month_id: monthId,
              employee_id: `emp-${l.employeeId}`,
              employee_code: l.employeeId,
              leave_date: normDate,
              leave_type: l.leaveType || 'CASUAL',
              created_at: nowIso,
              updated_at: nowIso,
            });
          });

        // Attendance daily records for this month
        monthCalc.dailyRecords.forEach((d) => {
          attendanceDaysToSave.push({
            id: d.id,
            attendance_month_id: monthId,
            employee_id: `emp-${d.employeeId}`,
            employee_code: d.employeeId,
            employee_name: d.employeeName,
            attendance_date: d.date,
            first_punch: d.firstPunchIn,
            last_punch: d.lastPunchOut,
            punch_count: d.punchCount,
            gross_minutes: d.grossMinutes,
            lunch_minutes: d.lunchDeductionMinutes,
            net_minutes: d.netMinutes,
            status: d.status,
            is_late: d.isLateArrival,
            late_minutes: d.lateMinutes,
            is_early_departure: d.isEarlyDeparture,
            early_minutes: d.earlyMinutes,
            has_anomaly: d.exceptions.some((ex) => ex.category === 'ANOMALY'),
            is_manually_corrected: false,
            created_at: nowIso,
            updated_at: nowIso,
          });
        });

        // Exceptions for this month
        monthCalc.exceptions.forEach((ex, idx) => {
          exceptionsToSave.push({
            id: ex.id || `exc-${monthId}-${ex.employeeId}-${ex.date}-${idx}`,
            attendance_month_id: monthId,
            employee_id: `emp-${ex.employeeId}`,
            employee_code: ex.employeeId,
            employee_name: ex.employeeName,
            attendance_date: ex.date,
            exception_type: ex.category as any,
            severity: ex.severity,
            title: ex.title,
            description: ex.description,
            resolved: false,
            created_at: nowIso,
            updated_at: nowIso,
          });
        });
      }

      await DatabaseService.saveImportTransaction({
        importRecord,
        employees: employeesToSave,
        punches: punchesToSave,
        months: monthsToSave,
        holidays: holidaysToSave,
        leaves: leavesToSave,
        attendanceDays: attendanceDaysToSave,
        exceptions: exceptionsToSave,
      });

      // Update available months list in state
      const allMonths = await DatabaseService.getAllMonths();
      setAvailableMonths(allMonths);
      setActiveMonthKeyState(selectedMonthKey);

      // Hydrate all database tables into application context
      await loadMonthDataFromDatabase(selectedMonthKey);

      if (typeof window !== 'undefined') {
        localStorage.setItem('vrc_active_month_key', selectedMonthKey);
        try {
          localStorage.setItem(`vrc_cache_dataset_${selectedMonthKey}`, JSON.stringify(parsedDataset));
        } catch {
          // ignore cache quota
        }
      }

      setIsProcessingUpload(false);
      addToast(
        `Import committed to database: ${fileName} (${parsedDataset.employees.length} employees, ${attendanceDaysToSave.length} records)`,
        'success',
        'Database Synchronized'
      );

      return {
        success: true,
        importId,
        monthKey: selectedMonthKey,
        monthLabel: calculatedData?.monthLabel || selectedMonthKey,
        employeeCount: parsedDataset.employees.length,
        workingDays: calculatedData?.expectedWorkingDays || 26,
        attendanceRecordsCount: attendanceDaysToSave.length,
        exceptionsCount: exceptionsToSave.length,
      };
    } catch (err: any) {
      setIsProcessingUpload(false);
      console.error('Failed to commit import to database:', err);
      addToast(`Error persisting to database: ${err.message}`, 'error');
      return {
        success: false,
        error: err.message || 'Database transaction failed',
      };
    }
  };

  const loadSampleDataset = async () => {
    try {
      setIsProcessingUpload(true);
      const parsed = parseBiometricFile(
        SAMPLE_BIOMETRIC_RAW_TEXT,
        SAMPLE_BIOMETRIC_FILE_NAME,
        SAMPLE_BIOMETRIC_RAW_TEXT.length,
        'text/plain'
      );
      parsed.isSampleData = true;
      setUploadedFileAndDataset(parsed);

      // Auto-register sample month into database
      const [yStr, mStr] = (parsed.availableMonths[0]?.monthKey || '2026-09').split('-');
      const y = parseInt(yStr, 10);
      const m = parseInt(mStr, 10);
      const monthKey = `${yStr}-${mStr}`;
      const monthId = `month-${monthKey}`;
      const monthRecord: DbAttendanceMonth = {
        id: monthId,
        year: y,
        month: m,
        month_key: monthKey,
        month_label: `${new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
        date_from: parsed.firstDate || `${monthKey}-01`,
        date_to: parsed.lastDate || `${monthKey}-30`,
        report_date: parsed.reportDate || parsed.lastDate || `${monthKey}-30`,
        calendar_days_count: 30,
        sundays_count: 4,
        holidays_count: 0,
        expected_working_days: 26,
        status: 'CONFIRMED',
        shift_start: '10:00',
        shift_end: '18:00',
        lunch_start: '13:30',
        lunch_end: '14:30',
        lunch_duration_minutes: 60,
        grace_minutes: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await DatabaseService.saveMonth(monthRecord);
      const updatedMonths = await DatabaseService.getAllMonths();
      setAvailableMonths(updatedMonths);

      setIsProcessingUpload(false);
      addToast(
        `Loaded enterprise sample log (${parsed.employees.length} employees, ${parsed.allPunches.length} punch records)`,
        'success',
        'Sample Dataset Ready'
      );
    } catch (err: any) {
      setIsProcessingUpload(false);
      addToast(err.message || 'Failed to load sample dataset', 'error');
    }
  };

  const resetDataset = () => {
    setParsedDataset(null);
    setSelectedMonthKey('');
    setActiveSetupStep(1);
    addToast('Dataset cleared from active session', 'info');
  };

  const updateOfficeConfig = (newConfig: Partial<OfficeConfig>) => {
    setOfficeConfig((prev) => ({ ...prev, ...newConfig }));
    addToast('Office shift configuration updated', 'success', 'Shift Settings Saved');
  };

  const addHoliday = (holiday: Omit<Holiday, 'id'>) => {
    const normDate = normalizeDateString(holiday.date);
    const id = `hol-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newHol: Holiday = {
      ...holiday,
      date: normDate,
      id,
    };
    setHolidays((prev) => [...prev, newHol]);

    // Persist to relational database
    const monthId = `month-${normDate.substring(0, 7)}`;
    DatabaseService.addHoliday({
      id,
      attendance_month_id: monthId,
      holiday_date: normDate,
      holiday_name: holiday.name,
      created_at: new Date().toISOString(),
    });

    addToast(`Added company holiday: ${holiday.name} (${normDate})`, 'success');
  };

  const removeHoliday = (id: string) => {
    setHolidays((prev) => prev.filter((h) => h.id !== id));
    DatabaseService.deleteHoliday(id);
    addToast('Holiday removed', 'info');
  };

  const addLeaveRecord = (leave: Omit<LeaveRecord, 'id'>) => {
    const normDate = normalizeDateString(leave.date);
    const cleanEmpId = leave.employeeId.trim().replace(/^emp[-_]/i, '');
    const id = `leave-${cleanEmpId}-${normDate}-${Date.now()}`;
    const newLeave: LeaveRecord = {
      ...leave,
      employeeId: cleanEmpId,
      date: normDate,
      id,
    };

    setLeaves((prev) => [
      ...prev.filter((l) => !(isEnNoMatch(l.employeeId, cleanEmpId) && l.date === normDate)),
      newLeave,
    ]);

    // Persist to database
    const monthId = `month-${normDate.substring(0, 7)}`;
    DatabaseService.addLeavesBatch([
      {
        id,
        employee_id: `emp-${cleanEmpId}`,
        employee_code: cleanEmpId,
        attendance_month_id: monthId,
        leave_date: normDate,
        leave_type: (leave.leaveType as any) || 'CASUAL',
        notes: undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

    addToast(`Registered approved leave for ${leave.employeeName} (${normDate})`, 'success');
  };

  const addBatchLeaves = (
    records: {
      employeeId: string;
      employeeName: string;
      date: string;
      leaveType: any;
      notes?: string;
    }[]
  ) => {
    const newLeaves: LeaveRecord[] = [];
    const dbRecords: DbLeaveRecord[] = [];
    const now = new Date().toISOString();

    for (const r of records) {
      const normDate = normalizeDateString(r.date);
      const cleanEmpId = r.employeeId.trim().replace(/^emp[-_]/i, '');
      const id = `leave-${cleanEmpId}-${normDate}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const monthId = `month-${normDate.substring(0, 7)}`;

      newLeaves.push({
        id,
        employeeId: cleanEmpId,
        employeeName: r.employeeName,
        date: normDate,
        leaveType: r.leaveType,
      });

      dbRecords.push({
        id,
        employee_id: `emp-${cleanEmpId}`,
        employee_code: cleanEmpId,
        attendance_month_id: monthId,
        leave_date: normDate,
        leave_type: r.leaveType,
        notes: r.notes,
        created_at: now,
        updated_at: now,
      });
    }

    setLeaves((prev) => {
      // Filter out any existing leaves that match the incoming assignments (same employee + date)
      const filtered = prev.filter(
        (prevL) =>
          !records.some(
            (rec) =>
              isEnNoMatch(prevL.employeeId, rec.employeeId) &&
              prevL.date === normalizeDateString(rec.date)
          )
      );
      return [...filtered, ...newLeaves];
    });

    DatabaseService.addLeavesBatch(dbRecords);
    addToast(
      `Registered ${records.length} leave assignment(s) across selected personnel and dates`,
      'success',
      'Batch Leaves Saved'
    );
  };

  const removeLeaveRecord = (id: string) => {
    setLeaves((prev) => prev.filter((l) => l.id !== id));
    DatabaseService.deleteLeave(id);
    addToast('Leave record removed', 'info');
  };

  /**
   * Manual Attendance Correction & Audit Trail
   * Requirement #14 & #15
   */
  const applyAttendanceCorrection = async (params: {
    recordId: string;
    employeeId: string;
    date: string;
    newInTime: string;
    newOutTime: string;
    newStatus: AttendanceStatus;
    reason: string;
  }) => {
    const monthId = `month-${params.date.substring(0, 7)}`;

    // 1. Audit overrides in DatabaseService
    if (params.newInTime) {
      await DatabaseService.applyAttendanceOverride({
        attendanceDayId: params.recordId,
        monthId,
        employeeId: `emp-${params.employeeId}`,
        date: params.date,
        fieldName: 'first_punch',
        originalValue: '',
        newValue: params.newInTime,
        reason: params.reason,
      });
    }
    if (params.newOutTime) {
      await DatabaseService.applyAttendanceOverride({
        attendanceDayId: params.recordId,
        monthId,
        employeeId: `emp-${params.employeeId}`,
        date: params.date,
        fieldName: 'last_punch',
        originalValue: '',
        newValue: params.newOutTime,
        reason: params.reason,
      });
    }
    if (params.newStatus) {
      await DatabaseService.applyAttendanceOverride({
        attendanceDayId: params.recordId,
        monthId,
        employeeId: `emp-${params.employeeId}`,
        date: params.date,
        fieldName: 'status',
        originalValue: '',
        newValue: params.newStatus,
        reason: params.reason,
      });
    }

    // 2. Update local state map immediately
    setManualDayOverrides((prev) => {
      const next = new Map(prev);
      const existing: Partial<AttendanceDay> = next.get(params.recordId) || {};
      next.set(params.recordId, {
        ...existing,
        firstPunchIn: params.newInTime || existing.firstPunchIn,
        lastPunchOut: params.newOutTime || existing.lastPunchOut,
        status: params.newStatus || existing.status,
      });
      return next;
    });

    addToast(
      `Manual correction logged for Employee ${params.employeeId} on ${params.date}`,
      'success',
      'Audit Override Saved'
    );
  };

  // Pure Deterministic Attendance Calculation with manual override merges
  const calculatedData = useMemo(() => {
    if (!parsedDataset || !selectedMonthKey) return null;
    const base = calculateMonthAttendance(
      parsedDataset,
      selectedMonthKey,
      officeConfig,
      holidays,
      leaves,
      masterEmployees
    );

    if (!base || manualDayOverrides.size === 0) return base;

    // Apply manual day overrides non-destructively
    const updatedDailyRecords = manualDayOverrides.size > 0
      ? base.dailyRecords.map((r) => {
          const override = manualDayOverrides.get(r.id);
          if (!override) return r;

          const firstIn = override.firstPunchIn !== undefined ? override.firstPunchIn : r.firstPunchIn;
          const lastOut = override.lastPunchOut !== undefined ? override.lastPunchOut : r.lastPunchOut;
          const st = override.status !== undefined ? override.status : r.status;

          let grossMins = r.grossMinutes;
          let netMins = r.netMinutes;
          if (firstIn && lastOut) {
            const [hIn, mIn] = firstIn.split(':').map(Number);
            const [hOut, mOut] = lastOut.split(':').map(Number);
            grossMins = Math.max(0, hOut * 60 + mOut - (hIn * 60 + mIn));
            netMins = Math.max(0, grossMins - r.lunchDeductionMinutes);
          }

          return {
            ...r,
            firstPunchIn: firstIn,
            lastPunchOut: lastOut,
            status: st,
            grossMinutes: grossMins,
            netMinutes: netMins,
            netHours: Math.round((netMins / 60) * 10) / 10,
          };
        })
      : base.dailyRecords;

    // Attach resolution statuses to exceptions without touching underlying punches (Requirement #19)
    const updatedExceptions = base.exceptions.map((exc) => {
      const res = resolvedExceptionsMap[exc.id];
      if (res) {
        return {
          ...exc,
          isResolved: res.resolved,
          resolvedAt: res.resolvedAt,
          resolutionNote: res.resolutionNote,
        };
      }
      return exc;
    });

    return {
      ...base,
      dailyRecords: updatedDailyRecords,
      exceptions: updatedExceptions,
    };
  }, [parsedDataset, selectedMonthKey, officeConfig, holidays, leaves, masterEmployees, manualDayOverrides, resolvedExceptionsMap]);

  // Compute Previous Month for Executive Comparison (Requirement #26 & #27)
  const previousMonthKey = useMemo(() => {
    if (!selectedMonthKey) return '';
    const [yStr, mStr] = selectedMonthKey.split('-');
    let y = parseInt(yStr, 10);
    let m = parseInt(mStr, 10);
    m -= 1;
    if (m < 1) {
      m = 12;
      y -= 1;
    }
    return `${y}-${m.toString().padStart(2, '0')}`;
  }, [selectedMonthKey]);

  const previousMonthData = useMemo(() => {
    if (!parsedDataset || !previousMonthKey) return null;
    const hasMonth = parsedDataset.availableMonths.some((m) => m.monthKey === previousMonthKey);
    if (!hasMonth) return null;

    return calculateMonthAttendance(
      parsedDataset,
      previousMonthKey,
      officeConfig,
      holidays,
      leaves,
      masterEmployees
    );
  }, [parsedDataset, previousMonthKey, officeConfig, holidays, leaves, masterEmployees]);

  return (
    <AppContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        officeConfig,
        updateOfficeConfig,
        holidays,
        addHoliday,
        removeHoliday,
        leaves,
        addLeaveRecord,
        addBatchLeaves,
        removeLeaveRecord,
        uploadedFile,
        setUploadedFile,
        parsedDataset,
        setUploadedFileAndDataset,
        resetDataset,
        loadSampleDataset,
        availableMonths,
        activeMonthKey,
        setActiveMonthKey,
        selectedMonthKey,
        setSelectedMonthKey,
        activeSetupStep,
        setActiveSetupStep,
        calculatedData,
        applyAttendanceCorrection,
        commitImportToDatabase,
        loadMonthDataFromDatabase,
        isImportHistoryOpen,
        setIsImportHistoryOpen,
        selectedEmployeeIdForProfile,
        setSelectedEmployeeIdForProfile,
        isProcessingUpload,
        setIsProcessingUpload,
        toasts,
        addToast,
        removeToast,
        previewSkeletonMode,
        setPreviewSkeletonMode,
        activeExceptionCategory,
        setActiveExceptionCategory,
        navigateToExceptions,
        resolvedExceptionsMap,
        resolveException,
        unresolveException,
        activeEmployeeFilter,
        setActiveEmployeeFilter,
        employeeSearchQuery,
        setEmployeeSearchQuery,
        navigateToEmployees,
        dailyAttendanceDate,
        setDailyAttendanceDate,
        dailyAttendanceStatusFilter,
        setDailyAttendanceStatusFilter,
        navigateToDailyAttendance,
        previousMonthData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
