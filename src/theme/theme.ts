export type ThemeMode = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'budgetzen-theme'

/** Palette used by the charts, which cannot rely on CSS classes for SVG attributes. */
export interface ChartPalette {
  surface: string
  grid: string
  axis: string
  label: string
  zeroLine: string
  income: string
  expense: string
  accent: string
  cursor: string
  tooltipBackground: string
  tooltipBorder: string
  tooltipText: string
  tooltipShadow: string
}

export const CHART_PALETTES: Record<ThemeMode, ChartPalette> = {
  light: {
    surface: '#ffffff',
    grid: '#ecece5',
    axis: '#e4e4dd',
    label: '#68707a',
    zeroLine: '#cfcfc5',
    income: '#1f7a4d',
    expense: '#ac463d',
    accent: '#2c5f73',
    cursor: 'rgba(44, 95, 115, 0.05)',
    tooltipBackground: '#ffffff',
    tooltipBorder: '#e4e4dd',
    tooltipText: '#23272b',
    tooltipShadow: '0 6px 20px rgba(35, 39, 43, 0.10)',
  },
  dark: {
    surface: '#1a2025',
    grid: '#2b333a',
    axis: '#3d474f',
    label: '#9aa5af',
    zeroLine: '#4a555e',
    income: '#5cc492',
    expense: '#e5887f',
    accent: '#7fb9cf',
    cursor: 'rgba(127, 185, 207, 0.08)',
    tooltipBackground: '#1a2025',
    tooltipBorder: '#3d474f',
    tooltipText: '#e9eef2',
    tooltipShadow: '0 6px 20px rgba(0, 0, 0, 0.45)',
  },
}

/**
 * Stored preference wins. Without one, follow the operating system on first visit.
 */
export function resolveInitialTheme(stored: string | null, prefersDark: boolean): ThemeMode {
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark ? 'dark' : 'light'
}

export function themeColorFor(mode: ThemeMode): string {
  return mode === 'dark' ? '#12161a' : '#f7f7f3'
}

/** Reflects the mode on <html> so CSS variables and native controls follow. */
export function applyTheme(mode: ThemeMode): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.dataset.theme = mode
  root.style.colorScheme = mode
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', themeColorFor(mode))
}
