import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldCheck,
  AlertTriangle,
  History,
  FileEdit,
  CheckCircle2,
  Calendar,
  Lock,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { AttendanceDay, AttendanceStatus } from '../../types/attendance';
import { DbAttendanceOverride } from '../../types/database';
import { DatabaseService } from '../../services/database';

export interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceDay | null;
  onSaveCorrection?: (params: {
    recordId: string;
    employeeId: string;
    date: string;
    newInTime: string;
    newOutTime: string;
    newStatus: AttendanceStatus;
    reason: string;
  }) => Promise<void>;
  onSave?: (params: any) => Promise<void>;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  record,
  onSaveCorrection,
  onSave,
}) => {
  const [inTime, setInTime] = useState('');
  const [outTime, setOutTime] = useState('');
  const [status, setStatus] = useState<AttendanceStatus>('PRESENT');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [auditLogs, setAuditLogs] = useState<DbAttendanceOverride[]>([]);
  const [activeTab, setActiveTab] = useState<'edit' | 'audit'>('edit');

  useEffect(() => {
    if (record) {
      setInTime(record.firstPunchIn || '');
      setOutTime(record.lastPunchOut || '');
      setStatus(record.status);
      setReason('');

      // Load audit logs for this record
      DatabaseService.getOverridesForDay(record.id).then((logs) => {
        setAuditLogs(logs);
      });
    }
  }, [record]);

  if (!record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      alert('A supervisory audit reason is required for any manual attendance correction.');
      return;
    }

    try {
      setIsSubmitting(true);
      const saveFn = onSaveCorrection || onSave;
      if (saveFn) {
        await saveFn({
          recordId: record.id,
          employeeId: record.employeeId,
          date: record.date,
          newInTime: inTime.trim(),
          newOutTime: outTime.trim(),
          newStatus: status,
          reason: reason.trim(),
        });
      }
      onClose();
    } catch (err: any) {
      alert(`Correction failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Manual Attendance Correction — ${record.employeeName}`}
      size="lg"
    >
      <div className="space-y-5">
        {/* Compliance Header Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-amber-900 dark:text-amber-200 block mb-0.5">
              Auditable Non-Destructive Override
            </span>
            <p className="text-amber-800/80 dark:text-amber-300/80">
              Original hardware punches remain untouched. All changes are logged into a permanent audit trail with timestamp, supervisor signature, and justification reason.
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-white/10 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium cursor-pointer transition-colors ${
              activeTab === 'edit'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Correction Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors ${
              activeTab === 'audit'
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History ({auditLogs.length})</span>
          </button>
        </div>

        {activeTab === 'edit' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Record Metadata summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/50 dark:border-white/5 text-xs">
              <div>
                <span className="text-neutral-400 block text-[10px]">Date</span>
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                  {record.date}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">EnNo / ID</span>
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                  {record.employeeId}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Original Punches</span>
                <span className="font-mono font-medium text-neutral-900 dark:text-neutral-100">
                  {record.punchCount} punches
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Current Status</span>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">
                  {record.status}
                </span>
              </div>
            </div>

            {/* Editable Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
                  Adjust First Punch IN
                </label>
                <input
                  type="time"
                  step="1"
                  value={inTime}
                  onChange={(e) => setInTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 focus:outline-hidden"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Original: {record.firstPunchIn || 'None'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
                  Adjust Last Punch OUT
                </label>
                <input
                  type="time"
                  step="1"
                  value={outTime}
                  onChange={(e) => setOutTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 focus:outline-hidden"
                />
                <span className="text-[10px] text-neutral-400 mt-1 block">
                  Original: {record.lastPunchOut || 'None'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
                Attendance Status Classification
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AttendanceStatus)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100"
              >
                <option value="PRESENT">Present (Normal Working Day)</option>
                <option value="APPROVED_LEAVE">Approved Leave</option>
                <option value="ABSENT">Absent (Unexcused)</option>
                <option value="SINGLE_PUNCH">Single Punch Exception</option>
                <option value="OUT_PENDING">Out Pending</option>
                <option value="HOLIDAY">Holiday</option>
                <option value="SUNDAY">Sunday</option>
                <option value="NEEDS_REVIEW">Needs Review</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-1.5">
                Audit Reason & Supervisor Notes (Required)
              </label>
              <textarea
                rows={3}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Employee punch sensor failed at exit gate. Verified via site supervisor register."
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-neutral-200 dark:border-white/5">
              <span className="text-[11px] text-neutral-400">
                Logged by: <span className="font-semibold text-neutral-700 dark:text-neutral-300">Admin</span>
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting || !reason.trim()}
                  className="text-xs"
                >
                  {isSubmitting ? 'Recording Audit...' : 'Apply Correction'}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 text-neutral-400 text-xs">
                No manual corrections have been recorded for this date. The record is in its native biometric machine state.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl border border-neutral-200 dark:border-white/10 bg-white dark:bg-white/[0.02] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        Adjusted field: <code className="font-mono text-sky-500">{log.field_name}</code>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        {new Date(log.changed_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px]">
                      <span className="line-through text-red-500">{log.original_value || 'empty'}</span>
                      <span className="text-neutral-400">➔</span>
                      <span className="font-bold text-emerald-500">{log.new_value}</span>
                    </div>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-300 italic">
                      "{log.reason}" — <span className="font-medium">{log.updated_by}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3">
              <Button variant="outline" size="sm" onClick={() => setActiveTab('edit')} className="text-xs">
                Back to Edit
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
