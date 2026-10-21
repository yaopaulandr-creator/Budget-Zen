import { describe, expect, it } from 'vitest'
import { createTransactionsCsv, sanitizeSpreadsheetText } from './csv'
import type { Category, Transaction } from '../domain/types'

const categories: Category[] = [
  {
    id: 'food',
    name: 'Courses; alimentaires',
    type: 'expense',
    icon: 'shopping-basket',
    color: '#C2703D',
    isDefault: true,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
]
const now = '2026-10-19T12:00:00.000Z'

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    type: 'expense',
    amountCents: 125_050,
    transactionDate: '2026-10-05',
    categoryId: 'food',
    description: 'Courses de la semaine',
    recurringOccurrenceId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('sanitizeSpreadsheetText', () => {
  it('neutralises formula-leading cells', () => {
    expect(sanitizeSpreadsheetText('=SUM(A1:A2)')).toBe("'=SUM(A1:A2)")
    expect(sanitizeSpreadsheetText('+1+1')).toBe("'+1+1")
    expect(sanitizeSpreadsheetText('-1+1')).toBe("'-1+1")
    expect(sanitizeSpreadsheetText('@cmd')).toBe("'@cmd")
    expect(sanitizeSpreadsheetText(' =1+1')).toBe("' =1+1")
    expect(sanitizeSpreadsheetText('Rapport')).toBe('Rapport')
  })
})

describe('createTransactionsCsv', () => {
  it('uses a BOM, semicolons, ISO dates and comma decimals', () => {
    const csv = createTransactionsCsv([transaction()], categories)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    const [header, row] = csv.replace(/^\uFEFF/, '').split('\r\n')
    expect(header).toBe('Date;Type;Catégorie;Montant (EUR);Description;Opération récurrente')
    expect(row).toContain('2026-10-05;Dépense;')
    expect(row).toContain('1250,50')
    expect(row).toContain('"Courses; alimentaires"')
    expect(row).toContain('Non')
  })

  it('quotes descriptions and protects against formula injection', () => {
    const csv = createTransactionsCsv(
      [
        transaction({
          id: 't2',
          description: '=HYPERLINK("http://malicious"); drop',
        }),
      ],
      categories,
    )
    expect(csv).toContain("'=HYPERLINK")
    expect(csv).toContain('""http://malicious""')
    expect(csv).toContain('; drop')
  })

  it('marks recurring operations explicitly', () => {
    const csv = createTransactionsCsv([transaction({ recurringOccurrenceId: 'occ-1' })], categories)
    expect(csv.split('\r\n')[1].endsWith('Oui')).toBe(true)
  })

  it('sorts the most recent operation first', () => {
    const csv = createTransactionsCsv(
      [
        transaction({ id: 'old', transactionDate: '2026-01-01' }),
        transaction({ id: 'new', transactionDate: '2026-10-01' }),
      ],
      categories,
    )
    const rows = csv.trim().split('\r\n').slice(1)
    expect(rows[0].startsWith('2026-10-01')).toBe(true)
    expect(rows[1].startsWith('2026-01-01')).toBe(true)
  })

  it('handles an empty data set with headers only', () => {
    const csv = createTransactionsCsv([], categories)
    expect(csv.replace(/^\uFEFF/, '').trim().split('\r\n')).toHaveLength(1)
  })
})
