import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-3.5 py-1.5 text-xs font-medium gap-1.5 rounded-full min-h-[34px]',
    md: 'px-5 py-2 text-xs md:text-sm font-semibold gap-2 rounded-full min-h-[40px]',
    lg: 'px-6 py-2.5 text-sm font-semibold gap-2.5 rounded-full min-h-[46px]',
  };

  const variantClasses = {
    primary:
      'bg-black text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-white/90 shadow-xs active:scale-[0.98]',
    secondary:
      'bg-neutral-100 hover:bg-neutral-200 text-neutral-900 dark:bg-[#1A1A1A] dark:hover:bg-[#222222] dark:text-[#E4E4E7] border border-neutral-300/80 dark:border-white/10 active:scale-[0.98]',
    outline:
      'bg-transparent hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-800 dark:text-[#E4E4E7] border border-neutral-300 dark:border-white/10 active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-neutral-100 dark:hover:bg-white/5 text-neutral-600 dark:text-[#8E9299] hover:text-neutral-900 dark:hover:text-white',
    danger:
      'bg-rose-600 hover:bg-rose-500 text-white dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border dark:border-rose-800/50',
  };

  return (
    <motion.button
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      transition={{ duration: 0.1 }}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center transition-all select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none whitespace-nowrap tracking-tight ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-current" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="inline-flex shrink-0">{rightIcon}</span>}
    </motion.button>
  );
};
