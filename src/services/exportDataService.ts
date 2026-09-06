/**
 * VR CONSTRUCTIONS — EXPORT DATA SERVICE
 *
 * Prepares clean, structured, typed data objects for future PDF/Excel exporting.
 * Accesses underlying calculations directly without scraping HTML.
 */

import {
  CalculatedMonthData,
  EmployeeAttendanceSummary,
  AttendanceDay,
  LeaveRecord,
  Holiday,
  AttendanceException,
} from '../types/attendance';

export interface MonthlySummaryExportData {
  companyName: string;
  monthKey: string;
  monthLabel: string;
  reportDate: string;
  totalPersonnel: number;
  expectedWorkingDays: number;
  averageAttendanceRate: number;
  averageNetShiftHours: number;
  totalApprovedLeaveDays: number;
  totalAbsences: number;
  totalIncompletePunches: number;
  totalLateArrivals: number;
  generatedAt: string;
}

export interface EmployeeRosterExportRow {
  employeeId: string;
  employeeName: string;
  presentDays: number;
  approvedLeaveDays: number;
  absentDays: number;
  singlePunchDays: number;
  outPendingDays: number;
  expectedDays: number;
  attendancePercentage: number;
  averageNetHours: number;
  lateArrivalsCount: number;
  earlyDeparturesCount: number;
}

export interface DailyAttendanceExportRow {
  date: string;
  employeeId: string;
  employeeName: string;
  status: string;
  inTime: string;
  outTime: string;
  grossMinutes: number;
  lunchMinutes: number;
  netMinutes: number;
  netHoursFormatted: string;
  isLate: boolean;
  lateMinutes: number;
}

export interface ExceptionsExportRow {
  date: string;
  employeeId: string;
  employeeName: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolutionNote?: string;
}

/**
 * Prepares monthly KPI and executive summary for export
 */
export function prepareMonthlySummaryExport(
  monthData: CalculatedMonthData
): MonthlySummaryExportData {
  return {
    companyName: 'VR Constructions',
    monthKey: monthData.monthKey,
    monthLabel: monthData.monthLabel,
    reportDate: monthData.reportDate,
    totalPersonnel: monthData.kpis.totalEmployees,
    expectedWorkingDays: monthData.expectedWorkingDays,
    averageAttendanceRate: monthData.kpis.avgAttendancePct,
    averageNetShiftHours: monthData.kpis.avgNetHours,
    totalApprovedLeaveDays: monthData.kpis.totalLeave,
    totalAbsences: monthData.kpis.totalAbsences,
    totalIncompletePunches: monthData.kpis.incompletePunches,
    totalLateArrivals: monthData.kpis.lateArrivals,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Prepares employee roster table for export
 */
export function prepareEmployeeRosterExport(
  monthData: CalculatedMonthData
): EmployeeRosterExportRow[] {
  return monthData.employeeSummaries.map((e) => ({
    employeeId: e.employeeId,
    employeeName: e.employeeName,
    presentDays: e.presentDays,
    approvedLeaveDays: e.approvedLeaveDays,
    absentDays: e.absentDays,
    singlePunchDays: e.singlePunchDays,
    outPendingDays: e.outPendingDays,
    expectedDays: e.expectedAttendanceDays,
    attendancePercentage: e.attendancePercentage,
    averageNetHours: e.averageNetHours,
    lateArrivalsCount: e.lateArrivalsCount,
    earlyDeparturesCount: e.earlyDeparturesCount,
  }));
}

/**
 * Prepares daily attendance records for export
 */
export function prepareDailyAttendanceExport(
  monthData: CalculatedMonthData,
  filterDate?: string
): DailyAttendanceExportRow[] {
  const records = filterDate
    ? monthData.dailyRecords.filter((d) => d.date === filterDate)
    : monthData.dailyRecords;

  return records.map((r) => {
    const h = Math.floor(r.netMinutes / 60);
    const m = r.netMinutes % 60;
    const netHoursFormatted = r.netMinutes > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : '0h 00m';

    return {
      date: r.date,
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      status: r.status,
      inTime: r.firstPunchIn || '—',
      outTime: r.lastPunchOut || '—',
      grossMinutes: r.grossMinutes,
      lunchMinutes: r.lunchDeductionMinutes,
      netMinutes: r.netMinutes,
      netHoursFormatted,
      isLate: r.isLateArrival,
      lateMinutes: r.lateMinutes,
    };
  });
}

/**
 * Prepares all exceptions for export
 */
export function prepareExceptionsExport(
  monthData: CalculatedMonthData
): ExceptionsExportRow[] {
  return monthData.exceptions.map((exc) => ({
    date: exc.date,
    employeeId: exc.employeeId,
    employeeName: exc.employeeName,
    category: exc.category,
    severity: exc.severity,
    title: exc.title,
    description: exc.description,
    isResolved: !!exc.isResolved,
    resolvedAt: (exc as any).resolvedAt,
    resolutionNote: (exc as any).resolutionNote,
  }));
}

/**
 * Universal browser CSV file downloader
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Universal browser JSON file downloader
 */
export function downloadJsonFile(filename: string, data: any): void {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports monthly employee roster as structured CSV
 */
export function downloadEmployeeRosterCsv(monthData: CalculatedMonthData): void {
  const rows = prepareEmployeeRosterExport(monthData);
  const headers = [
    'Employee ID',
    'Employee Name',
    'Present Days',
    'Approved Leave Days',
    'Absent Days',
    'Single Punch Days',
    'Out Pending Days',
    'Expected Working Days',
    'Attendance %',
    'Average Net Hours',
    'Late Arrivals Count',
    'Early Departures Count',
  ];

  const csvRows = [headers.join(',')];
  rows.forEach((r) => {
    csvRows.push(
      [
        `"${r.employeeId}"`,
        `"${r.employeeName.replace(/"/g, '""')}"`,
        r.presentDays,
        r.approvedLeaveDays,
        r.absentDays,
        r.singlePunchDays,
        r.outPendingDays,
        r.expectedDays,
        r.attendancePercentage,
        r.averageNetHours,
        r.lateArrivalsCount,
        r.earlyDeparturesCount,
      ].join(',')
    );
  });

  downloadCsvFile(`VR_Constructions_Roster_${monthData.monthKey}.csv`, csvRows.join('\n'));
}

/**
 * Exports daily attendance records as structured CSV
 */
export function downloadDailyAttendanceCsv(monthData: CalculatedMonthData, filterDate?: string): void {
  const rows = prepareDailyAttendanceExport(monthData, filterDate);
  const headers = [
    'Date',
    'Employee ID',
    'Employee Name',
    'Status',
    'First IN',
    'Last OUT',
    'Gross Minutes',
    'Lunch Deducted Mins',
    'Net Minutes',
    'Net Hours Formatted',
    'Is Late Arrival',
    'Late Minutes',
  ];

  const csvRows = [headers.join(',')];
  rows.forEach((r) => {
    csvRows.push(
      [
        `"${r.date}"`,
        `"${r.employeeId}"`,
        `"${r.employeeName.replace(/"/g, '""')}"`,
        `"${r.status}"`,
        `"${r.inTime}"`,
        `"${r.outTime}"`,
        r.grossMinutes,
        r.lunchMinutes,
        r.netMinutes,
        `"${r.netHoursFormatted}"`,
        r.isLate ? 'YES' : 'NO',
        r.lateMinutes,
      ].join(',')
    );
  });

  const suffix = filterDate ? `_${filterDate}` : `_${monthData.monthKey}`;
  downloadCsvFile(`VR_Constructions_Daily_Attendance${suffix}.csv`, csvRows.join('\n'));
}

/**
 * Exports exception records as structured CSV
 */
export function downloadExceptionsCsv(monthData: CalculatedMonthData): void {
  const rows = prepareExceptionsExport(monthData);
  const headers = [
    'Date',
    'Employee ID',
    'Employee Name',
    'Category',
    'Severity',
    'Title',
    'Description',
    'Is Resolved',
    'Resolved At',
    'Resolution Note',
  ];

  const csvRows = [headers.join(',')];
  rows.forEach((r) => {
    csvRows.push(
      [
        `"${r.date}"`,
        `"${r.employeeId}"`,
        `"${r.employeeName.replace(/"/g, '""')}"`,
        `"${r.category}"`,
        `"${r.severity}"`,
        `"${(r.title || '').replace(/"/g, '""')}"`,
        `"${(r.description || '').replace(/"/g, '""')}"`,
        r.isResolved ? 'YES' : 'NO',
        `"${r.resolvedAt || ''}"`,
        `"${(r.resolutionNote || '').replace(/"/g, '""')}"`,
      ].join(',')
    );
  });

  downloadCsvFile(`VR_Constructions_Exceptions_${monthData.monthKey}.csv`, csvRows.join('\n'));
}

