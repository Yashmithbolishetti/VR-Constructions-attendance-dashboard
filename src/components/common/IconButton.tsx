import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export interface IconButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  icon: React.ReactNode;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'ghost' | 'secondary' | 'outline' | 'primary';
  className?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  size = 'md',
  variant = 'ghost',
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5 rounded-lg text-xs',
    md: 'w-10 h-10 p-2 rounded-xl text-sm',
    lg: 'w-12 h-12 p-2.5 rounded-xl text-base',
  };

  const variantClasses = {
    ghost: 'text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-white/5',
    secondary: 'bg-neutral-100 dark:bg-white/10 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-white/15',
    outline: 'border border-neutral-300 dark:border-white/10 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5',
    primary: 'bg-amber-600 text-white hover:bg-amber-500 dark:bg-amber-500 dark:text-neutral-950',
  };

  return (
    <motion.button
      whileTap={{ scale: disabled ? 1 : 0.94 }}
      transition={{ duration: 0.1 }}
      aria-label={label}
      title={label}
      disabled={disabled}
      className={`inline-flex items-center justify-center transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {icon}
    </motion.button>
  );
};
