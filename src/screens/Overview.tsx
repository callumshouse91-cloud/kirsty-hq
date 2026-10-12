import { ArrowRight } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FoundationLink, Stat } from '../components/common'
import { Button, Card, cx, EmptyState, PageHeader, Td, Th } from '../components/ui'
import { AXIS_LABEL_TICK, AXIS_TICK, BRAND } from '../lib/brand'
import { foundationReach } from '../lib/graph'
import { BLANK } from '../lib/pivot'
import { CAT, layerOf, termsOf } from '../lib/taxonomy'
import { fmtK, fmtNum, pct, plural } from '../lib/util'
import { navigate } from '../router'
import { useDataState, useLayerMap } from '../store'
import { ATTESTED } from '../types'


interface CostDatum {
  capL2: string
  cost: number
  tools: number
}

function CostTooltip({ active, payload }: { active?: boolean; payload?: { payload: CostDatum }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-800">{d.capL2}</div>
      <div className="num mt-0.5 text-slate-700">
        {fmtK(d.cost)} · {plural(d.tools, 'tool')}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">Click to break down by {CAT.capL3}</div>
    </div>
  )
}

export function Overview() {
  const state = useDataState()
  const lm = useLayerMap()

  if (state.tools.length === 0) {
    return (
      <>
        <PageHeader title="Overview" />
        <EmptyState title="No tools loaded" hint="Use “Reset to seed data” in the header, or import a master list on Import & Reconcile." />
      </>
    )
  }

  const apps = state.tools.filter((t) => layerOf(t, lm) === 'Application')
  const foundations = state.tools.filter((t) => layerOf(t, lm) === 'Foundation')
  const attested = state.usages.filter((u) => u.attestation === ATTESTED).length
  const openIssues = state.issues.filter((i) => i.status === 'Open')
  const totalCost = state.tools.reduce((s, t) => s + t.costK, 0)

  const capOrder = termsOf(state.taxonomy, CAT.capL2)
  const capValues = [...new Set([...capOrder, ...state.tools.map((t) => t.capL2 || BLANK)])]
  const costData: CostDatum[] = capValues
    .map((c) => {
      const ts = state.tools.filter((t) => (t.capL2 || BLANK) === c)
      return { capL2: c, cost: ts.reduce((s, t) => s + t.costK, 0), tools: ts.length }
    })
    .filter((d) => d.tools > 0)
    .sort((a, b) => b.cost - a.cost)

  const topFoundations = foundations
    .map((f) => {
      const direct = new Set(state.dependencies.filter((d) => d.foundationId === f.id).map((d) => d.appId))
      const reach = foundationReach(state, f.id)
      return { tool: f, direct: direct.size, apps: reach.consumers.filter((c) => c.layer === 'Application').length, desks: reach.desks.size }
    })
    .sort((a, b) => b.direct - a.direct || b.apps - a.apps || b.tool.costK - a.tool.costK)
    .slice(0, 10)

  const desks = termsOf(state.taxonomy, CAT.desk).map((d) => {
    const us = state.usages.filter((u) => u.desk === d)
    const a = us.filter((u) => u.attestation === ATTESTED).length
    return { desk: d, total: us.length, attested: a }
  })

  return (
    <>
      <PageHeader title="Overview" description="The Investments tool estate at a glance. Every number opens the detail behind it." />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-3 xl:grid-cols-6">
        {[
          <Stat key="t" label="Total tools" value={fmtNum(state.tools.length)} sub={`${new Set(state.tools.map((t) => t.kirstyCat)).size} ${CAT.kirstyCat} groups`} onClick={() => navigate('explorer', { rows: 'kirstyCat', col: 'layer', measure: 'tools' })} />,
          <Stat key="a" label="Applications" value={fmtNum(apps.length)} sub="what users see and use" onClick={() => navigate('explorer', { rows: 'capL2', col: 'none', layer: 'Application' })} />,
          <Stat key="f" label="Foundations" value={fmtNum(foundations.length)} sub="what applications sit on" onClick={() => navigate('explorer', { rows: 'kirstyCat', col: 'none', layer: 'Foundation' })} />,
          <Stat key="p" label="Desk usage attested" value={`${pct(attested, state.usages.length)}%`} sub={`${fmtNum(attested)} of ${fmtNum(state.usages.length)} usage rows`} onClick={() => navigate('explorer', { rows: 'desk', col: 'attestation', measure: 'tools' })} />,
          <Stat
            key="i"
            label="Open issues"
            value={fmtNum(openIssues.length)}
            tone={openIssues.length ? 'amber' : undefined}
            sub={openIssues.length ? `from ${[...new Set(openIssues.map((i) => i.source))].join(', ')}` : 'import a source to reconcile'}
            onClick={() => navigate('import', { tab: openIssues.length ? 'issues' : null })}
          />,
          <Stat key="c" label="Est. annual cost" value={fmtK(totalCost)} sub={`£${fmtNum(totalCost)}k across all tools`} onClick={() => navigate('explorer', { rows: 'capL2', col: 'layer', measure: 'cost' })} />,
        ].map((el, i) => (
          <div key={i} className="bg-white px-4 py-3.5">
            {el}
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title={`Estimated annual cost by ${CAT.capL2}`} subtitle="£k · click a bar to break it down">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={costData} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }} barCategoryGap={10}>
                <CartesianGrid horizontal={false} stroke={BRAND.grid} />
                <XAxis type="number" tickFormatter={(v: number) => `£${fmtNum(v)}k`} tick={AXIS_TICK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="capL2" width={88} tick={AXIS_LABEL_TICK} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <Tooltip cursor={{ fill: 'rgba(15,108,189,0.06)' }} content={<CostTooltip />} />
                <Bar
                  dataKey="cost"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={22}
                  className="cursor-pointer"
                  label={{ position: 'right', formatter: (v: unknown) => fmtK(Number(v)), fontSize: 11, fill: BRAND.ink }}
                  onClick={(d: { payload?: CostDatum }) => {
                    const c = d.payload?.capL2
                    if (c && c !== BLANK) navigate('explorer', { rows: 'capL3', col: 'layer', measure: 'cost', where: `capL2:${c}` })
                  }}
                >
                  {costData.map((d) => (
                    <Cell key={d.capL2} fill={BRAND.blue} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Estimated annual cost by {CAT.capL2}</caption>
            <tbody>
              {costData.map((d) => (
                <tr key={d.capL2}>
                  <th>{d.capL2}</th>
                  <td>{fmtK(d.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Most depended-on foundations" subtitle="Top 10 by number of tools sitting directly on them" bodyClassName="p-0">
          {topFoundations.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No foundations yet — check the layer mapping in Taxonomy.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <Th>Foundation</Th>
                  <Th right>Dependents</Th>
                  <Th right>Desks</Th>
                  <Th right>Cost</Th>
                </tr>
              </thead>
              <tbody>
                {topFoundations.map((f) => (
                  <tr key={f.tool.id} className="hover:bg-slate-50">
                    <Td className="py-1">
                      <FoundationLink id={f.tool.id} />
                    </Td>
                    <Td right className="py-1">
                      <button type="button" className="font-semibold text-slate-900 hover:text-accent-700 hover:underline" onClick={() => navigate('foundation', { id: f.tool.id })}>
                        {f.direct}
                      </button>
                      {f.apps > f.direct && <span className="ml-1 text-xs text-slate-400">({f.apps} apps)</span>}
                    </Td>
                    <Td right className="py-1">
                      {f.desks}
                    </Td>
                    <Td right className="py-1 text-slate-600">
                      {fmtK(f.tool.costK)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Attestation by desk"
        subtitle="Share of each desk’s usage rows confirmed by the desk"
        actions={
          <Button size="sm" variant="ghost" onClick={() => navigate('desk')}>
            Open Desk View <ArrowRight size={13} />
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
          {desks.map((d) => {
            const p = pct(d.attested, d.total)
            return (
              <button key={d.desk} type="button" onClick={() => navigate('desk', { desk: d.desk })} className="group grid grid-cols-[minmax(0,1fr)_120px_44px] items-center gap-3 rounded px-1 py-1 text-left hover:bg-slate-50">
                <span className="truncate text-[13px] font-medium text-slate-700 group-hover:text-accent-700 group-hover:underline">{d.desk}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <span className={cx('block h-full rounded-full', p === 100 ? 'bg-emerald-600' : 'bg-accent-600')} style={{ width: `${p}%` }} />
                </span>
                <span className="num text-right text-xs text-slate-600">{d.total ? `${p}%` : '—'}</span>
              </button>
            )
          })}
        </div>
      </Card>
    </>
  )
}
