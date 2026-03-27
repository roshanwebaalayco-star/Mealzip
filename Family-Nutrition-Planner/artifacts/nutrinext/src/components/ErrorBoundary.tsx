import React from "react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8">
          <div className="text-4xl">🌿</div>
          <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
          <p className="text-muted-foreground text-center max-w-sm text-sm">
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
