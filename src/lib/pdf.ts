import { jsPDF } from 'jspdf'
import { formatEUR, formatPercent, formatSignedEUR } from '../domain/money'
import type { Totals } from '../domain/finance'

export interface PdfCategoryRow {
  name: string
  color: string
  amountCents: number
  sharePercent: number | null
  count: number
}

export interface PdfBudgetRow {
  categoryName: string
  limitCents: number
  consumedCents: number
  status: 'ok' | 'warning' | 'exceeded'
  cycleLabel: string
}

export interface PdfGoalRow {
  name: string
  targetCents: number
  savedCents: number
  progressPercent: number
}

export interface PdfMonthlyRow {
  label: string
  incomeCents: number
  expenseCents: number
}

export interface ReportPdfInput {
  title: string
  periodLabel: string
  periodTypeLabel: string
  generatedAt: Date
  totals: Totals
  cumulativeCents: number
  incomeRows: PdfCategoryRow[]
  expenseRows: PdfCategoryRow[]
  monthlyRows: PdfMonthlyRow[]
  budgets: PdfBudgetRow[]
  goals: PdfGoalRow[]
}

const COLORS = {
  ink: [35, 39, 43] as const,
  muted: [107, 114, 128] as const,
  line: [229, 229, 223] as const,
  income: [31, 122, 77] as const,
  expense: [176, 70, 60] as const,
  accent: [44, 95, 115] as const,
  soft: [247, 247, 244] as const,
}

const PAGE_WIDTH = 210
const PAGE_HEIGHT = 297
const MARGIN = 14
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

function pdfText(value: string): string {
  return value.replace(/[\u202f\u00a0]/g, ' ').replace(/€/g, 'EUR').replace(/\u2212/g, '-')
}

function money(cents: number): string {
  return pdfText(formatEUR(cents))
}

function signedMoney(cents: number): string {
  return pdfText(formatSignedEUR(cents))
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return [156, 163, 175]
  const value = Number.parseInt(match[1], 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function formatGeneratedAt(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(date)
}

export function createReportPdf(input: ReportPdfInput): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  let y = 0

  const pageHeader = (first: boolean) => {
    doc.setFillColor(...COLORS.accent)
    doc.rect(0, 0, PAGE_WIDTH, first ? 4 : 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.accent)
    doc.text('BUDGETZEN', MARGIN, 12)
    if (!first) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.muted)
      doc.text(pdfText(`${input.title} — ${input.periodLabel}`), PAGE_WIDTH - MARGIN, 12, { align: 'right' })
      doc.setDrawColor(...COLORS.line)
      doc.line(MARGIN, 15, PAGE_WIDTH - MARGIN, 15)
    }
    y = first ? 24 : 22
  }

  const ensureSpace = (height: number) => {
    if (y + height > PAGE_HEIGHT - 18) {
      doc.addPage()
      pageHeader(false)
    }
  }

  const sectionTitle = (title: string) => {
    ensureSpace(14)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...COLORS.ink)
    doc.text(pdfText(title), MARGIN, y)
    y += 3
    doc.setDrawColor(...COLORS.line)
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 6
  }

  pageHeader(true)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...COLORS.ink)
  doc.text(pdfText(input.title), MARGIN, y + 2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.muted)
  doc.text(pdfText(`${input.periodTypeLabel} · ${input.periodLabel}`), MARGIN, y + 9)
  doc.setFontSize(8)
  doc.text(pdfText(`Généré le ${formatGeneratedAt(input.generatedAt)}`), PAGE_WIDTH - MARGIN, y + 9, {
    align: 'right',
  })
  y += 18

  const boxWidth = (CONTENT_WIDTH - 8) / 3
  const boxes: Array<{ label: string; value: string; color: readonly [number, number, number] }> = [
    { label: 'Revenus', value: money(input.totals.incomeCents), color: COLORS.income },
    { label: 'Dépenses', value: money(input.totals.expenseCents), color: COLORS.expense },
    {
      label: 'Solde de la période',
      value: signedMoney(input.totals.netCents),
      color: input.totals.netCents >= 0 ? COLORS.income : COLORS.expense,
    },
  ]
  boxes.forEach((box, index) => {
    const x = MARGIN + index * (boxWidth + 4)
    doc.setFillColor(...COLORS.soft)
    doc.roundedRect(x, y, boxWidth, 24, 2, 2, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text(pdfText(box.label), x + 4, y + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...box.color)
    doc.text(pdfText(box.value), x + 4, y + 15)
  })
  y += 31

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COLORS.muted)
  doc.text(
    pdfText(
      `Solde cumulé en fin de période : ${signedMoney(input.cumulativeCents)}   ·   ${input.totals.transactionCount} opération(s)`,
    ),
    MARGIN,
    y,
  )
  y += 10

  if (input.monthlyRows.length > 0) {
    sectionTitle('Revenus et dépenses par sous-période')
    const rows = input.monthlyRows.slice(0, 12)
    const chartHeight = 38
    ensureSpace(chartHeight + 18)
    const maxValue = Math.max(
      1,
      ...rows.map((row) => Math.max(row.incomeCents, row.expenseCents)),
    )
    const baseline = y + chartHeight
    doc.setDrawColor(...COLORS.line)
    doc.line(MARGIN, baseline, PAGE_WIDTH - MARGIN, baseline)
    const groupWidth = CONTENT_WIDTH / rows.length
    const barWidth = Math.min(7, groupWidth / 3.2)
    rows.forEach((row, index) => {
      const center = MARGIN + groupWidth * index + groupWidth / 2
      const incomeHeight = (row.incomeCents / maxValue) * (chartHeight - 4)
      const expenseHeight = (row.expenseCents / maxValue) * (chartHeight - 4)
      doc.setFillColor(...COLORS.income)
      if (incomeHeight > 0) doc.rect(center - barWidth - 0.5, baseline - incomeHeight, barWidth, incomeHeight, 'F')
      doc.setFillColor(...COLORS.expense)
      if (expenseHeight > 0) doc.rect(center + 0.5, baseline - expenseHeight, barWidth, expenseHeight, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6.5)
      doc.setTextColor(...COLORS.muted)
      doc.text(pdfText(row.label), center, baseline + 4, { align: 'center' })
    })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setFillColor(...COLORS.income)
    doc.rect(MARGIN, baseline + 8, 3, 3, 'F')
    doc.setTextColor(...COLORS.muted)
    doc.text('Revenus', MARGIN + 5, baseline + 10.8)
    doc.setFillColor(...COLORS.expense)
    doc.rect(MARGIN + 24, baseline + 8, 3, 3, 'F')
    doc.text('Dépenses', MARGIN + 29, baseline + 10.8)
    y = baseline + 16
  }

  const drawCategoryTable = (title: string, rows: PdfCategoryRow[], totalCents: number) => {
    sectionTitle(title)
    const columns = [MARGIN + 5, MARGIN + 92, MARGIN + 128, MARGIN + 152]
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...COLORS.muted)
    doc.text('Catégorie', columns[0], y)
    doc.text('Montant', columns[1], y, { align: 'right' })
    doc.text('Part', columns[2], y, { align: 'right' })
    doc.text('Opérations', columns[3], y, { align: 'right' })
    y += 3
    doc.setDrawColor(...COLORS.line)
    doc.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    y += 5

    if (rows.length === 0) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.muted)
      doc.text('Aucune opération sur cette période.', MARGIN, y)
      y += 9
      return
    }

    for (const row of rows) {
      ensureSpace(9)
      const rgb = hexToRgb(row.color)
      doc.setFillColor(...rgb)
      doc.circle(MARGIN + 1.5, y - 1.2, 1.4, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...COLORS.ink)
      const name = doc.splitTextToSize(pdfText(row.name), 76)[0] as string
      doc.text(name, columns[0], y)
      doc.text(pdfText(money(row.amountCents)), columns[1], y, { align: 'right' })
      doc.setTextColor(...COLORS.muted)
      doc.text(row.sharePercent === null ? '—' : pdfText(formatPercent(row.sharePercent, 1)), columns[2], y, {
        align: 'right',
      })
      doc.text(String(row.count), columns[3], y, { align: 'right' })
      y += 7
      doc.setDrawColor(244, 244, 240)
      doc.line(MARGIN, y - 2.5, PAGE_WIDTH - MARGIN, y - 2.5)
    }

    ensureSpace(8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...COLORS.ink)
    doc.text('Total', columns[0], y)
    doc.text(pdfText(money(totalCents)), columns[1], y, { align: 'right' })
    y += 10
  }

  drawCategoryTable('Détail des revenus par catégorie', input.incomeRows, input.totals.incomeCents)
  drawCategoryTable('Détail des dépenses par catégorie', input.expenseRows, input.totals.expenseCents)

  if (input.budgets.length > 0) {
    sectionTitle('Budgets')
    for (const budget of input.budgets) {
      ensureSpace(12)
      const statusLabel =
        budget.status === 'exceeded' ? 'Dépassé' : budget.status === 'warning' ? 'Seuil atteint' : 'Respecté'
      const statusColor: readonly [number, number, number] =
        budget.status === 'exceeded'
          ? COLORS.expense
          : budget.status === 'warning'
            ? [201, 138, 59]
            : COLORS.income
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.ink)
      doc.text(pdfText(budget.categoryName), MARGIN, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...COLORS.muted)
      doc.text(pdfText(`Cycle ${budget.cycleLabel}`), MARGIN, y + 4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...COLORS.ink)
      doc.text(
        pdfText(`${money(budget.consumedCents)} sur ${money(budget.limitCents)}`),
        PAGE_WIDTH - MARGIN,
        y,
        { align: 'right' },
      )
      doc.setTextColor(...statusColor)
      doc.text(pdfText(statusLabel), PAGE_WIDTH - MARGIN, y + 4, { align: 'right' })
      y += 11
    }
    y += 2
  }

  if (input.goals.length > 0) {
    sectionTitle('Objectifs d’épargne')
    for (const goal of input.goals) {
      ensureSpace(12)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.ink)
      doc.text(pdfText(goal.name), MARGIN, y)
      doc.setTextColor(...COLORS.muted)
      doc.setFontSize(8)
      doc.text(
        pdfText(`${money(goal.savedCents)} sur ${money(goal.targetCents)} · ${formatPercent(goal.progressPercent, 1)}`),
        MARGIN,
        y + 4,
      )
      y += 11
    }
  }

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setDrawColor(...COLORS.line)
    doc.line(MARGIN, PAGE_HEIGHT - 14, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.muted)
    doc.text(
      pdfText('Document généré par BudgetZen · Données conservées localement'),
      MARGIN,
      PAGE_HEIGHT - 9,
    )
    doc.text(`Page ${page} / ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 9, { align: 'right' })
  }

  return doc.output('blob')
}

export function reportPdfFilename(title: string, now: Date = new Date()): string {
  const slug = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'budgetzen-rapport'}-${now.toISOString().slice(0, 10)}.pdf`
}
