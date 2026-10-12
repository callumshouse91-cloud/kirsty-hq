import type { ScreenId } from './phases'

export type NavGroup = 'story' | 'map' | 'modules'

export interface ScreenMeta {
  label: string
  group: NavGroup
  /** Module screens only appear when the module is switched on. */
  module?: 'vendors' | 'heatmap' | 'risk'
}

export const SCREEN_META: Record<ScreenId, ScreenMeta> = {
  journey: { label: 'Journey', group: 'story' },
  overview: { label: 'Overview', group: 'map' },
  import: { label: 'Import & Reconcile', group: 'map' },
  taxonomy: { label: 'Taxonomy', group: 'map' },
  explorer: { label: 'Explorer', group: 'map' },
  capability: { label: 'Capability View', group: 'map' },
  desk: { label: 'Desk View', group: 'map' },
  foundation: { label: 'Foundation View', group: 'map' },
  changes: { label: 'Changes & approvals', group: 'map' },
  suggestions: { label: 'Suggested labels', group: 'map' },
  modules: { label: 'Modules', group: 'modules' },
  vendors: { label: 'Vendors & renewals', group: 'modules', module: 'vendors' },
  heatmap: { label: 'Capability heat map', group: 'modules', module: 'heatmap' },
  risk: { label: 'Risk events', group: 'modules', module: 'risk' },
  architecture: { label: 'Architecture', group: 'story' },
}

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  story: 'The story',
  map: 'The map',
  modules: 'Modules',
}

/** Screens that are built. The registry in src/screens/registry.ts must provide exactly these. */
export const IMPLEMENTED = ['overview', 'import', 'taxonomy', 'explorer', 'capability', 'desk', 'foundation', 'changes', 'modules', 'vendors', 'heatmap', 'risk', 'suggestions', 'architecture'] as const satisfies readonly ScreenId[]
export type ImplementedScreen = (typeof IMPLEMENTED)[number]

export function isImplemented(id: ScreenId): id is ImplementedScreen {
  return (IMPLEMENTED as readonly ScreenId[]).includes(id)
}
