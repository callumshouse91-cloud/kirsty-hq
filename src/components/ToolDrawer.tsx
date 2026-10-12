import { ArrowDownRight, ArrowUpRight, Plus, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { IGNORE, targetLabel } from '../lib/mapping'
import { CAT, isToolCategory, layerOf, termsOf } from '../lib/taxonomy'
import { fmtK, joinMulti, splitMulti } from '../lib/util'
import { navigate } from '../router'
import { useLayerMap, useStore } from '../store'
import { VENDORS, type SourceRecord, type Tool, type Vendor } from '../types'
import { useUi } from '../ui-store'
import { AttestationBadge, LayerBadge, ToolLink, useCriticalityTone, VendorFlag } from './common'
import { Badge, Button, cx, Drawer, Input, Label, Select } from './ui'

const BOUND = new Set<string>([CAT.toolType, CAT.capL2, CAT.capL3, CAT.users])

function Section({ title, count, children, actions }: { title: string; count?: number; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="border-b border-slate-100 px-5 py-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          {title}
          {count !== undefined && <span className="ml-1.5 font-normal text-slate-400">{count}</span>}
        </h3>
        {actions}
      </div>
      {children}
    </section>
  )
}

function TermSelect({ category, value, onChange }: { category: string; value: string; onChange: (v: string) => void }) {
  const taxonomy = useStore((s) => s.taxonomy)
  const terms = termsOf(taxonomy, category)
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
      <option value="">—</option>
      {value && !terms.includes(value) && <option value={value}>{value} (not in taxonomy)</option>}
      {terms.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </Select>
  )
}

function SourcesTable({ tool, records }: { tool: Tool; records: SourceRecord[] }) {
  const rows = useMemo(() => {
    const labels: string[] = []
    const values = new Map<string, Map<string, string>>()
    for (const r of records) {
      for (const [h, v] of Object.entries(r.raw)) {
        const target = r.headerMap[h] ?? IGNORE
        const label = target === IGNORE ? h : targetLabel(target)
        if (!labels.includes(label)) labels.push(label)
        if (!values.has(label)) values.set(label, new Map())
        values.get(label)!.set(r.id, v)
      }
    }
    return labels.map((l) => ({ label: l, values: values.get(l)! }))
  }, [records])

  return (
    <div className="overflow-x-auto rounded-md border border-slate-200">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-500">Field</th>
            {records.map((r) => (
              <th key={r.id} className="border-b border-l border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left font-semibold text-slate-700">
                {r.source}
                {r.externalId && <span className="ml-1 font-normal text-slate-500">{r.externalId}</span>}
                {r.matchType !== 'exact' && (
                  <Badge tone={r.resolution === 'pending' ? 'amber' : 'accent'} className="ml-1.5">
                    {r.resolution === 'pending' ? 'fuzzy — unconfirmed' : r.resolution === 'created' ? 'created from' : r.matchType}
                  </Badge>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="border-b border-slate-100 px-2.5 py-1 whitespace-nowrap text-slate-500">{row.label}</td>
              {records.map((r) => {
                const v = row.values.get(r.id)
                const differs = row.label === targetLabel('field:name') && v !== undefined && v !== tool.name
                return (
                  <td key={r.id} className={cx('border-b border-l border-slate-100 px-2.5 py-1', differs && 'bg-amber-50 text-amber-900')}>
                    {v === undefined ? <span className="text-slate-300">—</span> : v || <span className="text-slate-300">blank</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ToolDrawer() {
  const toolId = useUi((s) => s.toolId)
  const close = useUi((s) => s.closeTool)
  const notify = useUi((s) => s.notify)
  const tool = useStore((s) => s.tools.find((t) => t.id === toolId))
  if (!tool) return null
  return <ToolDrawerBody key={tool.id} tool={tool} close={close} notify={notify} />
}

function ToolDrawerBody({ tool, close, notify }: { tool: Tool; close: () => void; notify: (m: string) => void }) {
  const [draft, setDraft] = useState<Tool>(() => ({ ...tool, custom: { ...tool.custom } }))
  const s = useStore()
  const lm = useLayerMap()
  const critTone = useCriticalityTone()
  const [newAlias, setNewAlias] = useState('')

  const layer = layerOf(draft, lm)
  const savedLayer = layerOf(tool, lm)
  const dirty = JSON.stringify(draft) !== JSON.stringify(tool)
  const set = <K extends keyof Tool>(k: K, v: Tool[K]) => setDraft({ ...draft, [k]: v })

  const records = s.sourceRecords.filter((r) => r.matchedToolId === tool.id && r.resolution !== 'rejected' && r.resolution !== 'ignored')
  const aliases = s.aliases.filter((a) => a.toolId === tool.id)
  const sitsOn = s.dependencies.filter((d) => d.appId === tool.id)
  const usedBy = s.dependencies.filter((d) => d.foundationId === tool.id)
  const usages = s.usages.filter((u) => u.toolId === tool.id)
  const issues = s.issues.filter((i) => i.toolId === tool.id && i.status === 'Open')
  const desks = [...new Set(usages.map((u) => u.desk))]
  const customCats = s.categories.filter((c) => !BOUND.has(c) && isToolCategory(c))
  const ownerships = [...new Set(s.tools.map((t) => t.ownership).filter(Boolean))]
  const userTerms = termsOf(s.taxonomy, CAT.users)
  const users = splitMulti(draft.users)

  const save = () => {
    const { id: _id, ...patch } = draft
    void _id
    s.updateTool(tool.id, { ...patch, name: patch.name.trim() || tool.name })
    notify(`Saved ${patch.name.trim() || tool.name}`)
  }

  return (
    <Drawer
      open
      onClose={close}
      title={tool.name}
      subtitle={
        <span className="flex flex-wrap items-center gap-1.5">
          <LayerBadge layer={savedLayer} />
          <VendorFlag v={tool.vendor} />
          <span className="num">{fmtK(tool.costK)} / yr</span>
          {issues.length > 0 && <Badge tone="amber">{issues.length} open issue{issues.length > 1 ? 's' : ''}</Badge>}
        </span>
      }
      footer={
        <>
          {savedLayer === 'Foundation' && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                close()
                navigate('foundation', { id: tool.id })
              }}
            >
              Open in Foundation View
            </Button>
          )}
          <Button onClick={() => setDraft({ ...tool, custom: { ...tool.custom } })} disabled={!dirty}>
            Discard changes
          </Button>
          <Button variant="primary" onClick={save} disabled={!dirty}>
            Save
          </Button>
        </>
      }
    >
      <Section title="Details">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
          <label className="col-span-2">
            <Label>Name</Label>
            <Input value={draft.name} onChange={(e) => set('name', e.target.value)} className="w-full" />
          </label>
          <label>
            <Label>{CAT.toolType}</Label>
            <TermSelect category={CAT.toolType} value={draft.toolType} onChange={(v) => set('toolType', v)} />
          </label>
          <div>
            <Label>Layer</Label>
            <div className="flex h-8 items-center gap-2">
              <LayerBadge layer={layer} />
              <span className="text-xs text-slate-400">set by {CAT.toolType}</span>
            </div>
          </div>
          <label>
            <Label>{CAT.capL2}</Label>
            <TermSelect category={CAT.capL2} value={draft.capL2} onChange={(v) => set('capL2', v)} />
          </label>
          <label>
            <Label>{CAT.capL3}</Label>
            <TermSelect category={CAT.capL3} value={draft.capL3} onChange={(v) => set('capL3', v)} />
          </label>
          <label>
            <Label>Vendor</Label>
            <Select value={draft.vendor} onChange={(e) => set('vendor', e.target.value as Vendor)} className="w-full">
              {VENDORS.map((v) => (
                <option key={v} value={v}>
                  {v === 'Y' ? 'Y — vendor product' : v === 'N' ? 'N — built in-house' : '? — unknown'}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <Label>Tech ownership</Label>
            <Input value={draft.ownership} onChange={(e) => set('ownership', e.target.value)} list="ownership-list" className="w-full" />
            <datalist id="ownership-list">
              {ownerships.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </label>
          <label>
            <Label>Inv user group</Label>
            <Input value={draft.invUserGroup} onChange={(e) => set('invUserGroup', e.target.value)} className="w-full" />
          </label>
          <label>
            <Label>Est annual cost (£k)</Label>
            <Input type="number" min={0} value={draft.costK} onChange={(e) => set('costK', Number(e.target.value) || 0)} className="num w-full" />
          </label>
          <div className="col-span-2">
            <Label>{CAT.users}</Label>
            <div className="flex flex-wrap gap-1.5">
              {[...userTerms, ...users.filter((u) => !userTerms.includes(u))].map((u) => {
                const on = users.includes(u)
                return (
                  <button
                    key={u}
                    type="button"
                    onClick={() => set('users', joinMulti(on ? users.filter((x) => x !== u) : [...users, u].sort((a, b) => userTerms.indexOf(a) - userTerms.indexOf(b))))}
                    className={cx('h-7 rounded-md border px-2.5 text-xs font-medium', on ? 'border-accent-600 bg-accent-50 text-accent-800' : 'border-slate-300 text-slate-500 hover:border-slate-400')}
                  >
                    {u}
                  </button>
                )
              })}
            </div>
          </div>
          {customCats.map((c) => (
            <label key={c}>
              <Label>{c}</Label>
              <TermSelect category={c} value={draft.custom[c] ?? ''} onChange={(v) => setDraft({ ...draft, custom: { ...draft.custom, [c]: v } })} />
            </label>
          ))}
        </div>
      </Section>

      {issues.length > 0 && (
        <Section title="Open issues" count={issues.length}>
          <ul className="space-y-1.5">
            {issues.map((i) => (
              <li key={i.id} className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                <Badge tone="amber">{i.type}</Badge>
                <span>{i.detail}</span>
              </li>
            ))}
          </ul>
          <Button
            variant="link"
            className="mt-2 text-xs"
            onClick={() => {
              close()
              navigate('import', { tab: 'issues' })
            }}
          >
            Go to Issues →
          </Button>
        </Section>
      )}

      <Section title="Sources" count={records.length}>
        {records.length ? <SourcesTable tool={tool} records={records} /> : <p className="text-xs text-slate-500">Not linked to any source yet. Import a file on the Import &amp; Reconcile screen to link it.</p>}
      </Section>

      <Section title="Aliases" count={aliases.length}>
        <div className="flex flex-wrap items-center gap-1.5">
          {aliases.map((a) => (
            <span key={a.id} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 py-0.5 pr-1 pl-2 text-xs text-slate-700">
              {a.alias}
              <span className="text-slate-400">· {a.source}</span>
              <button className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={() => s.removeAlias(a.id)} aria-label={`Remove alias ${a.alias}`}>
                <X size={12} />
              </button>
            </span>
          ))}
          <form
            className="flex items-center gap-1"
            onSubmit={(e) => {
              e.preventDefault()
              s.addAlias(tool.id, newAlias, 'Manual')
              setNewAlias('')
            }}
          >
            <Input value={newAlias} onChange={(e) => setNewAlias(e.target.value)} placeholder="Add alias…" className="h-7 w-40 text-xs" />
            <Button type="submit" size="sm" variant="ghost" icon={<Plus size={13} />} disabled={!newAlias.trim()}>
              Add
            </Button>
          </form>
        </div>
      </Section>

      <Section title="Dependencies">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-600">
              <ArrowDownRight size={13} /> Sits on <span className="text-slate-400">{sitsOn.length}</span>
            </p>
            {sitsOn.length === 0 && <p className="text-xs text-slate-400">Nothing recorded.</p>}
            <ul className="space-y-1">
              {sitsOn.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                  <ToolLink id={d.foundationId} />
                  <span className="text-slate-400">{d.direction}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1.5 flex items-center gap-1 text-xs font-medium text-slate-600">
              <ArrowUpRight size={13} /> Depended on by <span className="text-slate-400">{usedBy.length}</span>
            </p>
            {usedBy.length === 0 && <p className="text-xs text-slate-400">Nothing recorded.</p>}
            <ul className="space-y-1">
              {usedBy.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                  <ToolLink id={d.appId} />
                  <span className="text-slate-400">{d.direction}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section title="Desks using it" count={desks.length}>
        {desks.length === 0 && <p className="text-xs text-slate-500">No desk has recorded using this tool.</p>}
        <div className="space-y-2">
          {desks.map((d) => (
            <div key={d}>
              <button
                type="button"
                className="text-xs font-semibold text-slate-700 hover:text-accent-700 hover:underline"
                onClick={() => {
                  useUi.getState().closeTool()
                  navigate('desk', { desk: d })
                }}
              >
                {d}
              </button>
              <ul className="mt-1 space-y-0.5">
                {usages
                  .filter((u) => u.desk === d)
                  .map((u) => (
                    <li key={u.id} className="flex items-center justify-between gap-2 pl-3 text-xs">
                      <span className="text-slate-600">{u.strategy}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={critTone(u.criticality)}>{u.criticality}</Badge>
                        <AttestationBadge status={u.attestation} on={u.attestedOn} />
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </Drawer>
  )
}
