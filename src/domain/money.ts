const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Formats an integer amount of cents as `1 250,50 €`. */
export function formatEUR(cents: number): string {
  return euroFormatter.format(cents / 100)
}

/** Formats an integer amount of cents without the currency symbol. */
export function formatNumberEUR(cents: number): string {
  return numberFormatter.format(cents / 100)
}

/** Formats a signed amount, always showing `+` or `-` for non-zero values. */
export function formatSignedEUR(cents: number): string {
  if (cents === 0) return formatEUR(0)
  const sign = cents > 0 ? '+' : '−'
  return `${sign}${formatEUR(Math.abs(cents))}`
}

export function formatPercent(value: number, digits = 0): string {
  return `${new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)} %`
}

/** Converts a cents amount into a plain editable string: `1250,50`. */
export function centsToInput(cents: number): string {
  const absolute = Math.abs(cents)
  const units = Math.floor(absolute / 100)
  const decimals = String(absolute % 100).padStart(2, '0')
  return `${cents < 0 ? '-' : ''}${units},${decimals}`
}

/**
 * Parses a user-typed amount into exact euro cents.
 * Accepts `1 250,50`, `1250.50`, `1.250,50`, `1250`, with an optional € sign.
 * Returns `null` for malformed input. Negative values are rejected by default.
 */
export function parseAmountToCents(
  raw: string,
  options: { allowNegative?: boolean; allowZero?: boolean } = {},
): number | null {
  if (typeof raw !== 'string') return null
  let value = raw.replace(/[\s\u00a0\u202f€]/g, '')
  if (!value) return null

  const negative = value.startsWith('-') || value.startsWith('−')
  if (negative) value = value.slice(1)
  if (value.startsWith('+')) value = value.slice(1)
  if (negative && !options.allowNegative) return null
  if (!value) return null

  let integerPart: string
  let decimalPart = ''

  const lastComma = value.lastIndexOf(',')
  const lastDot = value.lastIndexOf('.')

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.'
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ','
    value = value.split(thousandsSeparator).join('')
    const parts = value.split(decimalSeparator)
    if (parts.length !== 2 || parts[1] === '') return null
    integerPart = parts[0]
    decimalPart = parts[1]
  } else if (lastComma >= 0) {
    const parts = value.split(',')
    if (parts.length !== 2 || parts[1] === '') return null
    integerPart = parts[0]
    decimalPart = parts[1]
  } else if (lastDot >= 0) {
    // `1.250` and `1.250.000` are thousands separators, `12.5` is a decimal.
    if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
      integerPart = value.split('.').join('')
    } else {
      const parts = value.split('.')
      if (parts.length !== 2 || parts[1] === '') return null
      integerPart = parts[0]
      decimalPart = parts[1]
    }
  } else {
    integerPart = value
  }

  if (!/^\d+$/.test(integerPart)) return null
  if (decimalPart && !/^\d{1,2}$/.test(decimalPart)) return null

  const units = Number(integerPart)
  if (!Number.isSafeInteger(units)) return null

  const cents = units * 100 + (decimalPart ? Number(decimalPart.padEnd(2, '0')) : 0)
  if (!Number.isSafeInteger(cents)) return null
  if (cents === 0 && !options.allowZero) return null
  if (cents > 100_000_000_000) return null

  return negative ? -cents : cents
}

/** Validates a stored cents amount. */
export function isValidPositiveCents(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0
}
