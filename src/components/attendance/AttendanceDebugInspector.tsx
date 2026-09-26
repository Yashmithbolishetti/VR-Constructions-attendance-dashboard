import React, { useState, useMemo, useEffect } from 'react';
import {
  Bug,
  Calendar,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Cpu,
  Info,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  normalizeDateString,
  normalizeEnNo,
  isEnNoMatch,
  isDateSunday,
} from '../../services/attendanceCalculator';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

export interface AttendanceDebugInspectorProps {
  initialEmployeeId?: string;
  initialDate?: string;
  className?: string;
  compact?: boolean;
}

export const AttendanceDebugInspector: React.FC<AttendanceDebugInspectorProps> = ({
  initialEmployeeId,
  initialDate,
  className = '',
  compact = false,
}) => {
  const { calculatedData, parsedDataset, holidays, leaves } = useApp();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  // Available employees
  const employees = useMemo(() => {
    if (calculatedData?.employeeSummaries && calculatedData.employeeSummaries.length > 0) {
      return calculatedData.employeeSummaries.map((e) => ({
        id: e.employeeId,
        name: e.employeeName,
      }));
    }
    if (parsedDataset?.employees && parsedDataset.employees.length > 0) {
      return parsedDataset.employees.map((e) => ({
        id: e.employeeId,
        name: e.name,
      }));
    }
    return [{ id: '000000008', name: 'Manisha' }];
  }, [calculatedData, parsedDataset]);

  // Selected Employee ID
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    initialEmployeeId || employees[0]?.id || '000000008'
  );

  // Available dates from dataset
  const availableDates = useMemo(() => {
    if (calculatedData?.dailyRecords && calculatedData.dailyRecords.length > 0) {
      return Array.from(new Set(calculatedData.dailyRecords.map((r) => r.date))).sort();
    }
    if (parsedDataset?.datesRepresented && parsedDataset.datesRepresented.length > 0) {
      return [...parsedDataset.datesRepresented].sort();
    }
    return ['2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30'];
  }, [calculatedData, parsedDataset]);

  // Selected Date
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || availableDates[0] || '2026-08-26'
  );

  // Keep state synced with props if changed externally
  useEffect(() => {
    if (initialEmployeeId) setSelectedEmpId(initialEmployeeId);
  }, [initialEmployeeId]);

  useEffect(() => {
    if (initialDate) setSelectedDate(initialDate);
  }, [initialDate]);

  // Normalized date & EnNo
  const normDate = normalizeDateString(selectedDate);
  const normEmpEnNo = normalizeEnNo(selectedEmpId);
  const paddedEmpEnNo = /^\d+$/.test(normEmpEnNo) ? normEmpEnNo.padStart(9, '0') : selectedEmpId;
  const currentEmp = employees.find((e) => isEnNoMatch(e.id, selectedEmpId)) || {
    id: selectedEmpId,
    name: `Employee ${selectedEmpId}`,
  };

  // 1. Biometric punches inspect
  const punches = useMemo(() => {
    if (!parsedDataset?.validPunches) return [];
    return parsedDataset.validPunches.filter(
      (p) => isEnNoMatch(p.enNo, selectedEmpId) && normalizeDateString(p.date) === normDate
    );
  }, [parsedDataset, selectedEmpId, normDate]);

  // 2. Holiday record inspect
  const holidayRecord = useMemo(() => {
    return holidays.find((h) => normalizeDateString(h.date) === normDate) || null;
  }, [holidays, normDate]);

  // 3. Approved leave record inspect
  const leaveRecord = useMemo(() => {
    return (
      leaves.find(
        (l) => isEnNoMatch(l.employeeId, selectedEmpId) && normalizeDateString(l.date) === normDate
      ) || null
    );
  }, [leaves, selectedEmpId, normDate]);

  // 4. Sunday inspect
  const isSunday = isDateSunday(normDate);

  // 5. In-dataset bounds inspect
  const datasetStartDate = parsedDataset?.firstDate || calculatedData?.dailyRecords[0]?.date || '';
  const datasetEndDate =
    parsedDataset?.lastDate ||
    calculatedData?.dailyRecords[calculatedData.dailyRecords.length - 1]?.date ||
    '';
  const isInDatasetBounds =
    !datasetStartDate || !datasetEndDate || (normDate >= datasetStartDate && normDate <= datasetEndDate);

  // 6. Calculated Daily Record from Single Source of Truth
  const dailyRecord = useMemo(() => {
    if (!calculatedData?.dailyRecords) return null;
    return (
      calculatedData.dailyRecords.find(
        (r) => isEnNoMatch(r.employeeId, selectedEmpId) && r.date === normDate
      ) || null
    );
  }, [calculatedData, selectedEmpId, normDate]);

  // 7. Employee summary metrics
  const empSummary = useMemo(() => {
    if (!calculatedData?.employeeSummaries) return null;
    return calculatedData.employeeSummaries.find((s) => isEnNoMatch(s.employeeId, selectedEmpId)) || null;
  }, [calculatedData, selectedEmpId]);

  // Priority and status evaluation description
  const evaluationTrace = useMemo(() => {
    let status = 'ABSENT';
    let rule = 'Priority 5: Working day with 0 punches and no approved leave or holiday';

    if (isSunday) {
      status = 'SUNDAY';
      rule = 'Priority 1: Sunday is an automatic non-working day';
    } else if (holidayRecord) {
      status = 'HOLIDAY';
      rule = `Priority 2: Configured Holiday ("${holidayRecord.name}") takes precedence and prevents absence`;
    } else if (leaveRecord) {
      status = 'APPROVED_LEAVE';
      rule = `Priority 3: Approved Leave ("${leaveRecord.leaveType}") takes precedence and prevents absence`;
    } else if (punches.length >= 2) {
      status = 'PRESENT';
      rule = `Priority 4: Valid paired punches (${punches.length} punches) recorded`;
    } else if (punches.length === 1) {
      status = normDate === datasetEndDate ? 'OUT_PENDING' : 'SINGLE_PUNCH';
      rule =
        normDate === datasetEndDate
          ? 'Priority 4: Single punch on report date -> OUT_PENDING'
          : 'Priority 4: Single punch on historical date -> SINGLE_PUNCH';
    }

    return {
      status: dailyRecord?.status || status,
      rule,
    };
  }, [isSunday, holidayRecord, leaveRecord, punches, normDate, datasetEndDate, dailyRecord]);

  // Formatted Developer Output Block (Matches user prompt section 7)
  const debugTextBlock = useMemo(() => {
    return [
      `### ${currentEmp.name} — ${normDate}`,
      `EnNo: ${paddedEmpEnNo}`,
      `Date: ${normDate}`,
      ``,
      `Biometric punches: ${punches.length}${punches.length > 0 ? ` (${punches.map((p) => p.time).join(', ')})` : ''}`,
      `Holiday record: ${holidayRecord ? `true (${holidayRecord.name})` : 'false'}`,
      `Approved leave record: ${leaveRecord ? `true (${leaveRecord.leaveType})` : 'false'}`,
      leaveRecord ? `Leave status: APPROVED` : null,
      ``,
      `Calculated status: ${evaluationTrace.status}`,
      `Rule Applied: ${evaluationTrace.rule}`,
      ``,
      `--- Expected Working Days & Percentage Formula ---`,
      `Eligible Working Days: ${empSummary?.eligibleWorkingDays ?? 'N/A'}`,
      `Approved Leave Days: ${empSummary?.approvedLeaveDays ?? (leaveRecord ? 1 : 0)}`,
      `Expected Working Days = Eligible - Approved Leave = ${empSummary?.expectedAttendanceDays ?? 'N/A'}`,
      `Present Days: ${empSummary?.presentDays ?? 0}`,
      `Absent Days: ${empSummary?.absentDays ?? 0}`,
      `Attendance %: ${empSummary?.attendancePercentage ?? 0}% (Formula: Present ÷ Expected Working Days × 100)`,
      `Absence %: ${empSummary?.absencePercentage ?? 0}% (Formula: Absent ÷ Expected Working Days × 100)`,
      empSummary && empSummary.presentDays + empSummary.absentDays === empSummary.expectedAttendanceDays
        ? `Sum: ${empSummary.attendancePercentage}% + ${empSummary.absencePercentage}% = 100% ✓`
        : null,
    ]
      .filter((x) => x !== null)
      .join('\n');
  }, [
    currentEmp.name,
    paddedEmpEnNo,
    normDate,
    punches,
    holidayRecord,
    leaveRecord,
    evaluationTrace,
    empSummary,
  ]);

  // Log to console on changes for dev verification
  useEffect(() => {
    console.info(`[Attendance Engine Inspector]\n${debugTextBlock}`);
  }, [debugTextBlock]);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(debugTextBlock);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`rounded-2xl border border-sky-500/30 bg-sky-950/10 dark:bg-sky-950/20 backdrop-blur-md p-4 transition-all shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-sky-500/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-500">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                Attendance & Leave Engine Inspector
              </span>
              <Badge variant="info">Developer Audit Mode</Badge>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Live deterministic verification of biometric punches, holidays, leaves, and calculated daily status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopy}
            leftIcon={copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            {copied ? 'Copied Trace' : 'Copy Debug Trace'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded((v) => !v)}
            className="text-neutral-500"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-4 pt-3">
          {/* Selectors Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Select Employee (EnNo)
              </label>
              <select
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                className="w-full text-xs font-mono px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                Select Date
              </label>
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full text-xs font-mono px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
              >
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedDate('2026-08-25')}
                className={`text-[11px] font-mono px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  selectedDate === '2026-08-25'
                    ? 'bg-amber-500 text-white border-amber-600'
                    : 'bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/10 hover:bg-neutral-200'
                }`}
              >
                25 Aug (Holiday Test)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate('2026-08-26')}
                className={`text-[11px] font-mono px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  selectedDate === '2026-08-26'
                    ? 'bg-sky-500 text-white border-sky-600'
                    : 'bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/10 hover:bg-neutral-200'
                }`}
              >
                26 Aug (Leave Test)
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate('2026-08-27')}
                className={`text-[11px] font-mono px-2 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  selectedDate === '2026-08-27'
                    ? 'bg-rose-500 text-white border-rose-600'
                    : 'bg-neutral-100 dark:bg-white/5 border-neutral-200 dark:border-white/10 hover:bg-neutral-200'
                }`}
              >
                27 Aug (Absent Test)
              </button>
            </div>
          </div>

          {/* Formatted Console-Style Box */}
          <div className="relative rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950 p-4 font-mono text-xs text-neutral-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-800 text-[11px] text-neutral-400">
              <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Deterministic Audit: {currentEmp.name} ({paddedEmpEnNo}) on {normDate}
              </span>
              <span className="text-neutral-500">Source: Database & Calculations Engine</span>
            </div>

            <pre className="whitespace-pre-wrap leading-relaxed select-all font-mono text-[12px] text-neutral-300">
              {debugTextBlock}
            </pre>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200/80 dark:border-white/5">
              <span className="text-[10px] text-neutral-400 block font-medium">Calculated Status</span>
              <span className="font-bold text-sm text-sky-600 dark:text-sky-400">
                {evaluationTrace.status}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200/80 dark:border-white/5">
              <span className="text-[10px] text-neutral-400 block font-medium">Biometric Punches</span>
              <span className="font-bold text-sm text-neutral-800 dark:text-neutral-200">
                {punches.length} punch(es)
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200/80 dark:border-white/5">
              <span className="text-[10px] text-neutral-400 block font-medium">Holiday Match</span>
              <span className="font-bold text-sm text-amber-500">
                {holidayRecord ? holidayRecord.name : 'None'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200/80 dark:border-white/5">
              <span className="text-[10px] text-neutral-400 block font-medium">Approved Leave</span>
              <span className="font-bold text-sm text-sky-500">
                {leaveRecord ? `${leaveRecord.leaveType} (Approved)` : 'None'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
