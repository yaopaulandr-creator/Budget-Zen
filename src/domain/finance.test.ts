import { describe, expect, it } from 'vitest'
import {
  budgetCycle,
  categoryBreakdown,
  cumulativeBalanceAt,
  cumulativeSeries,
  evaluateBudget,
  evaluateBudgets,
  goalMonthlyAmount,
  goalProgressPercent,
  normalizeBudgetAnchor,
  recurringMonthlyEquivalent,
  savingsSummary,
  totalsForPeriod,
  variationPercent,
} from './finance'
import { resolvePeriod } from './periods'
import type { Budget, Category, SavingsGoal, Transaction } from './types'

const categories: Category[] = [
  { id: 'salary', name: 'Salaire', type: 'income', icon: 'briefcase', color: '#1F7A4D', isDefault: true, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'other-income', name: 'Autres revenus', type: 'income', icon: 'circle-ellipsis', color: '#6B7280', isDefault: true, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'housing', name: 'Logement', type: 'expense', icon: 'home', color: '#B46A55', isDefault: true, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'food', name: 'Alimentation', type: 'expense', icon: 'shopping-basket', color: '#C2703D', isDefault: true, isActive: true, createdAt: '', updatedAt: '' },
  { id: 'transport', name: 'Transport', type: 'expense', icon: 'car', color: '#A06A4F', isDefault: true, isActive: true, createdAt: '', updatedAt: '' },
]

let counter = 0
function tx(
  date: string,
  type: 'income' | 'expense',
  amountCents: number,
  categoryId: string,
): Transaction {
  counter += 1
  return {
    id: `t${counter}`,
    type,
    amountCents,
    transactionDate: date,
    categoryId,
    description: '',
    recurringOccurrenceId: null,
    createdAt: `${date}T12:00:00.000Z`,
    updatedAt: `${date}T12:00:00.000Z`,
  }
}

const october = resolvePeriod('month', '2026-10-15')
const september = resolvePeriod('month', '2026-09-15')

const octoberTransactions: Transaction[] = [
  tx('2026-10-01', 'income', 200_000, 'salary'),
  tx('2026-10-20', 'income', 15_000, 'other-income'),
  tx('2026-10-05', 'expense', 75_000, 'housing'),
  tx('2026-10-12', 'expense', 30_000, 'food'),
  tx('2026-10-18', 'expense', 10_000, 'transport'),
]

describe('period totals', () => {
  it('matches the validation example: 2 150 € in, 1 150 € out, +1 000 € net', () => {
    const totals = totalsForPeriod(octoberTransactions, october)
    expect(totals.incomeCents).toBe(215_000)
    expect(totals.expenseCents).toBe(115_000)
    expect(totals.netCents).toBe(100_000)
    expect(totals.transactionCount).toBe(5)
    expect(totals.incomeCount).toBe(2)
    expect(totals.expenseCount).toBe(3)
  })

  it('is exact with decimal cents', () => {
    const transactions = [tx('2026-10-02', 'income', 1, 'salary'), tx('2026-10-03', 'expense', 2, 'food')]
    expect(totalsForPeriod(transactions, october).netCents).toBe(-1)
    const many = Array.from({ length: 100 }, () => tx('2026-10-04', 'income', 1, 'salary'))
    expect(totalsForPeriod(many, october).incomeCents).toBe(100)
  })

  it('returns zeros for an empty period and supports negative results', () => {
    expect(totalsForPeriod([], october)).toEqual({
      incomeCents: 0,
      expenseCents: 0,
      netCents: 0,
      transactionCount: 0,
      incomeCount: 0,
      expenseCount: 0,
    })
    const deficit = [tx('2026-10-02', 'expense', 50_000, 'housing')]
    expect(totalsForPeriod(deficit, october).netCents).toBe(-50_000)
  })

  it('excludes transactions outside the period boundaries', () => {
    const rows = [
      tx('2026-09-30', 'income', 999, 'salary'),
      tx('2026-10-01', 'income', 100, 'salary'),
      tx('2026-10-31', 'income', 200, 'salary'),
      tx('2026-11-01', 'income', 999, 'salary'),
    ]
    expect(totalsForPeriod(rows, october).incomeCents).toBe(300)
    expect(totalsForPeriod(rows, october).transactionCount).toBe(2)
  })
})

describe('cumulative balance', () => {
  const settings = { initialBalanceCents: 50_000, balanceReferenceDate: '2026-10-01' }

  it('returns 1 500 € with a 500 € initial balance after the example month', () => {
    expect(cumulativeBalanceAt(octoberTransactions, settings, '2026-11-01')).toBe(150_000)
  })

  it('never counts the initial balance as period income', () => {
    const totals = totalsForPeriod(octoberTransactions, october)
    expect(totals.incomeCents).toBe(215_000)
    expect(cumulativeBalanceAt(octoberTransactions, settings, '2026-11-01')).toBe(
      settings.initialBalanceCents + totals.netCents,
    )
  })

  it('excludes operations before the reference date but includes the reference date itself', () => {
    const rows = [
      tx('2026-09-15', 'income', 100_000, 'salary'),
      tx('2026-10-01', 'income', 10_000, 'salary'),
      tx('2026-10-02', 'expense', 5_000, 'food'),
    ]
    expect(cumulativeBalanceAt(rows, settings, '2026-11-01')).toBe(55_000)
    expect(cumulativeBalanceAt(rows, settings, '2026-10-01')).toBe(50_000)
  })

  it('returns the initial balance when the end date precedes the reference date', () => {
    expect(cumulativeBalanceAt(octoberTransactions, settings, '2026-01-01')).toBe(50_000)
  })

  it('builds a running series ending on the cumulative balance', () => {
    const points = cumulativeSeries(octoberTransactions, settings, october)
    expect(points.length).toBeGreaterThan(1)
    expect(points[points.length - 1].balanceCents).toBe(150_000)
    expect(points[0].date).toBe('2026-10-01')
    expect(points[points.length - 1].date).toBe('2026-10-31')
  })
})

describe('category breakdown', () => {
  it('computes totals, count and shares without division by zero', () => {
    const breakdown = categoryBreakdown(octoberTransactions, categories, october, 'expense')
    expect(breakdown.totalCents).toBe(115_000)
    expect(breakdown.rows).toHaveLength(3)
    const housing = breakdown.rows.find((row) => row.categoryId === 'housing')
    expect(housing?.totalCents).toBe(75_000)
    expect(housing?.count).toBe(1)
    expect(housing?.sharePercent).toBeCloseTo((75_000 / 115_000) * 100, 6)

    const empty = categoryBreakdown([], categories, october, 'expense')
    expect(empty.totalCents).toBe(0)
    expect(empty.rows).toHaveLength(0)
  })

  it('compares with the previous period and handles a zero previous total', () => {
    const rows = [...octoberTransactions, tx('2026-09-10', 'expense', 20_000, 'food')]
    const breakdown = categoryBreakdown(rows, categories, october, 'expense', september)
    const food = breakdown.rows.find((row) => row.categoryId === 'food')
    expect(food?.previousCents).toBe(20_000)
    expect(food?.variationCents).toBe(10_000)
    expect(food?.variationPercent).toBeCloseTo(50, 6)

    const housing = breakdown.rows.find((row) => row.categoryId === 'housing')
    expect(housing?.previousCents).toBe(0)
    expect(housing?.variationPercent).toBeNull()
    expect(variationPercent(0, 0)).toBeNull()
  })
})

describe('budgets', () => {
  const budget: Budget = {
    id: 'b1',
    categoryId: 'food',
    limitCents: 10_000,
    periodType: 'monthly',
    startDate: '2026-10-01',
    alertThresholdPercent: 80,
    createdAt: '',
    updatedAt: '',
  }

  it('normalises anchors to period boundaries', () => {
    expect(normalizeBudgetAnchor('2026-10-19', 'monthly')).toBe('2026-10-01')
    expect(normalizeBudgetAnchor('2026-10-19', 'quarterly')).toBe('2026-10-01')
    expect(normalizeBudgetAnchor('2026-10-19', 'semester')).toBe('2026-07-01')
    expect(normalizeBudgetAnchor('2026-10-19', 'yearly')).toBe('2026-01-01')
  })

  it('finds the containing cycle across years', () => {
    expect(budgetCycle(budget, '2026-10-19')).toMatchObject({
      start: '2026-10-01',
      endExclusive: '2026-11-01',
    })
    expect(budgetCycle(budget, '2027-02-10')).toMatchObject({
      start: '2027-02-01',
      endExclusive: '2027-03-01',
    })
    expect(budgetCycle(budget, '2026-09-10')).toMatchObject({
      start: '2026-10-01',
      endExclusive: '2026-11-01',
    })
  })

  it('computes consumption and triggers the configured threshold', () => {
    const rows = [tx('2026-10-03', 'expense', 8_000, 'food')]
    const evaluation = evaluateBudget(budget, categories.find((c) => c.id === 'food'), rows, '2026-10-19')
    expect(evaluation.consumedCents).toBe(8_000)
    expect(evaluation.remainingCents).toBe(2_000)
    expect(evaluation.usagePercent).toBe(80)
    expect(evaluation.status).toBe('warning')
  })

  it('flags an exceeded budget without blocking the expense', () => {
    const rows = [tx('2026-10-03', 'expense', 12_000, 'food')]
    const evaluation = evaluateBudget(budget, categories.find((c) => c.id === 'food'), rows, '2026-10-19')
    expect(evaluation.status).toBe('exceeded')
    expect(evaluation.remainingCents).toBe(-2_000)
    expect(totalsForPeriod(rows, october).expenseCents).toBe(12_000)
  })

  it('keeps a budget within its category and cycle', () => {
    const rows = [
      tx('2026-10-03', 'expense', 3_000, 'food'),
      tx('2026-10-04', 'expense', 9_000, 'transport'),
      tx('2026-09-30', 'expense', 7_000, 'food'),
      tx('2026-11-01', 'expense', 7_000, 'food'),
    ]
    const evaluation = evaluateBudget(budget, categories.find((c) => c.id === 'food'), rows, '2026-10-19')
    expect(evaluation.consumedCents).toBe(3_000)
    expect(evaluation.status).toBe('ok')
  })

  it('sorts evaluations by usage and uses today-independent references', () => {
    const second: Budget = { ...budget, id: 'b2', categoryId: 'transport', limitCents: 20_000 }
    const rows = [
      tx('2026-10-03', 'expense', 5_000, 'food'),
      tx('2026-10-04', 'expense', 19_000, 'transport'),
    ]
    const evaluations = evaluateBudgets([budget, second], categories, rows, '2026-10-19')
    expect(evaluations[0].categoryId).toBe('transport')
    expect(evaluations[0].status).toBe('warning')
  })
})

describe('savings goals', () => {
  const goals: SavingsGoal[] = [
    {
      id: 'g1',
      name: 'Vacances',
      targetCents: 100_000,
      savedCents: 40_000,
      targetDate: '2027-04-01',
      description: '',
      status: 'active',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'g2',
      name: 'Fonds d’urgence',
      targetCents: 300_000,
      savedCents: 350_000,
      targetDate: null,
      description: '',
      status: 'achieved',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'g3',
      name: 'Ancien projet',
      targetCents: 50_000,
      savedCents: 10_000,
      targetDate: null,
      description: '',
      status: 'archived',
      createdAt: '',
      updatedAt: '',
    },
  ]

  it('caps progress at 100 % while keeping the real saved amount', () => {
    expect(goalProgressPercent(goals[0])).toBe(40)
    expect(goalProgressPercent(goals[1])).toBe(100)
    expect(goals[1].savedCents).toBe(350_000)
  })

  it('excludes archived goals from the summary', () => {
    const summary = savingsSummary(goals)
    expect(summary.savedCents).toBe(390_000)
    expect(summary.targetCents).toBe(400_000)
    expect(summary.remainingCents).toBe(60_000)
    expect(summary.progressPercent).toBe(97.5)
    expect(summary.achievedCount).toBe(1)
  })

  it('estimates the monthly amount from the target date', () => {
    expect(goalMonthlyAmount(goals[0], '2026-10-01')).toBe(10_000)
    expect(goalMonthlyAmount({ ...goals[0], targetDate: '2026-01-01' }, '2026-10-01')).toBeNull()
    expect(goalMonthlyAmount({ ...goals[0], savedCents: 100_000 }, '2026-10-01')).toBe(0)
  })

  it('never changes the financial balance', () => {
    expect(totalsForPeriod([], october).expenseCents).toBe(0)
    expect(goalProgressPercent(goals[1])).toBe(100)
  })
})

describe('recurring monthly equivalent', () => {
  it('annualises each frequency', () => {
    expect(recurringMonthlyEquivalent({ amountCents: 1200, frequency: 'monthly' })).toBe(1200)
    expect(recurringMonthlyEquivalent({ amountCents: 1200, frequency: 'yearly' })).toBe(100)
    expect(recurringMonthlyEquivalent({ amountCents: 3600, frequency: 'quarterly' })).toBe(1200)
    expect(recurringMonthlyEquivalent({ amountCents: 1200, frequency: 'weekly' })).toBe(5200)
  })
})
