import React, { useState, useRef, useMemo } from 'react';
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Clock,
  Calendar,
  UserCheck,
  Building,
  Sparkles,
  ShieldCheck,
  Check,
  ChevronRight,
  Play,
  Layers,
  Info,
  History,
  Database,
  Users,
  Search,
  CheckSquare,
  Square,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { ErrorState } from '../components/common/ErrorState';
import { Modal } from '../components/common/Modal';
import { useApp } from '../context/AppContext';
import { parseBiometricFile } from '../services/attendanceParser';
import { LeaveType, ParsedBiometricDataset } from '../types/attendance';
import { runAttendanceEngineTests, TestResult } from '../services/attendanceTests';
import { DatabaseService, calculateFileHash } from '../services/database';
import { DbBiometricImport } from '../types/database';
import { DuplicateImportModal } from '../components/import/DuplicateImportModal';
import { ImportHistoryModal } from '../components/import/ImportHistoryModal';
import { HolidayManagerModal } from '../components/holiday/HolidayManagerModal';
import { BatchLeaveModal } from '../components/leave/BatchLeaveModal';

export const UploadPage: React.FC = () => {
  const {
    parsedDataset,
    setUploadedFileAndDataset,
    resetDataset,
    loadSampleDataset,
    selectedMonthKey,
    setSelectedMonthKey,
    activeMonthKey,
    setActiveMonthKey,
    activeSetupStep,
    setActiveSetupStep,
    officeConfig,
    updateOfficeConfig,
    holidays,
    addHoliday,
    removeHoliday,
    leaves,
    addLeaveRecord,
    addBatchLeaves,
    removeLeaveRecord,
    calculatedData,
    commitImportToDatabase,
    isImportHistoryOpen,
    setIsImportHistoryOpen,
    setCurrentPage,
    addToast,
    isProcessingUpload,
    setIsProcessingUpload,
  } = useApp();

  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<'idle' | 'reading' | 'parsing' | 'processing' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStage, setProcessingStage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [errorMessage, setErrorMessage] = useState<{
    title: string;
    whatHappened: string;
    whatYouCanDo: string;
  } | null>(null);

  // Duplicate import handling
  const [duplicateImport, setDuplicateImport] = useState<DbBiometricImport | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [pendingParsedData, setPendingParsedData] = useState<ParsedBiometricDataset | null>(null);

  // Modal controls
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [isBatchLeaveModalOpen, setIsBatchLeaveModalOpen] = useState(false);

  // Form states for Step 3 (Holiday quick add)
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');

  // Step 5 (Multi-employee leave configuration)
  const [leaveEmployeeSearch, setLeaveEmployeeSearch] = useState('');
  const [selectedLeaveEmpIds, setSelectedLeaveEmpIds] = useState<string[]>([]);
  const [selectedLeaveEmpId, setSelectedLeaveEmpId] = useState('');
  const [leaveDateMode, setLeaveDateMode] = useState<'single' | 'range'>('single');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveType, setLeaveType] = useState<LeaveType>('CASUAL');
  const [leaveReason, setLeaveReason] = useState('');

  // Step 5 (Employee summary filter and transaction state)
  const [summarySearchQuery, setSummarySearchQuery] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitProgress, setCommitProgress] = useState(0);
  const [commitStageText, setCommitStageText] = useState('');
  const [commitError, setCommitError] = useState<string | null>(null);
  const [importSuccessData, setImportSuccessData] = useState<{
    importId: string;
    monthKey: string;
    monthLabel: string;
    employeeCount: number;
    workingDays: number;
    attendanceRecordsCount: number;
    exceptionsCount: number;
  } | null>(null);

  // Test suite modal
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testResults, setTestResults] = useState<{ allPassed: boolean; results: TestResult[] } | null>(null);

  const handleFileProcess = (file: File) => {
    setErrorMessage(null);
    setIsProcessingUpload(true);
    setUploadState('reading');
    setUploadProgress(15);
    setProcessingStage('Uploading biometric export stream...');

    if (file.size === 0) {
      setTimeout(() => {
        setIsProcessingUpload(false);
        setUploadState('error');
        setErrorMessage({
          title: 'Empty Biometric File',
          whatHappened: `The file "${file.name}" contains 0 bytes.`,
          whatYouCanDo: 'Verify the date range export on your biometric hardware machine and export again.',
        });
        addToast('The selected biometric file contains 0 bytes.', 'warning');
      }, 200);
      return;
    }

    const reader = new FileReader();

    reader.onload = async (e) => {
      const content = (e.target?.result as string) || '';

      setUploadState('reading');
      setUploadProgress(35);
      setProcessingStage('Reading file contents into memory...');

      try {
        setUploadState('parsing');
        setUploadProgress(60);
        setProcessingStage('Detecting delimiters, column headers, and identities...');

        const fileHash = await calculateFileHash(content, file.name, file.size);
        const existing = await DatabaseService.findImportByHash(fileHash);

        setUploadProgress(80);
        setProcessingStage('Parsing punch records & mapping Enrollment Numbers (EnNo)...');

        const parsed = parseBiometricFile(content, file.name, file.size, file.type);

        setUploadState('processing');
        setUploadProgress(95);
        setProcessingStage('Validating punch intervals and daily shifts...');

        if (existing) {
          setIsProcessingUpload(false);
          setUploadState('idle');
          setDuplicateImport(existing);
          setPendingParsedData(parsed);
          setIsDuplicateModalOpen(true);
          return;
        }

        setTimeout(() => {
          setUploadedFileAndDataset(parsed);
          setUploadProgress(100);
          setUploadState('success');
          setProcessingStage('Ready for Review');
          setIsProcessingUpload(false);
          setActiveSetupStep(2);

          const summaryMsg = parsed.summary?.invalidRowsCount
            ? `Detected ${parsed.summary.validRowsCount} valid punch records (${parsed.summary.invalidRowsCount} rows need review)`
            : `Successfully detected ${parsed.allPunches.length} punch records for ${parsed.employees.length} employees`;

          addToast(
            summaryMsg,
            parsed.summary?.invalidRowsCount ? 'warning' : 'success',
            'Biometric Data Ingested'
          );
        }, 300);
      } catch (err: any) {
        setIsProcessingUpload(false);
        setUploadState('error');
        setErrorMessage({
          title: 'Biometric File Notice',
          whatHappened:
            err.message ||
            'The file was read, but the required biometric columns (such as EnNo and DateTime) could not be detected.',
          whatYouCanDo:
            'Please verify that the file is a text-based biometric export with enrollment identifiers and timestamps (e.g. tab-separated or comma-separated).',
        });
        addToast(
          err.message || 'Required biometric columns could not be detected.',
          'error',
          'Biometric Ingestion Notice'
        );
      }
    };

    reader.onerror = () => {
      setIsProcessingUpload(false);
      setUploadState('error');
      setErrorMessage({
        title: 'File Read Failed',
        whatHappened: 'The browser could not read the biometric file stream.',
        whatYouCanDo: 'Please ensure the file is accessible on your machine and select it again.',
      });
      addToast('File reading error encountered.', 'error');
    };

    reader.readAsText(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileProcess(files[0]);
    } else {
      setUploadState('idle');
    }
    // CRITICAL: Reset input value so selecting the exact same file repeatedly works properly
    e.target.value = '';
  };

  const handleAddHolidaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayName.trim() || !newHolidayDate) {
      addToast('Please provide both holiday name and date', 'warning');
      return;
    }
    addHoliday({
      date: newHolidayDate,
      name: newHolidayName.trim(),
    });
    setNewHolidayName('');
    setNewHolidayDate('');
  };

  // Filtered employees for leave assignment in Step 4
  const filteredLeaveEmployees = useMemo(() => {
    if (!parsedDataset?.employees) return [];
    if (!leaveEmployeeSearch.trim()) return parsedDataset.employees;
    const q = leaveEmployeeSearch.toLowerCase();
    return parsedDataset.employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q)
    );
  }, [parsedDataset?.employees, leaveEmployeeSearch]);

  const toggleSelectAllLeaveEmployees = () => {
    if (selectedLeaveEmpIds.length === filteredLeaveEmployees.length) {
      setSelectedLeaveEmpIds([]);
    } else {
      setSelectedLeaveEmpIds(filteredLeaveEmployees.map((e) => e.employeeId));
    }
  };

  const toggleSelectLeaveEmployee = (empId: string) => {
    setSelectedLeaveEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleAssignBatchLeaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedLeaveEmpIds.length === 0) {
      addToast('Please select at least one employee from the roster list', 'warning');
      return;
    }
    if (!leaveDate) {
      addToast('Please choose a valid start date for the leave', 'warning');
      return;
    }

    const datesToAssign: string[] = [];
    if (leaveDateMode === 'single') {
      datesToAssign.push(leaveDate);
    } else {
      if (!leaveEndDate || leaveEndDate < leaveDate) {
        addToast('Please select a valid End Date that is on or after the Start Date', 'warning');
        return;
      }
      const cur = new Date(leaveDate);
      const end = new Date(leaveEndDate);
      while (cur <= end) {
        datesToAssign.push(cur.toISOString().substring(0, 10));
        cur.setDate(cur.getDate() + 1);
      }
    }

    const newRecords = [];
    for (const dStr of datesToAssign) {
      for (const empId of selectedLeaveEmpIds) {
        const emp = parsedDataset?.employees.find((x) => x.employeeId === empId);
        newRecords.push({
          id: `leave-${empId}-${dStr}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          employeeId: empId,
          employeeName: emp?.name || `Employee ${empId}`,
          date: dStr,
          leaveType,
        });
      }
    }

    addBatchLeaves(newRecords);
    addToast(
      `Registered ${leaveType} leave on ${datesToAssign.length} date(s) for ${selectedLeaveEmpIds.length} employee(s)`,
      'success',
      'Leave Configured'
    );
    setSelectedLeaveEmpIds([]);
  };

  const handleClearMonthLeaves = () => {
    const idsToRemove = currentMonthLeaves.map((l) => l.id);
    idsToRemove.forEach((id) => removeLeaveRecord(id));
    addToast(`Cleared all registered leaves for ${selectedMonthKey}`, 'info');
  };

  const handleRunVerificationTests = () => {
    const results = runAttendanceEngineTests();
    setTestResults(results);
    setIsTestModalOpen(true);
  };

  const handleConfirmImportAndProceed = async () => {
    if (isCommitting) return;
    setIsCommitting(true);
    setCommitError(null);
    setCommitProgress(15);
    setCommitStageText('Validating biometric punch records and employee signatures...');

    try {
      await new Promise((r) => setTimeout(r, 250));
      setCommitProgress(35);
      setCommitStageText('Persisting master employee records into relational database...');

      await new Promise((r) => setTimeout(r, 250));
      setCommitProgress(60);
      setCommitStageText('Writing raw punches and computing daily attendance records...');

      await new Promise((r) => setTimeout(r, 250));
      setCommitProgress(80);
      setCommitStageText('Saving company holidays and approved employee leaves...');

      const res = await commitImportToDatabase();

      if (!res.success) {
        throw new Error(res.error || 'Failed to complete database transaction. Changes were rolled back.');
      }

      setCommitProgress(100);
      setCommitStageText('Finalizing atomic transaction and synchronizing application state...');

      await new Promise((r) => setTimeout(r, 250));

      setImportSuccessData({
        importId: res.importId || `imp-${Date.now()}`,
        monthKey: res.monthKey || selectedMonthKey,
        monthLabel: res.monthLabel || calculatedData?.monthLabel || selectedMonthKey,
        employeeCount: res.employeeCount || parsedDataset?.employees.length || 0,
        workingDays: res.workingDays || calculatedData?.expectedWorkingDays || 26,
        attendanceRecordsCount: res.attendanceRecordsCount || calculatedData?.dailyRecords.length || 0,
        exceptionsCount: res.exceptionsCount || calculatedData?.exceptions.length || 0,
      });
      setIsCommitting(false);
      addToast('Biometric attendance records successfully committed to database.', 'success', 'Import Complete');
    } catch (err: any) {
      console.error('Import transaction failed:', err);
      setCommitError(err.message || 'An unexpected error occurred during database commit.');
      setIsCommitting(false);
      addToast(err.message || 'Database commit failed. Transaction rolled back.', 'error');
    }
  };

  // Filtered employee summaries for Step 5 compact table
  const filteredSummaryEmployees = useMemo(() => {
    if (!calculatedData?.employeeSummaries) return [];
    if (!summarySearchQuery.trim()) return calculatedData.employeeSummaries;
    const q = summarySearchQuery.toLowerCase();
    return calculatedData.employeeSummaries.filter(
      (e) => e.employeeName.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q)
    );
  }, [calculatedData?.employeeSummaries, summarySearchQuery]);

  // Filter holidays and leaves for active month
  const currentMonthHolidays = holidays.filter((h) => h.date.startsWith(selectedMonthKey));
  const currentMonthLeaves = leaves.filter((l) => l.date.startsWith(selectedMonthKey));

  const steps = [
    { num: 1, label: 'Upload' },
    { num: 2, label: 'Data Detected' },
    { num: 3, label: 'Office Settings' },
    { num: 4, label: 'Holidays' },
    { num: 5, label: 'Employee Leave' },
    { num: 6, label: 'Review & Confirm' },
  ];

  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Biometric Attendance Engine"
        subtitle="Import raw biometric punch exports, configure office shifts, and compute auditable attendance records."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<History className="w-4 h-4 text-sky-500" />}
              onClick={() => setIsImportHistoryOpen(true)}
              className="text-xs"
            >
              Import History
            </Button>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<ShieldCheck className="w-4 h-4 text-emerald-500" />}
              onClick={handleRunVerificationTests}
              className="text-xs"
            >
              Verify Engine Rules
            </Button>
            {parsedDataset && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 className="w-4 h-4 text-rose-500" />}
                onClick={resetDataset}
                className="text-xs text-rose-500 hover:bg-rose-500/10"
              >
                Clear Data
              </Button>
            )}
          </div>
        }
      />

      {/* Error State if Any */}
      {errorMessage && (
        <div className="mb-6">
          <ErrorState
            title={errorMessage.title}
            whatHappened={errorMessage.whatHappened}
            whatYouCanDo={errorMessage.whatYouCanDo}
            onRetry={() => {
              setErrorMessage(null);
              fileInputRef.current?.click();
            }}
            secondaryAction={{
              label: 'Load Sample Biometric File',
              onClick: loadSampleDataset,
            }}
          />
        </div>
      )}

      {/* If Import Succeeded: Show the Success Confirmation Screen */}
      {importSuccessData ? (
        <GlassCard className="p-8 sm:p-10 text-center space-y-6 max-w-3xl mx-auto border border-emerald-500/20 bg-gradient-to-b from-emerald-500/[0.03] to-transparent">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-9 h-9 text-emerald-500" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Atomic Database Transaction Completed
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">
              Import Complete
            </h3>
            <p className="text-sm text-neutral-500 dark:text-[#8E9299] max-w-lg mx-auto">
              {importSuccessData.monthLabel} attendance has been imported successfully into persistent database storage. All workforce intelligence dashboards have been synchronized.
            </p>
          </div>

          {/* 4 Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
            <div className="p-4 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5">
              <span className="text-[11px] text-neutral-500 font-medium">Employees Detected</span>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">
                {importSuccessData.employeeCount}
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Master Roster</span>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5">
              <span className="text-[11px] text-neutral-500 font-medium">Expected Working Days</span>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">
                {importSuccessData.workingDays}
              </div>
              <span className="text-[10px] text-neutral-400">Excludes Sun & Hol</span>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5">
              <span className="text-[11px] text-neutral-500 font-medium">Daily Attendance Logs</span>
              <div className="text-2xl font-bold font-mono text-neutral-900 dark:text-white mt-1">
                {importSuccessData.attendanceRecordsCount}
              </div>
              <span className="text-[10px] text-neutral-400">Calculated paired records</span>
            </div>
            <div className="p-4 rounded-2xl bg-neutral-100/70 dark:bg-white/[0.03] border border-neutral-200/70 dark:border-white/5">
              <span className="text-[11px] text-neutral-500 font-medium">Exceptions Flagged</span>
              <div className="text-2xl font-bold font-mono text-amber-500 mt-1">
                {importSuccessData.exceptionsCount}
              </div>
              <span className="text-[10px] text-amber-600 dark:text-amber-400">Requires review</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4 border-t border-neutral-200 dark:border-white/5">
            <Button
              variant="primary"
              size="md"
              rightIcon={<ArrowRight className="w-4 h-4" />}
              onClick={() => setCurrentPage('overview')}
              className="w-full sm:w-auto font-semibold px-6"
            >
              View Overview
            </Button>
            <Button
              variant="outline"
              size="md"
              onClick={() => setCurrentPage('daily-attendance')}
              className="w-full sm:w-auto text-xs"
            >
              View Daily Attendance Log
            </Button>
            <Button
              variant="ghost"
              size="md"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => {
                setImportSuccessData(null);
                resetDataset();
              }}
              className="w-full sm:w-auto text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
            >
              Import Another File
            </Button>
          </div>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* Step Progress Bar */}
          <GlassCard className="p-4 sm:p-5">
            <div className="flex items-center justify-between overflow-x-auto gap-2 pb-2 sm:pb-0">
              {steps.map((s, idx) => {
                const isCompleted = activeSetupStep > s.num;
                const isCurrent = activeSetupStep === s.num;
                return (
                  <button
                    key={s.num}
                    onClick={() => {
                      if (s.num > 1 && !parsedDataset) {
                        addToast('Please upload or load a biometric file first', 'warning');
                        return;
                      }
                      setActiveSetupStep(s.num);
                    }}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-full transition-all text-left whitespace-nowrap cursor-pointer ${
                      isCurrent
                        ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 shadow-sm font-semibold'
                        : isCompleted
                        ? 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-white/5'
                        : 'text-neutral-400 dark:text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isCurrent
                          ? 'bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-neutral-200 dark:bg-white/10 text-neutral-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-3 h-3" /> : s.num}
                    </span>
                    <span className="text-xs">{s.label}</span>
                    {idx < steps.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-neutral-400 opacity-40 ml-1" />
                    )}
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* STEP 1: Upload Biometric File */}
          {(activeSetupStep === 1 || !parsedDataset) && (
            <div className="space-y-6">
              {parsedDataset && (
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-neutral-900 dark:text-white">
                        Active File Loaded: {parsedDataset.file.fileName}
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        {parsedDataset.employees.length} employees detected · {parsedDataset.allPunches.length} raw punches parsed
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetDataset}
                      className="text-xs text-rose-500 hover:bg-rose-500/10 border-rose-500/20"
                    >
                      Clear File
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      rightIcon={<ArrowRight className="w-4 h-4" />}
                      onClick={() => setActiveSetupStep(2)}
                      className="text-xs"
                    >
                      Proceed to Step 2: Data Detected
                    </Button>
                  </div>
                </div>
              )}

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isProcessingUpload && fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center p-8 sm:p-14 rounded-3xl border-2 border-dashed transition-all duration-200 cursor-pointer text-center select-none ${
                  isDragging
                    ? 'border-white/40 bg-white/5 scale-[0.99]'
                    : 'border-neutral-300 dark:border-white/10 bg-neutral-50/50 dark:bg-white/[0.02] hover:border-neutral-400 dark:hover:border-white/20'
                }`}
              >
                <input
                  ref={fileInputRef}
                  id="biometric-file-input"
                  type="file"
                  accept=".txt,.csv,.tsv,.dat,.log,text/plain,text/csv,text/tab-separated-values,*/*"
                  onChange={handleFileInputChange}
                  onClick={(e) => e.stopPropagation()}
                  className="hidden"
                />

                {isProcessingUpload ? (
                  <div className="flex flex-col items-center max-w-md w-full space-y-4">
                    <div className="w-12 h-12 rounded-full border-2 border-neutral-300 dark:border-white/10 border-t-sky-500 animate-spin" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {processingStage}
                      </p>
                      <p className="text-xs text-neutral-500 font-mono">
                        {uploadProgress}% · {processingStage}
                      </p>
                    </div>
                    <div className="w-full bg-neutral-200 dark:bg-white/10 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-sky-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4 max-w-lg">
                    <div className="w-14 h-14 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <UploadCloud className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                        Step 1: Upload Raw Biometric Export File
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md leading-relaxed">
                        Drag and drop your biometric logs, or click below to choose a file.
                        Accepts tab-separated, comma-separated, or space-aligned biometric exports (.txt, .csv, .tsv, etc.).
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-neutral-200/80 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-300/60 dark:border-white/5">
                        .TXT (Tab-separated)
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-neutral-200/80 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-300/60 dark:border-white/5">
                        .CSV / .TSV
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-neutral-200/80 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-300/60 dark:border-white/5">
                        Space-Aligned
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono bg-neutral-200/80 dark:bg-white/5 text-neutral-600 dark:text-neutral-300 border border-neutral-300/60 dark:border-white/5">
                        Any Text Export
                      </span>
                    </div>
                    <div className="pt-2">
                      <Button
                        id="upload-biometric-file-btn"
                        type="button"
                        variant="primary"
                        size="md"
                        leftIcon={<UploadCloud className="w-4 h-4" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="text-xs font-semibold shadow-sm"
                      >
                        Upload Biometric File
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Action Card for Instant Testing */}
              <GlassCard className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        Instant Enterprise Demonstration Dataset
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                        Load verified sample biometric logs for VR Constructions (9 employees, 48 records,
                        covering shifts, late arrivals, lunch pairing, single punches, and multi-month logs).
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Play className="w-4 h-4 fill-current" />}
                    onClick={loadSampleDataset}
                    className="shrink-0 text-xs"
                  >
                    Load Sample Biometric File
                  </Button>
                </div>
              </GlassCard>
            </div>
          )}

          {/* STEP 2: Data Detected */}
          {activeSetupStep === 2 && parsedDataset && (
            <div className="space-y-6">
              <GlassCard className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 dark:border-white/5 gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      Step 2: Biometric Data Detected Successfully
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      The biometric file was parsed and structured. Enrollment Number (EnNo) is
                      used as the primary immutable employee identifier.
                    </p>
                  </div>
                  <Badge variant="success" dot>
                    Source Verified
                  </Badge>
                </div>

                {/* Primary Metric Cards matching user requirements */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
                  <div className="p-3.5 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                    <span className="text-[11px] text-neutral-500 font-medium">Total Rows Detected</span>
                    <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
                      {parsedDataset.summary?.totalRowsDetected ?? parsedDataset.allPunches.length}
                    </div>
                    <span className="text-[10px] text-neutral-400">Total lines parsed</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Valid Rows</span>
                    <div className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                      {parsedDataset.summary?.validRowsCount ?? parsedDataset.validPunches.length}
                    </div>
                    <span className="text-[10px] text-neutral-400">Ready for calculation</span>
                  </div>

                  <div className={`p-3.5 rounded-2xl border ${
                    (parsedDataset.summary?.invalidRowsCount ?? 0) > 0
                      ? 'bg-amber-500/5 border-amber-500/20'
                      : 'bg-neutral-100/60 dark:bg-white/[0.03] border-neutral-200/60 dark:border-white/5'
                  }`}>
                    <span className={`text-[11px] font-medium ${
                      (parsedDataset.summary?.invalidRowsCount ?? 0) > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-neutral-500'
                    }`}>
                      Invalid Rows
                    </span>
                    <div className={`text-lg font-bold font-mono mt-1 ${
                      (parsedDataset.summary?.invalidRowsCount ?? 0) > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-neutral-900 dark:text-neutral-100'
                    }`}>
                      {parsedDataset.summary?.invalidRowsCount ?? parsedDataset.anomalies.length}
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      {(parsedDataset.summary?.invalidRowsCount ?? 0) > 0 ? 'Quarantined / noted' : 'Clean export'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                    <span className="text-[11px] text-neutral-500 font-medium">Employees Detected</span>
                    <div className="text-lg font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
                      {parsedDataset.summary?.employeesCount ?? parsedDataset.employees.length}
                    </div>
                    <span className="text-[10px] text-neutral-400">Distinct EnNo roster</span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                    <span className="text-[11px] text-neutral-500 font-medium">Date Range</span>
                    <div className="text-xs font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1 truncate">
                      {parsedDataset.firstDate || parsedDataset.dateRange?.startDate}
                    </div>
                    <span className="text-[10px] text-neutral-400 truncate block">
                      to {parsedDataset.lastDate || parsedDataset.dateRange?.endDate}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                    <span className="text-[11px] text-sky-600 dark:text-sky-400 font-medium">Months Detected</span>
                    <div className="text-lg font-bold font-mono text-sky-600 dark:text-sky-400 mt-1">
                      {parsedDataset.availableMonths.length}
                    </div>
                    <span className="text-[10px] text-neutral-400">
                      Active: {selectedMonthKey}
                    </span>
                  </div>
                </div>

                {/* Source File & Delimiter Details */}
                <div className="mt-4 p-3.5 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/50 dark:border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400 font-medium">Source File:</span>
                    <span className="font-mono font-semibold text-neutral-800 dark:text-neutral-200">
                      {parsedDataset.file.fileName}
                    </span>
                    <span className="text-neutral-400">
                      ({(((parsedDataset.file.fileSizeBytes || parsedDataset.file.size || 0) / 1024)).toFixed(1)} KB)
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-md bg-neutral-200/60 dark:bg-white/10 font-mono text-[11px] text-neutral-700 dark:text-neutral-300">
                      Format: Text Export
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] border border-emerald-500/20">
                      Parsed & Ready
                    </span>
                  </div>
                </div>

                {/* Warnings / Anomaly Breakdown if malformed rows were quarantined */}
                {(parsedDataset.anomalies.length > 0 || (parsedDataset.summary?.invalidRowsCount ?? 0) > 0) && (
                  <div className="mt-4 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {parsedDataset.anomalies.length} Row(s) Skipped or Flagged for Review
                        </span>
                      </div>
                      <span className="text-[11px] text-neutral-500">
                        Valid punch rows are retained and will be imported; malformed rows are quarantined.
                      </span>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                      {parsedDataset.anomalies.slice(0, 8).map((ano, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-lg bg-white/60 dark:bg-black/20 text-xs border border-amber-500/10 font-mono"
                        >
                          <span className="text-amber-700 dark:text-amber-400">
                            {ano.sourceRowNumber ? `Row #${ano.sourceRowNumber}` : `Item #${idx + 1}`}
                          </span>
                          <span className="text-neutral-600 dark:text-neutral-300 truncate max-w-md">
                            {ano.rawLineSource || ano.rawLine || ano.anomalyReason || 'Anomaly row'}
                          </span>
                          <span className="text-[10px] text-neutral-400">{ano.anomalyReason || 'Quarantined'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Available Months Selector if biometric data imported */}
                {parsedDataset.availableMonths.length > 0 && (
                  <div className="mt-6 p-4 rounded-2xl bg-sky-500/5 border border-sky-500/15">
                    <label className="block text-xs font-semibold text-neutral-900 dark:text-neutral-100 mb-2">
                      Select Period for Calculation & Immediate Review:
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMonthKey('OVERALL');
                          setActiveMonthKey('OVERALL');
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          !selectedMonthKey || selectedMonthKey === 'OVERALL' || selectedMonthKey === 'Overall'
                            ? 'bg-sky-600 text-white shadow-sm font-semibold'
                            : 'bg-white dark:bg-white/5 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'
                        }`}
                      >
                        Overall ({parsedDataset.firstDate} — {parsedDataset.lastDate})
                      </button>

                      {[...parsedDataset.availableMonths]
                        .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
                        .map((m) => (
                          <button
                            key={m.monthKey}
                            type="button"
                            onClick={() => {
                              setSelectedMonthKey(m.monthKey);
                              setActiveMonthKey(m.monthKey);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                              selectedMonthKey === m.monthKey
                                ? 'bg-sky-600 text-white shadow-sm font-semibold'
                                : 'bg-white dark:bg-white/5 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-white/10 hover:bg-neutral-100 dark:hover:bg-white/10'
                            }`}
                          >
                            {m.label || m.monthLabel} ({m.recordCount ?? m.punchCount} punches)
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between mt-8 pt-4 border-t border-neutral-200 dark:border-white/5">
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<ArrowLeft className="w-4 h-4" />}
                    onClick={() => setActiveSetupStep(1)}
                    className="text-xs"
                  >
                    Back to Upload
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<ArrowRight className="w-4 h-4" />}
                    onClick={() => setActiveSetupStep(3)}
                    className="text-xs font-semibold"
                  >
                    Proceed to Step 3: Office Settings
                  </Button>
                </div>
              </GlassCard>
            </div>
          )}

          {/* STEP 3: Office Settings */}
          {activeSetupStep === 3 && parsedDataset && (
            <GlassCard className="p-6">
              <div className="pb-4 border-b border-neutral-200 dark:border-white/5">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Step 3: Office Settings & Lunch Deductions
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Define official working hours for VR Constructions. Standard shift runs 10:00 AM to 6:00 PM with 1-hour lunch break.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Shift Start Time
                  </label>
                  <input
                    type="time"
                    value={officeConfig.officeStart}
                    onChange={(e) => updateOfficeConfig({ officeStart: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono"
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Grace period: {officeConfig.graceMinutesLate}m (Late marked after 10:15)
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Shift End Time
                  </label>
                  <input
                    type="time"
                    value={officeConfig.officeEnd}
                    onChange={(e) => updateOfficeConfig({ officeEnd: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono"
                  />
                  <span className="text-[11px] text-neutral-400 mt-1 block">
                    Official logout time (Early departures flagged if before 18:00)
                  </span>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    Mandatory Lunch Deduction (Minutes)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={120}
                      value={officeConfig.lunchDurationMinutes}
                      onChange={(e) =>
                        updateOfficeConfig({
                          lunchDurationMinutes: parseInt(e.target.value, 10) || 0,
                          defaultLunchDeductionHours: (parseInt(e.target.value, 10) || 0) / 60,
                        })
                      }
                      className="w-32 px-3 py-2 rounded-xl text-xs bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono"
                    />
                    <span className="text-xs text-neutral-500">
                      Standard: 60 mins (1.0h) deducted from gross shift duration
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8 pt-4 border-t border-neutral-200 dark:border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setActiveSetupStep(2)}
                  className="text-xs"
                >
                  Back to Data Detected
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setActiveSetupStep(4)}
                  className="text-xs font-semibold"
                >
                  Next: Configure Holidays
                </Button>
              </div>
            </GlassCard>
          )}

          {/* STEP 4: Holidays Configuration */}
          {activeSetupStep === 4 && (
            <GlassCard className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 dark:border-white/5 gap-4">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Step 4: Company & Public Holidays ({selectedMonthKey})
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Did VR Constructions observe any official company or public holidays this month?
                    Sundays are automatically excluded by the engine.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Calendar className="w-4 h-4 text-amber-500" />}
                  onClick={() => setIsHolidayModalOpen(true)}
                  className="text-xs shrink-0"
                >
                  Holiday Calendar Manager
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                {/* Form to add holiday */}
                <div className="p-4 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5 space-y-4">
                  <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    Add Holiday Date
                  </h4>
                  <form onSubmit={handleAddHolidaySubmit} className="space-y-3">
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-1">Holiday Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Independence Day, Site Maintenance"
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-neutral-500 mb-1">Holiday Date</label>
                      <input
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono"
                      />
                    </div>
                    <Button type="submit" variant="primary" size="sm" className="w-full text-xs">
                      Register Holiday
                    </Button>
                  </form>
                </div>

                {/* List of registered holidays */}
                <div className="md:col-span-2 space-y-3">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span className="font-medium">Active Holidays for {selectedMonthKey}</span>
                    <span>{currentMonthHolidays.length} registered</span>
                  </div>

                  {currentMonthHolidays.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 text-center">
                      <Calendar className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-50" />
                      <p className="text-xs text-neutral-500">
                        No additional public or company holidays registered for this month.
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Sundays ({calculatedData?.sundaysCount || 4} days) are automatically deducted.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {currentMonthHolidays.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-neutral-100/80 dark:bg-white/[0.04] border border-neutral-200/50 dark:border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            <div>
                              <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                {h.name}
                              </p>
                              <p className="text-[11px] font-mono text-neutral-500">{h.date}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHoliday(h.id)}
                            className="text-neutral-400 hover:text-rose-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between mt-8 pt-4 border-t border-neutral-200 dark:border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setActiveSetupStep(3)}
                  className="text-xs"
                >
                  Back to Office Settings
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setActiveSetupStep(5)}
                  className="text-xs font-semibold"
                >
                  Next: Employee Leave
                </Button>
              </div>
            </GlassCard>
          )}

          {/* STEP 5: Employee Leave Records */}
          {activeSetupStep === 5 && (
            <GlassCard className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-200 dark:border-white/5 gap-4">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    Step 5: Employee Leave ({selectedMonthKey})
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Select detected employees from the biometric file and assign approved leaves.
                    Approved leaves are subtracted from expected working days and will NOT count as absences.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {currentMonthLeaves.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearMonthLeaves}
                      className="text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                    >
                      Clear All Leaves ({currentMonthLeaves.length})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    leftIcon={<Layers className="w-4 h-4 text-sky-500" />}
                    onClick={() => setIsBatchLeaveModalOpen(true)}
                    className="text-xs"
                  >
                    Batch Multi-Employee Leave
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
                {/* Left Column: Multi-Employee Roster Selector */}
                <div className="lg:col-span-6 p-4 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-sky-500" />
                      Select Employees ({selectedLeaveEmpIds.length} of {parsedDataset.employees.length} selected)
                    </span>
                    <button
                      type="button"
                      onClick={toggleSelectAllLeaveEmployees}
                      className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
                    >
                      {selectedLeaveEmpIds.length === filteredLeaveEmployees.length
                        ? 'Deselect All'
                        : `Select All (${filteredLeaveEmployees.length})`}
                    </button>
                  </div>

                  {/* Search filter */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Search employees by name or EnNo..."
                      value={leaveEmployeeSearch}
                      onChange={(e) => setLeaveEmployeeSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  {/* Scrollable employee checkboxes */}
                  <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                    {filteredLeaveEmployees.length === 0 ? (
                      <p className="text-xs text-neutral-400 p-4 text-center">
                        No matching employees found for &quot;{leaveEmployeeSearch}&quot;
                      </p>
                    ) : (
                      filteredLeaveEmployees.map((emp) => {
                        const isSelected = selectedLeaveEmpIds.includes(emp.employeeId);
                        const punchCount = parsedDataset.punchesByEmployee[emp.employeeId]?.length || 0;
                        return (
                          <div
                            key={emp.employeeId}
                            onClick={() => toggleSelectLeaveEmployee(emp.employeeId)}
                            className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors text-xs border ${
                              isSelected
                                ? 'bg-sky-500/10 border-sky-500/30 text-sky-900 dark:text-sky-200'
                                : 'bg-white dark:bg-white/5 border-neutral-200/60 dark:border-white/5 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-white/[0.08]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="shrink-0 text-sky-500">
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4" />
                                ) : (
                                  <Square className="w-4 h-4 text-neutral-400" />
                                )}
                              </span>
                              <div className="min-w-0">
                                <p className="font-semibold truncate">{emp.name}</p>
                                <p className="text-[10px] text-neutral-400 font-mono">
                                  EnNo: {emp.employeeId}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-mono bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300">
                              {punchCount} punches
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Right Column: Leave Parameters & Active Registered Leaves */}
                <div className="lg:col-span-6 space-y-4">
                  {/* Leave Parameters Form */}
                  <div className="p-4 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5 space-y-3">
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                      Configure Leave Details
                    </h4>

                    {/* Single vs Range Mode */}
                    <div className="flex items-center gap-4 pt-1">
                      <label className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                        <input
                          type="radio"
                          name="leaveMode"
                          checked={leaveDateMode === 'single'}
                          onChange={() => setLeaveDateMode('single')}
                          className="text-sky-500 focus:ring-sky-500"
                        />
                        Single Date
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                        <input
                          type="radio"
                          name="leaveMode"
                          checked={leaveDateMode === 'range'}
                          onChange={() => setLeaveDateMode('range')}
                          className="text-sky-500 focus:ring-sky-500"
                        />
                        Date Range (From – To)
                      </label>
                    </div>

                    <form onSubmit={handleAssignBatchLeaveSubmit} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {leaveDateMode === 'single' ? (
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] text-neutral-500 mb-1">Leave Date</label>
                            <input
                              type="date"
                              value={leaveDate}
                              onChange={(e) => setLeaveDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono"
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-[11px] text-neutral-500 mb-1">Start Date</label>
                              <input
                                type="date"
                                value={leaveDate}
                                onChange={(e) => setLeaveDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] text-neutral-500 mb-1">End Date</label>
                              <input
                                type="date"
                                value={leaveEndDate}
                                onChange={(e) => setLeaveEndDate(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 font-mono"
                              />
                            </div>
                          </>
                        )}

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] text-neutral-500 mb-1">Leave Category</label>
                          <select
                            value={leaveType}
                            onChange={(e) => setLeaveType(e.target.value as LeaveType)}
                            className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100"
                          >
                            <option value="CASUAL">Casual Leave (CL)</option>
                            <option value="SICK">Sick Leave (SL)</option>
                            <option value="PERSONAL">Personal Leave</option>
                            <option value="EARNED">Earned Leave (EL)</option>
                            <option value="OTHER">Other / Site Duty</option>
                          </select>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        size="sm"
                        disabled={selectedLeaveEmpIds.length === 0 || !leaveDate || (leaveDateMode === 'range' && !leaveEndDate)}
                        className="w-full text-xs font-semibold"
                      >
                        Assign Leave to {selectedLeaveEmpIds.length} Selected Employee(s)
                      </Button>
                    </form>
                  </div>

                  {/* Registered Leaves List */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span className="font-medium">Registered Leaves for {selectedMonthKey}</span>
                      <span>{currentMonthLeaves.length} approved records</span>
                    </div>

                    {currentMonthLeaves.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-dashed border-neutral-200 dark:border-white/10 text-center">
                        <UserCheck className="w-7 h-7 text-neutral-400 mx-auto mb-1.5 opacity-50" />
                        <p className="text-xs text-neutral-500">
                          No approved leave registered for this month yet.
                        </p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">
                          Employees with zero punches on working days will be flagged as Absent.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {currentMonthLeaves.map((l) => (
                          <div
                            key={l.id}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-100/80 dark:bg-white/[0.04] border border-neutral-200/50 dark:border-white/5"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
                              <div>
                                <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                                  {l.employeeName}{' '}
                                  <span className="font-mono text-[10px] text-neutral-400">
                                    ({l.employeeId})
                                  </span>
                                </p>
                                <p className="text-[11px] text-neutral-500 font-mono">
                                  {l.date} • {l.leaveType}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLeaveRecord(l.id)}
                              className="text-neutral-400 hover:text-rose-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between mt-8 pt-4 border-t border-neutral-200 dark:border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setActiveSetupStep(4)}
                  className="text-xs"
                >
                  Back to Holidays
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                  onClick={() => setActiveSetupStep(6)}
                  className="text-xs font-semibold"
                >
                  Next: Review & Confirm
                </Button>
              </div>
            </GlassCard>
          )}

          {/* STEP 6: Review & Confirm */}
          {activeSetupStep === 6 && (
            <GlassCard className="p-6 space-y-6">
              <div className="pb-4 border-b border-neutral-200 dark:border-white/5">
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Step 6: Review Summary & Confirm Import ({selectedMonthKey})
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Confirm parsed biometric metrics, validation results, and employee summaries before saving into persistent relational storage.
                </p>
              </div>

              {/* Data Review breakdown cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                  <span className="text-[11px] text-neutral-500 font-medium">Month Workspace</span>
                  <div className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                    {calculatedData?.monthLabel || selectedMonthKey}
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {calculatedData?.calendarDaysCount || 30} Total Calendar Days
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                  <span className="text-[11px] text-neutral-500 font-medium">Expected Working Days</span>
                  <div className="text-xl font-bold font-mono text-emerald-500 mt-1">
                    {calculatedData?.expectedWorkingDays || 26}
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    Excludes {calculatedData?.sundaysCount} Sundays, {currentMonthHolidays.length} Holidays
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                  <span className="text-[11px] text-neutral-500 font-medium">Active Personnel</span>
                  <div className="text-xl font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
                    {parsedDataset.employees.length}
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {currentMonthLeaves.length} Approved Leaves Registered
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5">
                  <span className="text-[11px] text-neutral-500 font-medium">Shift & Lunch</span>
                  <div className="text-xs font-bold font-mono text-neutral-900 dark:text-neutral-100 mt-1">
                    {officeConfig.officeStart} - {officeConfig.officeEnd}
                  </div>
                  <span className="text-[10px] text-neutral-400">
                    {officeConfig.lunchDurationMinutes}m Lunch Deduction
                  </span>
                </div>
              </div>

              {/* Validation Summary breakdown */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    Validation Summary (Actual Parsed Values)
                  </span>
                  <Badge variant="neutral">
                    {parsedDataset.firstDate || parsedDataset.dateRange?.startDate} to{' '}
                    {parsedDataset.lastDate || parsedDataset.dateRange?.endDate}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200/50 dark:border-white/5">
                    <span className="text-[10px] text-neutral-400">Total Punches Ingested</span>
                    <p className="font-mono font-bold text-neutral-900 dark:text-white mt-0.5">
                      {parsedDataset.allPunches.length} records
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200/50 dark:border-white/5">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Valid Punches</span>
                    <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {parsedDataset.validPunches.length} records
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200/50 dark:border-white/5">
                    <span className="text-[10px] text-neutral-400">Duplicate Punches Removed</span>
                    <p className="font-mono font-bold text-neutral-500 mt-0.5">
                      {parsedDataset.duplicatePunches.length} filtered
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white dark:bg-white/5 border border-neutral-200/50 dark:border-white/5">
                    <span className="text-[10px] text-amber-500">Needs Review / Anomalies</span>
                    <p className="font-mono font-bold text-amber-500 mt-0.5">
                      {parsedDataset.anomalies.length} records
                    </p>
                  </div>
                </div>
              </div>

              {/* Compact Employee Summary Table */}
              <div className="p-4 rounded-2xl bg-neutral-100/60 dark:bg-white/[0.03] border border-neutral-200/60 dark:border-white/5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-sky-500" />
                      Employee Monthly Summary Preview ({filteredSummaryEmployees.length} personnel)
                    </h4>
                    <p className="text-[11px] text-neutral-500">
                      Calculated attendance metrics derived deterministically from biometric punch pairs.
                    </p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Filter summary..."
                      value={summarySearchQuery}
                      onChange={(e) => setSummarySearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-neutral-200/60 dark:border-white/5">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-neutral-200/50 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 text-[11px]">
                      <tr>
                        <th className="p-2.5 font-medium">Employee</th>
                        <th className="p-2.5 font-medium text-center">Punches</th>
                        <th className="p-2.5 font-medium text-center">Present</th>
                        <th className="p-2.5 font-medium text-center">Leave</th>
                        <th className="p-2.5 font-medium text-center">Absent</th>
                        <th className="p-2.5 font-medium text-center">Single</th>
                        <th className="p-2.5 font-medium text-right">Attendance %</th>
                        <th className="p-2.5 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200/50 dark:divide-white/5 bg-white dark:bg-transparent">
                      {filteredSummaryEmployees.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-neutral-400">
                            No employee summary records found.
                          </td>
                        </tr>
                      ) : (
                        filteredSummaryEmployees.map((emp) => {
                          const totalPunches = parsedDataset.punchesByEmployee[emp.employeeId]?.length || 0;
                          return (
                            <tr key={emp.employeeId} className="hover:bg-neutral-50/50 dark:hover:bg-white/[0.02]">
                              <td className="p-2.5 font-medium">
                                <div className="text-neutral-900 dark:text-neutral-100">{emp.employeeName}</div>
                                <div className="text-[10px] text-neutral-400 font-mono">EnNo: {emp.employeeId}</div>
                              </td>
                              <td className="p-2.5 text-center font-mono">{totalPunches}</td>
                              <td className="p-2.5 text-center font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                                {emp.presentDays}
                              </td>
                              <td className="p-2.5 text-center font-mono text-sky-600 dark:text-sky-400">
                                {emp.approvedLeaveDays}
                              </td>
                              <td className="p-2.5 text-center font-mono text-rose-600 dark:text-rose-400">
                                {emp.absentDays}
                              </td>
                              <td className="p-2.5 text-center font-mono text-amber-500">
                                {emp.singlePunchDays}
                              </td>
                              <td className="p-2.5 text-right font-mono font-bold">
                                {emp.attendancePercentage}%
                              </td>
                              <td className="p-2.5 text-center">
                                {emp.singlePunchDays > 0 ? (
                                  <Badge variant="warning">Single Punch ({emp.singlePunchDays})</Badge>
                                ) : emp.absentDays > 0 ? (
                                  <Badge variant="error">Absent ({emp.absentDays})</Badge>
                                ) : emp.approvedLeaveDays > 0 ? (
                                  <Badge variant="info">Leave ({emp.approvedLeaveDays})</Badge>
                                ) : (
                                  <Badge variant="success">Normal (100%)</Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Transaction Execution Details & Progress State */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  Deterministic Relational Storage & Multi-Month Isolation
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
                  Clicking <strong>Confirm & Import to Database</strong> will persist all master employees,
                  raw punch records, monthly calendar definitions, and holiday/leave assignments into IndexedDB
                  and local storage. Your records will persist across browser reloads, and months remain strictly
                  isolated.
                </p>

                {/* If error during commit */}
                {commitError && (
                  <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-semibold">
                      <AlertCircle className="w-4 h-4 text-rose-500" />
                      Import failed. Your attendance data was not imported. Nothing was changed.
                    </div>
                    <p className="text-[11px] opacity-90">{commitError}</p>
                    <div className="pt-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleConfirmImportAndProceed}
                        className="text-xs"
                      >
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}

                {/* Progress bar during active commit */}
                {isCommitting && (
                  <div className="p-4 rounded-xl bg-white dark:bg-black/40 border border-neutral-200 dark:border-white/10 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-neutral-900 dark:text-white">
                        {commitStageText}
                      </span>
                      <span className="font-mono text-emerald-500 font-bold">{commitProgress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-neutral-200 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                        style={{ width: `${commitProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-neutral-200 dark:border-white/5">
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  onClick={() => setActiveSetupStep(5)}
                  disabled={isCommitting}
                  className="text-xs"
                >
                  Back to Employee Leave
                </Button>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage('daily-attendance')}
                    disabled={isCommitting}
                    className="text-xs"
                  >
                    View Daily Attendance Log
                  </Button>
                  <Button
                    variant="primary"
                    size="md"
                    rightIcon={<Database className="w-4 h-4" />}
                    onClick={handleConfirmImportAndProceed}
                    disabled={isCommitting}
                    className="text-xs font-semibold"
                  >
                    {isCommitting ? 'Importing...' : 'Confirm & Import to Database'}
                  </Button>
                </div>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Verification Test Suite Modal */}
      {isTestModalOpen && testResults && (
        <Modal
          isOpen={isTestModalOpen}
          onClose={() => setIsTestModalOpen(false)}
          title="Attendance Engine Verification Audit Suite"
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-100 dark:bg-white/5">
              <div className="flex items-center gap-2">
                {testResults.allPassed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {testResults.allPassed
                      ? `All Deterministic Core Rules Passed (${testResults.results.filter((r) => r.passed).length} / ${testResults.results.length})`
                      : `Rule Discrepancies Detected (${testResults.results.filter((r) => !r.passed).length} failed)`}
                  </h4>
                  <p className="text-[11px] text-neutral-500">
                    Automated mathematical test suite validating requirements from Part 2.
                  </p>
                </div>
              </div>
              <Badge variant={testResults.allPassed ? 'success' : 'error'}>
                {testResults.allPassed ? 'VERIFIED' : 'FAILED'}
              </Badge>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {testResults.results.map((r, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200 dark:border-white/5 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                      {r.name}
                    </span>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        r.passed
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'bg-rose-500/10 text-rose-500 font-bold'
                      }`}
                    >
                      {r.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-neutral-500">
                    <div>Expected: {r.expected}</div>
                    <div>Actual: {r.actual}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsTestModalOpen(false)}
                className="text-xs"
              >
                Close Audit
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Duplicate Import Protection Modal */}
      {isDuplicateModalOpen && duplicateImport && pendingParsedData && (
        <DuplicateImportModal
          isOpen={isDuplicateModalOpen}
          onClose={() => {
            setIsDuplicateModalOpen(false);
            setPendingParsedData(null);
            setDuplicateImport(null);
          }}
          existingImport={duplicateImport}
          newFileName={pendingParsedData.file.name}
          newFileSize={pendingParsedData.file.size}
          onViewExisting={() => {
            setIsDuplicateModalOpen(false);
            const mKey = duplicateImport.date_from.substring(0, 7);
            setActiveMonthKey(mKey);
            setSelectedMonthKey(mKey);
            setCurrentPage('overview');
            addToast(`Switched to existing imported month: ${mKey}`, 'info');
          }}
          onImportAnyway={() => {
            setIsDuplicateModalOpen(false);
            setUploadedFileAndDataset(pendingParsedData);
            addToast('Proceeding with re-import into workspace', 'info');
          }}
          onCancel={() => {
            setIsDuplicateModalOpen(false);
            setPendingParsedData(null);
            setDuplicateImport(null);
          }}
        />
      )}

      {/* Import History Modal */}
      <ImportHistoryModal
        isOpen={isImportHistoryOpen}
        onClose={() => setIsImportHistoryOpen(false)}
        onSelectImport={(imp) => {
          setIsImportHistoryOpen(false);
          const mKey = imp.date_from.substring(0, 7);
          setActiveMonthKey(mKey);
          setSelectedMonthKey(mKey);
          setCurrentPage('overview');
          addToast(`Loaded workspace for ${imp.file_name} (${mKey})`, 'success');
        }}
      />

      {/* Holiday Manager Modal */}
      <HolidayManagerModal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        activeMonthKey={selectedMonthKey || activeMonthKey || '2026-09'}
        monthKey={selectedMonthKey || activeMonthKey || '2026-09'}
        holidays={holidays}
        onAddHoliday={addHoliday}
        onRemoveHoliday={(dateOrId) => removeHoliday(dateOrId)}
      />

      {/* Batch Leave Modal */}
      <BatchLeaveModal
        isOpen={isBatchLeaveModalOpen}
        onClose={() => setIsBatchLeaveModalOpen(false)}
        activeMonthKey={selectedMonthKey || activeMonthKey || '2026-09'}
        monthKey={selectedMonthKey || activeMonthKey || '2026-09'}
        employees={parsedDataset?.employees || []}
        onSaveLeaves={(records) => {
          addBatchLeaves(records);
          setIsBatchLeaveModalOpen(false);
        }}
        onSaveBatch={(records) => {
          addBatchLeaves(records);
          setIsBatchLeaveModalOpen(false);
        }}
      />
    </PageContainer>
  );
};
