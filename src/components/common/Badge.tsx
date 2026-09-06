import React from 'react';

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'error' | 'info' | 'accent' | 'outline';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  dot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] uppercase tracking-wider font-semibold rounded-full gap-1.5',
    md: 'px-2.5 py-1 text-xs font-medium rounded-full gap-1.5',
  };

  const variantClasses: Record<BadgeVariant, { container: string; dot: string }> = {
    neutral: {
      container: 'bg-neutral-100 text-neutral-700 dark:bg-white/5 dark:text-[#8E9299] border border-neutral-200/80 dark:border-white/10',
      dot: 'bg-neutral-400 dark:bg-[#8E9299]',
    },
    success: {
      container: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/40',
      dot: 'bg-emerald-500',
    },
    warning: {
      container: 'bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/40',
      dot: 'bg-amber-500',
    },
    danger: {
      container: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/40',
      dot: 'bg-rose-500',
    },
    error: {
      container: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/70 dark:border-rose-800/40',
      dot: 'bg-rose-500',
    },
    info: {
      container: 'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border border-sky-200/70 dark:border-sky-800/40',
      dot: 'bg-sky-500',
    },
    accent: {
      container: 'bg-neutral-900 text-white dark:bg-white/10 dark:text-white border border-neutral-800 dark:border-white/20',
      dot: 'bg-white',
    },
    outline: {
      container: 'bg-transparent text-neutral-600 dark:text-[#8E9299] border border-neutral-300 dark:border-white/10',
      dot: 'bg-[#8E9299]',
    },
  };

  const style = variantClasses[variant];

  return (
    <span
      className={`inline-flex items-center tracking-tight font-medium shrink-0 whitespace-nowrap select-none ${sizeClasses[size]} ${style.container} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />}
      <span>{children}</span>
    </span>
  );
};
