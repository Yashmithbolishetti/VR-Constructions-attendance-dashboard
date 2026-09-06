import React from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface FilterItem {
  id: string;
  label: string;
  count?: number;
}

export interface FilterBarProps {
  filters: FilterItem[];
  activeFilterId: string;
  onSelectFilter: (id: string) => void;
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  activeFilterId,
  onSelectFilter,
  onClearFilters,
  hasActiveFilters = false,
  children,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/[0.06] ${className}`}
    >
      <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-0.5">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-500 mr-2 select-none">
          <Filter className="w-3.5 h-3.5" />
          <span>Filters:</span>
        </div>

        {filters.map((filter) => {
          const isActive = filter.id === activeFilterId;
          return (
            <button
              key={filter.id}
              type="button"
              onClick={() => onSelectFilter(filter.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap select-none ${
                isActive
                  ? 'bg-white dark:bg-white/15 text-neutral-900 dark:text-white shadow-xs border border-neutral-200/80 dark:border-white/10'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span>{filter.label}</span>
              {filter.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive
                      ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300'
                      : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {filter.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        {children}
        {hasActiveFilters && onClearFilters && (
          <Button
            size="sm"
            variant="ghost"
            leftIcon={<RotateCcw className="w-3 h-3" />}
            onClick={onClearFilters}
            className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};
