import { ArrowRightLeft, Check, GitMerge, Pencil, Plus, Tags, Trash2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { LayerBadge } from '../components/common'
import { Badge, Button, cx, EmptyState, Input, Modal, PageHeader, Segmented, Select, Tabs, Td, Th } from '../components/ui'
import { bindingFor, CAT, layerMap, layerOf, parentCategory, termImpact, termsOf, type TermImpact } from '../lib/taxonomy'
import { plural } from '../lib/util'
import { navigate, patchParams, useRoute } from '../router'
import { useDataState, useStore } from '../store'
import { LAYERS, type Layer } from '../types'
import { useUi } from '../ui-store'

/** Pivot field id for a category, so counts can drill into the Explorer. */
function pivotFieldFor(category: string): string {
  const b = bindingFor(category)
  if (b.kind === 'custom') return `custom:${category}`
  return b.field
}

function impactSentence(i: TermImpact, verb: string): string {
  const parts = [plural(i.tools.length, 'tool')]
  if (i.usages.length) parts.push(plural(i.usages.length, 'usage row'))
  let s = `This will ${verb} ${parts.join(' and ')}`
  if (i.children.length) s += `, and re-point ${plural(i.children.length, 'child term')}`
  return `${s}.`
}

type Pending =
  | { kind: 'rename'; term: string; to: string; impact: TermImpact }
  | { kind: 'merge'; term: string; into: string; impact: TermImpact }
  | { kind: 'delete'; term: string; impact: TermImpact }
  | { kind: 'layer'; term: string; to: Layer; count: number; from: Layer }

function UsedBy({ category, term, impact }: { category: string; term: string; impact: TermImpact }) {
  const openCell = useUi((s) => s.openCell)
  if (!impact.tools.length && !impact.usages.length && !impact.children.length) return <span className="text-xs text-slate-400">Not used</span>
  return (
    <span className="flex items-center gap-x-2 text-xs whitespace-nowrap">
      {impact.tools.length > 0 && (
        <button type="button" className="font-medium text-accent-700 hover:underline" onClick={() => openCell({ title: `Tools using “${term}”`, subtitle: category, toolIds: impact.tools.map((t) => t.id) })}>
          {plural(impact.tools.length, 'tool')}
        </button>
      )}
      {impact.usages.length > 0 && <span className="text-slate-500">{plural(impact.usages.length, 'usage')}</span>}
      {impact.children.length > 0 && <span className="text-slate-500">{plural(impact.children.length, 'strategy', 'strategies')}</span>}
      <button type="button" className="text-slate-400 hover:text-accent-700 hover:underline" onClick={() => navigate('explorer', { rows: category === CAT.capL2 ? 'capL3' : 'capL2', col: 'none', where: `${pivotFieldFor(category)}:${term}` })}>
        Explore
      </button>
    </span>
  )
}

function TermsPanel({ category }: { category: string }) {
  const state = useDataState()
  const s = useStore()
  const notify = useUi((u) => u.notify)
  const openCell = useUi((u) => u.openCell)
  const terms = state.taxonomy.filter((t) => t.category === category)
  const parentCat = parentCategory(category)
  const parentTerms = parentCat ? termsOf(state.taxonomy, parentCat) : []
  const isKirsty = category === CAT.kirstyCat
  const hasNotes = !parentCat && !isKirsty && terms.some((t) => t.parent)
  const lm = layerMap(state.taxonomy)

  const [newTerm, setNewTerm] = useState('')
  const [newParent, setNewParent] = useState(parentTerms[0] ?? '')
  const [editing, setEditing] = useState<{ term: string; value: string } | null>(null)
  const [mergeFrom, setMergeFrom] = useState<string | null>(null)
  const [mergeInto, setMergeInto] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)

  const commitRename = () => {
    if (!editing) return
    const to = editing.value.trim()
    if (!to || to === editing.term) return setEditing(null)
    if (terms.some((t) => t.term.toLowerCase() === to.toLowerCase() && t.term !== editing.term)) {
      notify(`“${to}” already exists — use Merge instead`)
      return
    }
    setPending({ kind: 'rename', term: editing.term, to, impact: termImpact(state, category, editing.term) })
  }

  const confirm = () => {
    if (!pending) return
    if (pending.kind === 'rename') {
      s.renameTerm(category, pending.term, pending.to)
      notify(`Renamed “${pending.term}” to “${pending.to}”`)
      setEditing(null)
    } else if (pending.kind === 'merge') {
      s.mergeTerm(category, pending.term, pending.into)
      notify(`Merged “${pending.term}” into “${pending.into}”`)
      setMergeFrom(null)
    } else if (pending.kind === 'delete') {
      s.deleteTerm(category, pending.term)
      notify(`Deleted “${pending.term}”`)
    }
    setPending(null)
  }

  const inUse = (i: TermImpact) => i.tools.length + i.usages.length + i.children.length > 0

  let modalBody: ReactNode = null
  let modalTitle = ''
  let confirmLabel = 'Confirm'
  let blocked = false
  if (pending?.kind === 'rename') {
    modalTitle = `Rename “${pending.term}” to “${pending.to}”`
    modalBody = <p>{impactSentence(pending.impact, 're-label')}</p>
    confirmLabel = 'Rename'
  } else if (pending?.kind === 'merge') {
    modalTitle = `Merge “${pending.term}” into “${pending.into}”`
    modalBody = (
      <>
        <p>{impactSentence(pending.impact, `re-point`)}</p>
        <p className="mt-2 text-slate-500">“{pending.term}” will be removed. Anything already using “{pending.into}” is unchanged.</p>
      </>
    )
    confirmLabel = 'Merge'
  } else if (pending?.kind === 'delete') {
    blocked = inUse(pending.impact)
    modalTitle = blocked ? `Can’t delete “${pending.term}” yet` : `Delete “${pending.term}”?`
    modalBody = blocked ? (
      <>
        <p>
          It’s still in use: {impactSentence(pending.impact, 'affect').replace(/^This will affect /, '').replace(/\.$/, '')}. Re-label them or merge this term into another first.
        </p>
        {pending.impact.tools.length > 0 && (
          <Button
            variant="link"
            className="mt-2"
            onClick={() => {
              openCell({ title: `Tools using “${pending.term}”`, subtitle: category, toolIds: pending.impact.tools.map((t) => t.id) })
              setPending(null)
            }}
          >
            View the {plural(pending.impact.tools.length, 'affected tool')} →
          </Button>
        )}
      </>
    ) : (
      <p>Nothing uses this term. It will be removed from {category}.</p>
    )
    confirmLabel = 'Delete'
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{category}</h2>
          <p className="text-xs text-slate-500">
            {plural(terms.length, 'term')}
            {parentCat && ` · each belongs to a ${parentCat}`}
            {isKirsty && ' · Parent sets the layer (see Layer mapping)'}
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!newTerm.trim()) return
            if (terms.some((t) => t.term.toLowerCase() === newTerm.trim().toLowerCase())) return notify(`“${newTerm.trim()}” already exists`)
            s.addTerm(category, newTerm, parentCat ? newParent : isKirsty ? 'Application' : '')
            notify(`Added “${newTerm.trim()}” to ${category}`)
            setNewTerm('')
          }}
        >
          <Input value={newTerm} onChange={(e) => setNewTerm(e.target.value)} placeholder={`New ${category} term…`} className="w-52" />
          {parentCat && (
            <Select value={newParent} onChange={(e) => setNewParent(e.target.value)} aria-label={parentCat}>
              {parentTerms.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
          )}
          <Button type="submit" variant="primary" icon={<Plus size={14} />} disabled={!newTerm.trim()}>
            Add term
          </Button>
        </form>
      </div>

      {terms.length === 0 ? (
        <EmptyState icon={<Tags size={26} />} title="No terms yet" hint={`Add the first ${category} term above, then pick it on any tool’s detail panel.`} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <Th>Term</Th>
                {parentCat && <Th>{parentCat}</Th>}
                {isKirsty && <Th>Layer</Th>}
                {hasNotes && <Th>Note</Th>}
                <Th>Used by</Th>
                <Th right>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => {
                const impact = termImpact(state, category, t.term)
                const isEditing = editing?.term === t.term
                const isMerging = mergeFrom === t.term
                return (
                  <tr key={t.id} className="hover:bg-slate-50/70">
                    <Td className="w-[30%]">
                      {isEditing ? (
                        <form
                          className="flex items-center gap-1"
                          onSubmit={(e) => {
                            e.preventDefault()
                            commitRename()
                          }}
                        >
                          <Input autoFocus value={editing.value} onChange={(e) => setEditing({ term: t.term, value: e.target.value })} onKeyDown={(e) => e.key === 'Escape' && setEditing(null)} className="h-7 w-full" />
                          <button type="submit" className="rounded p-1 text-emerald-700 hover:bg-emerald-50" aria-label="Save rename">
                            <Check size={15} />
                          </button>
                          <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={() => setEditing(null)} aria-label="Cancel rename">
                            <X size={15} />
                          </button>
                        </form>
                      ) : (
                        <button type="button" className="group inline-flex items-center gap-1.5 font-medium text-slate-800" onClick={() => setEditing({ term: t.term, value: t.term })} title="Click to rename">
                          {t.term}
                          <Pencil size={12} className="text-slate-300 group-hover:text-slate-500" />
                        </button>
                      )}
                    </Td>
                    {parentCat && (
                      <Td>
                        <Select value={t.parent} onChange={(e) => s.setParent(category, t.term, e.target.value)} className="h-7 text-xs" aria-label={`${parentCat} for ${t.term}`}>
                          {!parentTerms.includes(t.parent) && <option value={t.parent}>{t.parent || '—'}</option>}
                          {parentTerms.map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </Select>
                      </Td>
                    )}
                    {isKirsty && (
                      <Td>
                        <LayerBadge layer={lm.get(t.term) ?? 'Application'} />
                      </Td>
                    )}
                    {hasNotes && <Td className="text-xs text-slate-500">{t.parent}</Td>}
                    <Td>
                      <UsedBy category={category} term={t.term} impact={impact} />
                    </Td>
                    <Td right className="whitespace-nowrap">
                      {isMerging ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-xs text-slate-500">into</span>
                          <Select autoFocus value={mergeInto} onChange={(e) => setMergeInto(e.target.value)} className="h-7 text-xs" aria-label="Merge into">
                            <option value="">Choose…</option>
                            {terms
                              .filter((x) => x.term !== t.term)
                              .map((x) => (
                                <option key={x.id}>{x.term}</option>
                              ))}
                          </Select>
                          <Button size="sm" variant="primary" disabled={!mergeInto} onClick={() => setPending({ kind: 'merge', term: t.term, into: mergeInto, impact })}>
                            Preview
                          </Button>
                          <button type="button" className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={() => setMergeFrom(null)} aria-label="Cancel merge">
                            <X size={14} />
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5">
                          <Button size="sm" variant="ghost" icon={<Pencil size={13} />} onClick={() => setEditing({ term: t.term, value: t.term })}>
                            Rename
                          </Button>
                          {terms.length > 1 && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<GitMerge size={13} />}
                              onClick={() => {
                                setMergeFrom(t.term)
                                setMergeInto('')
                              }}
                            >
                              Merge
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="hover:text-red-700" icon={<Trash2 size={13} />} onClick={() => setPending({ kind: 'delete', term: t.term, impact })}>
                            Delete
                          </Button>
                        </span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={!!pending && pending.kind !== 'layer'}
        onClose={() => setPending(null)}
        title={modalTitle}
        footer={
          blocked ? (
            <Button onClick={() => setPending(null)}>Close</Button>
          ) : (
            <>
              <Button onClick={() => setPending(null)}>Cancel</Button>
              <Button variant={pending?.kind === 'delete' ? 'danger' : 'primary'} onClick={confirm}>
                {confirmLabel}
              </Button>
            </>
          )
        }
      >
        <div className="text-[13px] text-slate-700">{modalBody}</div>
      </Modal>
    </div>
  )
}

function LayerMapping() {
  const state = useDataState()
  const setLayer = useStore((s) => s.setLayer)
  const notify = useUi((u) => u.notify)
  const openCell = useUi((u) => u.openCell)
  const lm = layerMap(state.taxonomy)
  const [pending, setPending] = useState<Extract<Pending, { kind: 'layer' }> | null>(null)
  const terms = termsOf(state.taxonomy, CAT.kirstyCat)
  const counts = LAYERS.map((l) => state.tools.filter((t) => layerOf(t, lm) === l).length)

  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-[13px] text-slate-600">
        Each {CAT.kirstyCat} decides a tool’s layer. <span className="font-medium text-slate-800">Applications</span> are what users see and use — they appear in Desk View.{' '}
        <span className="font-medium text-slate-800">Foundations</span> are what applications sit on — they appear in Foundation View.
      </p>
      <div className="mb-3 flex gap-4 text-xs text-slate-500">
        {LAYERS.map((l, i) => (
          <span key={l}>
            <span className="num font-semibold text-slate-800">{counts[i]}</span> {l.toLowerCase()}s
          </span>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              <Th>{CAT.kirstyCat}</Th>
              <Th>Tools</Th>
              <Th right>Layer</Th>
            </tr>
          </thead>
          <tbody>
            {terms.map((term) => {
              const tools = state.tools.filter((t) => t.kirstyCat === term)
              const layer = lm.get(term) ?? 'Application'
              return (
                <tr key={term}>
                  <Td className="font-medium">{term}</Td>
                  <Td>
                    {tools.length ? (
                      <button type="button" className="text-xs font-medium text-accent-700 hover:underline" onClick={() => openCell({ title: `${CAT.kirstyCat}: ${term}`, subtitle: layer, toolIds: tools.map((t) => t.id) })}>
                        {plural(tools.length, 'tool')}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">No tools</span>
                    )}
                  </Td>
                  <Td right>
                    <Segmented size="sm" options={LAYERS.map((l) => ({ id: l, label: l }))} value={layer} onChange={(to) => to !== layer && setPending({ kind: 'layer', term, to, from: layer, count: tools.length })} />
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <Modal
        open={!!pending}
        onClose={() => setPending(null)}
        title={pending ? `Map “${pending.term}” to ${pending.to}?` : ''}
        footer={
          <>
            <Button onClick={() => setPending(null)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={() => {
                if (!pending) return
                setLayer(pending.term, pending.to)
                notify(`${pending.term} now maps to ${pending.to}`)
                setPending(null)
              }}
            >
              Change layer
            </Button>
          </>
        }
      >
        {pending && (
          <div className="text-[13px] text-slate-700">
            <p className="flex items-center gap-2">
              This will move {plural(pending.count, 'tool')} from <LayerBadge layer={pending.from} /> <ArrowRightLeft size={13} /> <LayerBadge layer={pending.to} />
            </p>
            <p className="mt-2 text-slate-500">
              {pending.to === 'Application' ? 'They will start showing in Desk View and leave the Foundation picker.' : 'They will be hidden from Desk View and become selectable in Foundation View.'}
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function TaxonomyScreen() {
  const route = useRoute()
  const state = useDataState()
  const addCategory = useStore((s) => s.addCategory)
  const notify = useUi((u) => u.notify)
  const [newCat, setNewCat] = useState('')
  const tab = route.params.get('tab') === 'mapping' ? 'mapping' : 'terms'
  const category = state.categories.includes(route.params.get('cat') ?? '') ? route.params.get('cat')! : state.categories[0]

  return (
    <>
      <PageHeader title="Taxonomy" description="The reference data behind every label in the app. Rename or merge a term and every tool and usage follows." />
      <div className="mb-4">
        <Tabs
          tabs={[
            { id: 'terms', label: 'Categories & terms' },
            { id: 'mapping', label: `Layer mapping (${CAT.kirstyCat} → Layer)` },
          ]}
          value={tab}
          onChange={(t) => patchParams(route, { tab: t === 'mapping' ? 'mapping' : null })}
        />
      </div>
      {tab === 'mapping' ? (
        <LayerMapping />
      ) : (
        <div className="grid grid-cols-[220px_minmax(0,1fr)] gap-5">
          <aside>
            <ul className="space-y-0.5">
              {state.categories.map((c) => {
                const n = state.taxonomy.filter((t) => t.category === c).length
                return (
                  <li key={c}>
                    <button
                      type="button"
                      onClick={() => patchParams(route, { cat: c })}
                      className={cx('flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-[13px]', c === category ? 'bg-accent-50 font-semibold text-accent-800' : 'text-slate-700 hover:bg-slate-100')}
                    >
                      <span className="truncate">{c}</span>
                      <Badge tone={c === category ? 'accent' : 'neutral'}>{n}</Badge>
                    </button>
                  </li>
                )
              })}
            </ul>
            <form
              className="mt-3 flex gap-1.5 border-t border-slate-200 pt-3"
              onSubmit={(e) => {
                e.preventDefault()
                const n = newCat.trim()
                if (!n) return
                if (state.categories.some((c) => c.toLowerCase() === n.toLowerCase())) return notify(`“${n}” already exists`)
                addCategory(n)
                setNewCat('')
                patchParams(route, { cat: n })
                notify(`Added category “${n}” — it now appears on every tool’s detail panel`)
              }}
            >
              <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category…" className="min-w-0 flex-1" />
              <Button type="submit" icon={<Plus size={14} />} disabled={!newCat.trim()} aria-label="Add category" />
            </form>
          </aside>
          {category ? <TermsPanel key={category} category={category} /> : <EmptyState title="No categories" hint="Add a category on the left to start building reference data." />}
        </div>
      )}
    </>
  )
}
