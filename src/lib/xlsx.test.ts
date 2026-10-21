import { describe, expect, it } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { createTransactionsXlsx } from './xlsx'
import type { Category, Transaction } from '../domain/types'

const categories: Category[] = [
  {
    id: 'food',
    name: 'Courses alimentaires',
    type: 'expense',
    icon: 'shopping-basket',
    color: '#C2703D',
    isDefault: true,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  },
]

const transaction: Transaction = {
  id: 't1',
  type: 'expense',
  amountCents: 125_050,
  transactionDate: '2026-10-05',
  categoryId: 'food',
  description: '=1+1',
  recurringOccurrenceId: null,
  createdAt: '2026-10-19T12:00:00.000Z',
  updatedAt: '2026-10-19T12:00:00.000Z',
}

async function readArchive(blob: Blob): Promise<Record<string, string>> {
  const buffer = await blob.arrayBuffer()
  const entries = unzipSync(new Uint8Array(buffer))
  return Object.fromEntries(Object.entries(entries).map(([name, data]) => [name, strFromU8(data)]))
}

describe('createTransactionsXlsx', () => {
  it('produces a valid OOXML package with the expected parts', async () => {
    const blob = createTransactionsXlsx([transaction], categories, new Date('2026-10-19T12:00:00.000Z'))
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    const archive = await readArchive(blob)
    expect(Object.keys(archive)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        '_rels/.rels',
        'xl/workbook.xml',
        'xl/_rels/workbook.xml.rels',
        'xl/styles.xml',
        'xl/worksheets/sheet1.xml',
      ]),
    )
    expect(archive['xl/workbook.xml']).toContain('name="Transactions"')
  })

  it('writes separate typed columns and protects formula-like descriptions', async () => {
    const blob = createTransactionsXlsx([transaction], categories)
    const archive = await readArchive(blob)
    const sheet = archive['xl/worksheets/sheet1.xml']
    expect(sheet).toContain('Date')
    expect(sheet).toContain('Type')
    expect(sheet).toContain('Catégorie')
    expect(sheet).toContain('Montant')
    expect(sheet).toContain('Description')
    expect(sheet).toContain('2026-10-05')
    expect(sheet).toContain('Courses alimentaires')
    expect(sheet).toContain('&apos;=1+1')
    expect(sheet).toContain('<c r="D2" s="2"><v>1250.5</v></c>')
    expect(sheet).toContain('autoFilter ref="A1:F2"')
  })

  it('keeps a header-only sheet when there are no transactions', async () => {
    const blob = createTransactionsXlsx([], categories)
    const archive = await readArchive(blob)
    expect(archive['xl/worksheets/sheet1.xml']).toContain('A1:F1')
    expect(archive['xl/worksheets/sheet1.xml']).not.toContain('<row r="2">')
  })
})
