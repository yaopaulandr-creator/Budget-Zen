import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

export type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
  details?: string[]
}

interface ToastContextValue {
  pushToast: (kind: ToastKind, message: string, details?: string[]) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const pushToast = useCallback(
    (kind: ToastKind, message: string, details?: string[]) => {
      counter.current += 1
      const id = counter.current
      setToasts((current) => [...current.slice(-3), { id, kind, message, details }])
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 5000)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ pushToast }), [pushToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-3 bottom-24 z-[100] flex flex-col items-center gap-2 sm:bottom-6 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
              toast.kind === 'success'
                ? 'border-income/25 bg-surface text-ink'
                : toast.kind === 'error'
                  ? 'border-expense/30 bg-surface text-ink'
                  : 'border-line bg-surface text-ink'
            }`}
          >
            <span className="mt-0.5 shrink-0">
              {toast.kind === 'success' ? (
                <CheckCircle2 aria-hidden className="h-5 w-5 text-income" />
              ) : toast.kind === 'error' ? (
                <TriangleAlert aria-hidden className="h-5 w-5 text-expense" />
              ) : (
                <Info aria-hidden className="h-5 w-5 text-accent" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{toast.message}</p>
              {toast.details && toast.details.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted">
                  {toast.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded p-1 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Fermer la notification"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
