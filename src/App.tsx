import React from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { OverviewPage } from './pages/OverviewPage';
import { UploadPage } from './pages/UploadPage';
import { EmployeesPage } from './pages/EmployeesPage';
import { DailyAttendancePage } from './pages/DailyAttendancePage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ExceptionsPage } from './pages/ExceptionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

const AppContent: React.FC = () => {
  const { currentPage, setCurrentPage } = useApp();

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage />;
      case 'upload':
        return <UploadPage />;
      case 'employees':
        return <EmployeesPage />;
      case 'daily-attendance':
        return <DailyAttendancePage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'exceptions':
        return <ExceptionsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <AppShell>
      <ErrorBoundary onNavigateToOverview={() => setCurrentPage('overview')} onNavigateToUpload={() => setCurrentPage('upload')}>
        {renderCurrentPage()}
      </ErrorBoundary>
    </AppShell>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ThemeProvider>
  );
}
