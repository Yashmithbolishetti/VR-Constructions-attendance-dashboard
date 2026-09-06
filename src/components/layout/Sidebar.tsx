import React from 'react';
import {
  LayoutDashboard,
  UploadCloud,
  Users,
  CalendarCheck,
  BarChart3,
  AlertTriangle,
  Settings,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  History,
  FileSpreadsheet,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { NavigationPage } from '../../types/attendance';

interface NavItemConfig {
  id: NavigationPage | 'import-history';
  label: string;
  icon: React.ReactNode;
  badge?: string;
  isAction?: boolean;
}

export interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
}) => {
  const { currentPage, setCurrentPage, uploadedFile, setIsImportHistoryOpen } = useApp();
  const { isDark, toggleTheme } = useTheme();

  const navItems: NavItemConfig[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'upload',
      label: 'Upload File',
      icon: <UploadCloud className="w-4 h-4 shrink-0" />,
      badge: uploadedFile ? 'Loaded' : 'Required',
    },
    {
      id: 'import-history',
      label: 'Import History',
      icon: <History className="w-4 h-4 shrink-0 text-sky-500" />,
      isAction: true,
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: <Users className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'daily-attendance',
      label: 'Daily Attendance',
      icon: <CalendarCheck className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: <BarChart3 className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'exceptions',
      label: 'Exceptions',
      icon: <AlertTriangle className="w-4 h-4 shrink-0" />,
      badge: '0',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="w-4 h-4 shrink-0" />,
    },
  ];

  const handleNavClick = (item: NavItemConfig) => {
    if (item.id === 'import-history') {
      setIsImportHistoryOpen(true);
      if (isMobileOpen) onCloseMobile();
      return;
    }
    setCurrentPage(item.id as NavigationPage);
    if (isMobileOpen) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#FAFAFA] dark:bg-[#0A0A0A] border-r border-neutral-200/80 dark:border-white/10 select-none">
      {/* Brand Header */}
      <div className={`p-6 sm:p-7 flex flex-col gap-1 border-b border-neutral-200/60 dark:border-white/5 ${isCollapsed ? 'items-center px-3' : ''}`}>
        {!isCollapsed ? (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 dark:text-[#8E9299] font-semibold">
                Enterprise
              </span>
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
                className="hidden md:flex p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-neutral-900 dark:text-white">
              VR CONSTRUCTIONS
            </h1>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/5 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item)}
              className={`flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer text-left ${
                isActive
                  ? 'bg-neutral-200/70 text-neutral-950 dark:bg-white/5 dark:text-white'
                  : 'text-neutral-600 dark:text-[#8E9299] hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <span className={isActive ? 'text-black dark:text-white' : 'text-neutral-500 dark:text-[#8E9299]'}>
                {item.icon}
              </span>

              {!isCollapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}

              {!isCollapsed && item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-mono shrink-0 ${
                    item.badge === 'Required'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-300/40 dark:border-amber-500/20'
                      : item.badge === 'Loaded'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-300/40 dark:border-emerald-500/20'
                      : 'bg-neutral-100 dark:bg-white/5 text-neutral-500 dark:text-[#8E9299]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Section with Clean Minimalism User Card */}
      <div className="p-4 border-t border-neutral-200/60 dark:border-white/5 mt-auto space-y-2">
        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className={`w-full flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          } px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 dark:text-[#8E9299] hover:bg-neutral-100 dark:hover:bg-white/5 hover:text-neutral-900 dark:hover:text-white transition-all cursor-pointer`}
          title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
        >
          <span className="flex items-center gap-2">
            {isDark ? (
              <Sun className="w-4 h-4 text-white" />
            ) : (
              <Moon className="w-4 h-4 text-neutral-700" />
            )}
            {!isCollapsed && <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
          </span>
          {!isCollapsed && (
            <span className="text-[10px] uppercase font-mono tracking-wider text-neutral-400 dark:text-[#8E9299]">
              {isDark ? 'Dark' : 'Light'}
            </span>
          )}
        </button>

        {/* User Card */}
        <div
          className={`bg-neutral-100 dark:bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-neutral-200/50 dark:border-white/5 ${
            isCollapsed ? 'justify-center p-2' : ''
          }`}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#8E9299] to-[#3F3F46] flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white shadow-xs">
            VR
          </div>
          {!isCollapsed && (
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-neutral-900 dark:text-white truncate">
                Admin Console
              </p>
              <p className="text-[10px] text-neutral-500 dark:text-[#8E9299] truncate">
                VR Constructions
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop & Laptop Persistent Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-200 h-screen sticky top-0 z-30 ${
          isCollapsed ? 'w-18' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            onClick={onCloseMobile}
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-xs"
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: -280 }}
            animate={{ x: 0 }}
            exit={{ x: -280 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-72 max-w-[80vw] h-full z-10"
          >
            {sidebarContent}
          </motion.div>
        </div>
      )}
    </>
  );
};
