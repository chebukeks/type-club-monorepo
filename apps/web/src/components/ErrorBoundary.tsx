import React, { Component, ErrorInfo, ReactNode } from "react";
import { getTranslation, Locale } from "@type-club/editor";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      const locale: Locale = typeof document !== 'undefined' && document.documentElement.lang === 'ru' ? 'ru' : 'en';
      return (
        <div className="min-h-screen p-8 bg-red-50 dark:bg-red-950 text-red-900 dark:text-red-100 font-sans">
          <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-xl border border-red-200 dark:border-red-800">
            <h1 className="text-xl font-bold mb-2 text-red-600 dark:text-red-400">
              {getTranslation(locale, 'errorBoundary.title')}
            </h1>
            <p className="font-mono text-sm mb-4 bg-red-100 dark:bg-red-900/50 p-3 rounded-lg overflow-x-auto">
              {this.state.error?.toString()}
            </p>
            {this.state.errorInfo && (
              <details className="mb-4 text-xs font-mono">
                <summary className="cursor-pointer text-gray-500 mb-2">{getTranslation(locale, 'errorBoundary.stackTrace')}</summary>
                <pre className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors"
            >
              {getTranslation(locale, 'errorBoundary.reload')}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
