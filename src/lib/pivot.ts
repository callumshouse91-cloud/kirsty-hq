import { ATTESTED, NOT_ATTESTED, LAYERS, VENDORS, type DataState, type Layer, type Tool, type Usage, type Vendor } from '../types'
import { CAT, isToolCategory, layerMap, layerOf, termsOf } from './taxonomy'
import { splitMulti } from './util'

export type Measure = 'tools' | 'cost' | 'desks'

export const MEASURES: { id: Measure; label: string }[] = [
  { id: 'tools', label: 'Count of tools' },
  { id: 'cost', label: 'Sum of cost (£k)' },
  { id: 'desks', label: 'Count of desks using' },
]

export const BLANK = '(blank)'
export const NOT_USED = '(not used by a desk)'

export interface FieldDef {
  id: string
  label: string
  usageLevel: boolean
  values: (tool: Tool, usage: Usage | null) => string[]
  order: string[]
}

export function pivotFields(state: DataState): FieldDef[] {
  const lm = layerMap(state.taxonomy)
  const tv = (v: string) => (v ? [v] : [BLANK])
  const ownerships = [...new Set(state.tools.map((t) => t.ownership).filter(Boolean))].sort()
  const fields: FieldDef[] = [
    { id: 'desk', label: CAT.desk, usageLevel: true, values: (_t, u) => [u ? u.desk || BLANK : NOT_USED], order: termsOf(state.taxonomy, CAT.desk) },
    { id: 'strategy', label: CAT.strategy, usageLevel: true, values: (_t, u) => [u ? u.strategy || BLANK : NOT_USED], order: termsOf(state.taxonomy, CAT.strategy) },
    { id: 'kirstyCat', label: CAT.kirstyCat, usageLevel: false, values: (t) => tv(t.kirstyCat), order: termsOf(state.taxonomy, CAT.kirstyCat) },
    { id: 'capL2', label: CAT.capL2, usageLevel: false, values: (t) => tv(t.capL2), order: termsOf(state.taxonomy, CAT.capL2) },
    { id: 'capL3', label: CAT.capL3, usageLevel: false, values: (t) => tv(t.capL3), order: termsOf(state.taxonomy, CAT.capL3) },
    {
      id: 'users',
      label: CAT.users,
      usageLevel: false,
      values: (t) => {
        const v = splitMulti(t.users)
        return v.length ? v : [BLANK]
      },
      order: termsOf(state.taxonomy, CAT.users),
    },
    { id: 'vendor', label: 'Vendor', usageLevel: false, values: (t) => [t.vendor], order: VENDORS },
    { id: 'ownership', label: 'Ownership', usageLevel: false, values: (t) => tv(t.ownership), order: ownerships },
    { id: 'layer', label: 'Layer', usageLevel: false, values: (t) => [layerOf(t, lm)], order: LAYERS },
    { id: 'criticality', label: CAT.criticality, usageLevel: true, values: (_t, u) => [u ? u.criticality || BLANK : NOT_USED], order: termsOf(state.taxonomy, CAT.criticality) },
    { id: 'attestation', label: 'Attestation', usageLevel: true, values: (_t, u) => [u ? u.attestation : NOT_USED], order: [ATTESTED, NOT_ATTESTED] },
  ]
  for (const c of state.categories) {
    if (bound.has(c) || !isToolCategory(c)) continue
    fields.push({ id: `custom:${c}`, label: c, usageLevel: false, values: (t) => tv(t.custom[c] ?? ''), order: termsOf(state.taxonomy, c) })
  }
  return fields
}

const bound = new Set<string>(Object.values(CAT))

export interface PivotFilters {
  layer: Layer | null
  attestedOnly: boolean
  vendors: Vendor[]
  /** Drill-down filters: field id → value */
  where: { field: string; value: string }[]
}

export interface Cell {
  tools: Set<string>
  desks: Set<string>
}

export interface PivotResult {
  rowKeys: string[][]
  colKeys: string[]
  cells: Map<string, Cell>
  rowTotals: Map<string, Cell>
  subTotals: Map<string, Cell>
  colTotals: Map<string, Cell>
  grand: Cell
}

const SEP = '␟'
export const cellKey = (row: string[], col: string) => `${row.join(SEP)}${SEP}${SEP}${col}`
export const rowKey = (row: string[]) => row.join(SEP)

function sortValues(values: Iterable<string>, order: string[]): string[] {
  const idx = new Map(order.map((v, i) => [v, i]))
  const special = (v: string) => (v === BLANK || v === NOT_USED ? 1 : 0)
  return [...values].sort((a, b) => {
    const s = special(a) - special(b)
    if (s) return s
    const ia = idx.get(a) ?? Number.MAX_SAFE_INTEGER
    const ib = idx.get(b) ?? Number.MAX_SAFE_INTEGER
    return ia !== ib ? ia - ib : a.localeCompare(b)
  })
}

function add(map: Map<string, Cell>, key: string, toolId: string, desk: string | null) {
  let c = map.get(key)
  if (!c) map.set(key, (c = { tools: new Set(), desks: new Set() }))
  c.tools.add(toolId)
  if (desk) c.desks.add(desk)
}

export function measureValue(cell: Cell | undefined, measure: Measure, costById: Map<string, number>): number {
  if (!cell) return 0
  if (measure === 'tools') return cell.tools.size
  if (measure === 'desks') return cell.desks.size
  let s = 0
  for (const id of cell.tools) s += costById.get(id) ?? 0
  return s
}

export function runPivot(state: DataState, fields: FieldDef[], rows: string[], col: string | null, filters: PivotFilters): PivotResult {
  const lm = layerMap(state.taxonomy)
  const fById = new Map(fields.map((f) => [f.id, f]))
  const rowDefs = rows.map((r) => fById.get(r)).filter((f): f is FieldDef => !!f)
  const colDef = col ? fById.get(col) ?? null : null
  const whereDefs = filters.where.map((w) => ({ def: fById.get(w.field), value: w.value })).filter((w): w is { def: FieldDef; value: string } => !!w.def)

  const usagesByTool = new Map<string, Usage[]>()
  for (const u of state.usages) {
    if (filters.attestedOnly && u.attestation !== ATTESTED) continue
    usagesByTool.set(u.toolId, [...(usagesByTool.get(u.toolId) ?? []), u])
  }

  const cells = new Map<string, Cell>()
  const rowTotals = new Map<string, Cell>()
  const subTotals = new Map<string, Cell>()
  const colTotals = new Map<string, Cell>()
  const grand: Cell = { tools: new Set(), desks: new Set() }
  const rowValueSets = rowDefs.map(() => new Set<string>())
  const rowKeySet = new Map<string, string[]>()
  const colValues = new Set<string>()

  for (const tool of state.tools) {
    if (filters.layer && layerOf(tool, lm) !== filters.layer) continue
    if (filters.vendors.length && !filters.vendors.includes(tool.vendor)) continue
    const us = usagesByTool.get(tool.id) ?? []
    if (filters.attestedOnly && us.length === 0) continue
    const facts: (Usage | null)[] = us.length ? us : [null]
    for (const u of facts) {
      if (!whereDefs.every((w) => w.def.values(tool, u).includes(w.value))) continue
      const rowVals = rowDefs.map((d) => d.values(tool, u))
      const colVals = colDef ? colDef.values(tool, u) : ['']
      const combos = rowVals.reduce<string[][]>((acc, vals) => acc.flatMap((a) => vals.map((v) => [...a, v])), [[]])
      const desk = u?.desk ?? null
      grand.tools.add(tool.id)
      if (desk) grand.desks.add(desk)
      for (const combo of combos) {
        combo.forEach((v, i) => rowValueSets[i].add(v))
        const rk = rowKey(combo)
        rowKeySet.set(rk, combo)
        add(rowTotals, rk, tool.id, desk)
        if (combo.length > 1) add(subTotals, combo[0], tool.id, desk)
        for (const cv of colVals) {
          colValues.add(cv)
          add(cells, cellKey(combo, cv), tool.id, desk)
        }
      }
      for (const cv of colVals) add(colTotals, cv, tool.id, desk)
    }
  }

  const orders = rowDefs.map((d, i) => sortValues(rowValueSets[i], d.order))
  const pos = orders.map((o) => new Map(o.map((v, i) => [v, i])))
  const rowKeys = [...rowKeySet.values()].sort((a, b) => {
    for (let i = 0; i < a.length; i++) {
      const d = (pos[i].get(a[i]) ?? 0) - (pos[i].get(b[i]) ?? 0)
      if (d) return d
    }
    return 0
  })
  const colKeys = colDef ? sortValues(colValues, colDef.order) : ['']
  return { rowKeys, colKeys, cells, rowTotals, subTotals, colTotals, grand }
}

export interface WhereClause {
  field: string
  value: string
}

/** Drill-down filters travel in the URL as `field:value|field:value`. */
export function parseWhere(s: string | null): WhereClause[] {
  if (!s) return []
  return s
    .split('|')
    .map((p) => {
      const i = p.indexOf(':')
      return i > 0 ? { field: p.slice(0, i), value: p.slice(i + 1) } : null
    })
    .filter((x): x is WhereClause => !!x)
}

export const encodeWhere = (w: WhereClause[]) => w.map((x) => `${x.field}:${x.value}`).join('|')
