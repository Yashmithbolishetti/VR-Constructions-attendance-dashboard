import React from 'react';
import { Skeleton } from './Skeleton';
import { Loader2 } from 'lucide-react';

export interface LoadingStateProps {
  variant?: 'spinner' | 'table' | 'cards' | 'analytics';
  text?: string;
  count?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'spinner',
  text = 'Processing data...',
  count = 5,
  className = '',
}) => {
  if (variant === 'spinner') {
    return (
      <div className={`flex flex-col items-center justify-center p-12 text-center ${className}`}>
        <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
        <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">{text}</p>
      </div>
    );
  }

  if (variant === 'cards') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-white dark:bg-[#12151B] border border-neutral-200/80 dark:border-white/[0.08] space-y-3"
          >
            <div className="flex justify-between items-center">
              <Skeleton width="45%" height={14} />
              <Skeleton width={28} height={28} variant="circular" />
            </div>
            <Skeleton width="70%" height={32} />
            <Skeleton width="50%" height={12} />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'analytics') {
    return (
      <div className={`grid grid-cols-1 lg:grid-cols-3 gap-6 ${className}`}>
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white dark:bg-[#12151B] border border-neutral-200/80 dark:border-white/[0.08] space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton width="30%" height={20} />
            <Skeleton width="20%" height={16} />
          </div>
          <div className="h-64 flex items-end gap-3 pt-8 pb-2">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end items-center gap-2 h-full">
                <Skeleton
                  width="85%"
                  height={`${Math.max(25, ((i * 17) % 80) + 20)}%`}
                  variant="rectangular"
                />
                <Skeleton width="60%" height={10} />
              </div>
            ))}
          </div>
        </div>
        <div className="p-6 rounded-2xl bg-white dark:bg-[#12151B] border border-neutral-200/80 dark:border-white/[0.08] space-y-4">
          <Skeleton width="40%" height={20} />
          <div className="h-64 flex items-center justify-center">
            <Skeleton width={160} height={160} variant="circular" />
          </div>
        </div>
      </div>
    );
  }

  // Default: table skeleton
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-neutral-100/60 dark:bg-white/[0.03]">
        <Skeleton width="15%" height={16} />
        <Skeleton width="20%" height={16} />
        <Skeleton width="15%" height={16} />
        <Skeleton width="12%" height={16} />
        <Skeleton width="10%" height={16} />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-[#12151B] border border-neutral-200/60 dark:border-white/[0.05]"
        >
          <div className="flex items-center gap-3 w-[25%]">
            <Skeleton width={32} height={32} variant="circular" />
            <div className="space-y-1.5 flex-1">
              <Skeleton width="80%" height={14} />
              <Skeleton width="50%" height={10} />
            </div>
          </div>
          <Skeleton width="15%" height={14} />
          <Skeleton width="15%" height={14} />
          <Skeleton width="12%" height={18} />
          <Skeleton width="10%" height={14} />
        </div>
      ))}
    </div>
  );
};
