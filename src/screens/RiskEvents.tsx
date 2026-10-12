import { AlertTriangle, Download, X } from 'lucide-react'
import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ToolLink } from '../components/common'
import { Badge, Button, Card, Chip, cx, EmptyState, PageHeader, Segmented, Td, Th } from '../components/ui'
import { AXIS_LABEL_TICK, AXIS_TICK, BRAND } from '../lib/brand'
import { capabilityTree, capLabel } from '../lib/capability'
import { exportXlsx } from '../lib/export'
import { BLANK } from '../lib/pivot'
import { CAT, termsOf } from '../lib/taxonomy'
import { fmtDate, fmtK, fmtNum, plural } from '../lib/util'
import { useModuleData, type RiskEvent } from '../module-data'
import { patchParams, useRoute } from '../router'
import { useDataState, useLayerMap } from '../store'
import { useUi } from '../ui-store'

type Measure = 'count' | 'cost'

interface Datum {
  key: string
  label: string
  count: number
  cost: number
}

function ChartTip({ active, payload, measure }: { active?: boolean; payload?: { payload: Datum }[]; measure: Measure }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-bold text-ink">{d.label}</div>
      <div className="num mt-0.5 text-slate-700">
        {plural(d.count, 'event')} · {fmtK(d.cost)}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">Click to filter the list{measure === 'cost' ? '' : ''}</div>
    </div>
  )
}

export function RiskEventsScreen() {
  const route = useRoute()
  const state = useDataState()
  const lm = useLayerMap()
  const events = useModuleData((s) => s.riskEvents)
  const notify = useUi((u) => u.notify)
  const p = route.params
  const measure: Measure = p.get('measure') === 'count' ? 'count' : 'cost'
  const capF = p.get('cap')
  const stratF = p.get('strategy')
  const catF = p.get('category')

  const capOfTool = useMemo(() => {
    const m = new Map<string, { key: string; label: string }>()
    for (const g of capabilityTree(state, lm)) for (const n of g.children) for (const t of n.tools) m.set(t.id, { key: n.key, label: n.l3 === BLANK ? 'Unclassified' : capLabel(n) })
    return m
  }, [state, lm])
  const capOf = (e: RiskEvent) => capOfTool.get(e.toolId) ?? { key: 'unknown', label: 'Tool not in the map' }

  const filtered = events.filter((e) => (!capF || capOf(e).key === capF) && (!stratF || e.strategy === stratF) && (!catF || e.category === catF))
  const byCap: Datum[] = useMemo(() => {
    const m = new Map<string, Datum>()
    for (const e of events) {
      const c = capOfTool.get(e.toolId) ?? { key: 'unknown', label: 'Tool not in the map' }
      const d = m.get(c.key) ?? { key: c.key, label: c.label, count: 0, cost: 0 }
      d.count++
      d.cost += e.lossK
      m.set(c.key, d)
    }
    return [...m.values()].sort((a, b) => b[measure] - a[measure])
  }, [events, capOfTool, measure])
  const strategies = termsOf(state.taxonomy, CAT.strategy)
  const byStrategy = strategies.map((s) => {
    const es = events.filter((e) => e.strategy === s)
    return { s, count: es.length, cost: es.reduce((a, e) => a + e.lossK, 0) }
  })
  const maxS = Math.max(1, ...byStrategy.map((x) => x[measure]))
  const categories = [...new Set(events.map((e) => e.category))]
  const total = events.reduce((s, e) => s + e.lossK, 0)
  const open = events.filter((e) => e.status === 'Open')
  const euc = events.filter((e) => /\(EUC\)/.test(e.toolName))
  const repeat = [...new Set(events.map((e) => e.toolId))].filter((id) => events.filter((e) => e.toolId === id).length > 1)

  if (events.length === 0) {
    return (
      <>
        <PageHeader title="Risk events" />
        <EmptyState icon={<AlertTriangle size={28} />} title="No risk events loaded" hint="Drop in the risk event log from Operational Risk to overlay it on the map." />
      </>
    )
  }

  const exportView = () => {
    const rows = [['Event', 'Date', 'Title', 'Tool', 'Capability', 'Strategy', 'Category', 'Loss (£k)', 'Status'], ...filtered.map((e) => [e.id, e.date, e.title, e.toolName, capOf(e).label, e.strategy, e.category, String(e.lossK), e.status])]
    const file = exportXlsx('risk-events', [{ name: 'Risk events', rows }])
    notify(`Downloaded ${file}`)
  }

  const filters = [capF && { k: 'cap', label: byCap.find((d) => d.key === capF)?.label ?? capF }, stratF && { k: 'strategy', label: stratF }, catF && { k: 'category', label: catF }].filter(Boolean) as { k: string; label: string }[]

  return (
    <>
      <PageHeader
        title="Risk events"
        description="Risk events joined to the tools involved, so they can be read by capability and by strategy."
        actions={
          <>
            <Badge tone="neutral">Illustrative events</Badge>
            <Button icon={<Download size={14} />} onClick={exportView}>
              Export
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-4">
        {[
          ['Events, last 12 months', fmtNum(events.length), `${fmtK(total)} total loss`],
          ['Still open', fmtNum(open.length), fmtK(open.reduce((s, e) => s + e.lossK, 0))],
          ['Tools in more than one event', fmtNum(repeat.length), repeat.length ? state.tools.filter((t) => repeat.includes(t.id)).map((t) => t.name).slice(0, 2).join(', ') : '—'],
          ['Involving EUCs', fmtNum(euc.length), fmtK(euc.reduce((s, e) => s + e.lossK, 0))],
        ].map(([l, v, s]) => (
          <div key={l} className="bg-white px-4 py-3">
            <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{l}</div>
            <div className="num mt-1 text-[24px] leading-none font-bold text-navy">{v}</div>
            <div className="mt-1 truncate text-xs text-slate-500">{s}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="By capability" subtitle="Click a bar to filter the events" actions={<Segmented size="sm" options={[{ id: 'cost', label: 'Cost' }, { id: 'count', label: 'Count' }]} value={measure} onChange={(v) => patchParams(route, { measure: v === 'cost' ? null : v })} />}>
          <div style={{ height: Math.max(180, byCap.length * 30) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCap} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={8}>
                <CartesianGrid horizontal={false} stroke={BRAND.grid} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => (measure === 'cost' ? `£${fmtNum(v)}k` : fmtNum(v))} allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={210} tick={AXIS_LABEL_TICK} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(0,93,186,0.06)' }} content={<ChartTip measure={measure} />} />
                <Bar
                  dataKey={measure}
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  className="cursor-pointer"
                  label={{ position: 'right', fontSize: 11, fill: BRAND.ink, formatter: (v: unknown) => (measure === 'cost' ? fmtK(Number(v)) : String(v)) }}
                  onClick={(d: { payload?: Datum }) => d.payload && patchParams(route, { cap: d.payload.key === capF ? null : d.payload.key })}
                >
                  {byCap.map((d) => (
                    <Cell key={d.key} fill={!capF || capF === d.key ? BRAND.red : BRAND.blush} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="By strategy" bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {byStrategy.map((x) => (
              <li key={x.s}>
                <button type="button" onClick={() => patchParams(route, { strategy: x.s === stratF ? null : x.s })} className={cx('grid w-full grid-cols-[minmax(0,1fr)_90px_56px] items-center gap-2 px-4 py-1.5 text-left text-[13px] hover:bg-slate-50', stratF === x.s && 'bg-accent-50')}>
                  <span className="truncate">{x.s}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-brand-red" style={{ width: `${(x[measure] / maxS) * 100}%` }} />
                  </span>
                  <span className="num text-right text-xs text-slate-600">{x[measure] ? (measure === 'cost' ? fmtK(x.cost) : x.count) : '—'}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        className="mt-4"
        title={`Events${filters.length ? ' (filtered)' : ''}`}
        subtitle={`${plural(filtered.length, 'event')} · ${fmtK(filtered.reduce((s, e) => s + e.lossK, 0))}`}
        bodyClassName="p-0"
        actions={
          <span className="flex flex-wrap items-center gap-1">
            {categories.map((c) => (
              <Chip key={c} active={catF === c} onClick={() => patchParams(route, { category: catF === c ? null : c })}>
                {c}
              </Chip>
            ))}
          </span>
        }
      >
        {filters.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2">
            {filters.map((f) => (
              <button key={f.k} type="button" onClick={() => patchParams(route, { [f.k]: null })} className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-0.5 text-xs font-medium text-accent-800 hover:bg-accent-100">
                {f.label} <X size={11} />
              </button>
            ))}
          </div>
        )}
        {filtered.length === 0 ? (
          <p className="p-4 text-xs text-slate-500">No events match these filters.</p>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <Th>Event</Th>
                <Th>Tool</Th>
                <Th>Capability</Th>
                <Th>Strategy</Th>
                <Th right>Loss</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <Td>
                    <div className="text-ink">{e.title}</div>
                    <div className="text-xs text-slate-500">
                      {e.id} · {fmtDate(e.date)} · {e.category} {e.status === 'Open' && <Badge tone="amber">Open</Badge>}
                    </div>
                  </Td>
                  <Td>{capOfTool.has(e.toolId) ? <ToolLink id={e.toolId} /> : <span className="text-slate-500">{e.toolName}</span>}</Td>
                  <Td className="text-xs text-slate-600">{capOf(e).label}</Td>
                  <Td className="text-xs text-slate-600">{e.strategy}</Td>
                  <Td right className="font-semibold">
                    {fmtK(e.lossK)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  )
}
