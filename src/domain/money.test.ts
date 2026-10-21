import { describe, expect, it } from 'vitest'
import {
  centsToInput,
  formatEUR,
  formatPercent,
  formatSignedEUR,
  parseAmountToCents,
} from './money'

const plain = (value: string) => value.replace(/[\u202f\u00a0]/g, ' ')

describe('formatEUR', () => {
  it('formats cents with French grouping, decimal comma and euro sign', () => {
    expect(plain(formatEUR(125050))).toBe('1 250,50 €')
    expect(plain(formatEUR(1))).toBe('0,01 €')
    expect(plain(formatEUR(0))).toBe('0,00 €')
    expect(plain(formatEUR(123456789))).toBe('1 234 567,89 €')
  })

  it('formats signed amounts explicitly', () => {
    expect(plain(formatSignedEUR(100000))).toBe('+1 000,00 €')
    expect(plain(formatSignedEUR(-100000))).toBe('−1 000,00 €')
    expect(plain(formatSignedEUR(0))).toBe('0,00 €')
  })
})

describe('parseAmountToCents', () => {
  it('parses French, dot-decimal and grouped formats exactly', () => {
    expect(parseAmountToCents('1250,50')).toBe(125050)
    expect(parseAmountToCents('1 250,50')).toBe(125050)
    expect(parseAmountToCents('1\u00a0250,50')).toBe(125050)
    expect(parseAmountToCents('1.250,50')).toBe(125050)
    expect(parseAmountToCents('1250.50')).toBe(125050)
    expect(parseAmountToCents('1.250')).toBe(125000)
    expect(parseAmountToCents('1,2')).toBe(120)
    expect(parseAmountToCents('12.')).toBe(null)
    expect(parseAmountToCents('0,99 €')).toBe(99)
    expect(parseAmountToCents('2500')).toBe(250000)
  })

  it('rejects zero and negative amounts by default', () => {
    expect(parseAmountToCents('0')).toBe(null)
    expect(parseAmountToCents('0,00')).toBe(null)
    expect(parseAmountToCents('-10,00')).toBe(null)
    expect(parseAmountToCents('0,00', { allowZero: true })).toBe(0)
    expect(parseAmountToCents('-250,50', { allowNegative: true })).toBe(-25050)
  })

  it('rejects malformed values and more than two decimals', () => {
    expect(parseAmountToCents('')).toBe(null)
    expect(parseAmountToCents('abc')).toBe(null)
    expect(parseAmountToCents('12,345')).toBe(null)
    expect(parseAmountToCents('1,2,3')).toBe(null)
    expect(parseAmountToCents('1 2')).toBe(1200) // spaces are grouping separators
    expect(parseAmountToCents('999999999999999999999')).toBe(null)
  })

  it('never loses a cent when adding or subtracting', () => {
    const values = ['0,10', '0,20', '1 250,50', '0,01']
    const cents = values.map((value) => parseAmountToCents(value) ?? 0)
    expect(cents.reduce((sum, value) => sum + value, 0)).toBe(125081)
  })
})

describe('centsToInput', () => {
  it('produces an editable French value', () => {
    expect(centsToInput(125050)).toBe('1250,50')
    expect(centsToInput(1)).toBe('0,01')
    expect(centsToInput(0)).toBe('0,00')
    expect(centsToInput(-25050)).toBe('-250,50')
  })
})

describe('formatPercent', () => {
  it('uses a French decimal comma and a narrow space', () => {
    expect(plain(formatPercent(31.5, 1))).toBe('31,5 %')
    expect(plain(formatPercent(100))).toBe('100 %')
  })
})
