import { addDays, addMonthsClamped, differenceInDays, isIsoDate, monthsUntil, startOfMonth, startOfQuarter, startOfSemester, startOfYear, todayISO } from './dates'
import { periodLengthDays, type Period } from './periods'
import type {
  Budget,
  BudgetPeriodType,
  Category,
  IsoDate,
  RecurringRule,
  SavingsGoal,
  Transaction,
  TransactionType,
  UserSettings,
} from './types'

export interface Totals {
  incomeCents: number
  expenseCents: number
  netCents: number
  transactionCount: number
  incomeCount: number
  expenseCount: number
}

export interface CategoryBreakdownRow {
  categoryId: string
  name: string
  color: string
  icon: string
  totalCents: number
  count: number
  sharePercent: number | null
  previousCents: number
  variationCents: number
  variationPercent: number | null
}

export interface CategoryBreakdown {
  type: TransactionType
  rows: CategoryBreakdownRow[]
  totalCents: number
}

export interface BudgetEvaluation {
  budgetId: string
  categoryId: string
  categoryName: string
  categoryColor: string
  periodType: BudgetPeriodType
  limitCents: number
  consumedCents: number
  remainingCents: number
  usagePercent: number
  status: 'ok' | 'warning' | 'exceeded'
  alertThresholdPercent: number
  cycleStart: IsoDate
  cycleEndExclusive: IsoDate
  cycleLabel: string
}

export interface SavingsSummary {
  targetCents: number
  savedCents: number
  remainingCents: number
  progressPercent: number
  activeCount: number
  achievedCount: number
}

export function transactionsInPeriod(
  transactions: Transaction[],
  period: Pick<Period, 'start' | 'endExclusive'>,
): Transaction[] {
  return transactions.filter(
    (transaction) =>
      transaction.transactionDate >= period.start && transaction.transactionDate < period.endExclusive,
  )
}

export function totalsForPeriod(
  transactions: Transaction[],
  period: Pick<Period, 'start' | 'endExclusive'>,
): Totals {
  const totals: Totals = {
    incomeCents: 0,
    expenseCents: 0,
    netCents: 0,
    transactionCount: 0,
    incomeCount: 0,
    expenseCount: 0,
  }
  for (const transaction of transactions) {
    if (transaction.transactionDate < period.start || transaction.transactionDate >= period.endExclusive) {
      continue
    }
    totals.transactionCount += 1
    if (transaction.type === 'income') {
      totals.incomeCents += transaction.amountCents
      totals.incomeCount += 1
    } else {
      totals.expenseCents += transaction.amountCents
      totals.expenseCount += 1
    }
  }
  totals.netCents = totals.incomeCents - totals.expenseCents
  return totals
}

/**
 * Cumulative balance at an exclusive end date.
 * The initial balance is a starting value as of the reference date, never period income.
 */
export function cumulativeBalanceAt(
  transactions: Transaction[],
  settings: Pick<UserSettings, 'initialBalanceCents' | 'balanceReferenceDate'>,
  endExclusive: IsoDate,
): number {
  let balance = settings.initialBalanceCents
  if (endExclusive <= settings.balanceReferenceDate) return balance
  for (const transaction of transactions) {
    if (
      transaction.transactionDate >= settings.balanceReferenceDate &&
      transaction.transactionDate < endExclusive
    ) {
      balance += transaction.type === 'income' ? transaction.amountCents : -transaction.amountCents
    }
  }
  return balance
}

export interface CumulativePoint {
  date: IsoDate
  label: string
  balanceCents: number
  netCents: number
}

/** Running balance over a period, sampled daily, weekly or monthly. */
export function cumulativeSeries(
  transactions: Transaction[],
  settings: Pick<UserSettings, 'initialBalanceCents' | 'balanceReferenceDate'>,
  period: Period,
): CumulativePoint[] {
  const length = periodLengthDays(period)
  const step = length <= 31 ? 'day' : length <= 120 ? 'week' : 'month'
  const points: CumulativePoint[] = []
  const startBalance = cumulativeBalanceAt(transactions, settings, period.start)
  let cursor = period.start
  let running = startBalance
  let guard = 0
  while (cursor < period.endExclusive && guard < 800) {
    guard += 1
    let next: IsoDate
    if (step === 'day') next = addDays(cursor, 1)
    else if (step === 'week') next = addDays(cursor, 7)
    else next = addMonthsClamped(cursor, 1)
    if (next > period.endExclusive) next = period.endExclusive
    const bucket = transactionsInPeriod(transactions, { start: cursor, endExclusive: next })
    const net = bucket.reduce(
      (sum, transaction) => sum + (transaction.type === 'income' ? transaction.amountCents : -transaction.amountCents),
      0,
    )
    running += net
    points.push({
      date: addDays(next, -1),
      label: formatChartLabel(addDays(next, -1), step),
      balanceCents: running,
      netCents: net,
    })
    cursor = next
  }
  return points
}

function formatChartLabel(iso: IsoDate, step: 'day' | 'week' | 'month'): string {
  const [, month, day] = iso.split('-')
  if (step === 'month') {
    const names = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
    return names[Number(month) - 1] ?? iso
  }
  return `${day}/${month}`
}

/** Income or expense totals per category, with share and previous-period variation. */
export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  period: Period,
  type: TransactionType,
  previous?: Period,
): CategoryBreakdown {
  const rowsById = new Map<string, CategoryBreakdownRow>()
  let totalCents = 0

  for (const transaction of transactions) {
    if (transaction.type !== type) continue
    if (transaction.transactionDate < period.start || transaction.transactionDate >= period.endExclusive) continue
    totalCents += transaction.amountCents
    const existing = rowsById.get(transaction.categoryId)
    if (existing) {
      existing.totalCents += transaction.amountCents
      existing.count += 1
    } else {
      const category = categories.find((item) => item.id === transaction.categoryId)
      rowsById.set(transaction.categoryId, {
        categoryId: transaction.categoryId,
        name: category?.name ?? 'Catégorie inconnue',
        color: category?.color ?? '#9CA3AF',
        icon: category?.icon ?? 'circle',
        totalCents: transaction.amountCents,
        count: 1,
        sharePercent: null,
        previousCents: 0,
        variationCents: 0,
        variationPercent: null,
      })
    }
  }

  if (previous) {
    for (const transaction of transactions) {
      if (
        transaction.type === type &&
        transaction.transactionDate >= previous.start &&
        transaction.transactionDate < previous.endExclusive
      ) {
        const row = rowsById.get(transaction.categoryId)
        if (row) row.previousCents += transaction.amountCents
      }
    }
  }

  for (const row of rowsById.values()) {
    row.sharePercent = totalCents === 0 ? null : (row.totalCents / totalCents) * 100
    row.variationCents = row.totalCents - row.previousCents
    row.variationPercent =
      row.previousCents === 0 ? null : (row.variationCents / row.previousCents) * 100
  }

  return {
    type,
    rows: [...rowsById.values()].sort((a, b) => b.totalCents - a.totalCents),
    totalCents,
  }
}

export function topExpenseCategories(
  transactions: Transaction[],
  categories: Category[],
  period: Period,
  limit = 5,
): CategoryBreakdownRow[] {
  return categoryBreakdown(transactions, categories, period, 'expense').rows.slice(0, limit)
}

export function variationPercent(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / Math.abs(previous)) * 100
}

const MONTHS_PER_CYCLE: Record<BudgetPeriodType, number> = {
  monthly: 1,
  quarterly: 3,
  semester: 6,
  yearly: 12,
}

export function normalizeBudgetAnchor(startDate: IsoDate, periodType: BudgetPeriodType): IsoDate {
  switch (periodType) {
    case 'monthly':
      return startOfMonth(startDate)
    case 'quarterly':
      return startOfQuarter(startDate)
    case 'semester':
      return startOfSemester(startDate)
    case 'yearly':
      return startOfYear(startDate)
  }
}

/** The budget envelope cycle that contains the reference date. */
export function budgetCycle(
  budget: Pick<Budget, 'startDate' | 'periodType'>,
  referenceDate: IsoDate,
): { start: IsoDate; endExclusive: IsoDate; index: number } {
  const anchor = normalizeBudgetAnchor(budget.startDate, budget.periodType)
  const monthsPerCycle = MONTHS_PER_CYCLE[budget.periodType]
  if (referenceDate < anchor) {
    return { start: anchor, endExclusive: addMonthsClamped(anchor, monthsPerCycle), index: 0 }
  }
  const [anchorYear, anchorMonth] = anchor.split('-').map(Number)
  const [refYear, refMonth] = referenceDate.split('-').map(Number)
  const monthsApart = (refYear - anchorYear) * 12 + (refMonth - anchorMonth)
  const index = Math.max(0, Math.floor(monthsApart / monthsPerCycle))
  const start = addMonthsClamped(anchor, index * monthsPerCycle)
  return { start, endExclusive: addMonthsClamped(start, monthsPerCycle), index }
}

export function evaluateBudget(
  budget: Budget,
  category: Category | undefined,
  transactions: Transaction[],
  referenceDate: IsoDate,
): BudgetEvaluation {
  const cycle = budgetCycle(budget, referenceDate)
  let consumedCents = 0
  for (const transaction of transactions) {
    if (
      transaction.type === 'expense' &&
      transaction.categoryId === budget.categoryId &&
      transaction.transactionDate >= cycle.start &&
      transaction.transactionDate < cycle.endExclusive
    ) {
      consumedCents += transaction.amountCents
    }
  }
  const usagePercent = budget.limitCents > 0 ? (consumedCents / budget.limitCents) * 100 : 0
  const status: BudgetEvaluation['status'] =
    usagePercent >= 100 ? 'exceeded' : usagePercent >= budget.alertThresholdPercent ? 'warning' : 'ok'
  return {
    budgetId: budget.id,
    categoryId: budget.categoryId,
    categoryName: category?.name ?? 'Catégorie inconnue',
    categoryColor: category?.color ?? '#9CA3AF',
    periodType: budget.periodType,
    limitCents: budget.limitCents,
    consumedCents,
    remainingCents: budget.limitCents - consumedCents,
    usagePercent,
    status,
    alertThresholdPercent: budget.alertThresholdPercent,
    cycleStart: cycle.start,
    cycleEndExclusive: cycle.endExclusive,
    cycleLabel: budgetCycleLabel(cycle.start, cycle.endExclusive),
  }
}

export function budgetCycleLabel(start: IsoDate, endExclusive: IsoDate): string {
  const format = (iso: string) => {
    const [year, month, day] = iso.split('-')
    return `${day}/${month}/${year}`
  }
  return `du ${format(start)} au ${format(addDays(endExclusive, -1))}`
}

export const BUDGET_PERIOD_LABELS: Record<BudgetPeriodType, string> = {
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  semester: 'Semestriel',
  yearly: 'Annuel',
}

export function evaluateBudgets(
  budgets: Budget[],
  categories: Category[],
  transactions: Transaction[],
  referenceDate: IsoDate,
): BudgetEvaluation[] {
  return budgets
    .map((budget) =>
      evaluateBudget(
        budget,
        categories.find((category) => category.id === budget.categoryId),
        transactions,
        referenceDate,
      ),
    )
    .sort((a, b) => b.usagePercent - a.usagePercent)
}

export function savingsSummary(goals: SavingsGoal[]): SavingsSummary {
  const counted = goals.filter((goal) => goal.status !== 'archived')
  const targetCents = counted.reduce((sum, goal) => sum + goal.targetCents, 0)
  const savedCents = counted.reduce((sum, goal) => sum + goal.savedCents, 0)
  return {
    targetCents,
    savedCents,
    remainingCents: counted.reduce((sum, goal) => sum + Math.max(0, goal.targetCents - goal.savedCents), 0),
    progressPercent: targetCents === 0 ? 0 : Math.min(100, (savedCents / targetCents) * 100),
    activeCount: goals.filter((goal) => goal.status === 'active').length,
    achievedCount: goals.filter((goal) => goal.status === 'achieved').length,
  }
}

export function goalProgressPercent(goal: Pick<SavingsGoal, 'savedCents' | 'targetCents'>): number {
  if (goal.targetCents <= 0) return 0
  return Math.min(100, (goal.savedCents / goal.targetCents) * 100)
}

export function goalMonthlyAmount(
  goal: Pick<SavingsGoal, 'savedCents' | 'targetCents' | 'targetDate'>,
  referenceDate: IsoDate = todayISO(),
): number | null {
  if (!goal.targetDate || !isIsoDate(goal.targetDate)) return null
  if (goal.targetDate <= referenceDate) return null
  const remaining = Math.max(0, goal.targetCents - goal.savedCents)
  return Math.ceil(remaining / monthsUntil(referenceDate, goal.targetDate))
}

/** Budget cycles intersecting a period, oldest first. */
export function budgetCyclesInPeriod(
  budget: Pick<Budget, 'startDate' | 'periodType'>,
  period: Pick<Period, 'start' | 'endExclusive'>,
): Array<{ start: IsoDate; endExclusive: IsoDate }> {
  const result: Array<{ start: IsoDate; endExclusive: IsoDate }> = []
  let cycle = budgetCycle(budget, period.start)
  let guard = 0
  while (cycle.start < period.endExclusive && guard < 600) {
    guard += 1
    result.push({ start: cycle.start, endExclusive: cycle.endExclusive })
    cycle = budgetCycle(budget, cycle.endExclusive)
  }
  return result
}

export function daysUntil(date: IsoDate, referenceDate: IsoDate = todayISO()): number {
  return differenceInDays(referenceDate, date)
}

export function recurringMonthlyEquivalent(rule: Pick<RecurringRule, 'amountCents' | 'frequency'>): number {
  switch (rule.frequency) {
    case 'weekly':
      return Math.round((rule.amountCents * 52) / 12)
    case 'monthly':
      return rule.amountCents
    case 'quarterly':
      return Math.round(rule.amountCents / 3)
    case 'semester':
      return Math.round(rule.amountCents / 6)
    case 'yearly':
      return Math.round(rule.amountCents / 12)
  }
}
