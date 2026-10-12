import type { DataState, Layer, Tool } from '../types'
import { foundationReach } from './graph'
import { BLANK } from './pivot'
import { CAT, layerOf, termsOf } from './taxonomy'

export interface CapNode {
  key: string
  l2: string
  l3: string
  tools: Tool[]
  apps: Tool[]
  foundations: Tool[]
  cost: number
  desks: Set<string>
  strategies: Set<string>
}

export interface CapGroup {
  l2: string
  children: CapNode[]
  tools: Tool[]
  cost: number
  desks: Set<string>
}

/**
 * Desks (and their strategies) each tool reaches: applications by direct use,
 * foundations through the applications that sit on them.
 */
export function reachByTool(state: DataState, lm: Map<string, Layer>): Map<string, Map<string, Set<string>>> {
  const out = new Map<string, Map<string, Set<string>>>()
  for (const t of state.tools) {
    if (layerOf(t, lm) === 'Foundation') {
      out.set(t.id, foundationReach(state, t.id).desks)
      continue
    }
    const m = new Map<string, Set<string>>()
    for (const u of state.usages) {
      if (u.toolId !== t.id) continue
      if (!m.has(u.desk)) m.set(u.desk, new Set())
      m.get(u.desk)!.add(u.strategy)
    }
    out.set(t.id, m)
  }
  return out
}

export const capKey = (l2: string, l3: string) => `${l2}›${l3}`

/** Tools grouped by Cap L2 › Cap L3, in taxonomy order. Optionally restricted to one layer. */
export function capabilityTree(state: DataState, lm: Map<string, Layer>, layer: Layer | null = null): CapGroup[] {
  const l2Order = termsOf(state.taxonomy, CAT.capL2)
  const l3Order = termsOf(state.taxonomy, CAT.capL3)
  const reach = reachByTool(state, lm)
  const nodes = new Map<string, CapNode>()
  for (const t of state.tools) {
    const ly = layerOf(t, lm)
    if (layer && ly !== layer) continue
    const l2 = t.capL2 || BLANK
    const l3 = t.capL3 || BLANK
    const k = capKey(l2, l3)
    const n = nodes.get(k) ?? { key: k, l2, l3, tools: [], apps: [], foundations: [], cost: 0, desks: new Set<string>(), strategies: new Set<string>() }
    n.tools.push(t)
    if (ly === 'Application') n.apps.push(t)
    else n.foundations.push(t)
    n.cost += t.costK
    for (const [desk, strategies] of reach.get(t.id) ?? []) {
      n.desks.add(desk)
      for (const st of strategies) n.strategies.add(st)
    }
    nodes.set(k, n)
  }
  const idx = (order: string[], v: string) => (order.includes(v) ? order.indexOf(v) : v === BLANK ? 9999 : 999)
  const groups = new Map<string, CapGroup>()
  for (const n of nodes.values()) {
    const g = groups.get(n.l2) ?? { l2: n.l2, children: [], tools: [], cost: 0, desks: new Set<string>() }
    g.children.push(n)
    g.tools.push(...n.tools)
    g.cost += n.cost
    for (const d of n.desks) g.desks.add(d)
    groups.set(n.l2, g)
  }
  const out = [...groups.values()].sort((a, b) => idx(l2Order, a.l2) - idx(l2Order, b.l2) || a.l2.localeCompare(b.l2))
  for (const g of out) g.children.sort((a, b) => idx(l3Order, a.l3) - idx(l3Order, b.l3) || a.l3.localeCompare(b.l3))
  return out
}

/** The largest number of same-layer tools delivering a capability. */
export function overlapCount(n: CapNode): { count: number; layer: Layer } {
  return n.apps.length >= n.foundations.length ? { count: n.apps.length, layer: 'Application' } : { count: n.foundations.length, layer: 'Foundation' }
}

/** Capabilities where several tools of the same layer do the same job. */
export function duplicateCaps(tree: CapGroup[], threshold: number): CapNode[] {
  return tree
    .flatMap((g) => g.children)
    .filter((n) => n.l3 !== BLANK && overlapCount(n).count >= threshold)
    .sort((a, b) => overlapCount(b).count - overlapCount(a).count || b.cost - a.cost)
}

export function capLabel(n: { l2: string; l3: string }): string {
  return `${n.l2} › ${n.l3}`
}

/**
 * How many same-layer tools in one capability count as overlap. At least 4, and scaled to the estate:
 * half again the typical capability, so a 1,000-tool list flags its outliers, not every capability.
 */
export function overlapThreshold(tree: CapGroup[]): number {
  const counts = tree.flatMap((g) => g.children).filter((n) => n.l3 !== BLANK).map((n) => overlapCount(n).count).sort((a, b) => a - b)
  if (counts.length === 0) return 4
  const median = counts[Math.floor(counts.length / 2)]
  return Math.max(4, Math.ceil(median * 1.5))
}
