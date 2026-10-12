import type { DataState, ImportLog, Issue, Layer, SourceRecord, Tool } from '../types'
import { catKey, fieldKey, mappedValue } from './mapping'
import { buildIndex, fuzzyCandidates, matchExact } from './match'
import { toNumber, toVendor } from './seed'
import { CAT, layerMap, layerOf, termsOf } from './taxonomy'
import { today, uid } from './util'

export const missingType = (source: string) => `MissingIn${source.replace(/[^A-Za-z0-9]/g, '')}`
export const MISSING_IN_MASTER = 'MissingInMaster'
export const NAME_MISMATCH = 'NameMismatch'
export const TYPE_CONFLICT = 'TypeConflict'

export interface ImportInput {
  source: string
  fileName: string
  headerMap: Record<string, string>
  rows: Record<string, string>[]
}

function majority(counts: Map<string, Map<string, number>>, k: string, minShare = 0): string {
  const m = counts.get(k)
  if (!m) return ''
  let best = ''
  let n = 0
  let total = 0
  for (const [v, c] of m) {
    total += c
    if (c > n) [best, n] = [v, c]
  }
  return n / total >= minShare ? best : ''
}

function bump(counts: Map<string, Map<string, number>>, k: string, v: string) {
  if (!k || !v) return
  const m = counts.get(k) ?? new Map<string, number>()
  m.set(v, (m.get(v) ?? 0) + 1)
  counts.set(k, m)
}

/** What a source's own values tell us, learned from rows that matched exactly. */
export interface Learned {
  typeToCat: Map<string, Map<string, number>>
  capToCapL2: Map<string, Map<string, number>>
}

export function learn(state: DataState, source: string): Learned {
  const toolById = new Map(state.tools.map((t) => [t.id, t]))
  const typeToCat = new Map<string, Map<string, number>>()
  const capToCapL2 = new Map<string, Map<string, number>>()
  for (const r of state.sourceRecords) {
    if (r.source !== source || r.resolution !== 'accepted' || !r.matchedToolId) continue
    const tool = toolById.get(r.matchedToolId)
    if (!tool) continue
    bump(typeToCat, mappedValue(r.raw, r.headerMap, fieldKey('sourceType')), tool.toolType)
    bump(capToCapL2, mappedValue(r.raw, r.headerMap, catKey(CAT.capL2)), tool.capL2)
  }
  return { typeToCat, capToCapL2 }
}

export interface Suggestion {
  tool: Omit<Tool, 'id'>
  /** Which fields were inferred (rather than read straight from the file). */
  inferred: string[]
}

/** Suggested values for creating a new tool from an unmatched source row. */
export function suggestTool(state: DataState, record: SourceRecord, learned: Learned): Suggestion {
  const get = (target: string) => mappedValue(record.raw, record.headerMap, target)
  const valid = (cat: string, v: string) => termsOf(state.taxonomy, cat).includes(v)
  const inferred: string[] = []

  let toolType = get(catKey(CAT.toolType))
  if (!valid(CAT.toolType, toolType)) {
    const type = get(fieldKey('sourceType'))
    toolType = valid(CAT.toolType, type) ? type : majority(learned.typeToCat, type)
    if (toolType) inferred.push(CAT.toolType)
  }

  let capL2 = get(catKey(CAT.capL2))
  if (!valid(CAT.capL2, capL2)) {
    capL2 = majority(learned.capToCapL2, capL2)
    if (capL2) inferred.push(CAT.capL2)
  }

  let capL3 = get(catKey(CAT.capL3))
  if (!valid(CAT.capL3, capL3)) {
    const peers = new Map<string, Map<string, number>>()
    for (const t of state.tools) {
      bump(peers, `${t.capL2}|${t.toolType}`, t.capL3)
      bump(peers, `${t.capL2}|*`, t.capL3)
    }
    capL3 = majority(peers, `${capL2}|${toolType}`) || majority(peers, `${capL2}|*`)
    if (capL3) inferred.push(CAT.capL3)
  }

  const users = get(catKey(CAT.users))
  const custom: Record<string, string> = {}
  for (const [h, t] of Object.entries(record.headerMap)) {
    if (!t.startsWith('cat:')) continue
    const c = t.slice(4)
    if (![CAT.toolType, CAT.capL2, CAT.capL3, CAT.users].includes(c as never) && valid(c, record.raw[h])) custom[c] = record.raw[h]
  }

  return {
    tool: {
      name: record.rawName,
      vendor: toVendor(get(fieldKey('vendor'))),
      ownership: get(fieldKey('ownership')),
      toolType,
      users,
      invUserGroup: get(fieldKey('invUserGroup')),
      capL2,
      capL3,
      costK: toNumber(get(fieldKey('costK'))),
      custom,
    },
    inferred,
  }
}

/** Raise / clear `MissingIn<Source>` issues so they reflect the current matches. */
export function recomputeMissing(state: DataState, source: string): Issue[] {
  const type = missingType(source)
  const matched = new Set(
    state.sourceRecords.filter((r) => r.source === source && r.matchedToolId && r.resolution !== 'rejected').map((r) => r.matchedToolId!),
  )
  const issues = state.issues.map((i) => {
    if (i.type === type && i.status === 'Open' && i.toolId && matched.has(i.toolId)) {
      return { ...i, status: 'Resolved' as const, resolution: 'Matched in a later decision' }
    }
    return i
  })
  const hasIssue = new Set(issues.filter((i) => i.type === type).map((i) => i.toolId))
  for (const t of state.tools) {
    if (matched.has(t.id)) continue
    if (hasIssue.has(t.id)) {
      // re-open if it had been auto-resolved and is now missing again
      const idx = issues.findIndex((i) => i.type === type && i.toolId === t.id)
      if (issues[idx].status === 'Resolved' && issues[idx].resolution === 'Matched in a later decision') {
        issues[idx] = { ...issues[idx], status: 'Open', resolution: undefined }
      }
      continue
    }
    issues.push({ id: uid('iss'), type, source, toolId: t.id, detail: `“${t.name}” is in the master list but has no row in ${source}`, status: 'Open', createdOn: today() })
  }
  return issues
}

export function refreshLog(state: DataState, importId: string): ImportLog[] {
  const recs = state.sourceRecords.filter((r) => r.importId === importId)
  if (!recs.length) return state.imports
  return state.imports.map((l) =>
    l.id !== importId
      ? l
      : {
          ...l,
          matched: recs.filter((r) => r.resolution === 'accepted').length,
          fuzzy: recs.filter((r) => r.matchType === 'fuzzy' && r.resolution === 'pending').length,
          created: recs.filter((r) => r.resolution === 'created').length,
          ignored: recs.filter((r) => r.resolution === 'ignored').length,
          unmatched: recs.filter((r) => r.matchType === 'unmatched' && r.resolution === 'pending').length,
        },
  )
}

export function runImport(state: DataState, input: ImportInput): { state: DataState; importId: string } {
  const { source, fileName, headerMap, rows } = input
  const importId = uid('imp')
  const nameHeader = Object.keys(headerMap).find((h) => headerMap[h] === fieldKey('name'))
  const idHeader = Object.keys(headerMap).find((h) => headerMap[h] === fieldKey('externalId'))
  const idx = buildIndex(state.tools, state.aliases)
  const toolById = new Map(state.tools.map((t) => [t.id, t]))

  const records: SourceRecord[] = []
  const matchedExactly = new Set<string>()
  for (const raw of rows) {
    const rawName = nameHeader ? (raw[nameHeader] ?? '').trim() : ''
    if (!rawName) continue
    const m = matchExact(idx, rawName)
    if (m) matchedExactly.add(m.toolId)
    records.push({
      id: uid('src'),
      importId,
      source,
      externalId: idHeader ? raw[idHeader] ?? '' : '',
      rawName,
      raw,
      headerMap,
      matchedToolId: m?.toolId,
      matchType: m ? m.type : 'unmatched',
      resolution: m ? 'accepted' : 'pending',
      candidates: [],
    })
  }
  for (const r of records) {
    if (r.resolution === 'accepted') continue
    const c = fuzzyCandidates(idx, r.rawName, matchedExactly)
    if (c.length) {
      r.matchType = 'fuzzy'
      r.candidates = c
      r.matchedToolId = c[0].toolId
    }
  }

  const keptIssues = state.issues.filter((i) => i.source !== source)
  const newIssues: Issue[] = []
  for (const r of records) {
    if (r.matchType === 'fuzzy') {
      const t = toolById.get(r.matchedToolId!)
      newIssues.push({ id: uid('iss'), type: NAME_MISMATCH, source, toolId: t?.id, sourceRecordId: r.id, detail: `${source} calls it “${r.rawName}”; master list has “${t?.name}”`, status: 'Open', createdOn: today() })
    } else if (r.matchType === 'unmatched') {
      newIssues.push({ id: uid('iss'), type: MISSING_IN_MASTER, source, sourceRecordId: r.id, detail: `“${r.rawName}” is in ${source} but not in the master list`, status: 'Open', createdOn: today() })
    }
  }

  let next: DataState = {
    ...state,
    sourceRecords: [...state.sourceRecords.filter((r) => r.source !== source), ...records],
    issues: [...keptIssues, ...newIssues],
    imports: [
      { id: importId, source, fileName, date: today(), rowCount: records.length, matched: 0, fuzzy: 0, created: 0, ignored: 0, unmatched: 0 },
      ...state.imports,
    ],
  }

  // Type conflicts: the source's type field disagrees with the layer we hold for the tool.
  const learned = learn(next, source)
  const lm = layerMap(next.taxonomy)
  const typeLayer = (type: string): Layer | null => {
    const cat = majority(learned.typeToCat, type, 0.7)
    return cat ? lm.get(cat) ?? null : null
  }
  for (const r of records) {
    if (r.resolution !== 'accepted' || !r.matchedToolId) continue
    const type = mappedValue(r.raw, headerMap, fieldKey('sourceType'))
    const expected = type ? typeLayer(type) : null
    const tool = toolById.get(r.matchedToolId)
    if (!tool || !expected) continue
    const actual = layerOf(tool, lm)
    if (expected !== actual) {
      next.issues.push({ id: uid('iss'), type: TYPE_CONFLICT, source, toolId: tool.id, sourceRecordId: r.id, detail: `${source} type “${type}” implies ${expected}, but “${tool.name}” is a ${actual} (${tool.toolType})`, status: 'Open', createdOn: today() })
    }
  }

  next = { ...next, issues: recomputeMissing(next, source) }
  next = { ...next, imports: refreshLog(next, importId) }
  return { state: next, importId }
}
