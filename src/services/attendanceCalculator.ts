import {
  ParsedBiometricDataset,
  OfficeConfig,
  Holiday,
  LeaveRecord,
  AttendanceDay,
  AttendanceException,
  EmployeeAttendanceSummary,
  CalculatedMonthData,
  AttendanceStatus,
  RawBiometricPunch,
  Employee,
} from '../types/attendance';

/**
 * VR CONSTRUCTIONS — DETERMINISTIC ATTENDANCE ENGINE
 *
 * Implements strict, auditable attendance calculations:
 * - Sundays excluded
 * - User-configured holidays excluded from expected days
 * - Employee approved leaves excluded from employee expected attendance days
 * - Deterministic punch pairing: first valid = IN, last valid = OUT
 * - Lunch deduction configured via office settings
 * - Late arrival based on shift start + grace window
 * - Early departure based on official shift close
 * - Report date endpoint handling (single punch on report date = OUT_PENDING)
 * - Single punch on historical date = SINGLE_PUNCH (never fabricated hours)
 */

/**
 * Helper to convert "HH:mm" or "HH:mm:ss" to minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  // Handle AM/PM if present
  let clean = timeStr.trim();
  const isPM = clean.toUpperCase().includes('PM');
  const isAM = clean.toUpperCase().includes('AM');
  clean = clean.replace(/\s*(AM|PM)/i, '');

  const parts = clean.split(':').map((p) => parseInt(p, 10) || 0);
  let hours = parts[0] || 0;
  const minutes = parts[1] || 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Formats minutes into "Xh Ym" string
 */
export function formatHoursMinutes(totalMinutes: number): string {
  if (!totalMinutes || totalMinutes <= 0) return '0h 00m';
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/**
 * Generates an array of all YYYY-MM-DD dates for a given month (e.g., "2026-09")
 */
export function getCalendarDatesForMonth(monthKey: string): string[] {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  // Total days in month: new Date(year, month, 0).getDate()
  const totalDays = new Date(year, month, 0).getDate();
  const dates: string[] = [];

  for (let d = 1; d <= totalDays; d++) {
    const dayPadded = d.toString().padStart(2, '0');
    const monthPadded = month.toString().padStart(2, '0');
    dates.push(`${year}-${monthPadded}-${dayPadded}`);
  }

  return dates;
}

/**
 * Robust date string normalizer.
 * Supports:
 * - YYYY-MM-DD
 * - YYYY/MM/DD, YYYY.MM.DD
 * - DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
 * - Timestamps (e.g., "2026/08/25 09:36:56" or ISO strings)
 */
export function normalizeDateString(dateStr: string): string {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();
  if (!clean) return '';

  // If already standard ISO date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // If timestamp like 2026/08/25 09:36:56 or 2026-08-25T09:36:56 or 25/08/2026 09:36:56
  const timeMatch = clean.match(/^(\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4})[\sT]/);
  const dateCandidate = timeMatch ? timeMatch[1] : clean;

  // Pattern 1: YYYY[-/.]MM[-/.]DD
  const ymd = dateCandidate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (ymd) {
    const y = ymd[1];
    const m = ymd[2].padStart(2, '0');
    const d = ymd[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Pattern 2: DD[-/.]MM[-/.]YYYY
  const dmy = dateCandidate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    let p1 = parseInt(dmy[1], 10);
    let p2 = parseInt(dmy[2], 10);
    const y = dmy[3];
    let d: string;
    let m: string;
    if (p1 > 12) {
      d = String(p1).padStart(2, '0');
      m = String(p2).padStart(2, '0');
    } else if (p2 > 12) {
      m = String(p1).padStart(2, '0');
      d = String(p2).padStart(2, '0');
    } else {
      // In DD/MM/YYYY format, p1 is day and p2 is month (standard in India / UK)
      d = String(p1).padStart(2, '0');
      m = String(p2).padStart(2, '0');
    }
    return `${y}-${m}-${d}`;
  }

  // Fallback: Date.parse on full clean string (supports "27 August 2026", "25 Aug 2026", etc.)
  const parsed = Date.parse(clean);
  if (!isNaN(parsed)) {
    const dt = new Date(parsed);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return clean;
}

/**
 * Normalizes EnNo (Employee Enrollment Number) for comparison.
 * Strips leading zeros for numeric IDs (e.g., "000000008" -> "8")
 * and converts to lowercase for alphanumeric strings. Strips any "emp-" prefix.
 */
export function normalizeEnNo(enNo: string): string {
  if (!enNo) return '';
  const clean = String(enNo).trim().replace(/^emp[-_]/i, '');
  if (/^\d+$/.test(clean)) {
    return String(parseInt(clean, 10));
  }
  return clean.toLowerCase();
}

/**
 * Determines whether two employee IDs/EnNos match, handling leading zero differences
 * (e.g. "000000008" and "8") and prefix differences (e.g. "emp-000000008").
 */
export function isEnNoMatch(id1?: string, id2?: string): boolean {
  if (!id1 || !id2) return false;
  const c1 = String(id1).trim().replace(/^emp[-_]/i, '');
  const c2 = String(id2).trim().replace(/^emp[-_]/i, '');
  if (c1 === c2) return true;
  if (/^\d+$/.test(c1) && /^\d+$/.test(c2)) {
    return parseInt(c1, 10) === parseInt(c2, 10);
  }
  return c1.toLowerCase() === c2.toLowerCase();
}

/**
 * Checks if a YYYY-MM-DD date is a Sunday
 */
export function isDateSunday(dateStr: string): boolean {
  const norm = normalizeDateString(dateStr);
  const [y, m, d] = norm.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  return dateObj.getDay() === 0;
}

export const DEFAULT_OFFICE_CONFIG: OfficeConfig = {
  officeName: 'Corporate HQ',
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

// Helper to generate all ISO date strings in [startDate, endDate] deterministically without timezone drift
export function getDatesInRange(startDate: string, endDate: string): string[] {
  if (!startDate || !endDate || startDate > endDate) return [];
  const dates: string[] = [];
  const [startY, startM, startD] = startDate.split('-').map(Number);
  const [endY, endM, endD] = endDate.split('-').map(Number);
  const cur = new Date(Date.UTC(startY, startM - 1, startD));
  const end = new Date(Date.UTC(endY, endM - 1, endD));
  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = (cur.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = cur.getUTCDate().toString().padStart(2, '0');
    dates.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Calculates complete attendance metrics for a selected month
 */
export function calculateMonthAttendance(
  dataset: ParsedBiometricDataset,
  monthKey: string,
  officeConfig: OfficeConfig = DEFAULT_OFFICE_CONFIG,
  holidays: Holiday[] = [],
  leaves: LeaveRecord[] = [],
  knownMasterEmployees: Employee[] = []
): CalculatedMonthData {
  const config = officeConfig || DEFAULT_OFFICE_CONFIG;

  // 1. Determine global dataset start date and end date
  let datasetStartDate = dataset.firstDate || '';
  let datasetEndDate = dataset.lastDate || '';

  if (!datasetStartDate || !datasetEndDate) {
    const dates = Array.from(new Set(dataset.validPunches.map((p) => p.date).filter(Boolean))).sort();
    if (dates.length > 0) {
      if (!datasetStartDate) datasetStartDate = dates[0];
      if (!datasetEndDate) datasetEndDate = dates[dates.length - 1];
    }
  }

  // 2. Determine calendar boundaries of monthKey or handle OVERALL / COMBINED period
  const isCombined =
    !monthKey ||
    monthKey === 'ALL' ||
    monthKey === 'COMBINED' ||
    monthKey === 'YEARLY' ||
    monthKey === 'OVERALL' ||
    monthKey === 'Overall' ||
    monthKey.toLowerCase() === 'all' ||
    monthKey.toLowerCase() === 'overall';
  
  let allMonthDates: string[] = [];
  let monthStartDate = datasetStartDate;
  let monthEndDate = datasetEndDate;

  if (isCombined) {
    // Multi-month or overall range spanning strictly the imported dataset dates
    monthStartDate = datasetStartDate;
    monthEndDate = datasetEndDate;
    if (datasetStartDate && datasetEndDate && datasetStartDate <= datasetEndDate) {
      allMonthDates = getDatesInRange(datasetStartDate, datasetEndDate);
    }
  } else {
    const [yearStr, monthStr] = monthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10); // 1-12
    const totalDaysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthFirstCalDate = `${monthKey}-01`;
    const monthLastCalDate = `${monthKey}-${totalDaysInMonth.toString().padStart(2, '0')}`;

    // 3. Strict analysis period boundary (Requirement #1 & #2):
    // "Earliest Date = Dataset Start Date, Latest Date = Dataset End Date"
    // "The system MUST NOT create attendance or absence records for dates outside uploaded dataset"
    const effectiveStart = datasetStartDate && datasetStartDate > monthFirstCalDate ? datasetStartDate : monthFirstCalDate;
    const effectiveEnd = datasetEndDate && datasetEndDate < monthLastCalDate ? datasetEndDate : monthLastCalDate;

    if (!datasetStartDate || !datasetEndDate || effectiveStart > monthLastCalDate || effectiveEnd < monthFirstCalDate || effectiveStart > effectiveEnd) {
      allMonthDates = [];
      monthStartDate = monthFirstCalDate;
      monthEndDate = monthLastCalDate;
    } else {
      monthStartDate = effectiveStart;
      monthEndDate = effectiveEnd;
      allMonthDates = getDatesInRange(monthStartDate, monthEndDate);
    }
  }
  
  // Scoped report date: latest date within this month workspace
  let reportDate = monthEndDate;
  if (dataset.reportDate && dataset.reportDate >= monthStartDate && dataset.reportDate <= monthEndDate) {
    reportDate = dataset.reportDate;
  }

  // Map of holiday dates for fast lookup with normalized dates (Requirement #5)
  const holidayDateMap = new Map<string, string>();
  holidays.forEach((h) => {
    if (!h.date) return;
    const normDate = normalizeDateString(h.date);
    if (isCombined || normDate.startsWith(monthKey)) {
      holidayDateMap.set(normDate, h.name || 'Holiday');
    }
  });

  // Count Sundays and Holidays strictly within the active date range
  let sundaysCount = 0;
  let holidaysCount = 0;

  allMonthDates.forEach((dateStr) => {
    const norm = normalizeDateString(dateStr);
    if (isDateSunday(norm)) {
      sundaysCount++;
    } else if (holidayDateMap.has(norm)) {
      holidaysCount++;
    }
  });

  // Company expected working days in the analyzed period
  const expectedWorkingDays = Math.max(0, allMonthDates.length - sundaysCount - holidaysCount);

  // Helper to add punch to lookup with multiple keys
  const addToPunchLookup = (k: string, p: RawBiometricPunch) => {
    if (!punchLookup.has(k)) punchLookup.set(k, []);
    punchLookup.get(k)!.push(p);
  };

  // Group valid punches by employeeId and normalized date (Requirement #4)
  const punchLookup = new Map<string, RawBiometricPunch[]>();
  dataset.validPunches.forEach((p) => {
    if (!p.date || !p.enNo) return;
    const normDate = normalizeDateString(p.date);
    const rawEnNo = p.enNo.trim();
    const normEnNo = normalizeEnNo(rawEnNo);
    const paddedEnNo = /^\d+$/.test(normEnNo) ? normEnNo.padStart(9, '0') : rawEnNo;

    addToPunchLookup(`${rawEnNo}|${normDate}`, p);
    if (normEnNo !== rawEnNo) addToPunchLookup(`${normEnNo}|${normDate}`, p);
    if (paddedEnNo !== rawEnNo) addToPunchLookup(`${paddedEnNo}|${normDate}`, p);
    if (/^\d+$/.test(rawEnNo)) addToPunchLookup(`${parseInt(rawEnNo, 10)}|${normDate}`, p);
  });

  // Map employee leaves: indexed by raw employeeId|date, normalized EnNo|date, and padded EnNo|date (Requirement #3 & #4)
  const leaveMap = new Map<string, LeaveRecord>();
  leaves.forEach((l) => {
    if (!l.employeeId || !l.date) return;
    const normDate = normalizeDateString(l.date);
    if (isCombined || normDate.startsWith(monthKey)) {
      const rawId = l.employeeId.trim();
      const normId = normalizeEnNo(rawId);
      const paddedId = /^\d+$/.test(normId) ? normId.padStart(9, '0') : rawId;

      leaveMap.set(`${rawId}|${normDate}`, l);
      leaveMap.set(`${normId}|${normDate}`, l);
      leaveMap.set(`${paddedId}|${normDate}`, l);
      if (/^\d+$/.test(rawId)) {
        leaveMap.set(`${parseInt(rawId, 10)}|${normDate}`, l);
      }
      leaveMap.set(`emp-${rawId}|${normDate}`, l);
      leaveMap.set(`emp-${normId}|${normDate}`, l);
    }
  });

  const officeStartMinutes = parseTimeToMinutes(config.officeStart || '10:00');
  const graceMinutes = config.graceMinutesLate ?? 15;
  const lateThresholdMinutes = officeStartMinutes + graceMinutes;

  const officeEndMinutes = parseTimeToMinutes(config.officeEnd || '18:00');
  const lunchDeductionMin = config.lunchDurationMinutes ?? 60;

  const dailyRecords: AttendanceDay[] = [];
  const exceptions: AttendanceException[] = [];

  // Carry forward file anomalies into exceptions list
  dataset.anomalies.forEach((a) => {
    exceptions.push({
      id: `exc-anom-${a.id}`,
      employeeId: a.enNo,
      employeeName: a.employeeName,
      date: a.date || monthKey,
      category: 'ANOMALY',
      severity: 'medium',
      title: 'Biometric File Anomaly',
      description: a.anomalyReason || 'Malformed or irregular biometric record',
      punches: [a],
    });
  });

  // 4. Reconcile Employee Master (Requirements #6 & #7):
  // Combine known master employees with dataset employees using EnNo as stable natural key.
  const employeeMap = new Map<string, Employee>();
  if (knownMasterEmployees && knownMasterEmployees.length > 0) {
    knownMasterEmployees.forEach((emp) => {
      if (emp.employeeId) employeeMap.set(emp.employeeId, { ...emp });
    });
  }
  if (dataset.employees && dataset.employees.length > 0) {
    dataset.employees.forEach((emp) => {
      if (!emp.employeeId) return;
      const existing = employeeMap.get(emp.employeeId);
      if (existing) {
        if (!existing.name || existing.name.startsWith('Employee ')) {
          existing.name = emp.name;
        }
      } else {
        employeeMap.set(emp.employeeId, { ...emp });
      }
    });
  }

  const activeEmployees: Employee[] = Array.from(employeeMap.values()).sort((a, b) => {
    const numA = Number(a.employeeId);
    const numB = Number(b.employeeId);
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
    return a.employeeId.localeCompare(b.employeeId);
  });

  const configuredEmployeeCount = config.totalEmployeesCount ?? activeEmployees.length;
  const knownEmployeesCount = activeEmployees.length;
  const employeeCountDiscrepancy = configuredEmployeeCount > knownEmployeesCount;
  const discrepancyMessage = employeeCountDiscrepancy
    ? `Employee master contains fewer employees than the configured office count (${knownEmployeesCount} known vs ${configuredEmployeeCount} configured).`
    : undefined;

  // Calculate daily attendance records for each employee across valid dates
  const employeeSummaries: EmployeeAttendanceSummary[] = [];

  for (const emp of activeEmployees) {
    let presentDays = 0;
    let approvedLeaveDays = 0;
    let absentDays = 0;
    let singlePunchDays = 0;
    let outPendingDays = 0;
    let sundayDays = 0;
    let holidayDays = 0;
    let totalGrossMinutes = 0;
    let totalNetMinutes = 0;
    let lateArrivalsCount = 0;
    let earlyDeparturesCount = 0;
    let empExceptionsCount = 0;

    // Track employee leaves on working days to subtract from employee expected attendance days
    let employeeLeaveOnWorkingDays = 0;

    for (const dateStr of allMonthDates) {
      const normDateStr = normalizeDateString(dateStr);
      const isSunday = isDateSunday(normDateStr);
      const isHoliday = holidayDateMap.has(normDateStr);

      // Leave check with canonical EnNo variants and normalized Date (Requirement #2, #3, #4)
      const empIdRaw = emp.employeeId.trim();
      const normEmpEnNo = normalizeEnNo(empIdRaw);
      const paddedEmpEnNo = /^\d+$/.test(normEmpEnNo) ? normEmpEnNo.padStart(9, '0') : empIdRaw;
      const unpaddedEmpEnNo = /^\d+$/.test(normEmpEnNo) ? String(parseInt(normEmpEnNo, 10)) : normEmpEnNo;

      const leaveRecord =
        leaveMap.get(`${empIdRaw}|${normDateStr}`) ||
        leaveMap.get(`${normEmpEnNo}|${normDateStr}`) ||
        leaveMap.get(`${paddedEmpEnNo}|${normDateStr}`) ||
        leaveMap.get(`${unpaddedEmpEnNo}|${normDateStr}`) ||
        leaveMap.get(`emp-${empIdRaw}|${normDateStr}`) ||
        leaveMap.get(`emp-${normEmpEnNo}|${normDateStr}`);
      const hasLeave = !!leaveRecord;

      // Punch lookup with all EnNo variants and normalized Date
      const rawDayPunches =
        punchLookup.get(`${empIdRaw}|${normDateStr}`) ||
        punchLookup.get(`${normEmpEnNo}|${normDateStr}`) ||
        punchLookup.get(`${paddedEmpEnNo}|${normDateStr}`) ||
        punchLookup.get(`${unpaddedEmpEnNo}|${normDateStr}`) ||
        [];

      // Sort punches chronologically by time
      const dayPunches = [...rawDayPunches].sort((a, b) => a.time.localeCompare(b.time));
      const punchCount = dayPunches.length;

      let status: AttendanceStatus;
      let firstPunchIn: string | undefined = undefined;
      let lastPunchOut: string | undefined = undefined;
      let grossMinutes = 0;
      let grossHours = 0;
      let netMinutes = 0;
      let netHours = 0;
      let isLateArrival = false;
      let isEarlyDeparture = false;
      let lateMinutes = 0;
      let earlyMinutes = 0;
      const dayExceptions: AttendanceException[] = [];

      // DAILY STATUS PRIORITY (Requirement #8)
      // 1. Sunday -> Sunday / Non-working day
      // 2. Configured Holiday -> Holiday
      // 3. Approved Leave -> Leave
      // 4. Valid biometric punches -> Present / Single Punch / relevant exception
      // 5. No punch and working day -> Absent

      if (isSunday) {
        status = 'SUNDAY';
        sundayDays++;
        if (punchCount >= 1) {
          firstPunchIn = dayPunches[0].time;
        }
        if (punchCount >= 2) {
          lastPunchOut = dayPunches[dayPunches.length - 1].time;
          const inMin = parseTimeToMinutes(firstPunchIn);
          const outMin = parseTimeToMinutes(lastPunchOut);
          grossMinutes = Math.max(0, outMin - inMin);
          grossHours = Math.round((grossMinutes / 60) * 100) / 100;
          netMinutes = Math.max(0, grossMinutes - lunchDeductionMin);
          netHours = Math.round((netMinutes / 60) * 100) / 100;
        }
        if (punchCount > 0) {
          const exc: AttendanceException = {
            id: `exc-sun-worked-${emp.employeeId}-${normDateStr}`,
            employeeId: emp.employeeId,
            employeeName: emp.name,
            date: normDateStr,
            category: 'SUNDAY_WORKED',
            severity: 'low',
            title: 'Sunday Attendance Recorded',
            description: `Employee recorded ${punchCount} biometric punch(es) on Sunday. Work hours tracked for compensatory rest / overtime.`,
            punches: dayPunches,
          };
          dayExceptions.push(exc);
          exceptions.push(exc);
        }
      } else if (isHoliday) {
        status = 'HOLIDAY';
        holidayDays++;
        const holidayName = holidayDateMap.get(normDateStr) || 'Holiday';
        if (punchCount >= 1) {
          firstPunchIn = dayPunches[0].time;
        }
        if (punchCount >= 2) {
          lastPunchOut = dayPunches[dayPunches.length - 1].time;
          const inMin = parseTimeToMinutes(firstPunchIn);
          const outMin = parseTimeToMinutes(lastPunchOut);
          grossMinutes = Math.max(0, outMin - inMin);
          grossHours = Math.round((grossMinutes / 60) * 100) / 100;
          netMinutes = Math.max(0, grossMinutes - lunchDeductionMin);
          netHours = Math.round((netMinutes / 60) * 100) / 100;
        }
        if (punchCount > 0) {
          const exc: AttendanceException = {
            id: `exc-holiday-worked-${emp.employeeId}-${normDateStr}`,
            employeeId: emp.employeeId,
            employeeName: emp.name,
            date: normDateStr,
            category: 'HOLIDAY_WORKED',
            severity: 'low',
            title: 'Holiday Attendance Recorded',
            description: `Employee recorded biometric punches on official holiday (${holidayName}). Preserved as Holiday + Attendance for compensatory credit.`,
            punches: dayPunches,
          };
          dayExceptions.push(exc);
          exceptions.push(exc);
        }
      } else if (hasLeave) {
        // APPROVED LEAVE MUST NEVER BECOME ABSENT (Requirement #2)
        status = 'APPROVED_LEAVE';
        approvedLeaveDays++;
        employeeLeaveOnWorkingDays++;
        if (punchCount >= 1) {
          firstPunchIn = dayPunches[0].time;
        }
        if (punchCount >= 2) {
          lastPunchOut = dayPunches[dayPunches.length - 1].time;
          const inMin = parseTimeToMinutes(firstPunchIn);
          const outMin = parseTimeToMinutes(lastPunchOut);
          grossMinutes = Math.max(0, outMin - inMin);
          grossHours = Math.round((grossMinutes / 60) * 100) / 100;
          netMinutes = Math.max(0, grossMinutes - lunchDeductionMin);
          netHours = Math.round((netMinutes / 60) * 100) / 100;
        }
        if (punchCount > 0) {
          const exc: AttendanceException = {
            id: `exc-leave-conflict-${emp.employeeId}-${normDateStr}`,
            employeeId: emp.employeeId,
            employeeName: emp.name,
            date: normDateStr,
            category: 'LEAVE_CONFLICT',
            severity: 'medium',
            title: 'Leave + Attendance Conflict',
            description: `Employee has an approved leave registered on ${normDateStr}, but recorded ${punchCount} biometric punch(es). Preserved as approved leave with punch activity.`,
            punches: dayPunches,
          };
          dayExceptions.push(exc);
          exceptions.push(exc);
          empExceptionsCount++;
        }
      } else {
        // Normal company working day inside dataset range
        if (punchCount === 0) {
          status = 'ABSENT';
          absentDays++;

          const exc: AttendanceException = {
            id: `exc-abs-${emp.employeeId}-${normDateStr}`,
            employeeId: emp.employeeId,
            employeeName: emp.name,
            date: normDateStr,
            category: 'ABSENT',
            severity: 'medium',
            title: 'Unnotified Absence',
            description: `${emp.name} recorded zero biometric punch activity on working day with no approved leave or registered holiday.`,
          };
          dayExceptions.push(exc);
          exceptions.push(exc);
          empExceptionsCount++;
        } else if (punchCount === 1) {
          firstPunchIn = dayPunches[0].time;
          lastPunchOut = undefined;
          const inMin = parseTimeToMinutes(firstPunchIn);

          // Check if single punch arrival is late (> 10:15 AM)
          if (inMin > lateThresholdMinutes) {
            isLateArrival = true;
            lateMinutes = inMin - officeStartMinutes;
            lateArrivalsCount++;

            const exc: AttendanceException = {
              id: `exc-late-${emp.employeeId}-${normDateStr}`,
              employeeId: emp.employeeId,
              employeeName: emp.name,
              date: normDateStr,
              category: 'LATE_ARRIVAL',
              severity: 'low',
              title: 'Late Arrival',
              description: `Checked in at ${firstPunchIn} (${lateMinutes} mins after ${officeConfig.officeStart} office start). Grace window: ${graceMinutes}m.`,
              punches: [dayPunches[0]],
            };
            dayExceptions.push(exc);
            exceptions.push(exc);
          }

          // If this is the latest date in the dataset, mark OUT_PENDING (today's active shift)
          if (normDateStr === reportDate) {
            status = 'OUT_PENDING';
            outPendingDays++;

            const exc: AttendanceException = {
              id: `exc-out-pending-${emp.employeeId}-${normDateStr}`,
              employeeId: emp.employeeId,
              employeeName: emp.name,
              date: normDateStr,
              category: 'OUT_PENDING',
              severity: 'low',
              title: 'Checkout Pending (Current Day)',
              description: `Employee checked in at ${firstPunchIn}. Shift checkout pending at time of report generation.`,
              punches: dayPunches,
            };
            dayExceptions.push(exc);
            exceptions.push(exc);
          } else {
            status = 'SINGLE_PUNCH';
            singlePunchDays++;

            const exc: AttendanceException = {
              id: `exc-single-${emp.employeeId}-${normDateStr}`,
              employeeId: emp.employeeId,
              employeeName: emp.name,
              date: normDateStr,
              category: 'SINGLE_PUNCH',
              severity: 'medium',
              title: 'Single Punch (Missing IN or OUT)',
              description: `Only 1 punch recorded (${firstPunchIn}) on ${normDateStr}. Working hours cannot be determined without pairing.`,
              punches: dayPunches,
            };
            dayExceptions.push(exc);
            exceptions.push(exc);
            empExceptionsCount++;
          }
          // Do NOT calculate working hours for single punch
        } else {
          // 2 or more valid punches: PRESENT
          status = 'PRESENT';
          presentDays++;

          firstPunchIn = dayPunches[0].time;
          lastPunchOut = dayPunches[dayPunches.length - 1].time;

          const inMin = parseTimeToMinutes(firstPunchIn);
          const outMin = parseTimeToMinutes(lastPunchOut);

          grossMinutes = Math.max(0, outMin - inMin);
          grossHours = Math.round((grossMinutes / 60) * 100) / 100;

          // Deduct lunch duration
          netMinutes = Math.max(0, grossMinutes - lunchDeductionMin);
          netHours = Math.round((netMinutes / 60) * 100) / 100;

          totalGrossMinutes += grossMinutes;
          totalNetMinutes += netMinutes;

          // Late Arrival Check (> 10:15 AM)
          if (inMin > lateThresholdMinutes) {
            isLateArrival = true;
            lateMinutes = inMin - officeStartMinutes;
            lateArrivalsCount++;

            const exc: AttendanceException = {
              id: `exc-late-${emp.employeeId}-${normDateStr}`,
              employeeId: emp.employeeId,
              employeeName: emp.name,
              date: normDateStr,
              category: 'LATE_ARRIVAL',
              severity: 'low',
              title: 'Late Arrival',
              description: `Checked in at ${firstPunchIn} (${lateMinutes} mins after ${officeConfig.officeStart} office start). Grace window: ${graceMinutes}m.`,
              punches: [dayPunches[0]],
            };
            dayExceptions.push(exc);
            exceptions.push(exc);
          }

          // Early Departure Check (< 06:00 PM)
          if (outMin < officeEndMinutes) {
            isEarlyDeparture = true;
            earlyMinutes = officeEndMinutes - outMin;
            earlyDeparturesCount++;

            const exc: AttendanceException = {
              id: `exc-early-dep-${emp.employeeId}-${normDateStr}`,
              employeeId: emp.employeeId,
              employeeName: emp.name,
              date: normDateStr,
              category: 'EARLY_DEPARTURE',
              severity: 'low',
              title: 'Early Departure',
              description: `Checked out at ${lastPunchOut} (${earlyMinutes} mins before ${officeConfig.officeEnd} closing time).`,
              punches: [dayPunches[dayPunches.length - 1]],
            };
            dayExceptions.push(exc);
            exceptions.push(exc);
          }
        }
      }

      dailyRecords.push({
        id: `att-${emp.employeeId}-${normDateStr}`,
        date: normDateStr,
        employeeId: emp.employeeId,
        employeeName: emp.name,
        firstPunchIn,
        lastPunchOut,
        rawPunches: dayPunches,
        punchCount,
        grossMinutes,
        grossHours,
        lunchDeductionMinutes: lunchDeductionMin,
        lunchDeductionHours: lunchDeductionMin / 60,
        netMinutes,
        netHours,
        status,
        isLateArrival,
        isEarlyDeparture,
        lateMinutes,
        earlyMinutes,
        exceptions: dayExceptions,
      });
    }

    // Requirement #8, #9, #10: Deterministic Attendance & Absence Percentages
    // Eligible Working Days = Working Days in actual dataset period (excluding Sundays & Holidays)
    const eligibleWorkingDays = expectedWorkingDays;
    // Expected Attendance Days for Employee = Eligible Working Days - Approved Leave Days (strictly on working days)
    const expectedAttendanceDays = Math.max(0, eligibleWorkingDays - employeeLeaveOnWorkingDays);

    let attendancePercentage = 0;
    let absencePercentage = 0;

    if (expectedAttendanceDays > 0) {
      attendancePercentage = Math.round((presentDays / expectedAttendanceDays) * 1000) / 10;
      absencePercentage = Math.round((absentDays / expectedAttendanceDays) * 1000) / 10;

      // When working days are partitioned into present and absent days: Attendance % + Absence % = 100%
      if (presentDays + absentDays === expectedAttendanceDays) {
        attendancePercentage = Math.round((presentDays / expectedAttendanceDays) * 1000) / 10;
        absencePercentage = Math.round((100 - attendancePercentage) * 10) / 10;
      }
    } else {
      // Zero denominator case (Requirement #10): expectedAttendanceDays === 0 -> 0% (UI will display N/A)
      attendancePercentage = 0;
      absencePercentage = 0;
    }

    const averageNetMinutes =
      presentDays > 0 ? Math.round(totalNetMinutes / presentDays) : 0;
    const averageNetHours =
      presentDays > 0
        ? Math.round((totalNetMinutes / presentDays / 60) * 10) / 10
        : 0;
    const avgNetH = Math.floor(averageNetMinutes / 60);
    const avgNetM = averageNetMinutes % 60;
    const averageNetHoursFormatted = `${avgNetH}h ${avgNetM.toString().padStart(2, '0')}m`;

    employeeSummaries.push({
      employeeId: emp.employeeId,
      employeeName: emp.name,
      eligibleWorkingDays,
      expectedAttendanceDays,
      presentDays,
      approvedLeaveDays,
      absentDays,
      singlePunchDays,
      outPendingDays,
      sundayDays,
      holidayDays,
      totalGrossMinutes,
      totalNetMinutes,
      averageNetHours,
      averageNetHoursFormatted,
      attendancePercentage,
      absencePercentage,
      lateArrivalsCount,
      earlyDeparturesCount,
      lateDays: lateArrivalsCount,
      earlyDepartureDays: earlyDeparturesCount,
      exceptionsCount: empExceptionsCount,
    });
  }

  // Calculate Overall Dashboard KPIs
  const avgAttendancePct =
    employeeSummaries.length > 0
      ? Math.round(
          (employeeSummaries.reduce((acc, e) => acc + e.attendancePercentage, 0) /
            employeeSummaries.length) *
            10
        ) / 10
      : 0;

  const totalPresentDays = employeeSummaries.reduce((acc, e) => acc + e.presentDays, 0);
  const totalNetMinutesAll = employeeSummaries.reduce((acc, e) => acc + e.totalNetMinutes, 0);
  const avgNetHours =
    totalPresentDays > 0
      ? Math.round((totalNetMinutesAll / totalPresentDays / 60) * 10) / 10
      : 0;

  const totalLeave = employeeSummaries.reduce((acc, e) => acc + e.approvedLeaveDays, 0);
  const totalAbsences = employeeSummaries.reduce((acc, e) => acc + e.absentDays, 0);
  const incompletePunches = employeeSummaries.reduce(
    (acc, e) => acc + e.singlePunchDays + e.outPendingDays,
    0
  );
  const lateArrivals = employeeSummaries.reduce((acc, e) => acc + e.lateArrivalsCount, 0);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  let monthLabel = '';
  if (isCombined) {
    if (monthKey === 'OVERALL' || monthKey === 'Overall') {
      monthLabel = 'Overall';
    } else {
      const monthsDetected = Array.from(
        new Set(allMonthDates.map((d) => d.substring(0, 7)).filter(Boolean))
      ).sort();
      if (monthsDetected.length <= 1) {
        const [y, m] = (monthsDetected[0] || '2026-08').split('-');
        monthLabel = `${monthNames[parseInt(m, 10) - 1] || m} ${y}`;
      } else if (monthsDetected.length === 2) {
        const [, m1] = monthsDetected[0].split('-');
        const [y2, m2] = monthsDetected[1].split('-');
        monthLabel = `2-Month Combined Analysis (${monthNames[parseInt(m1, 10) - 1].substring(0, 3)} – ${monthNames[parseInt(m2, 10) - 1].substring(0, 3)} ${y2})`;
      } else if (monthsDetected.length === 3) {
        const [, m1] = monthsDetected[0].split('-');
        const [y3, m3] = monthsDetected[2].split('-');
        monthLabel = `3-Month Attendance Overview (${monthNames[parseInt(m1, 10) - 1].substring(0, 3)} – ${monthNames[parseInt(m3, 10) - 1].substring(0, 3)} ${y3})`;
      } else if (monthsDetected.length === 12) {
        const y = monthsDetected[0].split('-')[0];
        monthLabel = `${y} Yearly Attendance (Full Year)`;
      } else {
        monthLabel = `${monthsDetected.length}-Month Combined Period`;
      }
    }
  } else {
    const [yStr, mStr] = monthKey.split('-');
    const mIdx = parseInt(mStr, 10) - 1;
    monthLabel = `${monthNames[mIdx] || mStr} ${yStr}`;
  }

  const formatDateSpan = (start: string, end: string) => {
    if (!start && !end) return '';
    const formatSingle = (s: string) => {
      const parts = s.split('-');
      if (parts.length !== 3) return s;
      const y = parts[0];
      const mIdx = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      const mName = monthNames[mIdx] ? monthNames[mIdx].substring(0, 3) : parts[1];
      return `${mName} ${d}, ${y}`;
    };
    if (start === end || !end) {
      return formatSingle(start);
    }
    const sParts = start.split('-');
    const eParts = end.split('-');
    if (sParts.length === 3 && eParts.length === 3) {
      const sM = monthNames[parseInt(sParts[1], 10) - 1]?.substring(0, 3) || sParts[1];
      const sD = parseInt(sParts[2], 10);
      const sY = sParts[0];
      const eM = monthNames[parseInt(eParts[1], 10) - 1]?.substring(0, 3) || eParts[1];
      const eD = parseInt(eParts[2], 10);
      const eY = eParts[0];
      if (sY === eY) {
        if (sM === eM) {
          return `${sM} ${sD} – ${eD}, ${sY}`;
        }
        return `${sM} ${sD} – ${eM} ${eD}, ${sY}`;
      }
      return `${sM} ${sD}, ${sY} – ${eM} ${eD}, ${eY}`;
    }
    return `${start} — ${end}`;
  };

  const hasImportedData = allMonthDates.length > 0;
  const noDataMessage = !hasImportedData
    ? `No attendance data available for ${monthLabel}.`
    : undefined;

  return {
    monthKey,
    monthLabel,
    hasImportedData,
    noDataMessage,
    reportDate,
    startDate: monthStartDate,
    endDate: monthEndDate,
    dateRangeFormatted: hasImportedData ? formatDateSpan(monthStartDate, monthEndDate) : '',
    datasetStartDate,
    datasetEndDate,
    datasetDateRangeFormatted: formatDateSpan(datasetStartDate, datasetEndDate),
    calendarDaysCount: allMonthDates.length,
    sundaysCount,
    holidaysCount,
    expectedWorkingDays,
    configuredEmployeeCount,
    knownEmployeesCount,
    employeeCountDiscrepancy,
    discrepancyMessage,
    dailyRecords,
    employeeSummaries,
    exceptions,
    kpis: {
      totalEmployees: configuredEmployeeCount,
      workingDays: expectedWorkingDays,
      avgAttendancePct,
      avgNetHours,
      totalLeave,
      totalAbsences,
      incompletePunches,
      lateArrivals,
    },
  };
}
