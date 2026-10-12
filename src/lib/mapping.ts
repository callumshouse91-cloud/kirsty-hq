import { MASTER_SOURCE } from '../types'
import { headerKey } from './util'

export type FieldTarget = 'name' | 'externalId' | 'sourceType' | 'vendor' | 'ownership' | 'invUserGroup' | 'costK'

export const FIELD_TARGETS: { field: FieldTarget; label: string }[] = [
  { field: 'name', label: 'Tool name' },
  { field: 'externalId', label: 'External ID' },
  { field: 'sourceType', label: 'Source type' },
  { field: 'vendor', label: 'Vendor (Y/N/?)' },
  { field: 'ownership', label: 'Tech ownership' },
  { field: 'invUserGroup', label: 'Inv user group' },
  { field: 'costK', label: 'Est annual cost (£k)' },
]

export const IGNORE = 'ignore'
export const fieldKey = (f: FieldTarget) => `field:${f}`
export const catKey = (c: string) => `cat:${c}`

export function parseTarget(key: string): { kind: 'field'; field: FieldTarget } | { kind: 'cat'; category: string } | { kind: 'ignore' } {
  if (key.startsWith('field:')) return { kind: 'field', field: key.slice(6) as FieldTarget }
  if (key.startsWith('cat:')) return { kind: 'cat', category: key.slice(4) }
  return { kind: 'ignore' }
}

export function targetLabel(key: string): string {
  const t = parseTarget(key)
  if (t.kind === 'field') return FIELD_TARGETS.find((f) => f.field === t.field)?.label ?? t.field
  if (t.kind === 'cat') return t.category
  return 'Ignore'
}

/** Known schema: the master tool list. Keyed by normalised header. */
export const MASTER_HEADER_MAP: Record<string, string> = {
  apptooleuc: fieldKey('name'),
  vendor: fieldKey('vendor'),
  techownership: fieldKey('ownership'),
  tooltype: catKey('Tool type'),
  users: catKey('Users'),
  invusergroup: fieldKey('invUserGroup'),
  capl2: catKey('Cap L2'),
  capl3: catKey('Cap L3'),
  estannualcostk: fieldKey('costK'),
  layerderived: IGNORE,
}

/** Known schema: LeanIX fact sheet export. */
export const LEANIX_HEADER_MAP: Record<string, string> = {
  leanixid: fieldKey('externalId'),
  applicationname: fieldKey('name'),
  factsheettype: fieldKey('sourceType'),
  businesscapability: catKey('Cap L2'),
  lifecycle: IGNORE,
  owningorg: IGNORE,
  criticalitytier: IGNORE,
}

/** Known schema: the EUC register (attested spreadsheets and local builds). */
export const EUC_HEADER_MAP: Record<string, string> = {
  eucid: fieldKey('externalId'),
  eucname: fieldKey('name'),
  kind: fieldKey('sourceType'),
  owningdesk: IGNORE,
  riskrating: IGNORE,
  lastattested: IGNORE,
  status: IGNORE,
}

export const LEANIX_SOURCE = 'LeanIX'
export const EUC_SOURCE = 'EUC register'

/** A tool the EUC register is expected to hold: a desk-built spreadsheet or local build. */
export function isEuc(t: { name: string; invUserGroup: string }): boolean {
  return /\(EUC\)\s*$/i.test(t.name) || t.invUserGroup.trim().toLowerCase() === 'desk-built'
}

/**
 * Which master-list tools a source is expected to cover. Tools outside a source's scope
 * are never flagged as missing from it. LeanIX covers everything; the EUC register only EUCs.
 */
export function inSourceScope(source: string, t: { name: string; invUserGroup: string }): boolean {
  return source === EUC_SOURCE ? isEuc(t) : true
}

const GENERIC: Record<string, string> = {
  name: fieldKey('name'),
  toolname: fieldKey('name'),
  application: fieldKey('name'),
  tool: fieldKey('name'),
  id: fieldKey('externalId'),
  externalid: fieldKey('externalId'),
  type: fieldKey('sourceType'),
  cost: fieldKey('costK'),
}

export function guessSource(headers: string[], fileName: string): string {
  const keys = headers.map(headerKey)
  if (keys.includes('leanixid')) return LEANIX_SOURCE
  if (keys.includes('eucid')) return EUC_SOURCE
  if (keys.includes('apptooleuc')) return MASTER_SOURCE
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Import'
}

/** Pre-map headers by name against the known schemas; anything unknown is ignored. */
export function preMap(headers: string[], validCategories: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  const used = new Set<string>()
  for (const h of headers) {
    const k = headerKey(h)
    let target = MASTER_HEADER_MAP[k] ?? LEANIX_HEADER_MAP[k] ?? EUC_HEADER_MAP[k] ?? GENERIC[k]
    if (!target) {
      const cat = validCategories.find((c) => headerKey(c) === k)
      target = cat ? catKey(cat) : IGNORE
    }
    const t = parseTarget(target)
    if (t.kind === 'cat' && !validCategories.includes(t.category)) target = IGNORE
    if (target !== IGNORE && used.has(target)) target = IGNORE
    used.add(target)
    out[h] = target
  }
  return out
}

export function mappedValue(raw: Record<string, string>, headerMap: Record<string, string>, target: string): string {
  for (const [h, t] of Object.entries(headerMap)) if (t === target) return raw[h] ?? ''
  return ''
}
