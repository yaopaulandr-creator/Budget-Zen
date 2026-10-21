import { useMemo, useState } from 'react'
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileBarChart,
  History,
  PiggyBank,
  Target,
  Wallet,
} from 'lucide-react'
import { useAppData } from '../state/AppStore'
import type { PeriodType, ReportPeriodType } from '../domain/types'
import {
  addDays,
  formatDateFR,
  formatDateFR as fmtDate,
  startOfMonth,
  todayISO,
} from '../domain/dates'
import {
  customPeriod,
  monthSubperiods,
  periodTypeLabel,
  previousPeriod,
  resolvePeriod,
  shiftPeriod,
  subperiods,
  type BreakdownGranularity,
  type Period,
} from '../domain/periods'
import {
  BUDGET_PERIOD_LABELS,
  categoryBreakdown,
  cumulativeBalanceAt,
  cumulativeSeries,
  evaluateBudgets,
  goalProgressPercent,
  savingsSummary,
  totalsForPeriod,
  variationPercent,
  type CategoryBreakdownRow,
} from '../domain/finance'
import { formatEUR, formatPercent, formatSignedEUR } from '../domain/money'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  InfoBanner,
  PageHeader,
  ProgressBar,
  SegmentedControl,
  StatCard,
  cx,
  inputClass,
} from '../components/ui'
import { ExpenseDonut, IncomeExpenseBars, BalanceLine } from '../components/charts'
import { useToast } from '../components/toast'
import { triggerDownload } from '../lib/download'

const TYPE_OPTIONS: Array<{ value: ReportPeriodType; label: string }> = [
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'semester', label: 'Semestre' },
  { value: 'year', label: 'Année' },
  { value: 'custom', label: 'Personnalisé' },
]

function signedVariation(current: number, previous: number, favorableWhenUp: boolean) {
  const percent = variationPercent(current, previous)
  const diff = current - previous
  if (previous === 0) {
    return <span className="text-muted">—</span>
  }
  const favorable = diff === 0 ? null : favorableWhenUp ? diff > 0 : diff < 0
  const Icon = diff >= 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cx(
        'tnum inline-flex items-center gap-0.5 text-xs font-medium',
        favorable === null ? 'text-muted' : favorable ? 'text-income' : 'text-expense',
      )}
    >
      <Icon aria-hidden className="h-3 w-3" />
      {percent === null ? '—' : formatPercent(Math.abs(percent), 1)}
    </span>
  )
}

function CategoryTable({
  title,
  rows,
  totalCents,
  type,
}: {
  title: string
  rows: CategoryBreakdownRow[]
  totalCents: number
  type: 'income' | 'expense'
}) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-xs font-semibold text-ink">{title}</h3>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
          Aucune {type === 'income' ? 'recette' : 'dépense'} enregistrée sur cette période.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[22rem] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-2 font-medium">Catégorie</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Montant</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Part</th>
                <th scope="col" className="py-2 pr-2 text-right font-medium">Opér.</th>
                <th scope="col" className="py-2 text-right font-medium">Variation</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.categoryId} className="border-b border-line/60">
                  <td className="py-2 pr-2">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
                      <span className="truncate text-ink">{row.name}</span>
                    </span>
                  </td>
                  <td className="tnum py-2 pr-2 text-right font-medium text-ink">{formatEUR(row.totalCents)}</td>
                  <td className="tnum py-2 pr-2 text-right text-muted">
                    {row.sharePercent === null ? '—' : formatPercent(row.sharePercent, 1)}
                  </td>
                  <td className="tnum py-2 pr-2 text-right text-muted">{row.count}</td>
                  <td className="py-2 text-right">
                    {signedVariation(row.totalCents, row.previousCents, type === 'income')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line-strong">
                <th scope="row" className="py-2 pr-2 text-left text-[11px] font-semibold text-ink">Total</th>
                <td className="tnum py-2 pr-2 text-right text-[11px] font-semibold text-ink">{formatEUR(totalCents)}</td>
                <td className="py-2 pr-2 text-right text-[11px] text-muted">{rows.length > 0 ? '100 %' : '—'}</td>
                <td className="tnum py-2 pr-2 text-right text-[11px] text-muted">
                  {rows.reduce((sum, row) => sum + row.count, 0)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

export function ReportsPage() {
  const data = useAppData()
  const { pushToast } = useToast()
  const [periodType, setPeriodType] = useState<ReportPeriodType>('month')
  const [anchor, setAnchor] = useState(todayISO())
  const [customStart, setCustomStart] = useState(startOfMonth(todayISO()))
  const [customEnd, setCustomEnd] = useState(todayISO())
  const [granularity, setGranularity] = useState<BreakdownGranularity>('month')
  const [exporting, setExporting] = useState(false)

  const customInvalid = customStart === '' || customEnd === '' || customStart > customEnd
  const period: Period | null = useMemo(() => {
    if (periodType === 'custom') {
      if (customInvalid) return null
      return customPeriod(customStart, customEnd)
    }
    return resolvePeriod(periodType, anchor)
  }, [periodType, anchor, customStart, customEnd, customInvalid])

  const previous = useMemo(() => (period ? previousPeriod(period) : null), [period])
  const totals = useMemo(() => (period ? totalsForPeriod(data.transactions, period) : null), [data.transactions, period])
  const previousTotals = useMemo(
    () => (previous ? totalsForPeriod(data.transactions, previous) : null),
    [data.transactions, previous],
  )
  const incomeBreakdown = useMemo(
    () =>
      period
        ? categoryBreakdown(data.transactions, data.categories, period, 'income', previous ?? undefined)
        : null,
    [data.transactions, data.categories, period, previous],
  )
  const expenseBreakdown = useMemo(
    () =>
      period
        ? categoryBreakdown(data.transactions, data.categories, period, 'expense', previous ?? undefined)
        : null,
    [data.transactions, data.categories, period, previous],
  )
  const cumulative = useMemo(
    () => (period ? cumulativeBalanceAt(data.transactions, data.settings, period.endExclusive) : 0),
    [data.transactions, data.settings, period],
  )
  const series = useMemo(
    () => (period ? cumulativeSeries(data.transactions, data.settings, period) : []),
    [data.transactions, data.settings, period],
  )
  const monthlyRows = useMemo(
    () =>
      period
        ? monthSubperiods(period).map((sub) => {
            const subTotals = totalsForPeriod(data.transactions, sub)
            return {
              label: sub.label.replace(' (partiel)', ''),
              incomeCents: subTotals.incomeCents,
              expenseCents: subTotals.expenseCents,
            }
          })
        : [],
    [data.transactions, period],
  )
  const budgetReference = period ? addDays(period.endExclusive, -1) : todayISO()
  const budgets = useMemo(
    () => evaluateBudgets(data.budgets, data.categories, data.transactions, budgetReference),
    [data.budgets, data.categories, data.transactions, budgetReference],
  )
  const goals = useMemo(() => savingsSummary(data.savingsGoals), [data.savingsGoals])
  const activeGoals = data.savingsGoals.filter((goal) => goal.status !== 'archived')

  const breakdownRows = useMemo(() => {
    if (!period || !totals) return null
    const subs = subperiods(period, granularity)
    const rows = subs.map((sub) => ({ period: sub, totals: totalsForPeriod(data.transactions, sub) }))
    const summed = rows.reduce(
      (acc, row) => ({
        income: acc.income + row.totals.incomeCents,
        expense: acc.expense + row.totals.expenseCents,
        count: acc.count + row.totals.transactionCount,
      }),
      { income: 0, expense: 0, count: 0 },
    )
    const matches =
      summed.income === totals.incomeCents &&
      summed.expense === totals.expenseCents &&
      summed.count === totals.transactionCount
    return { rows, summed, matches }
  }, [data.transactions, period, totals, granularity])

  const history = useMemo(() => {
    const years = new Set(data.transactions.map((transaction) => transaction.transactionDate.slice(0, 4)))
    years.add(todayISO().slice(0, 4))
    return [...years]
      .sort()
      .reverse()
      .slice(0, 8)
      .map((year) => {
        const yearPeriod = resolvePeriod('year', `${year}-01-01`)
        return { year, totals: totalsForPeriod(data.transactions, yearPeriod), period: yearPeriod }
      })
  }, [data.transactions])

  const changeType = (next: ReportPeriodType) => {
    if (next === 'custom') {
      if (period) {
        setCustomStart(period.start)
        setCustomEnd(addDays(period.endExclusive, -1))
      }
      setPeriodType('custom')
      return
    }
    if (period) setAnchor(period.start)
    setPeriodType(next)
  }

  const shift = (amount: number) => {
    if (!period) return
    const shifted = shiftPeriod(period, amount)
    if (period.type === 'custom') {
      setCustomStart(shifted.start)
      setCustomEnd(addDays(shifted.endExclusive, -1))
    } else {
      setAnchor(shifted.start)
    }
  }

  const resetCurrent = () => {
    const today = todayISO()
    setAnchor(today)
    setCustomStart(startOfMonth(today))
    setCustomEnd(today)
  }

  const isCurrent =
    period !== null &&
    period.type !== 'custom' &&
    period.key === resolvePeriod(period.type as PeriodType, todayISO()).key

  const handleExportPdf = async () => {
    if (!period || !totals || !previous || !incomeBreakdown || !expenseBreakdown) return
    setExporting(true)
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 20))
      const { createReportPdf, reportPdfFilename } = await import('../lib/pdf')
      const title = `Bilan ${periodTypeLabel(period.type).toLowerCase()}`
      const blob = createReportPdf({
        title,
        periodLabel: period.label,
        periodTypeLabel: periodTypeLabel(period.type),
        generatedAt: new Date(),
        totals,
        cumulativeCents: cumulative,
        incomeRows: incomeBreakdown.rows.map((row) => ({
          name: row.name,
          color: row.color,
          amountCents: row.totalCents,
          sharePercent: row.sharePercent,
          count: row.count,
        })),
        expenseRows: expenseBreakdown.rows.map((row) => ({
          name: row.name,
          color: row.color,
          amountCents: row.totalCents,
          sharePercent: row.sharePercent,
          count: row.count,
        })),
        monthlyRows,
        budgets: budgets.map((budget) => ({
          categoryName: budget.categoryName,
          limitCents: budget.limitCents,
          consumedCents: budget.consumedCents,
          status: budget.status,
          cycleLabel: budget.cycleLabel,
        })),
        goals: activeGoals.map((goal) => ({
          name: goal.name,
          targetCents: goal.targetCents,
          savedCents: goal.savedCents,
          progressPercent: goalProgressPercent(goal),
        })),
      })
      triggerDownload(blob, reportPdfFilename(`${title}-${period.label}`))
      pushToast('success', 'Rapport PDF généré avec la période et les totaux affichés.')
    } catch (cause) {
      pushToast('error', cause instanceof Error ? cause.message : 'Génération du PDF impossible.')
    } finally {
      setExporting(false)
    }
  }

  if (!period || !totals || !previous || !previousTotals || !incomeBreakdown || !expenseBreakdown) {
    return (
      <div>
        <PageHeader title="Rapports" subtitle="Bilans mensuels, trimestriels, semestriels, annuels et personnalisés." />
        <Card className="mb-4 p-4">
          <SegmentedControl label="Type de rapport" options={TYPE_OPTIONS} value={periodType} onChange={changeType} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Du" htmlFor="custom-start" required>
              <input
                id="custom-start"
                type="date"
                value={customStart}
                onChange={(event) => setCustomStart(event.target.value)}
                className={inputClass(customInvalid)}
              />
            </Field>
            <Field label="Au" htmlFor="custom-end" required>
              <input
                id="custom-end"
                type="date"
                value={customEnd}
                onChange={(event) => setCustomEnd(event.target.value)}
                className={inputClass(customInvalid)}
              />
            </Field>
          </div>
        </Card>
        <InfoBanner tone="expense" icon={<CalendarRange aria-hidden className="h-4 w-4" />}>
          La date de début doit être renseignée et précéder ou égaler la date de fin.
        </InfoBanner>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Rapports"
        subtitle="Tous les totaux sont recalculés à partir des transactions, jamais figés."
        actions={
          <Button variant="primary" onClick={() => void handleExportPdf()} loading={exporting}>
            <Download aria-hidden className="h-4 w-4" />
            Exporter en PDF
          </Button>
        }
      />

      <Card className="mb-4 p-4">
        <div className="flex flex-col gap-3">
          <SegmentedControl
            label="Type de rapport"
            options={TYPE_OPTIONS}
            value={periodType}
            onChange={changeType}
            className="w-fit max-w-full"
          />
          {periodType === 'custom' ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
              <Field label="Date de début" htmlFor="report-start">
                <input
                  id="report-start"
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                  className={inputClass(customInvalid)}
                />
              </Field>
              <Field label="Date de fin" htmlFor="report-end">
                <input
                  id="report-end"
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                  className={inputClass(customInvalid)}
                />
              </Field>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-lg border border-line bg-surface">
                <button
                  type="button"
                  onClick={() => shift(-1)}
                  aria-label="Période précédente"
                  className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                >
                  <ChevronLeft aria-hidden className="h-4 w-4" />
                </button>
                <span className="min-w-32 border-x border-line px-2 text-center text-xs font-medium text-ink">
                  {period.label}
                </span>
                <button
                  type="button"
                  onClick={() => shift(1)}
                  aria-label="Période suivante"
                  className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
                >
                  <ChevronRight aria-hidden className="h-4 w-4" />
                </button>
              </div>
              {!isCurrent && (
                <button
                  type="button"
                  onClick={resetCurrent}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft"
                >
                  Période actuelle
                </button>
              )}
              <span className="ml-auto text-[11px] text-muted">
                {formatDateFR(period.start)} – {formatDateFR(addDays(period.endExclusive, -1))}
              </span>
            </div>
          )}
          {periodType === 'custom' && (
            <p className="text-[11px] text-muted">
              Période personnalisée du {formatDateFR(period.start)} au {formatDateFR(addDays(period.endExclusive, -1))}.
            </p>
          )}
        </div>
      </Card>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">Bilan {periodTypeLabel(period.type).toLowerCase()}</h2>
          <p className="text-xs text-muted">{period.label} · comparé à {previous.label}</p>
        </div>
        <Badge tone="muted">{totals.transactionCount} opération(s)</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenus" value={formatEUR(totals.incomeCents)} tone="income" hint={`${totals.incomeCount} opération(s)`} />
        <StatCard label="Dépenses" value={formatEUR(totals.expenseCents)} tone="expense" hint={`${totals.expenseCount} opération(s)`} />
        <StatCard
          label="Solde de la période"
          value={formatSignedEUR(totals.netCents)}
          tone={totals.netCents >= 0 ? 'income' : 'expense'}
          hint={previousTotals.netCents !== 0 ? `Précédent : ${formatSignedEUR(previousTotals.netCents)}` : 'Pas de comparaison'}
        />
        <StatCard
          label="Solde cumulé"
          value={formatSignedEUR(cumulative)}
          hint={`au ${formatDateFR(addDays(period.endExclusive, -1))}`}
          icon={<Wallet aria-hidden className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader title="Répartition des dépenses" description={`${expenseBreakdown.rows.length} catégorie(s)`} />
          <div className="px-5 pb-5 pt-2">
            <ExpenseDonut rows={expenseBreakdown.rows} totalCents={expenseBreakdown.totalCents} />
          </div>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Revenus et dépenses par mois" description="Sous-périodes du rapport" />
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
        <CardHeader title="Évolution du solde cumulé" description="Inclut le solde initial et les opérations antérieures à la période" />
        <div className="px-2 pb-3 pt-4 sm:px-4">
          <BalanceLine points={series} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Comparaison avec la période précédente" description={previous.label} />
          <div className="px-5 pb-5 pt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted">
                  <th scope="col" className="pb-1 text-left font-medium">Indicateur</th>
                  <th scope="col" className="pb-1 text-right font-medium">Période</th>
                  <th scope="col" className="pb-1 text-right font-medium">Précédente</th>
                  <th scope="col" className="pb-1 pl-2 text-right font-medium">Écart</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Revenus', current: totals.incomeCents, before: previousTotals.incomeCents, up: true, tone: 'text-income' },
                  { label: 'Dépenses', current: totals.expenseCents, before: previousTotals.expenseCents, up: false, tone: 'text-expense' },
                  { label: 'Solde', current: totals.netCents, before: previousTotals.netCents, up: true, tone: totals.netCents >= 0 ? 'text-income' : 'text-expense' },
                ].map((row) => (
                  <tr key={row.label} className="border-t border-line/70">
                    <th scope="row" className="py-2.5 text-left font-medium text-ink">{row.label}</th>
                    <td className={cx('tnum py-2.5 text-right font-medium', row.tone)}>
                      {row.label === 'Solde' ? formatSignedEUR(row.current) : formatEUR(row.current)}
                    </td>
                    <td className="tnum py-2.5 text-right text-muted">
                      {row.label === 'Solde' ? formatSignedEUR(row.before) : formatEUR(row.before)}
                    </td>
                    <td className="py-2.5 pl-2 text-right">
                      {signedVariation(row.current, row.before, row.up)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Budgets" description={`Cycle contenant le ${formatDateFR(budgetReference)}`} />
          <div className="px-5 pb-5 pt-2">
            {budgets.length === 0 ? (
              <EmptyState
                icon={<Wallet aria-hidden className="h-5 w-5" />}
                title="Aucun budget défini"
                description="Les budgets respectés ou dépassés apparaîtront ici."
              />
            ) : (
              <ul className="space-y-3">
                {budgets.map((budget) => (
                  <li key={budget.budgetId}>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="min-w-0 flex-1 truncate font-medium text-ink">{budget.categoryName}</span>
                      <Badge tone={budget.status === 'exceeded' ? 'expense' : budget.status === 'warning' ? 'warn' : 'income'}>
                        {budget.status === 'exceeded' ? 'Dépassé' : budget.status === 'warning' ? 'Seuil atteint' : 'Respecté'}
                      </Badge>
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                      <span>{BUDGET_PERIOD_LABELS[budget.periodType]} · {budget.cycleLabel}</span>
                      <span className="tnum">{formatEUR(budget.consumedCents)} / {formatEUR(budget.limitCents)}</span>
                    </div>
                    <ProgressBar
                      value={budget.usagePercent}
                      tone={budget.status === 'exceeded' ? 'expense' : budget.status === 'warning' ? 'warn' : 'income'}
                      height="sm"
                      label={`Budget ${budget.categoryName}`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Détail par catégorie" description="Montants, parts, nombre d’opérations et variation" />
        <div className="grid gap-6 px-5 pb-5 pt-4 lg:grid-cols-2">
          <CategoryTable title="Revenus par catégorie" rows={incomeBreakdown.rows} totalCents={incomeBreakdown.totalCents} type="income" />
          <CategoryTable title="Dépenses par catégorie" rows={expenseBreakdown.rows} totalCents={expenseBreakdown.totalCents} type="expense" />
        </div>
        <div className="border-t border-line px-5 py-2.5 text-[11px] text-muted">
          Part = montant de la catégorie ÷ total du type × 100. Aucune division par zéro : la part est affichée « — »
          lorsque le total est nul.
        </div>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Décomposition de la période"
          description="Les sous-périodes doivent totaliser exactement le bilan principal."
          action={
            periodType === 'month' ? null : (
              <SegmentedControl
                label="Granularité de la décomposition"
                size="sm"
                options={[
                  { value: 'month', label: 'Mois' },
                  { value: 'quarter', label: 'Trimestres' },
                ]}
                value={granularity}
                onChange={setGranularity}
              />
            )
          }
        />
        <div className="px-5 pb-5 pt-3">
          {periodType === 'month' ? (
            <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
              Un rapport mensuel ne contient pas de sous-période. Choisissez un trimestre, un semestre, une année ou
              une période personnalisée pour afficher la décomposition.
            </p>
          ) : breakdownRows ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                      <th scope="col" className="py-2 pr-2 font-medium">Sous-période</th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium">Revenus</th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium">Dépenses</th>
                      <th scope="col" className="py-2 pr-2 text-right font-medium">Solde</th>
                      <th scope="col" className="py-2 text-right font-medium">Opér.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownRows.rows.map((row) => (
                      <tr key={row.period.key} className="border-b border-line/60">
                        <th scope="row" className="py-2 pr-2 text-left font-medium text-ink">{row.period.label}</th>
                        <td className="tnum py-2 pr-2 text-right text-income">{formatEUR(row.totals.incomeCents)}</td>
                        <td className="tnum py-2 pr-2 text-right text-expense">{formatEUR(row.totals.expenseCents)}</td>
                        <td className={cx('tnum py-2 pr-2 text-right font-medium', row.totals.netCents >= 0 ? 'text-income' : 'text-expense')}>
                          {formatSignedEUR(row.totals.netCents)}
                        </td>
                        <td className="tnum py-2 text-right text-muted">{row.totals.transactionCount}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line-strong">
                      <th scope="row" className="py-2 pr-2 text-left text-[11px] font-semibold text-ink">Total</th>
                      <td className="tnum py-2 pr-2 text-right text-[11px] font-semibold text-income">{formatEUR(breakdownRows.summed.income)}</td>
                      <td className="tnum py-2 pr-2 text-right text-[11px] font-semibold text-expense">{formatEUR(breakdownRows.summed.expense)}</td>
                      <td className="tnum py-2 pr-2 text-right text-[11px] font-semibold text-ink">
                        {formatSignedEUR(breakdownRows.summed.income - breakdownRows.summed.expense)}
                      </td>
                      <td className="tnum py-2 text-right text-[11px] text-muted">{breakdownRows.summed.count}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p
                className={cx(
                  'mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium',
                  breakdownRows.matches ? 'bg-income-soft text-income' : 'bg-expense-soft text-expense',
                )}
              >
                <CheckCircle2 aria-hidden className="h-3.5 w-3.5" />
                {breakdownRows.matches
                  ? 'Totaux concordants : la somme des sous-périodes correspond au bilan principal.'
                  : 'Attention : un écart a été détecté entre les sous-périodes et le total.'}
              </p>
            </>
          ) : null}
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Objectifs d’épargne"
            description="Suivi indicatif, sans impact sur le solde"
            action={
              <Badge tone="income">
                <PiggyBank aria-hidden className="h-3 w-3" />
                {formatPercent(goals.progressPercent, 0)}
              </Badge>
            }
          />
          <div className="px-5 pb-5 pt-2">
            {activeGoals.length === 0 ? (
              <EmptyState
                icon={<Target aria-hidden className="h-5 w-5" />}
                title="Aucun objectif actif"
                description="Créez un objectif d’épargne pour suivre sa progression dans vos bilans."
              />
            ) : (
              <ul className="space-y-3">
                {activeGoals.map((goal) => (
                  <li key={goal.id}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-ink">{goal.name}</span>
                      <span className="tnum shrink-0 text-muted">
                        {formatEUR(goal.savedCents)} / {formatEUR(goal.targetCents)}
                      </span>
                    </div>
                    <ProgressBar value={goalProgressPercent(goal)} tone={goal.status === 'achieved' ? 'income' : 'accent'} height="sm" label={`Objectif ${goal.name}`} />
                    {goal.targetDate && (
                      <p className="mt-1 text-[10px] text-muted">Échéance {fmtDate(goal.targetDate)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Historique" description="Consulter un bilan annuel précédent" action={<History aria-hidden className="h-4 w-4 text-muted" />} />
          <div className="overflow-x-auto px-5 pb-5 pt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-muted">
                  <th scope="col" className="pb-1 text-left font-medium">Année</th>
                  <th scope="col" className="pb-1 text-right font-medium">Revenus</th>
                  <th scope="col" className="pb-1 text-right font-medium">Dépenses</th>
                  <th scope="col" className="pb-1 text-right font-medium">Solde</th>
                  <th scope="col" className="pb-1 text-right font-medium"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.year} className="border-t border-line/70">
                    <th scope="row" className="py-2 text-left font-medium text-ink">{entry.year}</th>
                    <td className="tnum py-2 text-right text-income">{formatEUR(entry.totals.incomeCents)}</td>
                    <td className="tnum py-2 text-right text-expense">{formatEUR(entry.totals.expenseCents)}</td>
                    <td className={cx('tnum py-2 text-right font-medium', entry.totals.netCents >= 0 ? 'text-income' : 'text-expense')}>
                      {formatSignedEUR(entry.totals.netCents)}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setPeriodType('year')
                          setAnchor(entry.period.start)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                      >
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-4 text-muted">
        <FileBarChart aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Le PDF reprend le titre, la période, les indicateurs, les totaux par catégorie, un graphique et la date de
        génération. Les budgets sont évalués sur le cycle qui contient la fin de la période affichée. L’épargne est un
        suivi et ne modifie jamais le solde.
      </p>
    </div>
  )
}
