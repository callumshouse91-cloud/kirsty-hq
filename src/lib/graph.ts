import type { DataState, Layer, Tool, Usage } from '../types'
import { layerMap, layerOf } from './taxonomy'

export interface Consumer {
  tool: Tool
  layer: Layer
  /** Intermediate tools between the foundation and this consumer (empty = direct). */
  via: Tool[]
  direction: string
  usages: Usage[]
}

/**
 * Everything that sits on top of `foundationId`, following dependency links upwards.
 * Returns every upstream tool with the shortest path it was reached by.
 */
export function upstream(state: DataState, foundationId: string): Consumer[] {
  const lm = layerMap(state.taxonomy)
  const toolById = new Map(state.tools.map((t) => [t.id, t]))
  const seen = new Set<string>([foundationId])
  const out: Consumer[] = []
  let frontier: { id: string; via: Tool[] }[] = [{ id: foundationId, via: [] }]
  while (frontier.length) {
    const next: { id: string; via: Tool[] }[] = []
    for (const node of frontier) {
      for (const d of state.dependencies) {
        if (d.foundationId !== node.id || seen.has(d.appId)) continue
        const tool = toolById.get(d.appId)
        if (!tool) continue
        seen.add(d.appId)
        out.push({
          tool,
          layer: layerOf(tool, lm),
          via: node.via,
          direction: d.direction,
          usages: state.usages.filter((u) => u.toolId === tool.id),
        })
        next.push({ id: tool.id, via: [...node.via, tool] })
      }
    }
    frontier = next
  }
  return out
}

/** Everything `toolId` sits on, following dependency links downwards (transitively). */
export function downstream(state: DataState, toolId: string): { tool: Tool; via: Tool[] }[] {
  const toolById = new Map(state.tools.map((t) => [t.id, t]))
  const seen = new Set<string>([toolId])
  const out: { tool: Tool; via: Tool[] }[] = []
  let frontier: { id: string; via: Tool[] }[] = [{ id: toolId, via: [] }]
  while (frontier.length) {
    const next: { id: string; via: Tool[] }[] = []
    for (const node of frontier) {
      for (const d of state.dependencies) {
        if (d.appId !== node.id || seen.has(d.foundationId)) continue
        const tool = toolById.get(d.foundationId)
        if (!tool) continue
        seen.add(d.foundationId)
        out.push({ tool, via: node.via })
        next.push({ id: tool.id, via: [...node.via, tool] })
      }
    }
    frontier = next
  }
  return out
}

export interface FoundationReach {
  /** Consumers shown in the tree: applications, plus any foundation that desks use directly. */
  consumers: Consumer[]
  /** All usages that reach the foundation (direct usage of the foundation included). */
  usages: Usage[]
  desks: Map<string, Set<string>>
  directUsages: Usage[]
}

export function foundationReach(state: DataState, foundationId: string): FoundationReach {
  const all = upstream(state, foundationId)
  const consumers = all.filter((c) => c.layer === 'Application' || c.usages.length > 0)
  const directUsages = state.usages.filter((u) => u.toolId === foundationId)
  const usages = [...directUsages, ...all.flatMap((c) => c.usages)]
  const desks = new Map<string, Set<string>>()
  for (const u of usages) {
    if (!desks.has(u.desk)) desks.set(u.desk, new Set())
    desks.get(u.desk)!.add(u.strategy)
  }
  return { consumers, usages, desks, directUsages }
}

/** Number of tools that depend directly on each tool. */
export function directDependentCounts(state: DataState): Map<string, number> {
  const m = new Map<string, number>()
  for (const d of state.dependencies) m.set(d.foundationId, (m.get(d.foundationId) ?? 0) + 1)
  return m
}

/**
 * Even allocation (illustrative): the foundation's cost is split evenly across its consumers,
 * then each consumer's share is split evenly across the desks that use it.
 */
export function allocateCost(costK: number, reach: FoundationReach): { byConsumer: Map<string, number>; byDesk: Map<string, number> } {
  const byConsumer = new Map<string, number>()
  const byDesk = new Map<string, number>()
  const directDesks = [...new Set(reach.directUsages.map((u) => u.desk))]
  const shareHolders = reach.consumers.length + (directDesks.length ? 1 : 0)
  if (shareHolders === 0) return { byConsumer, byDesk }
  const share = costK / shareHolders
  for (const c of reach.consumers) {
    byConsumer.set(c.tool.id, share)
    const desks = [...new Set(c.usages.map((u) => u.desk))]
    for (const d of desks) byDesk.set(d, (byDesk.get(d) ?? 0) + share / desks.length)
  }
  for (const d of directDesks) byDesk.set(d, (byDesk.get(d) ?? 0) + share / directDesks.length)
  return { byConsumer, byDesk }
}
