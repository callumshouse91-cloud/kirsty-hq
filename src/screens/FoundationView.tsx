import { AlertTriangle, CornerDownRight, Layers, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LayerBadge, ToolLink, ToolPicker, VendorFlag } from '../components/common'
import { Badge, Button, Card, EmptyState, Label, Modal, PageHeader, Select, Td, Th } from '../components/ui'
import { allocateCost, directDependentCounts, foundationReach, upstream } from '../lib/graph'
import { CAT, layerOf, termsOf } from '../lib/taxonomy'
import { byName, fmtK, plural } from '../lib/util'
import { navigate, useRoute } from '../router'
import { useDataState, useLayerMap, useStore } from '../store'
import { useUi } from '../ui-store'

function AddDependencyModal({ foundationId, onClose }: { foundationId: string; onClose: () => void }) {
  const s = useStore()
  const notify = useUi((u) => u.notify)
  const directions = [...new Set(s.dependencies.map((d) => d.direction))].sort()
  const [direction, setDirection] = useState(directions.includes('Reads') ? 'Reads' : directions[0] ?? 'Reads')
  const foundation = s.tools.find((t) => t.id === foundationId)
  const exclude = new Set([foundationId, ...s.dependencies.filter((d) => d.foundationId === foundationId).map((d) => d.appId)])
  return (
    <Modal open onClose={onClose} title={`Add an application that sits on ${foundation?.name}`} width="max-w-xl">
      <div className="mb-3 flex items-center gap-2">
        <Label className="mb-0">Direction</Label>
        <Select value={direction} onChange={(e) => setDirection(e.target.value)} className="h-7 text-xs">
          {(directions.length ? directions : ['Reads', 'Writes', 'Both']).map((d) => (
            <option key={d}>{d}</option>
          ))}
        </Select>
      </div>
      <ToolPicker
        placeholder="Search applications…"
        exclude={exclude}
        filter={(_t, layer) => layer === 'Application'}
        onPick={(t) => {
          s.addDependency(t.id, foundationId, direction)
          notify(`${t.name} now depends on ${foundation?.name}`)
          onClose()
        }}
      />
    </Modal>
  )
}

export function FoundationView() {
  const route = useRoute()
  const state = useDataState()
  const lm = useLayerMap()
  const removeDependency = useStore((s) => s.removeDependency)
  const [adding, setAdding] = useState(false)

  const foundations = useMemo(() => state.tools.filter((t) => layerOf(t, lm) === 'Foundation').sort(byName), [state.tools, lm])
  const counts = useMemo(() => directDependentCounts(state), [state])
  const fallback = useMemo(() => [...foundations].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0], [foundations, counts])
  const requested = route.params.get('id')
  const foundation = state.tools.find((t) => t.id === requested) ?? fallback

  const reach = useMemo(() => (foundation ? foundationReach(state, foundation.id) : null), [state, foundation])
  const all = useMemo(() => (foundation ? upstream(state, foundation.id) : []), [state, foundation])
  const alloc = useMemo(() => (foundation && reach ? allocateCost(foundation.costK, reach) : null), [foundation, reach])

  if (!foundation || !reach || !alloc) {
    return (
      <>
        <PageHeader title="Foundation View" />
        <EmptyState icon={<Layers size={28} />} title="No foundations yet" hint="Foundations are tools whose Kirsty Cat maps to the Foundation layer. Check the mapping in Taxonomy → Layer mapping." />
      </>
    )
  }

  const critical = termsOf(state.taxonomy, CAT.criticality)[0]
  const criticalUsages = reach.usages.filter((u) => u.criticality === critical)
  const apps = all.filter((c) => c.layer === 'Application')
  const isFoundation = layerOf(foundation, lm) === 'Foundation'
  const directDeps = state.dependencies.filter((d) => d.foundationId === foundation.id)
  const allocated = [...alloc.byDesk.values()].reduce((a, b) => a + b, 0)
  const unallocated = Math.max(0, foundation.costK - allocated)

  return (
    <>
      <PageHeader
        title="Foundation View"
        description="What sits on a foundation, who reaches it, and what it costs them."
        actions={
          <Select value={foundation.id} onChange={(e) => navigate('foundation', { id: e.target.value })} className="min-w-64 font-medium" aria-label="Foundation">
            {!isFoundation && <option value={foundation.id}>{foundation.name} (Application)</option>}
            {foundations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          title={<ToolLink id={foundation.id} className="text-[15px]" />}
          subtitle="Click the name to edit its details"
          actions={
            <>
              <LayerBadge layer={layerOf(foundation, lm)} />
              <VendorFlag v={foundation.vendor} />
            </>
          }
        >
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-4">
            {[
              [CAT.kirstyCat, foundation.kirstyCat],
              [CAT.capL2, foundation.capL2],
              [CAT.capL3, foundation.capL3],
              [CAT.users, foundation.users],
              ['Ownership', foundation.ownership],
              ['Inv user group', foundation.invUserGroup],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{k}</dt>
                <dd className="mt-0.5 text-slate-800">{v || <span className="text-slate-300">—</span>}</dd>
              </div>
            ))}
            <div className="col-span-2">
              <dt className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Est annual cost</dt>
              <dd className="num mt-0.5 text-xl font-semibold text-slate-900">{fmtK(foundation.costK)}</dd>
            </div>
          </dl>
        </Card>

        <section className="rounded-lg border border-red-200 bg-red-50/60 p-4">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold text-red-800">
            <AlertTriangle size={16} /> What breaks if this goes away
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              [apps.length, 'applications'],
              [reach.desks.size, 'desks'],
              [criticalUsages.length, `${critical ?? 'critical'} usages`.toLowerCase()],
            ].map(([n, l]) => (
              <div key={String(l)} className="rounded-md bg-white px-2.5 py-2 ring-1 ring-red-100">
                <div className="num text-2xl font-semibold text-red-700">{n}</div>
                <div className="text-[11px] leading-tight text-slate-600">{l}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-red-900/70">
            {reach.usages.length > 0
              ? `${plural(reach.usages.length, 'desk/strategy usage')} across ${plural([...reach.desks.values()].reduce((a, s) => a + s.size, 0), 'strategy', 'strategies')} reach this foundation directly or through the applications on top of it.`
              : 'No desk reaches this foundation yet.'}
          </p>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card
          title="Applications that depend on it"
          subtitle={`${plural(directDeps.length, 'direct link')}${all.length > directDeps.length ? ` · ${all.length - directDeps.length} more indirectly` : ''}`}
          actions={
            <Button size="sm" icon={<Plus size={13} />} onClick={() => setAdding(true)}>
              Add dependency
            </Button>
          }
          bodyClassName="p-0"
        >
          {all.length === 0 ? (
            <div className="p-4">
              <EmptyState title="Nothing depends on this yet" hint="Use “Add dependency” to link the applications that sit on it." />
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <Th>Tool</Th>
                  <Th>Link</Th>
                  <Th right>Desks</Th>
                  <Th right>Cost</Th>
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {all.map((c) => {
                  const dep = directDeps.find((d) => d.appId === c.tool.id)
                  return (
                    <tr key={c.tool.id} className="hover:bg-slate-50">
                      <Td>
                        <div className="flex items-center gap-2">
                          <ToolLink id={c.tool.id} />
                          {c.layer === 'Foundation' && <LayerBadge layer="Foundation" />}
                        </div>
                      </Td>
                      <Td className="text-xs text-slate-500">
                        {c.via.length === 0 ? (
                          <span>
                            Direct · <span className="text-slate-700">{c.direction}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <CornerDownRight size={12} /> via {c.via.map((v) => v.name).join(' → ')}
                          </span>
                        )}
                      </Td>
                      <Td right>{new Set(c.usages.map((u) => u.desk)).size || <span className="text-slate-300">0</span>}</Td>
                      <Td right>{fmtK(c.tool.costK)}</Td>
                      <Td>
                        {dep && (
                          <button className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-700" title="Remove this dependency link" aria-label={`Remove link from ${c.tool.name}`} onClick={() => removeDependency(dep.id)}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Desks and strategies that reach it" subtitle={plural(reach.desks.size, 'desk')}>
          {reach.desks.size === 0 ? (
            <p className="text-xs text-slate-500">No desk usage reaches this foundation.</p>
          ) : (
            <ul className="space-y-2.5">
              {termsOf(state.taxonomy, CAT.desk)
                .filter((d) => reach.desks.has(d))
                .concat([...reach.desks.keys()].filter((d) => !termsOf(state.taxonomy, CAT.desk).includes(d)))
                .map((d) => (
                  <li key={d}>
                    <button type="button" className="text-[13px] font-medium text-slate-800 hover:text-accent-700 hover:underline" onClick={() => navigate('desk', { desk: d, sitsOn: '1' })}>
                      {d}
                    </button>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[...reach.desks.get(d)!].map((st) => (
                        <Badge key={st}>{st}</Badge>
                      ))}
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Dependency tree" subtitle="Foundation → what sits on it → desks">
          {reach.consumers.length === 0 && reach.directUsages.length === 0 ? (
            <p className="text-xs text-slate-500">Nothing to show yet.</p>
          ) : (
            <div className="text-[13px]">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-700" />
                {foundation.name}
              </div>
              <ul className="mt-1 ml-1 border-l border-slate-200 pl-4">
                {reach.directUsages.length > 0 && (
                  <li className="relative py-1 before:absolute before:top-3.5 before:-left-4 before:w-3 before:border-t before:border-slate-200">
                    <span className="text-xs font-medium text-slate-600">Used directly by</span>
                    <span className="ml-2 inline-flex flex-wrap gap-1">
                      {[...new Set(reach.directUsages.map((u) => u.desk))].map((d) => (
                        <Badge key={d} tone="accent">
                          {d}
                        </Badge>
                      ))}
                    </span>
                  </li>
                )}
                {reach.consumers.map((c) => {
                  const desks = [...new Set(c.usages.map((u) => u.desk))]
                  return (
                    <li key={c.tool.id} className="relative py-1 before:absolute before:top-3.5 before:-left-4 before:w-3 before:border-t before:border-slate-200">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${c.layer === 'Application' ? 'bg-accent-500' : 'bg-slate-500'}`} />
                        <ToolLink id={c.tool.id} />
                        {c.via.length > 0 && <span className="text-xs text-slate-400">via {c.via.map((v) => v.name).join(' → ')}</span>}
                      </div>
                      <div className="mt-1 ml-4 flex flex-wrap gap-1">
                        {desks.length === 0 ? (
                          <span className="text-xs text-slate-400">no desk usage recorded</span>
                        ) : (
                          desks.map((d) => (
                            <Badge key={d} tone="accent">
                              {d}
                            </Badge>
                          ))
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </Card>

        <Card title="Cost roll-up" subtitle="even allocation — illustrative">
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-2">
            <span className="text-xs text-slate-500">This foundation</span>
            <span className="num text-lg font-semibold text-slate-900">{fmtK(foundation.costK)}</span>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Split evenly across {plural(reach.consumers.length, 'consumer')}
            {reach.directUsages.length ? ' plus direct desk usage' : ''}, then evenly across the desks using each one.
          </p>
          {alloc.byDesk.size === 0 ? (
            <p className="mt-3 text-xs text-slate-500">No desks to allocate to.</p>
          ) : (
            <table className="mt-2 w-full text-[13px]">
              <tbody>
                {[...alloc.byDesk.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([d, v]) => (
                    <tr key={d}>
                      <td className="py-1 text-slate-700">{d}</td>
                      <td className="w-24 py-1">
                        <div className="h-1.5 rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-accent-500" style={{ width: `${(v / foundation.costK) * 100}%` }} />
                        </div>
                      </td>
                      <td className="num py-1 pl-2 text-right text-slate-800">{fmtK(Math.round(v * 10) / 10)}</td>
                    </tr>
                  ))}
                {unallocated > 0.05 && (
                  <tr>
                    <td className="py-1 text-slate-400 italic" colSpan={2}>
                      Unallocated (no desk usage)
                    </td>
                    <td className="num py-1 pl-2 text-right text-slate-400">{fmtK(Math.round(unallocated * 10) / 10)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
          <p className="mt-3 rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800">Even allocation — illustrative. Not a chargeback.</p>
        </Card>
      </div>

      {adding && <AddDependencyModal foundationId={foundation.id} onClose={() => setAdding(false)} />}
    </>
  )
}
