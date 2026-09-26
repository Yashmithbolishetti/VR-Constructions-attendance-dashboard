import React, { useState, useMemo } from 'react';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  UploadCloud,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Sliders,
  LogIn,
  LogOut,
  UserX,
  ChevronRight,
  ShieldCheck,
  Building2,
  CalendarDays,
  FileSpreadsheet,
  Layers,
  BarChart3,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  AreaChart,
  Area,
  CartesianGrid,
  Cell,
  Legend,
} from 'recharts';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { StatCard } from '../components/common/StatCard';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Skeleton } from '../components/common/Skeleton';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { MonthSelector } from '../components/common/MonthSelector';
import { useApp } from '../context/AppContext';
import {
  getEmployeeExtremes,
  getDailyAttendanceTrend,
  getWorkingHoursTrendByDate,
  getMonthToMonthComparison,
} from '../services/intelligenceService';
import { formatHoursMinutes } from '../services/attendanceCalculator';

export const OverviewPage: React.FC = () => {
  const {
    setCurrentPage,
    uploadedFile,
    parsedDataset,
    calculatedData,
    previousMonthData,
    loadSampleDataset,
    setSelectedEmployeeIdForProfile,
    previewSkeletonMode,
    setPreviewSkeletonMode,
    navigateToExceptions,
    navigateToEmployees,
    navigateToDailyAttendance,
    setActiveMonthKey,
  } = useApp();

  const [activeChartTab, setActiveChartTab] = useState<'attendance' | 'hours'>('attendance');

  const hasData = !!calculatedData && calculatedData.hasImportedData !== false && calculatedData.calendarDaysCount > 0;
  const isMonthWithNoData = !!calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0);
  const kpis = calculatedData?.kpis;

  // Intelligence calculations
  const extremes = useMemo(() => {
    return calculatedData ? getEmployeeExtremes(calculatedData.employeeSummaries) : null;
  }, [calculatedData]);

  const dailyTrend = useMemo(() => {
    return calculatedData ? getDailyAttendanceTrend(calculatedData) : [];
  }, [calculatedData]);

  const workingHoursTrend = useMemo(() => {
    return calculatedData ? getWorkingHoursTrendByDate(calculatedData) : [];
  }, [calculatedData]);

  const monthComparison = useMemo(() => {
    return getMonthToMonthComparison(calculatedData, previousMonthData);
  }, [calculatedData, previousMonthData]);

  // Composition metrics across all employee working day records
  const compositionStats = useMemo(() => {
    if (!calculatedData) return null;

    let presentTotal = 0;
    let leaveTotal = 0;
    let absentTotal = 0;
    let incompleteTotal = 0;

    calculatedData.dailyRecords.forEach((r) => {
      if (r.status === 'PRESENT') presentTotal++;
      else if (r.status === 'APPROVED_LEAVE') leaveTotal++;
      else if (r.status === 'ABSENT') absentTotal++;
      else if (r.status === 'SINGLE_PUNCH' || r.status === 'OUT_PENDING') incompleteTotal++;
    });

    const grandTotal = presentTotal + leaveTotal + absentTotal + incompleteTotal;
    const presentPct = grandTotal > 0 ? Math.round((presentTotal / grandTotal) * 1000) / 10 : 0;
    const leavePct = grandTotal > 0 ? Math.round((leaveTotal / grandTotal) * 1000) / 10 : 0;
    const absentPct = grandTotal > 0 ? Math.round((absentTotal / grandTotal) * 1000) / 10 : 0;
    const incompletePct = grandTotal > 0 ? Math.round((incompleteTotal / grandTotal) * 1000) / 10 : 0;

    return {
      presentTotal,
      leaveTotal,
      absentTotal,
      incompleteTotal,
      grandTotal,
      presentPct,
      leavePct,
      absentPct,
      incompletePct,
    };
  }, [calculatedData]);

  // Secondary stat calculations
  const singlePunchCount = useMemo(() => {
    return calculatedData?.employeeSummaries.reduce((acc, e) => acc + e.singlePunchDays, 0) || 0;
  }, [calculatedData]);

  const outPendingCount = useMemo(() => {
    return calculatedData?.employeeSummaries.reduce((acc, e) => acc + e.outPendingDays, 0) || 0;
  }, [calculatedData]);

  const earlyDeparturesCount = useMemo(() => {
    return calculatedData?.employeeSummaries.reduce((acc, e) => acc + e.earlyDeparturesCount, 0) || 0;
  }, [calculatedData]);

  const avgNetHoursFormatted = useMemo(() => {
    if (!kpis?.avgNetHours) return '0h 00m';
    const totalMins = Math.round(kpis.avgNetHours * 60);
    return formatHoursMinutes(totalMins);
  }, [kpis]);

  return (
    <PageContainer>
      {/* 1. MONTH CONTEXT HEADER (Requirement #3) */}
      <div className="flex flex-col gap-4 pb-2 border-b border-neutral-200/80 dark:border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              <span>VR Constructions</span>
              <span>•</span>
              <span className="text-neutral-700 dark:text-neutral-200">Attendance Overview</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Management Intelligence Dashboard
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <MonthSelector />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sliders className="w-3.5 h-3.5" />}
              onClick={() => setPreviewSkeletonMode((v) => !v)}
              className="text-xs"
            >
              {previewSkeletonMode ? 'Clean View' : 'Preview Skeletons'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
              onClick={() => setCurrentPage('upload')}
              className="text-xs"
            >
              {hasData ? 'Manage Pipeline' : 'Upload Biometric File'}
            </Button>
          </div>
        </div>

        {/* Reporting Period & Data Status Badge */}
        {hasData && (
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-neutral-500 dark:text-neutral-400 bg-neutral-50 dark:bg-white/[0.02] px-4 py-2.5 rounded-xl border border-neutral-200/60 dark:border-white/5">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
                  <CalendarDays className="w-4 h-4 text-sky-500" />
                  Analysis Period: <strong className="font-semibold text-neutral-900 dark:text-neutral-100">{calculatedData.dateRangeFormatted || `${calculatedData.startDate} — ${calculatedData.endDate}`}</strong>
                </span>
                {calculatedData.datasetDateRangeFormatted && (
                  <>
                    <span>•</span>
                    <span className="text-neutral-600 dark:text-neutral-300">
                      Biometric Dataset: <span className="font-mono">{calculatedData.datasetDateRangeFormatted}</span>
                    </span>
                  </>
                )}
                <span>•</span>
                <span className="font-mono">
                  Data Cutoff:{' '}
                  <strong className="text-neutral-900 dark:text-neutral-100 font-semibold">
                    {calculatedData.reportDate}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  Strict Dataset Bounds
                </span>
                <Badge variant="success">Verified</Badge>
              </div>
            </div>

            {calculatedData.employeeCountDiscrepancy && (
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    <strong>Headcount Discrepancy:</strong> {calculatedData.discrepancyMessage || `Employee master has ${calculatedData.knownEmployeesCount} employees but office setting specifies ${calculatedData.configuredEmployeeCount}.`}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentPage('settings')}
                  className="font-semibold underline hover:no-underline text-amber-700 dark:text-amber-300 cursor-pointer shrink-0"
                >
                  Adjust Settings
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. PRIMARY KPI CARDS (Requirement #4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Personnel"
          value={hasData ? `${kpis?.totalEmployees}` : isMonthWithNoData ? `${calculatedData?.configuredEmployeeCount || '—'}` : '—'}
          unit="Employees"
          subtext={
            hasData
              ? calculatedData.employeeCountDiscrepancy
                ? `${calculatedData.knownEmployeesCount} in master / ${calculatedData.configuredEmployeeCount} configured`
                : `Audited enrollment IDs: ${kpis?.totalEmployees}`
              : isMonthWithNoData
              ? `Master roster: ${calculatedData?.configuredEmployeeCount} employees`
              : 'Awaiting biometric import'
          }
          icon={<Users className="w-4 h-4" />}
          isLoading={previewSkeletonMode}
          emptyLabel="Awaiting biometric import"
        />

        <StatCard
          label="Working Days"
          value={hasData ? `${calculatedData.expectedWorkingDays}` : '0'}
          unit="Days"
          subtext={
            hasData
              ? `${calculatedData.dateRangeFormatted || calculatedData.monthLabel} (Excl. ${calculatedData.sundaysCount} Sundays, ${calculatedData.holidaysCount} Holidays)`
              : isMonthWithNoData
              ? 'No working days in selected range'
              : 'Configured shift days'
          }
          icon={<Calendar className="w-4 h-4" />}
          isLoading={previewSkeletonMode}
          emptyLabel="Excludes Sundays & Holidays"
        />

        <StatCard
          label="Average Attendance"
          value={hasData ? `${kpis?.avgAttendancePct}` : '—'}
          unit={hasData ? '%' : ''}
          subtext={
            hasData
              ? `Net workforce attendance consistency`
              : isMonthWithNoData
              ? `No punches in ${calculatedData.monthLabel}`
              : 'Calculated after punch pairing'
          }
          icon={<CheckCircle2 className="w-4 h-4" />}
          isLoading={previewSkeletonMode}
          emptyLabel="Calculated after punch pairing"
        />

        <StatCard
          label="Average Net Hours"
          value={hasData ? `${avgNetHoursFormatted}` : '—'}
          unit=""
          subtext={
            hasData
              ? `Strictly complete shifts (1h lunch deducted)`
              : isMonthWithNoData
              ? `No punch records to compute`
              : 'Complete shifts only'
          }
          icon={<Clock className="w-4 h-4" />}
          isLoading={previewSkeletonMode}
          emptyLabel="Complete shifts only"
        />
      </div>

      {isMonthWithNoData && (
        <div
          id="no-attendance-data-alert"
          className="p-8 rounded-3xl bg-neutral-100/70 dark:bg-white/5 border border-neutral-200/80 dark:border-white/10 text-center max-w-xl mx-auto my-6 space-y-3"
        >
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
            No attendance data available for {calculatedData.monthLabel}.
          </h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
            The imported biometric dataset contains records covering{' '}
            <strong className="text-neutral-900 dark:text-neutral-200">
              {calculatedData.datasetDateRangeFormatted || 'the uploaded period'}
            </strong>
            . The system does not mark employees absent or create fabricated dates for unimported periods.
          </p>
          <div className="pt-2">
            <button
              type="button"
              id="view-overall-dataset-btn"
              onClick={() => setActiveMonthKey('OVERALL')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors shadow-sm cursor-pointer"
            >
              View Overall Dataset ({calculatedData.datasetDateRangeFormatted})
            </button>
          </div>
        </div>
      )}

      {!hasData && !isMonthWithNoData && (
        <EmptyState
          icon={<UploadCloud className="w-8 h-8 text-amber-500" />}
          title="No Biometric Attendance Dataset Imported"
          description="Upload and confirm your biometric machine punch log (.txt, .dat, .csv) to analyze workforce metrics, review anomalies, and generate verified attendance reports."
          actionLabel="Upload Biometric File"
          onAction={() => setCurrentPage('upload')}
          secondaryActionLabel="Load Sample Biometric File"
          onSecondaryAction={loadSampleDataset}
        />
      )}

      {/* 3. SECONDARY STATISTICS BAR (Requirement #5) */}
      {hasData && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 uppercase tracking-wider px-1">
            <span>Workforce Shift Breakdown (Click to filter)</span>
            <span>Deterministic Metrics</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {/* Total Present */}
            <div
              onClick={() => navigateToDailyAttendance(undefined, 'PRESENT')}
              className="group p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all cursor-pointer select-none"
              title="Click to view daily attendance logs"
            >
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Total Present</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {compositionStats?.presentTotal}
              </div>
              <span className="text-[10px] text-neutral-400">Shift shifts completed</span>
            </div>

            {/* Approved Leave */}
            <div
              onClick={() => navigateToEmployees('has-leave')}
              className="group p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5 hover:border-sky-500/50 hover:bg-sky-500/5 transition-all cursor-pointer select-none"
              title="Click to view employees on approved leave"
            >
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Approved Leave</span>
                <CalendarDays className="w-3.5 h-3.5 text-sky-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">
                {kpis?.totalLeave}
              </div>
              <span className="text-[10px] text-neutral-400">Deducted from expected</span>
            </div>

            {/* Total Absences */}
            <div
              onClick={() => navigateToEmployees('has-absent')}
              className="group p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5 hover:border-rose-500/50 hover:bg-rose-500/5 transition-all cursor-pointer select-none"
              title="Click to view employees with unnotified absences"
            >
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Unnotified Absences</span>
                <UserX className="w-3.5 h-3.5 text-rose-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                {kpis?.totalAbsences}
              </div>
              <span className="text-[10px] text-neutral-400">Working day 0 punches</span>
            </div>

            {/* Single Punch */}
            <div
              onClick={() => navigateToExceptions('SINGLE_PUNCH')}
              className="group p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all cursor-pointer select-none"
              title="Click to view Single Punch exceptions"
            >
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Single Punch</span>
                <LogIn className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                {singlePunchCount}
              </div>
              <span className="text-[10px] text-neutral-400">Missing IN or OUT</span>
            </div>

            {/* Out Pending */}
            <div
              onClick={() => navigateToExceptions('OUT_PENDING')}
              className="group p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer select-none"
              title="Click to view active Out Pending shifts"
            >
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Out Pending</span>
                <LogOut className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                {outPendingCount}
              </div>
              <span className="text-[10px] text-neutral-400">Report date checkout</span>
            </div>

            {/* Late Arrivals */}
            <div
              onClick={() => navigateToExceptions('LATE_ARRIVAL')}
              className="group p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all cursor-pointer select-none"
              title="Click to view late arrivals"
            >
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Late Arrivals</span>
                <Clock className="w-3.5 h-3.5 text-orange-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-bold font-mono text-orange-600 dark:text-orange-400 mt-1">
                {kpis?.lateArrivals}
              </div>
              <span className="text-[10px] text-neutral-400">&gt; 10:15 AM check-in</span>
            </div>

            {/* Early Departures */}
            <div
              onClick={() => navigateToExceptions('EARLY_DEPARTURE')}
              className="group p-3 rounded-2xl bg-white dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all cursor-pointer select-none"
              title="Click to view early departures"
            >
              <div className="flex items-center justify-between text-neutral-500 text-[11px]">
                <span>Early Departures</span>
                <LogOut className="w-3.5 h-3.5 text-purple-500 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
                {earlyDeparturesCount}
              </div>
              <span className="text-[10px] text-neutral-400">&lt; 06:00 PM checkout</span>
            </div>
          </div>
        </div>
      )}

      {/* Primary Pipeline State & Upload Callout when No Data */}
      {!hasData && !previewSkeletonMode && (
        <div className="border-2 border-dashed border-neutral-300/80 dark:border-white/10 rounded-3xl p-8 sm:p-14 flex flex-col items-center justify-center bg-white/40 dark:bg-white/[0.01] text-center select-none">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-6 ring-1 ring-neutral-200 dark:ring-white/10 text-neutral-500 dark:text-[#8E9299]">
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-xl sm:text-2xl font-light text-neutral-900 dark:text-white mb-2 tracking-tight">
            No biometric data loaded
          </h3>

          <p className="text-neutral-500 dark:text-[#8E9299] text-xs sm:text-sm max-w-sm text-center leading-relaxed mb-8">
            Import your biometric machine export (TXT, CSV, or TSV) to generate deterministic management intelligence for VR Constructions.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => setCurrentPage('upload')}
              className="group flex items-center gap-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-100 dark:text-neutral-900 text-white px-6 py-3 rounded-full transition-all cursor-pointer select-none font-medium text-xs sm:text-sm"
            >
              <UploadCloud className="w-4 h-4" />
              Upload Biometric File
            </button>

            <Button
              variant="outline"
              size="md"
              leftIcon={<Sparkles className="w-4 h-4 text-sky-500" />}
              onClick={loadSampleDataset}
              className="text-xs"
            >
              Load Verified Sample Dataset
            </Button>
          </div>
        </div>
      )}

      {/* 4. ATTENDANCE OVERVIEW COMPOSITION (Requirement #6) */}
      {hasData && compositionStats && (
        <GlassCard variant="solid" padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-neutral-100 dark:border-white/5">
            <div>
              <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <Layers className="w-4 h-4 text-sky-500" />
                Workforce Shift Composition & Distribution
              </h4>
              <p className="text-xs text-neutral-500 mt-0.5">
                Distribution across all {compositionStats.grandTotal} working day attendance records this month
              </p>
            </div>
            <span className="text-xs font-mono text-neutral-400">
              Total Recorded Shifts: {compositionStats.grandTotal}
            </span>
          </div>

          {/* Stacked Proportional Bar */}
          <div className="space-y-3">
            <div className="h-4 w-full rounded-full bg-neutral-100 dark:bg-white/5 overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${compositionStats.presentPct}%` }}
                className="h-full bg-emerald-500 transition-all"
                title={`Present: ${compositionStats.presentTotal} (${compositionStats.presentPct}%)`}
              />
              <div
                style={{ width: `${compositionStats.leavePct}%` }}
                className="h-full bg-sky-500 transition-all"
                title={`Approved Leave: ${compositionStats.leaveTotal} (${compositionStats.leavePct}%)`}
              />
              <div
                style={{ width: `${compositionStats.incompletePct}%` }}
                className="h-full bg-amber-500 transition-all"
                title={`Incomplete Punches: ${compositionStats.incompleteTotal} (${compositionStats.incompletePct}%)`}
              />
              <div
                style={{ width: `${compositionStats.absentPct}%` }}
                className="h-full bg-rose-500 transition-all"
                title={`Unnotified Absences: ${compositionStats.absentTotal} (${compositionStats.absentPct}%)`}
              />
            </div>

            {/* Legend with Scannable Totals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Present
                  </div>
                  <div className="text-xs font-mono text-neutral-500">
                    {compositionStats.presentTotal} ({compositionStats.presentPct}%)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-sky-500/5 border border-sky-500/10">
                <span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Approved Leave
                  </div>
                  <div className="text-xs font-mono text-neutral-500">
                    {compositionStats.leaveTotal} ({compositionStats.leavePct}%)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Incomplete Punches
                  </div>
                  <div className="text-xs font-mono text-neutral-500">
                    {compositionStats.incompleteTotal} ({compositionStats.incompletePct}%)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-rose-500/5 border border-rose-500/10">
                <span className="w-3 h-3 rounded-full bg-rose-500 shrink-0" />
                <div>
                  <div className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    Unnotified Absent
                  </div>
                  <div className="text-xs font-mono text-neutral-500">
                    {compositionStats.absentTotal} ({compositionStats.absentPct}%)
                  </div>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* 5 & 6. ATTENDANCE TREND & WORKING HOURS TREND (Requirements #7 & #8) */}
      {hasData && (
        <GlassCard variant="solid" padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-neutral-100 dark:border-white/[0.06]">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  {activeChartTab === 'attendance'
                    ? 'Daily Attendance & Workforce Presence'
                    : 'Daily Average Net Working Hours (Complete Shifts)'}
                </h4>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                {activeChartTab === 'attendance'
                  ? 'Shows daily present count against total personnel. Sundays and company holidays highlighted.'
                  : 'Calculated strictly using complete shifts with paired punches. Incomplete records are not treated as 0.'}
              </p>
            </div>

            {/* Toggle Tabs */}
            <div className="flex items-center gap-1 bg-neutral-100 dark:bg-white/5 p-1 rounded-xl">
              <button
                onClick={() => setActiveChartTab('attendance')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeChartTab === 'attendance'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Attendance Trend
              </button>
              <button
                onClick={() => setActiveChartTab('hours')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeChartTab === 'hours'
                    ? 'bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                Working Hours Trend
              </button>
            </div>
          </div>

          {/* Recharts Chart Visualization */}
          <div className="h-64 sm:h-72 w-full pt-2">
            {activeChartTab === 'attendance' ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="dayNumber"
                    tick={{ fontSize: 11, fill: '#888888' }}
                    tickLine={false}
                    axisLine={{ opacity: 0.2 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#888888' }}
                    tickLine={false}
                    axisLine={{ opacity: 0.2 }}
                    domain={[0, calculatedData.kpis.totalEmployees + 2]}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-neutral-900 text-white text-xs rounded-xl shadow-xl border border-white/10 space-y-1">
                          <p className="font-semibold text-neutral-200">
                            {data.date} ({data.dayName})
                          </p>
                          {data.isSunday && <p className="text-amber-400">Official Sunday (Non-working day)</p>}
                          {data.isHoliday && <p className="text-sky-400">Company Holiday: {data.holidayName || 'Official'}</p>}
                          {data.isReportDate && <p className="text-sky-400">Report Date</p>}
                          <p className="text-emerald-400">Present: {data.presentCount} employees</p>
                          <p className="text-rose-400">Absent: {data.absentCount}</p>
                          <p className="text-sky-400">Approved Leave: {data.leaveCount}</p>
                          <p className="text-amber-400">Incomplete: {data.incompleteCount}</p>
                          <p className="text-neutral-400 pt-1 border-t border-white/10">
                            Presence Rate: {data.presencePercentage}%
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="presentCount" radius={[4, 4, 0, 0]}>
                    {dailyTrend.map((entry, index) => {
                      let fillColor = '#10b981'; // emerald
                      if (entry.isSunday) fillColor = '#a855f7'; // purple
                      else if (entry.isHoliday) fillColor = '#0ea5e9'; // sky
                      else if (entry.isReportDate) fillColor = '#3b82f6'; // blue
                      else if (entry.presentCount === 0) fillColor = '#e2e8f0';
                      return <Cell key={`cell-${index}`} fill={fillColor} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={workingHoursTrend} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                  <XAxis
                    dataKey="dayNumber"
                    tick={{ fontSize: 11, fill: '#888888' }}
                    tickLine={false}
                    axisLine={{ opacity: 0.2 }}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#888888' }}
                    tickLine={false}
                    axisLine={{ opacity: 0.2 }}
                    domain={[0, 10]}
                    unit="h"
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload || !payload.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 bg-neutral-900 text-white text-xs rounded-xl shadow-xl border border-white/10 space-y-1">
                          <p className="font-semibold text-neutral-200">
                            {data.date} ({data.dayName})
                          </p>
                          {data.isSunday ? (
                            <p className="text-amber-400">Sunday — Non-working day</p>
                          ) : data.completeRecordsCount > 0 ? (
                            <>
                              <p className="text-sky-400 font-bold">
                                Avg Net Working Time: {data.averageNetHours}h
                              </p>
                              <p className="text-neutral-400">
                                Complete shifts analyzed: {data.completeRecordsCount}
                              </p>
                            </>
                          ) : (
                            <p className="text-neutral-400">No complete paired shifts</p>
                          )}
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="averageNetHours"
                    stroke="#0ea5e9"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#hoursGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between text-[11px] text-neutral-400 pt-3 border-t border-neutral-100 dark:border-white/5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Standard Shift
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Sunday
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-500" /> Holiday / Report Date
              </span>
            </div>
            <button
              onClick={() => setCurrentPage('daily-attendance')}
              className="text-neutral-900 dark:text-white font-medium hover:underline flex items-center gap-1 cursor-pointer"
            >
              Open Daily Attendance Records <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </GlassCard>
      )}

      {/* 7. EMPLOYEE COMPARISON & STATISTICAL EXTREMES (Requirement #9) */}
      {hasData && extremes && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                Workforce Statistical Indicators
              </h3>
              <p className="text-xs text-neutral-500">
                Factual distribution extremes across personnel attendance consistency and shift records
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage('employees')}
              className="text-xs"
            >
              View All Employees ({calculatedData.employeeSummaries.length})
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Highest Attendance */}
            <GlassCard variant="solid" padding="sm" className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 pb-2">
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> High Attendance Consistency
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">Top Recorded</span>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-white/5">
                {extremes.highestAttendance.map((emp) => (
                  <div
                    key={emp.employeeId}
                    onClick={() => {
                      setSelectedEmployeeIdForProfile(emp.employeeId);
                      setCurrentPage('employees');
                    }}
                    className="py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] px-1 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                        {emp.employeeName}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">EnNo: {emp.employeeId}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {emp.attendancePercentage}%
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">{emp.presentDays} days</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Lowest Attendance */}
            <GlassCard variant="solid" padding="sm" className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 pb-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> Lower Attendance Rate
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">Requires Review</span>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-white/5">
                {extremes.lowestAttendance.map((emp) => (
                  <div
                    key={emp.employeeId}
                    onClick={() => {
                      setSelectedEmployeeIdForProfile(emp.employeeId);
                      setCurrentPage('employees');
                    }}
                    className="py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] px-1 rounded-lg cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                        {emp.employeeName}
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">EnNo: {emp.employeeId}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                        {emp.attendancePercentage}%
                      </div>
                      <div className="text-[10px] text-neutral-400 font-mono">{emp.presentDays} days</div>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Most Absences */}
            <GlassCard variant="solid" padding="sm" className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 pb-2">
                <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <UserX className="w-3.5 h-3.5" /> Unnotified Absence Records
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">Absences</span>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-white/5">
                {extremes.mostAbsences.length > 0 ? (
                  extremes.mostAbsences.map((emp) => (
                    <div
                      key={emp.employeeId}
                      onClick={() => {
                        setSelectedEmployeeIdForProfile(emp.employeeId);
                        setCurrentPage('employees');
                      }}
                      className="py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] px-1 rounded-lg cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                          {emp.employeeName}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">EnNo: {emp.employeeId}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-rose-600 dark:text-rose-400">
                          {emp.absentDays} days
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          {emp.attendancePercentage}% att.
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-neutral-400 py-3 text-center">Zero recorded absences</p>
                )}
              </div>
            </GlassCard>

            {/* Most Late Arrivals */}
            <GlassCard variant="solid" padding="sm" className="space-y-2.5">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 pb-2">
                <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Late Arrival Marks
                </span>
                <span className="text-[10px] text-neutral-400 font-mono">&gt; 10:15 AM</span>
              </div>
              <div className="divide-y divide-neutral-100 dark:divide-white/5">
                {extremes.mostLateArrivals.length > 0 ? (
                  extremes.mostLateArrivals.map((emp) => (
                    <div
                      key={emp.employeeId}
                      onClick={() => {
                        setSelectedEmployeeIdForProfile(emp.employeeId);
                        setCurrentPage('employees');
                      }}
                      className="py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] px-1 rounded-lg cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                          {emp.employeeName}
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">EnNo: {emp.employeeId}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-orange-600 dark:text-orange-400">
                          {emp.lateArrivalsCount} times
                        </div>
                        <div className="text-[10px] text-neutral-400 font-mono">
                          Avg {emp.averageNetHours}h
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-neutral-400 py-3 text-center">Zero late arrival marks</p>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* 8. EXCEPTIONS SUMMARY & 9. MONTH-TO-MONTH COMPARISON (Bottom Grid) */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Exceptions Center Summary Card */}
          <GlassCard variant="solid" padding="md" className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  Exception Center Summary
                </h4>
              </div>
              <Badge variant={calculatedData.exceptions.length > 0 ? 'warning' : 'success'}>
                {calculatedData.exceptions.length} Active Records
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => navigateToExceptions('SINGLE_PUNCH')}
                className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 cursor-pointer hover:bg-amber-500/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                    <LogIn className="w-3.5 h-3.5" /> Single Punch
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-600">{singlePunchCount}</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  1 punch recorded on working day. Hours not calculated.
                </p>
              </div>

              <div
                onClick={() => navigateToExceptions('OUT_PENDING')}
                className="p-3 rounded-xl bg-sky-500/5 border border-sky-500/10 cursor-pointer hover:bg-sky-500/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5" /> Checkout Pending
                  </span>
                  <span className="text-xs font-mono font-bold text-sky-600">{outPendingCount}</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Report date ({calculatedData.reportDate}) active checkout.
                </p>
              </div>

              <div
                onClick={() => navigateToExceptions('LATE_ARRIVAL')}
                className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/10 cursor-pointer hover:bg-orange-500/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Late Arrivals
                  </span>
                  <span className="text-xs font-mono font-bold text-orange-600">{kpis?.lateArrivals}</span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Arrived after official 10:15 AM threshold.
                </p>
              </div>

              <div
                onClick={() => navigateToExceptions('EARLY_DEPARTURE')}
                className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 cursor-pointer hover:bg-purple-500/10 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-1.5">
                    <LogOut className="w-3.5 h-3.5" /> Early Departures
                  </span>
                  <span className="text-xs font-mono font-bold text-purple-600">
                    {earlyDeparturesCount}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Checked out before official 06:00 PM closing.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage('exceptions')}
              className="w-full text-xs"
            >
              Open Exception Resolution Center
            </Button>
          </GlassCard>

          {/* Month-to-Month Executive Comparison (Requirement #26) */}
          <GlassCard variant="solid" padding="md" className="space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-sky-500" />
                <h4 className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
                  Month-to-Month Comparison
                </h4>
              </div>
              {monthComparison && (
                <span className="text-xs font-mono text-neutral-400">
                  {monthComparison.currentMonthLabel} vs {monthComparison.previousMonthLabel}
                </span>
              )}
            </div>

            {monthComparison ? (
              <div className="divide-y divide-neutral-100 dark:divide-white/5">
                {monthComparison.metrics.map((m) => (
                  <div key={m.label} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        {m.label}
                      </span>
                      <div className="text-[11px] text-neutral-400">
                        Prior ({monthComparison.previousMonthLabel}): {m.previousValue}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-right">
                      <span className="font-bold font-mono text-neutral-900 dark:text-neutral-100 text-sm">
                        {m.currentValue}
                      </span>
                      <span
                        className={`font-mono text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                          m.difference === 0
                            ? 'bg-neutral-100 dark:bg-white/5 text-neutral-500'
                            : m.isNeutralOrPositive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {m.difference > 0 ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : m.difference < 0 ? (
                          <ArrowDownRight className="w-3 h-3" />
                        ) : (
                          <Minus className="w-3 h-3" />
                        )}
                        {m.difference > 0 ? `+${m.difference}` : m.difference} {m.unit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-2">
                <CalendarDays className="w-8 h-8 text-neutral-400 mx-auto opacity-50" />
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  No previous month available
                </p>
                <p className="text-[11px] text-neutral-400 max-w-xs mx-auto leading-relaxed">
                  Historical comparison figures activate automatically when multiple monthly records are
                  imported into VR Constructions.
                </p>
              </div>
            )}
          </GlassCard>
        </div>
      )}
    </PageContainer>
  );
};
