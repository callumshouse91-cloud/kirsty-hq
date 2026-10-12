import { AlertTriangle, Download, Flame } from 'lucide-react'
import { useMemo } from 'react'
import { ToolLink } from '../components/common'
import { fmtMeasure, HeatGrid } from '../components/HeatGrid'
import { Badge, Button, Card, EmptyState, PageHeader, Segmented } from '../components/ui'
import { capLabel } from '../lib/capability'
import { exportXlsx, type CellValue } from '../lib/export'
import { drillTools, HEAT_MEASURES, heatKey, heatMatrix, heatValue, type HeatMeasure } from '../lib/heatmap'
import { fmtDate, fmtK, plural } from '../lib/util'
import { useModuleData } from '../module-data'
import { useScreenEnabled } from '../nav'
import { navigate, patchParams, useRoute } from '../router'
import { useDataState, useLayerMap } from '../store'
import { useUi } from '../ui-store'

export function HeatmapScreen() {
  const route = useRoute()
  const state = useDataState()
  const lm = useLayerMap()
  const events = useModuleData((s) => s.riskEvents)
  const notify = useUi((u) => u.notify)
  const riskOn = useScreenEnabled('risk')
  const measure = (HEAT_MEASURES.some((m) => m.id === route.params.get('measure')) ? route.params.get('measure') : 'cost') as HeatMeasure
  const sel = route.params.get('cell')
  const h = useMemo(() => heatMatrix(state, lm, events), [state, lm, events])
  const m = HEAT_MEASURES.find((x) => x.id === measure)!

  if (h.rows.length === 0 || h.cols.length === 0) {
    return (
      <>
        <PageHeader title="Capability heat map" />
        <EmptyState icon={<Flame size={28} />} title="Nothing to map yet" hint="The heat map needs capabilities on tools and strategies in the taxonomy." />
      </>
    )
  }

  const [capKey, strategy] = sel ? sel.split('§') : [null, null]
  const node = h.rows.find((n) => n.key === capKey)
  const cell = sel ? h.cells.get(sel) : undefined
  const cellEvents = cell ? events.filter((e) => cell.eventIds.includes(e.id)) : []
  const tools = drillTools(cell, measure)
  const toolById = new Map(state.tools.map((t) => [t.id, t]))

  const exportView = () => {
    const header: CellValue[] = ['Cap L2', 'Cap L3', ...h.cols.map((c) => `${c.desk} › ${c.strategy}`)]
    const rows: CellValue[][] = [header, ...h.rows.map((n): CellValue[] => [n.l2, n.l3, ...h.cols.map((c) => Math.round(heatValue(h.cells.get(heatKey(n.key, c.strategy)), measure) * 10) / 10 || null)])]
    const file = exportXlsx('heat-map', [
      { name: m.short, rows },
      { name: 'Notes', rows: [['Measure', m.label], ['Cost allocation', 'Each tool’s cost split evenly across the strategies it reaches. Illustrative.'], ['Cost not tied to a strategy (£k)', Math.round(h.unplacedCost)]] },
    ])
    notify(`Downloaded ${file}`)
  }

  return (
    <>
      <PageHeader
        title="Capability heat map"
        description="Capability against investment strategy. Pick what each cell measures, then click a cell for the tools and events behind it."
        actions={
          <>
            <Badge tone="neutral">Illustrative</Badge>
            <Button icon={<Download size={14} />} onClick={exportView}>
              Export
            </Button>
          </>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Segmented size="sm" options={HEAT_MEASURES.map((x) => ({ id: x.id, label: x.short }))} value={measure} onChange={(v) => patchParams(route, { measure: v })} />
        <span className="text-xs text-slate-500">{m.label}</span>
        {measure === 'cost' && <span className="ml-auto text-xs text-slate-500">{fmtK(Math.round(h.unplacedCost))} of cost reaches no strategy and is left out</span>}
      </div>
      <HeatGrid h={h} measure={measure} selected={sel} onCell={(k, s) => patchParams(route, { cell: heatKey(k, s) })} />

      {node && strategy && (
        <Card className="mt-4" title={`${capLabel(node)} × ${strategy}`} subtitle={`${m.short}: ${fmtMeasure(heatValue(cell, measure), measure)}`}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">{measure === 'riskCount' || measure === 'riskCost' ? 'Tools involved' : 'Tools reaching this strategy'}</h3>
              {tools.length === 0 ? (
                <p className="text-xs text-slate-500">None.</p>
              ) : (
                <ul className="space-y-1.5">
                  {tools.map((id) => (
                    <li key={id} className="flex items-center justify-between gap-2 text-[13px]">
                      <ToolLink id={id} />
                      <span className="num text-xs text-slate-500">{fmtK(toolById.get(id)?.costK ?? 0)} a year</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Risk events</h3>
              {cellEvents.length === 0 ? (
                <p className="text-xs text-slate-500">No risk events recorded here.</p>
              ) : (
                <ul className="space-y-1.5">
                  {cellEvents.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 text-[13px]">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-brand-red" />
                      <span className="min-w-0 flex-1">
                        {e.title}
                        <span className="block text-xs text-slate-500">
                          {e.id} · {fmtDate(e.date)} · {fmtK(e.lossK)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {cellEvents.length > 0 && riskOn && (
                <Button variant="link" className="mt-2 text-xs" onClick={() => navigate('risk', { cap: node.key, strategy })}>
                  Open in Risk events →
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}
      {!sel && <p className="mt-3 text-xs text-slate-500">{plural(h.rows.length, 'capability', 'capabilities')} × {plural(h.cols.length, 'strategy', 'strategies')}. Click a cell to see what is behind it.</p>}
    </>
  )
}
