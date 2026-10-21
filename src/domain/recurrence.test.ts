import { describe, expect, it } from 'vitest'
import {
  firstOccurrenceOnOrAfter,
  nextOccurrenceAfter,
  planRecurringGeneration,
  scheduledDatesUntil,
} from './recurrence'
import type { RecurringOccurrence, RecurringRule } from './types'

function rule(overrides: Partial<RecurringRule> = {}): RecurringRule {
  return {
    id: 'rule-1',
    type: 'expense',
    amountCents: 80_000,
    categoryId: 'cat-expense-housing',
    description: 'Loyer',
    frequency: 'monthly',
    startDate: '2026-01-31',
    endDate: null,
    nextOccurrenceDate: '2026-01-31',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function idFactory(): () => string {
  let index = 0
  return () => {
    index += 1
    return `id-${index}`
  }
}

describe('nextOccurrenceAfter', () => {
  it('keeps the anchor day when possible without drifting', () => {
    expect(nextOccurrenceAfter('2026-01-31', 'monthly', '2026-01-31')).toBe('2026-02-28')
    expect(nextOccurrenceAfter('2026-01-31', 'monthly', '2026-02-28')).toBe('2026-03-31')
    expect(nextOccurrenceAfter('2026-01-31', 'monthly', '2026-03-31')).toBe('2026-04-30')
    expect(nextOccurrenceAfter('2026-01-31', 'monthly', '2026-04-30')).toBe('2026-05-31')
  })

  it('handles leap years and annual dates', () => {
    expect(nextOccurrenceAfter('2024-01-31', 'monthly', '2024-01-31')).toBe('2024-02-29')
    expect(nextOccurrenceAfter('2024-02-29', 'yearly', '2024-02-29')).toBe('2025-02-28')
    expect(nextOccurrenceAfter('2024-02-29', 'yearly', '2025-02-28')).toBe('2026-02-28')
  })

  it('supports weekly, quarterly and semester frequencies', () => {
    expect(nextOccurrenceAfter('2026-10-01', 'weekly', '2026-10-01')).toBe('2026-10-08')
    expect(nextOccurrenceAfter('2026-01-15', 'quarterly', '2026-01-15')).toBe('2026-04-15')
    expect(nextOccurrenceAfter('2026-01-15', 'quarterly', '2026-04-15')).toBe('2026-07-15')
    expect(nextOccurrenceAfter('2026-01-01', 'semester', '2026-01-01')).toBe('2026-07-01')
    expect(nextOccurrenceAfter('2026-07-01', 'semester', '2026-07-01')).toBe('2027-01-01')
  })
})

describe('generation plan', () => {
  it('generates every due occurrence up to today exactly once', () => {
    const first = planRecurringGeneration([rule()], [], {
      today: '2026-04-05',
      idFactory: idFactory(),
      now: '2026-04-05T08:00:00.000Z',
    })
    expect(first.occurrences.map((occurrence) => occurrence.scheduledDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
    ])
    expect(first.transactions).toHaveLength(3)
    expect(first.transactions.map((transaction) => transaction.amountCents)).toEqual([80_000, 80_000, 80_000])
    expect(first.transactions.every((transaction) => transaction.recurringOccurrenceId !== null)).toBe(true)
    expect(first.occurrences.every((occurrence) => occurrence.transactionId === null || transactionExists(occurrence, first.transactions))).toBe(true)
    expect(first.updatedRules[0].nextOccurrenceDate).toBe('2026-04-30')

    const second = planRecurringGeneration([first.updatedRules[0]], first.occurrences, {
      today: '2026-04-29',
      idFactory: idFactory(),
    })
    expect(second.occurrences).toHaveLength(0)
    expect(second.transactions).toHaveLength(0)
    expect(second.updatedRules).toHaveLength(0)
  })

  function transactionExists(occurrence: RecurringOccurrence, transactions: Array<{ id: string }>): boolean {
    return occurrence.transactionId !== null && transactions.some((transaction) => transaction.id === occurrence.transactionId)
  }

  it('does not generate duplicates even with a stale next date', () => {
    const existing: RecurringOccurrence[] = [
      {
        id: 'occ-1',
        recurringRuleId: 'rule-1',
        scheduledDate: '2026-01-31',
        transactionId: null,
        status: 'skipped',
        createdAt: '',
        updatedAt: '',
      },
    ]
    const plan = planRecurringGeneration([rule()], existing, {
      today: '2026-01-31',
      idFactory: idFactory(),
    })
    expect(plan.occurrences).toHaveLength(0)
    expect(plan.transactions).toHaveLength(0)
    expect(plan.updatedRules[0].nextOccurrenceDate).toBe('2026-02-28')
  })

  it('never generates for suspended rules', () => {
    const plan = planRecurringGeneration([rule({ isActive: false })], [], {
      today: '2026-04-05',
      idFactory: idFactory(),
    })
    expect(plan.occurrences).toHaveLength(0)
  })

  it('respects the end date inclusively', () => {
    const plan = planRecurringGeneration([rule({ endDate: '2026-02-28' })], [], {
      today: '2026-06-01',
      idFactory: idFactory(),
    })
    expect(plan.occurrences.map((occurrence) => occurrence.scheduledDate)).toEqual([
      '2026-01-31',
      '2026-02-28',
    ])
  })

  it('keeps pending occurrences out of the totals when auto-confirm is off', () => {
    const plan = planRecurringGeneration([rule()], [], {
      today: '2026-03-31',
      autoConfirm: false,
      idFactory: idFactory(),
    })
    expect(plan.occurrences).toHaveLength(3)
    expect(plan.occurrences.every((occurrence) => occurrence.status === 'pending')).toBe(true)
    expect(plan.transactions).toHaveLength(0)
    expect(plan.occurrences.every((occurrence) => occurrence.transactionId === null)).toBe(true)
  })

  it('processes a newly activated rule only from its next occurrence', () => {
    const plan = planRecurringGeneration(
      [rule({ startDate: '2026-03-15', nextOccurrenceDate: '2026-03-15' })],
      [],
      { today: '2026-05-20', idFactory: idFactory() },
    )
    expect(plan.occurrences.map((occurrence) => occurrence.scheduledDate)).toEqual([
      '2026-03-15',
      '2026-04-15',
      '2026-05-15',
    ])
  })
})

describe('schedule helpers', () => {
  it('finds the first occurrence on or after a date', () => {
    expect(firstOccurrenceOnOrAfter({ startDate: '2026-01-31', frequency: 'monthly' }, '2026-04-01')).toBe(
      '2026-04-30',
    )
    expect(firstOccurrenceOnOrAfter({ startDate: '2026-05-01', frequency: 'monthly' }, '2026-04-01')).toBe(
      '2026-05-01',
    )
  })

  it('lists scheduled dates up to a limit', () => {
    expect(
      scheduledDatesUntil({ startDate: '2026-01-31', frequency: 'monthly', endDate: null }, '2026-03-31'),
    ).toEqual(['2026-01-31', '2026-02-28', '2026-03-31'])
  })
})
