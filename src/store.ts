import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { useDemo } from './demo-store'
import { diffState, revert, touched } from './lib/history'
import { migrateState } from './lib/migrate'
import { MISSING_IN_MASTER, NAME_MISMATCH, recomputeMissing, refreshLog, runImport, type ImportInput } from './lib/reconcile'
import { role as roleDef } from './lib/roles'
import { loadSeed } from './lib/seed'
import { CAT, impactSentence, layerMap, relabel, termImpact } from './lib/taxonomy'
import { plural, slugify, today, uid, uniqueId } from './lib/util'
import { ATTESTED, NOT_ATTESTED, type ApprovalAction, type ChangeKind, type DataState, type FeedRun, type Layer, type Tool } from './types'

export const STORAGE_KEY = 'investments-tech-map:v1'

const EMPTY: DataState = {
  tools: [],
  categories: [],
  taxonomy: [],
  usages: [],
  dependencies: [],
  sourceRecords: [],
  aliases: [],
  issues: [],
  imports: [],
  history: [],
  approvals: [],
  feedRuns: [],
}

const DATA_KEYS = Object.keys(EMPTY) as (keyof DataState)[]

function pickData(s: DataState): DataState {
  const out = {} as Record<keyof DataState, unknown>
  for (const k of DATA_KEYS) out[k] = s[k]
  return out as DataState
}

/** Who is acting, for change history: the simulated role in production, or the laptop user in the sandbox. */
export function currentActor(): string {
  const d = useDemo.getState()
  return d.env === 'sandbox' ? 'You (sandbox)' : roleDef(d.role).name
}

interface Actions {
  hydrateFrom: (s: DataState) => void
  resetToSeed: () => Promise<void>

  updateTool: (id: string, patch: Partial<Omit<Tool, 'id'>>) => void
  createTool: (t: Omit<Tool, 'id'>) => string
  addAlias: (toolId: string, alias: string, source: string) => void
  removeAlias: (id: string) => void

  addUsage: (desk: string, strategy: string, toolId: string, criticality: string) => void
  removeUsage: (id: string) => void
  setCriticality: (id: string, c: string) => void
  attest: (ids: string[]) => void

  addDependency: (appId: string, foundationId: string, direction: string) => void
  removeDependency: (id: string) => void

  addCategory: (name: string) => void
  addTerm: (category: string, term: string, parent: string) => void
  renameTerm: (category: string, from: string, to: string) => void
  mergeTerm: (category: string, from: string, into: string) => void
  deleteTerm: (category: string, term: string) => void
  setParent: (category: string, term: string, parent: string) => void
  setLayer: (toolType: string, layer: Layer) => void

  importRows: (input: ImportInput) => string
  confirmFuzzy: (recordId: string, toolId: string) => void
  rejectFuzzy: (recordId: string) => void
  createFromRecord: (recordId: string, tool: Omit<Tool, 'id'>) => string
  ignoreRecord: (recordId: string) => void
  resolveIssue: (id: string, resolution: string) => void
  reopenIssue: (id: string) => void

  /** Undo a tracked change. Returns a reason if it can't be undone. */
  undoChange: (id: string) => string | null
  requestApproval: (action: ApprovalAction) => void
  decideApproval: (id: string, approve: boolean, note?: string) => void
  addFeedRun: (run: Omit<FeedRun, 'id'>) => void
}

export type Store = DataState & Actions

function newToolId(state: DataState, name: string): string {
  return uniqueId(slugify(name), new Set(state.tools.map((t) => t.id)))
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const data = (): DataState => pickData(get())
      const toolName = (id: string) => get().tools.find((t) => t.id === id)?.name ?? 'a tool'

      /** Run a change and, if it changed anything, record who did what with enough to undo it. */
      const tracked = (kind: ChangeKind, summary: string, fn: () => void, extra: { approvedBy?: string } = {}) => {
        const before = data()
        fn()
        const patch = diffState(before, data())
        if (!patch) return
        set((s) => ({ history: [{ id: uid('chg'), at: new Date().toISOString(), actor: currentActor(), kind, summary, patch, ...extra }, ...s.history].slice(0, 300) }))
      }

      /** Reconciliation decisions are logged but reversed on the Issues tab, not by undo. */
      const logged = (summary: string) =>
        set((s) => ({ history: [{ id: uid('chg'), at: new Date().toISOString(), actor: currentActor(), kind: 'reconcile' as const, summary }, ...s.history].slice(0, 300) }))

      const afterRecordChange = (recordId: string) => {
        const s = data()
        const rec = s.sourceRecords.find((r) => r.id === recordId)
        if (!rec) return
        set({ issues: recomputeMissing(s, rec.source) })
        set({ imports: refreshLog(data(), rec.importId) })
      }

      const resolveRecordIssues = (recordId: string, types: string[], resolution: string) =>
        set((s) => ({
          issues: s.issues.map((i) => (i.sourceRecordId === recordId && types.includes(i.type) && i.status === 'Open' ? { ...i, status: 'Resolved', resolution } : i)),
        }))

      const doMerge = (category: string, from: string, into: string) => {
        if (from === into) return
        const rel = relabel(data(), category, from, into)
        set({ ...rel, taxonomy: rel.taxonomy.filter((x) => !(x.category === category && x.term === from)) })
      }
      const doDelete = (category: string, term: string) => set((s) => ({ taxonomy: s.taxonomy.filter((x) => !(x.category === category && x.term === term)) }))

      return {
        ...EMPTY,

        hydrateFrom: (s) => set({ ...EMPTY, ...s }),
        resetToSeed: async () => {
          const seed = await loadSeed()
          set({ ...EMPTY, ...seed })
        },

        updateTool: (id, patch) => {
          const before = get().tools.find((t) => t.id === id)
          const fields = before ? (Object.keys(patch) as (keyof typeof patch)[]).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(before[k])) : []
          tracked('tool', `Edited ${toolName(id)}: ${fields.join(', ')}`, () => set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, ...patch } : t)) })))
        },
        createTool: (t) => {
          const id = newToolId(data(), t.name)
          tracked('tool', `Added tool “${t.name}”`, () => set((s) => ({ tools: [...s.tools, { ...t, id }] })))
          return id
        },
        addAlias: (toolId, alias, source) => {
          const a = alias.trim()
          if (!a) return
          if (get().aliases.some((x) => x.toolId === toolId && x.alias.toLowerCase() === a.toLowerCase())) return
          tracked('alias', `Saved “${a}” as an alias of ${toolName(toolId)}`, () => set((s) => ({ aliases: [...s.aliases, { id: uid('al'), toolId, alias: a, source }] })))
        },
        removeAlias: (id) => {
          const a = get().aliases.find((x) => x.id === id)
          if (!a) return
          tracked('alias', `Removed alias “${a.alias}” from ${toolName(a.toolId)}`, () => set((s) => ({ aliases: s.aliases.filter((x) => x.id !== id) })))
        },

        addUsage: (desk, strategy, toolId, criticality) => {
          if (get().usages.some((u) => u.desk === desk && u.strategy === strategy && u.toolId === toolId)) return
          tracked('usage', `Added ${toolName(toolId)} to ${desk} › ${strategy}`, () =>
            set((s) => ({ usages: [...s.usages, { id: uid('use'), desk, strategy, toolId, criticality, attestation: NOT_ATTESTED, attestedOn: '' }] })),
          )
        },
        removeUsage: (id) => {
          const u = get().usages.find((x) => x.id === id)
          if (!u) return
          tracked('usage', `Removed ${toolName(u.toolId)} from ${u.desk} › ${u.strategy}`, () => set((s) => ({ usages: s.usages.filter((x) => x.id !== id) })))
        },
        setCriticality: (id, c) => {
          const u = get().usages.find((x) => x.id === id)
          if (!u) return
          tracked('usage', `Set ${toolName(u.toolId)} to ${c} for ${u.desk} › ${u.strategy}`, () => set((s) => ({ usages: s.usages.map((x) => (x.id === id ? { ...x, criticality: c } : x)) })))
        },
        attest: (ids) => {
          const d = today()
          const set_ = new Set(ids)
          const desks = [...new Set(get().usages.filter((u) => set_.has(u.id)).map((u) => u.desk))]
          tracked('usage', `Attested ${plural(ids.length, 'usage')}${desks.length === 1 ? ` for ${desks[0]}` : ''}`, () =>
            set((s) => ({ usages: s.usages.map((u) => (set_.has(u.id) ? { ...u, attestation: ATTESTED, attestedOn: d } : u)) })),
          )
        },

        addDependency: (appId, foundationId, direction) => {
          if (appId === foundationId || get().dependencies.some((d) => d.appId === appId && d.foundationId === foundationId)) return
          tracked('dependency', `Linked ${toolName(appId)} to ${toolName(foundationId)} (${direction})`, () =>
            set((s) => ({ dependencies: [...s.dependencies, { id: uid('dep'), appId, foundationId, direction }] })),
          )
        },
        removeDependency: (id) => {
          const d = get().dependencies.find((x) => x.id === id)
          if (!d) return
          tracked('dependency', `Removed the link from ${toolName(d.appId)} to ${toolName(d.foundationId)}`, () => set((s) => ({ dependencies: s.dependencies.filter((x) => x.id !== id) })))
        },

        addCategory: (name) => {
          const n = name.trim()
          if (!n || get().categories.some((c) => c.toLowerCase() === n.toLowerCase())) return
          tracked('taxonomy', `Added category “${n}”`, () => set((s) => ({ categories: [...s.categories, n] })))
        },
        addTerm: (category, term, parent) => {
          const t = term.trim()
          if (!t || get().taxonomy.some((x) => x.category === category && x.term.toLowerCase() === t.toLowerCase())) return
          tracked('taxonomy', `Added ${category} “${t}”${parent ? ` under ${parent}` : ''}`, () => set((s) => ({ taxonomy: [...s.taxonomy, { id: uid('tax'), category, term: t, parent }] })))
        },
        renameTerm: (category, from, to) => {
          const t = to.trim()
          if (!t || t === from) return
          tracked('taxonomy', `Renamed ${category} “${from}” to “${t}”`, () => {
            const rel = relabel(data(), category, from, t)
            set({ ...rel, taxonomy: rel.taxonomy.map((x) => (x.category === category && x.term === from ? { ...x, term: t } : x)) })
          })
        },
        mergeTerm: (category, from, into) => tracked('taxonomy', `Merged ${category} “${from}” into “${into}”`, () => doMerge(category, from, into)),
        deleteTerm: (category, term) => tracked('taxonomy', `Deleted ${category} “${term}”`, () => doDelete(category, term)),
        setParent: (category, term, parent) =>
          tracked('taxonomy', `Moved ${category} “${term}” under ${parent || 'nothing'}`, () =>
            set((s) => ({ taxonomy: s.taxonomy.map((x) => (x.category === category && x.term === term ? { ...x, parent } : x)) })),
          ),
        setLayer: (toolType, layer) =>
          tracked('mapping', `Mapped ${CAT.toolType} “${toolType}” to ${layer}`, () =>
            set((s) => ({ taxonomy: s.taxonomy.map((x) => (x.category === CAT.toolType && x.term === toolType ? { ...x, parent: layer } : x)) })),
          ),

        importRows: (input) => {
          const { state, importId } = runImport(data(), input)
          set({ ...state })
          logged(`Reconciled ${plural(input.rows.length, 'row')} from ${input.source}`)
          return importId
        },
        confirmFuzzy: (recordId, toolId) => {
          const rec = get().sourceRecords.find((r) => r.id === recordId)
          if (!rec) return
          set((s) => ({
            sourceRecords: s.sourceRecords.map((r) => (r.id === recordId ? { ...r, matchedToolId: toolId, resolution: 'accepted' } : r)),
          }))
          get().addAlias(toolId, rec.rawName, rec.source)
          const tool = get().tools.find((t) => t.id === toolId)
          resolveRecordIssues(recordId, [NAME_MISMATCH], `Confirmed — “${rec.rawName}” saved as an alias of ${tool?.name ?? 'tool'}`)
          afterRecordChange(recordId)
        },
        rejectFuzzy: (recordId) => {
          const rec = get().sourceRecords.find((r) => r.id === recordId)
          if (!rec) return
          set((s) => ({
            sourceRecords: s.sourceRecords.map((r) => (r.id === recordId ? { ...r, matchedToolId: undefined, matchType: 'unmatched', resolution: 'pending' } : r)),
          }))
          resolveRecordIssues(recordId, [NAME_MISMATCH], 'Not a match')
          set((s) => ({
            issues: [
              ...s.issues,
              { id: uid('iss'), type: MISSING_IN_MASTER, source: rec.source, sourceRecordId: rec.id, detail: `“${rec.rawName}” is in ${rec.source} but not in the master list`, status: 'Open', createdOn: today() },
            ],
          }))
          logged(`Marked “${rec.rawName}” (${rec.source}) as not a match`)
          afterRecordChange(recordId)
        },
        createFromRecord: (recordId, tool) => {
          const id = get().createTool(tool)
          set((s) => ({ sourceRecords: s.sourceRecords.map((r) => (r.id === recordId ? { ...r, matchedToolId: id, resolution: 'created' } : r)) }))
          const rec = get().sourceRecords.find((r) => r.id === recordId)
          if (rec && rec.rawName !== tool.name) get().addAlias(id, rec.rawName, rec.source)
          resolveRecordIssues(recordId, [MISSING_IN_MASTER], `Created as new tool “${tool.name}”`)
          afterRecordChange(recordId)
          return id
        },
        ignoreRecord: (recordId) => {
          const rec = get().sourceRecords.find((r) => r.id === recordId)
          set((s) => ({ sourceRecords: s.sourceRecords.map((r) => (r.id === recordId ? { ...r, resolution: 'ignored' } : r)) }))
          resolveRecordIssues(recordId, [MISSING_IN_MASTER], 'Ignored')
          if (rec) logged(`Ignored “${rec.rawName}” from ${rec.source}`)
          afterRecordChange(recordId)
        },
        resolveIssue: (id, resolution) => set((s) => ({ issues: s.issues.map((i) => (i.id === id ? { ...i, status: 'Resolved', resolution } : i)) })),
        reopenIssue: (id) => set((s) => ({ issues: s.issues.map((i) => (i.id === id ? { ...i, status: 'Open', resolution: undefined } : i)) })),

        undoChange: (id) => {
          const s = get()
          const idx = s.history.findIndex((h) => h.id === id)
          const ev = s.history[idx]
          if (!ev) return 'That change is no longer in the history.'
          if (!ev.patch) return 'This entry came with the demo data and has no undo record.'
          if (ev.undone) return 'Already undone.'
          const mine = touched(ev.patch)
          // Later changes are earlier in the list. Undo is refused if one of them touched the same items.
          const later = s.history.slice(0, idx).find((h) => h.patch && !h.undone && [...touched(h.patch)].some((k) => mine.has(k)))
          if (later) return `Undo “${later.summary}” first. It changed the same items.`
          set({ ...revert(data(), ev.patch) })
          const by = currentActor()
          set((st) => ({ history: st.history.map((h) => (h.id === id ? { ...h, undone: { at: new Date().toISOString(), by } } : h)) }))
          return null
        },
        requestApproval: (action) => {
          const st = data()
          const impact = action.kind === 'merge' ? impactSentence(termImpact(st, action.category, action.term), 're-point') : impactSentence(termImpact(st, action.category, action.term), 'affect')
          set((s) => ({ approvals: [{ id: uid('apr'), at: new Date().toISOString(), requestedBy: currentActor(), action, impact, status: 'Pending' }, ...s.approvals] }))
        },
        decideApproval: (id, approve, note) => {
          const a = get().approvals.find((x) => x.id === id)
          if (!a || a.status !== 'Pending') return
          const by = currentActor()
          if (approve) {
            const act = a.action
            if (act.kind === 'merge') tracked('taxonomy', `Merged ${act.category} “${act.term}” into “${act.into}” (requested by ${a.requestedBy})`, () => doMerge(act.category, act.term, act.into), { approvedBy: by })
            else tracked('taxonomy', `Deleted ${act.category} “${act.term}” (requested by ${a.requestedBy})`, () => doDelete(act.category, act.term), { approvedBy: by })
          }
          set((s) => ({ approvals: s.approvals.map((x) => (x.id === id ? { ...x, status: approve ? 'Approved' : 'Rejected', decidedBy: by, decidedAt: new Date().toISOString(), note } : x)) }))
        },
        addFeedRun: (run) => set((s) => ({ feedRuns: [{ ...run, id: uid('feed') }, ...s.feedRuns].slice(0, 30) })),
      }
    },
    {
      name: STORAGE_KEY,
      version: 3,
      migrate: (persisted, version) => migrateState(persisted, version) as DataState,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): DataState => pickData(s),
    },
  ),
)

export function hasPersistedState(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !('state' in parsed)) return false
    const st = (parsed as { state: Partial<DataState> }).state
    return Array.isArray(st.tools) && st.tools.length > 0
  } catch {
    return false
  }
}

export function useLayerMap() {
  const taxonomy = useStore((s) => s.taxonomy)
  return useMemo(() => layerMap(taxonomy), [taxonomy])
}

/** The store's data (no actions), for pure helpers such as graph and pivot. */
export function useDataState(): DataState {
  return useStore(useShallow((s) => pickData(s)))
}
