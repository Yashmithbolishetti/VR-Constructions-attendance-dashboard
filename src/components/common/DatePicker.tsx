import React from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

export interface DatePickerProps {
  value: string; // YYYY-MM or YYYY-MM-DD
  onChange: (date: string) => void;
  mode?: 'month' | 'day';
  label?: string;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  mode = 'month',
  label,
  className = '',
}) => {
  // Format current display string
  const formatDisplay = (val: string) => {
    if (!val) return 'Select date';
    try {
      if (mode === 'month') {
        const [year, month] = val.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 1);
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      } else {
        const date = new Date(val);
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      return val;
    }
  };

  const handlePrev = () => {
    try {
      if (mode === 'month') {
        const [y, m] = value.split('-').map(Number);
        const prev = new Date(y, m - 2, 1);
        const nextY = prev.getFullYear();
        const nextM = String(prev.getMonth() + 1).padStart(2, '0');
        onChange(`${nextY}-${nextM}`);
      } else {
        const d = new Date(value);
        d.setDate(d.getDate() - 1);
        onChange(d.toISOString().split('T')[0]);
      }
    } catch {
      // fallback
    }
  };

  const handleNext = () => {
    try {
      if (mode === 'month') {
        const [y, m] = value.split('-').map(Number);
        const next = new Date(y, m, 1);
        const nextY = next.getFullYear();
        const nextM = String(next.getMonth() + 1).padStart(2, '0');
        onChange(`${nextY}-${nextM}`);
      } else {
        const d = new Date(value);
        d.setDate(d.getDate() + 1);
        onChange(d.toISOString().split('T')[0]);
      }
    } catch {
      // fallback
    }
  };

  return (
    <div className={`inline-flex flex-col ${className}`}>
      {label && (
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
          {label}
        </span>
      )}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200/80 dark:border-white/[0.08]">
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous period"
          className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 hover:shadow-xs transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 px-3 py-1 text-xs md:text-sm font-medium text-neutral-800 dark:text-neutral-100 select-none">
          <Calendar className="w-3.5 h-3.5 text-neutral-400" />
          <span>{formatDisplay(value)}</span>
        </div>

        <button
          type="button"
          onClick={handleNext}
          aria-label="Next period"
          className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-white dark:hover:bg-white/10 hover:shadow-xs transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
