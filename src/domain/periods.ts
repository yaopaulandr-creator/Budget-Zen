import {
  addDays,
  addMonthsClamped,
  dateParts,
  differenceInDays,
  formatDateFR,
  formatMonthYearFR,
  startOfMonth,
  startOfQuarter,
} from './dates'
import type { IsoDate, PeriodType, ReportPeriodType } from './types'

export interface Period {
  type: ReportPeriodType
  /** Inclusive start date. */
  start: IsoDate
  /** Exclusive end date. */
  endExclusive: IsoDate
  label: string
  /** Stable identifier, e.g. `month:2026-10`. */
  key: string
}

export type BreakdownGranularity = 'month' | 'quarter'

const PERIOD_TYPE_LABELS: Record<ReportPeriodType, string> = {
  month: 'Mensuel',
  quarter: 'Trimestriel',
  semester: 'Semestriel',
  year: 'Annuel',
  custom: 'Personnalisé',
}

export const PERIOD_TYPES: PeriodType[] = ['month', 'quarter', 'semester', 'year']

export function periodTypeLabel(type: ReportPeriodType): string {
  return PERIOD_TYPE_LABELS[type]
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function monthLabel(iso: IsoDate): string {
  return capitalize(formatMonthYearFR(iso))
}

export function resolvePeriod(type: PeriodType, anchor: IsoDate): Period {
  const { year } = dateParts(anchor)
  switch (type) {
    case 'month': {
      const start = startOfMonth(anchor)
      const endExclusive = addMonthsClamped(start, 1)
      return {
        type,
        start,
        endExclusive,
        label: monthLabel(start),
        key: `month:${start.slice(0, 7)}`,
      }
    }
    case 'quarter': {
      const start = startOfQuarter(anchor)
      const quarter = Math.floor((dateParts(start).month - 1) / 3) + 1
      return {
        type,
        start,
        endExclusive: addMonthsClamped(start, 3),
        label: `T${quarter} ${year}`,
        key: `quarter:${year}-T${quarter}`,
      }
    }
    case 'semester': {
      const start = dateParts(anchor).month <= 6
        ? `${year}-01-01`
        : `${year}-07-01`
      const semester = dateParts(start).month === 1 ? 1 : 2
      return {
        type,
        start,
        endExclusive: addMonthsClamped(start, 6),
        label: `S${semester} ${year}`,
        key: `semester:${year}-S${semester}`,
      }
    }
    case 'year': {
      const start = `${year}-01-01`
      return {
        type,
        start,
        endExclusive: `${year + 1}-01-01`,
        label: String(year),
        key: `year:${year}`,
      }
    }
  }
}

export function customPeriod(start: IsoDate, endInclusive: IsoDate): Period {
  if (start > endInclusive) {
    throw new Error('La date de début doit précéder la date de fin.')
  }
  return {
    type: 'custom',
    start,
    endExclusive: addDays(endInclusive, 1),
    label: `${formatDateFR(start)} – ${formatDateFR(endInclusive)}`,
    key: `custom:${start}:${endInclusive}`,
  }
}

export function shiftPeriod(period: Period, amount: number): Period {
  if (period.type === 'custom') {
    const length = differenceInDays(period.start, period.endExclusive)
    const start = addDays(period.start, length * amount)
    return {
      ...period,
      start,
      endExclusive: addDays(period.endExclusive, length * amount),
      key: `custom:${start}:${addDays(period.endExclusive, length * amount)}`,
      label: `${formatDateFR(start)} – ${formatDateFR(addDays(period.endExclusive, length * amount - 1))}`,
    }
  }
  const start = shiftMonths(period.start, period.type, amount)
  return resolvePeriod(period.type, start)
}

function shiftMonths(start: IsoDate, type: PeriodType, amount: number): IsoDate {
  switch (type) {
    case 'month':
      return addMonthsClamped(start, amount)
    case 'quarter':
      return addMonthsClamped(start, amount * 3)
    case 'semester':
      return addMonthsClamped(start, amount * 6)
    case 'year':
      return addMonthsClamped(start, amount * 12)
  }
}

/** The comparable period immediately before the given one. */
export function previousPeriod(period: Period): Period {
  if (period.type === 'custom') return shiftPeriod(period, -1)
  return resolvePeriod(period.type, addDays(period.start, -1))
}

export function isDateInPeriod(date: IsoDate, period: Period): boolean {
  return date >= period.start && date < period.endExclusive
}

export function periodLengthDays(period: Period): number {
  return differenceInDays(period.start, period.endExclusive)
}

function clip(start: IsoDate, endExclusive: IsoDate, period: Period): Period | null {
  const clippedStart = start < period.start ? period.start : start
  const clippedEnd = endExclusive > period.endExclusive ? period.endExclusive : endExclusive
  if (clippedStart >= clippedEnd) return null
  const partial = clippedStart !== start || clippedEnd !== endExclusive
  return {
    ...period,
    start: clippedStart,
    endExclusive: clippedEnd,
    label: partial ? `${monthLabel(startOfMonth(clippedStart))} (partiel)` : monthLabel(start),
    key: `sub:${clippedStart}:${clippedEnd}`,
  }
}

/** Month-sized sub-periods, clipped to the parent period. */
export function monthSubperiods(period: Period): Period[] {
  const result: Period[] = []
  let cursor = startOfMonth(period.start)
  while (cursor < period.endExclusive) {
    const sub = clip(cursor, addMonthsClamped(cursor, 1), period)
    if (sub) result.push(sub)
    cursor = addMonthsClamped(cursor, 1)
  }
  return result
}

/** Quarter-sized sub-periods, clipped to the parent period. */
export function quarterSubperiods(period: Period): Period[] {
  const result: Period[] = []
  let cursor = startOfQuarter(period.start)
  while (cursor < period.endExclusive) {
    const end = addMonthsClamped(cursor, 3)
    const clipped = clip(cursor, end, period)
    if (clipped) {
      const quarter = Math.floor((dateParts(cursor).month - 1) / 3) + 1
      result.push({
        ...clipped,
        label: `${clipped.label.includes('partiel') ? `T${quarter} ${dateParts(cursor).year} (partiel)` : `T${quarter} ${dateParts(cursor).year}`}`,
        key: `subq:${cursor}`,
      })
    }
    cursor = end
  }
  return result
}

export function subperiods(period: Period, granularity: BreakdownGranularity): Period[] {
  return granularity === 'month' ? monthSubperiods(period) : quarterSubperiods(period)
}
