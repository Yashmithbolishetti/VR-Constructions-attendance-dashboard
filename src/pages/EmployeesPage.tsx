import React, { useState } from 'react';
import {
  Users,
  Sliders,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  UserX,
  FileText,
  Briefcase,
  Bug,
  PlusCircle,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/common/SearchInput';
import { FilterBar } from '../components/common/FilterBar';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { DataTable, Column } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { MonthSelector } from '../components/common/MonthSelector';
import { BatchLeaveModal } from '../components/leave/BatchLeaveModal';
import { AttendanceDebugInspector } from '../components/attendance/AttendanceDebugInspector';
import { useApp } from '../context/AppContext';
import { EmployeeAttendanceSummary, AttendanceDay } from '../types/attendance';
import { isEnNoMatch } from '../services/attendanceCalculator';

export const EmployeesPage: React.FC = () => {
  const {
    setCurrentPage,
    calculatedData,
    selectedEmployeeIdForProfile,
    setSelectedEmployeeIdForProfile,
    previewSkeletonMode,
    setPreviewSkeletonMode,
    activeEmployeeFilter,
    setActiveEmployeeFilter,
    employeeSearchQuery,
    setEmployeeSearchQuery,
    setActiveMonthKey,
    selectedMonthKey,
    activeMonthKey,
    addBatchLeaves,
  } = useApp();

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [showGlobalInspector, setShowGlobalInspector] = useState(false);
  const [inspectDate, setInspectDate] = useState<string>('');

  const filters = [
    { id: 'all', label: 'All Personnel' },
    { id: 'high', label: 'High Attendance (≥90%)' },
    { id: 'regular', label: 'Regular (75–89%)' },
    { id: 'low', label: 'Low Attendance (<75%)' },
    { id: 'has-leave', label: 'Has Approved Leave' },
    { id: 'has-absent', label: 'Has Absence' },
  ];

  const employeesList = calculatedData?.employeeSummaries || [];

  const filteredEmployees = React.useMemo(() => {
    return employeesList.filter((emp) => {
      if (employeeSearchQuery.trim()) {
        const q = employeeSearchQuery.toLowerCase().trim();
        const matchesName = emp.employeeName.toLowerCase().includes(q);
        const matchesId =
          emp.employeeId.toLowerCase().includes(q) || isEnNoMatch(emp.employeeId, q);
        if (!matchesName && !matchesId) return false;
      }

      if (activeEmployeeFilter === 'high') {
        return emp.attendancePercentage >= 90;
      } else if (activeEmployeeFilter === 'regular') {
        return emp.attendancePercentage >= 75 && emp.attendancePercentage < 90;
      } else if (activeEmployeeFilter === 'low') {
        return emp.attendancePercentage < 75;
      } else if (activeEmployeeFilter === 'has-leave') {
        return emp.approvedLeaveDays > 0;
      } else if (activeEmployeeFilter === 'has-absent') {
        return emp.absentDays > 0;
      }

      return true;
    });
  }, [employeesList, employeeSearchQuery, activeEmployeeFilter]);

  // Selected employee profile data
  const selectedProfile = React.useMemo(() => {
    if (!selectedEmployeeIdForProfile || !calculatedData) return null;
    const summary = calculatedData.employeeSummaries.find(
      (e) =>
        e.employeeId === selectedEmployeeIdForProfile ||
        isEnNoMatch(e.employeeId, selectedEmployeeIdForProfile)
    );
    const dailyRecords = calculatedData.dailyRecords.filter(
      (d) =>
        d.employeeId === selectedEmployeeIdForProfile ||
        isEnNoMatch(d.employeeId, selectedEmployeeIdForProfile)
    );
    return { summary, dailyRecords };
  }, [selectedEmployeeIdForProfile, calculatedData]);

  const columns: Column<EmployeeAttendanceSummary>[] = [
    {
      key: 'employeeId',
      header: 'EnNo',
      width: '110px',
      render: (emp) => (
        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-neutral-100 dark:bg-white/[0.06] text-neutral-800 dark:text-neutral-200 border border-neutral-200 dark:border-white/5">
          {emp.employeeId}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Employee Name',
      render: (emp) => (
        <div
          onClick={() => setSelectedEmployeeIdForProfile(emp.employeeId)}
          className="cursor-pointer group"
        >
          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 group-hover:underline">
            {emp.employeeName}
          </span>
          <span className="block text-[11px] text-neutral-400">Site Operations</span>
        </div>
      ),
    },
    {
      key: 'attendancePercentage',
      header: 'Attendance %',
      align: 'center',
      render: (emp) => (
        <span
          className={`font-mono text-xs font-bold ${
            emp.attendancePercentage >= 90
              ? 'text-emerald-600 dark:text-emerald-400'
              : emp.attendancePercentage >= 75
              ? 'text-amber-500'
              : 'text-rose-500'
          }`}
        >
          {emp.attendancePercentage}%
        </span>
      ),
    },
    {
      key: 'absencePercentage',
      header: 'Absence %',
      align: 'center',
      render: (emp) => (
        <span
          className={`font-mono text-xs font-bold ${
            (emp.absencePercentage || 0) > 15
              ? 'text-rose-500'
              : (emp.absencePercentage || 0) > 0
              ? 'text-amber-500'
              : 'text-neutral-400'
          }`}
        >
          {emp.absencePercentage}%
        </span>
      ),
    },
    {
      key: 'presentDays',
      header: 'Present',
      align: 'center',
      render: (emp) => (
        <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {emp.presentDays}
        </span>
      ),
    },
    {
      key: 'absent',
      header: 'Absent',
      align: 'center',
      render: (emp) => (
        <span
          className={`font-mono text-xs ${
            emp.absentDays > 0 ? 'text-rose-500 font-bold' : 'text-neutral-400'
          }`}
        >
          {emp.absentDays > 0 ? emp.absentDays : '0'}
        </span>
      ),
    },
    {
      key: 'leave',
      header: 'Leave',
      align: 'center',
      render: (emp) => (
        <span className="font-mono text-xs text-sky-500">
          {emp.approvedLeaveDays > 0 ? emp.approvedLeaveDays : '0'}
        </span>
      ),
    },
    {
      key: 'singlePunch',
      header: 'Single Punch',
      align: 'center',
      render: (emp) => (
        <span
          className={`font-mono text-xs ${
            emp.singlePunchDays + emp.outPendingDays > 0 ? 'text-purple-500 font-bold' : 'text-neutral-400'
          }`}
        >
          {emp.singlePunchDays + emp.outPendingDays > 0
            ? emp.singlePunchDays + emp.outPendingDays
            : '0'}
        </span>
      ),
    },
    {
      key: 'late',
      header: 'Late',
      align: 'center',
      render: (emp) => (
        <span
          className={`font-mono text-xs ${
            (emp.lateDays || 0) > 0 ? 'text-amber-500 font-semibold' : 'text-neutral-400'
          }`}
        >
          {emp.lateDays || 0}
        </span>
      ),
    },
    {
      key: 'early',
      header: 'Early',
      align: 'center',
      render: (emp) => (
        <span
          className={`font-mono text-xs ${
            (emp.earlyDepartureDays || 0) > 0 ? 'text-orange-400 font-semibold' : 'text-neutral-400'
          }`}
        >
          {emp.earlyDepartureDays || 0}
        </span>
      ),
    },
    {
      key: 'avgHours',
      header: 'Avg Net Hours',
      align: 'right',
      render: (emp) => (
        <span className="font-mono text-xs text-neutral-700 dark:text-neutral-300 font-semibold">
          {emp.averageNetHoursFormatted || (emp.averageNetHours > 0 ? `${emp.averageNetHours}h` : '—')}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Profile',
      align: 'right',
      width: '90px',
      render: (emp) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSelectedEmployeeIdForProfile(emp.employeeId)}
          className="text-xs"
        >
          Calendar
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Employee Roster & Attendance Directory"
        subtitle="Machine-detected personnel records linked by Enrollment Number (EnNo) with individual compliance benchmarks."
        actions={
          <div className="flex items-center gap-2.5">
            <MonthSelector />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<UserCheck className="w-4 h-4 text-sky-500" />}
              onClick={() => setIsLeaveModalOpen(true)}
              className="text-xs"
            >
              Register Approved Leave
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Bug className="w-4 h-4 text-amber-500" />}
              onClick={() => setShowGlobalInspector((v) => !v)}
              className="text-xs"
            >
              {showGlobalInspector ? 'Hide Inspector' : 'Engine Inspector'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sliders className="w-4 h-4" />}
              onClick={() => setPreviewSkeletonMode((v) => !v)}
              className="text-xs"
            >
              {previewSkeletonMode ? 'Show Real Data' : 'Preview Table Skeleton'}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCurrentPage('upload')}
              className="text-xs"
            >
              Configure Data & Leaves
            </Button>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="w-full sm:w-80">
          <SearchInput
            value={employeeSearchQuery}
            onChange={setEmployeeSearchQuery}
            placeholder="Search by employee name or EnNo..."
          />
        </div>

        <FilterBar
          filters={filters}
          activeFilterId={activeEmployeeFilter}
          onSelectFilter={setActiveEmployeeFilter}
          onClearFilters={() => {
            setActiveEmployeeFilter('all');
            setEmployeeSearchQuery('');
          }}
          hasActiveFilters={activeEmployeeFilter !== 'all' || employeeSearchQuery.length > 0}
        />
      </div>

      {calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0) && (
        <div
          id="no-employee-attendance-alert"
          className="p-6 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 text-center space-y-2 mb-4"
        >
          <div className="inline-flex p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-1">
            <Calendar className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-neutral-900 dark:text-white">
            No attendance data available for {calculatedData.monthLabel}.
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
            The imported biometric dataset contains records covering{' '}
            <strong>{calculatedData.datasetDateRangeFormatted || 'the uploaded period'}</strong>. Employees are not marked absent for unimported months.
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setActiveMonthKey('OVERALL')}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 text-white hover:bg-sky-500 transition-colors shadow-xs cursor-pointer"
            >
              View Overall Dataset ({calculatedData.datasetDateRangeFormatted})
            </button>
          </div>
        </div>
      )}

      {/* Table Area */}
      <DataTable<EmployeeAttendanceSummary>
        columns={columns}
        data={filteredEmployees}
        keyExtractor={(item) => item.employeeId}
        isLoading={previewSkeletonMode}
        emptyTitle={
          calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0)
            ? `No attendance data available for ${calculatedData.monthLabel}`
            : calculatedData
            ? 'No matching personnel'
            : 'No attendance data yet'
        }
        emptyDescription={
          calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0)
            ? `Biometric records exist for ${calculatedData.datasetDateRangeFormatted || 'the imported period'}. Select another month or view Overall.`
            : calculatedData
            ? 'Try adjusting your search query or filter chips.'
            : 'Upload your biometric machine file (.txt, .csv, .tsv) to automatically detect active employees and calculate monthly attendance percentages.'
        }
        emptyActionLabel={
          calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0)
            ? 'View Overall Dataset'
            : calculatedData
            ? undefined
            : 'Upload Biometric File'
        }
        onEmptyAction={
          calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0)
            ? () => setActiveMonthKey('OVERALL')
            : calculatedData
            ? undefined
            : () => setCurrentPage('upload')
        }
      />

      {/* Employee Profile & Monthly Calendar Modal */}
      {selectedProfile && selectedProfile.summary && (
        <Modal
          isOpen={!!selectedEmployeeIdForProfile}
          onClose={() => setSelectedEmployeeIdForProfile(null)}
          title={`Employee Profile — ${selectedProfile.summary.employeeName}`}
          size="lg"
        >
          <div className="space-y-6">
            {/* Header Identity Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-neutral-100 dark:bg-white/5 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 flex items-center justify-center font-bold text-sm">
                  {selectedProfile.summary.employeeName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {selectedProfile.summary.employeeName}
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    Enrollment ID: {selectedProfile.summary.employeeId} • Site Operations
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-neutral-400 block font-medium">Monthly Attendance Rate</span>
                <span
                  className={`text-xl font-bold font-mono ${
                    selectedProfile.summary.attendancePercentage >= 90
                      ? 'text-emerald-500'
                      : selectedProfile.summary.attendancePercentage >= 75
                      ? 'text-amber-500'
                      : 'text-rose-500'
                  }`}
                >
                  {selectedProfile.summary.attendancePercentage}%
                </span>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5">
                <span className="text-[10px] text-neutral-400 block font-medium">Attendance %</span>
                <span className="text-base font-bold font-mono text-emerald-500">
                  {selectedProfile.summary.attendancePercentage}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5">
                <span className="text-[10px] text-neutral-400 block font-medium">Absence %</span>
                <span className="text-base font-bold font-mono text-rose-500">
                  {selectedProfile.summary.absencePercentage}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5">
                <span className="text-[10px] text-neutral-400 block font-medium">Present</span>
                <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {selectedProfile.summary.presentDays} days
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5">
                <span className="text-[10px] text-neutral-400 block font-medium">Absent</span>
                <span className="text-base font-bold font-mono text-rose-500">
                  {selectedProfile.summary.absentDays} days
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5">
                <span className="text-[10px] text-neutral-400 block font-medium">Leave</span>
                <span className="text-base font-bold font-mono text-sky-500">
                  {selectedProfile.summary.approvedLeaveDays} days
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5">
                <span className="text-[10px] text-neutral-400 block font-medium">Single Punch</span>
                <span className="text-base font-bold font-mono text-purple-500">
                  {selectedProfile.summary.singlePunchDays + selectedProfile.summary.outPendingDays} days
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5">
                <span className="text-[10px] text-neutral-400 block font-medium">Late Marks</span>
                <span className="text-base font-bold font-mono text-amber-500">
                  {selectedProfile.summary.lateDays || 0} days
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5">
                <span className="text-[10px] text-neutral-400 block font-medium">Early Departure</span>
                <span className="text-base font-bold font-mono text-orange-400">
                  {selectedProfile.summary.earlyDepartureDays || 0} days
                </span>
              </div>
              <div className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 sm:col-span-2">
                <span className="text-[10px] text-neutral-400 block font-medium">Avg Net Shift</span>
                <span className="text-base font-bold font-mono text-neutral-900 dark:text-neutral-100">
                  {selectedProfile.summary.averageNetHoursFormatted || `${selectedProfile.summary.averageNetHours}h / day`}
                </span>
              </div>
            </div>

            {/* Monthly Attendance Calendar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-sky-500" />
                  Monthly Calendar Overview ({calculatedData?.monthLabel})
                </span>
                <div className="flex items-center gap-2 text-[10px] text-neutral-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Present
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500" /> Leave
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Single/Holiday
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" /> Absent
                  </span>
                </div>
              </div>

              {/* Day of Week Headers + Days Grid */}
              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-mono">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-neutral-400 py-1 font-semibold">
                    {d}
                  </div>
                ))}

                {selectedProfile.dailyRecords.map((d) => {
                  const dayNum = parseInt(d.date.split('-')[2], 10);
                  const isSun = d.status === 'SUNDAY';
                  const isPres = d.status === 'PRESENT';
                  const isLeave = d.status === 'APPROVED_LEAVE';
                  const isHol = d.status === 'HOLIDAY';
                  const isSing = d.status === 'SINGLE_PUNCH' || d.status === 'OUT_PENDING';
                  const isAbs = d.status === 'ABSENT';

                  return (
                    <div
                      key={d.date}
                      title={`${d.date}: ${d.status} ${
                        d.firstPunchIn ? `(IN: ${d.firstPunchIn}, OUT: ${d.lastPunchOut || 'Pending'})` : ''
                      }`}
                      className={`p-2 rounded-xl text-center transition-all cursor-pointer border ${
                        isPres
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold'
                          : isLeave
                          ? 'bg-sky-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400 font-bold'
                          : isHol
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold'
                          : isSing
                          ? 'bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 font-bold'
                          : isAbs
                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400 font-bold'
                          : isSun
                          ? 'bg-neutral-100 dark:bg-white/[0.02] border-transparent text-neutral-400'
                          : 'bg-neutral-100 dark:bg-white/[0.02] border-transparent text-neutral-400'
                      }`}
                    >
                      <span className="block text-[11px]">{dayNum}</span>
                      <span className="text-[9px] block truncate">
                        {isPres ? `${d.netHours}h` : isLeave ? 'LV' : isHol ? 'HOL' : isSun ? 'SUN' : isAbs ? 'ABS' : 'INC'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Shift History Table */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                Recorded Attendance Shifts ({selectedProfile.dailyRecords.length} days)
              </span>
              <div className="max-h-56 overflow-y-auto divide-y divide-neutral-100 dark:divide-white/5 rounded-xl border border-neutral-200 dark:border-white/5">
                {selectedProfile.dailyRecords.map((d) => (
                  <div key={d.date} className="p-2.5 flex items-center justify-between text-xs hover:bg-neutral-50 dark:hover:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-neutral-500 w-20">{d.date}</span>
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">{d.status}</span>
                      {d.isLateArrival && (
                        <span className="text-[10px] text-amber-500 font-mono font-bold">Late (+{d.lateMinutes}m)</span>
                      )}
                    </div>
                    <div className="font-mono text-right text-neutral-500 text-[11px]">
                      {d.firstPunchIn ? `${d.firstPunchIn} → ${d.lastPunchOut || 'Pending'}` : '—'}
                      <span className="ml-3 font-bold text-neutral-800 dark:text-neutral-200">
                        {d.netMinutes > 0 ? `${Math.floor(d.netMinutes / 60)}h ${d.netMinutes % 60}m` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedEmployeeIdForProfile(null)}
                className="text-xs"
              >
                Close Profile
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
