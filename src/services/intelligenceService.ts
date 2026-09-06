/**
 * VR CONSTRUCTIONS — ATTENDANCE INTELLIGENCE SERVICE
 *
 * Deterministic business intelligence layer:
 * - Generates factual, neutral employee at-a-glance summaries
 * - Identifies statistical extremes (Highest/Lowest attendance, most absences, most late arrivals)
 * - Computes clean trends (Daily attendance counts, working hours based strictly on complete shifts)
 * - Absence, Leave, Late Arrival, Early Departure, and Working-Hour breakdowns
 * - Month-to-month historical comparison
 * - Zero AI hallucinations: 100% derived from auditable, deterministic data structures
 */

import {
  CalculatedMonthData,
  EmployeeAttendanceSummary,
  AttendanceDay,
  OfficeConfig,
  LeaveRecord,
} from '../types/attendance';
import { formatHoursMinutes } from './attendanceCalculator';

export interface EmployeeAtAGlanceInsight {
  employeeId: string;
  employeeName: string;
  summarySentence: string;
  presentDays: number;
  approvedLeaveDays: number;
  absentDays: number;
  averageNetHoursFormatted: string;
  lateArrivalsCount: number;
  incompleteCount: number;
}

export interface EmployeeExtremes {
  highestAttendance: EmployeeAttendanceSummary[];
  lowestAttendance: EmployeeAttendanceSummary[];
  mostAbsences: EmployeeAttendanceSummary[];
  mostLateArrivals: EmployeeAttendanceSummary[];
}

export interface DailyAttendanceMetric {
  date: string;
  dayNumber: number;
  dayName: string;
  presentCount: number;
  absentCount: number;
  leaveCount: number;
  incompleteCount: number;
  totalPersonnel: number;
  presencePercentage: number;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  isReportDate: boolean;
}

export interface WorkingHourDailyMetric {
  date: string;
  dayNumber: number;
  dayName: string;
  averageNetHours: number;
  completeRecordsCount: number;
  totalNetMinutes: number;
  isSunday: boolean;
  isHoliday: boolean;
}

export interface AbsenceRecordItem {
  employeeId: string;
  employeeName: string;
  absentDaysCount: number;
  absentDates: string[];
}

export interface LeaveRecordItem {
  employeeId: string;
  employeeName: string;
  approvedLeaveDaysCount: number;
  leaveDates: { date: string; leaveType: string }[];
}

export interface LateArrivalRecordItem {
  employeeId: string;
  employeeName: string;
  lateArrivalsCount: number;
  averageLateMinutes: number;
  latestPunchTime?: string;
}

export interface EarlyDepartureRecordItem {
  employeeId: string;
  employeeName: string;
  earlyDeparturesCount: number;
  averageEarlyMinutes: number;
}

export interface WorkingHourRecordItem {
  employeeId: string;
  employeeName: string;
  completeDaysCount: number;
  averageNetHours: number;
  averageNetHoursFormatted: string;
}

export interface MonthComparisonResult {
  currentMonthKey: string;
  currentMonthLabel: string;
  previousMonthKey: string;
  previousMonthLabel: string;
  narrative?: string;
  metrics: {
    label: string;
    currentValue: string | number;
    previousValue: string | number;
    difference: number;
    unit: string;
    isNeutralOrPositive: boolean;
  }[];
}

/**
 * Deterministic factual employee summary
 * Requirement #25: "18 present days, 1 approved leave, 2 absences, average 7h 12m net hours, and 3 late arrivals."
 */
export function getEmployeeAtAGlanceInsight(
  emp: EmployeeAttendanceSummary
): EmployeeAtAGlanceInsight {
  const avgNetMinutes = Math.round(emp.averageNetHours * 60);
  const formattedHours = formatHoursMinutes(avgNetMinutes);
  const incomplete = emp.singlePunchDays + emp.outPendingDays;

  // Build natural, factual sentence
  const parts: string[] = [
    `${emp.presentDays} present ${emp.presentDays === 1 ? 'day' : 'days'}`,
  ];

  if (emp.approvedLeaveDays > 0) {
    parts.push(
      `${emp.approvedLeaveDays} approved leave ${emp.approvedLeaveDays === 1 ? 'day' : 'days'}`
    );
  }

  if (emp.absentDays > 0) {
    parts.push(
      `${emp.absentDays} ${emp.absentDays === 1 ? 'absence' : 'absences'}`
    );
  } else {
    parts.push('0 absences');
  }

  if (emp.averageNetHours > 0) {
    parts.push(`average ${formattedHours} net hours`);
  }

  if (emp.lateArrivalsCount > 0) {
    parts.push(
      `${emp.lateArrivalsCount} late ${emp.lateArrivalsCount === 1 ? 'arrival' : 'arrivals'}`
    );
  }

  if (incomplete > 0) {
    parts.push(`${incomplete} incomplete punch logs`);
  }

  const summarySentence = `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}.`;

  return {
    employeeId: emp.employeeId,
    employeeName: emp.employeeName,
    summarySentence,
    presentDays: emp.presentDays,
    approvedLeaveDays: emp.approvedLeaveDays,
    absentDays: emp.absentDays,
    averageNetHoursFormatted: formattedHours,
    lateArrivalsCount: emp.lateArrivalsCount,
    incompleteCount: incomplete,
  };
}

/**
 * Identify meaningful extremes across employees
 * Requirement #9: Highlight only meaningful extremes (Highest/Lowest attendance, most absences, most late arrivals)
 * Neutral terms only (No "Performance Score")
 */
export function getEmployeeExtremes(
  summaries: EmployeeAttendanceSummary[]
): EmployeeExtremes {
  if (!summaries || summaries.length === 0) {
    return {
      highestAttendance: [],
      lowestAttendance: [],
      mostAbsences: [],
      mostLateArrivals: [],
    };
  }

  // Sort copies
  const byAttendanceDesc = [...summaries].sort(
    (a, b) => b.attendancePercentage - a.attendancePercentage
  );
  const byAttendanceAsc = [...summaries].sort(
    (a, b) => a.attendancePercentage - b.attendancePercentage
  );
  const byAbsencesDesc = [...summaries]
    .filter((s) => s.absentDays > 0)
    .sort((a, b) => b.absentDays - a.absentDays);
  const byLateDesc = [...summaries]
    .filter((s) => s.lateArrivalsCount > 0)
    .sort((a, b) => b.lateArrivalsCount - a.lateArrivalsCount);

  return {
    highestAttendance: byAttendanceDesc.slice(0, 3),
    lowestAttendance: byAttendanceAsc.slice(0, 3),
    mostAbsences: byAbsencesDesc.slice(0, 3),
    mostLateArrivals: byLateDesc.slice(0, 3),
  };
}

/**
 * Daily Attendance Trend (Date -> counts & percentages)
 * Requirement #7: Daily trend for selected month. Sundays/holidays clearly distinguishable.
 */
export function getDailyAttendanceTrend(
  monthData: CalculatedMonthData
): DailyAttendanceMetric[] {
  if (!monthData || !monthData.dailyRecords || monthData.dailyRecords.length === 0) {
    return [];
  }

  const dateMap = new Map<
    string,
    {
      date: string;
      present: number;
      absent: number;
      leave: number;
      incomplete: number;
      total: number;
      isSunday: boolean;
      isHoliday: boolean;
    }
  >();

  monthData.dailyRecords.forEach((rec) => {
    if (!dateMap.has(rec.date)) {
      dateMap.set(rec.date, {
        date: rec.date,
        present: 0,
        absent: 0,
        leave: 0,
        incomplete: 0,
        total: 0,
        isSunday: rec.status === 'SUNDAY',
        isHoliday: rec.status === 'HOLIDAY',
      });
    }

    const entry = dateMap.get(rec.date)!;
    entry.total++;

    if (rec.status === 'PRESENT') {
      entry.present++;
    } else if (rec.status === 'ABSENT') {
      entry.absent++;
    } else if (rec.status === 'APPROVED_LEAVE') {
      entry.leave++;
    } else if (rec.status === 'SINGLE_PUNCH' || rec.status === 'OUT_PENDING') {
      entry.incomplete++;
    }
  });

  const datesSorted = Array.from(dateMap.keys()).sort();

  return datesSorted.map((dateStr) => {
    const item = dateMap.get(dateStr)!;
    const dateObj = new Date(`${dateStr}T00:00:00`);
    const dayNumber = parseInt(dateStr.split('-')[2], 10);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const isReportDate = dateStr === monthData.reportDate;

    const presencePercentage =
      item.total > 0 ? Math.round((item.present / item.total) * 1000) / 10 : 0;

    return {
      date: dateStr,
      dayNumber,
      dayName,
      presentCount: item.present,
      absentCount: item.absent,
      leaveCount: item.leave,
      incompleteCount: item.incomplete,
      totalPersonnel: item.total,
      presencePercentage,
      isSunday: item.isSunday,
      isHoliday: item.isHoliday,
      isReportDate,
    };
  });
}

/**
 * Working Hours Trend by Date (Requirement #8)
 * Shows: Average Net Hours by Date
 * IMPORTANT: Use ONLY valid complete attendance records!
 * Single Punch and Out Pending records MUST NOT be treated as zero-hour working days.
 */
export function getWorkingHoursTrendByDate(
  monthData: CalculatedMonthData
): WorkingHourDailyMetric[] {
  if (!monthData || !monthData.dailyRecords || monthData.dailyRecords.length === 0) {
    return [];
  }

  const dateMap = new Map<
    string,
    {
      date: string;
      totalNetMinutes: number;
      completeCount: number;
      isSunday: boolean;
      isHoliday: boolean;
    }
  >();

  monthData.dailyRecords.forEach((rec) => {
    // Check if valid complete attendance record (paired punches)
    const isComplete = rec.status === 'PRESENT' && rec.punchCount >= 2 && rec.netMinutes > 0;

    if (!dateMap.has(rec.date)) {
      dateMap.set(rec.date, {
        date: rec.date,
        totalNetMinutes: 0,
        completeCount: 0,
        isSunday: rec.status === 'SUNDAY',
        isHoliday: rec.status === 'HOLIDAY',
      });
    }

    if (isComplete) {
      const entry = dateMap.get(rec.date)!;
      entry.totalNetMinutes += rec.netMinutes;
      entry.completeCount++;
    }
  });

  const datesSorted = Array.from(dateMap.keys()).sort();

  return datesSorted.map((dateStr) => {
    const item = dateMap.get(dateStr)!;
    const dateObj = new Date(`${dateStr}T00:00:00`);
    const dayNumber = parseInt(dateStr.split('-')[2], 10);
    const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    // Average net hours strictly across complete records
    const averageNetHours =
      item.completeCount > 0
        ? Math.round((item.totalNetMinutes / item.completeCount / 60) * 10) / 10
        : 0;

    return {
      date: dateStr,
      dayNumber,
      dayName,
      averageNetHours,
      completeRecordsCount: item.completeCount,
      totalNetMinutes: item.totalNetMinutes,
      isSunday: item.isSunday,
      isHoliday: item.isHoliday,
    };
  });
}

/**
 * Absence Analysis (Requirement #20)
 * Show: Employee, Absent Days, Dates, sorted by most absences first.
 */
export function getAbsenceAnalysis(
  monthData: CalculatedMonthData
): AbsenceRecordItem[] {
  if (!monthData || !monthData.employeeSummaries) return [];

  const result: AbsenceRecordItem[] = [];

  monthData.employeeSummaries.forEach((emp) => {
    if (emp.absentDays > 0) {
      const absentDays = monthData.dailyRecords
        .filter((d) => d.employeeId === emp.employeeId && d.status === 'ABSENT')
        .map((d) => d.date)
        .sort();

      result.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        absentDaysCount: emp.absentDays,
        absentDates: absentDays,
      });
    }
  });

  return result.sort((a, b) => b.absentDaysCount - a.absentDaysCount);
}

/**
 * Leave Analysis (Requirement #21)
 * Show: Employee, Approved Leave Days, filterable by date/type. Total company leave.
 */
export function getLeaveAnalysis(
  monthData: CalculatedMonthData,
  allLeaves: LeaveRecord[]
): {
  items: LeaveRecordItem[];
  totalCompanyLeaveDays: number;
} {
  if (!monthData || !monthData.employeeSummaries) {
    return { items: [], totalCompanyLeaveDays: 0 };
  }

  const items: LeaveRecordItem[] = [];
  let totalCompanyLeaveDays = 0;

  monthData.employeeSummaries.forEach((emp) => {
    if (emp.approvedLeaveDays > 0) {
      totalCompanyLeaveDays += emp.approvedLeaveDays;

      const empLeaves = allLeaves
        .filter(
          (l) =>
            l.employeeId === emp.employeeId &&
            l.date.startsWith(monthData.monthKey)
        )
        .map((l) => ({ date: l.date, leaveType: l.leaveType }))
        .sort((a, b) => a.date.localeCompare(b.date));

      items.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        approvedLeaveDaysCount: emp.approvedLeaveDays,
        leaveDates: empLeaves,
      });
    }
  });

  items.sort((a, b) => b.approvedLeaveDaysCount - a.approvedLeaveDaysCount);

  return { items, totalCompanyLeaveDays };
}

/**
 * Late Arrival Analysis (Requirement #22)
 * Based on configured office start (10:00 AM) + grace (15m) -> 10:15 threshold.
 */
export function getLateArrivalAnalysis(
  monthData: CalculatedMonthData
): LateArrivalRecordItem[] {
  if (!monthData || !monthData.employeeSummaries) return [];

  const items: LateArrivalRecordItem[] = [];

  monthData.employeeSummaries.forEach((emp) => {
    if (emp.lateArrivalsCount > 0) {
      const lateDays = monthData.dailyRecords.filter(
        (d) => d.employeeId === emp.employeeId && d.isLateArrival
      );

      const totalLateMins = lateDays.reduce((acc, d) => acc + d.lateMinutes, 0);
      const avgLateMins =
        lateDays.length > 0 ? Math.round(totalLateMins / lateDays.length) : 0;

      const latestPunch = lateDays
        .map((d) => d.firstPunchIn || '')
        .filter(Boolean)
        .sort()
        .pop();

      items.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        lateArrivalsCount: emp.lateArrivalsCount,
        averageLateMinutes: avgLateMins,
        latestPunchTime: latestPunch,
      });
    }
  });

  return items.sort((a, b) => b.lateArrivalsCount - a.lateArrivalsCount);
}

/**
 * Early Departure Analysis (Requirement #23)
 * Based on configured office end (18:00). Only if OUT punch exists!
 */
export function getEarlyDepartureAnalysis(
  monthData: CalculatedMonthData
): EarlyDepartureRecordItem[] {
  if (!monthData || !monthData.employeeSummaries) return [];

  const items: EarlyDepartureRecordItem[] = [];

  monthData.employeeSummaries.forEach((emp) => {
    if (emp.earlyDeparturesCount > 0) {
      const earlyDays = monthData.dailyRecords.filter(
        (d) => d.employeeId === emp.employeeId && d.isEarlyDeparture && d.lastPunchOut
      );

      const totalEarlyMins = earlyDays.reduce((acc, d) => acc + d.earlyMinutes, 0);
      const avgEarlyMins =
        earlyDays.length > 0 ? Math.round(totalEarlyMins / earlyDays.length) : 0;

      items.push({
        employeeId: emp.employeeId,
        employeeName: emp.employeeName,
        earlyDeparturesCount: emp.earlyDeparturesCount,
        averageEarlyMinutes: avgEarlyMins,
      });
    }
  });

  return items.sort((a, b) => b.earlyDeparturesCount - a.earlyDeparturesCount);
}

/**
 * Working-Hour Analysis (Requirement #24)
 * Only complete attendance days contribute. Missing data != zero working hours.
 */
export function getWorkingHourAnalysis(
  monthData: CalculatedMonthData
): WorkingHourRecordItem[] {
  if (!monthData || !monthData.employeeSummaries) return [];

  const items: WorkingHourRecordItem[] = monthData.employeeSummaries.map((emp) => {
    const completeDays = monthData.dailyRecords.filter(
      (d) => d.employeeId === emp.employeeId && d.status === 'PRESENT' && d.punchCount >= 2
    );

    const avgNetMinutes = Math.round(emp.averageNetHours * 60);

    return {
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      completeDaysCount: completeDays.length,
      averageNetHours: emp.averageNetHours,
      averageNetHoursFormatted: formatHoursMinutes(avgNetMinutes),
    };
  });

  return items.sort((a, b) => b.averageNetHours - a.averageNetHours);
}

/**
 * Month-to-Month Comparison (Requirement #26)
 * Only returns comparison if BOTH months have valid data. Never fabricates.
 */
export function getMonthToMonthComparison(
  current: CalculatedMonthData | null,
  previous: CalculatedMonthData | null
): MonthComparisonResult | null {
  if (!current || !previous) return null;
  if (!current.kpis || !previous.kpis) return null;

  const currentAtt = current.kpis.avgAttendancePct;
  const prevAtt = previous.kpis.avgAttendancePct;
  const diffAtt = Math.round((currentAtt - prevAtt) * 10) / 10;

  const currentHours = current.kpis.avgNetHours;
  const prevHours = previous.kpis.avgNetHours;
  const diffHours = Math.round((currentHours - prevHours) * 10) / 10;

  const currentAbs = current.kpis.totalAbsences;
  const prevAbs = previous.kpis.totalAbsences;
  const diffAbs = currentAbs - prevAbs;

  const currentLeave = current.kpis.totalLeave;
  const prevLeave = previous.kpis.totalLeave;
  const diffLeave = currentLeave - prevLeave;

  const currentLate = current.kpis.lateArrivals;
  const prevLate = previous.kpis.lateArrivals;
  const diffLate = currentLate - prevLate;

  const currentInc = current.kpis.incompletePunches;
  const prevInc = previous.kpis.incompletePunches;
  const diffInc = currentInc - prevInc;

  const narrative = `Compared to ${previous.monthLabel}, attendance compliance shifted by ${
    diffAtt >= 0 ? '+' : ''
  }${diffAtt}% with an average net working duration of ${currentHours}h per employee (${
    diffHours >= 0 ? '+' : ''
  }${diffHours}h delta). Unresolved punch exceptions shifted by ${diffInc >= 0 ? '+' : ''}${diffInc}.`;

  return {
    currentMonthKey: current.monthKey,
    currentMonthLabel: current.monthLabel,
    previousMonthKey: previous.monthKey,
    previousMonthLabel: previous.monthLabel,
    narrative,
    metrics: [
      {
        label: 'Attendance Rate',
        currentValue: `${currentAtt}%`,
        previousValue: `${prevAtt}%`,
        difference: diffAtt,
        unit: '%',
        isNeutralOrPositive: diffAtt >= 0,
      },
      {
        label: 'Average Net Hours',
        currentValue: `${currentHours}h`,
        previousValue: `${prevHours}h`,
        difference: diffHours,
        unit: 'h',
        isNeutralOrPositive: diffHours >= 0,
      },
      {
        label: 'Total Absences',
        currentValue: currentAbs,
        previousValue: prevAbs,
        difference: diffAbs,
        unit: 'days',
        isNeutralOrPositive: diffAbs <= 0,
      },
      {
        label: 'Approved Leave',
        currentValue: currentLeave,
        previousValue: prevLeave,
        difference: diffLeave,
        unit: 'days',
        isNeutralOrPositive: true,
      },
      {
        label: 'Late Arrivals',
        currentValue: currentLate,
        previousValue: prevLate,
        difference: diffLate,
        unit: 'marks',
        isNeutralOrPositive: diffLate <= 0,
      },
      {
        label: 'Incomplete Punches',
        currentValue: currentInc,
        previousValue: prevInc,
        difference: diffInc,
        unit: 'punches',
        isNeutralOrPositive: diffInc <= 0,
      },
    ],
  };
}

export interface WorkingHourDistributionItem {
  category: 'OVERTIME' | 'STANDARD' | 'HALF_DAY' | 'UNDER_HOURS';
  label: string;
  count: number;
  percentage: number;
}

/**
 * Working-Hour Distribution breakdown across completed shifts
 */
export function getWorkingHourDistribution(
  monthData: CalculatedMonthData
): WorkingHourDistributionItem[] {
  if (!monthData || !monthData.dailyRecords) return [];

  const completeShifts = monthData.dailyRecords.filter(
    (r) => r.status === 'PRESENT' && r.punchCount >= 2 && r.netMinutes > 0
  );
  const total = completeShifts.length;

  let overtime = 0;
  let standard = 0;
  let halfDay = 0;
  let underHours = 0;

  completeShifts.forEach((r) => {
    const hrs = r.netMinutes / 60;
    if (hrs >= 8.5) overtime++;
    else if (hrs >= 8.0) standard++;
    else if (hrs >= 4.5) halfDay++;
    else underHours++;
  });

  const calcPct = (cnt: number) => (total > 0 ? Math.round((cnt / total) * 1000) / 10 : 0);

  return [
    { category: 'OVERTIME', label: 'Extended Shift (> 8.5 Hours)', count: overtime, percentage: calcPct(overtime) },
    { category: 'STANDARD', label: 'Standard Shift (8.0 — 8.5 Hours)', count: standard, percentage: calcPct(standard) },
    { category: 'HALF_DAY', label: 'Half Day (4.5 — 7.9 Hours)', count: halfDay, percentage: calcPct(halfDay) },
    { category: 'UNDER_HOURS', label: 'Under Shift (< 4.5 Hours)', count: underHours, percentage: calcPct(underHours) },
  ];
}

export interface AbsenceAndLeaveAnalysisResult {
  totalAbsences: number;
  totalLeaves: number;
  topAbsentEmployees: { employeeId: string; employeeName: string; absentDays: number; attendancePercentage: number }[];
}

/**
 * Absence and Leave combined analytics
 */
export function getAbsenceAndLeaveAnalysis(
  monthData: CalculatedMonthData
): AbsenceAndLeaveAnalysisResult {
  if (!monthData) {
    return { totalAbsences: 0, totalLeaves: 0, topAbsentEmployees: [] };
  }

  const topAbsentEmployees = monthData.employeeSummaries
    .filter((e) => e.absentDays > 0)
    .sort((a, b) => b.absentDays - a.absentDays)
    .map((e) => ({
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      absentDays: e.absentDays,
      attendancePercentage: e.attendancePercentage,
    }));

  return {
    totalAbsences: monthData.kpis.totalAbsences,
    totalLeaves: monthData.kpis.totalLeave,
    topAbsentEmployees,
  };
}

export interface PunctualityAnalysisResult {
  onTimePercentage: number;
  totalLateArrivals: number;
  topLateEmployees: { employeeId: string; employeeName: string; lateCount: number }[];
}

/**
 * Punctuality and Late Arrival Analytics
 */
export function getPunctualityAnalysis(
  monthData: CalculatedMonthData
): PunctualityAnalysisResult {
  if (!monthData) {
    return { onTimePercentage: 100, totalLateArrivals: 0, topLateEmployees: [] };
  }

  const presentShifts = monthData.dailyRecords.filter((r) => r.status === 'PRESENT' && r.firstPunchIn);
  const totalPresents = presentShifts.length;
  const latePresents = presentShifts.filter((r) => r.isLateArrival).length;
  const onTimePercentage = totalPresents > 0 ? Math.round(((totalPresents - latePresents) / totalPresents) * 1000) / 10 : 100;

  const topLateEmployees = monthData.employeeSummaries
    .filter((e) => e.lateArrivalsCount > 0)
    .sort((a, b) => b.lateArrivalsCount - a.lateArrivalsCount)
    .map((e) => ({
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      lateCount: e.lateArrivalsCount,
    }));

  return {
    onTimePercentage,
    totalLateArrivals: monthData.kpis.lateArrivals,
    topLateEmployees,
  };
}

