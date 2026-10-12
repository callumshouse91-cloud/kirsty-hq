import Papa from 'papaparse'
import {
  ATTESTED,
  MASTER_SOURCE,
  NOT_ATTESTED,
  type DataState,
  type Dependency,
  type SourceRecord,
  type TaxonomyTerm,
  type Tool,
  type Usage,
  type Vendor,
} from '../types'
import { MASTER_HEADER_MAP } from './mapping'
import { seededApprovals, seededHistory } from './seed-history'
import { CAT } from './taxonomy'
import { headerKey, slugify, today, uniqueId } from './util'

export type Row = Record<string, string>

export function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const res = Papa.parse<Row>(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: (h) => h.trim() })
  const headers = (res.meta.fields ?? []).filter((h) => h !== '')
  const rows = res.data.map((r) => {
    const o: Row = {}
    for (const h of headers) o[h] = String(r[h] ?? '').trim()
    return o
  })
  return { headers, rows }
}

/** Look up a column by a normalised header name so "Est Annual Cost (£k)" survives encoding quirks. */
function col(row: Row, name: string): string {
  if (name in row) return row[name]
  const k = headerKey(name)
  for (const h of Object.keys(row)) if (headerKey(h) === k) return row[h]
  return ''
}

export function toVendor(v: string): Vendor {
  const s = v.trim().toUpperCase()
  if (s === 'Y' || s === 'YES') return 'Y'
  if (s === 'N' || s === 'NO') return 'N'
  return '?'
}

export function toNumber(v: string): number {
  const n = Number(String(v).replace(/[£,\s]/g, ''))
  return Number.isFinite(n) ? n : 0
}

async function fetchText(name: string): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}seed/${name}`)
  if (!res.ok) throw new Error(`Could not load seed/${name}`)
  return res.text()
}

/** A file from public/samples, as if it had been dropped in. */
export async function fetchSampleFile(name: string): Promise<File> {
  const res = await fetch(`${import.meta.env.BASE_URL}samples/${name}`)
  if (!res.ok) throw new Error(`Could not load samples/${name}`)
  const blob = await res.blob()
  return new File([blob], name, { type: name.endsWith('.xlsx') ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'text/csv' })
}

export async function loadSeed(): Promise<DataState> {
  const [toolsCsv, taxCsv, usageCsv, depCsv] = await Promise.all(
    ['full_tech_list.csv', 'taxonomy.csv', 'desk_usage.csv', 'dependencies.csv'].map(fetchText),
  )
  return buildSeed(parseCsv(toolsCsv), parseCsv(taxCsv).rows, parseCsv(usageCsv).rows, parseCsv(depCsv).rows)
}

/**
 * A master workbook with the same sheets as the demo workbook: a tool list (App / Tool / EUC),
 * a taxonomy (Category, Term), and optionally desk usage and dependencies. Returns null if it is not one.
 */
export function seedFromSheets(sheets: { name: string; headers: string[]; rows: Row[] }[]): DataState | null {
  const has = (s: { headers: string[] }, ...hs: string[]) => hs.every((h) => s.headers.some((x) => headerKey(x) === headerKey(h)))
  const master = sheets.find((s) => has(s, 'App / Tool / EUC'))
  const tax = sheets.find((s) => has(s, 'Category', 'Term'))
  if (!master || !tax) return null
  const usage = sheets.find((s) => has(s, 'Desk', 'Strategy', 'Application'))
  const deps = sheets.find((s) => has(s, 'Application', 'Depends On (Foundation)'))
  return buildSeed(master, tax.rows, usage?.rows ?? [], deps?.rows ?? [])
}

function buildSeed(master: { headers: string[]; rows: Row[] }, taxRows: Row[], usageRows: Row[], depRows: Row[]): DataState {
  const ids = new Set<string>()
  const byName = new Map<string, string>()
  const tools: Tool[] = []
  const sourceRecords: SourceRecord[] = []
  const headerMap: Record<string, string> = {}
  for (const h of master.headers) headerMap[h] = MASTER_HEADER_MAP[headerKey(h)] ?? 'ignore'

  for (const r of master.rows) {
    const name = col(r, 'App / Tool / EUC')
    if (!name) continue
    const id = uniqueId(slugify(name), ids)
    byName.set(name.toLowerCase(), id)
    tools.push({
      id,
      name,
      vendor: toVendor(col(r, 'Vendor')),
      ownership: col(r, 'Tech Ownership'),
      toolType: col(r, 'Tool type'),
      users: col(r, 'Users'),
      invUserGroup: col(r, 'Inv User Group'),
      capL2: col(r, 'Cap L2'),
      capL3: col(r, 'Cap L3'),
      costK: toNumber(col(r, 'Est Annual Cost (£k)')),
      custom: {},
    })
    sourceRecords.push({
      id: `src-master-${id}`,
      importId: 'seed',
      source: MASTER_SOURCE,
      externalId: '',
      rawName: name,
      raw: r,
      headerMap,
      matchedToolId: id,
      matchType: 'exact',
      resolution: 'accepted',
      candidates: [],
    })
  }

  const taxonomy: TaxonomyTerm[] = []
  const categories: string[] = []
  for (const r of taxRows) {
    const category = col(r, 'Category')
    const term = col(r, 'Term')
    if (!category || !term) continue
    if (!categories.includes(category)) categories.push(category)
    taxonomy.push({ id: `tax-${slugify(category)}-${slugify(term)}`, category, term, parent: col(r, 'Parent / Note') })
  }

  const usages: Usage[] = []
  const uids = new Set<string>()
  for (const r of usageRows) {
    const toolId = byName.get(col(r, 'Application').toLowerCase())
    if (!toolId) continue
    const desk = col(r, 'Desk')
    const strategy = col(r, 'Strategy')
    const attested = col(r, 'Attestation').toLowerCase() === ATTESTED.toLowerCase()
    usages.push({
      id: uniqueId(`use-${slugify(desk)}-${slugify(strategy)}-${toolId}`, uids),
      desk,
      strategy,
      toolId,
      criticality: col(r, 'Criticality'),
      attestation: attested ? ATTESTED : NOT_ATTESTED,
      attestedOn: attested ? col(r, 'Attested On') : '',
    })
  }

  // Criticality isn't in the taxonomy sheet; derive it from the usage data so it is still editable reference data.
  if (!categories.includes(CAT.criticality)) {
    const seen = [...new Set(usages.map((u) => u.criticality).filter(Boolean))]
    const rank = (v: string) => {
      const s = v.toLowerCase()
      return s.startsWith('crit') ? 0 : s.startsWith('imp') ? 1 : 2
    }
    seen.sort((a, b) => rank(a) - rank(b))
    categories.push(CAT.criticality)
    for (const term of seen) taxonomy.push({ id: `tax-criticality-${slugify(term)}`, category: CAT.criticality, term, parent: '' })
  }

  const dependencies: Dependency[] = []
  const dids = new Set<string>()
  for (const r of depRows) {
    const appId = byName.get(col(r, 'Application').toLowerCase())
    const foundationId = byName.get(col(r, 'Depends On (Foundation)').toLowerCase())
    if (!appId || !foundationId) continue
    dependencies.push({ id: uniqueId(`dep-${appId}-${foundationId}`, dids), appId, foundationId, direction: col(r, 'Direction') || 'Both' })
  }

  return {
    tools,
    categories,
    taxonomy,
    usages,
    dependencies,
    sourceRecords,
    aliases: [],
    issues: [],
    history: seededHistory(),
    approvals: seededApprovals({ tools, usages, taxonomy }),
    feedRuns: [],
    imports: [
      {
        id: 'seed',
        source: MASTER_SOURCE,
        fileName: 'Master workbook',
        date: today(),
        rowCount: tools.length,
        matched: 0,
        fuzzy: 0,
        created: tools.length,
        ignored: 0,
        unmatched: 0,
      },
    ],
  }
}
