import type { Category, Transaction } from '../domain/types'

/**
 * Neutralises spreadsheet formula injection while keeping the value readable.
 * A leading apostrophe makes Excel/LibreOffice treat the cell as text.
 */
export function sanitizeSpreadsheetText(value: string): string {
  const clean = value.replace(/\r\n?/g, '\n')
  if (/^[\t\r ]*[=+\-@]/.test(clean)) return `'${clean}`
  return clean
}

function escapeCsvCell(value: string): string {
  const safe = sanitizeSpreadsheetText(value)
  if (/[";\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`
  return safe
}

function amountForSpreadsheet(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const absolute = Math.abs(cents)
  const units = Math.floor(absolute / 100)
  const decimals = String(absolute % 100).padStart(2, '0')
  return `${sign}${units},${decimals}`
}

export const CSV_HEADERS = [
  'Date',
  'Type',
  'Catégorie',
  'Montant (EUR)',
  'Description',
  'Opération récurrente',
] as const

/** Builds a UTF-8 BOM, semicolon-separated CSV readable by French spreadsheets. */
export function createTransactionsCsv(
  transactions: Transaction[],
  categories: Category[],
): string {
  const categoryById = new Map(categories.map((category) => [category.id, category]))
  const sorted = [...transactions].sort((a, b) => {
    if (a.transactionDate === b.transactionDate) return a.createdAt.localeCompare(b.createdAt)
    return a.transactionDate < b.transactionDate ? 1 : -1
  })
  const lines = [CSV_HEADERS.join(';')]
  for (const transaction of sorted) {
    const category = categoryById.get(transaction.categoryId)
    lines.push(
      [
        transaction.transactionDate,
        transaction.type === 'income' ? 'Revenu' : 'Dépense',
        category?.name ?? 'Catégorie inconnue',
        amountForSpreadsheet(transaction.amountCents),
        transaction.description,
        transaction.recurringOccurrenceId ? 'Oui' : 'Non',
      ]
        .map(escapeCsvCell)
        .join(';'),
    )
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function csvFilename(now: Date = new Date(), filtered: boolean): string {
  return `budgetzen-transactions${filtered ? '-filtrees' : ''}-${now.toISOString().slice(0, 10)}.csv`
}
