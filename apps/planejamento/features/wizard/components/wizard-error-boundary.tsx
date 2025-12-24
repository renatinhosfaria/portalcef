"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { Button } from "@essencia/ui/components/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary for Wizard component
 * Prevents the entire page from crashing if wizard encounters an error
 */
export class WizardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    console.error("Wizard Error:", error, errorInfo);

    // TODO: Send error to monitoring service (e.g., Sentry) in production
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    // Reload the page to reset wizard state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-3xl p-6">
          <div className="flex min-h-[400px] flex-col items-center justify-center gap-6 rounded-lg border border-destructive/50 bg-destructive/10 p-12 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">
                Ops! Algo deu errado
              </h2>
              <p className="text-muted-foreground">
                Não foi possível carregar o assistente de planejamento.
              </p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-4 rounded-md bg-background p-4 text-left text-sm">
                  <summary className="cursor-pointer font-medium">
                    Detalhes do erro (dev mode)
                  </summary>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">
                    {this.state.error.message}
                    {"\n"}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>
            <Button onClick={this.handleReset} size="lg">
              Recarregar Página
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
