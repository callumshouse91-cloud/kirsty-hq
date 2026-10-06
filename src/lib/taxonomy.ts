import type { DataState, Layer, TaxonomyTerm, Tool, Usage } from '../types'
import { joinMulti, splitMulti, uniq } from './util'

/**
 * Categories that are bound to a field in the data model. The category *names*
 * are schema; the *terms* inside them always come from the store.
 * Any other category is a user-added one and lives in Tool.custom.
 */
export const CAT = {
  kirstyCat: 'Kirsty Cat',
  capL2: 'Cap L2',
  capL3: 'Cap L3',
  users: 'Users',
  desk: 'Desk',
  strategy: 'Strategy',
  criticality: 'Criticality',
} as const

type ToolCatField = 'kirstyCat' | 'capL2' | 'capL3' | 'users'
type UsageCatField = 'desk' | 'strategy' | 'criticality'

export type Binding =
  | { kind: 'tool'; field: ToolCatField; multi: boolean }
  | { kind: 'usage'; field: UsageCatField }
  | { kind: 'custom'; category: string }

export function bindingFor(category: string): Binding {
  switch (category) {
    case CAT.kirstyCat:
      return { kind: 'tool', field: 'kirstyCat', multi: false }
    case CAT.capL2:
      return { kind: 'tool', field: 'capL2', multi: false }
    case CAT.capL3:
      return { kind: 'tool', field: 'capL3', multi: false }
    case CAT.users:
      return { kind: 'tool', field: 'users', multi: true }
    case CAT.desk:
      return { kind: 'usage', field: 'desk' }
    case CAT.strategy:
      return { kind: 'usage', field: 'strategy' }
    case CAT.criticality:
      return { kind: 'usage', field: 'criticality' }
    default:
      return { kind: 'custom', category }
  }
}

/** Categories that describe a tool (usable in the tool drawer / import mapper). */
export function isToolCategory(category: string): boolean {
  return bindingFor(category).kind !== 'usage'
}

export function termsOf(taxonomy: TaxonomyTerm[], category: string): string[] {
  return taxonomy.filter((t) => t.category === category).map((t) => t.term)
}

export function toolValues(tool: Tool, category: string): string[] {
  const b = bindingFor(category)
  if (b.kind === 'tool') {
    const v = tool[b.field]
    return b.multi ? splitMulti(v) : v ? [v] : []
  }
  if (b.kind === 'custom') {
    const v = tool.custom[category]
    return v ? [v] : []
  }
  return []
}

export interface TermImpact {
  tools: Tool[]
  usages: Usage[]
  children: TaxonomyTerm[]
}

export function termImpact(state: DataState, category: string, term: string): TermImpact {
  const b = bindingFor(category)
  const children = state.taxonomy.filter((t) => t.parent === term && t.category !== category && parentCategory(t.category) === category)
  if (b.kind === 'usage') {
    const usages = state.usages.filter((u) => u[b.field] === term)
    const ids = new Set(usages.map((u) => u.toolId))
    return { tools: state.tools.filter((t) => ids.has(t.id)), usages, children }
  }
  const tools = state.tools.filter((t) => toolValues(t, category).includes(term))
  return { tools, usages: [], children }
}

/** Which category a category's Parent column refers to (Strategy → Desk). */
export function parentCategory(category: string): string | null {
  return category === CAT.strategy ? CAT.desk : null
}

function replaceInTool(tool: Tool, category: string, from: string, to: string): Tool {
  const b = bindingFor(category)
  if (b.kind === 'tool') {
    if (b.multi) {
      const vals = splitMulti(tool[b.field])
      if (!vals.includes(from)) return tool
      return { ...tool, [b.field]: joinMulti(uniq(vals.map((v) => (v === from ? to : v)))) }
    }
    return tool[b.field] === from ? { ...tool, [b.field]: to } : tool
  }
  if (b.kind === 'custom') {
    return tool.custom[category] === from ? { ...tool, custom: { ...tool.custom, [category]: to } } : tool
  }
  return tool
}

/** Re-label every tool / usage / child term that uses `from` to `to`. Used by rename and merge. */
export function relabel(state: DataState, category: string, from: string, to: string): Pick<DataState, 'tools' | 'usages' | 'taxonomy'> {
  const b = bindingFor(category)
  const tools = state.tools.map((t) => replaceInTool(t, category, from, to))
  let usages = state.usages
  if (b.kind === 'usage') {
    usages = state.usages.map((u) => (u[b.field] === from ? { ...u, [b.field]: to } : u))
    // merging can create duplicate desk/strategy/tool rows — keep the first
    const seen = new Set<string>()
    usages = usages.filter((u) => {
      const k = `${u.desk}|${u.strategy}|${u.toolId}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  const taxonomy = state.taxonomy.map((t) => (t.parent === from && parentCategory(t.category) === category ? { ...t, parent: to } : t))
  return { tools, usages, taxonomy }
}

/** Kirsty Cat term → Layer, read from the taxonomy Parent / Note column. */
export function layerMap(taxonomy: TaxonomyTerm[]): Map<string, Layer> {
  const m = new Map<string, Layer>()
  for (const t of taxonomy) {
    if (t.category === CAT.kirstyCat) m.set(t.term, t.parent.trim().toLowerCase() === 'foundation' ? 'Foundation' : 'Application')
  }
  return m
}

export function layerOf(tool: Tool, lm: Map<string, Layer>): Layer {
  return lm.get(tool.kirstyCat) ?? 'Application'
}

/** The first Kirsty Cat term mapped to the given layer (used for new desk-built tools). */
export function defaultCatFor(taxonomy: TaxonomyTerm[], layer: Layer): string {
  const lm = layerMap(taxonomy)
  for (const [term, l] of lm) if (l === layer) return term
  return ''
}
