import { afterEach, describe, expect, it } from 'vitest'
import { CHART_PALETTES, applyTheme, resolveInitialTheme, themeColorFor } from './theme'

afterEach(() => {
  delete document.documentElement.dataset.theme
  document.documentElement.style.colorScheme = ''
})

describe('resolveInitialTheme', () => {
  it('uses a stored preference over the system setting', () => {
    expect(resolveInitialTheme('dark', false)).toBe('dark')
    expect(resolveInitialTheme('light', true)).toBe('light')
  })

  it('follows the system when nothing is stored', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark')
    expect(resolveInitialTheme(null, false)).toBe('light')
  })

  it('ignores corrupted stored values', () => {
    expect(resolveInitialTheme('sepia', true)).toBe('dark')
    expect(resolveInitialTheme('', false)).toBe('light')
  })
})

describe('applyTheme', () => {
  it('exposes the mode to CSS and to native controls', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.style.colorScheme).toBe('dark')

    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('updates the browser theme colour', () => {
    const meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)

    applyTheme('dark')
    expect(meta.getAttribute('content')).toBe(themeColorFor('dark'))
    applyTheme('light')
    expect(meta.getAttribute('content')).toBe(themeColorFor('light'))

    meta.remove()
  })
})

describe('chart palettes', () => {
  it('defines a complete palette for both modes', () => {
    const keys = Object.keys(CHART_PALETTES.light)
    expect(Object.keys(CHART_PALETTES.dark).sort()).toEqual(keys.sort())
    for (const key of keys) {
      expect(CHART_PALETTES.light[key as keyof typeof CHART_PALETTES.light]).not.toBe('')
      expect(CHART_PALETTES.dark[key as keyof typeof CHART_PALETTES.dark]).not.toBe('')
    }
  })

  it('uses distinct surfaces so charts stay readable in both modes', () => {
    expect(CHART_PALETTES.dark.surface).not.toBe(CHART_PALETTES.light.surface)
    expect(CHART_PALETTES.dark.grid).not.toBe(CHART_PALETTES.light.grid)
    expect(CHART_PALETTES.dark.income).not.toBe(CHART_PALETTES.light.income)
  })
})
