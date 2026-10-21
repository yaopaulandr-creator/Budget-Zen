import { describe, expect, it } from 'vitest'
import { createReportPdf, reportPdfFilename, type ReportPdfInput } from './pdf'

const input: ReportPdfInput = {
  title: 'Bilan mensuel',
  periodLabel: 'Octobre 2026',
  periodTypeLabel: 'Mensuel',
  generatedAt: new Date('2026-10-19T18:30:00.000Z'),
  totals: {
    incomeCents: 215_000,
    expenseCents: 115_000,
    netCents: 100_000,
    transactionCount: 113,
    incomeCount: 2,
    expenseCount: 111,
  },
  cumulativeCents: 150_000,
  incomeRows: [
    { name: 'Salaire', color: '#1F7A4D', amountCents: 200_000, sharePercent: 93.02, count: 1 },
    { name: 'Autres revenus', color: '#6B7280', amountCents: 15_000, sharePercent: 6.98, count: 1 },
  ],
  expenseRows: [
    { name: 'Logement et loyer', color: '#B46A55', amountCents: 75_000, sharePercent: 65.2, count: 1 },
    { name: 'Courses alimentaires', color: '#C2703D', amountCents: 40_000, sharePercent: 34.8, count: 110 },
  ],
  monthlyRows: [
    { label: 'sept.', incomeCents: 200_000, expenseCents: 80_000 },
    { label: 'oct.', incomeCents: 215_000, expenseCents: 115_000 },
  ],
  budgets: [
    {
      categoryName: 'Courses alimentaires',
      limitCents: 40_000,
      consumedCents: 40_000,
      status: 'warning',
      cycleLabel: 'du 01/10/2026 au 31/10/2026',
    },
  ],
  goals: [{ name: 'Vacances', targetCents: 300_000, savedCents: 120_000, progressPercent: 40 }],
}

describe('createReportPdf', () => {
  it('produces a non-empty PDF document', async () => {
    const blob = createReportPdf(input)
    expect(blob.type).toBe('application/pdf')
    expect(blob.size).toBeGreaterThan(1000)
    const bytes = new Uint8Array(await blob.arrayBuffer())
    const header = new TextDecoder().decode(bytes.slice(0, 5))
    expect(header).toBe('%PDF-')
  })

  it('handles an empty report without throwing', async () => {
    const blob = createReportPdf({
      ...input,
      totals: { incomeCents: 0, expenseCents: 0, netCents: 0, transactionCount: 0, incomeCount: 0, expenseCount: 0 },
      cumulativeCents: 0,
      incomeRows: [],
      expenseRows: [],
      monthlyRows: [],
      budgets: [],
      goals: [],
    })
    expect(blob.size).toBeGreaterThan(500)
  })
})

describe('reportPdfFilename', () => {
  it('slugifies accents and appends the date', () => {
    expect(reportPdfFilename('Bilan annuel — Épargne 2026', new Date('2026-10-19T12:00:00Z'))).toBe(
      'bilan-annuel-epargne-2026-2026-10-19.pdf',
    )
  })
})
