import React from 'react';
import { AlertTriangle, Clock, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { DbBiometricImport } from '../../types/database';

export interface DuplicateImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingImport: DbBiometricImport | null;
  newFileName?: string;
  newFileSize?: number;
  onCancel?: () => void;
  onViewExisting: () => void;
  onImportAnyway: () => void;
}

export const DuplicateImportModal: React.FC<DuplicateImportModalProps> = ({
  isOpen,
  onClose,
  existingImport,
  newFileName,
  newFileSize,
  onCancel,
  onViewExisting,
  onImportAnyway,
}) => {
  if (!existingImport) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Duplicate Biometric Import Detected"
      size="md"
    >
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3.5">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <span className="font-bold text-amber-900 dark:text-amber-200 block text-sm">
              This file has already been imported.
            </span>
            <p className="text-amber-800/80 dark:text-amber-300/80">
              The cryptographic content digest matches a previously processed biometric file.
              Re-importing will not duplicate punches (idempotent upsert), but you can view the existing records immediately.
            </p>
          </div>
        </div>

        {/* Existing Import Details Card */}
        <div className="p-4 rounded-2xl border border-neutral-200 dark:border-white/10 bg-white/50 dark:bg-white/[0.02] space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-500">File Name</span>
            <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
              {existingImport.file_name}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-500">First Uploaded</span>
            <span className="text-neutral-700 dark:text-neutral-300 font-mono">
              {new Date(existingImport.uploaded_at).toLocaleString()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-500">Date Range</span>
            <span className="font-mono text-neutral-700 dark:text-neutral-300">
              {existingImport.date_from} → {existingImport.date_to}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-medium text-neutral-500">Records Processed</span>
            <div className="flex items-center gap-2 font-mono">
              <Badge variant="neutral">{existingImport.employee_count} Employees</Badge>
              <Badge variant="info">{existingImport.punch_count} Punches</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-neutral-200/60 dark:border-white/5">
            <span className="font-medium text-neutral-500">File Digest SHA-256</span>
            <span className="font-mono text-[10px] text-neutral-400 truncate max-w-[200px]" title={existingImport.file_hash}>
              {existingImport.file_hash.substring(0, 16)}...
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onImportAnyway}
            className="w-full sm:w-auto text-xs"
          >
            Import Anyway (Idempotent)
          </Button>

          <Button
            variant="primary"
            size="sm"
            rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            onClick={onViewExisting}
            className="w-full sm:w-auto text-xs"
          >
            View Existing Import
          </Button>
        </div>
      </div>
    </Modal>
  );
};
