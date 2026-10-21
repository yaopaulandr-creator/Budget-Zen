export type TransactionType = 'income' | 'expense'

export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'semester' | 'yearly'

export type BudgetPeriodType = 'monthly' | 'quarterly' | 'semester' | 'yearly'

export type PeriodType = 'month' | 'quarter' | 'semester' | 'year'

export type ReportPeriodType = PeriodType | 'custom'

export type SavingsGoalStatus = 'active' | 'achieved' | 'archived'

export type OccurrenceStatus = 'pending' | 'confirmed' | 'skipped'

/** ISO calendar date, `YYYY-MM-DD`, interpreted as a local (Europe/Paris) date. */
export type IsoDate = string

export interface Transaction {
  id: string
  type: TransactionType
  /** Always a positive integer amount of euro cents. */
  amountCents: number
  transactionDate: IsoDate
  categoryId: string
  description: string
  recurringOccurrenceId: string | null
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  type: TransactionType
  icon: string
  color: string
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Budget {
  id: string
  categoryId: string
  limitCents: number
  periodType: BudgetPeriodType
  /** Anchor date of the recurring envelope, normalised to the period boundary. */
  startDate: IsoDate
  alertThresholdPercent: number
  createdAt: string
  updatedAt: string
}

export interface SavingsGoal {
  id: string
  name: string
  targetCents: number
  savedCents: number
  targetDate: IsoDate | null
  description: string
  status: SavingsGoalStatus
  createdAt: string
  updatedAt: string
}

export interface RecurringRule {
  id: string
  type: TransactionType
  amountCents: number
  categoryId: string
  description: string
  frequency: Frequency
  startDate: IsoDate
  endDate: IsoDate | null
  nextOccurrenceDate: IsoDate
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RecurringOccurrence {
  id: string
  recurringRuleId: string
  scheduledDate: IsoDate
  transactionId: string | null
  status: OccurrenceStatus
  createdAt: string
  updatedAt: string
}

export interface UserSettings {
  id: 'settings'
  initialBalanceCents: number
  balanceReferenceDate: IsoDate
  currency: 'EUR'
  locale: 'fr-FR'
  timezone: 'Europe/Paris'
  autoConfirmRecurring: boolean
  createdAt: string
  updatedAt: string
}

export interface AppData {
  transactions: Transaction[]
  categories: Category[]
  budgets: Budget[]
  savingsGoals: SavingsGoal[]
  recurringRules: RecurringRule[]
  occurrences: RecurringOccurrence[]
  settings: UserSettings
}

export interface TransactionDraft {
  type: TransactionType
  amountCents: number
  transactionDate: IsoDate
  categoryId: string
  description: string
}

export interface BudgetDraft {
  categoryId: string
  limitCents: number
  periodType: BudgetPeriodType
  startDate: IsoDate
  alertThresholdPercent: number
}

export interface SavingsGoalDraft {
  name: string
  targetCents: number
  savedCents: number
  targetDate: IsoDate | null
  description: string
}

export interface RecurringRuleDraft {
  type: TransactionType
  amountCents: number
  categoryId: string
  description: string
  frequency: Frequency
  startDate: IsoDate
  endDate: IsoDate | null
}
