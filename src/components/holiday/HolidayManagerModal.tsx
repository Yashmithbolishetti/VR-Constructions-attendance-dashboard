import React, { useState } from 'react';
import { Calendar, Plus, Trash2, Tag, Check, Info } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { HolidayConfig } from '../../types/attendance';
import { normalizeDateString } from '../../services/attendanceCalculator';

export interface HolidayManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMonthKey?: string; // e.g. "2026-09"
  monthKey?: string;
  holidays?: HolidayConfig[];
  onAddHoliday?: (holiday: HolidayConfig) => void;
  onRemoveHoliday?: (dateOrId: string) => void;
}

export const HolidayManagerModal: React.FC<HolidayManagerModalProps> = ({
  isOpen,
  onClose,
  activeMonthKey,
  monthKey,
  holidays = [],
  onAddHoliday,
  onRemoveHoliday,
}) => {
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const effectiveMonthKey =
    activeMonthKey && activeMonthKey.includes('-')
      ? activeMonthKey
      : monthKey && monthKey.includes('-')
      ? monthKey
      : '';
  const defaultDatePrefix = effectiveMonthKey;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!holidayDate) {
      setFormError('Please choose a holiday date.');
      return;
    }
    if (!holidayName.trim()) {
      setFormError('Please specify the holiday name.');
      return;
    }

    const norm = normalizeDateString(holidayDate);

    if (onAddHoliday) {
      onAddHoliday({
        id: `hol-${Date.now()}`,
        date: norm,
        name: holidayName.trim(),
      });
    }

    setHolidayName('');
    setHolidayDate('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Company & Public Holidays (${activeMonthKey})`}
      size="md"
    >
      <div className="space-y-6">
        <div className="p-3.5 rounded-2xl bg-neutral-100/80 dark:bg-white/5 border border-neutral-200/50 dark:border-white/5 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 block mb-0.5">
              Deterministic Holiday Accounting
            </span>
            <p className="text-neutral-500 dark:text-neutral-400">
              Sundays are auto-calculated as rest days. Add official state or company festivals here.
              Holidays reduce required working days and immediately re-evaluate attendance statuses.
            </p>
          </div>
        </div>

        {/* Add New Holiday Form */}
        <form onSubmit={handleAdd} className="p-4 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] space-y-3">
          <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-neutral-500" />
            Add New Holiday Record
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-neutral-500 mb-1">Holiday Date</label>
              <input
                type="date"
                value={holidayDate}
                min={`${defaultDatePrefix}-01`}
                max={`${defaultDatePrefix}-31`}
                onChange={(e) => setHolidayDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] text-neutral-500 mb-1">Holiday Name / Description</label>
              <input
                type="text"
                placeholder="e.g. Independence Day, Festival"
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button type="submit" variant="primary" size="sm" className="text-xs">
              + Add Holiday
            </Button>
          </div>
        </form>

        {/* Existing Holidays List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Registered Holidays
            </span>
            <Badge variant="neutral">{holidays.length} configured</Badge>
          </div>

          {holidays.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 text-neutral-400 text-xs">
              No additional holidays added for this month. Sundays are automatically calculated.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {holidays.map((h) => (
                <div
                  key={h.date}
                  className="flex items-center justify-between p-3 rounded-xl border border-neutral-200/70 dark:border-white/5 bg-white dark:bg-white/[0.02]"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-lg bg-neutral-100 dark:bg-white/5 text-neutral-800 dark:text-neutral-200">
                      {h.date}
                    </span>
                    <span className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                      {h.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveHoliday && onRemoveHoliday(h.id || h.date)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer transition-colors"
                    title="Remove Holiday"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-white/5">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
};
