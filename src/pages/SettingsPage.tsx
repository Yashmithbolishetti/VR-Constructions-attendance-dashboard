import React, { useState } from 'react';
import {
  Building2,
  Clock,
  Calendar,
  Shield,
  Trash2,
  Plus,
  Save,
  Moon,
  Sun,
  Database,
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { PageHeader } from '../components/layout/PageHeader';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { OfficeConfig, Holiday } from '../types/attendance';

export const SettingsPage: React.FC = () => {
  const {
    officeConfig,
    updateOfficeConfig,
    holidays,
    addHoliday,
    removeHoliday,
    uploadedFile,
    setUploadedFile,
    addToast,
  } = useApp();

  const { isDark, toggleTheme } = useTheme();

  // Local state for office settings form
  const [formConfig, setFormConfig] = useState<OfficeConfig>(officeConfig);
  const [activeTab, setActiveTab] = useState<'office' | 'rules' | 'holidays' | 'theme' | 'data'>('office');

  React.useEffect(() => {
    setFormConfig(officeConfig);
  }, [officeConfig]);

  // Modal state for adding a holiday
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('2026-12-25');

  const handleSaveOfficeSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateOfficeConfig(formConfig);
  };

  const handleCreateHoliday = () => {
    if (!newHolidayName.trim()) return;
    addHoliday({
      name: newHolidayName.trim(),
      date: newHolidayDate,
    });
    setNewHolidayName('');
    setIsAddHolidayOpen(false);
  };

  const handleExportConfig = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' +
      encodeURIComponent(
        JSON.stringify(
          {
            company: 'VR Constructions',
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            officeConfig,
            holidays,
          },
          null,
          2
        )
      );
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'vr_constructions_attendance_config.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    addToast('Configuration exported as JSON', 'success');
  };

  return (
    <PageContainer maxWidth="6xl">
      <PageHeader
        title="Settings & Governance"
        subtitle="Manage office work shifts, 1-hour lunch deductions, holiday calendars, and data retention rules."
      />

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-white/[0.08] overflow-x-auto gap-6 text-xs md:text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('office')}
          className={`pb-3 font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'office'
              ? 'border-amber-600 dark:border-amber-400 text-neutral-900 dark:text-neutral-50'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Office Settings</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`pb-3 font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'rules'
              ? 'border-amber-600 dark:border-amber-400 text-neutral-900 dark:text-neutral-50'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Attendance Rules</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('holidays')}
          className={`pb-3 font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'holidays'
              ? 'border-amber-600 dark:border-amber-400 text-neutral-900 dark:text-neutral-50'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Holidays ({holidays.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('theme')}
          className={`pb-3 font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'theme'
              ? 'border-amber-600 dark:border-amber-400 text-neutral-900 dark:text-neutral-50'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Sun className="w-4 h-4" />
          <span>Appearance</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('data')}
          className={`pb-3 font-semibold transition-colors border-b-2 -mb-px whitespace-nowrap cursor-pointer flex items-center gap-2 ${
            activeTab === 'data'
              ? 'border-amber-600 dark:border-amber-400 text-neutral-900 dark:text-neutral-50'
              : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Data Governance</span>
        </button>
      </div>

      {/* Tab 1: Office Settings */}
      {activeTab === 'office' && (
        <form onSubmit={handleSaveOfficeSettings} className="space-y-6">
          <GlassCard variant="solid" padding="lg">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-neutral-100 dark:border-white/[0.06]">
              <div>
                <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Primary Office Schedule
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Configures standard shift boundaries used to calculate gross hours and flag late arrivals.
                </p>
              </div>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                leftIcon={<Save className="w-4 h-4" />}
              >
                Save Changes
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Office Name
                </label>
                <input
                  type="text"
                  value={formConfig.officeName}
                  onChange={(e) =>
                    setFormConfig({ ...formConfig, officeName: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Late Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  value={formConfig.graceMinutesLate}
                  onChange={(e) =>
                    setFormConfig({
                      ...formConfig,
                      graceMinutesLate: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Office Start Time
                </label>
                <input
                  type="text"
                  value={formConfig.officeStart}
                  onChange={(e) =>
                    setFormConfig({ ...formConfig, officeStart: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">Default: 10:00 AM</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Office End Time
                </label>
                <input
                  type="text"
                  value={formConfig.officeEnd}
                  onChange={(e) =>
                    setFormConfig({ ...formConfig, officeEnd: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">Default: 06:00 PM</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Lunch Break Window
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={formConfig.lunchStart}
                    onChange={(e) =>
                      setFormConfig({ ...formConfig, lunchStart: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 font-mono"
                  />
                  <input
                    type="text"
                    value={formConfig.lunchEnd}
                    onChange={(e) =>
                      setFormConfig({ ...formConfig, lunchEnd: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 font-mono"
                  />
                </div>
                <span className="text-[11px] text-neutral-400 mt-1 block">Default: 1:30 PM – 2:30 PM</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Default Lunch Deduction (Hours)
                </label>
                <input
                  type="number"
                  step="0.5"
                  value={formConfig.defaultLunchDeductionHours}
                  onChange={(e) =>
                    setFormConfig({
                      ...formConfig,
                      defaultLunchDeductionHours: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">Net Hours = Gross Hours - 1.0 Hour</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                  Total Number of Employees
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 10 (Leave blank for auto-detected)"
                  value={formConfig.totalEmployeesCount ?? ''}
                  onChange={(e) => {
                    const val = e.target.value.trim();
                    setFormConfig({
                      ...formConfig,
                      totalEmployeesCount: val ? parseInt(val, 10) : undefined,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono"
                />
                <span className="text-[11px] text-neutral-400 mt-1 block">
                  Office headcount benchmark. Used to reconcile absences: Absent = Total Employees − (Present + Leave).
                </span>
              </div>
            </div>
          </GlassCard>
        </form>
      )}

      {/* Tab 2: Attendance Rules */}
      {activeTab === 'rules' && (
        <GlassCard variant="solid" padding="lg" className="space-y-6">
          <div className="border-b border-neutral-100 dark:border-white/[0.06] pb-4">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Shift Evaluation Thresholds
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Deterministic thresholds for status computation in Part 2 calculation engine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.05] space-y-2">
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                Full-Day Qualification
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Net hours equal to or greater than <strong className="font-mono text-neutral-800 dark:text-neutral-200">8.0 hours</strong> mark the employee status as <span className="font-semibold text-emerald-600 dark:text-emerald-400">PRESENT</span>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.05] space-y-2">
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                Half-Day Qualification
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Net hours between <strong className="font-mono text-neutral-800 dark:text-neutral-200">4.5 hours</strong> and <strong className="font-mono text-neutral-800 dark:text-neutral-200">7.9 hours</strong> mark the day as <span className="font-semibold text-amber-600 dark:text-amber-400">HALF_DAY</span>.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.05] space-y-2">
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                Under-Hours / Short Shift
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Net hours less than <strong className="font-mono text-neutral-800 dark:text-neutral-200">4.5 hours</strong> without approved slip are flagged for HR review.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.05] space-y-2">
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                Late Mark Escalation
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                Punch-in after <strong className="font-mono text-neutral-800 dark:text-neutral-200">10:15 AM</strong> (10:00 AM + 15m grace) generates an exception flag in the monthly audit log.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tab 3: Holidays Configuration */}
      {activeTab === 'holidays' && (
        <GlassCard variant="solid" padding="lg" className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-white/[0.06]">
            <div>
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                VR Constructions Holiday Calendar
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Holidays are excluded from absent calculations and count towards paid days.
              </p>
            </div>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsAddHolidayOpen(true)}
            >
              Add Holiday
            </Button>
          </div>

          <div className="divide-y divide-neutral-100 dark:divide-white/[0.04]">
            {holidays.map((hol) => (
              <div
                key={hol.id}
                className="py-3.5 flex items-center justify-between gap-4 text-xs md:text-sm"
              >
                <div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {hol.name}
                  </div>
                  <div className="font-mono text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {hol.date}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeHoliday(hol.id)}
                  aria-label={`Remove ${hol.name}`}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Tab 4: Theme & Appearance */}
      {activeTab === 'theme' && (
        <GlassCard variant="solid" padding="lg" className="space-y-6">
          <div className="pb-4 border-b border-neutral-100 dark:border-white/[0.06]">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Appearance & Theme Tokens
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Toggle between Cinematic Graphite (Dark) and Crisp Enterprise Slate (Light).
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => isDark && toggleTheme()}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                !isDark
                  ? 'border-amber-500 bg-amber-50/20 dark:bg-amber-500/10'
                  : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <Sun className="w-6 h-6 text-amber-500" />
                {!isDark && <CheckCircle2 className="w-5 h-5 text-amber-600" />}
              </div>
              <div>
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Light Theme (Enterprise Slate)
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  High-contrast crisp white background with refined charcoal typography.
                </div>
              </div>
            </div>

            <div
              onClick={() => !isDark && toggleTheme()}
              className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                isDark
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-neutral-200 dark:border-white/10 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <Moon className="w-6 h-6 text-amber-400" />
                {isDark && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
              </div>
              <div>
                <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                  Dark Theme (Cinematic Graphite)
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  Near-black charcoal depth, soft glass surfaces, and restrained amber accents.
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tab 5: Data Governance */}
      {activeTab === 'data' && (
        <GlassCard variant="solid" padding="lg" className="space-y-6">
          <div className="pb-4 border-b border-neutral-100 dark:border-white/[0.06]">
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              Data Management & Audit Safety
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Policies governing raw biometric machine exports and configuration states.
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.05]">
              <div>
                <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  Export System Configuration
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Download office rules, lunch deduction parameters, and holiday list as JSON.
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileCode className="w-4 h-4" />}
                onClick={handleExportConfig}
              >
                Export JSON
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-white/[0.02] border border-neutral-200/60 dark:border-white/[0.05]">
              <div>
                <div className="font-semibold text-sm text-neutral-900 dark:text-neutral-100">
                  Active Session Biometric Source
                </div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {uploadedFile
                    ? `Currently loaded: "${uploadedFile.fileName}" (${uploadedFile.fileFormat})`
                    : 'No file currently loaded in memory'}
                </div>
              </div>
              {uploadedFile && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<Trash2 className="w-4 h-4 text-rose-500" />}
                  onClick={() => {
                    setUploadedFile(null);
                    addToast('Cleared active biometric file from memory', 'info');
                  }}
                  className="text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                >
                  Clear Cached File
                </Button>
              )}
            </div>
          </div>
        </GlassCard>
      )}

      {/* Add Holiday Modal */}
      <Modal
        isOpen={isAddHolidayOpen}
        onClose={() => setIsAddHolidayOpen(false)}
        title="Add Company Holiday"
        description="Specify the holiday date and name for VR Constructions calendar"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsAddHolidayOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreateHoliday}
              disabled={!newHolidayName.trim()}
            >
              Save Holiday
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Holiday Name
            </label>
            <input
              type="text"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="e.g. Christmas Day, Founder's Day"
              className="w-full px-3.5 py-2 text-sm rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Date (YYYY-MM-DD)
            </label>
            <input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-xl bg-white dark:bg-[#161A22] border border-neutral-200 dark:border-white/[0.1] text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 font-mono"
            />
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
};
