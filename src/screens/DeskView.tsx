import { ChevronDown, ChevronRight, Download, FileSpreadsheet, Layers, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { AttestationBadge, FoundationLink, ToolLink, ToolPicker, useCriticalityTone, VendorFlag } from '../components/common'
import { Badge, Button, Card, cx, EmptyState, Input, Label, Modal, PageHeader, Select } from '../components/ui'
import { exportXlsx } from '../lib/export'
import { downstream } from '../lib/graph'
import { CAT, defaultCatFor, layerOf, termsOf } from '../lib/taxonomy'
import { fmtDate, fmtK, pct, plural } from '../lib/util'
import { usePermissions } from '../demo-store'
import { patchParams, useRoute } from '../router'
import { useDataState, useLayerMap, useStore } from '../store'
import { ATTESTED, type Tool, type Usage } from '../types'
import { useUi } from '../ui-store'

function AppCard({ usage, tool }: { usage: Usage; tool: Tool }) {
  const { setCriticality, attest, removeUsage } = useStore.getState()
  const taxonomy = useStore((s) => s.taxonomy)
  const crits = termsOf(taxonomy, CAT.criticality)
  const tone = useCriticalityTone()
  const [confirm, setConfirm] = useState(false)
  const attested = usage.attestation === ATTESTED
  const { can, canAttestDesk } = usePermissions()
  const canEdit = can('editTools')
  const canAttest = canAttestDesk(usage.desk)
  return (
    <div className={cx('flex flex-col rounded-md border bg-white p-3', attested ? 'border-slate-200' : 'border-amber-200 bg-amber-50/30')}>
      <div className="flex items-start justify-between gap-2">
        <ToolLink id={tool.id} className="leading-snug" />
        <VendorFlag v={tool.vendor} />
      </div>
      <div className="mt-1 truncate text-xs text-slate-500">{[tool.capL2, tool.capL3].filter(Boolean).join(' · ') || 'No capability set'}</div>
      <div className="mt-2 whitespace-nowrap">
        <AttestationBadge status={usage.attestation} on={usage.attestedOn} />
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
        {!canEdit && !canAttest ? (
          <Badge tone={tone(usage.criticality)}>{usage.criticality || 'No criticality'}</Badge>
        ) : confirm ? (
          <>
            <span className="mr-auto text-xs text-slate-600">Remove from strategy?</span>
            <Button size="sm" onClick={() => setConfirm(false)}>
              Keep
            </Button>
            <Button size="sm" variant="danger" onClick={() => removeUsage(usage.id)}>
              Remove
            </Button>
          </>
        ) : (
          <>
            {!canEdit && <Badge tone={tone(usage.criticality)} className="mr-auto">{usage.criticality || 'No criticality'}</Badge>}
            {canEdit && (
            <Select
              value={usage.criticality}
              onChange={(e) => setCriticality(usage.id, e.target.value)}
              className={cx('h-7 min-w-0 flex-1 text-xs font-medium', tone(usage.criticality) === 'red' ? 'text-red-700' : tone(usage.criticality) === 'amber' ? 'text-amber-800' : 'text-slate-600')}
              aria-label="Criticality"
              title="Criticality"
            >
              {!crits.includes(usage.criticality) && <option value={usage.criticality}>{usage.criticality || '—'}</option>}
              {crits.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            )}
            {!canAttest ? null : attested ? (
              <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700" title="Re-attest with today’s date" aria-label={`Re-attest ${tool.name}`} onClick={() => attest([usage.id])}>
                <ShieldCheck size={15} />
              </button>
            ) : (
              <Button size="sm" variant="primary" icon={<ShieldCheck size={13} />} onClick={() => attest([usage.id])} title="Confirm this desk uses it">
                Attest
              </Button>
            )}
            {canEdit && (
            <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700" title="Remove from this strategy" aria-label={`Remove ${tool.name}`} onClick={() => setConfirm(true)}>
              <Trash2 size={14} />
            </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function AddAppModal({ desk, strategy, onClose }: { desk: string; strategy: string; onClose: () => void }) {
  const s = useStore()
  const notify = useUi((u) => u.notify)
  const crits = termsOf(s.taxonomy, CAT.criticality)
  const [crit, setCrit] = useState(crits[1] ?? crits[0] ?? '')
  const [mode, setMode] = useState<'search' | 'euc'>('search')
  const [name, setName] = useState('')
  const existing = new Set(s.usages.filter((u) => u.desk === desk && u.strategy === strategy).map((u) => u.toolId))

  const addEuc = () => {
    const n = name.trim()
    if (!n) return
    const fullName = /\(EUC\)\s*$/i.test(n) ? n : `${n} (EUC)`
    const id = s.createTool({
      name: fullName,
      vendor: 'N',
      ownership: '',
      toolType: defaultCatFor(s.taxonomy, 'Application'),
      users: '',
      invUserGroup: 'Desk-built',
      capL2: '',
      capL3: '',
      costK: 0,
      custom: {},
    })
    s.addUsage(desk, strategy, id, crit)
    notify(`Created ${fullName} and added it to ${strategy}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Add application to ${strategy}`}
      width="max-w-xl"
      footer={
        mode === 'euc' ? (
          <>
            <Button onClick={() => setMode('search')}>Back to search</Button>
            <Button variant="primary" onClick={addEuc} disabled={!name.trim()}>
              Create and add
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="mb-3 flex items-center gap-2">
        <Label className="mb-0">Criticality</Label>
        <Select value={crit} onChange={(e) => setCrit(e.target.value)} className="h-7 text-xs">
          {crits.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
      </div>
      {mode === 'search' ? (
        <ToolPicker
          placeholder="Search existing applications…"
          filter={(_t, layer) => layer === 'Application'}
          exclude={existing}
          onPick={(t) => {
            s.addUsage(desk, strategy, t.id, crit)
            notify(`Added ${t.name} to ${strategy}`)
            onClose()
          }}
          footer={
            <button type="button" onClick={() => setMode('euc')} className="mt-3 flex w-full items-center gap-3 rounded-md border border-dashed border-slate-300 px-3 py-2.5 text-left hover:border-accent-500 hover:bg-accent-50">
              <FileSpreadsheet size={18} className="text-emerald-700" />
              <span>
                <span className="block text-[13px] font-medium text-slate-800">It’s a spreadsheet / local build</span>
                <span className="block text-xs text-slate-500">Not in the list? Record a desk-built tool — it’s tagged (EUC), vendor N.</span>
              </span>
            </button>
          }
        />
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addEuc()
          }}
        >
          <Label>Name of the spreadsheet or local build</Label>
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Duration Bucketing.xlsx" className="w-full" />
          <p className="mt-2 text-xs text-slate-500">
            Will be created as <span className="font-medium text-slate-700">{name.trim() ? (/\(EUC\)\s*$/i.test(name.trim()) ? name.trim() : `${name.trim()} (EUC)`) : '… (EUC)'}</span> · Vendor N · Inv User Group “Desk-built” · {CAT.toolType} “{defaultCatFor(s.taxonomy, 'Application')}”.
          </p>
        </form>
      )}
    </Modal>
  )
}

export function DeskView() {
  const route = useRoute()
  const state = useDataState()
  const lm = useLayerMap()
  const notify = useUi((s) => s.notify)
  const attest = useStore((s) => s.attest)
  const { can, canAttestDesk } = usePermissions()
  const desks = termsOf(state.taxonomy, CAT.desk)
  const desk = route.params.get('desk') && desks.includes(route.params.get('desk')!) ? route.params.get('desk')! : desks[0] ?? ''
  const showFoundations = route.params.get('sitsOn') === '1'
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState<string | null>(null)

  const toolById = useMemo(() => new Map(state.tools.map((t) => [t.id, t])), [state.tools])
  const deskUsages = state.usages.filter((u) => u.desk === desk)
  const appUsages = deskUsages.filter((u) => {
    const t = toolById.get(u.toolId)
    return t && layerOf(t, lm) === 'Application'
  })
  const hiddenFoundationUsages = deskUsages.length - appUsages.length
  const strategies = [
    ...state.taxonomy.filter((t) => t.category === CAT.strategy && t.parent === desk).map((t) => t.term),
    ...new Set(deskUsages.map((u) => u.strategy)),
  ].filter((v, i, a) => a.indexOf(v) === i)
  const attestedCount = appUsages.filter((u) => u.attestation === ATTESTED).length
  const outstanding = appUsages.filter((u) => u.attestation !== ATTESTED)
  const distinctApps = new Set(appUsages.map((u) => u.toolId)).size

  const sitsOn = (() => {
    const m = new Map<string, { tool: Tool; via: Set<string>; direct: boolean }>()
    for (const toolId of new Set(deskUsages.map((u) => u.toolId))) {
      const t = toolById.get(toolId)
      if (!t) continue
      if (layerOf(t, lm) === 'Foundation') {
        const e = m.get(t.id) ?? { tool: t, via: new Set<string>(), direct: false }
        e.direct = true
        m.set(t.id, e)
      }
      for (const d of downstream(state, toolId)) {
        if (layerOf(d.tool, lm) !== 'Foundation') continue
        const e = m.get(d.tool.id) ?? { tool: d.tool, via: new Set<string>(), direct: false }
        e.via.add(t.name)
        m.set(d.tool.id, e)
      }
    }
    return [...m.values()].sort((a, b) => b.tool.costK - a.tool.costK)
  })()
  const sitsOnCost = sitsOn.reduce((s, f) => s + f.tool.costK, 0)

  const exportAttestation = () => {
    const rows: (string | number)[][] = [['Desk', 'Strategy', 'Application', 'Vendor', 'Criticality', 'Attestation', 'Attested On']]
    for (const st of strategies) {
      for (const u of appUsages.filter((x) => x.strategy === st)) {
        const t = toolById.get(u.toolId)!
        rows.push([u.desk, u.strategy, t.name, t.vendor, u.criticality, u.attestation, u.attestedOn])
      }
    }
    const file = exportXlsx('desk-view', [{ name: desk || 'Desk', rows }])
    notify(`Downloaded ${file}`)
  }

  if (!desks.length) {
    return (
      <>
        <PageHeader title="Desk View" />
        <EmptyState title="No desks defined" hint="Add desks in Taxonomy → Desk, then come back to record what each desk uses." />
      </>
    )
  }

  const canAdd = can('editTools') || canAttestDesk(desk)

  return (
    <>
      <PageHeader
        title="Desk View"
        description="What each desk uses, by strategy. Applications only — the foundations underneath are one click away."
        actions={
          <>
            <Select value={desk} onChange={(e) => patchParams(route, { desk: e.target.value })} className="min-w-52 font-medium" aria-label="Desk">
              {desks.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </Select>
            <Button variant={showFoundations ? 'primary' : 'secondary'} icon={<Layers size={14} />} onClick={() => patchParams(route, { sitsOn: showFoundations ? null : '1' })}>
              What this desk sits on
            </Button>
            <Button icon={<Download size={14} />} onClick={exportAttestation} disabled={!appUsages.length}>
              Export attestation
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-[13px]">
        <span>
          <span className="num font-semibold text-slate-900">{distinctApps}</span> <span className="text-slate-500">applications</span>
        </span>
        <span>
          <span className="num font-semibold text-slate-900">{strategies.length}</span> <span className="text-slate-500">strategies</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="num font-semibold text-slate-900">{pct(attestedCount, appUsages.length)}%</span>
          <span className="text-slate-500">attested</span>
          <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
            <span className="block h-full bg-emerald-600" style={{ width: `${pct(attestedCount, appUsages.length)}%` }} />
          </span>
        </span>
        {hiddenFoundationUsages > 0 && <span className="text-xs text-slate-500">{plural(hiddenFoundationUsages, 'foundation usage')} hidden — see “What this desk sits on”</span>}
        {outstanding.length > 0 && canAttestDesk(desk) && (
          <Button
            size="sm"
            variant="primary"
            className="ml-auto"
            icon={<ShieldCheck size={13} />}
            onClick={() => {
              attest(outstanding.map((u) => u.id))
              notify(`Attested ${plural(outstanding.length, 'usage')} for ${desk}`)
            }}
          >
            Attest all outstanding ({outstanding.length})
          </Button>
        )}
      </div>

      <div className={cx('grid gap-4', showFoundations && 'grid-cols-[minmax(0,1fr)_300px]')}>
        <div className="min-w-0 space-y-3">
          {strategies.length === 0 && <EmptyState title={`No strategies for ${desk}`} hint="Add a Strategy term with this desk as its parent in Taxonomy." />}
          {strategies.map((st) => {
            const us = appUsages.filter((u) => u.strategy === st)
            const open = !collapsed.has(st)
            const att = us.filter((u) => u.attestation === ATTESTED).length
            return (
              <section key={st} className="rounded-lg border border-slate-200 bg-white">
                <header className="flex items-center gap-2 px-3 py-2">
                  <button
                    type="button"
                    className="flex flex-1 items-center gap-2 text-left"
                    onClick={() =>
                      setCollapsed((c) => {
                        const n = new Set(c)
                        if (n.has(st)) n.delete(st)
                        else n.add(st)
                        return n
                      })
                    }
                  >
                    {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                    <span className="text-[13px] font-semibold text-slate-800">{st}</span>
                    <span className="text-xs text-slate-500">
                      {plural(us.length, 'application')} · {att}/{us.length} attested
                    </span>
                    {us.length > 0 && att === us.length && <Badge tone="green">All attested</Badge>}
                  </button>
                  {canAdd && (
                    <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => setAdding(st)}>
                      Add application
                    </Button>
                  )}
                </header>
                {open && (
                  <div className="border-t border-slate-100 p-3">
                    {us.length === 0 ? (
                      <p className="py-3 text-center text-xs text-slate-500">No applications recorded for this strategy yet{canAdd ? ' — use “Add application”' : ''}.</p>
                    ) : (
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-2.5">
                        {us.map((u) => (
                          <AppCard key={u.id} usage={u} tool={toolById.get(u.toolId)!} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </div>

        {showFoundations && (
          <Card title="What this desk sits on" subtitle={`${plural(sitsOn.length, 'foundation')} · ${fmtK(sitsOnCost)} combined run cost`} className="self-start" bodyClassName="p-0">
            {sitsOn.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">No dependencies recorded for this desk’s applications.</p>
            ) : (
              <ul className="max-h-[calc(100vh-260px)] divide-y divide-slate-100 overflow-y-auto scroll-thin">
                {sitsOn.map((f) => (
                  <li key={f.tool.id} className="px-4 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <FoundationLink id={f.tool.id} className="text-[13px]" />
                      <span className="num text-xs text-slate-600">{fmtK(f.tool.costK)}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-500" title={[...f.via].join(', ')}>
                      {f.direct && <span className="font-medium text-slate-600">Used directly{f.via.size ? ' · ' : ''}</span>}
                      {f.via.size > 0 && <>via {[...f.via].slice(0, 3).join(', ')}{f.via.size > 3 ? ` +${f.via.size - 3}` : ''}</>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">Full cost of each foundation — shared with other desks. Read-only; open a foundation to see its allocation.</p>
          </Card>
        )}
      </div>

      {adding && <AddAppModal desk={desk} strategy={adding} onClose={() => setAdding(null)} />}
      <p className="mt-6 text-[11px] text-slate-400">Last attestation on this desk: {appUsages.map((u) => u.attestedOn).filter(Boolean).sort().at(-1) ? fmtDate(appUsages.map((u) => u.attestedOn).filter(Boolean).sort().at(-1)!) : 'none yet'}</p>
    </>
  )
}
