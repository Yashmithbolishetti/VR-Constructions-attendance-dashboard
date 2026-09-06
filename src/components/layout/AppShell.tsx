import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '../common/Toast';
import { AttendanceAiAssistant } from '../common/AttendanceAiAssistant';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useApp } from '../../context/AppContext';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { setCurrentPage } = useApp();

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A] text-neutral-900 dark:text-[#E4E4E7] flex transition-colors duration-200">
      {/* Sidebar navigation */}
      <Sidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#FAFAFA] dark:bg-[#0A0A0A]">
        <Header onOpenMobileMenu={() => setIsMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary
            onNavigateToOverview={() => setCurrentPage('overview')}
            onNavigateToUpload={() => setCurrentPage('upload')}
          >
            {children}
          </ErrorBoundary>
        </main>

        {/* Clean Minimalism Status Footer */}
        <footer className="h-12 border-t border-neutral-200/60 dark:border-white/5 px-6 sm:px-8 flex items-center justify-between bg-white/40 dark:bg-[#0A0A0A]/60 backdrop-blur-xs select-none">
          <div className="flex items-center gap-4 sm:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-[#8E9299]">
                System Ready
              </span>
            </div>
            <span className="hidden sm:inline text-[10px] text-neutral-300 dark:text-white/20">|</span>
            <span className="hidden sm:inline text-[10px] text-neutral-500 dark:text-[#8E9299] uppercase tracking-wider">
              Engine v1.0.4 - Foundation
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-neutral-500 dark:text-[#8E9299] uppercase tracking-wider">
              Office Hours: 10:00 AM — 06:00 PM
            </span>
          </div>
        </footer>
      </div>

      {/* Persistent global toast alerts */}
      <ToastContainer />

      {/* Floating Attendance AI Assistant */}
      <AttendanceAiAssistant />
    </div>
  );
};
