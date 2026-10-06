import { useSyncExternalStore } from 'react'

export type Screen = 'overview' | 'import' | 'taxonomy' | 'explorer' | 'desk' | 'foundation'

export const SCREENS: Screen[] = ['overview', 'import', 'taxonomy', 'explorer', 'desk', 'foundation']

export interface Route {
  screen: Screen
  params: URLSearchParams
}

function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  const [path, query = ''] = h.split('?')
  const screen = (SCREENS as string[]).includes(path) ? (path as Screen) : 'overview'
  return { screen, params: new URLSearchParams(query) }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route & { hash: string } {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return { ...parse(hash), hash }
}

export type Params = Record<string, string | number | boolean | null | undefined | string[]>

export function href(screen: Screen, params: Params = {}): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === false || v === '') continue
    if (Array.isArray(v)) {
      if (v.length) q.set(k, v.join(','))
    } else q.set(k, String(v))
  }
  const qs = q.toString()
  return `#/${screen}${qs ? `?${qs}` : ''}`
}

export function navigate(screen: Screen, params: Params = {}, opts: { replace?: boolean } = {}) {
  const h = href(screen, params)
  if (opts.replace) {
    history.replaceState(null, '', h)
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  } else {
    window.location.hash = h
  }
}

/** Update some params of the current screen in place (replaces history entry). */
export function patchParams(route: Route, patch: Params) {
  const params: Params = {}
  route.params.forEach((v, k) => (params[k] = v))
  navigate(route.screen, { ...params, ...patch }, { replace: true })
}
