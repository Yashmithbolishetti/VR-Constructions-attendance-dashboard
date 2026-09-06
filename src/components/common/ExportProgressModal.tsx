import React from 'react';
import { CheckCircle2, Loader2, AlertTriangle, Download, FileText, FileSpreadsheet, X } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ExportProgressState {
  isOpen: boolean;
  format: 'PDF' | 'EXCEL';
  title: string;
  step: 'collecting' | 'calculating' | 'building' | 'ready' | 'error';
  fileName?: string;
  errorMessage?: string;
  onDownloadAgain?: () => void;
  onClose: () => void;
}

export const ExportProgressModal: React.FC<ExportProgressState> = ({
  isOpen,
  format,
  title,
  step,
  fileName,
  errorMessage,
  onDownloadAgain,
  onClose,
}) => {
  if (!isOpen) return null;

  const steps = [
    { id: 'collecting', label: 'Collecting attendance records' },
    { id: 'calculating', label: 'Calculating shift & timing summaries' },
    { id: 'building', label: format === 'PDF' ? 'Rendering branded PDF pages' : 'Structuring multi-sheet Excel workbook' },
    { id: 'ready', label: 'Report generation complete' },
  ];

  const getStepIndex = () => {
    switch (step) {
      case 'collecting':
        return 0;
      case 'calculating':
        return 1;
      case 'building':
        return 2;
      case 'ready':
        return 3;
      case 'error':
        return -1;
      default:
        return 0;
    }
  };

  const currentIndex = getStepIndex();

  return (
    <Modal isOpen={isOpen} onClose={step === 'ready' || step === 'error' ? onClose : () => {}} title="Exporting Report">
      <div className="space-y-6 py-2">
        {/* Header Icon + Report Name */}
        <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/5">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 flex items-center justify-center shrink-0">
            {format === 'PDF' ? (
              <FileText className="w-5 h-5 text-rose-500" />
            ) : (
              <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-neutral-900 dark:text-white truncate">{title}</h4>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Format: <span className="font-mono font-medium">{format}</span>
              {fileName && <span className="ml-2 truncate">• {fileName}</span>}
            </p>
          </div>
        </div>

        {/* Error Notification */}
        {step === 'error' ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              <span>Report Generation Failed</span>
            </div>
            <p className="text-neutral-600 dark:text-neutral-300">
              {errorMessage || 'An unexpected error occurred while preparing your export. Please verify attendance data is loaded and try again.'}
            </p>
            <div className="pt-2 flex justify-end">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          /* Step Progress List */
          <div className="space-y-3 px-1">
            {steps.map((s, idx) => {
              const isDone = currentIndex > idx || step === 'ready';
              const isCurrent = currentIndex === idx && step !== 'ready';
              const isPending = currentIndex < idx && step !== 'ready';

              return (
                <div key={s.id} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : isCurrent ? (
                      <Loader2 className="w-4 h-4 text-sky-500 animate-spin" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-neutral-300 dark:bg-white/20" />
                    )}
                  </div>
                  <span
                    className={`text-xs ${
                      isDone
                        ? 'text-neutral-800 dark:text-neutral-200 font-medium'
                        : isCurrent
                        ? 'text-sky-600 dark:text-sky-400 font-semibold'
                        : 'text-neutral-400'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer Actions */}
        {step === 'ready' && (
          <div className="pt-2 flex items-center justify-between border-t border-neutral-100 dark:border-white/5">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              <span>Downloaded successfully</span>
            </span>
            <div className="flex items-center gap-2">
              {onDownloadAgain && (
                <Button variant="outline" size="sm" onClick={onDownloadAgain} className="text-xs">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Save Again
                </Button>
              )}
              <Button variant="primary" size="sm" onClick={onClose} className="text-xs">
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
