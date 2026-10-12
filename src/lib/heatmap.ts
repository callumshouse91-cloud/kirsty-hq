import type { RiskEvent } from '../module-data'
import type { DataState, Layer } from '../types'
import { capabilityTree, reachByTool, type CapNode } from './capability'
import { BLANK } from './pivot'
import { CAT, termsOf } from './taxonomy'

export type HeatMeasure = 'cost' | 'riskCount' | 'riskCost' | 'tools'

export const HEAT_MEASURES: { id: HeatMeasure; label: string; short: string }[] = [
  { id: 'cost', label: 'Platform cost (£k, even allocation)', short: 'Platform cost' },
  { id: 'riskCount', label: 'Risk event count', short: 'Risk events' },
  { id: 'riskCost', label: 'Risk event cost (£k)', short: 'Risk event cost' },
  { id: 'tools', label: 'Tool count', short: 'Tools' },
]

export interface HeatCell {
  cost: number
  riskCount: number
  riskCost: number
  /** Tools behind the cost and tool-count measures. */
  toolIds: Set<string>
  /** Tools named in the risk events. */
  riskToolIds: Set<string>
  eventIds: string[]
}

export interface HeatMatrix {
  rows: CapNode[]
  /** Strategies in taxonomy order, each with its desk. */
  cols: { strategy: string; desk: string }[]
  cells: Map<string, HeatCell>
  /** Cost of tools that reach no strategy, so it cannot be placed. */
  unplacedCost: number
}

export const heatKey = (cap: string, strategy: string) => `${cap}§${strategy}`

const empty = (): HeatCell => ({ cost: 0, riskCount: 0, riskCost: 0, toolIds: new Set(), riskToolIds: new Set(), eventIds: [] })

/**
 * Capability × strategy. A tool's cost is split evenly across the strategies it reaches
 * (directly for applications, through dependent applications for foundations). Illustrative.
 */
export function heatMatrix(state: DataState, lm: Map<string, Layer>, events: RiskEvent[]): HeatMatrix {
  const tree = capabilityTree(state, lm)
  const rows = tree.flatMap((g) => g.children).filter((n) => n.l3 !== BLANK)
  const deskOf = new Map(state.taxonomy.filter((t) => t.category === CAT.strategy).map((t) => [t.term, t.parent]))
  const cols = termsOf(state.taxonomy, CAT.strategy).map((s) => ({ strategy: s, desk: deskOf.get(s) ?? '' }))
  const reach = reachByTool(state, lm)
  const capOfTool = new Map<string, string>()
  for (const n of rows) for (const t of n.tools) capOfTool.set(t.id, n.key)
  const cells = new Map<string, HeatCell>()
  const cell = (cap: string, st: string) => {
    const k = heatKey(cap, st)
    const c = cells.get(k) ?? empty()
    cells.set(k, c)
    return c
  }
  let unplacedCost = 0
  for (const t of state.tools) {
    const cap = capOfTool.get(t.id)
    const strategies = new Set<string>()
    for (const sts of reach.get(t.id)?.values() ?? []) for (const s of sts) strategies.add(s)
    if (!cap || strategies.size === 0) {
      unplacedCost += t.costK
      continue
    }
    const share = t.costK / strategies.size
    for (const s of strategies) {
      const c = cell(cap, s)
      c.cost += share
      c.toolIds.add(t.id)
    }
  }
  for (const e of events) {
    const cap = capOfTool.get(e.toolId)
    if (!cap) continue
    const c = cell(cap, e.strategy)
    c.riskCount += 1
    c.riskCost += e.lossK
    c.riskToolIds.add(e.toolId)
    c.eventIds.push(e.id)
  }
  return { rows, cols, cells, unplacedCost }
}

export function heatValue(c: HeatCell | undefined, m: HeatMeasure): number {
  if (!c) return 0
  return m === 'tools' ? c.toolIds.size : c[m]
}

/** Totals by capability row across all strategies. */
export function rowTotal(h: HeatMatrix, n: CapNode, m: HeatMeasure): number {
  if (m === 'tools') {
    const ids = new Set<string>()
    for (const col of h.cols) for (const id of h.cells.get(heatKey(n.key, col.strategy))?.toolIds ?? []) ids.add(id)
    return ids.size
  }
  return h.cols.reduce((s, col) => s + heatValue(h.cells.get(heatKey(n.key, col.strategy)), m), 0)
}

export function drillTools(c: HeatCell | undefined, m: HeatMeasure): string[] {
  if (!c) return []
  return [...(m === 'riskCount' || m === 'riskCost' ? c.riskToolIds : c.toolIds)]
}
