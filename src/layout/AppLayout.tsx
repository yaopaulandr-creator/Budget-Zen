import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  ChevronRight,
  LayoutDashboard,
  Menu,
  PiggyBank,
  Plus,
  Repeat2,
  Settings as SettingsIcon,
  ShieldCheck,
  Tags,
  Wallet,
  X,
} from 'lucide-react'
import { cx } from '../components/ui'
import { ThemeToggle } from '../components/ThemeToggle'
import { TransactionFormModal } from '../components/TransactionForm'
import { formatLongDateFR, todayISO } from '../domain/dates'

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/categories', label: 'Catégories', icon: Tags },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/epargne', label: 'Épargne', icon: PiggyBank },
  { to: '/recurrences', label: 'Récurrences', icon: Repeat2 },
  { to: '/rapports', label: 'Rapports', icon: BarChart3 },
  { to: '/parametres', label: 'Paramètres', icon: SettingsIcon },
]

const MOBILE_ITEMS = NAV_ITEMS.filter((item) =>
  ['/', '/transactions', '/budgets', '/rapports'].includes(item.to),
)

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-solid text-white shadow-sm">
        <Wallet aria-hidden className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[15px] font-semibold tracking-tight text-ink">BudgetZen</span>
        {!compact && <span className="block text-[10px] font-medium uppercase tracking-wider text-muted">Budget personnel</span>}
      </span>
    </div>
  )
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Navigation principale" className="space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                isActive
                  ? 'bg-accent-soft font-medium text-accent'
                  : 'text-muted hover:bg-canvas hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon aria-hidden className={cx('h-[18px] w-[18px]', isActive ? 'text-accent' : 'text-muted group-hover:text-ink')} />
                <span className="flex-1">{item.label}</span>
                {isActive && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

export function AppLayout() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [drawerOpen])

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[120] focus:rounded-lg focus:bg-accent-solid focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Aller au contenu principal
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <div className="flex items-center justify-between gap-2 px-2">
          <Brand />
          <ThemeToggle />
        </div>
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="mt-6 flex h-10 items-center justify-center gap-2 rounded-lg bg-accent-solid px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-solid-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Plus aria-hidden className="h-4 w-4" />
          Ajouter une transaction
        </button>
        <div className="mt-6 flex-1 overflow-y-auto">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted/80">Mon budget</p>
          <NavList />
        </div>
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          <div className="flex items-start gap-2 px-2 text-[11px] leading-4 text-muted">
            <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-income" />
            <span>
              Données stockées uniquement dans ce navigateur.
              <br />
              Pensez à exporter une sauvegarde.
            </span>
          </div>
          <p className="px-2 text-[10px] text-muted/80">{formatLongDateFR(todayISO())}</p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-canvas/95 px-4 backdrop-blur-sm lg:hidden">
          <Brand compact />
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="rounded-lg p-2 text-ink hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              aria-label="Ouvrir le menu"
              aria-expanded={drawerOpen}
            >
              <Menu aria-hidden className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8"
        >
          <Outlet />
        </main>
      </div>

      <button
        type="button"
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-[84px] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-accent-solid text-white shadow-lg shadow-accent/25 transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent lg:hidden"
        aria-label="Ajouter une transaction"
      >
        <Plus aria-hidden className="h-6 w-6" />
      </button>

      <nav
        aria-label="Navigation mobile"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cx(
                    'flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                    isActive ? 'text-accent' : 'text-muted',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} />
                    <span className="w-full truncate text-center">
                      {item.label === 'Tableau de bord' ? 'Accueil' : item.label}
                    </span>
                  </>
                )}
              </NavLink>
            )
          })}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex min-w-0 flex-col items-center gap-1 px-1 py-2.5 text-[10px] font-medium text-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            aria-expanded={drawerOpen}
          >
            <Menu aria-hidden className="h-5 w-5" strokeWidth={1.8} />
            <span className="w-full truncate text-center">Menu</span>
          </button>
        </div>
      </nav>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-ink/35 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal"
            className="absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-line bg-surface px-3 py-5 shadow-2xl"
          >
            <div className="flex items-center justify-between px-2">
              <Brand />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                aria-label="Fermer le menu"
              >
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setDrawerOpen(false)
                setQuickAddOpen(true)
              }}
              className="mt-5 flex h-10 items-center justify-center gap-2 rounded-lg bg-accent-solid text-sm font-medium text-white"
            >
              <Plus aria-hidden className="h-4 w-4" />
              Ajouter une transaction
            </button>
            <div className="mt-5 flex-1 overflow-y-auto">
              <NavList onNavigate={() => setDrawerOpen(false)} />
            </div>
            <div className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[11px] leading-4 text-muted">
              <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-income" />
              <span>Stockage local uniquement. Exportez régulièrement une sauvegarde.</span>
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="mt-2 flex items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium text-muted hover:bg-canvas"
            >
              Fermer
              <ChevronRight aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {quickAddOpen && <TransactionFormModal onClose={() => setQuickAddOpen(false)} />}
    </div>
  )
}
