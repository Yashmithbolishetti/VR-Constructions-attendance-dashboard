import React, { useState, useEffect } from 'react';
import {
  History,
  FileText,
  Calendar,
  Users,
  CheckCircle2,
  Trash2,
  Eye,
  Hash,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { DbBiometricImport } from '../../types/database';
import { DatabaseService } from '../../services/database';

export interface ImportHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectImportMonth?: (monthKey: string) => void;
  onSelectImport?: (imp: DbBiometricImport) => void;
  onImportDeleted?: (id: string) => void;
}

export const ImportHistoryModal: React.FC<ImportHistoryModalProps> = ({
  isOpen,
  onClose,
  onSelectImportMonth,
  onSelectImport,
  onImportDeleted,
}) => {
  const [imports, setImports] = useState<DbBiometricImport[]>([]);
  const [selectedImport, setSelectedImport] = useState<DbBiometricImport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadImports();
    }
  }, [isOpen]);

  const loadImports = async () => {
    setIsLoading(true);
    const data = await DatabaseService.getAllImports();
    setImports(data);
    setIsLoading(false);
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setDeletingId(id);
    try {
      await DatabaseService.deleteImport(id);
      if (selectedImport?.id === id) {
        setSelectedImport(null);
      }
      await loadImports();
      if (onImportDeleted) {
        onImportDeleted(id);
      }
    } catch (err) {
      console.error('Failed to delete import record:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case 'PROCESSED':
        return <Badge variant="success" dot>Processed</Badge>;
      case 'NEEDS_REVIEW':
        return <Badge variant="warning" dot>Needs Review</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Biometric Import History & Audit"
      size="xl"
    >
      <div className="space-y-5">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Persistent register of all hardware biometric export logs imported into VR Constructions Attendance Intelligence.
        </p>

        {imports.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 text-neutral-400 text-xs">
            No biometric files have been imported into the database yet.
          </div>
        ) : (
          <div className="border border-neutral-200/90 dark:border-white/10 rounded-2xl overflow-hidden bg-white/80 dark:bg-white/[0.02] shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.03]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02] text-neutral-500 font-medium">
                    <th className="p-3">File Name</th>
                    <th className="p-3">Date Range</th>
                    <th className="p-3 text-center">Employees</th>
                    <th className="p-3 text-center">Punches</th>
                    <th className="p-3">Uploaded</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-white/5">
                  {imports.map((imp) => (
                    <tr
                      key={imp.id}
                      onClick={() => setSelectedImport(imp)}
                      className={`hover:bg-neutral-50 dark:hover:bg-white/[0.02] cursor-pointer transition-colors ${
                        selectedImport?.id === imp.id ? 'bg-neutral-100/70 dark:bg-white/5' : ''
                      }`}
                    >
                      <td className="p-3 font-medium text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                        <span className="truncate max-w-[140px] font-mono">{imp.file_name}</span>
                      </td>
                      <td className="p-3 font-mono text-neutral-600 dark:text-neutral-400">
                        {imp.date_from} → {imp.date_to}
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {imp.employee_count}
                        </span>
                      </td>
                      <td className="p-3 text-center font-mono">
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {imp.punch_count}
                        </span>
                      </td>
                      <td className="p-3 text-neutral-500 font-mono text-[11px]">
                        {new Date(imp.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-center">{renderStatus(imp.status)}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => handleDelete(imp.id, e)}
                            disabled={deletingId === imp.id}
                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                              deletingId === imp.id
                                ? 'opacity-40 cursor-not-allowed bg-rose-50 text-rose-400'
                                : 'text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95'
                            }`}
                            title="Delete record"
                            aria-label={`Delete record for ${imp.file_name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detail Panel of Selected Import */}
        {selectedImport && (
          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-white/10 bg-neutral-50 dark:bg-white/[0.02] space-y-3 text-xs animate-in fade-in duration-150">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                Import Record Details: {selectedImport.file_name}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />}
                  onClick={(e) => handleDelete(selectedImport.id, e)}
                  disabled={deletingId === selectedImport.id}
                  className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border-rose-200 dark:border-rose-900/30"
                >
                  {deletingId === selectedImport.id ? 'Deleting...' : 'Delete Record'}
                </Button>
                {onSelectImportMonth && (
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const monthKey = selectedImport.date_from.substring(0, 7);
                      onSelectImportMonth(monthKey);
                      onClose();
                    }}
                    className="text-xs"
                  >
                    Switch Workspace to {selectedImport.date_from.substring(0, 7)}
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-neutral-400 block text-[10px]">Valid Punches</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {selectedImport.valid_punch_count}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Duplicates Filtered</span>
                <span className="font-mono font-bold text-amber-500">
                  {selectedImport.duplicate_punch_count}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">File Size</span>
                <span className="font-mono text-neutral-700 dark:text-neutral-300">
                  {(selectedImport.file_size_bytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block text-[10px]">Status</span>
                <span>{selectedImport.status}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-200/60 dark:border-white/5">
              <span className="text-neutral-400 block text-[10px] mb-0.5">
                Deterministic SHA-256 Digest
              </span>
              <code className="font-mono text-[10px] text-neutral-600 dark:text-neutral-400 select-all block break-all">
                {selectedImport.file_hash}
              </code>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-neutral-200 dark:border-white/5">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
