import { describe, expect, it } from 'vitest'
import {
  budgetFormSchema,
  categoryFormSchema,
  goalContributionSchema,
  goalFormSchema,
  ruleFormSchema,
  settingsFormSchema,
  transactionFormSchema,
} from './validation'

const validTransaction = {
  type: 'expense' as const,
  amount: '1250,50',
  transactionDate: '2026-10-20',
  categoryId: 'cat-expense-groceries',
  description: 'Courses',
}

function issuesOf(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[] }> } }): string[] {
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.path.join('.'))
}

describe('transactionFormSchema', () => {
  it('accepts a valid transaction with a French decimal amount', () => {
    expect(transactionFormSchema.safeParse(validTransaction).success).toBe(true)
    expect(transactionFormSchema.safeParse({ ...validTransaction, amount: '0,01' }).success).toBe(true)
  })

  it('refuses a zero or negative amount', () => {
    expect(issuesOf(transactionFormSchema.safeParse({ ...validTransaction, amount: '0' }))).toContain('amount')
    expect(issuesOf(transactionFormSchema.safeParse({ ...validTransaction, amount: '0,00' }))).toContain('amount')
    expect(issuesOf(transactionFormSchema.safeParse({ ...validTransaction, amount: '-12,00' }))).toContain('amount')
  })

  it('refuses an empty, malformed or non-numeric amount', () => {
    for (const amount of ['', 'abc', '12,345', '1.2.3', ',']) {
      expect(transactionFormSchema.safeParse({ ...validTransaction, amount }).success).toBe(false)
    }
  })

  it('refuses an invalid date', () => {
    expect(issuesOf(transactionFormSchema.safeParse({ ...validTransaction, transactionDate: '2026-02-30' }))).toContain(
      'transactionDate',
    )
    expect(issuesOf(transactionFormSchema.safeParse({ ...validTransaction, transactionDate: '20/10/2026' }))).toContain(
      'transactionDate',
    )
  })

  it('requires a category', () => {
    expect(issuesOf(transactionFormSchema.safeParse({ ...validTransaction, categoryId: '' }))).toContain('categoryId')
  })

  it('limits the description to 500 characters', () => {
    expect(
      transactionFormSchema.safeParse({ ...validTransaction, description: 'a'.repeat(500) }).success,
    ).toBe(true)
    expect(
      transactionFormSchema.safeParse({ ...validTransaction, description: 'a'.repeat(501) }).success,
    ).toBe(false)
  })
})

describe('categoryFormSchema', () => {
  it('accepts a valid category and trims its name', () => {
    const result = categoryFormSchema.safeParse({
      name: '  Animaux  ',
      type: 'expense',
      icon: 'paw-print',
      color: '#B46A55',
    })
    expect(result.success && result.data.name).toBe('Animaux')
  })

  it('refuses an empty name and an invalid colour', () => {
    const base = { name: 'Animaux', type: 'expense', icon: 'paw-print', color: '#B46A55' }
    expect(categoryFormSchema.safeParse({ ...base, name: '   ' }).success).toBe(false)
    expect(categoryFormSchema.safeParse({ ...base, color: 'red' }).success).toBe(false)
  })
})

describe('budgetFormSchema', () => {
  const base = {
    categoryId: 'cat-expense-groceries',
    limit: '350,00',
    periodType: 'monthly' as const,
    startDate: '2026-10-01',
    alertThresholdPercent: 80,
  }

  it('accepts a valid budget including the semester period', () => {
    expect(budgetFormSchema.safeParse(base).success).toBe(true)
    expect(budgetFormSchema.safeParse({ ...base, periodType: 'semester' }).success).toBe(true)
  })

  it('refuses a zero limit, an invalid period and an out-of-range threshold', () => {
    expect(issuesOf(budgetFormSchema.safeParse({ ...base, limit: '0' }))).toContain('limit')
    expect(issuesOf(budgetFormSchema.safeParse({ ...base, periodType: 'weekly' }))).toContain('periodType')
    expect(issuesOf(budgetFormSchema.safeParse({ ...base, alertThresholdPercent: 0 }))).toContain(
      'alertThresholdPercent',
    )
    expect(issuesOf(budgetFormSchema.safeParse({ ...base, alertThresholdPercent: 101 }))).toContain(
      'alertThresholdPercent',
    )
  })
})

describe('goalFormSchema', () => {
  const base = {
    name: 'Voyage',
    target: '3000,00',
    saved: '0',
    targetDate: '',
    description: '',
  }

  it('accepts a goal with no saved amount and no target date', () => {
    expect(goalFormSchema.safeParse(base).success).toBe(true)
  })

  it('refuses a negative saved amount and an invalid target date', () => {
    expect(issuesOf(goalFormSchema.safeParse({ ...base, saved: '-10' }))).toContain('saved')
    expect(issuesOf(goalFormSchema.safeParse({ ...base, targetDate: '2026-02-31' }))).toContain('targetDate')
  })

  it('refuses a zero contribution', () => {
    expect(goalContributionSchema.safeParse({ amount: '0' }).success).toBe(false)
    expect(goalContributionSchema.safeParse({ amount: '50' }).success).toBe(true)
  })
})

describe('ruleFormSchema', () => {
  const base = {
    type: 'expense' as const,
    amount: '850,00',
    categoryId: 'cat-expense-housing',
    description: 'Loyer',
    frequency: 'monthly' as const,
    startDate: '2026-10-05',
    endDate: '',
  }

  it('accepts a rule without an end date', () => {
    expect(ruleFormSchema.safeParse(base).success).toBe(true)
  })

  it('refuses an end date before the start date', () => {
    const result = ruleFormSchema.safeParse({ ...base, endDate: '2026-10-04' })
    expect(result.success).toBe(false)
    expect(issuesOf(result)).toContain('endDate')
  })
})

describe('settingsFormSchema', () => {
  it('accepts a negative initial balance and a valid reference date', () => {
    expect(
      settingsFormSchema.safeParse({
        initialBalance: '-250,00',
        balanceReferenceDate: '2026-01-01',
        autoConfirmRecurring: false,
      }).success,
    ).toBe(true)
  })

  it('refuses an invalid reference date', () => {
    expect(
      settingsFormSchema.safeParse({
        initialBalance: '0',
        balanceReferenceDate: '2026-00-10',
        autoConfirmRecurring: true,
      }).success,
    ).toBe(false)
  })
})
