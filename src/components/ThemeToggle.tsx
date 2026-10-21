import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../theme/context'
import { cx } from './ui'

/** Compact toggle for the header and the sidebar. */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, toggle } = useTheme()
  const isDark = mode === 'dark'
  const label = isDark ? 'Passer au thème clair' : 'Passer au thème sombre'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      className={cx(
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        className,
      )}
    >
      {isDark ? (
        <Sun aria-hidden className="h-[18px] w-[18px]" />
      ) : (
        <Moon aria-hidden className="h-[18px] w-[18px]" />
      )}
    </button>
  )
}

/** Explicit choice used in the settings page. */
export function ThemeChoice() {
  const { mode, setMode } = useTheme()
  const options = [
    { value: 'light' as const, label: 'Clair', icon: Sun },
    { value: 'dark' as const, label: 'Sombre', icon: Moon },
  ]

  return (
    <div
      role="group"
      aria-label="Apparence de l’interface"
      className="inline-flex rounded-lg border border-line bg-canvas p-1"
    >
      {options.map((option) => {
        const Icon = option.icon
        const isActive = mode === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setMode(option.value)}
            aria-pressed={isActive}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
              isActive ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
            )}
          >
            <Icon aria-hidden className="h-3.5 w-3.5" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
