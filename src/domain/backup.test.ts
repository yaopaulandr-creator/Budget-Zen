import { describe, expect, it } from 'vitest'
import { BackupError, parseBackup, serializeBackup } from './backup'
import { createDefaultCategories, createDefaultSettings } from './defaults'
import type { AppData, RecurringOccurrence, RecurringRule, Transaction } from './types'
import { checkIntegrity } from './validation'

const now = '2026-10-19T12:00:00.000Z'

function makeData(): AppData {
  const transaction: Transaction = {
    id: 'tx-1',
    type: 'expense',
    amountCents: 125_050,
    transactionDate: '2026-10-05',
    categoryId: 'cat-expense-housing',
    description: 'Loyer',
    recurringOccurrenceId: 'occ-1',
    createdAt: now,
    updatedAt: now,
  }
  const rule: RecurringRule = {
    id: 'rule-1',
    type: 'expense',
    amountCents: 125_050,
    categoryId: 'cat-expense-housing',
    description: 'Loyer',
    frequency: 'monthly',
    startDate: '2026-10-05',
    endDate: null,
    nextOccurrenceDate: '2026-11-05',
    isActive: true,
    createdAt: now,
    updatedAt: now,
  }
  const occurrence: RecurringOccurrence = {
    id: 'occ-1',
    recurringRuleId: 'rule-1',
    scheduledDate: '2026-10-05',
    transactionId: 'tx-1',
    status: 'confirmed',
    createdAt: now,
    updatedAt: now,
  }
  return {
    transactions: [transaction],
    categories: createDefaultCategories(now),
    budgets: [],
    savingsGoals: [],
    recurringRules: [rule],
    occurrences: [occurrence],
    settings: createDefaultSettings(now, '2026-01-01'),
  }
}

describe('backup round-trip', () => {
  it('serialises and parses a valid backup with a summary', () => {
    const data = makeData()
    const parsed = parseBackup(serializeBackup(data, now))
    expect(parsed.summary).toMatchObject({
      schemaVersion: 1,
      exportedAt: now,
      transactions: 1,
      budgets: 0,
      occurrences: 1,
      pendingOccurrences: 0,
      dateRange: { start: '2026-10-05', end: '2026-10-05' },
      initialBalanceCents: 0,
      balanceReferenceDate: '2026-01-01',
    })
    expect(parsed.backup.data.transactions[0].amountCents).toBe(125050)
    expect(parsed.backup.data.categories.length).toBeGreaterThan(10)
  })

  it('rejects malformed JSON and empty files', () => {
    expect(() => parseBackup('{not json')).toThrow(BackupError)
    expect(() => parseBackup('')).toThrow(BackupError)
    expect(() => parseBackup('[]')).toThrow(BackupError)
  })

  it('rejects a schema version newer than the app', () => {
    const data = makeData()
    const backup = JSON.parse(serializeBackup(data, now))
    backup.schemaVersion = 2
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/version plus récente/i)
  })

  it('rejects unknown fields instead of silently importing them', () => {
    const backup = JSON.parse(serializeBackup(makeData(), now))
    backup.data.transactions[0].sneaky = 'value'
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/format de la sauvegarde est invalide/i)
  })
})

describe('integrity checks', () => {
  it('rejects a transaction whose category type does not match', () => {
    const data = makeData()
    data.transactions[0].categoryId = 'cat-income-salary'
    data.transactions[0].recurringOccurrenceId = null
    data.occurrences = []
    expect(checkIntegrity(data)).toEqual(
      expect.arrayContaining([expect.stringContaining('type incompatible')]),
    )
  })

  it('rejects duplicate occurrences for the same rule and date', () => {
    const data = makeData()
    data.occurrences.push({ ...data.occurrences[0], id: 'occ-2', transactionId: null, status: 'skipped' })
    expect(checkIntegrity(data)).toEqual(
      expect.arrayContaining([expect.stringContaining('Échéance en double')]),
    )
  })

  it('rejects broken transaction/occurrence links', () => {
    const data = makeData()
    data.transactions[0].recurringOccurrenceId = 'missing'
    expect(checkIntegrity(data)).toEqual(
      expect.arrayContaining([expect.stringContaining('échéance récurrente introuvable')]),
    )
  })

  it('rejects a budget attached to an income category', () => {
    const data = makeData()
    data.budgets.push({
      id: 'budget-1',
      categoryId: 'cat-income-salary',
      limitCents: 1000,
      periodType: 'monthly',
      startDate: '2026-10-01',
      alertThresholdPercent: 80,
      createdAt: now,
      updatedAt: now,
    })
    expect(checkIntegrity(data)).toEqual(
      expect.arrayContaining([expect.stringContaining('la catégorie doit être une dépense')]),
    )
  })

  it('preserves history when the originating rule has been deleted', () => {
    const data = makeData()
    data.recurringRules = []
    expect(checkIntegrity(data)).toEqual([])
  })

  it('never imports an incoherent backup through parseBackup', () => {
    const data = makeData()
    data.transactions[0].categoryId = 'cat-income-salary'
    expect(() => parseBackup(serializeBackup(data, now))).toThrow(BackupError)
  })
})
