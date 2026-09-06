import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, LayoutDashboard, UploadCloud } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  onReset?: () => void;
  onNavigateToOverview?: () => void;
  onNavigateToUpload?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReturnToDashboard = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onNavigateToOverview) {
      this.props.onNavigateToOverview();
    } else {
      window.location.hash = '';
      window.location.reload();
    }
  };

  public handleTryUploadAgain = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onNavigateToUpload) {
      this.props.onNavigateToUpload();
    }
  };

  public render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';

      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6 select-none">
          <div className="w-full max-w-xl p-8 rounded-3xl bg-white dark:bg-[#151515] border border-neutral-200/80 dark:border-white/10 shadow-2xl space-y-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center ring-1 ring-rose-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Something went wrong
              </h3>
              <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-md mx-auto leading-relaxed">
                We couldn't display this section. Your stored attendance data has not been deleted.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="md"
                leftIcon={<RefreshCw className="w-4 h-4" />}
                onClick={this.handleReset}
                className="text-xs"
              >
                Try Again
              </Button>

              <Button
                variant="outline"
                size="md"
                leftIcon={<LayoutDashboard className="w-4 h-4" />}
                onClick={this.handleReturnToDashboard}
                className="text-xs"
              >
                Return to Dashboard
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
