import { addMonthsClamped, dateParts, makeIsoDate, nowISOString, startOfMonth, todayISO } from './dates'
import type { AppData, Budget, SavingsGoal, Transaction, TransactionType } from './types'

export const DEMO_ID_PREFIX = 'demo-'

interface DemoLine {
  day: number
  type: TransactionType
  amountCents: number
  categoryId: string
  description: string
}

const MONTHLY_LINES: DemoLine[] = [
  { day: 2, type: 'income', amountCents: 245_000, categoryId: 'cat-income-salary', description: 'Salaire mensuel' },
  { day: 5, type: 'expense', amountCents: 85_000, categoryId: 'cat-expense-housing', description: 'Loyer appartement' },
  { day: 6, type: 'expense', amountCents: 9_450, categoryId: 'cat-expense-energy', description: 'Électricité et gaz' },
  { day: 7, type: 'expense', amountCents: 3_199, categoryId: 'cat-expense-phone', description: 'Box Internet et mobile' },
  { day: 8, type: 'expense', amountCents: 2_999, categoryId: 'cat-expense-insurance', description: 'Assurance habitation' },
  { day: 10, type: 'expense', amountCents: 7_240, categoryId: 'cat-expense-groceries', description: 'Courses de la semaine' },
  { day: 12, type: 'expense', amountCents: 3_860, categoryId: 'cat-expense-transport', description: 'Abonnement transports' },
  { day: 14, type: 'expense', amountCents: 15_990, categoryId: 'cat-expense-subscriptions', description: 'Abonnements streaming' },
  { day: 17, type: 'expense', amountCents: 5_620, categoryId: 'cat-expense-groceries', description: 'Supermarché' },
  { day: 19, type: 'expense', amountCents: 4_250, categoryId: 'cat-expense-restaurants', description: 'Dîner entre amis' },
  { day: 21, type: 'expense', amountCents: 6_800, categoryId: 'cat-expense-health', description: 'Pharmacie' },
  { day: 23, type: 'expense', amountCents: 8_175, categoryId: 'cat-expense-groceries', description: 'Courses et produits ménagers' },
  { day: 25, type: 'expense', amountCents: 3_290, categoryId: 'cat-expense-leisure', description: 'Cinéma et livre' },
  { day: 27, type: 'expense', amountCents: 6_490, categoryId: 'cat-expense-shopping', description: 'Vêtements' },
  { day: 28, type: 'expense', amountCents: 2_150, categoryId: 'cat-expense-restaurants', description: 'Déjeuner en ville' },
]

const EXTRA_LINES: Record<number, DemoLine> = {
  2: { day: 16, type: 'income', amountCents: 45_000, categoryId: 'cat-income-freelance', description: 'Mission freelance' },
  4: { day: 20, type: 'income', amountCents: 12_500, categoryId: 'cat-income-bonus', description: 'Prime exceptionnelle' },
  5: { day: 11, type: 'expense', amountCents: 42_000, categoryId: 'cat-expense-travel', description: 'Week-end prolongé' },
}

export function buildDemoData(now: string = nowISOString(), today: string = todayISO()): {
  transactions: Transaction[]
  budgets: Budget[]
  savingsGoals: SavingsGoal[]
} {
  const currentMonth = startOfMonth(today)
  const transactions: Transaction[] = []
  let index = 0

  for (let offset = -5; offset <= 0; offset += 1) {
    const month = addMonthsClamped(currentMonth, offset)
    const lines = [...MONTHLY_LINES]
    const extra = EXTRA_LINES[Math.abs(offset)]
    if (extra) lines.push(extra)

    for (const line of lines) {
      const { year, month: monthNumber } = dateParts(month)
      const date = makeIsoDate(year, monthNumber, line.day)
      if (date > today) continue
      index += 1
      transactions.push({
        id: `${DEMO_ID_PREFIX}tx-${index}`,
        type: line.type,
        amountCents: line.amountCents,
        transactionDate: date,
        categoryId: line.categoryId,
        description: line.description,
        recurringOccurrenceId: null,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  // Keep the current month populated even at the very beginning of a month.
  if (!transactions.some((transaction) => transaction.transactionDate.startsWith(today.slice(0, 7)))) {
    transactions.push({
      id: `${DEMO_ID_PREFIX}tx-current`,
      type: 'expense',
      amountCents: 2_480,
      transactionDate: today,
      categoryId: 'cat-expense-groceries',
      description: 'Courses du jour',
      recurringOccurrenceId: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  const budgets: Budget[] = [
    {
      id: `${DEMO_ID_PREFIX}budget-groceries`,
      categoryId: 'cat-expense-groceries',
      limitCents: 40_000,
      periodType: 'monthly',
      startDate: addMonthsClamped(currentMonth, -5),
      alertThresholdPercent: 80,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${DEMO_ID_PREFIX}budget-restaurants`,
      categoryId: 'cat-expense-restaurants',
      limitCents: 15_000,
      periodType: 'monthly',
      startDate: addMonthsClamped(currentMonth, -5),
      alertThresholdPercent: 80,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${DEMO_ID_PREFIX}budget-leisure`,
      categoryId: 'cat-expense-leisure',
      limitCents: 10_000,
      periodType: 'monthly',
      startDate: addMonthsClamped(currentMonth, -5),
      alertThresholdPercent: 75,
      createdAt: now,
      updatedAt: now,
    },
  ]

  const savingsGoals: SavingsGoal[] = [
    {
      id: `${DEMO_ID_PREFIX}goal-travel`,
      name: 'Week-end au Portugal',
      targetCents: 120_000,
      savedCents: 48_000,
      targetDate: addMonthsClamped(today, 6),
      description: 'Deux billets, hôtel et repas sur place.',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${DEMO_ID_PREFIX}goal-emergency`,
      name: 'Fonds d’urgence',
      targetCents: 300_000,
      savedCents: 210_000,
      targetDate: addMonthsClamped(today, 12),
      description: 'Trois mois de dépenses courantes.',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  ]

  return { transactions, budgets, savingsGoals }
}

export function hasDemoData(data: AppData): boolean {
  return (
    data.transactions.some((item) => item.id.startsWith(DEMO_ID_PREFIX)) ||
    data.budgets.some((item) => item.id.startsWith(DEMO_ID_PREFIX)) ||
    data.savingsGoals.some((item) => item.id.startsWith(DEMO_ID_PREFIX))
  )
}

export function stripDemoData(data: AppData): AppData {
  return {
    ...data,
    transactions: data.transactions.filter((item) => !item.id.startsWith(DEMO_ID_PREFIX)),
    budgets: data.budgets.filter((item) => !item.id.startsWith(DEMO_ID_PREFIX)),
    savingsGoals: data.savingsGoals.filter((item) => !item.id.startsWith(DEMO_ID_PREFIX)),
  }
}
