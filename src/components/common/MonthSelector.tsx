import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X, Check, CalendarDays } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface MonthSelectorProps {
  className?: string;
  compact?: boolean;
}

const MONTH_DEFINITIONS = [
  { index: 1, key: '01', name: 'January', short: 'Jan' },
  { index: 2, key: '02', name: 'February', short: 'Feb' },
  { index: 3, key: '03', name: 'March', short: 'Mar' },
  { index: 4, key: '04', name: 'April', short: 'Apr' },
  { index: 5, key: '05', name: 'May', short: 'May' },
  { index: 6, key: '06', name: 'June', short: 'Jun' },
  { index: 7, key: '07', name: 'July', short: 'Jul' },
  { index: 8, key: '08', name: 'August', short: 'Aug' },
  { index: 9, key: '09', name: 'September', short: 'Sep' },
  { index: 10, key: '10', name: 'October', short: 'Oct' },
  { index: 11, key: '11', name: 'November', short: 'Nov' },
  { index: 12, key: '12', name: 'December', short: 'Dec' },
];

export const MonthSelector: React.FC<MonthSelectorProps> = ({ className = '', compact = false }) => {
  const {
    availableMonths,
    activeMonthKey,
    setActiveMonthKey,
    calculatedData,
    parsedDataset,
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract dataset date bounds
  const datasetStartDate = calculatedData?.datasetStartDate || parsedDataset?.firstDate || '';
  const datasetEndDate = calculatedData?.datasetEndDate || parsedDataset?.lastDate || '';
  const datasetDateRangeFormatted =
    calculatedData?.datasetDateRangeFormatted ||
    (datasetStartDate && datasetEndDate ? `${datasetStartDate} – ${datasetEndDate}` : '');

  // Determine initial year to display in 12-month calendar
  const initialYear = useMemo(() => {
    if (activeMonthKey && activeMonthKey.includes('-')) {
      const parsedYear = parseInt(activeMonthKey.split('-')[0], 10);
      if (!isNaN(parsedYear) && parsedYear > 1990) return parsedYear;
    }
    if (datasetStartDate && datasetStartDate.includes('-')) {
      const parsedYear = parseInt(datasetStartDate.split('-')[0], 10);
      if (!isNaN(parsedYear) && parsedYear > 1990) return parsedYear;
    }
    return new Date().getFullYear();
  }, [activeMonthKey, datasetStartDate]);

  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  // Update selected year if activeMonthKey changes
  useEffect(() => {
    if (activeMonthKey && activeMonthKey.includes('-')) {
      const y = parseInt(activeMonthKey.split('-')[0], 10);
      if (!isNaN(y) && y > 1990) {
        setSelectedYear(y);
      }
    }
  }, [activeMonthKey]);

  // Close calendar popover on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Collect available years from dataset and availableMonths
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(selectedYear);
    if (datasetStartDate) {
      const y = parseInt(datasetStartDate.split('-')[0], 10);
      if (!isNaN(y)) yearsSet.add(y);
    }
    if (datasetEndDate) {
      const y = parseInt(datasetEndDate.split('-')[0], 10);
      if (!isNaN(y)) yearsSet.add(y);
    }
    if (availableMonths && availableMonths.length > 0) {
      availableMonths.forEach((m) => {
        if (m.month_key && m.month_key.includes('-')) {
          const y = parseInt(m.month_key.split('-')[0], 10);
          if (!isNaN(y)) yearsSet.add(y);
        }
      });
    }
    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [datasetStartDate, datasetEndDate, availableMonths, selectedYear]);

  // Detected months with actual biometric logs (for quick shortcut chips)
  const detectedMonths = useMemo(() => {
    if (!availableMonths || availableMonths.length === 0) return [];
    return [...availableMonths]
      .sort((a, b) => a.month_key.localeCompare(b.month_key))
      .map((m) => {
        const parts = m.month_key.split('-');
        let short = m.month_label;
        if (parts.length === 2) {
          const mIdx = parseInt(parts[1], 10) - 1;
          const monthDef = MONTH_DEFINITIONS[mIdx];
          if (monthDef) {
            short = `${monthDef.short} ${parts[0]}`;
          }
        }
        return {
          key: m.month_key,
          label: m.month_label,
          shortLabel: short,
        };
      });
  }, [availableMonths]);

  // Helper to check if a specific month in the selected year intersects with imported dataset
  const getMonthDataStatus = (year: number, monthIndex: number) => {
    if (!datasetStartDate || !datasetEndDate) {
      return { hasData: false, rangeLabel: 'No data', dates: '' };
    }

    const mStr = monthIndex.toString().padStart(2, '0');
    const daysInMonth = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
    const monthStart = `${year}-${mStr}-01`;
    const monthEnd = `${year}-${mStr}-${daysInMonth.toString().padStart(2, '0')}`;

    const effectiveStart = datasetStartDate > monthStart ? datasetStartDate : monthStart;
    const effectiveEnd = datasetEndDate < monthEnd ? datasetEndDate : monthEnd;

    if (effectiveStart > monthEnd || effectiveEnd < monthStart || effectiveStart > effectiveEnd) {
      return { hasData: false, rangeLabel: 'No data', dates: '' };
    }

    const sDay = parseInt(effectiveStart.split('-')[2], 10);
    const eDay = parseInt(effectiveEnd.split('-')[2], 10);
    const monthDef = MONTH_DEFINITIONS[monthIndex - 1];
    const mName = monthDef ? monthDef.short : mStr;

    return {
      hasData: true,
      rangeLabel: `${sDay}–${eDay} ${mName}`,
      dates: `${effectiveStart} to ${effectiveEnd}`,
    };
  };

  const isOverallActive =
    !activeMonthKey ||
    activeMonthKey === 'OVERALL' ||
    activeMonthKey === 'Overall' ||
    activeMonthKey === 'COMBINED' ||
    activeMonthKey === 'ALL';

  const isSpecificMonthActive = !isOverallActive && !!activeMonthKey;

  // Active month display label
  const activeMonthDisplay = useMemo(() => {
    if (isOverallActive) return 'Overall';
    if (!activeMonthKey) return '';
    const parts = activeMonthKey.split('-');
    if (parts.length === 2) {
      const mIdx = parseInt(parts[1], 10) - 1;
      const monthDef = MONTH_DEFINITIONS[mIdx];
      if (monthDef) return `${monthDef.short} ${parts[0]}`;
    }
    return activeMonthKey;
  }, [activeMonthKey, isOverallActive]);

  const handleSelectMonth = (monthKey: string) => {
    setActiveMonthKey(monthKey);
    setIsOpen(false);
  };

  const handleSelectOverall = () => {
    setActiveMonthKey('OVERALL');
    setIsOpen(false);
  };

  return (
    <div
      id="top-period-selector"
      ref={containerRef}
      className={`relative inline-flex items-center gap-1 p-1 rounded-xl bg-neutral-100/90 dark:bg-white/5 border border-neutral-200/80 dark:border-white/10 max-w-full shadow-xs ${className}`}
    >
      {/* 1. Dedicated Calendar View Button */}
      <button
        id="calendar-view-btn"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer select-none ${
          isOpen
            ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
            : isSpecificMonthActive
            ? 'bg-sky-600 text-white shadow-xs'
            : 'text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/70 dark:hover:bg-white/10'
        }`}
        title="Open 12-Month Calendar View to select any month"
        aria-expanded={isOpen}
      >
        <Calendar
          className={`w-3.5 h-3.5 ${
            isSpecificMonthActive || isOpen ? 'text-current' : 'text-sky-500'
          }`}
        />
        <span>Calendar View</span>
        {isSpecificMonthActive && (
          <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-white/20 text-white">
            {activeMonthDisplay}
          </span>
        )}
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : 'opacity-70'
          }`}
        />
      </button>

      {/* 2. Existing Overall Button */}
      <button
        id="period-btn-overall"
        type="button"
        onClick={handleSelectOverall}
        title={datasetDateRangeFormatted ? `Overall imported range: ${datasetDateRangeFormatted}` : 'Overall period'}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
          isOverallActive
            ? 'bg-sky-600 dark:bg-sky-500 text-white font-semibold shadow-xs'
            : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/10'
        }`}
      >
        Overall
      </button>

      {/* 3. Quick Detected Month Buttons (e.g., Aug 2026, Sep 2026) for immediate 1-click access */}
      {detectedMonths.map((m) => {
        const active = activeMonthKey === m.key;
        return (
          <button
            key={m.key}
            id={`period-btn-${m.key.toLowerCase()}`}
            type="button"
            onClick={() => handleSelectMonth(m.key)}
            title={`Filter attendance by ${m.label}`}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 cursor-pointer ${
              active
                ? 'bg-sky-600 dark:bg-sky-500 text-white font-semibold shadow-xs'
                : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/10'
            }`}
          >
            {m.shortLabel}
          </button>
        );
      })}

      {/* 4. Full 12-Month Calendar Popover */}
      {isOpen && (
        <div
          id="calendar-picker-popover"
          className="absolute top-full left-0 mt-2 z-50 w-[360px] sm:w-[420px] p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header with Title and Year Selector */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800 mb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <CalendarDays className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                  Select Calendar Month
                </h3>
                <p className="text-[10px] text-neutral-400">
                  All 12 months • Strict dataset intersection
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Close Calendar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Year Navigation Bar */}
          <div className="flex items-center justify-between px-2 py-1.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200/60 dark:border-neutral-700/50 mb-3">
            <button
              type="button"
              id="calendar-prev-year-btn"
              onClick={() => setSelectedYear((prev) => prev - 1)}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              title="Previous Year"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Year Selector Tabs if multiple years */}
            <div className="flex items-center gap-1">
              {availableYears.map((yr) => (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setSelectedYear(yr)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer ${
                    selectedYear === yr
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-xs'
                      : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                  }`}
                >
                  {yr}
                </button>
              ))}
            </div>

            <button
              type="button"
              id="calendar-next-year-btn"
              onClick={() => setSelectedYear((prev) => prev + 1)}
              className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
              title="Next Year"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Overall Period Option */}
          <div className="mb-3">
            <button
              type="button"
              id="picker-btn-overall"
              onClick={handleSelectOverall}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all cursor-pointer border ${
                isOverallActive
                  ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-700 dark:text-sky-300 font-semibold ring-1 ring-sky-500/20'
                  : 'bg-neutral-50/80 dark:bg-neutral-800/40 border-neutral-200/60 dark:border-neutral-700/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">Overall Imported Dataset</span>
                {datasetDateRangeFormatted && (
                  <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-mono">
                    ({datasetDateRangeFormatted})
                  </span>
                )}
              </div>
              {isOverallActive && <Check className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />}
            </button>
          </div>

          {/* All 12 Months Grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTH_DEFINITIONS.map((m) => {
              const monthKey = `${selectedYear}-${m.key}`;
              const isCurrent = activeMonthKey === monthKey;
              const status = getMonthDataStatus(selectedYear, m.index);

              return (
                <button
                  key={m.key}
                  id={`picker-month-${monthKey}`}
                  type="button"
                  onClick={() => handleSelectMonth(monthKey)}
                  className={`group relative p-2.5 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                    isCurrent
                      ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                      : status.hasData
                      ? 'bg-white dark:bg-neutral-800/80 border-neutral-200 dark:border-neutral-700 hover:border-sky-400 hover:bg-sky-50/40 dark:hover:bg-sky-950/20'
                      : 'bg-neutral-50/50 dark:bg-neutral-800/30 border-neutral-200/40 dark:border-neutral-800 text-neutral-400 hover:bg-neutral-100/60 dark:hover:bg-neutral-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-semibold ${
                        isCurrent
                          ? 'text-white'
                          : status.hasData
                          ? 'text-neutral-900 dark:text-neutral-100 group-hover:text-sky-600 dark:group-hover:text-sky-400'
                          : 'text-neutral-500 dark:text-neutral-400'
                      }`}
                    >
                      {m.name}
                    </span>
                    {isCurrent && <Check className="w-3 h-3 text-white" />}
                  </div>

                  {/* Status Indicator */}
                  <div className="text-[10px]">
                    {status.hasData ? (
                      <span
                        className={`inline-flex items-center gap-1 font-mono font-medium ${
                          isCurrent
                            ? 'text-sky-100'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isCurrent ? 'bg-white' : 'bg-emerald-500'
                          }`}
                        />
                        {status.rangeLabel}
                      </span>
                    ) : (
                      <span
                        className={`text-[9px] ${
                          isCurrent ? 'text-sky-200' : 'text-neutral-400 dark:text-neutral-500'
                        }`}
                      >
                        No data
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer Note */}
          <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 text-[10px] text-neutral-400 flex items-center justify-between">
            <span>Calendar = 12 Months</span>
            <span>Attendance = Imported Dates</span>
          </div>
        </div>
      )}
    </div>
  );
};
