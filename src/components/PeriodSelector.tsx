import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PeriodType } from '../domain/types'
import { resolvePeriod, type Period } from '../domain/periods'
import { todayISO } from '../domain/dates'
import { SegmentedControl } from './ui'

const OPTIONS: Array<{ value: PeriodType; label: string }> = [
  { value: 'month', label: 'Mois' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'semester', label: 'Semestre' },
  { value: 'year', label: 'Année' },
]

export function PeriodSelector({
  type,
  period,
  onTypeChange,
  onShift,
  onToday,
}: {
  type: PeriodType
  period: Period
  onTypeChange: (type: PeriodType) => void
  onShift: (amount: number) => void
  onToday: () => void
}) {
  const isCurrent = period.key === resolvePeriod(type, todayISO()).key
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        label="Granularité de la période"
        options={OPTIONS}
        value={type}
        onChange={onTypeChange}
      />
      <div className="inline-flex items-center rounded-lg border border-line bg-surface">
        <button
          type="button"
          onClick={() => onShift(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-l-lg text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          aria-label="Période précédente"
        >
          <ChevronLeft aria-hidden className="h-4 w-4" />
        </button>
        <span className="min-w-28 border-x border-line px-2 text-center text-xs font-medium text-ink" aria-live="polite">
          {period.label}
        </span>
        <button
          type="button"
          onClick={() => onShift(1)}
          className="flex h-8 w-8 items-center justify-center rounded-r-lg text-muted hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          aria-label="Période suivante"
        >
          <ChevronRight aria-hidden className="h-4 w-4" />
        </button>
      </div>
      {!isCurrent && (
        <button
          type="button"
          onClick={onToday}
          className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Période actuelle
        </button>
      )}
    </div>
  )
}
