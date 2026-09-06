import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Calendar,
  UserX,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  CalendarDays,
  Activity,
  Layers,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { Badge } from '../components/common/Badge';
import { MonthSelector } from '../components/common/MonthSelector';
import { useApp } from '../context/AppContext';
import {
  getAbsenceAndLeaveAnalysis,
  getPunctualityAnalysis,
  getEarlyDepartureAnalysis,
  getWorkingHourDistribution,
  getDailyAttendanceTrend,
  getWorkingHoursTrendByDate,
  getMonthToMonthComparison,
} from '../services/intelligenceService';

export const AnalyticsPage: React.FC = () => {
  const {
    setCurrentPage,
    calculatedData,
    previousMonthData,
    setSelectedEmployeeIdForProfile,
    navigateToExceptions,
    navigateToEmployees,
    setActiveMonthKey,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'trends' | 'hours' | 'compare-emp' | 'compare-month'>('trends');

  // Employee comparison selections
  const employees = calculatedData?.employeeSummaries || [];
  const [emp1Id, setEmp1Id] = useState<string>(() => employees[0]?.employeeId || '');
  const [emp2Id, setEmp2Id] = useState<string>(() => employees[1]?.employeeId || '');

  const hasData = !!calculatedData && calculatedData.hasImportedData !== false && calculatedData.calendarDaysCount > 0;
  const isMonthWithNoData = !!calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0);

  // Intelligence calculations
  const dailyTrends = useMemo(() => {
    return calculatedData ? getDailyAttendanceTrend(calculatedData) : [];
  }, [calculatedData]);

  const dailyHoursTrend = useMemo(() => {
    return calculatedData ? getWorkingHoursTrendByDate(calculatedData) : [];
  }, [calculatedData]);

  const workingHourDist = useMemo(() => {
    return calculatedData ? getWorkingHourDistribution(calculatedData) : [];
  }, [calculatedData]);

  const punctualityStats = useMemo(() => {
    return calculatedData ? getPunctualityAnalysis(calculatedData) : null;
  }, [calculatedData]);

  const absenceStats = useMemo(() => {
    return calculatedData ? getAbsenceAndLeaveAnalysis(calculatedData) : null;
  }, [calculatedData]);

  const earlyDepartureStats = useMemo(() => {
    return calculatedData ? getEarlyDepartureAnalysis(calculatedData) : null;
  }, [calculatedData]);

  const monthComparison = useMemo(() => {
    return calculatedData ? getMonthToMonthComparison(calculatedData, previousMonthData) : null;
  }, [calculatedData, previousMonthData]);

  // Selected employees for side-by-side comparison
  const emp1 = employees.find((e) => e.employeeId === emp1Id) || employees[0];
  const emp2 = employees.find((e) => e.employeeId === emp2Id) || employees[1];

  return (
    <PageContainer>
      <PageHeader
        title="Workforce Intelligence & Analytics"
        subtitle="In-depth analytical insights into daily attendance trajectories, working-hour distributions, employee comparisons, and historical performance."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <MonthSelector />
            <Button
              id="btn-goto-reports"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage('reports')}
              className="text-xs"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
              Report Center
            </Button>
          </div>
        }
      />

      {/* Analytics View Selector Tabs */}
      <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-white/10 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('trends')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'trends'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Attendance Trends</span>
        </button>

        <button
          onClick={() => setActiveTab('hours')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'hours'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Working Hours & Shifts</span>
        </button>

        <button
          onClick={() => setActiveTab('compare-emp')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'compare-emp'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>Employee Comparison</span>
        </button>

        <button
          onClick={() => setActiveTab('compare-month')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'compare-month'
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-white/5'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Month-to-Month Analysis</span>
        </button>
      </div>

      {!hasData ? (
        isMonthWithNoData && calculatedData ? (
          <div
            id="no-analytics-data-alert"
            className="p-8 rounded-3xl bg-neutral-100/70 dark:bg-white/5 border border-neutral-200/80 dark:border-white/10 text-center max-w-xl mx-auto my-6 space-y-3"
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900 dark:text-white">
              No attendance data available for {calculatedData.monthLabel}.
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
              The imported biometric dataset contains records covering{' '}
              <strong className="text-neutral-900 dark:text-neutral-200">
                {calculatedData.datasetDateRangeFormatted || 'the uploaded period'}
              </strong>
              . Select a month with imported attendance records or view the Overall dataset.
            </p>
            <div className="pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveMonthKey('OVERALL')}
              >
                View Overall Dataset ({calculatedData.datasetDateRangeFormatted})
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<BarChart3 className="w-8 h-8 text-neutral-400" />}
            title="Attendance Analytics Awaiting Dataset"
            description="Upload a biometric file or load the verified dataset to examine presence curves, shift distributions, and historical comparisons."
            action={
              <Button variant="primary" size="sm" onClick={() => setCurrentPage('upload')}>
                Upload Biometric File
              </Button>
            }
          />
        )
      ) : (
        <>
          {/* TAB 1: ATTENDANCE TRENDS */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              {/* Daily Attendance Rate Trend Visualizer */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-white/5">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-sky-500" />
                      Daily Presence Trajectory
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Day-by-day employee presence percentage across {calculatedData.monthLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
                      Present Rate
                    </span>
                    <span className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                      <span className="w-2.5 h-2.5 rounded-sm bg-neutral-300 dark:bg-white/20 inline-block" />
                      Sunday / Off
                    </span>
                  </div>
                </div>

                {/* SVG Bar Visualizer */}
                <div className="space-y-2">
                  <div className="h-52 w-full flex items-end gap-1.5 pt-4 pb-2 px-2 overflow-x-auto no-scrollbar">
                    {dailyTrends.map((d) => {
                      const heightPct = d.isSunday || d.isHoliday ? 15 : Math.max(8, d.presencePercentage);
                      const isWeekend = d.isSunday;

                      return (
                        <div
                          key={d.date}
                          className="flex-1 min-w-[28px] max-w-[48px] h-full flex flex-col justify-end items-center group relative"
                        >
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                            <div className="px-2.5 py-1.5 rounded-lg bg-neutral-950 text-white text-[10px] whitespace-nowrap shadow-lg">
                              <span className="font-semibold block">{d.date} ({d.dayName})</span>
                              {d.isSunday ? (
                                <span className="text-neutral-400">Sunday</span>
                              ) : (
                                <span>
                                  {d.presentCount} present ({d.presencePercentage}%) • {d.absentCount} absent
                                </span>
                              )}
                            </div>
                            <div className="w-2 h-1 bg-neutral-950 clip-triangle" />
                          </div>

                          {/* Bar */}
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t-md transition-all duration-300 ${
                              isWeekend
                                ? 'bg-neutral-200 dark:bg-white/10'
                                : d.presencePercentage >= 85
                                ? 'bg-emerald-500 dark:bg-emerald-500/90 group-hover:bg-emerald-400'
                                : d.presencePercentage >= 70
                                ? 'bg-sky-500 group-hover:bg-sky-400'
                                : 'bg-amber-500 group-hover:bg-amber-400'
                            }`}
                          />

                          {/* Date Tick */}
                          <div className="mt-2 text-center">
                            <span className="text-[10px] font-mono font-medium text-neutral-500 dark:text-neutral-400 block">
                              {d.dayNumber}
                            </span>
                            <span className="text-[8px] text-neutral-400 uppercase block">
                              {d.dayName.slice(0, 1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-white/5">
                    <span>Company Average: <strong>{calculatedData.kpis.avgAttendancePct}%</strong></span>
                    <span>Total Working Days Evaluated: <strong>{calculatedData.expectedWorkingDays}</strong></span>
                  </div>
                </div>
              </GlassCard>

              {/* Grid: Punctuality & Absence Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Punctuality Card */}
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Arrival Timing & Punctuality
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-neutral-400">Grace: 10:15 AM</span>
                  </div>

                  {punctualityStats && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                          <span className="text-[11px] text-neutral-500">Punctual Arrival Rate</span>
                          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                            {punctualityStats.onTimePercentage}%
                          </div>
                          <span className="text-[10px] text-neutral-400">On or before 10:15 AM</span>
                        </div>

                        <div className="p-3 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                          <span className="text-[11px] text-neutral-500">Late Arrivals Count</span>
                          <div className="text-xl font-bold font-mono text-orange-600 dark:text-orange-400 mt-1">
                            {punctualityStats.totalLateArrivals}
                          </div>
                          <span className="text-[10px] text-neutral-400">Past grace threshold</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                          Most Frequent Late Arrivals:
                        </span>
                        <div className="divide-y divide-neutral-100 dark:divide-white/5">
                          {punctualityStats.topLateEmployees.slice(0, 4).map((emp) => (
                            <div
                              key={emp.employeeId}
                              onClick={() => {
                                setSelectedEmployeeIdForProfile(emp.employeeId);
                                setCurrentPage('employees');
                              }}
                              className="py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] px-2 rounded-xl cursor-pointer transition-colors text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                                  {emp.employeeId}
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                  {emp.employeeName}
                                </span>
                              </div>
                              <span className="font-bold font-mono text-orange-600 dark:text-orange-400">
                                {emp.lateCount} times
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 text-right">
                        <button
                          onClick={() => navigateToExceptions('LATE_ARRIVAL')}
                          className="text-xs text-neutral-700 dark:text-neutral-300 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                        >
                          View Late Exceptions <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </GlassCard>

                {/* Absence Analysis Card */}
                <GlassCard className="p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <UserX className="w-4 h-4 text-rose-500" />
                      <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Absences & Leaves
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-neutral-400">Expected: {calculatedData.expectedWorkingDays}d</span>
                  </div>

                  {absenceStats && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                          <span className="text-[11px] text-neutral-500">Unnotified Absences</span>
                          <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                            {absenceStats.totalAbsences}
                          </div>
                          <span className="text-[10px] text-neutral-400">0 punches recorded</span>
                        </div>

                        <div className="p-3 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                          <span className="text-[11px] text-neutral-500">Approved Leave Days</span>
                          <div className="text-xl font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">
                            {absenceStats.totalLeaves}
                          </div>
                          <span className="text-[10px] text-neutral-400">Permitted via register</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                          Personnel with Highest Absences:
                        </span>
                        <div className="divide-y divide-neutral-100 dark:divide-white/5">
                          {absenceStats.topAbsentEmployees.slice(0, 4).map((emp) => (
                            <div
                              key={emp.employeeId}
                              onClick={() => {
                                setSelectedEmployeeIdForProfile(emp.employeeId);
                                setCurrentPage('employees');
                              }}
                              className="py-2 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] px-2 rounded-xl cursor-pointer transition-colors text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[10px] text-neutral-400 bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
                                  {emp.employeeId}
                                </span>
                                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                                  {emp.employeeName}
                                </span>
                              </div>
                              <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                                {emp.absentDays} days ({emp.attendancePercentage}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pt-2 text-right">
                        <button
                          onClick={() => navigateToEmployees('has-absent')}
                          className="text-xs text-neutral-700 dark:text-neutral-300 hover:underline inline-flex items-center gap-1 font-medium cursor-pointer"
                        >
                          Filter Absent Personnel <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>
            </div>
          )}

          {/* TAB 2: WORKING HOURS & SHIFTS */}
          {activeTab === 'hours' && (
            <div className="space-y-6">
              {/* Daily Average Net Shift Hours Trend */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-100 dark:border-white/5">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-500" />
                      Daily Average Net Shift Hours
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Average net hours logged across all complete shifts (1h lunch automatically deducted)
                    </p>
                  </div>
                  <div className="text-xs font-mono text-neutral-400">
                    Standard Target: <strong>7.0h Net</strong> (8.0h Gross - 1.0h Lunch)
                  </div>
                </div>

                {/* Bar chart of daily net shift hours */}
                <div className="space-y-2">
                  <div className="h-52 w-full flex items-end gap-1.5 pt-4 pb-2 px-2 overflow-x-auto no-scrollbar">
                    {dailyHoursTrend.map((d) => {
                      const maxNet = 10; // scale up to 10h
                      const heightPct = d.isSunday ? 0 : Math.min(100, (d.averageNetHours / maxNet) * 100);

                      return (
                        <div
                          key={d.date}
                          className="flex-1 min-w-[28px] max-w-[48px] h-full flex flex-col justify-end items-center group relative"
                        >
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                            <div className="px-2.5 py-1.5 rounded-lg bg-neutral-950 text-white text-[10px] whitespace-nowrap shadow-lg">
                              <span className="font-semibold block">{d.date} ({d.dayName})</span>
                              {d.isSunday ? (
                                <span className="text-neutral-400">Sunday</span>
                              ) : (
                                <span>
                                  Avg Net: {d.averageNetHours}h • {d.completeRecordsCount} complete shifts
                                </span>
                              )}
                            </div>
                            <div className="w-2 h-1 bg-neutral-950 clip-triangle" />
                          </div>

                          {/* Bar */}
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-t-md transition-all duration-300 ${
                              d.isSunday
                                ? 'bg-transparent'
                                : d.averageNetHours >= 7.0
                                ? 'bg-emerald-500 dark:bg-emerald-500/90 group-hover:bg-emerald-400'
                                : d.averageNetHours >= 6.0
                                ? 'bg-sky-500 group-hover:bg-sky-400'
                                : 'bg-amber-500 group-hover:bg-amber-400'
                            }`}
                          />

                          {/* Date Tick */}
                          <div className="mt-2 text-center">
                            <span className="text-[10px] font-mono font-medium text-neutral-500 dark:text-neutral-400 block">
                              {d.dayNumber}
                            </span>
                            <span className="text-[8px] text-neutral-400 uppercase block">
                              {d.averageNetHours > 0 ? `${d.averageNetHours}h` : '-'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-white/5">
                    <span>Company Net Shift Average: <strong>{calculatedData.kpis.avgNetHours} hours</strong></span>
                    <span className="text-neutral-400">Note: Incomplete shifts are strictly excluded from zero-hour skewing</span>
                  </div>
                </div>
              </GlassCard>

              {/* Working Hour Distribution Module */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-white/5">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white">
                      Shift Length Distribution
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-neutral-400">Net Shift Hours</span>
                </div>

                <div className="space-y-4">
                  <p className="text-xs text-neutral-500">
                    Distribution of all completed paired shifts in {calculatedData.monthLabel}. Standard office shift is 10:00 AM — 06:00 PM with 1.0h lunch deduction.
                  </p>

                  <div className="space-y-3">
                    {workingHourDist.map((item) => {
                      let barColor = 'bg-sky-500';
                      if (item.category === 'OVERTIME') barColor = 'bg-indigo-500';
                      if (item.category === 'STANDARD') barColor = 'bg-emerald-500';
                      if (item.category === 'HALF_DAY') barColor = 'bg-amber-500';
                      if (item.category === 'UNDER_HOURS') barColor = 'bg-rose-500';

                      return (
                        <div key={item.category} className="space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="font-medium text-neutral-800 dark:text-neutral-200">
                              {item.label}
                            </span>
                            <span className="font-mono text-neutral-500">
                              <strong>{item.count}</strong> shifts ({item.percentage}%)
                            </span>
                          </div>
                          <div className="h-2.5 w-full bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.max(2, item.percentage)}%` }}
                              className={`h-full rounded-full ${barColor} transition-all`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* TAB 3: EMPLOYEE COMPARISON */}
          {activeTab === 'compare-emp' && (
            <div className="space-y-6">
              <GlassCard className="p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-100 dark:border-white/5">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                      <Scale className="w-4 h-4 text-sky-500" />
                      Factual Employee Attendance Comparison
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Compare two employees side-by-side across key biometric metrics in {calculatedData.monthLabel}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400 font-mono">Neutral & Objective Records</span>
                </div>

                {/* Dropdowns to select both employees */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/5 space-y-2">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                      Employee A
                    </label>
                    <select
                      value={emp1Id || ''}
                      onChange={(e) => setEmp1Id(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white"
                    >
                      {employees.map((e) => (
                        <option key={e.employeeId} value={e.employeeId} className="dark:bg-neutral-900">
                          {e.employeeName} (EnNo: {e.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/5 space-y-2">
                    <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 block">
                      Employee B
                    </label>
                    <select
                      value={emp2Id || ''}
                      onChange={(e) => setEmp2Id(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white"
                    >
                      {employees.map((e) => (
                        <option key={e.employeeId} value={e.employeeId} className="dark:bg-neutral-900">
                          {e.employeeName} (EnNo: {e.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Comparison Matrix Table */}
                {emp1 && emp2 && (
                  <div className="rounded-xl border border-neutral-200 dark:border-white/10 overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-neutral-50 dark:bg-white/[0.02] border-b border-neutral-200 dark:border-white/10">
                        <tr>
                          <th className="p-3.5 font-semibold text-neutral-500 dark:text-neutral-400">Metric</th>
                          <th className="p-3.5 font-semibold text-neutral-900 dark:text-white">{emp1.employeeName}</th>
                          <th className="p-3.5 font-semibold text-neutral-900 dark:text-white">{emp2.employeeName}</th>
                          <th className="p-3.5 font-semibold text-neutral-500 dark:text-neutral-400">Company Benchmark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100 dark:divide-white/5 font-mono">
                        <tr>
                          <td className="p-3.5 font-sans font-medium text-neutral-700 dark:text-neutral-300">
                            Attendance Rate
                          </td>
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-white">
                            {emp1.attendancePercentage}%
                          </td>
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-white">
                            {emp2.attendancePercentage}%
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {calculatedData.kpis.avgAttendancePct}%
                          </td>
                        </tr>

                        <tr>
                          <td className="p-3.5 font-sans font-medium text-neutral-700 dark:text-neutral-300">
                            Present Days
                          </td>
                          <td className="p-3.5 text-neutral-900 dark:text-white">
                            {emp1.presentDays} / {emp1.expectedAttendanceDays}
                          </td>
                          <td className="p-3.5 text-neutral-900 dark:text-white">
                            {emp2.presentDays} / {emp2.expectedAttendanceDays}
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {calculatedData.expectedWorkingDays} expected
                          </td>
                        </tr>

                        <tr>
                          <td className="p-3.5 font-sans font-medium text-neutral-700 dark:text-neutral-300">
                            Unnotified Absences
                          </td>
                          <td className={`p-3.5 font-bold ${emp1.absentDays > 0 ? 'text-rose-500' : 'text-neutral-500'}`}>
                            {emp1.absentDays} days
                          </td>
                          <td className={`p-3.5 font-bold ${emp2.absentDays > 0 ? 'text-rose-500' : 'text-neutral-500'}`}>
                            {emp2.absentDays} days
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {calculatedData.kpis.totalAbsences} total
                          </td>
                        </tr>

                        <tr>
                          <td className="p-3.5 font-sans font-medium text-neutral-700 dark:text-neutral-300">
                            Approved Leaves
                          </td>
                          <td className="p-3.5 text-neutral-900 dark:text-white">
                            {emp1.approvedLeaveDays} days
                          </td>
                          <td className="p-3.5 text-neutral-900 dark:text-white">
                            {emp2.approvedLeaveDays} days
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {calculatedData.kpis.totalLeave} total
                          </td>
                        </tr>

                        <tr>
                          <td className="p-3.5 font-sans font-medium text-neutral-700 dark:text-neutral-300">
                            Average Net Shift
                          </td>
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-white">
                            {emp1.averageNetHours}h
                          </td>
                          <td className="p-3.5 font-bold text-neutral-900 dark:text-white">
                            {emp2.averageNetHours}h
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {calculatedData.kpis.avgNetHours}h
                          </td>
                        </tr>

                        <tr>
                          <td className="p-3.5 font-sans font-medium text-neutral-700 dark:text-neutral-300">
                            Late Arrivals (&gt; 10:15 AM)
                          </td>
                          <td className={`p-3.5 ${emp1.lateArrivalsCount > 0 ? 'text-amber-500 font-bold' : 'text-neutral-500'}`}>
                            {emp1.lateArrivalsCount}
                          </td>
                          <td className={`p-3.5 ${emp2.lateArrivalsCount > 0 ? 'text-amber-500 font-bold' : 'text-neutral-500'}`}>
                            {emp2.lateArrivalsCount}
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {calculatedData.kpis.lateArrivals} total
                          </td>
                        </tr>

                        <tr>
                          <td className="p-3.5 font-sans font-medium text-neutral-700 dark:text-neutral-300">
                            Single / Pending Punches
                          </td>
                          <td className="p-3.5 text-neutral-900 dark:text-white">
                            {emp1.singlePunchDays + emp1.outPendingDays}
                          </td>
                          <td className="p-3.5 text-neutral-900 dark:text-white">
                            {emp2.singlePunchDays + emp2.outPendingDays}
                          </td>
                          <td className="p-3.5 text-neutral-500">
                            {calculatedData.kpis.incompletePunches} total
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            </div>
          )}

          {/* TAB 4: MONTH-TO-MONTH ANALYSIS */}
          {activeTab === 'compare-month' && (
            <div className="space-y-6">
              {monthComparison ? (
                <div className="space-y-6">
                  {/* Delta KPI Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {monthComparison.metrics.map((m) => {
                      const isPositive = m.difference >= 0;
                      return (
                        <GlassCard key={m.label} className="p-4 space-y-2">
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 block truncate">
                            {m.label}
                          </span>
                          <div className="flex items-baseline justify-between">
                            <span className="text-xl font-bold font-mono text-neutral-900 dark:text-white">
                              {m.currentValue}
                              <span className="text-xs font-normal text-neutral-400 ml-1">{m.unit}</span>
                            </span>

                            <div
                              className={`flex items-center text-xs font-mono font-medium ${
                                isPositive
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />
                              )}
                              <span>
                                {isPositive ? '+' : ''}
                                {m.difference} {m.unit}
                              </span>
                            </div>
                          </div>
                          <span className="text-[10px] text-neutral-400 block">
                            vs {m.previousValue} {m.unit} in {monthComparison.previousMonthLabel}
                          </span>
                        </GlassCard>
                      );
                    })}
                  </div>

                  {/* Factual Narrative Summary */}
                  <GlassCard className="p-5 space-y-3 border-sky-500/20">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-500" />
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                        Executive Trend Narrative ({monthComparison.previousMonthLabel} → {monthComparison.currentMonthLabel})
                      </h4>
                    </div>
                    <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                      {monthComparison.narrative}
                    </p>
                  </GlassCard>
                </div>
              ) : (
                <EmptyState
                  icon={<CalendarDays className="w-8 h-8 text-neutral-400" />}
                  title="Historical Month Comparison"
                  description={`Comparing requires at least two monthly datasets. Currently, ${calculatedData.monthLabel} is loaded. Upload an additional monthly biometric export (e.g., August 2026) to activate comparative deltas.`}
                  action={
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage('upload')}>
                      Import Another Month
                    </Button>
                  }
                />
              )}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
};
