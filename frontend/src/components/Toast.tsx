import { createContext, ReactNode, useCallback, useContext, useState } from "react";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<{ showToast: (msg: string, kind?: ToastKind) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

const styles: Record<ToastKind, string> = {
  success: "border-marquee/50 bg-pit text-paper",
  error: "border-coral/60 bg-pit text-paper",
  info: "border-glow/50 bg-pit text-paper",
};

const icons: Record<ToastKind, ReactNode> = {
  success: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffb830" strokeWidth="3" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 6 9 17l-5-5" />
    </svg>
  ),
  error: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff7a6b" strokeWidth="3" aria-hidden="true">
      <path strokeLinecap="round" d="M12 7v6m0 4h.01" />
    </svg>
  ),
  info: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9fd8f0" strokeWidth="3" aria-hidden="true">
      <path strokeLinecap="round" d="M12 11v6m0-10h.01" />
    </svg>
  ),
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 top-16 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-5 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex max-w-sm animate-rise items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-medium shadow-2xl ${styles[t.kind]}`}
          >
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
