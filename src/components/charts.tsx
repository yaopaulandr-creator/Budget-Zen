import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CumulativePoint, CategoryBreakdownRow } from '../domain/finance'
import { formatEUR, formatPercent } from '../domain/money'
import { formatDateFR } from '../domain/dates'
import { EmptyState } from './ui'
import { PieChart as PieChartIcon } from 'lucide-react'
import { useChartPalette } from '../theme/context'
import type { ChartPalette } from '../theme/theme'

function tooltipStyle(palette: ChartPalette) {
  return {
    borderRadius: 10,
    border: `1px solid ${palette.tooltipBorder}`,
    fontSize: 12,
    boxShadow: palette.tooltipShadow,
    padding: '8px 10px',
    color: palette.tooltipText,
    backgroundColor: palette.tooltipBackground,
  }
}

function compactEuro(value: number): string {
  const euros = Math.round(value / 100)
  if (Math.abs(euros) >= 1000) return `${(euros / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k€`
  return `${euros} €`
}

export function ExpenseDonut({
  rows,
  totalCents,
  height = 228,
}: {
  rows: CategoryBreakdownRow[]
  totalCents: number
  height?: number
}) {
  const palette = useChartPalette()
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={<PieChartIcon aria-hidden className="h-5 w-5" />}
        title="Aucune dépense sur cette période"
        description="Ajoutez une dépense pour voir sa répartition par catégorie."
      />
    )
  }
  const data = rows.map((row) => ({
    name: row.name,
    value: row.totalCents,
    color: row.color,
    share: row.sharePercent,
  }))
  const top = rows.slice(0, 6)

  return (
    <div>
      <div className="relative" style={{ height }} role="img" aria-label="Répartition des dépenses par catégorie">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="86%"
              paddingAngle={1.5}
              stroke={palette.surface}
              strokeWidth={2}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle(palette)}
              formatter={(value) => [formatEUR(Number(value)), 'Montant']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Dépenses</span>
          <span className="tnum text-base font-semibold text-ink">{formatEUR(totalCents)}</span>
        </div>
      </div>
      <ul className="mt-2 space-y-1.5">
        {top.map((row) => (
          <li key={row.categoryId} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-ink">{row.name}</span>
            <span className="tnum shrink-0 text-muted">
              {formatPercent(row.sharePercent ?? 0, 1)} · {formatEUR(row.totalCents)}
            </span>
          </li>
        ))}
        {rows.length > 6 && (
          <li className="pt-1 text-[11px] text-muted">+ {rows.length - 6} autre(s) catégorie(s)</li>
        )}
      </ul>
    </div>
  )
}

export function IncomeExpenseBars({
  rows,
  height = 240,
}: {
  rows: Array<{ label: string; incomeCents: number; expenseCents: number }>
  height?: number
}) {
  const palette = useChartPalette()
  if (rows.length === 0 || rows.every((row) => row.incomeCents === 0 && row.expenseCents === 0)) {
    return (
      <EmptyState
        icon={<BarChart3Icon />}
        title="Pas encore de comparaison"
        description="Les revenus et dépenses apparaîtront ici dès la première opération de la période."
      />
    )
  }
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Comparaison des revenus et dépenses">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={palette.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: palette.label }}
            axisLine={{ stroke: palette.axis }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={compactEuro}
            tick={{ fontSize: 10, fill: palette.label }}
            axisLine={false}
            tickLine={false}
            width={54}
          />
          <Tooltip
            contentStyle={tooltipStyle(palette)}
            cursor={{ fill: palette.cursor }}
            formatter={(value, name) => [
              formatEUR(Number(value)),
              name === 'incomeCents' ? 'Revenus' : 'Dépenses',
            ]}
            labelFormatter={(label) => String(label)}
          />
          <Bar dataKey="incomeCents" name="incomeCents" fill={palette.income} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          <Bar dataKey="expenseCents" name="expenseCents" fill={palette.expense} radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BarChart3Icon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <path d="M4 20V10M10 20V5M16 20v-7M22 20H2" />
    </svg>
  )
}

export function BalanceLine({ points, height = 240 }: { points: CumulativePoint[]; height?: number }) {
  const palette = useChartPalette()
  if (points.length === 0) {
    return (
      <EmptyState
        icon={<BarChart3Icon />}
        title="Solde cumulé indisponible"
        description="Le graphique apparaîtra après la première opération de la période."
      />
    )
  }
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Évolution du solde cumulé">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 10, right: 6, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={palette.grid} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: palette.label }}
            axisLine={{ stroke: palette.axis }}
            tickLine={false}
            minTickGap={26}
          />
          <YAxis
            tickFormatter={compactEuro}
            tick={{ fontSize: 10, fill: palette.label }}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <Tooltip
            contentStyle={tooltipStyle(palette)}
            formatter={(value) => [formatEUR(Number(value)), 'Solde cumulé']}
            labelFormatter={(_label, payload) => {
              const point = payload?.[0]?.payload as CumulativePoint | undefined
              return point ? formatDateFR(point.date) : ''
            }}
          />
          <ReferenceLine y={0} stroke={palette.zeroLine} strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="balanceCents"
            stroke={palette.accent}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: palette.accent, stroke: palette.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
