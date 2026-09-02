import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Without this, a render-time throw unmounts the entire React tree and the window goes
 * blank with no explanation — the failure mode that hid an infinite-render bug. Showing the
 * error (and echoing it to the console, which the main process mirrors into its log) makes
 * renderer crashes diagnosable instead of silent.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Renderer crashed:", error.message, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div style={{ padding: 32, fontFamily: "Consolas, monospace" }}>
        <h2 style={{ marginTop: 0, color: "var(--error)" }}>The UI crashed</h2>
        <pre style={{ whiteSpace: "pre-wrap", background: "var(--bg-panel)", padding: 12, borderRadius: 4, fontSize: 12 }}>
          {error.message}
        </pre>
        <button onClick={() => this.setState({ error: undefined })}>Try to recover</button>
      </div>
    );
  }
}
