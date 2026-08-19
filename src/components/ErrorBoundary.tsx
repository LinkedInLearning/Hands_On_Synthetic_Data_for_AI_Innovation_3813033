import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Catches render errors so a single bad chart no longer leaves the user on a
 * white page with no way back. (Fix 4 / no error boundary)
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("Unhandled render error:", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container max-w-2xl px-6 py-16">
        <div className="rounded-lg border bg-card p-8 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Something went wrong on this screen</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your saved scenarios are unaffected. Reloading usually clears it — if it keeps
            happening, the message below is worth reporting.
          </p>
          <pre className="mt-4 overflow-x-auto rounded bg-secondary p-3 text-left text-[11px] text-muted-foreground">
            {this.state.error.message}
          </pre>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              Try again
            </Button>
            <Button
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
