import { describe, expect, it } from 'vitest'
import {
  customPeriod,
  isDateInPeriod,
  monthSubperiods,
  periodLengthDays,
  previousPeriod,
  quarterSubperiods,
  resolvePeriod,
  shiftPeriod,
} from './periods'
import { totalsForPeriod } from './finance'
import type { Transaction } from './types'

function transaction(id: string, date: string, amountCents = 1000): Transaction {
  return {
    id,
    type: 'expense',
    amountCents,
    transactionDate: date,
    categoryId: 'c',
    description: id,
    recurringOccurrenceId: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T10:00:00.000Z`,
  }
}

describe('resolvePeriod', () => {
  it('uses inclusive start and exclusive end for months of 28, 29, 30 and 31 days', () => {
    const february = resolvePeriod('month', '2025-02-15')
    expect(february.start).toBe('2025-02-01')
    expect(february.endExclusive).toBe('2025-03-01')
    expect(periodLengthDays(february)).toBe(28)

    const leapFebruary = resolvePeriod('month', '2024-02-15')
    expect(periodLengthDays(leapFebruary)).toBe(29)

    expect(periodLengthDays(resolvePeriod('month', '2025-04-10'))).toBe(30)
    expect(periodLengthDays(resolvePeriod('month', '2025-08-10'))).toBe(31)
  })

  it('handles year changes for December and January', () => {
    const december = resolvePeriod('month', '2025-12-31')
    expect(december.start).toBe('2025-12-01')
    expect(december.endExclusive).toBe('2026-01-01')
    expect(resolvePeriod('month', '2026-01-01').start).toBe('2026-01-01')
  })

  it('resolves quarters with calendar boundaries', () => {
    expect(resolvePeriod('quarter', '2026-02-15')).toMatchObject({
      start: '2026-01-01',
      endExclusive: '2026-04-01',
      label: 'T1 2026',
    })
    expect(resolvePeriod('quarter', '2026-05-02')).toMatchObject({
      start: '2026-04-01',
      endExclusive: '2026-07-01',
      label: 'T2 2026',
    })
    expect(resolvePeriod('quarter', '2026-10-19')).toMatchObject({
      start: '2026-10-01',
      endExclusive: '2027-01-01',
      label: 'T4 2026',
    })
  })

  it('resolves semesters and years', () => {
    expect(resolvePeriod('semester', '2026-03-31')).toMatchObject({
      start: '2026-01-01',
      endExclusive: '2026-07-01',
      label: 'S1 2026',
    })
    expect(resolvePeriod('semester', '2026-07-01')).toMatchObject({
      start: '2026-07-01',
      endExclusive: '2027-01-01',
      label: 'S2 2026',
    })
    expect(resolvePeriod('year', '2026-06-15')).toMatchObject({
      start: '2026-01-01',
      endExclusive: '2027-01-01',
      label: '2026',
    })
  })

  it('accepts a custom range with inclusive end date', () => {
    const period = customPeriod('2026-01-15', '2026-02-10')
    expect(period.start).toBe('2026-01-15')
    expect(period.endExclusive).toBe('2026-02-11')
    expect(() => customPeriod('2026-02-10', '2026-01-15')).toThrow()
  })
})

describe('period membership and navigation', () => {
  it('includes the start date and excludes the end date', () => {
    const period = resolvePeriod('month', '2026-10-10')
    expect(isDateInPeriod('2026-10-01', period)).toBe(true)
    expect(isDateInPeriod('2026-10-31', period)).toBe(true)
    expect(isDateInPeriod('2026-11-01', period)).toBe(false)
    expect(isDateInPeriod('2026-09-30', period)).toBe(false)
  })

  it('navigates across year boundaries', () => {
    const january = resolvePeriod('month', '2026-01-01')
    expect(previousPeriod(january).label).toBe('Décembre 2025')
    expect(shiftPeriod(january, -1).endExclusive).toBe('2026-01-01')

    const q4 = resolvePeriod('quarter', '2026-11-01')
    expect(shiftPeriod(q4, 1).label).toBe('T1 2027')
    expect(previousPeriod(q4).label).toBe('T3 2026')
  })

  it('shifts custom ranges by their exact length', () => {
    const custom = customPeriod('2026-01-01', '2026-01-10')
    const next = shiftPeriod(custom, 1)
    expect(next.start).toBe('2026-01-11')
    expect(next.endExclusive).toBe('2026-01-21')
    const before = previousPeriod(custom)
    expect(before.start).toBe('2025-12-22')
    expect(before.endExclusive).toBe('2026-01-01')
  })
})

describe('sub-period decomposition', () => {
  it('splits a year into 12 months and 4 quarters', () => {
    const year = resolvePeriod('year', '2026-01-01')
    expect(monthSubperiods(year)).toHaveLength(12)
    expect(quarterSubperiods(year)).toHaveLength(4)
    expect(quarterSubperiods(year).map((period) => period.label)).toEqual([
      'T1 2026',
      'T2 2026',
      'T3 2026',
      'T4 2026',
    ])
  })

  it('splits a semester into its quarters and months', () => {
    const semester = resolvePeriod('semester', '2026-07-01')
    expect(monthSubperiods(semester).map((period) => period.start)).toEqual([
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
    ])
    expect(quarterSubperiods(semester).map((period) => period.label)).toEqual(['T3 2026', 'T4 2026'])
  })

  it('clips custom sub-periods and never assigns a transaction twice', () => {
    const period = customPeriod('2026-01-15', '2026-03-10')
    const subs = monthSubperiods(period)
    expect(subs).toHaveLength(3)
    expect(subs[0].start).toBe('2026-01-15')
    expect(subs[2].endExclusive).toBe('2026-03-11')

    const transactions = [
      transaction('a', '2026-01-15'),
      transaction('b', '2026-01-31'),
      transaction('c', '2026-02-01'),
      transaction('d', '2026-02-28'),
      transaction('e', '2026-03-10'),
    ]
    const counts = subs.map(
      (sub) => totalsForPeriod(transactions, sub).transactionCount,
    )
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe(transactions.length)
    expect(counts).toEqual([2, 2, 1])
  })

  it('keeps the parent total equal to the sum of its sub-periods', () => {
    const year = resolvePeriod('year', '2026-01-01')
    const transactions = Array.from({ length: 40 }, (_, index) => {
      const month = String((index % 12) + 1).padStart(2, '0')
      const day = String((index % 28) + 1).padStart(2, '0')
      return transaction(`t${index}`, `2026-${month}-${day}`, (index + 1) * 137)
    })
    const parent = totalsForPeriod(transactions, year)
    const months = monthSubperiods(year).map((sub) => totalsForPeriod(transactions, sub))
    const quarters = quarterSubperiods(year).map((sub) => totalsForPeriod(transactions, sub))
    for (const rows of [months, quarters]) {
      expect(rows.reduce((sum, row) => sum + row.expenseCents, 0)).toBe(parent.expenseCents)
      expect(rows.reduce((sum, row) => sum + row.transactionCount, 0)).toBe(parent.transactionCount)
    }
  })
})
