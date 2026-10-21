import {
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Loader2, TriangleAlert, X } from 'lucide-react'

export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft'
type ButtonSize = 'sm' | 'md' | 'icon'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-accent-solid text-white shadow-sm hover:bg-accent-solid-hover active:bg-accent-solid-active disabled:hover:bg-accent-solid',
  secondary:
    'border border-line-strong bg-surface text-ink hover:border-line-strong hover:bg-canvas disabled:hover:bg-surface',
  ghost: 'text-muted hover:bg-canvas hover:text-ink',
  danger:
    'bg-expense-solid text-white shadow-sm hover:bg-expense-solid-hover disabled:hover:bg-expense-solid',
  soft: 'bg-accent-soft text-accent hover:bg-accent-soft-hover',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 rounded-lg px-2.5 text-xs',
  md: 'h-10 gap-2 rounded-lg px-3.5 text-sm',
  icon: 'h-9 w-9 justify-center rounded-lg',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-55',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 aria-hidden className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  )
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article'
}) {
  return (
    <Tag className={cx('card-shadow min-w-0 rounded-xl border border-line bg-surface', className)}>
      {children}
    </Tag>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cx('flex items-start justify-between gap-3 px-5 pt-5', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

type BadgeTone = 'neutral' | 'income' | 'expense' | 'accent' | 'warn' | 'muted'

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-canvas text-ink',
  income: 'border-income/20 bg-income-soft text-income',
  expense: 'border-expense/20 bg-expense-soft text-expense',
  accent: 'border-accent/20 bg-accent-soft text-accent',
  warn: 'border-warn/25 bg-warn-soft text-warn',
  muted: 'border-line bg-surface text-muted',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function TypeBadge({ type }: { type: 'income' | 'expense' }) {
  return (
    <Badge tone={type === 'income' ? 'income' : 'expense'}>
      {type === 'income' ? '+ Revenu' : '− Dépense'}
    </Badge>
  )
}

export const inputClass = (invalid = false) =>
  cx(
    'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/70 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15',
    invalid ? 'border-expense' : 'border-line-strong',
  )

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-ink">
        {label}
        {required && (
          <span className="ml-0.5 text-expense" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-xs font-medium text-expense">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-xs leading-4 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  className,
}: {
  options: Array<{ value: T; label: string }>
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        'inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-surface p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cx(
            'shrink-0 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
            size === 'sm' ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
            value === option.value
              ? 'bg-accent-solid text-white shadow-sm'
              : 'text-muted hover:bg-canvas hover:text-ink',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function ProgressBar({
  value,
  tone = 'accent',
  label,
  height = 'md',
}: {
  value: number
  tone?: 'accent' | 'income' | 'warn' | 'expense'
  label?: string
  height?: 'sm' | 'md'
}) {
  const toneClass = {
    accent: 'bg-accent',
    income: 'bg-income',
    warn: 'bg-warn',
    expense: 'bg-expense',
  }[tone]
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0))
  return (
    <div
      className={cx('w-full overflow-hidden rounded-full bg-track', height === 'sm' ? 'h-1.5' : 'h-2.5')}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label}
    >
      <div
        className={cx('h-full rounded-full transition-[width] duration-300', toneClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  )
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const rootRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const root = rootRef.current
    const focusables = () =>
      root
        ? Array.from(
            root.querySelectorAll<HTMLElement>(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((element) => element.offsetParent !== null)
        : []

    const initial = root?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[0]
    window.setTimeout(() => initial?.focus(), 0)

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus()
    }
  }, [])

  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }
  const titleId = 'modal-title'

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/35 p-0 backdrop-blur-[1px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          'flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-2xl sm:rounded-2xl',
          sizes[size],
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-xs leading-5 text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Fermer"
          >
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-canvas/60 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirmer',
  danger = true,
  onCancel,
  onConfirm,
  children,
}: {
  title: string
  description: ReactNode
  confirmLabel?: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void | Promise<void>
  children?: ReactNode
}) {
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      title={title}
      onClose={onCancel}
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Annuler
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await onConfirm()
              } catch {
                // The caller surfaces the error; keep the dialog open.
              } finally {
                setBusy(false)
              }
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="flex gap-3">
        {danger && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-expense-soft text-expense">
            <TriangleAlert aria-hidden className="h-5 w-5" />
          </span>
        )}
        <div className="text-sm leading-6 text-muted">{description}</div>
      </div>
      {children}
    </Modal>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-muted">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-6 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function InfoBanner({
  tone = 'accent',
  icon,
  children,
  action,
}: {
  tone?: 'accent' | 'warn' | 'expense' | 'neutral'
  icon?: ReactNode
  children: ReactNode
  action?: ReactNode
}) {
  const tones = {
    accent: 'border-accent/20 bg-accent-soft text-accent',
    warn: 'border-warn/25 bg-warn-soft text-warn',
    expense: 'border-expense/25 bg-expense-soft text-expense',
    neutral: 'border-line bg-surface text-muted',
  }
  return (
    <div className={cx('flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-xs leading-5', tones[tone])}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'neutral',
  icon,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'neutral' | 'income' | 'expense' | 'accent'
  icon?: ReactNode
  className?: string
}) {
  const valueTone = {
    neutral: 'text-ink',
    income: 'text-income',
    expense: 'text-expense',
    accent: 'text-accent',
  }[tone]
  return (
    <Card className={cx('p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {icon && <span className="text-muted/80">{icon}</span>}
      </div>
      <p className={cx('tnum mt-2 text-xl font-semibold tracking-tight sm:text-2xl', valueTone)}>{value}</p>
      {hint && <div className="mt-1.5 text-[11px] leading-4 text-muted">{hint}</div>}
    </Card>
  )
}
