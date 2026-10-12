import type { DataState, Tool } from '../types'
import { LEANIX_SOURCE, mappedValue, fieldKey, catKey } from './mapping'
import { similarity } from './match'
import { CAT, termsOf } from './taxonomy'

export type SuggestField = 'toolType' | 'capL2' | 'capL3'

export interface Suggestion {
  key: string
  toolId: string
  field: SuggestField
  value: string
  /** 0–1 */
  confidence: number
  reason: string
}

export const FIELD_LABEL: Record<SuggestField, string> = { toolType: CAT.toolType, capL2: CAT.capL2, capL3: CAT.capL3 }

/** Words in a tool name that point to a capability. Rule-based, written down so it can be read and challenged. */
const KEYWORDS: { re: RegExp; capL2: string; capL3: string; toolType?: string; why: string }[] = [
  { re: /surveillance|compliance|breach/i, capL2: 'Risk', capL3: 'Risk Analytics', why: 'surveillance and compliance sit with risk' },
  { re: /collateral|cash|liquidity|margin/i, capL2: 'PM', capL3: 'Cash Management', why: 'collateral and cash are managed with liquidity' },
  { re: /loader|feed|pipeline|bridge|gateway|bus|transfer/i, capL2: 'Other', capL3: 'Integration', toolType: 'Data Tfr', why: 'it moves data between systems' },
  { re: /report|dashboard|\bmi\b|\bbi\b/i, capL2: 'Other', capL3: 'Reporting & MI', why: 'it produces reports' },
  { re: /order|\boms\b|allocation/i, capL2: 'PM', capL3: 'Order Management', why: 'it handles orders' },
  { re: /execution|trading|venue/i, capL2: 'Trading', capL3: 'Execution', why: 'it executes trades' },
  { re: /risk|stress|var\b/i, capL2: 'Risk', capL3: 'Risk Analytics', why: 'it measures risk' },
  { re: /price|pricing|market data|index data|benchmark/i, capL2: 'Trading', capL3: 'Market Data', why: 'it supplies prices or market data' },
  { re: /research|esg|analytics/i, capL2: 'Research', capL3: 'Research & Analytics', why: 'it supports research' },
]

const LEANIX_TYPE: Record<string, string> = { Application: 'UI', Interface: 'Data Tfr', 'Data Object': 'Data', 'IT Component': 'Engine' }

export function isUnclassified(t: Tool): boolean {
  return !t.toolType || !t.capL2 || !t.capL3
}

/** Suggested labels for tools missing a Tool type or capability. Each needs a person to accept or reject it. */
export function suggestLabels(state: DataState, rejected: Set<string>): Suggestion[] {
  const valid = (cat: string, v: string) => termsOf(state.taxonomy, cat).includes(v)
  const classified = state.tools.filter((t) => !isUnclassified(t))
  const out: Suggestion[] = []
  for (const t of state.tools.filter(isUnclassified)) {
    const lx = state.sourceRecords.find((r) => r.source === LEANIX_SOURCE && r.matchedToolId === t.id)
    const kw = KEYWORDS.find((k) => k.re.test(t.name))
    let near: { tool: Tool; score: number } | null = null
    for (const c of classified) {
      const s = similarity(t.name, c.name)
      if (s >= 0.34 && (!near || s > near.score)) near = { tool: c, score: s }
    }
    const push = (field: SuggestField, value: string, confidence: number, reason: string) => {
      const key = `${t.id}|${field}|${value}`
      if (!value || t[field] || rejected.has(key) || out.some((x) => x.toolId === t.id && x.field === field)) return
      out.push({ key, toolId: t.id, field, value, confidence, reason })
    }

    // Tool type: LeanIX's fact sheet type is the strongest signal, then the name.
    const lxType = lx ? mappedValue(lx.raw, lx.headerMap, fieldKey('sourceType')) : ''
    if (lxType && LEANIX_TYPE[lxType] && valid(CAT.toolType, LEANIX_TYPE[lxType])) push('toolType', LEANIX_TYPE[lxType], 0.9, `LeanIX records it as an ${lxType} fact sheet`)
    if (kw?.toolType && valid(CAT.toolType, kw.toolType)) push('toolType', kw.toolType, 0.7, `The name suggests ${kw.why}`)
    if (near) push('toolType', near.tool.toolType, 0.5, `Name is close to “${near.tool.name}”`)

    // Capability: LeanIX business capability, then keywords, then the nearest named tool.
    const lxCap = lx ? mappedValue(lx.raw, lx.headerMap, catKey(CAT.capL2)) : ''
    if (lxCap && valid(CAT.capL2, lxCap)) push('capL2', lxCap, 0.85, `LeanIX business capability is “${lxCap}”`)
    if (kw && valid(CAT.capL2, kw.capL2)) push('capL2', kw.capL2, 0.7, `The name suggests ${kw.why}`)
    if (kw && valid(CAT.capL3, kw.capL3)) push('capL3', kw.capL3, kw.capL2 === (t.capL2 || (valid(CAT.capL2, lxCap) ? lxCap : '') || kw.capL2) ? 0.7 : 0.5, `The name suggests ${kw.why}`)
    if (near) {
      push('capL2', near.tool.capL2, 0.5, `Name is close to “${near.tool.name}”`)
      push('capL3', near.tool.capL3, 0.45, `Name is close to “${near.tool.name}”`)
    }
  }
  // A Cap L3 must sit under the Cap L2 the tool has, or is being offered.
  const parentOf = new Map(state.taxonomy.filter((x) => x.category === CAT.capL3).map((x) => [x.term, x.parent]))
  return out.filter((s) => {
    if (s.field !== 'capL3') return true
    const tool = state.tools.find((t) => t.id === s.toolId)
    const l2 = tool?.capL2 || out.find((x) => x.toolId === s.toolId && x.field === 'capL2')?.value
    return !l2 || !parentOf.get(s.value) || parentOf.get(s.value) === l2
  })
}

export function confidenceLabel(c: number): { label: string; tone: 'green' | 'amber' | 'neutral' } {
  if (c >= 0.8) return { label: 'High', tone: 'green' }
  if (c >= 0.6) return { label: 'Medium', tone: 'amber' }
  return { label: 'Low', tone: 'neutral' }
}
