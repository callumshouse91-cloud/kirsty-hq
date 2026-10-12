/**
 * Brand palette and identity, taken from the client's results pack.
 * Charts need literal hex values, so they read from here rather than CSS.
 * Add `?brand=off` to the URL to present without the logo (palette stays).
 */
export const BRAND = {
  ink: '#1d1d1b',
  navy: '#001d6e',
  blue: '#005dba',
  brightBlue: '#3d9eff',
  sky: '#aee1f7',
  tint: '#ebf6ff',
  green: '#00633d',
  forest: '#01312e',
  mint: '#caeedd',
  red: '#c50b30',
  blush: '#fcc6d1',
  yellow: '#ffb600',
  rule: '#e9e9e9',
  muted: '#5b5b5a',
  grid: '#eef0f2',
} as const

/** Categorical order for series: blue, green, red, navy, then lighter tints. */
export const SERIES = [BRAND.blue, BRAND.green, BRAND.red, BRAND.navy, BRAND.brightBlue, BRAND.forest, BRAND.yellow, BRAND.sky]

export const AXIS_TICK = { fontSize: 11, fill: BRAND.muted }
export const AXIS_LABEL_TICK = { fontSize: 12, fill: BRAND.ink }

const KEY = 'investments-tech-map:brand'

function readBrandOn(): boolean {
  try {
    const p = new URLSearchParams(window.location.search).get('brand')
    if (p === 'off' || p === 'on') {
      localStorage.setItem(KEY, p)
      return p === 'on'
    }
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export const brandOn = readBrandOn()
export const LOGO_SRC = '/brand/lg-logo.png'
