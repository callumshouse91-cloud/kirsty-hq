import type { DriftItem, SourceRecord } from '../types'
import { fieldKey } from './mapping'
import type { Row } from './seed'

/**
 * Simulated LeanIX feed. Each run reads the bundled export and applies the next scripted change,
 * as if the fact sheets had moved on since the last sync. Illustrative: no real API is called.
 */
interface Delta {
  change?: { id: string; field: string; to: string }[]
  add?: Row[]
  remove?: string[]
}

const DELTAS: Delta[] = [
  {
    change: [
      { id: 'APP-10010', field: 'Lifecycle', to: 'End of Life' },
      { id: 'APP-10020', field: 'Criticality Tier', to: 'Tier 1' },
    ],
    add: [{ 'LeanIX ID': 'APP-19001', 'Application Name': 'Market Risk Engine', 'Fact Sheet Type': 'Application', Lifecycle: 'Plan', 'Owning Org': 'Investments', 'Business Capability': 'Risk', 'Criticality Tier': 'Tier 2' }],
  },
  {
    change: [
      { id: 'APP-10030', field: 'Owning Org', to: 'Investments' },
      { id: 'APP-10040', field: 'Lifecycle', to: 'End of Life' },
    ],
    remove: ['APP-10500'],
  },
  {
    change: [{ id: 'APP-19001', field: 'Lifecycle', to: 'Active' }],
    add: [{ 'LeanIX ID': 'APP-19002', 'Application Name': 'Liquidity Stress Model', 'Fact Sheet Type': 'Application', Lifecycle: 'Plan', 'Owning Org': 'Investments', 'Business Capability': 'Risk', 'Criticality Tier': 'Tier 2' }],
  },
]

const ID = 'LeanIX ID'

/** The export as it would look on sync number `n` (1 = first scripted change). Deltas accumulate. */
export function leanixRowsForRun(base: Row[], n: number): Row[] {
  let rows = base.map((r) => ({ ...r }))
  for (const d of DELTAS.slice(0, Math.max(0, n))) {
    for (const c of d.change ?? []) {
      const r = rows.find((x) => x[ID] === c.id)
      if (r) r[c.field] = c.to
    }
    if (d.remove) rows = rows.filter((r) => !d.remove!.includes(r[ID]))
    for (const a of d.add ?? []) if (!rows.some((r) => r[ID] === a[ID])) rows.push({ ...a })
  }
  return rows
}

export const SCRIPTED_RUNS = DELTAS.length

/** What moved between the records held now and the incoming rows, matched on the source's external ID. */
export function computeDrift(previous: SourceRecord[], rows: Row[], headerMap: Record<string, string>): DriftItem[] {
  const idHeader = Object.keys(headerMap).find((h) => headerMap[h] === fieldKey('externalId'))
  const nameHeader = Object.keys(headerMap).find((h) => headerMap[h] === fieldKey('name'))
  if (!idHeader) return []
  const prevById = new Map(previous.filter((r) => r.externalId).map((r) => [r.externalId, r]))
  const seen = new Set<string>()
  const out: DriftItem[] = []
  for (const row of rows) {
    const id = row[idHeader]
    if (!id) continue
    seen.add(id)
    const name = nameHeader ? row[nameHeader] : id
    const prev = prevById.get(id)
    if (!prev) {
      out.push({ externalId: id, name, change: 'added' })
      continue
    }
    const fields: Record<string, [string, string]> = {}
    for (const [h, v] of Object.entries(row)) {
      const before = prev.raw[h] ?? ''
      if (before !== v) fields[h] = [before, v]
    }
    if (Object.keys(fields).length) out.push({ externalId: id, name, change: 'changed', fields })
  }
  for (const [id, r] of prevById) if (!seen.has(id)) out.push({ externalId: id, name: r.rawName, change: 'removed' })
  return out
}
