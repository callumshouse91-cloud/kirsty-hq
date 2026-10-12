import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { useShallow } from 'zustand/react/shallow'
import { ATTESTED, NOT_ATTESTED, type DataState, type Layer, type Tool } from './types'
import { MISSING_IN_MASTER, NAME_MISMATCH, recomputeMissing, refreshLog, runImport, type ImportInput } from './lib/reconcile'
import { migrateState } from './lib/migrate'
import { loadSeed } from './lib/seed'
import { CAT, layerMap, relabel } from './lib/taxonomy'
import { slugify, today, uid, uniqueId } from './lib/util'

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
}

export type Store = DataState & Actions

function newToolId(state: DataState, name: string): string {
  return uniqueId(slugify(name), new Set(state.tools.map((t) => t.id)))
}

export const useStore = create<Store>()(
  persist(
    (set, get) => {
      const data = (): DataState => {
        const s = get()
        return {
          tools: s.tools,
          categories: s.categories,
          taxonomy: s.taxonomy,
          usages: s.usages,
          dependencies: s.dependencies,
          sourceRecords: s.sourceRecords,
          aliases: s.aliases,
          issues: s.issues,
          imports: s.imports,
        }
      }

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

      return {
        ...EMPTY,

        hydrateFrom: (s) => set({ ...s }),
        resetToSeed: async () => {
          const seed = await loadSeed()
          set({ ...seed })
        },

        updateTool: (id, patch) => set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
        createTool: (t) => {
          const id = newToolId(data(), t.name)
          set((s) => ({ tools: [...s.tools, { ...t, id }] }))
          return id
        },
        addAlias: (toolId, alias, source) => {
          const a = alias.trim()
          if (!a) return
          set((s) => {
            if (s.aliases.some((x) => x.toolId === toolId && x.alias.toLowerCase() === a.toLowerCase())) return s
            return { aliases: [...s.aliases, { id: uid('al'), toolId, alias: a, source }] }
          })
        },
        removeAlias: (id) => set((s) => ({ aliases: s.aliases.filter((a) => a.id !== id) })),

        addUsage: (desk, strategy, toolId, criticality) =>
          set((s) => {
            if (s.usages.some((u) => u.desk === desk && u.strategy === strategy && u.toolId === toolId)) return s
            return { usages: [...s.usages, { id: uid('use'), desk, strategy, toolId, criticality, attestation: NOT_ATTESTED, attestedOn: '' }] }
          }),
        removeUsage: (id) => set((s) => ({ usages: s.usages.filter((u) => u.id !== id) })),
        setCriticality: (id, c) => set((s) => ({ usages: s.usages.map((u) => (u.id === id ? { ...u, criticality: c } : u)) })),
        attest: (ids) => {
          const d = today()
          const set_ = new Set(ids)
          set((s) => ({ usages: s.usages.map((u) => (set_.has(u.id) ? { ...u, attestation: ATTESTED, attestedOn: d } : u)) }))
        },

        addDependency: (appId, foundationId, direction) =>
          set((s) => {
            if (appId === foundationId || s.dependencies.some((d) => d.appId === appId && d.foundationId === foundationId)) return s
            return { dependencies: [...s.dependencies, { id: uid('dep'), appId, foundationId, direction }] }
          }),
        removeDependency: (id) => set((s) => ({ dependencies: s.dependencies.filter((d) => d.id !== id) })),

        addCategory: (name) =>
          set((s) => {
            const n = name.trim()
            if (!n || s.categories.some((c) => c.toLowerCase() === n.toLowerCase())) return s
            return { categories: [...s.categories, n] }
          }),
        addTerm: (category, term, parent) =>
          set((s) => {
            const t = term.trim()
            if (!t || s.taxonomy.some((x) => x.category === category && x.term.toLowerCase() === t.toLowerCase())) return s
            return { taxonomy: [...s.taxonomy, { id: uid('tax'), category, term: t, parent }] }
          }),
        renameTerm: (category, from, to) => {
          const t = to.trim()
          if (!t || t === from) return
          const s = data()
          const rel = relabel(s, category, from, t)
          set({ ...rel, taxonomy: rel.taxonomy.map((x) => (x.category === category && x.term === from ? { ...x, term: t } : x)) })
        },
        mergeTerm: (category, from, into) => {
          if (from === into) return
          const rel = relabel(data(), category, from, into)
          set({ ...rel, taxonomy: rel.taxonomy.filter((x) => !(x.category === category && x.term === from)) })
        },
        deleteTerm: (category, term) => set((s) => ({ taxonomy: s.taxonomy.filter((x) => !(x.category === category && x.term === term)) })),
        setParent: (category, term, parent) =>
          set((s) => ({ taxonomy: s.taxonomy.map((x) => (x.category === category && x.term === term ? { ...x, parent } : x)) })),
        setLayer: (toolType, layer) =>
          set((s) => ({ taxonomy: s.taxonomy.map((x) => (x.category === CAT.toolType && x.term === toolType ? { ...x, parent: layer } : x)) })),

        importRows: (input) => {
          const { state, importId } = runImport(data(), input)
          set({ ...state })
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
          afterRecordChange(recordId)
        },
        createFromRecord: (recordId, tool) => {
          const id = get().createTool(tool)
          set((s) => ({ sourceRecords: s.sourceRecords.map((r) => (r.id === recordId ? { ...r, matchedToolId: id, resolution: 'created' } : r)) }))
          resolveRecordIssues(recordId, [MISSING_IN_MASTER], `Created as new tool “${tool.name}”`)
          afterRecordChange(recordId)
          return id
        },
        ignoreRecord: (recordId) => {
          set((s) => ({ sourceRecords: s.sourceRecords.map((r) => (r.id === recordId ? { ...r, resolution: 'ignored' } : r)) }))
          resolveRecordIssues(recordId, [MISSING_IN_MASTER], 'Ignored')
          afterRecordChange(recordId)
        },
        resolveIssue: (id, resolution) => set((s) => ({ issues: s.issues.map((i) => (i.id === id ? { ...i, status: 'Resolved', resolution } : i)) })),
        reopenIssue: (id) => set((s) => ({ issues: s.issues.map((i) => (i.id === id ? { ...i, status: 'Open', resolution: undefined } : i)) })),
      }
    },
    {
      name: STORAGE_KEY,
      version: 2,
      migrate: (persisted, version) => migrateState(persisted, version) as DataState,
      storage: createJSONStorage(() => localStorage),
      partialize: (s): DataState => ({
        tools: s.tools,
        categories: s.categories,
        taxonomy: s.taxonomy,
        usages: s.usages,
        dependencies: s.dependencies,
        sourceRecords: s.sourceRecords,
        aliases: s.aliases,
        issues: s.issues,
        imports: s.imports,
      }),
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
  return useStore(
    useShallow((s) => ({
      tools: s.tools,
      categories: s.categories,
      taxonomy: s.taxonomy,
      usages: s.usages,
      dependencies: s.dependencies,
      sourceRecords: s.sourceRecords,
      aliases: s.aliases,
      issues: s.issues,
      imports: s.imports,
    })),
  )
}
