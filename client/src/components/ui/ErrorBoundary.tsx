import React from 'react';
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  // Shown in the fallback heading, e.g. "Jobs" - helps identify which page
  // crashed without exposing any technical detail to the user.
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Reusable page/route-level error boundary. Catches render errors in its
// subtree so one broken page shows a friendly fallback instead of taking
// down the whole app shell (sidebar, header, routing). Stack traces are
// only ever shown when Vite's DEV flag is set - never in a production
// build, regardless of what the error contains.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` - ${this.props.label}` : ''}]:`, error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="enterprise-card max-w-md w-full p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#C2413A]/10 border border-[#C2413A]/25 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#C2413A]" />
          </div>
          <h2 className="text-base font-semibold text-[#171717]">
            {this.props.label ? `Something went wrong loading ${this.props.label}` : 'Something went wrong'}
          </h2>
          <p className="text-sm text-[#716B64] mt-2">
            This page ran into an unexpected error. You can try again, or reload the app if the problem persists.
          </p>

          {import.meta.env.DEV && (
            <pre className="mt-4 p-3 rounded-[10px] bg-[#FAF9F7] border border-[#E7E4DE] text-left text-[11px] text-[#C2413A] overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.stack || this.state.error.message}
            </pre>
          )}

          <div className="flex items-center justify-center gap-2.5 mt-5">
            <button type="button" onClick={this.handleRetry} className="btn-secondary">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
            <button type="button" onClick={this.handleReload} className="btn-primary">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload App</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
