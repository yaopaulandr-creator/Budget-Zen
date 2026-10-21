import { z } from 'zod'
import { isIsoDate } from './dates'
import { parseAmountToCents } from './money'
import type { AppData } from './types'

const isoDateSchema = z.string().refine(isIsoDate, 'Date invalide (JJ/MM/AAAA).')
const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur invalide.')

const positiveAmountSchema = z
  .string()
  .min(1, 'Le montant est obligatoire.')
  .superRefine((value, ctx) => {
    const cents = parseAmountToCents(value)
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Saisissez un montant positif valide (ex. 1250,50).' })
    }
  })

const nonNegativeAmountSchema = z
  .string()
  .min(1, 'Le montant est obligatoire.')
  .superRefine((value, ctx) => {
    const cents = parseAmountToCents(value, { allowZero: true })
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Saisissez un montant valide (ex. 500,00).' })
    }
  })

const signedAmountSchema = z
  .string()
  .min(1, 'Le montant est obligatoire.')
  .superRefine((value, ctx) => {
    const cents = parseAmountToCents(value, { allowNegative: true, allowZero: true })
    if (cents === null) {
      ctx.addIssue({ code: 'custom', message: 'Saisissez un montant valide (ex. 500,00 ou -250,00).' })
    }
  })

export const transactionFormSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: positiveAmountSchema,
  transactionDate: isoDateSchema,
  categoryId: z.string().min(1, 'Choisissez une catégorie.'),
  description: z.string().max(500, 'La description ne peut pas dépasser 500 caractères.'),
})

export type TransactionFormValues = z.infer<typeof transactionFormSchema>

export const categoryFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Le nom est obligatoire.')
    .max(80, 'Le nom ne peut pas dépasser 80 caractères.'),
  type: z.enum(['income', 'expense']),
  icon: z.string().min(1),
  color: hexColorSchema,
})

export type CategoryFormValues = z.infer<typeof categoryFormSchema>

export const budgetFormSchema = z.object({
  categoryId: z.string().min(1, 'Choisissez une catégorie de dépenses.'),
  limit: positiveAmountSchema,
  periodType: z.enum(['monthly', 'quarterly', 'semester', 'yearly']),
  startDate: isoDateSchema,
  alertThresholdPercent: z
    .number({ error: 'Saisissez un seuil valide.' })
    .min(1, 'Le seuil doit être compris entre 1 et 100 %.')
    .max(100, 'Le seuil doit être compris entre 1 et 100 %.'),
})

export type BudgetFormValues = z.infer<typeof budgetFormSchema>

export const goalFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Le nom de l'objectif est obligatoire.")
    .max(100, 'Le nom ne peut pas dépasser 100 caractères.'),
  target: positiveAmountSchema,
  saved: nonNegativeAmountSchema,
  targetDate: z.string().refine((value) => value === '' || isIsoDate(value), 'Date cible invalide.'),
  description: z.string().max(500, 'La description ne peut pas dépasser 500 caractères.'),
})

export type GoalFormValues = z.infer<typeof goalFormSchema>

export const ruleFormSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    amount: positiveAmountSchema,
    categoryId: z.string().min(1, 'Choisissez une catégorie.'),
    description: z.string().max(500, 'La description ne peut pas dépasser 500 caractères.'),
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'semester', 'yearly']),
    startDate: isoDateSchema,
    endDate: z.string().refine((value) => value === '' || isIsoDate(value), 'Date de fin invalide.'),
  })
  .superRefine((values, ctx) => {
    if (values.endDate && values.endDate < values.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'La date de fin doit suivre la date de début.',
      })
    }
  })

export type RuleFormValues = z.infer<typeof ruleFormSchema>

export const settingsFormSchema = z.object({
  initialBalance: signedAmountSchema,
  balanceReferenceDate: isoDateSchema,
  autoConfirmRecurring: z.boolean(),
})

export type SettingsFormValues = z.infer<typeof settingsFormSchema>

export const goalContributionSchema = z.object({
  amount: positiveAmountSchema,
})

export const BACKUP_SCHEMA_VERSION = 1

const timestampSchema = z.string().min(1).max(40)
const idSchema = z.string().min(1).max(100)

const transactionSchema = z
  .object({
    id: idSchema,
    type: z.enum(['income', 'expense']),
    amountCents: z.number().int().positive().max(100_000_000_000),
    transactionDate: isoDateSchema,
    categoryId: idSchema,
    description: z.string().max(500),
    recurringOccurrenceId: idSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

const categorySchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(80),
    type: z.enum(['income', 'expense']),
    icon: z.string().max(50),
    color: hexColorSchema,
    isDefault: z.boolean(),
    isActive: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

const budgetSchema = z
  .object({
    id: idSchema,
    categoryId: idSchema,
    limitCents: z.number().int().positive().max(100_000_000_000),
    periodType: z.enum(['monthly', 'quarterly', 'semester', 'yearly']),
    startDate: isoDateSchema,
    alertThresholdPercent: z.number().min(1).max(100),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

const savingsGoalSchema = z
  .object({
    id: idSchema,
    name: z.string().trim().min(1).max(100),
    targetCents: z.number().int().positive().max(100_000_000_000),
    savedCents: z.number().int().min(0).max(100_000_000_000),
    targetDate: isoDateSchema.nullable(),
    description: z.string().max(500),
    status: z.enum(['active', 'achieved', 'archived']),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

const recurringRuleSchema = z
  .object({
    id: idSchema,
    type: z.enum(['income', 'expense']),
    amountCents: z.number().int().positive().max(100_000_000_000),
    categoryId: idSchema,
    description: z.string().max(500),
    frequency: z.enum(['weekly', 'monthly', 'quarterly', 'semester', 'yearly']),
    startDate: isoDateSchema,
    endDate: isoDateSchema.nullable(),
    nextOccurrenceDate: isoDateSchema,
    isActive: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

const recurringOccurrenceSchema = z
  .object({
    id: idSchema,
    recurringRuleId: idSchema,
    scheduledDate: isoDateSchema,
    transactionId: idSchema.nullable(),
    status: z.enum(['pending', 'confirmed', 'skipped']),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

export const userSettingsSchema = z
  .object({
    id: z.literal('settings'),
    initialBalanceCents: z.number().int().min(-100_000_000_000).max(100_000_000_000),
    balanceReferenceDate: isoDateSchema,
    currency: z.literal('EUR'),
    locale: z.literal('fr-FR'),
    timezone: z.literal('Europe/Paris'),
    autoConfirmRecurring: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict()

export const appDataSchema = z
  .object({
    transactions: z.array(transactionSchema).max(200_000),
    categories: z.array(categorySchema).max(2_000),
    budgets: z.array(budgetSchema).max(2_000),
    savingsGoals: z.array(savingsGoalSchema).max(2_000),
    recurringRules: z.array(recurringRuleSchema).max(2_000),
    occurrences: z.array(recurringOccurrenceSchema).max(200_000),
    settings: userSettingsSchema,
  })
  .strict()

export const backupSchema = z
  .object({
    app: z.literal('BudgetZen'),
    schemaVersion: z.number().int().min(1),
    exportedAt: z.string().min(1).max(40),
    data: appDataSchema,
  })
  .strict()

export type BackupEnvelope = z.infer<typeof backupSchema>

export interface BackupSummary {
  schemaVersion: number
  exportedAt: string
  transactions: number
  categories: number
  customCategories: number
  budgets: number
  savingsGoals: number
  recurringRules: number
  occurrences: number
  pendingOccurrences: number
  dateRange: { start: string; end: string } | null
  initialBalanceCents: number
  balanceReferenceDate: string
}

/** Validates referential integrity that a shape-only schema cannot express. */
export function checkIntegrity(data: AppData): string[] {
  const errors: string[] = []
  const categoryById = new Map(data.categories.map((category) => [category.id, category]))
  const transactionById = new Map(data.transactions.map((transaction) => [transaction.id, transaction]))
  const occurrenceById = new Map(data.occurrences.map((occurrence) => [occurrence.id, occurrence]))
  const ruleIds = new Set(data.recurringRules.map((rule) => rule.id))

  if (categoryById.size !== data.categories.length) errors.push('Identifiants de catégories en double.')
  if (transactionById.size !== data.transactions.length) errors.push('Identifiants de transactions en double.')
  if (occurrenceById.size !== data.occurrences.length) errors.push('Identifiants d’échéances en double.')
  if (new Set(data.budgets.map((budget) => budget.id)).size !== data.budgets.length) {
    errors.push('Identifiants de budgets en double.')
  }
  if (new Set(data.savingsGoals.map((goal) => goal.id)).size !== data.savingsGoals.length) {
    errors.push('Identifiants d’objectifs en double.')
  }
  if (new Set(data.recurringRules.map((rule) => rule.id)).size !== data.recurringRules.length) {
    errors.push('Identifiants de règles en double.')
  }

  for (const transaction of data.transactions) {
    const category = categoryById.get(transaction.categoryId)
    if (!category) {
      errors.push(`Transaction ${transaction.id} : catégorie introuvable.`)
    } else if (category.type !== transaction.type) {
      errors.push(`Transaction ${transaction.id} : type incompatible avec sa catégorie.`)
    }
    if (transaction.recurringOccurrenceId) {
      const occurrence = occurrenceById.get(transaction.recurringOccurrenceId)
      if (!occurrence) {
        errors.push(`Transaction ${transaction.id} : échéance récurrente introuvable.`)
      } else if (occurrence.transactionId !== transaction.id) {
        errors.push(`Transaction ${transaction.id} : lien de récurrence incohérent.`)
      }
    }
  }

  const occurrenceKeys = new Set<string>()
  for (const occurrence of data.occurrences) {
    const key = `${occurrence.recurringRuleId}|${occurrence.scheduledDate}`
    if (occurrenceKeys.has(key)) {
      errors.push(`Échéance en double pour la règle ${occurrence.recurringRuleId} au ${occurrence.scheduledDate}.`)
    }
    occurrenceKeys.add(key)
    if (occurrence.transactionId) {
      const transaction = transactionById.get(occurrence.transactionId)
      if (!transaction) {
        errors.push(`Échéance ${occurrence.id} : transaction liée introuvable.`)
      } else if (transaction.recurringOccurrenceId !== occurrence.id) {
        errors.push(`Échéance ${occurrence.id} : lien de transaction incohérent.`)
      }
    }
    // An occurrence may survive the deletion of its rule: history is preserved.
    if (!ruleIds.has(occurrence.recurringRuleId)) continue
  }

  for (const budget of data.budgets) {
    const category = categoryById.get(budget.categoryId)
    if (!category) errors.push(`Budget ${budget.id} : catégorie introuvable.`)
    else if (category.type !== 'expense') errors.push(`Budget ${budget.id} : la catégorie doit être une dépense.`)
  }

  for (const rule of data.recurringRules) {
    const category = categoryById.get(rule.categoryId)
    if (!category) errors.push(`Règle ${rule.id} : catégorie introuvable.`)
    else if (category.type !== rule.type) errors.push(`Règle ${rule.id} : type incompatible avec sa catégorie.`)
    if (rule.endDate && rule.endDate < rule.startDate) errors.push(`Règle ${rule.id} : date de fin antérieure au début.`)
  }

  const uniqueBudgetKeys = new Set<string>()
  for (const budget of data.budgets) {
    const key = `${budget.categoryId}|${budget.periodType}`
    if (uniqueBudgetKeys.has(key)) {
      errors.push('Deux budgets utilisent la même catégorie et la même période.')
    }
    uniqueBudgetKeys.add(key)
  }

  return errors
}

export function summarizeBackup(backup: BackupEnvelope): BackupSummary {
  const transactions = backup.data.transactions
  const dates = transactions.map((transaction) => transaction.transactionDate).sort()
  return {
    schemaVersion: backup.schemaVersion,
    exportedAt: backup.exportedAt,
    transactions: transactions.length,
    categories: backup.data.categories.length,
    customCategories: backup.data.categories.filter((category) => !category.isDefault).length,
    budgets: backup.data.budgets.length,
    savingsGoals: backup.data.savingsGoals.length,
    recurringRules: backup.data.recurringRules.length,
    occurrences: backup.data.occurrences.length,
    pendingOccurrences: backup.data.occurrences.filter((occurrence) => occurrence.status === 'pending').length,
    dateRange: dates.length ? { start: dates[0], end: dates[dates.length - 1] } : null,
    initialBalanceCents: backup.data.settings.initialBalanceCents,
    balanceReferenceDate: backup.data.settings.balanceReferenceDate,
  }
}
