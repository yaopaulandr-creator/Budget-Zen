import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  PiggyBank,
  Plus,
  ShieldCheck,
  Target,
  TriangleAlert,
  Wallet,
} from 'lucide-react'
import { useApp, useAppData } from '../state/AppStore'
import {
  BUDGET_PERIOD_LABELS,
  categoryBreakdown,
  cumulativeBalanceAt,
  cumulativeSeries,
  evaluateBudgets,
  goalProgressPercent,
  savingsSummary,
  topExpenseCategories,
  totalsForPeriod,
  transactionsInPeriod,
  variationPercent,
  type BudgetEvaluation,
} from '../domain/finance'
import { addDays, formatDateFR, todayISO } from '../domain/dates'
import { previousPeriod, resolvePeriod, shiftPeriod, subperiods } from '../domain/periods'
import { formatEUR, formatPercent, formatSignedEUR } from '../domain/money'
import type { PeriodType } from '../domain/types'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  InfoBanner,
  PageHeader,
  ProgressBar,
  StatCard,
  cx,
} from '../components/ui'
import { PeriodSelector } from '../components/PeriodSelector'
import { CategoryIcon } from '../components/CategoryIcon'
import { BalanceLine, ExpenseDonut, IncomeExpenseBars } from '../components/charts'
import { TransactionFormModal } from '../components/TransactionForm'
import { useToast } from '../components/toast'

function VariationHint({
  current,
  previous,
  favorableWhenUp,
}: {
  current: number
  previous: number
  favorableWhenUp: boolean
}) {
  const diff = current - previous
  const percent = variationPercent(current, previous)
  if (previous === 0) {
    return <span>{current === 0 ? 'Aucune opération sur les deux périodes' : 'Pas de comparaison possible (période précédente vide)'}</span>
  }
  const favorable = diff === 0 ? null : favorableWhenUp ? diff > 0 : diff < 0
  const Icon = diff >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span
        className={cx(
          'inline-flex items-center gap-0.5 font-medium',
          favorable === null ? 'text-muted' : favorable ? 'text-income' : 'text-expense',
        )}
      >
        <Icon aria-hidden className="h-3 w-3" />
        {percent === null ? '—' : formatPercent(Math.abs(percent), 1)}
        <span className="font-normal text-muted">({formatSignedEUR(diff)})</span>
      </span>
      <span>vs période précédente</span>
    </span>
  )
}

function ComparisonRow({
  label,
  current,
  previous,
  favorableWhenUp,
}: {
  label: string
  current: number
  previous: number
  favorableWhenUp: boolean
}) {
  return (
    <tr className="border-t border-line/70">
      <th scope="row" className="py-2.5 pr-2 text-left text-xs font-medium text-ink">
        {label}
      </th>
      <td
        className={cx(
          'tnum py-2.5 text-right text-xs font-medium',
          label === 'Dépenses'
            ? 'text-expense'
            : label === 'Revenus'
              ? 'text-income'
              : current >= 0
                ? 'text-income'
                : 'text-expense',
        )}
      >
        {label === 'Solde' ? formatSignedEUR(current) : formatEUR(current)}
      </td>
      <td className="tnum py-2.5 text-right text-xs text-muted">
        {label === 'Solde' ? formatSignedEUR(previous) : formatEUR(previous)}
      </td>
      <td
        className={cx(
          'tnum py-2.5 pl-3 text-right text-xs font-medium',
          current === previous
            ? 'text-muted'
            : (current > previous) === favorableWhenUp
              ? 'text-income'
              : 'text-expense',
        )}
      >
        {previous === 0 ? '—' : `${current > previous ? '+' : ''}${formatPercent(variationPercent(current, previous) ?? 0, 1)}`}
      </td>
    </tr>
  )
}

function budgetTone(budget: BudgetEvaluation) {
  return budget.status === 'exceeded' ? 'expense' : budget.status === 'warning' ? 'warn' : 'income'
}

export function DashboardPage() {
  const data = useAppData()
  const { hasDemoData, removeDemo } = useApp()
  const { pushToast } = useToast()
  const [periodType, setPeriodType] = useState<PeriodType>('month')
  const [anchor, setAnchor] = useState(todayISO())
  const [addOpen, setAddOpen] = useState(false)
  const [removingDemo, setRemovingDemo] = useState(false)

  const period = useMemo(() => resolvePeriod(periodType, anchor), [periodType, anchor])
  const previous = useMemo(() => previousPeriod(period), [period])
  const totals = useMemo(() => totalsForPeriod(data.transactions, period), [data.transactions, period])
  const previousTotals = useMemo(
    () => totalsForPeriod(data.transactions, previous),
    [data.transactions, previous],
  )
  const expenses = useMemo(
    () => categoryBreakdown(data.transactions, data.categories, period, 'expense', previous),
    [data.transactions, data.categories, period, previous],
  )
  const topCategories = useMemo(
    () => topExpenseCategories(data.transactions, data.categories, period, 5),
    [data.transactions, data.categories, period],
  )
  const cumulativeCents = useMemo(
    () => cumulativeBalanceAt(data.transactions, data.settings, period.endExclusive),
    [data.transactions, data.settings, period],
  )
  const series = useMemo(
    () => cumulativeSeries(data.transactions, data.settings, period),
    [data.transactions, data.settings, period],
  )
  const monthlyRows = useMemo(
    () =>
      subperiods(period, 'month').map((sub) => {
        const subTotals = totalsForPeriod(data.transactions, sub)
        return {
          label: sub.label.replace(' (partiel)', ''),
          incomeCents: subTotals.incomeCents,
          expenseCents: subTotals.expenseCents,
        }
      }),
    [data.transactions, period],
  )
  const budgetReference = addDays(period.endExclusive, -1)
  const budgets = useMemo(
    () => evaluateBudgets(data.budgets, data.categories, data.transactions, budgetReference),
    [data.budgets, data.categories, data.transactions, budgetReference],
  )
  const goals = useMemo(() => savingsSummary(data.savingsGoals), [data.savingsGoals])
  const periodTransactions = useMemo(
    () =>
      transactionsInPeriod(data.transactions, period)
        .slice()
        .sort((a, b) =>
          a.transactionDate === b.transactionDate
            ? b.createdAt.localeCompare(a.createdAt)
            : b.transactionDate.localeCompare(a.transactionDate),
        )
        .slice(0, 5),
    [data.transactions, period],
  )
  const remainingBudgets = budgets.reduce((sum, budget) => sum + budget.remainingCents, 0)
  const budgetsExceeded = budgets.filter((budget) => budget.status === 'exceeded').length
  const budgetsWarning = budgets.filter((budget) => budget.status === 'warning').length
  const activeGoals = data.savingsGoals.filter((goal) => goal.status === 'active')
  const lateGoals = activeGoals.filter((goal) => goal.targetDate && goal.targetDate < todayISO())
  const categoryById = useMemo(
    () => new Map(data.categories.map((category) => [category.id, category])),
    [data.categories],
  )

  const shift = (amount: number) => setAnchor(shiftPeriod(period, amount).start)
  const changeType = (next: PeriodType) => {
    setAnchor(period.start)
    setPeriodType(next)
  }

  const handleRemoveDemo = async () => {
    setRemovingDemo(true)
    try {
      await removeDemo()
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Suppression impossible.')
    } finally {
      setRemovingDemo(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Tableau de bord"
        subtitle={
          <>
            {formatDateFR(period.start)} – {formatDateFR(addDays(period.endExclusive, -1))} · vue {period.type === 'month' ? 'mensuelle' : period.type === 'quarter' ? 'trimestrielle' : period.type === 'semester' ? 'semestrielle' : 'annuelle'}
          </>
        }
        actions={
          <>
            <Button variant="primary" onClick={() => setAddOpen(true)}>
              <Plus aria-hidden className="h-4 w-4" />
              Ajouter une transaction
            </Button>
          </>
        }
      />

      <div className="mb-5">
        <PeriodSelector
          type={periodType}
          period={period}
          onTypeChange={changeType}
          onShift={shift}
          onToday={() => setAnchor(todayISO())}
        />
      </div>

      {hasDemoData && (
        <div className="mb-4">
          <InfoBanner
            tone="warn"
            icon={<CircleAlert aria-hidden className="h-4 w-4" />}
            action={
              <Button variant="secondary" size="sm" onClick={() => void handleRemoveDemo()} loading={removingDemo}>
                Supprimer
              </Button>
            }
          >
            <strong>Données de démonstration actives.</strong> Elles sont identifiées et n’ont pas été saisies par
            vous. Supprimez-les avant d’utiliser BudgetZen au quotidien.
          </InfoBanner>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Solde cumulé"
          value={formatSignedEUR(cumulativeCents)}
          tone={cumulativeCents >= 0 ? 'neutral' : 'expense'}
          hint={
            <span>
              au {formatDateFR(addDays(period.endExclusive, -1))}
              {data.settings.initialBalanceCents === 0 && (
                <> · solde initial de 0 € (non renseigné)</>
              )}
            </span>
          }
          icon={<Wallet aria-hidden className="h-4 w-4" />}
        />
        <StatCard
          label="Revenus de la période"
          value={formatEUR(totals.incomeCents)}
          tone="income"
          hint={
            <>
              <span className="block">
                {totals.incomeCount} opération{totals.incomeCount > 1 ? 's' : ''}
              </span>
              <VariationHint current={totals.incomeCents} previous={previousTotals.incomeCents} favorableWhenUp />
            </>
          }
        />
        <StatCard
          label="Dépenses de la période"
          value={formatEUR(totals.expenseCents)}
          tone="expense"
          hint={
            <>
              <span className="block">
                {totals.expenseCount} opération{totals.expenseCount > 1 ? 's' : ''}
              </span>
              <VariationHint current={totals.expenseCents} previous={previousTotals.expenseCents} favorableWhenUp={false} />
            </>
          }
        />
        <StatCard
          label="Résultat net"
          value={formatSignedEUR(totals.netCents)}
          tone={totals.netCents >= 0 ? 'income' : 'expense'}
          hint={
            <VariationHint current={totals.netCents} previous={previousTotals.netCents} favorableWhenUp />
          }
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="flex items-center justify-between gap-3 p-4">
          <div>
            <p className="text-xs font-medium text-muted">Restant sur les budgets</p>
            <p className={cx('tnum mt-1.5 text-lg font-semibold', remainingBudgets < 0 ? 'text-expense' : 'text-ink')}>
              {formatSignedEUR(remainingBudgets)}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {budgets.length === 0
                ? 'Aucun budget défini'
                : `${budgets.length} budget${budgets.length > 1 ? 's' : ''}${budgetsExceeded ? ` · ${budgetsExceeded} dépassé${budgetsExceeded > 1 ? 's' : ''}` : ''}`}
            </p>
          </div>
          <Link
            to="/budgets"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-muted hover:bg-accent-soft hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label="Voir les budgets"
          >
            <ChevronRight aria-hidden className="h-4 w-4" />
          </Link>
        </Card>
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-muted">Progression de l’épargne</p>
              <p className="tnum mt-1.5 text-lg font-semibold text-ink">
                {goals.targetCents === 0 ? '—' : formatPercent(goals.progressPercent, 1)}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {goals.targetCents === 0
                  ? 'Aucun objectif actif'
                  : `${formatEUR(goals.savedCents)} sur ${formatEUR(goals.targetCents)}`}
              </p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-canvas text-muted">
              <PiggyBank aria-hidden className="h-4 w-4" />
            </span>
          </div>
          {goals.targetCents > 0 && (
            <ProgressBar value={goals.progressPercent} tone="income" label="Progression de l’épargne" height="sm" />
          )}
        </Card>
      </div>

      {(budgetsExceeded > 0 || budgetsWarning > 0 || lateGoals.length > 0) && (
        <div className="mt-4 space-y-2">
          {budgets
            .filter((budget) => budget.status !== 'ok')
            .slice(0, 4)
            .map((budget) => (
              <InfoBanner
                key={budget.budgetId}
                tone={budget.status === 'exceeded' ? 'expense' : 'warn'}
                icon={<TriangleAlert aria-hidden className="h-4 w-4" />}
              >
                {budget.status === 'exceeded' ? (
                  <>
                    <strong>{budget.categoryName} : budget dépassé.</strong> {formatEUR(budget.consumedCents)} dépensés
                    sur {formatEUR(budget.limitCents)} ({formatPercent(budget.usagePercent, 0)}).
                  </>
                ) : (
                  <>
                    <strong>{budget.categoryName} : seuil d’alerte atteint.</strong>{' '}
                    {formatPercent(budget.usagePercent, 0)} du budget {BUDGET_PERIOD_LABELS[budget.periodType].toLowerCase()} consommé.
                  </>
                )}
              </InfoBanner>
            ))}
          {lateGoals.map((goal) => (
            <InfoBanner key={goal.id} tone="warn" icon={<Target aria-hidden className="h-4 w-4" />}>
              <strong>{goal.name} :</strong> la date cible du {formatDateFR(goal.targetDate ?? '')} est passée et
              l’objectif n’est pas atteint ({formatPercent(goalProgressPercent(goal), 0)}).
            </InfoBanner>
          ))}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Répartition des dépenses" description="Part de chaque catégorie" />
          <div className="px-5 pb-5 pt-2">
            <ExpenseDonut rows={expenses.rows} totalCents={expenses.totalCents} />
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Revenus et dépenses" description="Détail par mois de la période" />
          <div className="px-3 pb-3 pt-4 sm:px-4">
            <IncomeExpenseBars rows={monthlyRows} />
            <div className="flex items-center gap-4 px-2 pb-1 text-[11px] text-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-income" aria-hidden /> Revenus
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-expense" aria-hidden /> Dépenses
              </span>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Évolution du solde cumulé"
          description="Solde initial inclus · les opérations futures ne sont pas encore comptées dans la réalité"
        />
        <div className="px-2 pb-3 pt-4 sm:px-4">
          <BalanceLine points={series} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Principales dépenses"
            description={`${expenses.rows.length} catégorie${expenses.rows.length > 1 ? 's' : ''} utilisée${expenses.rows.length > 1 ? 's' : ''}`}
            action={
              <Link to="/rapports" className="text-xs font-medium text-accent hover:underline">
                Voir les rapports
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-3">
            {topCategories.length === 0 ? (
              <EmptyState
                icon={<Wallet aria-hidden className="h-5 w-5" />}
                title="Aucune dépense enregistrée"
                description="Ajoutez votre première dépense pour voir où va votre argent."
              />
            ) : (
              <ul className="space-y-3.5">
                {topCategories.map((row) => (
                  <li key={row.categoryId}>
                    <div className="mb-1.5 flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.name}</span>
                      <span className="tnum text-muted">{formatPercent(row.sharePercent ?? 0, 1)}</span>
                      <span className="tnum w-20 text-right font-medium text-ink">{formatEUR(row.totalCents)}</span>
                    </div>
                    <ProgressBar value={row.sharePercent ?? 0} tone="accent" height="sm" label={`Part de ${row.name}`} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Budgets"
            description={`Cycle au ${formatDateFR(budgetReference)}`}
            action={
              <Link to="/budgets" className="text-xs font-medium text-accent hover:underline">
                Gérer
              </Link>
            }
          />
          <div className="px-5 pb-5 pt-3">
            {budgets.length === 0 ? (
              <EmptyState
                icon={<Wallet aria-hidden className="h-5 w-5" />}
                title="Aucun budget défini"
                description="Fixez un plafond par catégorie pour être alerté avant de dépasser."
                action={
                  <Link
                    to="/budgets"
                    className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-surface px-2.5 text-xs font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    Définir un budget
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3.5">
                {budgets.slice(0, 4).map((budget) => (
                  <li key={budget.budgetId}>
                    <div className="mb-1.5 flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: budget.categoryColor }} aria-hidden />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{budget.categoryName}</span>
                      <Badge tone={budgetTone(budget)}>
                        {budget.status === 'exceeded' ? 'Dépassé' : budget.status === 'warning' ? 'Seuil atteint' : 'Respecté'}
                      </Badge>
                    </div>
                    <ProgressBar value={budget.usagePercent} tone={budgetTone(budget)} height="sm" label={`Budget ${budget.categoryName}`} />
                    <div className="mt-1 flex justify-between text-[11px] text-muted">
                      <span>{formatPercent(budget.usagePercent, 0)}</span>
                      <span className="tnum">
                        {formatEUR(budget.consumedCents)} / {formatEUR(budget.limitCents)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Comparaison avec la période précédente" description={previous.label} />
          <div className="overflow-x-auto px-5 pb-5 pt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted">
                  <th scope="col" className="pb-1 text-left font-medium">Indicateur</th>
                  <th scope="col" className="pb-1 text-right font-medium">Période</th>
                  <th scope="col" className="pb-1 text-right font-medium">Précédente</th>
                  <th scope="col" className="pb-1 pl-3 text-right font-medium">Variation</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow label="Revenus" current={totals.incomeCents} previous={previousTotals.incomeCents} favorableWhenUp />
                <ComparisonRow label="Dépenses" current={totals.expenseCents} previous={previousTotals.expenseCents} favorableWhenUp={false} />
                <ComparisonRow label="Solde" current={totals.netCents} previous={previousTotals.netCents} favorableWhenUp />
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Dernières transactions"
            description={period.label}
            action={
              <Link to="/transactions" className="inline-flex items-center gap-0.5 text-xs font-medium text-accent hover:underline">
                Tout voir <ArrowRight aria-hidden className="h-3 w-3" />
              </Link>
            }
          />
          <div className="px-3 pb-3 pt-2">
            {periodTransactions.length === 0 ? (
              <EmptyState
                icon={<Wallet aria-hidden className="h-5 w-5" />}
                title="Aucune opération sur cette période"
                description="Utilisez « Ajouter une transaction » pour commencer."
              />
            ) : (
              <ul className="divide-y divide-line/70">
                {periodTransactions.map((transaction) => {
                  const category = categoryById.get(transaction.categoryId)
                  return (
                    <li key={transaction.id} className="flex items-center gap-3 px-2 py-2.5">
                      <CategoryIcon
                        icon={category?.icon ?? 'circle-help'}
                        color={category?.color ?? '#6B7280'}
                        size="sm"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink">
                          {transaction.description || category?.name || 'Opération'}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                          <span>{formatDateFR(transaction.transactionDate)}</span>
                          <span aria-hidden>·</span>
                          <span className="truncate">{category?.name ?? 'Catégorie inconnue'}</span>
                          {transaction.recurringOccurrenceId && <span className="text-accent">· récurrente</span>}
                        </p>
                      </div>
                      <span
                        className={cx(
                          'tnum shrink-0 text-xs font-semibold',
                          transaction.type === 'income' ? 'text-income' : 'text-expense',
                        )}
                      >
                        {transaction.type === 'income' ? '+' : '−'}
                        {formatEUR(transaction.amountCents)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[11px] leading-5 text-muted">
        <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-income" />
        <p>
          BudgetZen ne transmet aucune donnée financière à un service tiers. Les montants sont calculés en centimes,
          et le solde cumulé part du solde initial et de la date de référence définis dans les{' '}
          <Link to="/parametres" className="font-medium text-accent hover:underline">
            paramètres
          </Link>
          . Les objectifs d’épargne ne modifient jamais le solde réel.
        </p>
      </div>

      {addOpen && <TransactionFormModal onClose={() => setAddOpen(false)} />}
    </div>
  )
}
