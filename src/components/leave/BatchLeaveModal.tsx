import React, { useState, useMemo } from 'react';
import {
  Calendar,
  UserCheck,
  Search,
  Check,
  X,
  AlertCircle,
  Clock,
  Briefcase,
  Layers,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { LeaveType } from '../../types/attendance';
import { normalizeDateString, isEnNoMatch } from '../../services/attendanceCalculator';

export interface BatchLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees?: { employeeId: string; name: string }[];
  activeMonthKey?: string; // e.g. "2026-09"
  monthKey?: string;
  onSaveLeaves?: (
    records: {
      employeeId: string;
      employeeName: string;
      date: string;
      leaveType: LeaveType;
      notes?: string;
    }[]
  ) => void;
  onSaveBatch?: (
    records: {
      employeeId: string;
      employeeName: string;
      date: string;
      leaveType: LeaveType;
      notes?: string;
    }[]
  ) => void;
}

export const BatchLeaveModal: React.FC<BatchLeaveModalProps> = ({
  isOpen,
  onClose,
  employees = [],
  activeMonthKey,
  monthKey,
  onSaveLeaves,
  onSaveBatch,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL');
  const [notes, setNotes] = useState('');

  const effectiveMonthKey =
    activeMonthKey && activeMonthKey.includes('-')
      ? activeMonthKey
      : monthKey && monthKey.includes('-')
      ? monthKey
      : '2026-08';

  // Calendar dates for the active month
  const monthDates = useMemo(() => {
    if (!effectiveMonthKey || !effectiveMonthKey.includes('-')) return [];
    const [yearStr, monthStr] = effectiveMonthKey.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    const dates: { dateStr: string; dayNum: number; dayOfWeek: string; isSunday: boolean }[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      const dayNum = day;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const isSunday = dateObj.getDay() === 0;
      dates.push({ dateStr, dayNum, dayOfWeek, isSunday });
    }
    return dates;
  }, [effectiveMonthKey]);

  // Filtered employees
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const handleToggleEmployee = (id: string) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllEmployees = () => {
    if (selectedEmpIds.length === filteredEmployees.length) {
      setSelectedEmpIds([]);
    } else {
      setSelectedEmpIds(filteredEmployees.map((e) => e.employeeId));
    }
  };

  const handleToggleDate = (dateStr: string) => {
    setSelectedDates((prev) =>
      prev.includes(dateStr) ? prev.filter((d) => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmpIds.length === 0) {
      alert('Please select at least one employee.');
      return;
    }
    if (selectedDates.length === 0) {
      alert('Please select at least one leave date.');
      return;
    }

    const records: {
      employeeId: string;
      employeeName: string;
      date: string;
      leaveType: LeaveType;
      notes?: string;
    }[] = [];

    for (const empId of selectedEmpIds) {
      const emp = employees.find((x) => x.employeeId === empId || isEnNoMatch(x.employeeId, empId));
      const name = emp ? emp.name : `Employee ${empId}`;
      for (const d of selectedDates) {
        records.push({
          employeeId: empId,
          employeeName: name,
          date: normalizeDateString(d),
          leaveType,
          notes: notes.trim() || undefined,
        });
      }
    }

    if (onSaveLeaves) {
      onSaveLeaves(records);
    } else if (onSaveBatch) {
      onSaveBatch(records);
    }
    onClose();
  };

  const totalGeneratedRecords = selectedEmpIds.length * selectedDates.length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Register Approved Employee Leaves"
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-3.5 rounded-2xl bg-neutral-100/80 dark:bg-white/5 border border-neutral-200/50 dark:border-white/5 flex items-start gap-3">
          <UserCheck className="w-5 h-5 text-sky-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">
              Multi-Employee & Multi-Date Leave Assignment
            </span>
            <p className="text-neutral-500 dark:text-neutral-400">
              Select one or multiple team members and click dates on the calendar.
              Approved leaves subtract from expected working days and ensure personnel are not flagged as unnotified absentees.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Employee Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <span>1. Select Personnel</span>
                <Badge variant="neutral">
                  {selectedEmpIds.length} of {employees.length} selected
                </Badge>
              </label>
              <button
                type="button"
                onClick={handleSelectAllEmployees}
                className="text-xs text-sky-600 dark:text-sky-400 font-medium hover:underline cursor-pointer"
              >
                {selectedEmpIds.length === filteredEmployees.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or EnNo..."
                className="w-full pl-8.5 pr-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden focus:border-neutral-400"
              />
            </div>

            {/* Employees List */}
            <div className="border border-neutral-200 dark:border-white/10 rounded-2xl p-2 max-h-56 overflow-y-auto space-y-1 bg-white/50 dark:bg-white/[0.02]">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmpIds.includes(emp.employeeId);
                return (
                  <div
                    key={emp.employeeId}
                    onClick={() => handleToggleEmployee(emp.employeeId)}
                    className={`flex items-center justify-between p-2.5 rounded-xl text-xs cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-sky-500/10 text-sky-900 dark:text-sky-200 border border-sky-500/20'
                        : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-800 dark:text-neutral-200 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                          isSelected
                            ? 'bg-sky-500 border-sky-500 text-white'
                            : 'border-neutral-300 dark:border-white/20 bg-white dark:bg-white/5'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <span className="font-medium">{emp.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-neutral-400 px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-white/5">
                      EnNo: {emp.employeeId}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Column 2: Date Multi-Selection & Leave Details */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <span>2. Select Leave Dates ({activeMonthKey})</span>
                <Badge variant="info">{selectedDates.length} selected</Badge>
              </label>
              {selectedDates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDates([])}
                  className="text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Interactive Multi-Date Calendar Grid */}
            <div className="border border-neutral-200 dark:border-white/10 rounded-2xl p-3 bg-white/50 dark:bg-white/[0.02]">
              <div className="grid grid-cols-7 gap-1 text-center">
                {monthDates.map((item) => {
                  const isSelected = selectedDates.includes(item.dateStr);
                  return (
                    <button
                      key={item.dateStr}
                      type="button"
                      disabled={item.isSunday}
                      onClick={() => handleToggleDate(item.dateStr)}
                      className={`p-1.5 rounded-lg text-xs font-mono transition-all flex flex-col items-center justify-center ${
                        item.isSunday
                          ? 'opacity-40 bg-neutral-100/50 dark:bg-white/[0.02] cursor-not-allowed text-neutral-400'
                          : isSelected
                          ? 'bg-sky-500 text-white font-bold shadow-xs'
                          : 'hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300'
                      }`}
                      title={item.isSunday ? 'Sunday (Auto-Off Day)' : item.dateStr}
                    >
                      <span className="text-[9px] uppercase font-sans text-neutral-400">
                        {item.dayOfWeek.charAt(0)}
                      </span>
                      <span>{item.dayNum}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Leave Type & Reason */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Leave Category</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="CASUAL">Casual Leave (CL)</option>
                  <option value="SICK">Sick Leave (SL)</option>
                  <option value="PERSONAL">Personal Leave</option>
                  <option value="EARNED">Earned Leave (EL)</option>
                  <option value="OTHER">Duty / Site Assignment</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-neutral-500 mb-1">Notes / Reason (Optional)</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Medical, personal work"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-neutral-200 dark:border-white/5 gap-3">
          <div className="text-xs text-neutral-500 font-mono">
            Total records to create:{' '}
            <span className="font-bold text-neutral-900 dark:text-neutral-100">
              {totalGeneratedRecords}
            </span>{' '}
            ({selectedEmpIds.length} employees × {selectedDates.length} dates)
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={totalGeneratedRecords === 0}
              className="text-xs"
            >
              Save {totalGeneratedRecords > 0 ? `(${totalGeneratedRecords}) Leaves` : 'Leaves'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
