import React from 'react';
import { GlassCard } from './GlassCard';
import { Skeleton } from './Skeleton';

export interface StatCardProps {
  label: string;
  value?: string | number | null;
  unit?: string;
  subtext?: string;
  icon?: React.ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
  badge?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  subtext,
  icon,
  isLoading = false,
  isEmpty = false,
  emptyLabel = 'Awaiting biometric upload',
  badge,
  className = '',
}) => {
  return (
    <div
      className={`bg-white dark:bg-[#151515] border border-neutral-200/70 dark:border-white/5 p-5 rounded-2xl flex flex-col justify-between transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-[10px] uppercase tracking-widest text-neutral-500 dark:text-[#8E9299] font-bold">
          {label}
        </p>
        {icon && (
          <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-[#8E9299]">
            {icon}
          </div>
        )}
      </div>

      <div className="my-1">
        {isLoading ? (
          <div className="space-y-2 py-1">
            <Skeleton height={32} width="50%" />
            <Skeleton height={14} width="35%" />
          </div>
        ) : isEmpty || value === null || value === undefined ? (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light text-neutral-900 dark:text-white tracking-tighter">
                —
              </span>
              {unit && (
                <span className="text-xs text-neutral-500 dark:text-[#8E9299]">
                  {unit}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-neutral-400 dark:text-[#8E9299]">
              {emptyLabel}
            </p>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-light text-neutral-900 dark:text-white tracking-tighter">
                {value}
              </span>
              {unit && (
                <span className="text-xs text-neutral-500 dark:text-[#8E9299]">
                  {unit}
                </span>
              )}
            </div>
            {subtext && (
              <p className="mt-1 text-[11px] text-neutral-500 dark:text-[#8E9299]">
                {subtext}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Clean Minimalism bottom progress/indicator line */}
      <div className="mt-4 h-1 w-full bg-neutral-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            isEmpty || value === null || value === undefined
              ? 'bg-neutral-300/40 dark:bg-[#8E9299]/20 w-1/3 animate-pulse'
              : 'bg-neutral-900 dark:bg-white/40 w-full'
          }`}
        />
      </div>

      {badge && <div className="mt-3 pt-2 border-t border-neutral-100 dark:border-white/5">{badge}</div>}
    </div>
  );
};
