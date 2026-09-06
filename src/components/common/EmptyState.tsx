import React from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
  bordered?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
  bordered = true,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex flex-col items-center justify-center text-center p-8 md:p-14 rounded-3xl ${
        bordered
          ? 'bg-neutral-50/40 dark:bg-white/[0.01] border-2 border-dashed border-neutral-200 dark:border-white/10'
          : ''
      } ${className}`}
    >
      <div className="w-16 h-16 rounded-full bg-neutral-100 dark:bg-white/5 ring-1 ring-neutral-200 dark:ring-white/10 flex items-center justify-center text-neutral-500 dark:text-[#8E9299] mb-6">
        {icon}
      </div>

      <h3 className="text-xl md:text-2xl font-light text-neutral-900 dark:text-white tracking-tight mb-2">
        {title}
      </h3>

      <p className="text-sm text-neutral-500 dark:text-[#8E9299] max-w-sm leading-relaxed mb-8">
        {description}
      </p>

      {action && (
        <div className="flex items-center justify-center">
          {action}
        </div>
      )}

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-wrap items-center justify-center gap-3">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="group flex items-center gap-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-[#1A1A1A] dark:hover:bg-[#222222] border border-neutral-800 dark:border-white/10 px-6 py-3 rounded-full transition-all cursor-pointer select-none"
            >
              <span className="text-white text-xs md:text-sm font-medium">
                {actionLabel}
              </span>
              <kbd className="px-2 py-0.5 bg-white/10 dark:bg-white/5 border border-white/20 dark:border-white/10 rounded text-[10px] text-neutral-300 dark:text-[#8E9299] group-hover:text-white transition-colors">
                ⌘ U
              </kbd>
            </button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button variant="secondary" size="md" onClick={onSecondaryAction}>
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
};
