import React from 'react';
import { Menu, UploadCloud, Sliders, Shield, History, Sun, Moon } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../common/Button';
import { MonthSelector } from '../common/MonthSelector';

export interface HeaderProps {
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileMenu }) => {
  const {
    currentPage,
    setCurrentPage,
    uploadedFile,
    previewSkeletonMode,
    setPreviewSkeletonMode,
    setIsImportHistoryOpen,
  } = useApp();

  const { isDark, toggleTheme } = useTheme();

  const pageMeta: Record<string, { title: string; subtitle: string; showDate?: boolean }> = {
    overview: {
      title: 'Attendance Overview',
      subtitle: 'Biometric workforce metrics and monthly compliance distribution',
      showDate: true,
    },
    upload: {
      title: 'Upload Biometric Attendance',
      subtitle: 'Import raw biometric machine log export (TXT, CSV, TSV) for processing',
      showDate: false,
    },
    employees: {
      title: 'Employees Directory',
      subtitle: 'Machine-detected enrollment roster and individual attendance profiles',
      showDate: true,
    },
    'daily-attendance': {
      title: 'Daily Attendance Log',
      subtitle: 'Daily punch pairs, gross/net hour calculations, and shift status',
      showDate: true,
    },
    analytics: {
      title: 'Attendance Analytics',
      subtitle: 'Longitudinal working-hour trends, distributions, and anomaly patterns',
      showDate: true,
    },
    exceptions: {
      title: 'Exception Center',
      subtitle: 'Single punches, missing checkouts, late marks, and unresolved records',
      showDate: true,
    },
    settings: {
      title: 'System & Office Configuration',
      subtitle: 'Shift hours, lunch deduction thresholds, holidays, and retention rules',
      showDate: false,
    },
  };

  const currentMeta = pageMeta[currentPage] || {
    title: 'Attendance Intelligence',
    subtitle: 'VR Constructions workforce management system',
    showDate: false,
  };

  return (
    <header className="sticky top-0 z-20 w-full h-20 bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-md border-b border-neutral-200/60 dark:border-white/5 transition-colors">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-full gap-4">
        {/* Left: Mobile Toggle & Page Title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="md:hidden p-2 rounded-full text-neutral-600 dark:text-[#8E9299] hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg sm:text-xl font-medium tracking-tight text-neutral-900 dark:text-white truncate">
                {currentMeta.title}
              </h2>
              {uploadedFile && (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-emerald-50 text-emerald-700 dark:bg-white/5 dark:text-emerald-400 border border-emerald-200 dark:border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Database Synchronized
                </span>
              )}
            </div>
            <p className="hidden sm:block text-xs text-neutral-500 dark:text-[#8E9299] mt-0.5 truncate">
              {currentMeta.subtitle}
            </p>
          </div>
        </div>

        {/* Right: Contextual Controls & Clean Minimalist Quick Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          {/* Optional Skeleton Preview Toggle */}
          <button
            type="button"
            onClick={() => setPreviewSkeletonMode((prev) => !prev)}
            className={`hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
              previewSkeletonMode
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-black border-neutral-900 dark:border-white'
                : 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-[#8E9299] border-neutral-200 dark:border-white/10 hover:text-neutral-900 dark:hover:text-white'
            }`}
            title="Toggle Skeleton Loading view to preview data structure"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{previewSkeletonMode ? 'Skeleton ON' : 'Preview Skeletons'}</span>
          </button>

          {/* Active Month Workspace Selector */}
          {currentMeta.showDate && (
            <div className="hidden sm:block">
              <MonthSelector />
            </div>
          )}

          {/* Import History Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsImportHistoryOpen(true)}
            className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-[#8E9299] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title="Import History & Audit Log"
          >
            <History className="w-4 h-4 text-sky-500" />
          </button>

          {/* Upload Biometric File Action Button */}
          {currentPage !== 'upload' && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UploadCloud className="w-3.5 h-3.5" />}
              onClick={() => setCurrentPage('upload')}
              className="text-xs"
            >
              <span className="hidden sm:inline">+ Upload Biometric Data</span>
              <span className="sm:hidden">+ Upload</span>
            </Button>
          )}

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
            className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-[#8E9299] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
            title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-700" />
            )}
          </button>

          {/* Settings Shortcut Button */}
          {currentPage !== 'settings' && (
            <button
              type="button"
              onClick={() => setCurrentPage('settings')}
              aria-label="Office Settings"
              className="p-2 rounded-full text-neutral-500 hover:text-neutral-900 dark:text-[#8E9299] dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Office Settings"
            >
              <Shield className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
