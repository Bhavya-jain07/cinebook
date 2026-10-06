import { Component, ReactNode } from "react";

/** Catches render crashes so users see a message and a way out instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("CineBook crashed:", error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <h1 className="display text-6xl">Something broke</h1>
        <p className="mt-3 max-w-sm text-dust">The page hit an error. Reloading usually fixes it.</p>
        <button onClick={() => (window.location.href = "/")} className="mt-6 rounded-full bg-marquee px-6 py-2.5 font-bold text-pit">
          Reload CineBook
        </button>
      </div>
    );
  }
}
