import { Component, useEffect, type ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { AppLayout } from './layout/AppLayout'
import { useApp } from './state/AppStore'
import { Button } from './components/ui'
import { DashboardPage } from './pages/DashboardPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { BudgetsPage } from './pages/BudgetsPage'
import { SavingsPage } from './pages/SavingsPage'
import { RecurringPage } from './pages/RecurringPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'

function ScrollToTop() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])
  return null
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    // Log only the error object, never financial data.
    console.error(error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center p-6">
          <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-sm">
            <ShieldAlert aria-hidden className="mx-auto h-10 w-10 text-warn" />
            <h1 className="mt-3 text-lg font-semibold">Un problème inattendu est survenu</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Vos données enregistrées n’ont pas été modifiées. Rechargez la page pour reprendre. Si le problème
              persiste, exportez une sauvegarde depuis un autre onglet avant toute manipulation.
            </p>
            <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
              Recharger BudgetZen
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function AppGate() {
  const { status, error } = useApp()

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
        <p className="text-sm">Chargement de votre budget…</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 text-center shadow-sm">
          <ShieldAlert aria-hidden className="mx-auto h-10 w-10 text-expense" />
          <h1 className="mt-3 text-lg font-semibold">Stockage local inaccessible</h1>
          <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
          <p className="mt-2 text-xs leading-5 text-muted">
            BudgetZen a besoin d’IndexedDB pour enregistrer vos données. Vérifiez que votre navigateur autorise le
            stockage local (navigation privée, paramètres de confidentialité) puis rechargez la page.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
            Réessayer
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="transactions" element={<TransactionsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="budgets" element={<BudgetsPage />} />
        <Route path="epargne" element={<SavingsPage />} />
        <Route path="recurrences" element={<RecurringPage />} />
        <Route path="rapports" element={<ReportsPage />} />
        <Route path="parametres" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ScrollToTop />
        <AppGate />
      </HashRouter>
    </ErrorBoundary>
  )
}
