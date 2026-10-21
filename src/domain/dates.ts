import type { IsoDate } from './types'

export const APP_TIMEZONE = 'Europe/Paris'

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

const FRENCH_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
]

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

export function makeIsoDate(year: number, month: number, day: number): IsoDate {
  return `${String(year).padStart(4, '0')}-${pad(month)}-${pad(day)}`
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  const match = ISO_DATE_RE.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1) return false
  return day <= daysInMonth(year, month)
}

export function dateParts(iso: IsoDate): { year: number; month: number; day: number } {
  const match = ISO_DATE_RE.exec(iso)
  if (!match) throw new Error(`Date ISO invalide : ${iso}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

function toUtc(iso: IsoDate): Date {
  const { year, month, day } = dateParts(iso)
  return new Date(Date.UTC(year, month - 1, day))
}

function fromUtc(date: Date): IsoDate {
  return makeIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = toUtc(iso)
  date.setUTCDate(date.getUTCDate() + days)
  return fromUtc(date)
}

export function addMonthsClamped(iso: IsoDate, months: number): IsoDate {
  const { year, month, day } = dateParts(iso)
  const total = year * 12 + (month - 1) + months
  const targetYear = Math.floor(total / 12)
  const targetMonth = (total % 12 + 12) % 12 + 1
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return makeIsoDate(targetYear, targetMonth, clampedDay)
}

export function startOfMonth(iso: IsoDate): IsoDate {
  const { year, month } = dateParts(iso)
  return makeIsoDate(year, month, 1)
}

export function startOfQuarter(iso: IsoDate): IsoDate {
  const { year, month } = dateParts(iso)
  const firstMonth = Math.floor((month - 1) / 3) * 3 + 1
  return makeIsoDate(year, firstMonth, 1)
}

export function startOfSemester(iso: IsoDate): IsoDate {
  const { year, month } = dateParts(iso)
  return makeIsoDate(year, month <= 6 ? 1 : 7, 1)
}

export function startOfYear(iso: IsoDate): IsoDate {
  return makeIsoDate(dateParts(iso).year, 1, 1)
}

export function formatDateFR(iso: IsoDate): string {
  if (!isIsoDate(iso)) return '—'
  const { year, month, day } = dateParts(iso)
  return `${pad(day)}/${pad(month)}/${year}`
}

export function formatMonthYearFR(iso: IsoDate): string {
  const { year, month } = dateParts(iso)
  return `${FRENCH_MONTHS[month - 1]} ${year}`
}

export function formatLongDateFR(iso: IsoDate): string {
  if (!isIsoDate(iso)) return '—'
  const { year, month, day } = dateParts(iso)
  return `${day} ${FRENCH_MONTHS[month - 1]} ${year}`
}

export function formatDateTimeFR(isoTimestamp: string): string {
  const date = new Date(isoTimestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: APP_TIMEZONE,
  }).format(date)
}

/** Today's calendar date in Europe/Paris, independent of the browser timezone. */
export function todayISO(now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function nowISOString(now: Date = new Date()): string {
  return now.toISOString()
}

/** Number of days between two ISO dates (b - a). */
export function differenceInDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtc(b).getTime() - toUtc(a).getTime()) / 86_400_000)
}

/** Whole months between two ISO dates, rounded up (used for savings estimates). */
export function monthsUntil(from: IsoDate, to: IsoDate): number {
  const start = dateParts(from)
  const end = dateParts(to)
  const raw = (end.year - start.year) * 12 + (end.month - start.month)
  const partial = end.day > start.day ? 1 : 0
  return Math.max(1, raw + partial)
}

export function monthNameFR(month: number): string {
  return FRENCH_MONTHS[month - 1] ?? ''
}

export function startOfWeekMonday(iso: IsoDate): IsoDate {
  const date = toUtc(iso)
  const day = date.getUTCDay()
  const delta = day === 0 ? -6 : 1 - day
  return addDays(iso, delta)
}
