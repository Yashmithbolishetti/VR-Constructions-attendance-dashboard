import React from 'react';
import { AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  whatHappened: string;
  whatYouCanDo: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Action Required',
  whatHappened,
  whatYouCanDo,
  onRetry,
  retryLabel = 'Try Again',
  secondaryAction,
  className = '',
}) => {
  return (
    <div
      role="alert"
      className={`p-6 rounded-2xl bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 shrink-0">
          <AlertCircle className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200 tracking-tight mb-2">
            {title}
          </h4>

          <div className="space-y-2 text-xs md:text-sm text-rose-800/90 dark:text-rose-300/90 leading-relaxed">
            <div>
              <span className="font-semibold text-rose-950 dark:text-rose-100">Issue: </span>
              {whatHappened}
            </div>
            <div>
              <span className="font-semibold text-rose-950 dark:text-rose-100">Next Step: </span>
              {whatYouCanDo}
            </div>
          </div>

          {(onRetry || secondaryAction) && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={onRetry}
                  className="bg-white dark:bg-rose-900/30 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 hover:bg-rose-50"
                >
                  {retryLabel}
                </Button>
              )}
              {secondaryAction && (
                <Button
                  size="sm"
                  variant="ghost"
                  rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                  onClick={secondaryAction.onClick}
                  className="text-rose-800 dark:text-rose-300 hover:bg-rose-100/50"
                >
                  {secondaryAction.label}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
