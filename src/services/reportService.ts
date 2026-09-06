/**
 * VR CONSTRUCTIONS — REPORT GENERATION SERVICE
 *
 * Professional PDF and Excel export engine built specifically for enterprise attendance intelligence.
 * Principles:
 * 1. Strictly grounded in verified calculated attendance data and raw biometric punches.
 * 2. Clean corporate typography, VR Constructions branding, and print-friendly pagination.
 * 3. Structured multi-sheet Excel workbooks with full traceability back to raw punch lines.
 * 4. Predictable, sanitized file naming and recent report audit history.
 */

import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import {
  CalculatedMonthData,
  EmployeeAttendanceSummary,
  AttendanceDay,
  RawBiometricPunch,
  AttendanceException,
} from '../types/attendance';

export interface RecentReportItem {
  id: string;
  name: string;
  period: string;
  format: 'PDF' | 'EXCEL';
  generatedAt: string;
  recordCount: number;
  fileName: string;
}

const RECENT_REPORTS_KEY = 'vr_constructions_recent_reports_v1';

/**
 * Retrieves the list of recently generated reports from local storage.
 */
export function getRecentReports(): RecentReportItem[] {
  try {
    const raw = localStorage.getItem(RECENT_REPORTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Records a newly generated report in the local audit history.
 */
export function saveRecentReport(report: Omit<RecentReportItem, 'id' | 'generatedAt'>): RecentReportItem {
  const newItem: RecentReportItem = {
    ...report,
    id: `rep-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
    generatedAt: new Date().toISOString(),
  };

  try {
    const existing = getRecentReports();
    const updated = [newItem, ...existing.slice(0, 19)]; // Keep latest 20
    localStorage.setItem(RECENT_REPORTS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to store recent report history', err);
  }

  return newItem;
}

/**
 * Cleans and sanitizes strings for safe filenames
 */
export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_');
}

/* ========================================================================== */
/* PDF GENERATION HELPERS                                                     */
/* ========================================================================== */

interface ColumnDef {
  text: string;
  x: number;
  width: number;
  align?: 'left' | 'right';
}

function drawPdfHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  period: string,
  pageWidth: number
): number {
  // Brand Header Accent Bar
  doc.setFillColor(38, 38, 38); // Neutral-800
  doc.rect(14, 12, pageWidth - 28, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('VR CONSTRUCTIONS', 20, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(212, 212, 216); // Neutral-300
  doc.text('WORKFORCE BIOMETRIC ATTENDANCE SYSTEM', 20, 26);

  // Right-aligned report label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), pageWidth - 20, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(212, 212, 216);
  doc.text(`Period: ${period}`, pageWidth - 20, 26, { align: 'right' });

  // Subtitle / generated timestamp bar
  doc.setTextColor(115, 115, 115);
  doc.setFontSize(8);
  doc.text(subtitle, 14, 40);
  doc.text(`Generated: ${new Date().toLocaleString('en-US')}`, pageWidth - 14, 40, { align: 'right' });

  // Separator rule
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.4);
  doc.line(14, 43, pageWidth - 14, 43);

  return 48; // Current Y offset
}

function drawPdfFooters(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(140, 140, 140);
    doc.text('VR Constructions — Confidential Biometric Attendance Audit Document', 14, pageHeight - 7);
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 7, { align: 'right' });
  }
}

/* ========================================================================== */
/* 1. MONTHLY ATTENDANCE REPORT PDF                                           */
/* ========================================================================== */

export function generateMonthlyAttendancePdf(monthData: CalculatedMonthData): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = drawPdfHeader(
    doc,
    'Monthly Attendance Report',
    `Verified Biometric Roster Audit (${monthData.employeeSummaries.length} Personnel)`,
    monthData.monthLabel,
    pageWidth
  );

  // Executive Summary Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 26, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('EXECUTIVE MONTHLY SUMMARY', 18, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const col1 = 18;
  const col2 = 68;
  const col3 = 118;
  const col4 = 160;

  doc.text(`Total Personnel: ${monthData.kpis.totalEmployees}`, col1, y + 13);
  doc.text(`Working Days: ${monthData.expectedWorkingDays}`, col1, y + 19);

  doc.text(`Avg Attendance Rate: ${monthData.kpis.avgAttendancePct}%`, col2, y + 13);
  doc.text(`Avg Net Shift: ${monthData.kpis.avgNetHours}h`, col2, y + 19);

  doc.text(`Approved Leaves: ${monthData.kpis.totalLeave} d`, col3, y + 13);
  doc.text(`Unnotified Absences: ${monthData.kpis.totalAbsences} d`, col3, y + 19);

  doc.text(`Late Arrivals: ${monthData.kpis.lateArrivals}`, col4, y + 13);
  doc.text(`Incomplete Punches: ${monthData.kpis.incompletePunches}`, col4, y + 19);

  y += 33;

  // Table Column Definitions
  const headers: ColumnDef[] = [
    { text: 'Employee Name', x: 16, width: 44, align: 'left' },
    { text: 'EnNo', x: 62, width: 18, align: 'left' },
    { text: 'Exp', x: 82, width: 12, align: 'right' },
    { text: 'Pres', x: 97, width: 12, align: 'right' },
    { text: 'Leave', x: 112, width: 12, align: 'right' },
    { text: 'Abs', x: 127, width: 12, align: 'right' },
    { text: 'Single', x: 142, width: 14, align: 'right' },
    { text: 'Att %', x: 162, width: 16, align: 'right' },
    { text: 'Avg Net', x: 184, width: 14, align: 'right' },
  ];

  const drawTableHeader = (currY: number): number => {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currY, pageWidth - 28, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    headers.forEach((h: ColumnDef) => {
      if (h.align === 'right') {
        doc.text(h.text, h.x + h.width, currY + 4.8, { align: 'right' });
      } else {
        doc.text(h.text, h.x, currY + 4.8);
      }
    });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, currY + 7, pageWidth - 14, currY + 7);
    return currY + 7;
  };

  y = drawTableHeader(y);

  // Table Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  monthData.employeeSummaries.forEach((emp, index) => {
    if (y + 6.5 > pageHeight - 16) {
      doc.addPage();
      y = 16;
      y = drawTableHeader(y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y, pageWidth - 28, 6.2, 'F');
    }

    doc.setTextColor(15, 23, 42);
    const cleanName = emp.employeeName.length > 22 ? emp.employeeName.substring(0, 20) + '..' : emp.employeeName;
    doc.text(cleanName, 16, y + 4.2);

    doc.setTextColor(100, 116, 139);
    doc.text(emp.employeeId, 62, y + 4.2);

    doc.setTextColor(30, 41, 59);
    doc.text(String(emp.expectedAttendanceDays), 82 + 12, y + 4.2, { align: 'right' });
    doc.text(String(emp.presentDays), 97 + 12, y + 4.2, { align: 'right' });
    doc.text(String(emp.approvedLeaveDays), 112 + 12, y + 4.2, { align: 'right' });

    if (emp.absentDays > 0) {
      doc.setTextColor(225, 29, 72);
      doc.setFont('helvetica', 'bold');
      doc.text(String(emp.absentDays), 127 + 12, y + 4.2, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 41, 59);
    } else {
      doc.text('0', 127 + 12, y + 4.2, { align: 'right' });
    }

    const singleCount = emp.singlePunchDays + emp.outPendingDays;
    doc.text(String(singleCount), 142 + 14, y + 4.2, { align: 'right' });

    const attStr = `${emp.attendancePercentage}%`;
    if (emp.attendancePercentage < 75) {
      doc.setTextColor(225, 29, 72);
      doc.setFont('helvetica', 'bold');
    } else if (emp.attendancePercentage >= 90) {
      doc.setTextColor(16, 185, 129);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setTextColor(30, 41, 59);
    }
    doc.text(attStr, 162 + 16, y + 4.2, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    doc.text(`${emp.averageNetHours}h`, 184 + 14, y + 4.2, { align: 'right' });

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(14, y + 6.2, pageWidth - 14, y + 6.2);

    y += 6.2;
  });

  drawPdfFooters(doc);

  const fileName = `VR-Constructions-Attendance-${sanitizeFileName(monthData.monthLabel)}.pdf`;
  doc.save(fileName);

  saveRecentReport({
    name: `Monthly Attendance Report`,
    period: monthData.monthLabel,
    format: 'PDF',
    recordCount: monthData.employeeSummaries.length,
    fileName,
  });

  return fileName;
}

/* ========================================================================== */
/* 2. EMPLOYEE ATTENDANCE REPORT PDF                                          */
/* ========================================================================== */

export function generateEmployeeAttendancePdf(
  employee: EmployeeAttendanceSummary,
  records: AttendanceDay[],
  monthData: CalculatedMonthData
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = drawPdfHeader(
    doc,
    'Employee Attendance Report',
    `Individual Attendance Dossier & Punch Audit`,
    monthData.monthLabel,
    pageWidth
  );

  // Employee Identity & Metrics Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(employee.employeeName, 20, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`EnNo: ${employee.employeeId}  |  Company: VR Constructions  |  Period: ${monthData.monthLabel}`, 20, y + 13);

  // Metric Chips
  const c1 = 20;
  const c2 = 65;
  const c3 = 110;
  const c4 = 155;

  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  doc.text(`Attendance Rate:`, c1, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${employee.attendancePercentage}%`, c1, y + 25);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Present Days:`, c2, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129);
  doc.text(`${employee.presentDays} / ${employee.expectedAttendanceDays}`, c2, y + 25);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Leaves / Absences:`, c3, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(employee.absentDays > 0 ? 225 : 71, employee.absentDays > 0 ? 29 : 85, employee.absentDays > 0 ? 72 : 105);
  doc.text(`${employee.approvedLeaveDays} Lv / ${employee.absentDays} Abs`, c3, y + 25);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Avg Net Shift:`, c4, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`${employee.averageNetHours}h (${employee.lateArrivalsCount} late)`, c4, y + 25);

  y += 38;

  // Daily Shifts Table Headers
  const headers: ColumnDef[] = [
    { text: 'Date', x: 16, width: 22, align: 'left' },
    { text: 'Day', x: 40, width: 14, align: 'left' },
    { text: 'Status', x: 56, width: 26, align: 'left' },
    { text: 'First Punch', x: 84, width: 22, align: 'left' },
    { text: 'Last Punch', x: 108, width: 22, align: 'left' },
    { text: 'Gross', x: 132, width: 16, align: 'right' },
    { text: 'Net Hours', x: 150, width: 18, align: 'right' },
    { text: 'Notes / Exceptions', x: 172, width: 24, align: 'left' },
  ];

  const drawTableHeader = (currY: number): number => {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currY, pageWidth - 28, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    headers.forEach((h: ColumnDef) => {
      if (h.align === 'right') {
        doc.text(h.text, h.x + h.width, currY + 4.8, { align: 'right' });
      } else {
        doc.text(h.text, h.x, currY + 4.8);
      }
    });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, currY + 7, pageWidth - 14, currY + 7);
    return currY + 7;
  };

  y = drawTableHeader(y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  const sortedDays = [...records].sort((a, b) => a.date.localeCompare(b.date));

  sortedDays.forEach((d, idx) => {
    if (y + 6 > pageHeight - 16) {
      doc.addPage();
      y = 16;
      y = drawTableHeader(y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y, pageWidth - 28, 5.8, 'F');
    }

    const dateObj = new Date(d.date + 'T12:00:00Z');
    const dayName = isNaN(dateObj.getTime())
      ? ''
      : dateObj.toLocaleDateString('en-US', { weekday: 'short' });

    doc.setTextColor(30, 41, 59);
    doc.text(d.date, 16, y + 4);
    doc.setTextColor(100, 116, 139);
    doc.text(dayName, 40, y + 4);

    if (d.status === 'PRESENT') {
      doc.setTextColor(16, 185, 129);
      doc.text('PRESENT', 56, y + 4);
    } else if (d.status === 'APPROVED_LEAVE') {
      doc.setTextColor(14, 165, 233);
      doc.text('LEAVE', 56, y + 4);
    } else if (d.status === 'ABSENT') {
      doc.setTextColor(225, 29, 72);
      doc.text('ABSENT', 56, y + 4);
    } else if (d.status === 'SINGLE_PUNCH' || d.status === 'OUT_PENDING') {
      doc.setTextColor(168, 85, 247);
      doc.text(d.status === 'SINGLE_PUNCH' ? 'SINGLE PUNCH' : 'OUT PENDING', 56, y + 4);
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text(d.status, 56, y + 4);
    }

    doc.setTextColor(71, 85, 105);
    doc.text(d.firstPunchIn || '—', 84, y + 4);
    doc.text(d.lastPunchOut || '—', 108, y + 4);

    const grossH = d.grossMinutes > 0 ? (d.grossMinutes / 60).toFixed(1) + 'h' : '—';
    const netH = d.netMinutes > 0 ? (d.netMinutes / 60).toFixed(1) + 'h' : '—';

    doc.text(grossH, 132 + 16, y + 4, { align: 'right' });
    doc.text(netH, 150 + 18, y + 4, { align: 'right' });

    let note = '';
    if (d.isLateArrival) note += `Late (+${d.lateMinutes}m) `;
    if (d.isEarlyDeparture) note += 'Early departure ';
    if (d.notes) note += `${d.notes} `;

    doc.setTextColor(148, 163, 184);
    doc.text(note.trim() || '—', 172, y + 4);

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(14, y + 5.8, pageWidth - 14, y + 5.8);

    y += 5.8;
  });

  drawPdfFooters(doc);

  const cleanName = sanitizeFileName(employee.employeeName);
  const fileName = `VR-Constructions-Employee-${cleanName}-${sanitizeFileName(monthData.monthLabel)}.pdf`;
  doc.save(fileName);

  saveRecentReport({
    name: `Employee Report — ${employee.employeeName}`,
    period: monthData.monthLabel,
    format: 'PDF',
    recordCount: sortedDays.length,
    fileName,
  });

  return fileName;
}

/* ========================================================================== */
/* 3. DAILY ATTENDANCE REPORT PDF                                             */
/* ========================================================================== */

export function generateDailyAttendancePdf(
  date: string,
  records: AttendanceDay[],
  monthData: CalculatedMonthData
): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const dayDate = new Date(date + 'T12:00:00Z');
  const dayFormatted = isNaN(dayDate.getTime())
    ? date
    : dayDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  let y = drawPdfHeader(
    doc,
    'Daily Attendance Verification',
    `Daily Punch Audit for ${dayFormatted}`,
    date,
    pageWidth
  );

  const total = records.length;
  const present = records.filter((r) => r.status === 'PRESENT').length;
  const leave = records.filter((r) => r.status === 'APPROVED_LEAVE').length;
  const absent = records.filter((r) => r.status === 'ABSENT').length;
  const single = records.filter((r) => r.status === 'SINGLE_PUNCH' || r.status === 'OUT_PENDING').length;
  const late = records.filter((r) => r.isLateArrival).length;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, pageWidth - 28, 20, 2, 2, 'FD');

  const colWidth = (pageWidth - 36) / 5;
  const stats = [
    { label: 'Total Personnel', val: String(total), color: [15, 23, 42] },
    { label: 'Present', val: String(present), color: [16, 185, 129] },
    { label: 'Approved Leave', val: String(leave), color: [14, 165, 233] },
    { label: 'Unnotified Absent', val: String(absent), color: [225, 29, 72] },
    { label: 'Incomplete / Late', val: `${single} inc / ${late} late`, color: [168, 85, 247] },
  ];

  stats.forEach((s, idx) => {
    const xPos = 18 + idx * colWidth;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, xPos, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(s.color[0], s.color[1], s.color[2]);
    doc.text(s.val, xPos, y + 14);
  });

  y += 26;

  const headers: ColumnDef[] = [
    { text: 'Employee Name', x: 16, width: 42, align: 'left' },
    { text: 'EnNo', x: 60, width: 18, align: 'left' },
    { text: 'Status', x: 80, width: 28, align: 'left' },
    { text: 'First Punch', x: 110, width: 22, align: 'left' },
    { text: 'Last Punch', x: 134, width: 22, align: 'left' },
    { text: 'Net Shift', x: 158, width: 18, align: 'right' },
    { text: 'Audit Notes', x: 178, width: 18, align: 'left' },
  ];

  const drawTableHeader = (currY: number): number => {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currY, pageWidth - 28, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    headers.forEach((h: ColumnDef) => {
      if (h.align === 'right') {
        doc.text(h.text, h.x + h.width, currY + 4.8, { align: 'right' });
      } else {
        doc.text(h.text, h.x, currY + 4.8);
      }
    });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, currY + 7, pageWidth - 14, currY + 7);
    return currY + 7;
  };

  y = drawTableHeader(y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  records.forEach((r, idx) => {
    if (y + 6 > pageHeight - 16) {
      doc.addPage();
      y = 16;
      y = drawTableHeader(y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y, pageWidth - 28, 5.8, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(r.employeeName.length > 22 ? r.employeeName.substring(0, 20) + '..' : r.employeeName, 16, y + 4);

    doc.setTextColor(100, 116, 139);
    doc.text(r.employeeId, 60, y + 4);

    if (r.status === 'PRESENT') {
      doc.setTextColor(16, 185, 129);
      doc.text('PRESENT', 80, y + 4);
    } else if (r.status === 'APPROVED_LEAVE') {
      doc.setTextColor(14, 165, 233);
      doc.text('LEAVE', 80, y + 4);
    } else if (r.status === 'ABSENT') {
      doc.setTextColor(225, 29, 72);
      doc.text('ABSENT', 80, y + 4);
    } else if (r.status === 'SINGLE_PUNCH' || r.status === 'OUT_PENDING') {
      doc.setTextColor(168, 85, 247);
      doc.text(r.status === 'SINGLE_PUNCH' ? 'SINGLE PUNCH' : 'OUT PENDING', 80, y + 4);
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text(r.status, 80, y + 4);
    }

    doc.setTextColor(71, 85, 105);
    doc.text(r.firstPunchIn || '—', 110, y + 4);
    doc.text(r.lastPunchOut || '—', 134, y + 4);

    const netH = r.netMinutes > 0 ? (r.netMinutes / 60).toFixed(1) + 'h' : '—';
    doc.text(netH, 158 + 18, y + 4, { align: 'right' });

    let note = '';
    if (r.isLateArrival) note += `Late (+${r.lateMinutes}m) `;
    if (r.isEarlyDeparture) note += 'Early ';
    if (r.notes) note += `${r.notes} `;

    doc.setTextColor(148, 163, 184);
    doc.text(note.trim() || '—', 178, y + 4);

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(14, y + 5.8, pageWidth - 14, y + 5.8);

    y += 5.8;
  });

  drawPdfFooters(doc);

  const fileName = `VR-Constructions-Daily-Attendance-${date}.pdf`;
  doc.save(fileName);

  saveRecentReport({
    name: `Daily Attendance Report — ${date}`,
    period: date,
    format: 'PDF',
    recordCount: records.length,
    fileName,
  });

  return fileName;
}

/* ========================================================================== */
/* 4. EXCEPTIONS REPORT PDF                                                   */
/* ========================================================================== */

export function generateExceptionsPdf(monthData: CalculatedMonthData): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  let y = drawPdfHeader(
    doc,
    'Attendance Exceptions Audit',
    `Audit of Unpaired Punches, Anomalies, and Late Arrivals (${monthData.exceptions.length} Records)`,
    monthData.monthLabel,
    pageWidth
  );

  const headers: ColumnDef[] = [
    { text: 'Date', x: 16, width: 22, align: 'left' },
    { text: 'Employee', x: 40, width: 34, align: 'left' },
    { text: 'EnNo', x: 76, width: 16, align: 'left' },
    { text: 'Exception Category', x: 94, width: 36, align: 'left' },
    { text: 'Severity', x: 132, width: 18, align: 'left' },
    { text: 'Resolution Status', x: 152, width: 44, align: 'left' },
  ];

  const drawTableHeader = (currY: number): number => {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, currY, pageWidth - 28, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);

    headers.forEach((h: ColumnDef) => {
      doc.text(h.text, h.x, currY + 4.8);
    });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, currY + 7, pageWidth - 14, currY + 7);
    return currY + 7;
  };

  y = drawTableHeader(y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  monthData.exceptions.forEach((exc, idx) => {
    if (y + 10 > pageHeight - 16) {
      doc.addPage();
      y = 16;
      y = drawTableHeader(y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
    }

    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(14, y, pageWidth - 28, 9.5, 'F');
    }

    doc.setTextColor(30, 41, 59);
    doc.text(exc.date, 16, y + 4.2);

    doc.text(exc.employeeName.length > 18 ? exc.employeeName.substring(0, 16) + '..' : exc.employeeName, 40, y + 4.2);
    doc.setTextColor(100, 116, 139);
    doc.text(exc.employeeId, 76, y + 4.2);

    doc.setTextColor(15, 23, 42);
    doc.text(exc.category.replace(/_/g, ' '), 94, y + 4.2);

    if (exc.severity === 'high') {
      doc.setTextColor(225, 29, 72);
      doc.setFont('helvetica', 'bold');
      doc.text('HIGH', 132, y + 4.2);
      doc.setFont('helvetica', 'normal');
    } else {
      doc.setTextColor(217, 119, 6);
      doc.text(exc.severity.toUpperCase(), 132, y + 4.2);
    }

    if (exc.isResolved) {
      doc.setTextColor(16, 185, 129);
      doc.text('RESOLVED', 152, y + 4.2);
    } else {
      doc.setTextColor(100, 116, 139);
      doc.text('PENDING REVIEW', 152, y + 4.2);
    }

    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const descText = exc.description.length > 95 ? exc.description.substring(0, 92) + '...' : exc.description;
    doc.text(descText, 16, y + 7.8);
    doc.setFontSize(7.5);

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(14, y + 9.5, pageWidth - 14, y + 9.5);

    y += 9.5;
  });

  drawPdfFooters(doc);

  const fileName = `VR-Constructions-Attendance-Exceptions-${sanitizeFileName(monthData.monthLabel)}.pdf`;
  doc.save(fileName);

  saveRecentReport({
    name: `Exceptions Audit Report`,
    period: monthData.monthLabel,
    format: 'PDF',
    recordCount: monthData.exceptions.length,
    fileName,
  });

  return fileName;
}

/* ========================================================================== */
/* 5. MULTI-SHEET EXCEL WORKBOOK GENERATOR                                    */
/* ========================================================================== */

export function generateMonthlyExcelWorkbook(
  monthData: CalculatedMonthData,
  rawPunches?: RawBiometricPunch[],
  options: { includeExceptions?: boolean; includePunches?: boolean } = {
    includeExceptions: true,
    includePunches: true,
  }
): string {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Executive Summary
  const sundaysCount = monthData.sundaysCount || 4;
  const summaryData = [
    ['VR CONSTRUCTIONS — ATTENDANCE AUDIT SUMMARY'],
    ['Generated At', new Date().toISOString()],
    ['Reporting Month', monthData.monthLabel],
    ['Month Key', monthData.monthKey],
    ['Report Date (Latest in Dataset)', monthData.reportDate],
    ['Total Registered Personnel', monthData.kpis.totalEmployees],
    ['Expected Working Days', monthData.expectedWorkingDays],
    ['Total Sunday Instances', sundaysCount],
    ['Overall Attendance Rate (%)', monthData.kpis.avgAttendancePct],
    ['Average Net Shift Hours', monthData.kpis.avgNetHours],
    ['Approved Leave Days', monthData.kpis.totalLeave],
    ['Unnotified Absences', monthData.kpis.totalAbsences],
    ['Incomplete / Single Punches', monthData.kpis.incompletePunches],
    ['Late Arrivals (> 10:15 AM)', monthData.kpis.lateArrivals],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  // Sheet 2: Employee Summary
  const employeeRows = monthData.employeeSummaries.map((e) => ({
    'Employee ID (EnNo)': e.employeeId,
    'Employee Name': e.employeeName,
    'Expected Working Days': e.expectedAttendanceDays,
    'Present Days': e.presentDays,
    'Approved Leave Days': e.approvedLeaveDays,
    'Unnotified Absent Days': e.absentDays,
    'Single Punch Days': e.singlePunchDays,
    'Checkout Pending Days': e.outPendingDays,
    'Attendance %': e.attendancePercentage,
    'Average Net Hours': e.averageNetHours,
    'Late Arrivals Count': e.lateArrivalsCount,
    'Early Departures Count': e.earlyDeparturesCount,
  }));
  const wsEmployees = XLSX.utils.json_to_sheet(employeeRows);
  XLSX.utils.book_append_sheet(wb, wsEmployees, 'Employee Summary');

  // Sheet 3: Daily Attendance Records
  const dailyRows = monthData.dailyRecords.map((r) => ({
    Date: r.date,
    'Employee ID': r.employeeId,
    'Employee Name': r.employeeName,
    Status: r.status,
    'First Punch IN': r.firstPunchIn || '—',
    'Last Punch OUT': r.lastPunchOut || '—',
    'Punch Count': r.punchCount,
    'Gross Minutes': r.grossMinutes,
    'Lunch Deducted (Mins)': r.lunchDeductionMinutes,
    'Net Minutes': r.netMinutes,
    'Net Hours (Decimal)': r.netMinutes > 0 ? +(r.netMinutes / 60).toFixed(2) : 0,
    'Late Arrival (> 10:15)': r.isLateArrival ? 'YES' : 'NO',
    'Late Minutes': r.lateMinutes,
    'Early Departure (< 18:00)': r.isEarlyDeparture ? 'YES' : 'NO',
    'Audit Notes': r.notes || '',
  }));
  const wsDaily = XLSX.utils.json_to_sheet(dailyRows);
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Attendance');

  // Sheet 4: Exceptions (if requested)
  if (options.includeExceptions) {
    const exceptionRows = monthData.exceptions.map((exc) => ({
      Date: exc.date,
      'Employee ID': exc.employeeId,
      'Employee Name': exc.employeeName,
      Category: exc.category,
      Severity: exc.severity.toUpperCase(),
      Title: exc.title,
      Description: exc.description,
      'Resolution Status': exc.isResolved ? 'RESOLVED' : 'PENDING_REVIEW',
      'Resolved At': (exc as any).resolvedAt || '',
      'Resolution Note': (exc as any).resolutionNote || '',
    }));
    const wsExceptions = XLSX.utils.json_to_sheet(exceptionRows);
    XLSX.utils.book_append_sheet(wb, wsExceptions, 'Exceptions');
  }

  // Sheet 5: Raw Punch Records (if provided & requested)
  if (options.includePunches && rawPunches && rawPunches.length > 0) {
    const punchRows = rawPunches.map((p) => ({
      'Row #': p.sourceRowNumber,
      'Employee ID (EnNo)': p.enNo,
      'Employee Name': p.employeeName,
      'Punch Timestamp': p.normalizedTimestamp || p.originalDateTime,
      Date: p.date,
      Time: p.time,
      'Machine ID': p.machineNumber,
      'Device Mode': p.mode,
      'IOMD Status': p.iomd,
      'Is Duplicate': p.isDuplicate ? 'YES' : 'NO',
      'Is Anomaly': p.isAnomaly ? 'YES' : 'NO',
    }));
    const wsPunches = XLSX.utils.json_to_sheet(punchRows);
    XLSX.utils.book_append_sheet(wb, wsPunches, 'Raw Biometric Punches');
  }

  const fileName = `VR-Constructions-Attendance-${sanitizeFileName(monthData.monthLabel)}.xlsx`;
  XLSX.writeFile(wb, fileName);

  saveRecentReport({
    name: `Monthly Excel Workbook`,
    period: monthData.monthLabel,
    format: 'EXCEL',
    recordCount: monthData.dailyRecords.length,
    fileName,
  });

  return fileName;
}
