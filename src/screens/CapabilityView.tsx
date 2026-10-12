import { ChevronDown, ChevronRight, Copy, Download, Network, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { LayerBadge, ToolLink, VendorFlag } from '../components/common'
import { Badge, Button, Card, Chip, cx, EmptyState, PageHeader, Segmented, Select, Td, Th } from '../components/ui'
import { useFeature } from '../demo-store'
import { capabilityTree, capKey, capLabel, duplicateCaps, overlapCount, overlapThreshold, reachByTool, type CapNode } from '../lib/capability'
import { exportXlsx, type CellValue } from '../lib/export'
import { encodeWhere } from '../lib/pivot'
import { CAT, layerOf, termsOf } from '../lib/taxonomy'
import { fmtK, fmtNum, plural } from '../lib/util'
import { navigate, patchParams, useRoute } from '../router'
import { useDataState, useLayerMap } from '../store'
import { LAYERS, type Layer } from '../types'
import { useUi } from '../ui-store'

/** Threshold choices around the estate's own default, so a small or large list both read sensibly. */
function thresholdOptions(base: number): number[] {
  if (base <= 5) return [2, 3, 4, 5]
  return [...new Set([Math.round(base * 0.5), Math.round(base * 0.75), base, Math.round(base * 1.25)])]
}

function CostBar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <span className="inline-flex w-full items-center justify-end gap-2">
      <span className="num">{fmtK(value)}</span>
      <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full bg-accent-600/80 transition-[width] duration-300" style={{ width: `${w}%` }} />
      </span>
    </span>
  )
}

function Detail({ node, threshold }: { node: CapNode; threshold: number }) {
  const state = useDataState()
  const lm = useLayerMap()
  const openCell = useUi((u) => u.openCell)
  const { count, layer } = overlapCount(node)
  const dup = count >= threshold
  const typeOrder = termsOf(state.taxonomy, CAT.toolType)
  const byType = new Map<string, typeof node.tools>()
  for (const t of [...node.tools].sort((a, b) => b.costK - a.costK)) {
    const k = t.toolType || '(no type)'
    byType.set(k, [...(byType.get(k) ?? []), t])
  }
  const types = [...byType.keys()].sort((a, b) => typeOrder.indexOf(a) - typeOrder.indexOf(b))
  const reach = useMemo(() => reachByTool(state, lm), [state, lm])
  const deskCount = (id: string) => reach.get(id)?.size ?? 0

  return (
    <Card
      title={capLabel(node)}
      subtitle={`${plural(node.tools.length, 'tool')} · ${fmtK(node.cost)} a year · ${plural(node.desks.size, 'desk')}`}
      className="self-start lg:sticky lg:top-0"
      bodyClassName="p-0"
      actions={
        <Button
          size="sm"
          variant="ghost"
          icon={<Table2 size={13} />}
          title="Open this capability in Explorer, by desk"
          onClick={() => navigate('explorer', { rows: 'desk', col: 'toolType', measure: 'tools', where: encodeWhere([{ field: 'capL2', value: node.l2 }, { field: 'capL3', value: node.l3 }]) })}
        >
          Explorer
        </Button>
      }
    >
      {dup ? (
        <div className="flex gap-2.5 border-b border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
          <Copy size={16} className="mt-0.5 shrink-0" />
          <p>
            <span className="font-bold">{fmtNum(count)} {layer === 'Application' ? 'applications' : 'foundations'}</span> deliver this capability. Worth a look for overlap before the platform move.
          </p>
        </div>
      ) : (
        <p className="border-b border-slate-100 px-4 py-3 text-xs text-slate-500">No overlap at the current threshold ({threshold} or more tools of one layer).</p>
      )}
      <div className="max-h-[calc(100vh-330px)] overflow-y-auto scroll-thin">
        {types.map((ty) => (
          <div key={ty} className="border-b border-slate-100 last:border-0">
            <div className="flex items-center justify-between bg-panel px-4 py-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
              <span>
                {CAT.toolType}: {ty}
              </span>
              <LayerBadge layer={lm.get(ty) ?? 'Application'} />
            </div>
            <ul className="divide-y divide-slate-100">
              {byType.get(ty)!.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <ToolLink id={t.id} className="text-[13px]" />
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                      <VendorFlag v={t.vendor} />
                      <span>{plural(deskCount(t.id), 'desk')}{layerOf(t, lm) === 'Foundation' ? ' via apps' : ''}</span>
                    </div>
                  </div>
                  <span className="num text-[13px] font-semibold text-ink">{fmtK(t.costK)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 px-4 py-2.5">
        <Button variant="link" className="text-xs" onClick={() => openCell({ title: capLabel(node), subtitle: 'Capability', toolIds: node.tools.map((t) => t.id) })}>
          List all {plural(node.tools.length, 'tool')} with desks and cost →
        </Button>
      </div>
    </Card>
  )
}

export function CapabilityView() {
  const route = useRoute()
  const state = useDataState()
  const lm = useLayerMap()
  const openCell = useUi((u) => u.openCell)
  const notify = useUi((u) => u.notify)
  const exportsOn = useFeature('exports')
  const p = route.params
  const layer = (LAYERS as string[]).includes(p.get('layer') ?? '') ? (p.get('layer') as Layer) : null
  const baseThreshold = useMemo(() => overlapThreshold(capabilityTree(state, lm)), [state, lm])
  const options = thresholdOptions(baseThreshold)
  const asked = Number(p.get('dup'))
  const threshold = Number.isInteger(asked) && asked >= 2 ? asked : baseThreshold
  const THRESHOLDS = options.includes(threshold) ? options : [...options, threshold].sort((a, b) => a - b)
  const onlyDup = p.get('only') === '1'
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const tree = useMemo(() => capabilityTree(state, lm, layer), [state, lm, layer])
  const dups = useMemo(() => duplicateCaps(tree, threshold), [tree, threshold])
  const dupKeys = new Set(dups.map((d) => d.key))
  const all = tree.flatMap((g) => g.children)
  const selected = all.find((n) => n.key === p.get('sel')) ?? dups[0] ?? all[0]
  const maxCost = Math.max(0, ...tree.map((g) => g.cost))
  const totalTools = tree.reduce((s, g) => s + g.tools.length, 0)

  if (state.tools.length === 0) {
    return (
      <>
        <PageHeader title="Capability View" />
        <EmptyState icon={<Network size={28} />} title="No tools loaded" hint="Import a master list on Import & Reconcile, then come back to see tools by capability." />
      </>
    )
  }

  const exportView = () => {
    const rows: CellValue[][] = [[CAT.capL2, CAT.capL3, 'Tools', 'Applications', 'Foundations', 'Desks', 'Est annual cost (£k)', `Overlap (${threshold}+ of one layer)`, 'Tools in this capability']]
    for (const g of tree) {
      for (const n of g.children) {
        if (onlyDup && !dupKeys.has(n.key)) continue
        rows.push([n.l2, n.l3, n.tools.length, n.apps.length, n.foundations.length, n.desks.size, n.cost, dupKeys.has(n.key) ? 'Yes' : '', n.tools.map((t) => t.name).join('; ')])
      }
      if (!onlyDup) rows.push([`${g.l2} total`, '', g.tools.length, g.tools.filter((t) => layerOf(t, lm) === 'Application').length, g.tools.filter((t) => layerOf(t, lm) === 'Foundation').length, g.desks.size, g.cost, '', ''])
    }
    const file = exportXlsx('capability-view', [
      { name: 'Capabilities', rows },
      { name: 'View settings', rows: [['Layer', layer ?? 'All'], ['Overlap threshold', threshold], ['Overlaps only', onlyDup ? 'Yes' : 'No'], ['Figures', 'Estimated annual cost, illustrative']] },
    ])
    notify(`Downloaded ${file}`)
  }

  return (
    <>
      <PageHeader
        title="Capability View"
        description="Tools grouped by Cap L2 › Cap L3. Where several tools deliver the same capability, it is flagged."
        actions={
          exportsOn ? (
            <Button icon={<Download size={14} />} onClick={exportView}>
              Export
            </Button>
          ) : undefined
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          size="sm"
          options={[{ id: 'all', label: 'All tools' }, ...LAYERS.map((l) => ({ id: l, label: `${l}s` }))]}
          value={layer ?? 'all'}
          onChange={(v) => patchParams(route, { layer: v === 'all' ? null : v, sel: null })}
        />
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Flag overlap at
          <Select value={threshold} onChange={(e) => patchParams(route, { dup: e.target.value })} className="h-7 text-xs" aria-label="Overlap threshold">
            {THRESHOLDS.map((t) => (
              <option key={t} value={t}>
                {t}+ tools
              </option>
            ))}
          </Select>
        </label>
        <Chip active={onlyDup} onClick={() => patchParams(route, { only: onlyDup ? null : '1' })}>
          Overlaps only
        </Chip>
        <span className="ml-auto text-xs text-slate-500">
          <span className="num font-bold text-ink">{dups.length}</span> of {plural(all.length, 'capability', 'capabilities')} flagged · {plural(totalTools, 'tool')}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <Th>Capability</Th>
                <Th right>Tools</Th>
                <Th right>Apps</Th>
                <Th right>Fdns</Th>
                <Th right>Desks</Th>
                <Th right className="w-44">
                  Cost <span className="font-normal normal-case">(illustrative)</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {tree.map((g) => {
                const open = !collapsed.has(g.l2)
                const kids = onlyDup ? g.children.filter((n) => dupKeys.has(n.key)) : g.children
                if (onlyDup && kids.length === 0) return null
                const gApps = g.tools.filter((t) => layerOf(t, lm) === 'Application').length
                return [
                  <tr key={g.l2} className="bg-slate-50/70">
                    <Td>
                      <button
                        type="button"
                        className="flex items-center gap-1.5 font-bold text-ink"
                        onClick={() =>
                          setCollapsed((c) => {
                            const n = new Set(c)
                            if (n.has(g.l2)) n.delete(g.l2)
                            else n.add(g.l2)
                            return n
                          })
                        }
                      >
                        {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
                        {g.l2}
                        <span className="text-xs font-normal text-slate-400">{plural(g.children.length, 'capability', 'capabilities')}</span>
                      </button>
                    </Td>
                    <Td right>
                      <button type="button" className="font-bold text-accent-700 hover:underline" onClick={() => openCell({ title: g.l2, subtitle: CAT.capL2, toolIds: g.tools.map((t) => t.id) })}>
                        {g.tools.length}
                      </button>
                    </Td>
                    <Td right className="font-semibold">{gApps}</Td>
                    <Td right className="font-semibold">{g.tools.length - gApps}</Td>
                    <Td right className="font-semibold">{g.desks.size}</Td>
                    <Td right className="font-semibold">
                      <CostBar value={g.cost} max={maxCost} />
                    </Td>
                  </tr>,
                  ...(open
                    ? kids.map((n) => {
                        const isSel = selected?.key === n.key
                        const flagged = dupKeys.has(n.key)
                        return (
                          <tr
                            key={n.key}
                            onClick={() => patchParams(route, { sel: n.key })}
                            className={cx('cursor-pointer transition-colors', isSel ? 'bg-accent-50' : 'hover:bg-slate-50')}
                            aria-selected={isSel}
                          >
                            <Td className="pl-9">
                              <span className={cx('inline-flex items-center gap-2', isSel && 'font-bold text-navy')}>
                                {n.l3}
                                {flagged && (
                                  <Badge tone="amber" title="Several tools of one layer deliver this capability">
                                    <Copy size={10} /> {overlapCount(n).count} overlap
                                  </Badge>
                                )}
                              </span>
                            </Td>
                            <Td right>
                              <button
                                type="button"
                                className="text-accent-700 hover:underline"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openCell({ title: capLabel(n), subtitle: 'Capability', toolIds: n.tools.map((t) => t.id) })
                                }}
                              >
                                {n.tools.length}
                              </button>
                            </Td>
                            <Td right>{n.apps.length || <span className="text-slate-300">0</span>}</Td>
                            <Td right>{n.foundations.length || <span className="text-slate-300">0</span>}</Td>
                            <Td right>{n.desks.size || <span className="text-slate-300">0</span>}</Td>
                            <Td right>
                              <CostBar value={n.cost} max={maxCost} />
                            </Td>
                          </tr>
                        )
                      })
                    : []),
                ]
              })}
            </tbody>
          </table>
          {onlyDup && dups.length === 0 && <p className="px-4 py-6 text-center text-xs text-slate-500">No capability has {threshold} or more tools of one layer. Lower the threshold to see smaller overlaps.</p>}
        </div>
        {selected ? <Detail key={capKey(selected.l2, selected.l3)} node={selected} threshold={threshold} /> : <EmptyState title="Nothing selected" hint="Pick a capability on the left to see the tools behind it." />}
      </div>
    </>
  )
}
