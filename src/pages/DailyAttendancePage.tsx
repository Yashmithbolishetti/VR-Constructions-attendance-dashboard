import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sliders,
  Eye,
  Clock,
  LogIn,
  LogOut,
  AlertTriangle,
  FileText,
  CheckCircle2,
  HelpCircle,
  Edit3,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { SearchInput } from '../components/common/SearchInput';
import { FilterBar } from '../components/common/FilterBar';
import { DatePicker } from '../components/common/DatePicker';
import { DataTable, Column } from '../components/common/DataTable';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { MonthSelector } from '../components/common/MonthSelector';
import { useApp } from '../context/AppContext';
import { AttendanceDay, AttendanceStatus, RawBiometricPunch } from '../types/attendance';
import { AttendanceCorrectionModal } from '../components/attendance/AttendanceCorrectionModal';

export const DailyAttendancePage: React.FC = () => {
  const {
    setCurrentPage,
    calculatedData,
    previewSkeletonMode,
    setPreviewSkeletonMode,
    setSelectedEmployeeIdForProfile,
    applyAttendanceCorrection,
    dailyAttendanceDate,
    setDailyAttendanceDate,
    dailyAttendanceStatusFilter,
    setDailyAttendanceStatusFilter,
    setActiveMonthKey,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');

  // Modal for raw punch inspection / traceability
  const [selectedRecordForAudit, setSelectedRecordForAudit] = useState<AttendanceDay | null>(null);

  // Modal for manual attendance correction with full audit logging
  const [selectedRecordForCorrection, setSelectedRecordForCorrection] = useState<AttendanceDay | null>(null);

  // Distinct dates in dataset with records
  const availableDates = React.useMemo(() => {
    if (!calculatedData) return [];
    const set = new Set<string>();
    calculatedData.dailyRecords.forEach((r) => set.add(r.date));
    return Array.from(set).sort();
  }, [calculatedData]);

  // If dailyAttendanceDate is set to a date that does not exist in availableDates, auto-reset to show all dates
  useEffect(() => {
    if (dailyAttendanceDate && availableDates.length > 0 && !availableDates.includes(dailyAttendanceDate)) {
      setDailyAttendanceDate('');
    }
  }, [dailyAttendanceDate, availableDates, setDailyAttendanceDate]);

  const statusFilters = [
    { id: 'all', label: 'All Punches' },
    { id: 'PRESENT', label: 'Present' },
    { id: 'late', label: 'Late Mark' },
    { id: 'SINGLE_PUNCH', label: 'Single Punch' },
    { id: 'OUT_PENDING', label: 'Out Pending' },
    { id: 'ABSENT', label: 'Absent' },
    { id: 'APPROVED_LEAVE', label: 'Leave' },
    { id: 'SUNDAY', label: 'Sunday' },
    { id: 'HOLIDAY', label: 'Holiday' },
  ];

  // Filter records
  const filteredData = React.useMemo(() => {
    if (!calculatedData) return [];

    return calculatedData.dailyRecords.filter((item) => {
      // Date filter
      if (dailyAttendanceDate && item.date !== dailyAttendanceDate) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.employeeName.toLowerCase().includes(q);
        const matchesId = item.employeeId.toLowerCase().includes(q);
        if (!matchesName && !matchesId) return false;
      }

      // Status filter
      if (dailyAttendanceStatusFilter === 'late') {
        return item.isLateArrival;
      } else if (dailyAttendanceStatusFilter !== 'all') {
        return item.status === dailyAttendanceStatusFilter;
      }

      return true;
    });
  }, [calculatedData, dailyAttendanceDate, searchQuery, dailyAttendanceStatusFilter]);

  const renderStatusBadge = (status: AttendanceStatus, item: AttendanceDay) => {
    switch (status) {
      case 'PRESENT':
        return (
          <div className="flex flex-col items-end gap-0.5">
            <Badge variant="success" dot>
              Present
            </Badge>
            {item.isLateArrival && (
              <span className="text-[10px] font-mono text-amber-500 font-semibold">
                Late (+{item.lateMinutes}m)
              </span>
            )}
            {item.isEarlyDeparture && (
              <span className="text-[10px] font-mono text-orange-400">
                Early (-{item.earlyMinutes}m)
              </span>
            )}
          </div>
        );
      case 'APPROVED_LEAVE':
        if (item.punchCount > 0) {
          return (
            <div className="flex flex-col items-end gap-0.5">
              <Badge variant="info">Approved Leave</Badge>
              <span className="text-[10px] font-mono text-sky-500 font-semibold">
                Worked on Leave
              </span>
            </div>
          );
        }
        return <Badge variant="info">Approved Leave</Badge>;
      case 'HOLIDAY':
        if (item.punchCount > 0) {
          return (
            <div className="flex flex-col items-end gap-0.5">
              <Badge variant="warning">Holiday + Attendance</Badge>
              <span className="text-[10px] font-mono text-amber-500 font-semibold">
                Worked on Holiday
              </span>
            </div>
          );
        }
        return <Badge variant="warning">Holiday</Badge>;
      case 'SUNDAY':
        if (item.punchCount > 0) {
          return (
            <div className="flex flex-col items-end gap-0.5">
              <Badge variant="neutral">Sunday + Attendance</Badge>
              <span className="text-[10px] font-mono text-purple-400 font-semibold">
                Worked on Sunday
              </span>
            </div>
          );
        }
        return <Badge variant="neutral">Sunday</Badge>;
      case 'SINGLE_PUNCH':
        return <Badge variant="warning">Single Punch</Badge>;
      case 'OUT_PENDING':
        return <Badge variant="info">Out Pending</Badge>;
      case 'ABSENT':
        return <Badge variant="error">Absent</Badge>;
      case 'NEEDS_REVIEW':
        return <Badge variant="warning">Needs Review</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const columns: Column<AttendanceDay>[] = [
    {
      key: 'date',
      header: 'Date',
      width: '105px',
      render: (item) => <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400 font-semibold">{item.date}</span>,
    },
    {
      key: 'employee',
      header: 'Employee',
      render: (item) => (
        <div
          className="cursor-pointer group"
          onClick={() => {
            setSelectedEmployeeIdForProfile(item.employeeId);
            setCurrentPage('employees');
          }}
        >
          <span className="font-medium text-xs text-neutral-900 dark:text-neutral-100 group-hover:underline">
            {item.employeeName}
          </span>
        </div>
      ),
    },
    {
      key: 'enNo',
      header: 'EnNo',
      width: '110px',
      render: (item) => (
        <span className="font-mono text-xs text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-white/5 px-2 py-0.5 rounded border border-neutral-200 dark:border-white/5">
          {item.employeeId}
        </span>
      ),
    },
    {
      key: 'firstPunchIn',
      header: 'IN Time',
      align: 'center',
      render: (item) => (
        <span
          className={`font-mono text-xs ${
            item.firstPunchIn
              ? item.isLateArrival
                ? 'text-amber-500 font-semibold'
                : 'text-emerald-600 dark:text-emerald-400'
              : 'text-neutral-400'
          }`}
        >
          {item.firstPunchIn || '—'}
        </span>
      ),
    },
    {
      key: 'lastPunchOut',
      header: 'OUT Time',
      align: 'center',
      render: (item) => (
        <span
          className={`font-mono text-xs ${
            item.lastPunchOut
              ? item.isEarlyDeparture
                ? 'text-orange-400 font-semibold'
                : 'text-sky-600 dark:text-sky-400'
              : 'text-neutral-400'
          }`}
        >
          {item.lastPunchOut || '—'}
        </span>
      ),
    },
    {
      key: 'grossHours',
      header: 'Gross Hours',
      align: 'center',
      render: (item) => (
        <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
          {item.grossMinutes > 0
            ? `${Math.floor(item.grossMinutes / 60)}h ${(item.grossMinutes % 60).toString().padStart(2, '0')}m`
            : '—'}
        </span>
      ),
    },
    {
      key: 'netHours',
      header: 'Net Hours',
      align: 'center',
      render: (item) => (
        <span
          className={`font-mono text-xs font-bold ${
            item.netHours >= 8
              ? 'text-emerald-600 dark:text-emerald-400'
              : item.netHours > 0
              ? 'text-neutral-800 dark:text-neutral-200'
              : 'text-neutral-400'
          }`}
        >
          {item.netMinutes > 0
            ? `${Math.floor(item.netMinutes / 60)}h ${(item.netMinutes % 60).toString().padStart(2, '0')}m`
            : '—'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (item) => renderStatusBadge(item.status, item),
    },
    {
      key: 'late',
      header: 'Late',
      align: 'center',
      render: (item) => (
        item.isLateArrival ? (
          <span className="text-xs font-mono font-semibold text-amber-500">
            +{item.lateMinutes}m
          </span>
        ) : (
          <span className="text-xs text-neutral-400 font-mono">—</span>
        )
      ),
    },
    {
      key: 'earlyDeparture',
      header: 'Early Departure',
      align: 'center',
      render: (item) => (
        item.isEarlyDeparture ? (
          <span className="text-xs font-mono font-semibold text-orange-400">
            -{item.earlyMinutes}m
          </span>
        ) : (
          <span className="text-xs text-neutral-400 font-mono">—</span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      width: '90px',
      render: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRecordForAudit(item)}
            className="text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white p-1"
            title="Inspect Raw Biometric Machine Punches"
          >
            <Eye className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedRecordForCorrection(item)}
            className="text-xs text-neutral-400 hover:text-sky-500 p-1"
            title="Manual Attendance Correction (Audit Trail)"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  // Quick summary counts for the period
  const summaryCounts = React.useMemo(() => {
    if (!calculatedData) return { total: 0, present: 0, late: 0, early: 0, single: 0, leave: 0, absent: 0 };
    const list = calculatedData.dailyRecords;
    return {
      total: list.length,
      present: list.filter((r) => r.status === 'PRESENT').length,
      late: list.filter((r) => r.isLateArrival).length,
      early: list.filter((r) => r.isEarlyDeparture).length,
      single: list.filter((r) => r.status === 'SINGLE_PUNCH' || r.status === 'OUT_PENDING').length,
      leave: list.filter((r) => r.status === 'APPROVED_LEAVE').length,
      absent: list.filter((r) => r.status === 'ABSENT').length,
    };
  }, [calculatedData]);

  return (
    <PageContainer>
      <PageHeader
        title="Daily Attendance Log"
        subtitle="Auditable daily punch pairing, deterministic lunch deductions, and shift compliance."
        actions={
          <div className="flex items-center gap-2.5">
            <MonthSelector />
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Sliders className="w-4 h-4" />}
              onClick={() => setPreviewSkeletonMode((v) => !v)}
              className="text-xs"
            >
              {previewSkeletonMode ? 'Show Real Data' : 'Preview Table Skeleton'}
            </Button>
            {availableDates.length > 0 && (
              <select
                value={dailyAttendanceDate || ''}
                onChange={(e) => setDailyAttendanceDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono cursor-pointer"
              >
                <option value="">All Dates in Analysis Period ({availableDates.length} days)</option>
                {availableDates.map((d) => (
                  <option key={d} value={d}>
                    {d} {d === calculatedData?.reportDate ? '(Report Date)' : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
        }
      />

      {calculatedData?.dateRangeFormatted && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 -mt-3 mb-1">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200/60 dark:border-white/5">
            <Calendar className="w-3.5 h-3.5 text-sky-500" />
            <span>Analysis Range: <strong className="text-neutral-900 dark:text-neutral-100">{calculatedData.dateRangeFormatted}</strong></span>
          </span>
          {calculatedData.employeeCountDiscrepancy && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Master Headcount: {calculatedData.knownEmployeesCount} known vs {calculatedData.configuredEmployeeCount} configured</span>
            </span>
          )}
        </div>
      )}

      {calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0) && (
        <div
          id="no-daily-attendance-alert"
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
            <strong>{calculatedData.datasetDateRangeFormatted || 'the uploaded period'}</strong>. No fake attendance logs are created.
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

      {/* Quick Stat Highlights */}
      {calculatedData && summaryCounts.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
          <button
            type="button"
            onClick={() => setDailyAttendanceStatusFilter('all')}
            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
              dailyAttendanceStatusFilter === 'all'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-sm'
                : 'bg-neutral-100 dark:bg-white/[0.03] border-neutral-200/60 dark:border-white/5 hover:border-neutral-300'
            }`}
          >
            <span className="text-[10px] opacity-70 block">Total Logs</span>
            <span className="text-sm font-bold font-mono">{summaryCounts.total}</span>
          </button>
          <button
            type="button"
            onClick={() => setDailyAttendanceStatusFilter('PRESENT')}
            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
              dailyAttendanceStatusFilter === 'PRESENT'
                ? 'bg-emerald-600 text-white border-transparent shadow-sm'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20'
            }`}
          >
            <span className="text-[10px] opacity-80 block">Present</span>
            <span className="text-sm font-bold font-mono">{summaryCounts.present}</span>
          </button>
          <button
            type="button"
            onClick={() => setDailyAttendanceStatusFilter('late')}
            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
              dailyAttendanceStatusFilter === 'late'
                ? 'bg-amber-500 text-white border-transparent shadow-sm'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20'
            }`}
          >
            <span className="text-[10px] opacity-80 block">Late Arrivals</span>
            <span className="text-sm font-bold font-mono">{summaryCounts.late}</span>
          </button>
          <button
            type="button"
            onClick={() => setDailyAttendanceStatusFilter('SINGLE_PUNCH')}
            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
              dailyAttendanceStatusFilter === 'SINGLE_PUNCH'
                ? 'bg-purple-600 text-white border-transparent shadow-sm'
                : 'bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-400 hover:bg-purple-500/20'
            }`}
          >
            <span className="text-[10px] opacity-80 block">Single Punch</span>
            <span className="text-sm font-bold font-mono">{summaryCounts.single}</span>
          </button>
          <button
            type="button"
            onClick={() => setDailyAttendanceStatusFilter('ABSENT')}
            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
              dailyAttendanceStatusFilter === 'ABSENT'
                ? 'bg-rose-600 text-white border-transparent shadow-sm'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 hover:bg-rose-500/20'
            }`}
          >
            <span className="text-[10px] opacity-80 block">Absent</span>
            <span className="text-sm font-bold font-mono">{summaryCounts.absent}</span>
          </button>
          <button
            type="button"
            onClick={() => setDailyAttendanceStatusFilter('APPROVED_LEAVE')}
            className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
              dailyAttendanceStatusFilter === 'APPROVED_LEAVE'
                ? 'bg-sky-600 text-white border-transparent shadow-sm'
                : 'bg-sky-500/10 border-sky-500/20 text-sky-700 dark:text-sky-400 hover:bg-sky-500/20'
            }`}
          >
            <span className="text-[10px] opacity-80 block">Leave</span>
            <span className="text-sm font-bold font-mono">{summaryCounts.leave}</span>
          </button>
        </div>
      )}

      {/* Filter Bar with Search, Status, and Clear controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="w-full md:w-80">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search employee name or EnNo..."
          />
        </div>

        <FilterBar
          filters={statusFilters}
          activeFilterId={dailyAttendanceStatusFilter}
          onSelectFilter={setDailyAttendanceStatusFilter}
          onClearFilters={() => {
            setDailyAttendanceStatusFilter('all');
            setSearchQuery('');
            setDailyAttendanceDate('');
          }}
          hasActiveFilters={
            dailyAttendanceStatusFilter !== 'all' ||
            searchQuery.length > 0 ||
            dailyAttendanceDate !== ''
          }
        />
      </div>

      {/* Table with Polished Empty State or Skeleton Preview */}
      <DataTable<AttendanceDay>
        columns={columns}
        data={filteredData}
        keyExtractor={(item) => item.id}
        isLoading={previewSkeletonMode}
        emptyTitle={
          calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0)
            ? `No attendance data available for ${calculatedData.monthLabel}`
            : calculatedData
            ? 'No matching daily records found'
            : 'No daily attendance calculated'
        }
        emptyDescription={
          calculatedData && (calculatedData.hasImportedData === false || calculatedData.calendarDaysCount === 0)
            ? `The uploaded biometric dataset contains records covering ${calculatedData.datasetDateRangeFormatted || 'the imported dates'}. Select another month or view Overall.`
            : calculatedData
            ? 'Adjust your search query or status filter to view attendance records.'
            : 'Upload your biometric machine export to pair timestamps, calculate 1-hour lunch deductions, and review daily attendance logs.'
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

      {/* Raw Biometric Punch Audit Modal */}
      {selectedRecordForAudit && (
        <Modal
          isOpen={!!selectedRecordForAudit}
          onClose={() => setSelectedRecordForAudit(null)}
          title={`Biometric Audit Trace — ${selectedRecordForAudit.employeeName}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Record Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-2xl bg-neutral-100/60 dark:bg-white/5 text-xs">
              <div>
                <span className="text-[10px] text-neutral-400 block">Enrollment Number</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedRecordForAudit.employeeId}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block">Attendance Date</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedRecordForAudit.date}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block">Derived Status</span>
                <span className="font-bold text-sky-500">{selectedRecordForAudit.status}</span>
              </div>
              <div>
                <span className="text-[10px] text-neutral-400 block">Net Hours</span>
                <span className="font-mono font-bold text-emerald-500">
                  {selectedRecordForAudit.netMinutes > 0
                    ? `${Math.floor(selectedRecordForAudit.netMinutes / 60)}h ${selectedRecordForAudit.netMinutes % 60}m`
                    : '0h 00m'}
                </span>
              </div>
            </div>

            {/* Arithmetic Audit Formula */}
            <div className="p-3.5 rounded-2xl bg-sky-500/5 border border-sky-500/10 text-xs space-y-1">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                Deterministic Calculation Breakdown:
              </span>
              {selectedRecordForAudit.punchCount >= 2 ? (
                <p className="text-neutral-600 dark:text-neutral-300 font-mono text-[11px] leading-relaxed">
                  First Punch IN: {selectedRecordForAudit.firstPunchIn} | Last Punch OUT:{' '}
                  {selectedRecordForAudit.lastPunchOut}
                  <br />
                  Gross Duration: {selectedRecordForAudit.grossMinutes} mins ({selectedRecordForAudit.grossHours}h)
                  <br />
                  Lunch Deduction: -{selectedRecordForAudit.lunchDeductionMinutes} mins (1.0h)
                  <br />
                  Net Calculated Shift: {selectedRecordForAudit.netMinutes} mins ({selectedRecordForAudit.netHours}h)
                </p>
              ) : selectedRecordForAudit.punchCount === 1 ? (
                <p className="text-amber-600 dark:text-amber-400 text-[11px]">
                  Only 1 valid punch recorded on this date. Incomplete record; working hours cannot be
                  computed without pairing.
                </p>
              ) : (
                <p className="text-neutral-500 text-[11px]">
                  Zero biometric machine punch activity logged for this date.
                </p>
              )}
            </div>

            {/* Raw Biometric File Lines */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 block">
                Source Biometric Machine Lines ({selectedRecordForAudit.rawPunches.length} raw punches preserved)
              </span>

              {selectedRecordForAudit.rawPunches.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-neutral-200 dark:border-white/10 text-center text-xs text-neutral-400">
                  No punch records in file for this employee on this date.
                </div>
              ) : (
                <div className="rounded-2xl bg-neutral-900 text-neutral-200 p-3 font-mono text-[11px] space-y-2 overflow-x-auto border border-white/5">
                  <div className="text-neutral-500 pb-1 border-b border-white/10 text-[10px]">
                    Row # | Machine | EnNo | Mode | IOMd | Timestamp | Classification
                  </div>
                  {selectedRecordForAudit.rawPunches.map((p, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === selectedRecordForAudit.rawPunches.length - 1 && selectedRecordForAudit.rawPunches.length > 1;
                    return (
                      <div key={p.id} className="flex gap-3 py-1 hover:text-white">
                        <span className="text-neutral-500 w-10">#{p.sourceRowNumber}</span>
                        <span className="text-neutral-400 w-12">Mchn-{p.machineNumber}</span>
                        <span className="text-sky-400 font-bold w-12">{p.enNo}</span>
                        <span className="text-neutral-400 w-8">M:{p.mode}</span>
                        <span className="text-emerald-400 w-36">{p.originalDateTime}</span>
                        <span className="font-bold text-amber-400">
                          {isFirst ? '→ FIRST VALID (IN)' : isLast ? '→ LAST VALID (OUT)' : '• INTERMEDIATE PUNCH'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Edit3 className="w-3.5 h-3.5 text-sky-500" />}
                onClick={() => {
                  const r = selectedRecordForAudit;
                  setSelectedRecordForAudit(null);
                  setSelectedRecordForCorrection(r);
                }}
                className="text-xs"
              >
                Correct / Override Record
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRecordForAudit(null)}
                className="text-xs"
              >
                Close Traceability Audit
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Manual Attendance Correction Modal (Requirement #14 & #15) */}
      {selectedRecordForCorrection && (
        <AttendanceCorrectionModal
          isOpen={!!selectedRecordForCorrection}
          onClose={() => setSelectedRecordForCorrection(null)}
          record={selectedRecordForCorrection}
          onSave={async (correction) => {
            await applyAttendanceCorrection(correction);
            setSelectedRecordForCorrection(null);
          }}
        />
      )}
    </PageContainer>
  );
};
