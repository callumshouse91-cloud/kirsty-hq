import type { Alias, MatchCandidate, Tool } from '../types'

/**
 * Common abbreviations seen across Investments tool inventories. Applied to both
 * sides before comparing, so "BBG AIM" and "Bloomberg AIM" normalise the same way.
 */
const ABBREVIATIONS: Record<string, string> = {
  bbg: 'bloomberg',
  crims: 'charles river ims',
  crd: 'charles river ims',
  adf: 'azure data factory',
  pbi: 'power bi',
}

const STOP = new Set(['the', 'and', 'of', 'a', 'for'])

function stem(t: string): string {
  // naive singular: "terminals" → "terminal", but keep short tokens like "ims", "dms"
  return t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t
}

export function tokens(s: string): string[] {
  const words = s
    .toLowerCase()
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const out: string[] = []
  for (const w of words) {
    const expanded = ABBREVIATIONS[w]
    for (const x of (expanded ?? w).split(' ')) if (!STOP.has(x)) out.push(stem(x))
  }
  return out
}

/** Name with any bracketed qualifier removed: "Snowflake (Inv Data Lake)" → "Snowflake". */
function stripBracketed(s: string): string {
  return s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
}

export function normalise(s: string): string {
  return tokens(s).join(' ')
}

function overlap(a: string[], b: string[]): number {
  const A = new Set(a)
  const B = new Set(b)
  if (A.size === 0 || B.size === 0) return 0
  let inter = 0
  for (const x of A) if (B.has(x)) inter++
  return inter / (A.size + B.size - inter)
}

/** Token overlap (Jaccard) on the full name, or on the name without bracketed qualifiers — whichever is higher. */
export function similarity(a: string, b: string): number {
  const full = overlap(tokens(a), tokens(b))
  const core = overlap(tokens(stripBracketed(a)), tokens(stripBracketed(b)))
  return Math.max(full, core)
}

export const FUZZY_THRESHOLD = 0.6

export interface MatchIndex {
  exact: Map<string, string>
  alias: Map<string, string>
  tools: Tool[]
  aliasesByTool: Map<string, string[]>
}

const key = (s: string) => s.trim().toLowerCase()

export function buildIndex(tools: Tool[], aliases: Alias[]): MatchIndex {
  const exact = new Map<string, string>()
  for (const t of tools) exact.set(key(t.name), t.id)
  const alias = new Map<string, string>()
  const aliasesByTool = new Map<string, string[]>()
  for (const a of aliases) {
    alias.set(key(a.alias), a.toolId)
    aliasesByTool.set(a.toolId, [...(aliasesByTool.get(a.toolId) ?? []), a.alias])
  }
  return { exact, alias, tools, aliasesByTool }
}

export function matchExact(idx: MatchIndex, name: string): { toolId: string; type: 'exact' | 'alias' } | null {
  const e = idx.exact.get(key(name))
  if (e) return { toolId: e, type: 'exact' }
  const a = idx.alias.get(key(name))
  if (a) return { toolId: a, type: 'alias' }
  return null
}

/** Best fuzzy candidates at or above the threshold, best first. */
export function fuzzyCandidates(idx: MatchIndex, name: string, exclude: Set<string>, limit = 3): MatchCandidate[] {
  const out: MatchCandidate[] = []
  for (const t of idx.tools) {
    if (exclude.has(t.id)) continue
    const names = [t.name, ...(idx.aliasesByTool.get(t.id) ?? [])]
    const score = Math.max(...names.map((n) => similarity(name, n)))
    if (score >= FUZZY_THRESHOLD) out.push({ toolId: t.id, score: Math.round(score * 100) / 100 })
  }
  out.sort((a, b) => b.score - a.score)
  return out.slice(0, limit)
}
