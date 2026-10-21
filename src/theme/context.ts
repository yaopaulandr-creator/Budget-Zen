import { createContext, useContext } from 'react'
import { CHART_PALETTES, type ChartPalette, type ThemeMode } from './theme'

export interface ThemeContextValue {
  mode: ThemeMode
  setMode: (mode: ThemeMode) => void
  toggle: () => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used within ThemeProvider')
  return context
}

export function useChartPalette(): ChartPalette {
  return CHART_PALETTES[useTheme().mode]
}
