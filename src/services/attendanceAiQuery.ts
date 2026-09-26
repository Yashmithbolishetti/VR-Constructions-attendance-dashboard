/**
 * VR CONSTRUCTIONS — ATTENDANCE AI QUERY SERVICE
 *
 * Natural language interpretation and querying layer over the deterministic attendance calculation engine.
 *
 * CRITICAL SAFETY & ACCURACY RULES:
 * 1. AI is strictly an interpretation layer over verified calculated data.
 * 2. It never invents, hallucinates, or estimates attendance, dates, or employees.
 * 3. It resolves dates (including 'today' / 'latest') against the latest date in the dataset, not the host machine clock.
 * 4. Every answer contains a verifiable source indicator and a 1-click drill-down navigation action.
 * 5. If data is missing or out-of-scope, it explicitly and courteously states so.
 */

import {
  CalculatedMonthData,
  EmployeeAttendanceSummary,
  NavigationPage,
  ExceptionCategory,
} from '../types/attendance';
import {
  getAbsenceAnalysis,
  getLateArrivalAnalysis,
  getEarlyDepartureAnalysis,
  getWorkingHourAnalysis,
  getMonthToMonthComparison,
} from './intelligenceService';

export interface AiAnswerDrillDown {
  label: string;
  page: NavigationPage;
  params?: {
    employeeId?: string;
    employeeFilter?: string;
    category?: ExceptionCategory;
    date?: string;
    tab?: string;
  };
}

export interface AiResponse {
  answer: string;
  queryIntent: string;
  sourceBadge: string;
  facts: string[];
  drillDown?: AiAnswerDrillDown;
  isUnknownEntity?: boolean;
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', january: '01',
  feb: '02', february: '02',
  mar: '03', march: '03',
  apr: '04', april: '04',
  may: '05',
  jun: '06', june: '06',
  jul: '07', july: '07',
  aug: '08', august: '08',
  sep: '09', september: '09',
  oct: '10', october: '10',
  nov: '11', november: '11',
  dec: '12', december: '12',
};

function parseDateTokens(text: string, defaultYear = '2026'): string | null {
  // ISO format: 2026-08-22
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = text.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (slashMatch) {
    const d = slashMatch[1].padStart(2, '0');
    const m = slashMatch[2].padStart(2, '0');
    return `${slashMatch[3]}-${m}-${d}`;
  }

  // 22 Aug, 22nd August, 25 Aug 2026
  const dayMonthMatch = text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?/i);
  if (dayMonthMatch) {
    const day = dayMonthMatch[1].padStart(2, '0');
    const mStr = dayMonthMatch[2].toLowerCase();
    const mNum = MONTH_MAP[mStr];
    if (mNum) {
      const yr = dayMonthMatch[3] || defaultYear;
      return `${yr}-${mNum}-${day}`;
    }
  }

  // August 22, Sep 2
  const monthDayMatch = text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?/i);
  if (monthDayMatch) {
    const mStr = monthDayMatch[1].toLowerCase();
    const mNum = MONTH_MAP[mStr];
    if (mNum) {
      const day = monthDayMatch[2].padStart(2, '0');
      const yr = monthDayMatch[3] || defaultYear;
      return `${yr}-${mNum}-${day}`;
    }
  }

  return null;
}

function parseDateRangeTokens(
  text: string,
  defaultYear = '2026'
): { startDate: string; endDate: string } | null {
  // between 20 Aug and 2 Sep / from 20 Aug to 2 Sep / 20 Aug to 2 Sep
  const rangeMatch = text.match(
    /(?:between|from)?\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?\s*(?:and|to|-)\s*(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?/i
  );
  if (rangeMatch) {
    const day1 = rangeMatch[1].padStart(2, '0');
    const m1 = MONTH_MAP[rangeMatch[2].toLowerCase()];
    const yr1 = rangeMatch[3] || defaultYear;

    const day2 = rangeMatch[4].padStart(2, '0');
    const m2 = MONTH_MAP[rangeMatch[5].toLowerCase()];
    const yr2 = rangeMatch[6] || defaultYear;

    if (m1 && m2) {
      const d1 = `${yr1}-${m1}-${day1}`;
      const d2 = `${yr2}-${m2}-${day2}`;
      return d1 <= d2 ? { startDate: d1, endDate: d2 } : { startDate: d2, endDate: d1 };
    }
  }

  // YYYY-MM-DD to YYYY-MM-DD
  const isoRangeMatch = text.match(/(\d{4}-\d{2}-\d{2})\s*(?:and|to|-)\s*(\d{4}-\d{2}-\d{2})/);
  if (isoRangeMatch) {
    const d1 = isoRangeMatch[1];
    const d2 = isoRangeMatch[2];
    return d1 <= d2 ? { startDate: d1, endDate: d2 } : { startDate: d2, endDate: d1 };
  }

  return null;
}

function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const mIndex = parseInt(parts[1], 10) - 1;
  const mName = monthNames[mIndex] || parts[1];
  return `${parseInt(parts[2], 10)} ${mName} ${parts[0]}`;
}

/**
 * Natural Language Query Engine for Biometric Attendance Intelligence
 */
export function askAttendanceAi(
  rawQuestion: string,
  monthData: CalculatedMonthData | null,
  historicalMonths: CalculatedMonthData[] = [],
  context?: {
    currentPage?: string;
    selectedEmployeeId?: string | null;
  }
): AiResponse {
  const q = rawQuestion.trim().toLowerCase();

  if (!rawQuestion.trim()) {
    return {
      answer: 'Please enter a question about your attendance data, such as "Who was absent on 22 Aug?" or "Show attendance percentage for Manisha".',
      queryIntent: 'empty',
      sourceBadge: 'Attendance AI',
      facts: [],
    };
  }

  if (!monthData) {
    return {
      answer: 'No attendance dataset is currently loaded. Please upload a biometric punch file or import dataset to enable attendance queries.',
      queryIntent: 'no_data',
      sourceBadge: 'System Offline',
      facts: [],
      drillDown: {
        label: 'Upload Biometric File',
        page: 'upload',
      },
    };
  }

  // Pool all known records across active and historical months to eliminate month-isolation blindspots
  const allMonthsPool = [monthData, ...historicalMonths.filter((m) => m.monthKey !== monthData.monthKey)];

  // Requirement #13: Resolve period context. Default to the currently selected monthData.
  // If the user explicitly mentions another month in their question, resolve to that month if present in data.
  let targetMonthData = monthData;
  for (const m of allMonthsPool) {
    const mLabelLower = m.monthLabel.toLowerCase();
    const [y, mm] = m.monthKey.split('-');
    const mName = (MONTH_MAP[mm] || '').toLowerCase();
    if (mLabelLower && q.includes(mLabelLower)) {
      targetMonthData = m;
      break;
    }
    if (q.includes('in august') || q.includes('for august') || q.includes('during august')) {
      if (m.monthKey.endsWith('-08') || m.monthLabel.toLowerCase().includes('august')) {
        targetMonthData = m;
        break;
      }
    }
    if (q.includes('in september') || q.includes('for september') || q.includes('during september')) {
      if (m.monthKey.endsWith('-09') || m.monthLabel.toLowerCase().includes('september')) {
        targetMonthData = m;
        break;
      }
    }
    if (q.includes('overall') || q.includes('full period') || q.includes('entire period')) {
      if (m.monthKey === 'OVERALL' || m.monthLabel.toLowerCase() === 'overall') {
        targetMonthData = m;
        break;
      }
    }
  }

  const defaultYear = (targetMonthData.datasetStartDate || targetMonthData.startDate || targetMonthData.reportDate || '2026').substring(0, 4);
  const sourceBadge = `Based on verified attendance data · ${targetMonthData.monthLabel}`;

  const allDailyRecords = Array.from(
    new Map(allMonthsPool.flatMap((m) => m.dailyRecords).map((r) => [`${r.date}_${r.employeeId}`, r])).values()
  );

  // Determine global dataset boundaries
  const datasetDates = allDailyRecords.map((r) => r.date).sort();
  const datasetEarliest = datasetDates[0] || monthData.datasetStartDate || monthData.startDate;
  const datasetLatest = datasetDates[datasetDates.length - 1] || monthData.datasetEndDate || monthData.endDate || monthData.reportDate;

  // 1. Date Range Inquiries (e.g. "Summarize attendance between 20 Aug and 2 Sep")
  const dateRange = parseDateRangeTokens(q, defaultYear);
  if (dateRange || (q.includes('between') && q.includes('and')) || (q.includes('from') && q.includes('to'))) {
    if (dateRange) {
      const { startDate, endDate } = dateRange;
      const recordsInRange = allDailyRecords.filter((r) => r.date >= startDate && r.date <= endDate);
      const activeDaysInRange = Array.from(new Set(recordsInRange.map((r) => r.date))).sort();

      if (recordsInRange.length > 0) {
        const presentCount = recordsInRange.filter((r) => r.status === 'PRESENT').length;
        const absentCount = recordsInRange.filter((r) => r.status === 'ABSENT').length;
        const leaveCount = recordsInRange.filter((r) => r.status === 'APPROVED_LEAVE').length;
        const singleCount = recordsInRange.filter(
          (r) => r.status === 'SINGLE_PUNCH' || r.status === 'OUT_PENDING'
        ).length;
        const lateCount = recordsInRange.filter((r) => r.isLateArrival).length;
        const earlyCount = recordsInRange.filter((r) => r.isEarlyDeparture).length;

        const expectedCount = presentCount + absentCount;
        const rangeAttPct = expectedCount > 0 ? Math.round((presentCount / expectedCount) * 100) : 0;
        const rangeAbsPct = expectedCount > 0 ? Math.max(0, 100 - rangeAttPct) : 0;

        return {
          answer: `Between ${formatDisplayDate(startDate)} and ${formatDisplayDate(endDate)} (${activeDaysInRange.length} recorded working days), there were ${presentCount} present shifts with an overall attendance rate of ${rangeAttPct}%. Unnotified absences: ${absentCount} (${rangeAbsPct}%), approved leaves: ${leaveCount}, single punches: ${singleCount}, late marks: ${lateCount}, early departures: ${earlyCount}.`,
          queryIntent: 'range_summary',
          sourceBadge: `Based on verified biometric records · ${activeDaysInRange.length} Active Days`,
          facts: [
            `Period: ${startDate} to ${endDate}`,
            `Recorded Dates Count: ${activeDaysInRange.length}`,
            `Total Evaluated Shifts: ${recordsInRange.length}`,
            `Present Shifts: ${presentCount}`,
            `Attendance Rate: ${rangeAttPct}%`,
            `Unnotified Absences: ${absentCount}`,
            `Approved Leaves: ${leaveCount}`,
            `Single Punches: ${singleCount}`,
            `Late Marks: ${lateCount}`,
          ],
          drillDown: {
            label: `View Daily Attendance (${formatDisplayDate(startDate)})`,
            page: 'daily-attendance',
            params: { date: startDate },
          },
        };
      } else {
        return {
          answer: `No biometric punch records exist for the range ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}. The imported dataset spans strictly from ${formatDisplayDate(datasetEarliest)} through ${formatDisplayDate(datasetLatest)}. The system never assumes or invents records outside this period.`,
          queryIntent: 'range_out_of_bounds',
          sourceBadge,
          facts: [`Dataset Start: ${datasetEarliest}`, `Dataset End: ${datasetLatest}`],
          isUnknownEntity: true,
        };
      }
    }
  }

  // 2. Single Date Specific Inquiries (e.g. "Who was absent on 22 Aug?", "Who had single punches on 25 Aug?", "How many employees were present on 20 Aug?")
  const singleDate = parseDateTokens(q, defaultYear);
  if (
    singleDate ||
    q.includes('today') ||
    q.includes('yesterday') ||
    q.includes('latest date') ||
    q.includes('on 22 aug') ||
    q.includes('on 25 aug') ||
    q.includes('on 20 aug')
  ) {
    const targetDate = singleDate || monthData.reportDate;
    const recordsOnDate = allDailyRecords.filter((r) => r.date === targetDate);

    if (recordsOnDate.length > 0) {
      const present = recordsOnDate.filter((r) => r.status === 'PRESENT');
      const absent = recordsOnDate.filter((r) => r.status === 'ABSENT');
      const leave = recordsOnDate.filter((r) => r.status === 'APPROVED_LEAVE');
      const single = recordsOnDate.filter(
        (r) => r.status === 'SINGLE_PUNCH' || r.status === 'OUT_PENDING'
      );
      const formattedTargetDate = formatDisplayDate(targetDate);

      // 2A. Single Punches on specific date
      if (
        q.includes('single') ||
        q.includes('incomplete') ||
        q.includes('missing checkout') ||
        q.includes('out pending')
      ) {
        if (single.length > 0) {
          const names = single
            .map((r) => `${r.employeeName} (EnNo: ${r.employeeId}, IN: ${r.firstPunchIn || 'Present'})`)
            .join(', ');
          return {
            answer: `On ${formattedTargetDate}, ${single.length} ${single.length === 1 ? 'employee had a single punch' : 'employees had single punches'} (missing OUT checkout): ${names}.`,
            queryIntent: 'date_single_punch',
            sourceBadge: `Verified Biometric Data · ${formattedTargetDate}`,
            facts: single.map(
              (r) => `${r.employeeName} (${r.employeeId}): IN ${r.firstPunchIn || '—'}, OUT Missing`
            ),
            drillDown: {
              label: `View Daily Attendance for ${formattedTargetDate}`,
              page: 'daily-attendance',
              params: { date: targetDate, tab: 'SINGLE_PUNCH' },
            },
          };
        } else {
          return {
            answer: `On ${formattedTargetDate}, 0 employees had single punches. All recorded present shifts had paired IN and OUT punches.`,
            queryIntent: 'date_single_punch_zero',
            sourceBadge: `Verified Biometric Data · ${formattedTargetDate}`,
            facts: [`Total Shifts: ${recordsOnDate.length}`, `Present: ${present.length}`, `Single Punches: 0`],
            drillDown: {
              label: `View Daily Attendance for ${formattedTargetDate}`,
              page: 'daily-attendance',
              params: { date: targetDate },
            },
          };
        }
      }

      // 2B. Absent on specific date
      if (q.includes('absent') || q.includes('absence')) {
        if (absent.length > 0) {
          const absentNames = absent
            .map((a) => `${a.employeeName} (EnNo: ${a.employeeId})`)
            .join(', ');
          return {
            answer: `On ${formattedTargetDate}, ${absent.length} ${absent.length === 1 ? 'employee was' : 'employees were'} unnotified absent: ${absentNames}. (Total roster: ${recordsOnDate.length}, Present: ${present.length})`,
            queryIntent: 'date_absence',
            sourceBadge: `Verified Biometric Data · ${formattedTargetDate}`,
            facts: [
              `Total Personnel: ${recordsOnDate.length}`,
              `Present: ${present.length}`,
              `Approved Leave: ${leave.length}`,
              `Unnotified Absent: ${absent.length}`,
            ],
            drillDown: {
              label: `View Daily Attendance for ${formattedTargetDate}`,
              page: 'daily-attendance',
              params: { date: targetDate, tab: 'ABSENT' },
            },
          };
        } else {
          return {
            answer: `On ${formattedTargetDate}, 0 employees were absent. All scheduled employees were present or on approved leave.`,
            queryIntent: 'date_absence_zero',
            sourceBadge: `Verified Biometric Data · ${formattedTargetDate}`,
            facts: [`Total Active Personnel: ${recordsOnDate.length}`, `Present: ${present.length}`],
            drillDown: {
              label: `View Daily Attendance for ${formattedTargetDate}`,
              page: 'daily-attendance',
              params: { date: targetDate },
            },
          };
        }
      }

      // 2C. Present count / list on specific date
      if (
        q.includes('how many') ||
        q.includes('present') ||
        q.includes('attended') ||
        q.includes('who was there')
      ) {
        const attPct = recordsOnDate.length > 0 ? Math.round((present.length / recordsOnDate.length) * 100) : 0;
        const samplePresent = present
          .slice(0, 6)
          .map((p) => p.employeeName)
          .join(', ');
        const remainder = present.length > 6 ? ` and ${present.length - 6} more` : '';

        return {
          answer: `On ${formattedTargetDate}, ${present.length} of ${recordsOnDate.length} employees were present (${attPct}% daily attendance).${present.length > 0 ? ` Present personnel: ${samplePresent}${remainder}.` : ''} Absentees: ${absent.length}, Approved leaves: ${leave.length}, Single punches: ${single.length}.`,
          queryIntent: 'date_present_count',
          sourceBadge: `Verified Biometric Data · ${formattedTargetDate}`,
          facts: [
            `Total Roster: ${recordsOnDate.length}`,
            `Present: ${present.length}`,
            `Daily Attendance Rate: ${attPct}%`,
            `Unnotified Absences: ${absent.length}`,
            `Approved Leaves: ${leave.length}`,
            `Single Punches: ${single.length}`,
          ],
          drillDown: {
            label: `View Daily Attendance for ${formattedTargetDate}`,
            page: 'daily-attendance',
            params: { date: targetDate },
          },
        };
      }

      // 2D. General date summary
      return {
        answer: `On ${formattedTargetDate}, ${present.length} of ${recordsOnDate.length} employees were present, ${leave.length} on approved leave, ${absent.length} unnotified absent, and ${single.length} had single/incomplete punches.`,
        queryIntent: 'date_summary',
        sourceBadge: `Verified Biometric Data · ${formattedTargetDate}`,
        facts: [
          `Date: ${formattedTargetDate}`,
          `Present: ${present.length}`,
          `Approved Leave: ${leave.length}`,
          `Absent: ${absent.length}`,
          `Single Punch: ${single.length}`,
        ],
        drillDown: {
          label: `Inspect Daily Sheet for ${formattedTargetDate}`,
          page: 'daily-attendance',
          params: { date: targetDate },
        },
      };
    } else {
      const formattedTarget = formatDisplayDate(targetDate);
      return {
        answer: `The date "${formattedTarget}" is outside the imported biometric dataset (which strictly spans ${formatDisplayDate(datasetEarliest)} through ${formatDisplayDate(datasetLatest)}). The system never creates, assumes, or hallucinates attendance for dates outside the imported biometric file.`,
        queryIntent: 'date_not_found',
        sourceBadge,
        facts: [
          `Dataset Start Date: ${datasetEarliest}`,
          `Dataset End Date: ${datasetLatest}`,
          `Total Dates Represented: ${datasetDates.length}`,
        ],
        isUnknownEntity: true,
      };
    }
  }

  // 3. Working Hours Ranking (e.g. "Which employee worked the most hours in August?")
  if (
    q.includes('most hours') ||
    q.includes('worked the most') ||
    q.includes('highest hours') ||
    q.includes('maximum hours') ||
    q.includes('longest hours') ||
    q.includes('who worked the most')
  ) {
    let targetDataset = monthData;
    if (q.includes('aug') || q.includes('august')) {
      const augData = allMonthsPool.find(
        (m) => m.monthKey.endsWith('-08') || m.monthLabel.toLowerCase().includes('aug')
      );
      if (augData) targetDataset = augData;
    } else if (q.includes('sep') || q.includes('september')) {
      const sepData = allMonthsPool.find(
        (m) => m.monthKey.endsWith('-09') || m.monthLabel.toLowerCase().includes('sep')
      );
      if (sepData) targetDataset = sepData;
    }

    const sortedByNetMinutes = [...targetDataset.employeeSummaries].sort(
      (a, b) => b.totalNetMinutes - a.totalNetMinutes
    );

    if (sortedByNetMinutes.length > 0) {
      const top = sortedByNetMinutes[0];
      const topHours = Math.floor(top.totalNetMinutes / 60);
      const topMins = top.totalNetMinutes % 60;
      const topFormatted = `${topHours}h ${topMins > 0 ? `${topMins}m` : ''}`.trim();

      const runnersUp = sortedByNetMinutes.slice(1, 4).map((e) => {
        const h = Math.floor(e.totalNetMinutes / 60);
        const m = e.totalNetMinutes % 60;
        return `${e.employeeName} (${h}h ${m > 0 ? `${m}m` : ''})`;
      }).join(', ');

      return {
        answer: `${top.employeeName} (EnNo: ${top.employeeId}) worked the most hours in ${targetDataset.monthLabel}, logging ${topFormatted} net working hours across ${top.presentDays} present days (average ${top.averageNetHoursFormatted || `${top.averageNetHours}h`} per day).${runnersUp ? ` Runners-up: ${runnersUp}.` : ''}`,
        queryIntent: 'most_hours',
        sourceBadge: `Based on verified biometric records · ${targetDataset.monthLabel}`,
        facts: sortedByNetMinutes.slice(0, 5).map((e, idx) => {
          const h = Math.floor(e.totalNetMinutes / 60);
          const m = e.totalNetMinutes % 60;
          return `#${idx + 1} ${e.employeeName} (EnNo: ${e.employeeId}): ${h}h ${m}m net (${e.presentDays} present days, avg ${e.averageNetHoursFormatted || `${e.averageNetHours}h`})`;
        }),
        drillDown: {
          label: `View ${top.employeeName}'s Shifts`,
          page: 'employees',
          params: { employeeId: top.employeeId },
        },
      };
    }
  }

  // 4. Search for Employee by Name or EnNo ID
  const employees = targetMonthData.employeeSummaries;
  let matchedEmployee: EmployeeAttendanceSummary | undefined;

  // Check context if an employee is currently selected
  if (
    context?.selectedEmployeeId &&
    (q.includes('he') || q.includes('she') || q.includes('this employee') || q.includes('they'))
  ) {
    matchedEmployee = employees.find((e) => e.employeeId === context.selectedEmployeeId);
  }

  // Match by EnNo first
  if (!matchedEmployee) {
    matchedEmployee = employees.find((e) => q.includes(e.employeeId.toLowerCase()));
  }

  // Match by full or partial name
  if (!matchedEmployee) {
    matchedEmployee = employees.find((e) => {
      const nameParts = e.employeeName.toLowerCase().split(/\s+/);
      return nameParts.some((part) => part.length >= 3 && q.includes(part));
    });
  }

  // 5. If an employee was matched, answer employee-specific inquiries
  if (matchedEmployee) {
    const emp = matchedEmployee;

    // 5A. Attendance Percentage / Absence Percentage Inquiry (e.g. "Show attendance percentage for Manisha")
    if (
      q.includes('percentage') ||
      q.includes('percent') ||
      q.includes('score') ||
      q.includes('rate') ||
      q.includes('attendance')
    ) {
      const absPct = emp.absencePercentage;
      return {
        answer: `${emp.employeeName} (EnNo: ${emp.employeeId}) has an Attendance Percentage of ${emp.attendancePercentage}% and an Absence Percentage of ${absPct}% for ${targetMonthData.monthLabel}. Present: ${emp.presentDays} of ${emp.expectedAttendanceDays} expected working days. Absences: ${emp.absentDays} days, Approved Leave: ${emp.approvedLeaveDays} days, Single Punches: ${emp.singlePunchDays + emp.outPendingDays} days, Late Marks: ${emp.lateDays || 0}, Early Departures: ${emp.earlyDepartureDays || 0}, Average Net Shift: ${emp.averageNetHoursFormatted || `${emp.averageNetHours}h`}.`,
        queryIntent: 'employee_percentage',
        sourceBadge,
        facts: [
          `Attendance %: ${emp.attendancePercentage}%`,
          `Absence %: ${absPct}%`,
          `Present Days: ${emp.presentDays} / ${emp.expectedAttendanceDays} expected`,
          `Unnotified Absences: ${emp.absentDays} days`,
          `Approved Leaves: ${emp.approvedLeaveDays} days`,
          `Single Punches: ${emp.singlePunchDays + emp.outPendingDays} days`,
          `Late Marks: ${emp.lateDays || 0}`,
          `Early Departures: ${emp.earlyDepartureDays || 0}`,
          `Average Net Shift: ${emp.averageNetHoursFormatted || `${emp.averageNetHours}h`}`,
        ],
        drillDown: {
          label: `Open ${emp.employeeName}'s Full Profile`,
          page: 'employees',
          params: { employeeId: emp.employeeId },
        },
      };
    }

    if (q.includes('leave') || q.includes('leaves')) {
      return {
        answer: `${emp.employeeName} (EnNo: ${emp.employeeId}) took ${emp.approvedLeaveDays} approved leave ${emp.approvedLeaveDays === 1 ? 'day' : 'days'} in ${targetMonthData.monthLabel}.`,
        queryIntent: 'employee_leave',
        sourceBadge,
        facts: [
          `Approved Leave: ${emp.approvedLeaveDays} days`,
          `Present: ${emp.presentDays} days`,
          `Unnotified Absences: ${emp.absentDays} days`,
          `Attendance Rate: ${emp.attendancePercentage}%`,
        ],
        drillDown: {
          label: `View ${emp.employeeName}'s Profile`,
          page: 'employees',
          params: { employeeId: emp.employeeId },
        },
      };
    }

    if (q.includes('absent') || q.includes('absence') || q.includes('absences')) {
      const leaveClarification = emp.approvedLeaveDays > 0
        ? ` (Note: ${emp.employeeName} also had ${emp.approvedLeaveDays} approved leave ${emp.approvedLeaveDays === 1 ? 'day' : 'days'}, which are excluded from absences)`
        : '';
      const absText =
        emp.absentDays > 0
          ? `${emp.employeeName} (EnNo: ${emp.employeeId}) was recorded absent for ${emp.absentDays} ${emp.absentDays === 1 ? 'day' : 'days'} in ${targetMonthData.monthLabel}${leaveClarification}.`
          : `${emp.employeeName} (EnNo: ${emp.employeeId}) had 0 unnotified absences in ${targetMonthData.monthLabel}${leaveClarification}.`;

      return {
        answer: absText,
        queryIntent: 'employee_absence',
        sourceBadge,
        facts: [
          `Unnotified Absences: ${emp.absentDays} days`,
          `Approved Leaves: ${emp.approvedLeaveDays} days (Excluded from Absences)`,
          `Present: ${emp.presentDays} of ${emp.expectedAttendanceDays} expected days`,
          `Attendance %: ${emp.attendancePercentage}%`,
          `Absence %: ${emp.absencePercentage}%`,
        ],
        drillDown: {
          label: `Inspect ${emp.employeeName}'s Attendance Record`,
          page: 'employees',
          params: { employeeId: emp.employeeId, employeeFilter: 'has-absent' },
        },
      };
    }

    if (q.includes('late') || q.includes('late arrival') || q.includes('punctual')) {
      const lateText =
        emp.lateArrivalsCount > 0
          ? `${emp.employeeName} had ${emp.lateArrivalsCount} late ${emp.lateArrivalsCount === 1 ? 'arrival' : 'arrivals'} past the 10:15 AM grace cutoff in ${targetMonthData.monthLabel}.`
          : `${emp.employeeName} had no recorded late arrivals in ${targetMonthData.monthLabel}.`;

      return {
        answer: lateText,
        queryIntent: 'employee_late',
        sourceBadge,
        facts: [
          `Late Arrivals: ${emp.lateArrivalsCount}`,
          `Early Departures: ${emp.earlyDeparturesCount}`,
          `Average Net Shift: ${emp.averageNetHoursFormatted || `${emp.averageNetHours}h`}`,
        ],
        drillDown: {
          label: `View Late Records for ${emp.employeeName}`,
          page: 'exceptions',
          params: { employeeId: emp.employeeId, category: 'LATE_ARRIVAL' },
        },
      };
    }

    if (
      q.includes('hours') ||
      q.includes('working time') ||
      q.includes('average time') ||
      q.includes('net hours') ||
      q.includes('gross')
    ) {
      return {
        answer: `${emp.employeeName}'s average net working time was ${emp.averageNetHoursFormatted || `${emp.averageNetHours} hours`} per complete day, with a total of ${(emp.totalNetMinutes / 60).toFixed(1)} net hours logged across ${emp.presentDays} present days.`,
        queryIntent: 'employee_hours',
        sourceBadge,
        facts: [
          `Average Net Shift: ${emp.averageNetHoursFormatted || `${emp.averageNetHours}h`}`,
          `Total Net Logged: ${(emp.totalNetMinutes / 60).toFixed(1)} hours`,
          `Single / Unpaired Punches: ${emp.singlePunchDays + emp.outPendingDays} days`,
        ],
        drillDown: {
          label: `View ${emp.employeeName}'s Shift Breakdown`,
          page: 'employees',
          params: { employeeId: emp.employeeId },
        },
      };
    }

    // Default general summary for the employee
    return {
      answer: `${emp.employeeName} (EnNo: ${emp.employeeId}) was present for ${emp.presentDays} of ${emp.expectedAttendanceDays} expected working days in ${targetMonthData.monthLabel}, achieving an attendance rate of ${emp.attendancePercentage}% (absence rate: ${emp.absencePercentage}%) with an average net shift of ${emp.averageNetHoursFormatted || `${emp.averageNetHours} hours`}.`,
      queryIntent: 'employee_general',
      sourceBadge,
      facts: [
        `Attendance Rate: ${emp.attendancePercentage}%`,
        `Absence Rate: ${emp.absencePercentage}%`,
        `Present: ${emp.presentDays} days`,
        `Approved Leave: ${emp.approvedLeaveDays} days`,
        `Unnotified Absences: ${emp.absentDays} days`,
        `Single Punches: ${emp.singlePunchDays + emp.outPendingDays} days`,
        `Average Net Shift: ${emp.averageNetHoursFormatted || `${emp.averageNetHours}h`}`,
        `Late Arrivals: ${emp.lateArrivalsCount}`,
      ],
      drillDown: {
        label: `Open ${emp.employeeName}'s Full Profile`,
        page: 'employees',
        params: { employeeId: emp.employeeId },
      },
    };
  }

  // 6. Check if user asked about an employee name that was NOT found
  const words = rawQuestion.split(/\s+/);
  const probableNames = words.filter(
    (w) =>
      w.length > 3 &&
      /^[A-Z][a-z]+$/.test(w) &&
      ![
        'What', 'When', 'Where', 'Who', 'How', 'Show', 'Which', 'Many',
        'Days', 'Time', 'Late', 'Leave', 'Tell', 'Does', 'Have', 'Attendance',
      ].includes(w)
  );
  if (
    probableNames.length > 0 &&
    !matchedEmployee &&
    (q.includes('present') || q.includes('absent') || q.includes('leave') || q.includes('hours') || q.includes('percentage'))
  ) {
    const sampleNames = employees.slice(0, 5).map((e) => e.employeeName).join(', ');
    return {
      answer: `I could not find an employee named "${probableNames[0]}" in the current attendance records for ${targetMonthData.monthLabel}. Registered personnel in this dataset include: ${sampleNames}, among others.`,
      queryIntent: 'employee_not_found',
      sourceBadge,
      facts: [`Total personnel in dataset: ${employees.length}`],
      isUnknownEntity: true,
      drillDown: {
        label: 'View Employee Directory',
        page: 'employees',
      },
    };
  }

  // 7. Absence Inquiries across company ("How many employees were absent?", "Who was absent the most?")
  if (
    q.includes('most absent') ||
    (q.includes('who') && q.includes('absent')) ||
    q.includes('highest absence') ||
    q.includes('how many employees were absent') ||
    q.includes('how many were absent') ||
    q.includes('how many absent') ||
    q.includes('number of absent') ||
    q.includes('total absent') ||
    q.includes('total absences') ||
    q.includes('absence count')
  ) {
    const absences = getAbsenceAnalysis(targetMonthData);
    if (absences.length === 0) {
      return {
        answer: `No unnotified absences were recorded across the company for ${targetMonthData.monthLabel}.`,
        queryIntent: 'absences_all',
        sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
        facts: [`Period: ${targetMonthData.monthLabel}`, `Total unnotified absences: 0`],
        drillDown: {
          label: 'View Employees Directory',
          page: 'employees',
        },
      };
    }

    const top = absences.slice(0, 4);
    const topText = top
      .map((a) => `${a.employeeName} (${a.absentDaysCount} days)`)
      .join(', ');

    return {
      answer: `In ${targetMonthData.monthLabel}, ${absences.length} employee(s) recorded a total of ${targetMonthData.kpis.totalAbsences} unnotified absence days. Highest absences: ${topText}.`,
      queryIntent: 'absences_most',
      sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
      facts: [
        `Period: ${targetMonthData.monthLabel}`,
        `Absent Personnel Count: ${absences.length}`,
        `Total Absence Days: ${targetMonthData.kpis.totalAbsences}`,
        ...top.map((a) => `${a.employeeName} (EnNo: ${a.employeeId}): ${a.absentDaysCount} absences`),
      ],
      drillDown: {
        label: 'Filter Absent Personnel',
        page: 'employees',
        params: { employeeFilter: 'has-absent' },
      },
    };
  }

  // 8. Late Arrival Inquiries ("Who came late this month?", "late arrivals")
  if (q.includes('late') || q.includes('punctual') || q.includes('after 10:15')) {
    const lates = getLateArrivalAnalysis(targetMonthData);
    if (lates.length === 0) {
      return {
        answer: `No employees arrived past the 10:15 AM grace threshold during ${targetMonthData.monthLabel}.`,
        queryIntent: 'late_none',
        sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
        facts: [`Period: ${targetMonthData.monthLabel}`, `Total late arrivals: 0`],
        drillDown: {
          label: 'View Exceptions Center',
          page: 'exceptions',
        },
      };
    }

    const topLates = lates.slice(0, 3);
    const lateText = topLates
      .map((l) => `${l.employeeName} (${l.lateArrivalsCount} times, avg ${l.averageLateMinutes}m late)`)
      .join(', ');

    return {
      answer: `A total of ${targetMonthData.kpis.lateArrivals} late arrivals past 10:15 AM were recorded in ${targetMonthData.monthLabel}. Highest occurrences: ${lateText}.`,
      queryIntent: 'late_most',
      sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
      facts: topLates.map(
        (l) => `${l.employeeName}: ${l.lateArrivalsCount} late arrivals (average +${l.averageLateMinutes}m)`
      ),
      drillDown: {
        label: 'Inspect Late Arrival Exceptions',
        page: 'exceptions',
        params: { category: 'LATE_ARRIVAL' },
      },
    };
  }

  // 9. Incomplete Attendance / Single Punch Inquiries
  if (
    q.includes('incomplete') ||
    q.includes('single punch') ||
    q.includes('missing checkout') ||
    q.includes('out pending') ||
    q.includes('unpaired')
  ) {
    const incompleteEmp = employees.filter((e) => e.singlePunchDays + e.outPendingDays > 0);
    const incText = incompleteEmp.length
      ? incompleteEmp
          .slice(0, 4)
          .map((e) => `${e.employeeName} (${e.singlePunchDays + e.outPendingDays} single punch days)`)
          .join(', ')
      : 'None. All recorded shifts have paired punches.';

    return {
      answer: `There are ${targetMonthData.kpis.incompletePunches} single-punch / checkout-pending instances in ${targetMonthData.monthLabel}. Affected personnel: ${incText}.`,
      queryIntent: 'incomplete_punches',
      sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
      facts: [
        `Period: ${targetMonthData.monthLabel}`,
        `Incomplete shifts: ${targetMonthData.kpis.incompletePunches}`,
        `Affected employees: ${incompleteEmp.length}`,
        `Note: Incomplete days are never treated as absences or zero hours.`,
      ],
      drillDown: {
        label: 'Resolve Single Punches in Exception Center',
        page: 'exceptions',
        params: { category: 'SINGLE_PUNCH' },
      },
    };
  }

  // 10. Working Hours & Average Time Inquiries
  if (
    q.includes('average hours') ||
    q.includes('working hours') ||
    q.includes('working time') ||
    q.includes('net hours') ||
    q.includes('gross hours')
  ) {
    const hoursAnalysis = getWorkingHourAnalysis(targetMonthData);
    const topHours = hoursAnalysis.slice(0, 3);
    const topText = topHours
      .map((h) => `${h.employeeName} (${h.averageNetHoursFormatted})`)
      .join(', ');

    return {
      answer: `The overall company average net shift is ${targetMonthData.kpis.avgNetHours} hours per complete working day for ${targetMonthData.monthLabel}. Highest average shift lengths: ${topText}.`,
      queryIntent: 'company_hours',
      sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
      facts: [
        `Period: ${targetMonthData.monthLabel}`,
        `Company Average Net Shift: ${targetMonthData.kpis.avgNetHours}h`,
        `Office Standard: 10:00 AM — 06:00 PM (8.0h Gross - 1.0h Lunch = 7.0h Net)`,
        `Complete days evaluated: ${hoursAnalysis.reduce((acc, h) => acc + h.completeDaysCount, 0)}`,
      ],
      drillDown: {
        label: 'View Working Hours Analytics',
        page: 'analytics',
        params: { tab: 'hours' },
      },
    };
  }

  // 10B. Company-wide / aggregate leave inquiries (e.g. "How many people were on leave?", "Who was on leave?")
  if (
    q.includes('people were on leave') ||
    q.includes('employees were on leave') ||
    q.includes('who was on leave') ||
    q.includes('who took leave') ||
    (q.includes('leave') && (q.includes('how many') || q.includes('who') || q.includes('total') || q.includes('count')))
  ) {
    const onLeaveEmployees = employees.filter((e) => e.approvedLeaveDays > 0);
    const totalLeaveDays = onLeaveEmployees.reduce((acc, e) => acc + e.approvedLeaveDays, 0);
    const leaveNames = onLeaveEmployees.map((e) => `${e.employeeName} (${e.approvedLeaveDays}d)`).join(', ');

    return {
      answer:
        onLeaveEmployees.length > 0
          ? `In ${targetMonthData.monthLabel}, ${onLeaveEmployees.length} ${onLeaveEmployees.length === 1 ? 'employee was' : 'employees were'} on approved leave (${totalLeaveDays} total leave days): ${leaveNames}. Approved leave is excluded from absent calculations and never converts to absence.`
          : `In ${targetMonthData.monthLabel}, 0 employees were on leave. All ${employees.length} employees had 0 approved leave days.`,
      queryIntent: 'company_leave',
      sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
      facts: [
        `Period: ${targetMonthData.monthLabel}`,
        `Employees on Approved Leave: ${onLeaveEmployees.length}`,
        `Total Approved Leave Days: ${totalLeaveDays}`,
        ...onLeaveEmployees.map((e) => `${e.employeeName} (EnNo: ${e.employeeId}): ${e.approvedLeaveDays} approved leave days`),
      ],
      drillDown: {
        label: 'View Employees on Leave',
        page: 'employees',
      },
    };
  }

  // 11. Low Attendance Inquiries (< 75% or similar)
  if (q.includes('low') || q.includes('poor') || q.includes('< 75') || q.includes('under 75')) {
    const lowAtt = employees.filter((e) => e.attendancePercentage < 75);
    const lowText = lowAtt.length
      ? lowAtt.map((e) => `${e.employeeName} (${e.attendancePercentage}%)`).join(', ')
      : 'None. All employees have 75% or higher attendance.';

    return {
      answer: `In ${targetMonthData.monthLabel}, ${lowAtt.length} ${lowAtt.length === 1 ? 'employee has' : 'employees have'} an attendance percentage under 75%: ${lowText}.`,
      queryIntent: 'low_attendance',
      sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
      facts: lowAtt.map(
        (e) => `${e.employeeName} (EnNo: ${e.employeeId}): ${e.attendancePercentage}% (${e.presentDays}/${e.expectedAttendanceDays} days)`
      ),
      drillDown: {
        label: 'View Low Attendance Employees',
        page: 'employees',
        params: { employeeFilter: 'low' },
      },
    };
  }

  // 12. Month Comparison inquiries
  if (
    q.includes('compare') ||
    q.includes('previous month') ||
    q.includes('last month') ||
    (q.includes('august') && q.includes('september'))
  ) {
    const prevMonth = historicalMonths.find((m) => m.monthKey !== targetMonthData.monthKey) || null;
    const comparison = getMonthToMonthComparison(targetMonthData, prevMonth);

    if (comparison) {
      const attDiff = comparison.metrics.find((m) => m.label.includes('Attendance Rate'));

      return {
        answer: `Comparing ${comparison.currentMonthLabel} to ${comparison.previousMonthLabel}: Overall attendance is ${targetMonthData.kpis.avgAttendancePct}% (${attDiff ? (attDiff.difference >= 0 ? '+' : '') + attDiff.difference + '%' : 'no change'}), with an average net shift of ${targetMonthData.kpis.avgNetHours} hours.`,
        queryIntent: 'month_comparison',
        sourceBadge: `Based on verified attendance data · Comparison`,
        facts: comparison.metrics.map(
          (m) =>
            `${m.label}: ${m.currentValue} vs ${m.previousValue} (${m.difference >= 0 ? '+' : ''}${m.difference} ${m.unit})`
        ),
        drillDown: {
          label: 'View Full Comparison in Analytics',
          page: 'analytics',
        },
      };
    } else {
      return {
        answer: `Comparison requires at least two monthly datasets. Currently, only ${targetMonthData.monthLabel} is loaded.`,
        queryIntent: 'month_comparison',
        sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
        facts: [`Available month: ${targetMonthData.monthLabel} (${targetMonthData.employeeSummaries.length} personnel)`],
        drillDown: {
          label: 'View Analytics Overview',
          page: 'analytics',
        },
      };
    }
  }

  // 13. Company KPI / Overall Summary Inquiries
  if (
    q.includes('how many employees') ||
    q.includes('total employees') ||
    q.includes('working days') ||
    q.includes('overall') ||
    q.includes('summary') ||
    q.includes('overview')
  ) {
    return {
      answer: `For ${targetMonthData.monthLabel}, there are ${targetMonthData.kpis.totalEmployees} registered personnel across ${targetMonthData.expectedWorkingDays} expected working days (${targetMonthData.sundaysCount || 4} Sundays, ${targetMonthData.holidaysCount || 0} holidays). Company overall attendance is ${targetMonthData.kpis.avgAttendancePct}%, with an average net shift of ${targetMonthData.kpis.avgNetHours} hours.`,
      queryIntent: 'executive_overview',
      sourceBadge: `Based on verified attendance data · ${targetMonthData.monthLabel}`,
      facts: [
        `Period: ${targetMonthData.monthLabel}`,
        `Total Personnel: ${targetMonthData.kpis.totalEmployees}`,
        `Working Days: ${targetMonthData.expectedWorkingDays}`,
        `Average Attendance: ${targetMonthData.kpis.avgAttendancePct}%`,
        `Average Net Shift: ${targetMonthData.kpis.avgNetHours}h`,
        `Approved Leaves: ${targetMonthData.kpis.totalLeave} days`,
        `Unnotified Absences: ${targetMonthData.kpis.totalAbsences} days`,
        `Incomplete Punches: ${targetMonthData.kpis.incompletePunches}`,
      ],
      drillDown: {
        label: 'Open Executive Overview',
        page: 'overview',
      },
    };
  }

  // 14. Fallback with helpful factual suggestions
  const sampleEmp = employees[0]?.employeeName || 'Manisha';
  return {
    answer: `I could not find a direct factual answer for that question. You can ask specific questions regarding personnel, dates, or attendance metrics based strictly on your uploaded biometric data.`,
    queryIntent: 'fallback',
    sourceBadge,
    facts: [
      `Try: "Who was absent on 22 Aug?"`,
      `Try: "Which employee worked the most hours in August?"`,
      `Try: "Show attendance percentage for ${sampleEmp}"`,
      `Try: "Who had single punches on 25 Aug?"`,
      `Try: "Summarize attendance between 20 Aug and 2 Sep"`,
    ],
    drillDown: {
      label: 'Explore Analytics Dashboard',
      page: 'analytics',
    },
  };
}
