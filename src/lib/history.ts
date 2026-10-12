import type { Alias, DataState, Dependency, TaxonomyTerm, Tool, Usage } from '../types'

/** The slices of the map a tracked change can touch, and so can undo. */
export interface Tracked {
  tools: Tool[]
  usages: Usage[]
  taxonomy: TaxonomyTerm[]
  aliases: Alias[]
  dependencies: Dependency[]
}
type SliceName = keyof Tracked
const SLICES: SliceName[] = ['tools', 'usages', 'taxonomy', 'aliases', 'dependencies']

export interface SlicePatch<T> {
  /** Items as they were before the change (changed or removed). */
  before: T[]
  /** Ids of items the change added. */
  added: string[]
}

export interface Patch {
  tools?: SlicePatch<Tool>
  usages?: SlicePatch<Usage>
  taxonomy?: SlicePatch<TaxonomyTerm>
  aliases?: SlicePatch<Alias>
  dependencies?: SlicePatch<Dependency>
  /** Category list before the change, if it changed. */
  categories?: string[]
}

function diffSlice<T extends { id: string }>(before: T[], after: T[]): SlicePatch<T> | undefined {
  const afterById = new Map(after.map((x) => [x.id, x]))
  const beforeIds = new Set(before.map((x) => x.id))
  const changed = before.filter((x) => afterById.get(x.id) !== x)
  const added = after.filter((x) => !beforeIds.has(x.id)).map((x) => x.id)
  return changed.length || added.length ? { before: changed, added } : undefined
}

/** What a change did, worked out by comparing the map before and after it. Untouched items keep their identity. */
export function diffState(before: DataState, after: DataState): Patch | null {
  const p: Patch = {}
  let any = false
  for (const k of SLICES) {
    const d = diffSlice<{ id: string }>(before[k], after[k])
    if (d) {
      ;(p as Record<string, unknown>)[k] = d
      any = true
    }
  }
  if (before.categories !== after.categories && before.categories.join('\u0000') !== after.categories.join('\u0000')) {
    p.categories = before.categories
    any = true
  }
  return any ? p : null
}

/** Every item id a patch touched, prefixed by slice, for conflict checks. */
export function touched(p: Patch): Set<string> {
  const out = new Set<string>()
  for (const k of SLICES) {
    const sp = p[k] as SlicePatch<{ id: string }> | undefined
    if (!sp) continue
    for (const x of sp.before) out.add(`${k}:${x.id}`)
    for (const id of sp.added) out.add(`${k}:${id}`)
  }
  if (p.categories) out.add('categories')
  return out
}

function revertSlice<T extends { id: string }>(current: T[], sp: SlicePatch<T> | undefined): T[] {
  if (!sp) return current
  const added = new Set(sp.added)
  const restore = new Map(sp.before.map((x) => [x.id, x]))
  const out = current.filter((x) => !added.has(x.id)).map((x) => restore.get(x.id) ?? x)
  const present = new Set(out.map((x) => x.id))
  for (const x of sp.before) if (!present.has(x.id)) out.push(x)
  return out
}

/** Put the touched items back as they were before the change. */
export function revert(state: DataState, p: Patch): Partial<DataState> {
  return {
    tools: revertSlice(state.tools, p.tools),
    usages: revertSlice(state.usages, p.usages),
    taxonomy: revertSlice(state.taxonomy, p.taxonomy),
    aliases: revertSlice(state.aliases, p.aliases),
    dependencies: revertSlice(state.dependencies, p.dependencies),
    ...(p.categories ? { categories: p.categories } : {}),
  }
}

export function patchSize(p: Patch): number {
  let n = 0
  for (const k of SLICES) {
    const sp = p[k] as SlicePatch<{ id: string }> | undefined
    if (sp) n += sp.before.length + sp.added.length
  }
  return n
}
