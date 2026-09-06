import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Users,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Filter,
  Search,
  Check,
  Sparkles,
  History,
  FileDown,
  ArrowRight,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { MonthSelector } from '../components/common/MonthSelector';
import {
  generateMonthlyAttendancePdf,
  generateEmployeeAttendancePdf,
  generateDailyAttendancePdf,
  generateExceptionsPdf,
  generateMonthlyExcelWorkbook,
  getRecentReports,
  RecentReportItem,
} from '../services/reportService';
import { ExportProgressModal, ExportProgressState } from '../components/common/ExportProgressModal';
import { useApp } from '../context/AppContext';
import { EmployeeAttendanceSummary } from '../types/attendance';

export const ReportsPage: React.FC = () => {
  const {
    calculatedData,
    parsedDataset,
    selectedEmployeeIdForProfile,
    setSelectedEmployeeIdForProfile,
    addToast,
    setCurrentPage,
  } = useApp();

  // Export filters
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(() => {
    return selectedEmployeeIdForProfile ? [selectedEmployeeIdForProfile] : [];
  });
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return calculatedData?.reportDate || '';
  });
  const [includeExceptions, setIncludeExceptions] = useState(true);
  const [includePunches, setIncludePunches] = useState(true);

  // Recent reports state
  const [recentReports, setRecentReports] = useState<RecentReportItem[]>(() => getRecentReports());

  // Export progress modal state
  const [modalState, setModalState] = useState<ExportProgressState>({
    isOpen: false,
    format: 'PDF',
    title: '',
    step: 'collecting',
    onClose: () => setModalState((prev) => ({ ...prev, isOpen: false })),
  });

  const employees = calculatedData?.employeeSummaries || [];

  const filteredEmployees = employees.filter((e) => {
    if (!employeeSearch.trim()) return true;
    const q = employeeSearch.toLowerCase();
    return e.employeeName.toLowerCase().includes(q) || e.employeeId.toLowerCase().includes(q);
  });

  const toggleEmployeeSelection = (id: string) => {
    setSelectedEmployeeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllEmployees = () => {
    setSelectedEmployeeIds(employees.map((e) => e.employeeId));
  };

  const handleClearAllEmployees = () => {
    setSelectedEmployeeIds([]);
  };

  // Generic runner for export with smooth progress animation
  const runExport = async (
    format: 'PDF' | 'EXCEL',
    title: string,
    exportFn: () => string
  ) => {
    if (!calculatedData) {
      addToast('No attendance dataset loaded for export', 'warning');
      return;
    }

    setModalState({
      isOpen: true,
      format,
      title,
      step: 'collecting',
      onClose: () => setModalState((prev) => ({ ...prev, isOpen: false })),
    });

    try {
      // Step 1 -> Step 2
      await new Promise((r) => setTimeout(r, 260));
      setModalState((prev) => ({ ...prev, step: 'calculating' }));

      // Step 2 -> Step 3
      await new Promise((r) => setTimeout(r, 320));
      setModalState((prev) => ({ ...prev, step: 'building' }));

      // Actual export execution
      await new Promise((r) => setTimeout(r, 280));
      const fileName = exportFn();

      // Step 4: Ready
      setModalState((prev) => ({
        ...prev,
        step: 'ready',
        fileName,
        onDownloadAgain: () => exportFn(),
      }));

      // Refresh recent reports
      setRecentReports(getRecentReports());
      addToast(`${title} generated successfully`, 'success');
    } catch (err: any) {
      console.error('Export error:', err);
      setModalState((prev) => ({
        ...prev,
        step: 'error',
        errorMessage: err?.message || 'Failed to generate report',
      }));
      addToast('Failed to generate report', 'error');
    }
  };

  /* ======================================================================== */
  /* REPORT ACTIONS                                                           */
  /* ======================================================================== */

  const handleExportMonthlyPdf = () => {
    if (!calculatedData) return;
    runExport('PDF', `Monthly Attendance Report (${calculatedData.monthLabel})`, () => {
      return generateMonthlyAttendancePdf(calculatedData);
    });
  };

  const handleExportMonthlyExcel = () => {
    if (!calculatedData) return;
    runExport('EXCEL', `Attendance Workbook (${calculatedData.monthLabel})`, () => {
      return generateMonthlyExcelWorkbook(
        calculatedData,
        parsedDataset?.validPunches,
        { includeExceptions, includePunches }
      );
    });
  };

  const handleExportEmployeePdf = (targetEmp?: EmployeeAttendanceSummary) => {
    if (!calculatedData) return;

    // If a specific employee is passed, generate for them
    // Otherwise if employees are checked in filter, generate for first checked or all checked
    const empToExport = targetEmp || employees.find((e) => selectedEmployeeIds.includes(e.employeeId)) || employees[0];

    if (!empToExport) {
      addToast('Please select at least one employee', 'warning');
      return;
    }

    const records = calculatedData.dailyRecords.filter((r) => r.employeeId === empToExport.employeeId);

    runExport('PDF', `Employee Report — ${empToExport.employeeName}`, () => {
      return generateEmployeeAttendancePdf(empToExport, records, calculatedData);
    });
  };

  const handleExportDailyPdf = () => {
    if (!calculatedData) return;
    const dateToUse = selectedDate || calculatedData.reportDate;
    const records = calculatedData.dailyRecords.filter((r) => r.date === dateToUse);

    if (records.length === 0) {
      addToast(`No attendance records found for date ${dateToUse}`, 'warning');
      return;
    }

    runExport('PDF', `Daily Attendance Report (${dateToUse})`, () => {
      return generateDailyAttendancePdf(dateToUse, records, calculatedData);
    });
  };

  const handleExportExceptionsPdf = () => {
    if (!calculatedData) return;
    runExport('PDF', `Exceptions Audit Report (${calculatedData.monthLabel})`, () => {
      return generateExceptionsPdf(calculatedData);
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Reports & Exports Hub"
        subtitle="Generate executive PDF reports and structured multi-sheet Excel workbooks from verified biometric data"
        action={<MonthSelector />}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Report Cards (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Standard Management Reports */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-500" />
                Management & Audit Reports
              </h3>
              <span className="text-xs text-neutral-400 font-mono">
                {calculatedData?.monthLabel || 'No data'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: Monthly Attendance Report */}
              <GlassCard className="p-5 flex flex-col justify-between space-y-4 hover:border-neutral-300 dark:hover:border-white/15 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <FileText className="w-5 h-5" />
                    </div>
                    <Badge variant="neutral" size="sm">Monthly Dossier</Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Monthly Attendance Report
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Complete executive summary, working day count, overall attendance percentage, and employee summary table with net hours.
                  </p>
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-white/5 flex items-center gap-2">
                  <Button
                    id="btn-export-monthly-pdf"
                    variant="primary"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleExportMonthlyPdf}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export PDF
                  </Button>
                  <Button
                    id="btn-export-monthly-excel"
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={handleExportMonthlyExcel}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                    Excel Workbook
                  </Button>
                </div>
              </GlassCard>

              {/* Card 2: Exceptions Audit Report */}
              <GlassCard className="p-5 flex flex-col justify-between space-y-4 hover:border-neutral-300 dark:hover:border-white/15 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <Badge variant="warning" size="sm">
                      {calculatedData?.exceptions.length || 0} Records
                    </Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Exceptions Audit Report
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Audit of unpaired single punches, checkout pending shifts, late arrivals past grace threshold, and resolution notes.
                  </p>
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-white/5 flex items-center gap-2">
                  <Button
                    id="btn-export-exceptions-pdf"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleExportExceptionsPdf}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export Exceptions PDF
                  </Button>
                </div>
              </GlassCard>

              {/* Card 3: Daily Attendance Verification */}
              <GlassCard className="p-5 flex flex-col justify-between space-y-4 hover:border-neutral-300 dark:hover:border-white/15 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <Badge variant="neutral" size="sm">Daily Roster</Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Daily Attendance Verification
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Detailed roster for a specific date, distinguishing present, unnotified absences, approved leaves, and incomplete punches.
                  </p>
                  <div className="pt-1">
                    <label className="text-[10px] text-neutral-400 uppercase tracking-wider block mb-1">
                      Audit Date
                    </label>
                    <input
                      type="date"
                      value={selectedDate || calculatedData?.reportDate || ''}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-white/5 flex items-center gap-2">
                  <Button
                    id="btn-export-daily-pdf"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={handleExportDailyPdf}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export Daily Verification PDF
                  </Button>
                </div>
              </GlassCard>

              {/* Card 4: Individual Employee Profile Report */}
              <GlassCard className="p-5 flex flex-col justify-between space-y-4 hover:border-neutral-300 dark:hover:border-white/15 transition-all">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                      <Users className="w-5 h-5" />
                    </div>
                    <Badge variant="neutral" size="sm">Individual Dossier</Badge>
                  </div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-white">
                    Employee Attendance Dossier
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                    Individual attendance dossier including day-by-day punches, gross/net working hours, late arrivals, and absence history.
                  </p>
                  <div className="pt-1">
                    <span className="text-[10px] text-neutral-400 block">
                      Target: {selectedEmployeeIds.length === 1 ? (
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {employees.find((e) => e.employeeId === selectedEmployeeIds[0])?.employeeName}
                        </span>
                      ) : (
                        <span className="text-neutral-500">
                          {selectedEmployeeIds.length > 1
                            ? `${selectedEmployeeIds.length} personnel selected in filter`
                            : 'Select an employee on the right'}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-100 dark:border-white/5 flex items-center gap-2">
                  <Button
                    id="btn-export-employee-pdf"
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    disabled={selectedEmployeeIds.length === 0}
                    onClick={() => handleExportEmployeePdf()}
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Export Dossier PDF
                  </Button>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Section 2: Comprehensive Multi-Sheet Excel Workbook */}
          <GlassCard className="p-5 border-emerald-500/20 dark:border-emerald-500/15">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                    Multi-Sheet Enterprise Excel Workbook (.xlsx)
                    <Badge variant="success" size="sm">5 Sheets</Badge>
                  </h4>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
                    Generates a master audit workbook containing: Executive Summary, Employee Summary, Daily Records, Exceptions, and Raw Punches with full machine traceability.
                  </p>
                  <div className="flex items-center gap-4 mt-3 text-xs text-neutral-600 dark:text-neutral-400">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeExceptions}
                        onChange={(e) => setIncludeExceptions(e.target.checked)}
                        className="rounded text-sky-500 focus:ring-0"
                      />
                      <span>Include Exceptions</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includePunches}
                        onChange={(e) => setIncludePunches(e.target.checked)}
                        className="rounded text-sky-500 focus:ring-0"
                      />
                      <span>Include Raw Punches</span>
                    </label>
                  </div>
                </div>
              </div>

              <Button
                id="btn-export-full-workbook"
                variant="primary"
                size="md"
                className="shrink-0 text-xs w-full sm:w-auto"
                onClick={handleExportMonthlyExcel}
              >
                <Download className="w-4 h-4 mr-2" />
                Generate Master Excel
              </Button>
            </div>
          </GlassCard>

          {/* Section 3: Recent Reports Audit Trail */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <History className="w-4 h-4 text-sky-500" />
                Recent Generated Reports
              </h3>
              <span className="text-xs text-neutral-400">
                {recentReports.length} {recentReports.length === 1 ? 'file' : 'files'}
              </span>
            </div>

            {recentReports.length === 0 ? (
              <GlassCard className="p-8 text-center space-y-2">
                <FileDown className="w-8 h-8 text-neutral-300 dark:text-neutral-600 mx-auto" />
                <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  No reports generated in this session yet
                </p>
                <p className="text-[11px] text-neutral-400">
                  Select any report card above to generate and download branded PDF or Excel files.
                </p>
              </GlassCard>
            ) : (
              <div className="rounded-xl border border-neutral-200 dark:border-white/5 divide-y divide-neutral-100 dark:divide-white/5 bg-white dark:bg-white/[0.01] overflow-hidden">
                {recentReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3.5 flex items-center justify-between hover:bg-neutral-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-white/5 flex items-center justify-center">
                        {rep.format === 'PDF' ? (
                          <FileText className="w-4 h-4 text-rose-500" />
                        ) : (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                        )}
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-neutral-900 dark:text-white block">
                          {rep.name}
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {rep.fileName} • {new Date(rep.generatedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={rep.format === 'PDF' ? 'neutral' : 'success'} size="sm">
                        {rep.format}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Employee Selection Drawer (1 col) */}
        <div className="space-y-4">
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-neutral-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-500" />
                Select Personnel
              </h4>
              <span className="text-[10px] font-mono text-sky-600 dark:text-sky-400 font-semibold">
                {selectedEmployeeIds.length} Selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name or ID..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-lg text-xs bg-neutral-100 dark:bg-white/5 border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white placeholder:text-neutral-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-1">
              <button
                onClick={handleSelectAllEmployees}
                className="text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
              >
                Select All ({employees.length})
              </button>
              <button
                onClick={handleClearAllEmployees}
                className="text-neutral-400 hover:underline cursor-pointer"
              >
                Clear All
              </button>
            </div>

            {/* Employee checklist */}
            <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmployeeIds.includes(emp.employeeId);
                return (
                  <div
                    key={emp.employeeId}
                    onClick={() => toggleEmployeeSelection(emp.employeeId)}
                    className={`p-2 rounded-lg flex items-center justify-between text-xs cursor-pointer border transition-colors ${
                      isSelected
                        ? 'bg-sky-500/10 border-sky-500/30 text-sky-900 dark:text-sky-200'
                        : 'bg-neutral-50 dark:bg-white/[0.02] border-transparent hover:border-neutral-200 dark:hover:border-white/10 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-sky-500 border-sky-500 text-white'
                            : 'border-neutral-300 dark:border-white/20'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                      <div className="min-w-0">
                        <span className="font-medium block truncate">{emp.employeeName}</span>
                        <span className="text-[10px] text-neutral-400 font-mono">EnNo: {emp.employeeId}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono font-bold">
                        {emp.attendancePercentage}%
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportEmployeePdf(emp);
                        }}
                        title="Download Dossier PDF directly"
                        className="p-1 rounded text-neutral-400 hover:text-sky-500 hover:bg-neutral-200/60 dark:hover:bg-white/10"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Quick AI Tip Card */}
          <GlassCard className="p-4 bg-sky-500/[0.03] border-sky-500/20">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-1">
                <h5 className="text-xs font-semibold text-neutral-900 dark:text-white">
                  Need custom insights?
                </h5>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  Use the <strong>Ask Attendance AI</strong> floating assistant at the bottom right to query absence rankings, individual shifts, or timing anomalies instantly.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Progress & Feedback Modal */}
      <ExportProgressModal {...modalState} />
    </PageContainer>
  );
};
