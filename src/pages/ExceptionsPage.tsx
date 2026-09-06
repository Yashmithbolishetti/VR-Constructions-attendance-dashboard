import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Clock,
  LogIn,
  LogOut,
  Calendar,
  Layers,
  CheckCircle2,
  Sliders,
  Eye,
  Info,
  ShieldAlert,
  ArrowRight,
  ShieldCheck,
  UserX,
  FileCheck2,
  RotateCcw,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { FilterBar } from '../components/common/FilterBar';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { DataTable, Column } from '../components/common/DataTable';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { useApp } from '../context/AppContext';
import { AttendanceException, ExceptionCategory } from '../types/attendance';

export const ExceptionsPage: React.FC = () => {
  const {
    setCurrentPage,
    calculatedData,
    parsedDataset,
    setSelectedEmployeeIdForProfile,
    activeExceptionCategory,
    setActiveExceptionCategory,
    resolveException,
    unresolveException,
  } = useApp();

  const [selectedExceptionForAudit, setSelectedExceptionForAudit] =
    useState<AttendanceException | null>(null);
  const [resolutionModalException, setResolutionModalException] =
    useState<AttendanceException | null>(null);
  const [resolutionNote, setResolutionNote] = useState<string>('');

  const exceptionsList = calculatedData?.exceptions || [];

  // Also include duplicate punches detected during parsing
  const combinedExceptions = useMemo(() => {
    const list: AttendanceException[] = [...exceptionsList];

    if (parsedDataset?.duplicatePunches) {
      parsedDataset.duplicatePunches.forEach((dup) => {
        list.push({
          id: `dup-${dup.id}`,
          category: 'DUPLICATE',
          severity: 'low',
          employeeId: dup.enNo,
          employeeName: dup.employeeName,
          date: dup.originalDateTime.split(' ')[0],
          title: 'Rapid Bounce Punch',
          description: `Duplicate punch within 60s at ${dup.originalDateTime.split(' ')[1]}. Automatically deduplicated from calculation.`,
        });
      });
    }

    return list;
  }, [exceptionsList, parsedDataset]);

  // Counts for each operational category
  const singlePunchCount = useMemo(
    () => combinedExceptions.filter((e) => e.category === 'SINGLE_PUNCH' && !e.isResolved).length,
    [combinedExceptions]
  );
  const outPendingCount = useMemo(
    () => combinedExceptions.filter((e) => e.category === 'OUT_PENDING' && !e.isResolved).length,
    [combinedExceptions]
  );
  const lateArrivalCount = useMemo(
    () => combinedExceptions.filter((e) => e.category === 'LATE_ARRIVAL' && !e.isResolved).length,
    [combinedExceptions]
  );
  const earlyDepartureCount = useMemo(
    () => combinedExceptions.filter((e) => e.category === 'EARLY_DEPARTURE' && !e.isResolved).length,
    [combinedExceptions]
  );
  const absentCount = useMemo(
    () => combinedExceptions.filter((e) => e.category === 'ABSENT' && !e.isResolved).length,
    [combinedExceptions]
  );
  const resolvedCount = useMemo(
    () => combinedExceptions.filter((e) => e.isResolved).length,
    [combinedExceptions]
  );

  const categories = [
    { id: 'all', label: `All Active (${combinedExceptions.filter((e) => !e.isResolved).length})` },
    { id: 'SINGLE_PUNCH', label: `Single Punch (${singlePunchCount})` },
    { id: 'OUT_PENDING', label: `Checkout Pending (${outPendingCount})` },
    { id: 'ABSENT', label: `Unnotified Absence (${absentCount})` },
    { id: 'LATE_ARRIVAL', label: `Late Arrival (${lateArrivalCount})` },
    { id: 'EARLY_DEPARTURE', label: `Early Departure (${earlyDepartureCount})` },
    { id: 'resolved', label: `Resolved (${resolvedCount})` },
  ];

  const filteredExceptions = useMemo(() => {
    if (activeExceptionCategory === 'resolved') {
      return combinedExceptions.filter((e) => e.isResolved);
    }
    if (activeExceptionCategory === 'all') {
      return combinedExceptions.filter((e) => !e.isResolved);
    }
    return combinedExceptions.filter(
      (e) => e.category === activeExceptionCategory && !e.isResolved
    );
  }, [combinedExceptions, activeExceptionCategory]);

  const renderSeverityBadge = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'high':
        return <Badge variant="error">High Priority</Badge>;
      case 'medium':
        return <Badge variant="warning">Attention</Badge>;
      case 'low':
        return <Badge variant="neutral">Informational</Badge>;
    }
  };

  const handleOpenResolutionModal = (exc: AttendanceException) => {
    setResolutionModalException(exc);
    setResolutionNote(exc.resolutionNote || 'Employee forgot to punch out');
  };

  const handleConfirmResolution = async () => {
    if (!resolutionModalException) return;
    await resolveException(resolutionModalException.id, resolutionNote);
    setResolutionModalException(null);
    if (selectedExceptionForAudit?.id === resolutionModalException.id) {
      setSelectedExceptionForAudit(null);
    }
  };

  const handleReopen = async (exc: AttendanceException) => {
    await unresolveException(exc.id);
    if (selectedExceptionForAudit?.id === exc.id) {
      setSelectedExceptionForAudit(null);
    }
  };

  const quickResolutions = [
    'Employee forgot to punch out',
    'Permitted site/client duty',
    'Supervisor verified full shift',
    'Approved half-day shift',
    'Punch machine biometric error',
  ];

  const columns: Column<AttendanceException>[] = [
    {
      key: 'date',
      header: 'Date',
      width: '100px',
      render: (item) => (
        <span className="font-mono text-xs text-neutral-600 dark:text-neutral-400">
          {item.date}
        </span>
      ),
    },
    {
      key: 'employee',
      header: 'Employee (EnNo)',
      render: (item) => (
        <div
          className="cursor-pointer group inline-flex items-center gap-2"
          onClick={() => {
            setSelectedEmployeeIdForProfile(item.employeeId);
            setCurrentPage('employees');
          }}
          title="Click to view full employee attendance profile"
        >
          <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 group-hover:underline">
            {item.employeeName}
          </span>
          <span className="font-mono text-[11px] text-neutral-400 bg-neutral-100 dark:bg-white/5 px-1.5 py-0.5 rounded">
            {item.employeeId}
          </span>
          <ExternalLink className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      width: '140px',
      render: (item) => {
        let label = item.title || item.category;
        if (item.category === 'SINGLE_PUNCH') label = 'Single Punch';
        else if (item.category === 'OUT_PENDING') label = 'Checkout Pending';
        else if (item.category === 'LATE_ARRIVAL') label = 'Late Arrival';
        else if (item.category === 'EARLY_DEPARTURE') label = 'Early Departure';
        else if (item.category === 'ABSENT') label = 'Unnotified Absence';
        else if (item.category === 'DUPLICATE') label = 'Rapid Bounce';

        return (
          <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
            {label}
          </span>
        );
      },
    },
    {
      key: 'description',
      header: 'Reason / Detection Detail',
      render: (item) => (
        <div className="space-y-1">
          <span className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed block max-w-md">
            {item.description}
          </span>
          {item.isResolved && item.resolutionNote && (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/10 inline-block">
              Resolved: {item.resolutionNote}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'severity',
      header: 'Priority',
      align: 'right',
      width: '110px',
      render: (item) => (
        <div className="flex flex-col items-end gap-1">
          {renderSeverityBadge(item.severity)}
          {item.isResolved && <Badge variant="success">Resolved</Badge>}
        </div>
      ),
    },
    {
      key: 'action',
      header: 'Actions',
      align: 'right',
      width: '140px',
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedExceptionForAudit(item)}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-2 py-1"
            title="Inspect Details"
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            Inspect
          </Button>

          {item.isResolved ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReopen(item)}
              className="text-xs text-neutral-500 hover:text-neutral-900 px-2 py-1"
              title="Reopen Exception"
            >
              <RotateCcw className="w-3 h-3" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenResolutionModal(item)}
              className="text-xs text-emerald-600 hover:bg-emerald-500/10 px-2 py-1 border-emerald-500/30"
              title="Resolve Exception"
            >
              Resolve
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader
        title="Exception Resolution Center"
        subtitle="Operational management workspace for missing checkouts, single punches, late arrivals, and absence verifications."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage('overview')}
              className="text-xs"
            >
              Back to Overview
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setCurrentPage('upload')}
              className="text-xs"
            >
              Configure Shift Rules
            </Button>
          </div>
        }
      />

      {/* Top Operational Category Cards (Requirement #16) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {/* Single Punch */}
        <GlassCard
          variant="solid"
          padding="sm"
          className={`cursor-pointer transition-all ${
            activeExceptionCategory === 'SINGLE_PUNCH'
              ? 'ring-2 ring-amber-500 border-amber-500/50'
              : 'hover:border-neutral-300 dark:hover:border-white/20'
          }`}
          onClick={() => setActiveExceptionCategory('SINGLE_PUNCH')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <LogIn className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-sm font-bold text-amber-600">{singlePunchCount}</span>
          </div>
          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Single Punch</h4>
          <p className="text-[10px] text-neutral-400">Missing IN or OUT</p>
        </GlassCard>

        {/* Out Pending */}
        <GlassCard
          variant="solid"
          padding="sm"
          className={`cursor-pointer transition-all ${
            activeExceptionCategory === 'OUT_PENDING'
              ? 'ring-2 ring-sky-500 border-sky-500/50'
              : 'hover:border-neutral-300 dark:hover:border-white/20'
          }`}
          onClick={() => setActiveExceptionCategory('OUT_PENDING')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
              <LogOut className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-sm font-bold text-sky-600">{outPendingCount}</span>
          </div>
          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Out Pending</h4>
          <p className="text-[10px] text-neutral-400">Active today shift</p>
        </GlassCard>

        {/* Unnotified Absence */}
        <GlassCard
          variant="solid"
          padding="sm"
          className={`cursor-pointer transition-all ${
            activeExceptionCategory === 'ABSENT'
              ? 'ring-2 ring-rose-500 border-rose-500/50'
              : 'hover:border-neutral-300 dark:hover:border-white/20'
          }`}
          onClick={() => setActiveExceptionCategory('ABSENT')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
              <UserX className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-sm font-bold text-rose-600">{absentCount}</span>
          </div>
          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Absences</h4>
          <p className="text-[10px] text-neutral-400">0 punches recorded</p>
        </GlassCard>

        {/* Late Arrival */}
        <GlassCard
          variant="solid"
          padding="sm"
          className={`cursor-pointer transition-all ${
            activeExceptionCategory === 'LATE_ARRIVAL'
              ? 'ring-2 ring-orange-500 border-orange-500/50'
              : 'hover:border-neutral-300 dark:hover:border-white/20'
          }`}
          onClick={() => setActiveExceptionCategory('LATE_ARRIVAL')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="p-1.5 rounded-lg bg-orange-500/10 text-orange-500">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-sm font-bold text-orange-600">{lateArrivalCount}</span>
          </div>
          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Late Arrivals</h4>
          <p className="text-[10px] text-neutral-400">&gt; 10:15 AM</p>
        </GlassCard>

        {/* Early Departure */}
        <GlassCard
          variant="solid"
          padding="sm"
          className={`cursor-pointer transition-all ${
            activeExceptionCategory === 'EARLY_DEPARTURE'
              ? 'ring-2 ring-purple-500 border-purple-500/50'
              : 'hover:border-neutral-300 dark:hover:border-white/20'
          }`}
          onClick={() => setActiveExceptionCategory('EARLY_DEPARTURE')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500">
              <LogOut className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-sm font-bold text-purple-600">{earlyDepartureCount}</span>
          </div>
          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Early Departures</h4>
          <p className="text-[10px] text-neutral-400">&lt; 06:00 PM</p>
        </GlassCard>

        {/* Resolved Exceptions */}
        <GlassCard
          variant="solid"
          padding="sm"
          className={`cursor-pointer transition-all ${
            activeExceptionCategory === 'resolved'
              ? 'ring-2 ring-emerald-500 border-emerald-500/50'
              : 'hover:border-neutral-300 dark:hover:border-white/20'
          }`}
          onClick={() => setActiveExceptionCategory('resolved')}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-sm font-bold text-emerald-600">{resolvedCount}</span>
          </div>
          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Resolved</h4>
          <p className="text-[10px] text-neutral-400">Audited with notes</p>
        </GlassCard>
      </div>

      {/* Category Filter Chips */}
      <FilterBar
        filters={categories}
        activeFilterId={activeExceptionCategory}
        onSelectFilter={setActiveExceptionCategory}
        onClearFilters={() => setActiveExceptionCategory('all')}
        hasActiveFilters={activeExceptionCategory !== 'all'}
      />

      {/* Exceptions Table */}
      <DataTable<AttendanceException>
        columns={columns}
        data={filteredExceptions}
        keyExtractor={(item) => item.id}
        emptyTitle={
          calculatedData ? 'No matching exceptions found' : 'No biometric data loaded'
        }
        emptyDescription={
          calculatedData
            ? 'All attendance records for this filter comply with VR Constructions shift rules.'
            : 'Upload your biometric machine file to discover single punches, missing checkouts, and unnotified absences automatically.'
        }
        emptyActionLabel={calculatedData ? undefined : 'Upload Biometric File'}
        onEmptyAction={calculatedData ? undefined : () => setCurrentPage('upload')}
      />

      {/* Detail Audit & Trace Modal (Requirement #18) */}
      {selectedExceptionForAudit && (
        <Modal
          isOpen={!!selectedExceptionForAudit}
          onClose={() => setSelectedExceptionForAudit(null)}
          title={`Exception Detail — ${selectedExceptionForAudit.employeeName}`}
          size="md"
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-neutral-100 dark:bg-white/5 space-y-2 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200/60 dark:border-white/5">
                <span className="text-neutral-500">Employee:</span>
                <span className="font-bold text-neutral-900 dark:text-neutral-100">
                  {selectedExceptionForAudit.employeeName} (EnNo: {selectedExceptionForAudit.employeeId})
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200/60 dark:border-white/5">
                <span className="text-neutral-500">Attendance Date:</span>
                <span className="font-mono text-neutral-900 dark:text-neutral-100">
                  {selectedExceptionForAudit.date}
                </span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-neutral-200/60 dark:border-white/5">
                <span className="text-neutral-500">Exception Category:</span>
                <span className="font-semibold text-amber-500">
                  {selectedExceptionForAudit.title || selectedExceptionForAudit.category}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Engine Priority:</span>
                <span>{renderSeverityBadge(selectedExceptionForAudit.severity)}</span>
              </div>
            </div>

            {/* Explanation */}
            <div className="p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs space-y-1">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100 block">
                Rule Explanation:
              </span>
              <p className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
                {selectedExceptionForAudit.description}
              </p>
            </div>

            {/* Relevant Raw Biometric Punches if available */}
            {selectedExceptionForAudit.punches && selectedExceptionForAudit.punches.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  Relevant Biometric Punches (Raw Source Trace):
                </span>
                <div className="divide-y divide-neutral-100 dark:divide-white/5 rounded-xl border border-neutral-200/60 dark:border-white/5 overflow-hidden">
                  {selectedExceptionForAudit.punches.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-neutral-50 dark:bg-white/[0.02] flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-neutral-400">Punch #{idx + 1}</span>
                        <span className="font-bold text-neutral-900 dark:text-neutral-100">
                          {p.time}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400">
                        Row #{p.sourceRowIndex} • Machine {p.machineNumber} • Mode {p.mode}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Status if present */}
            {selectedExceptionForAudit.isResolved && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300 space-y-1">
                <span className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Resolved Status
                </span>
                <p className="text-[11px]">Note: {selectedExceptionForAudit.resolutionNote}</p>
                {selectedExceptionForAudit.resolvedAt && (
                  <p className="text-[10px] text-neutral-400 font-mono">
                    Resolved at: {selectedExceptionForAudit.resolvedAt}
                  </p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-white/5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedEmployeeIdForProfile(selectedExceptionForAudit.employeeId);
                  setCurrentPage('employees');
                }}
                className="text-xs"
              >
                Open Employee Profile
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedExceptionForAudit(null)}
                  className="text-xs"
                >
                  Close
                </Button>

                {selectedExceptionForAudit.isResolved ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReopen(selectedExceptionForAudit)}
                    className="text-xs"
                  >
                    Reopen
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      handleOpenResolutionModal(selectedExceptionForAudit);
                    }}
                    className="text-xs"
                  >
                    Resolve Exception
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Resolution Note Modal (Requirement #19) */}
      {resolutionModalException && (
        <Modal
          isOpen={!!resolutionModalException}
          onClose={() => setResolutionModalException(null)}
          title={`Resolve Exception — ${resolutionModalException.employeeName}`}
          size="sm"
        >
          <div className="space-y-4 text-xs">
            <p className="text-neutral-500">
              Provide an audit note to resolve this exception. The original raw biometric punches remain completely untouched.
            </p>

            <div className="p-2.5 rounded-xl bg-neutral-100 dark:bg-white/5 text-[11px] font-mono text-neutral-600 dark:text-neutral-300">
              {resolutionModalException.title || resolutionModalException.category} on{' '}
              {resolutionModalException.date}
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-neutral-700 dark:text-neutral-300 block">
                Resolution Note:
              </label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={3}
                placeholder="e.g. Employee forgot to punch out; supervisor verified complete shift."
                className="w-full p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-300 dark:border-white/10 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-sky-500 text-xs resize-none"
              />
            </div>

            {/* Quick pre-set chips */}
            <div className="space-y-1">
              <span className="text-[10px] text-neutral-400 font-medium">Quick suggestions:</span>
              <div className="flex flex-wrap gap-1.5">
                {quickResolutions.map((txt) => (
                  <button
                    key={txt}
                    type="button"
                    onClick={() => setResolutionNote(txt)}
                    className="text-[10px] px-2 py-1 rounded-lg bg-neutral-100 dark:bg-white/5 hover:bg-neutral-200 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-300 transition-colors"
                  >
                    {txt}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-white/5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResolutionModalException(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmResolution}
                className="text-xs"
              >
                Confirm Resolution
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </PageContainer>
  );
};
