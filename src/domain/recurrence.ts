import { addDays, addMonthsClamped, dateParts, makeIsoDate, todayISO } from './dates'
import type {
  Frequency,
  IsoDate,
  RecurringOccurrence,
  RecurringRule,
  Transaction,
} from './types'

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Chaque semaine',
  monthly: 'Chaque mois',
  quarterly: 'Chaque trimestre',
  semester: 'Chaque semestre',
  yearly: 'Chaque année',
}

const MONTH_STEP: Record<Exclude<Frequency, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  semester: 6,
  yearly: 12,
}

/** Next scheduled date strictly after `current`, anchored on the rule start day. */
export function nextOccurrenceAfter(
  startDate: IsoDate,
  frequency: Frequency,
  current: IsoDate,
): IsoDate {
  if (frequency === 'weekly') return addDays(current, 7)
  const step = MONTH_STEP[frequency]
  const anchor = dateParts(startDate)
  const currentParts = dateParts(current)
  let index = Math.floor(
    ((currentParts.year - anchor.year) * 12 + (currentParts.month - anchor.month)) / step,
  )
  let candidate = addMonthsClamped(startDate, index * step)
  while (candidate <= current) {
    index += 1
    candidate = addMonthsClamped(startDate, index * step)
  }
  return candidate
}

export function occurrenceKey(ruleId: string, scheduledDate: IsoDate): string {
  return `${ruleId}|${scheduledDate}`
}

export function isRuleEnded(rule: Pick<RecurringRule, 'endDate'>, date: IsoDate): boolean {
  return rule.endDate !== null && date > rule.endDate
}

export interface GenerationPlan {
  occurrences: RecurringOccurrence[]
  transactions: Transaction[]
  updatedRules: RecurringRule[]
}

export interface GenerationOptions {
  today?: IsoDate
  autoConfirm?: boolean
  now?: string
  idFactory?: () => string
}

/**
 * Builds all due occurrences up to `today` without mutating data.
 * An occurrence is unique per rule and scheduled date, so running this repeatedly is safe.
 */
export function planRecurringGeneration(
  rules: RecurringRule[],
  existingOccurrences: RecurringOccurrence[],
  options: GenerationOptions = {},
): GenerationPlan {
  const today = options.today ?? todayISO()
  const now = options.now ?? new Date().toISOString()
  const idFactory = options.idFactory ?? (() => crypto.randomUUID())
  const autoConfirm = options.autoConfirm ?? true
  const existingKeys = new Set(
    existingOccurrences.map((occurrence) => occurrenceKey(occurrence.recurringRuleId, occurrence.scheduledDate)),
  )
  const plan: GenerationPlan = { occurrences: [], transactions: [], updatedRules: [] }

  for (const rule of rules) {
    if (!rule.isActive) continue
    let cursor = rule.nextOccurrenceDate < rule.startDate ? rule.startDate : rule.nextOccurrenceDate
    let guard = 0
    while (cursor <= today && guard < 600) {
      guard += 1
      if (rule.endDate && cursor > rule.endDate) break
      const key = occurrenceKey(rule.id, cursor)
      if (!existingKeys.has(key)) {
        existingKeys.add(key)
        const occurrenceId = idFactory()
        const confirmed = autoConfirm
        const transactionId = confirmed ? idFactory() : null
        plan.occurrences.push({
          id: occurrenceId,
          recurringRuleId: rule.id,
          scheduledDate: cursor,
          transactionId,
          status: confirmed ? 'confirmed' : 'pending',
          createdAt: now,
          updatedAt: now,
        })
        if (confirmed && transactionId) {
          plan.transactions.push({
            id: transactionId,
            type: rule.type,
            amountCents: rule.amountCents,
            transactionDate: cursor,
            categoryId: rule.categoryId,
            description: rule.description,
            recurringOccurrenceId: occurrenceId,
            createdAt: now,
            updatedAt: now,
          })
        }
      }
      cursor = nextOccurrenceAfter(rule.startDate, rule.frequency, cursor)
    }
    if (cursor !== rule.nextOccurrenceDate) {
      plan.updatedRules.push({ ...rule, nextOccurrenceDate: cursor, updatedAt: now })
    }
  }

  return plan
}

/** First occurrence date on or after `from`, used when creating a rule. */
export function firstOccurrenceOnOrAfter(rule: Pick<RecurringRule, 'startDate' | 'frequency'>, from: IsoDate): IsoDate {
  let cursor = rule.startDate
  let guard = 0
  while (cursor < from && guard < 600) {
    cursor = nextOccurrenceAfter(rule.startDate, rule.frequency, cursor)
    guard += 1
  }
  return cursor
}

export function scheduledDatesUntil(
  rule: Pick<RecurringRule, 'startDate' | 'frequency' | 'endDate'>,
  until: IsoDate,
  limit = 400,
): IsoDate[] {
  const dates: IsoDate[] = []
  let cursor = rule.startDate
  let guard = 0
  while (cursor <= until && guard < limit) {
    if (rule.endDate && cursor > rule.endDate) break
    dates.push(cursor)
    cursor = nextOccurrenceAfter(rule.startDate, rule.frequency, cursor)
    guard += 1
  }
  return dates
}

/** Normalises a monthly/annual rule start to a stable day, keeping its calendar day. */
export function normalizeRuleStart(start: IsoDate): IsoDate {
  const { year, month, day } = dateParts(start)
  return makeIsoDate(year, month, day)
}
