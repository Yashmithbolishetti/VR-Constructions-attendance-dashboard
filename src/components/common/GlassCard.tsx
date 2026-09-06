import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';

export interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  variant?: 'glass' | 'solid' | 'elevated' | 'subtle';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'solid',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8',
  };

  const variantClasses = {
    // Glass: subtle backdrop blur, soft translucent surface
    glass:
      'bg-white/80 dark:bg-[#151515]/90 backdrop-blur-md border border-neutral-200/80 dark:border-white/10',
    // Solid: crisp, highly readable container
    solid:
      'bg-white dark:bg-[#151515] border border-neutral-200/70 dark:border-white/5',
    // Elevated: slightly higher contrast for interactive cards
    elevated:
      'bg-white dark:bg-[#1A1A1A] border border-neutral-200 dark:border-white/10 hover:border-neutral-300 dark:hover:border-white/20 transition-all',
    // Subtle: for nested sections
    subtle:
      'bg-neutral-50/60 dark:bg-white/[0.02] border border-neutral-200/50 dark:border-white/5',
  };

  return (
    <motion.div
      className={`rounded-2xl ${paddingClasses[padding]} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};
