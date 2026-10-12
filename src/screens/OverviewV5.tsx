import { ArrowRight, CalendarClock, CheckCircle2, Database, FileSpreadsheet, GitCompare, History, Tags } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { SourceLink } from '../components/common'
import { fmtMeasure, HeatGrid } from '../components/HeatGrid'
import { Badge, Button, Card, cx, PageHeader, Segmented } from '../components/ui'
import { useDemo } from '../demo-store'
import { findings, mapHealth, type Finding } from '../lib/findings'
import { HEAT_MEASURES, heatKey, heatMatrix, type HeatMeasure } from '../lib/heatmap'
import { downloadReportPack } from '../lib/reportPack'
import { fmtDate, fmtK, fmtWhen, plural } from '../lib/util'
import { addDays, daysUntil, useModuleData } from '../module-data'
import { useAvailableScreens } from '../nav'
import { navigate, patchParams, useRoute } from '../router'
import { useDataState, useLayerMap } from '../store'
import { useUi } from '../ui-store'

const TONE: Record<Finding['tone'], string> = {
  neutral: 'bg-slate-400',
  green: 'bg-emerald-600',
  amber: 'bg-amber-500',
  red: 'bg-brand-red',
}

const FINDING_PATH: Record<string, string> = { overlap: 'overlap', attest: 'attestation', renew: 'renewals', risk: 'risk', leanix: 'issues', unclassified: 'unclassified' }

function HealthTile({ icon, label, value, sub, good, onClick, source }: { icon: ReactNode; label: string; value: string; sub: string; good: boolean; onClick: () => void; source: string }) {
  return (
    <div className="group flex items-start gap-3 rounded-md px-2 py-2 hover:bg-slate-50">
      <span className={cx('mt-0.5 rounded-md p-1.5', good ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{icon}</span>
      <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
        <span className="block text-[11px] font-bold tracking-wide text-slate-500 uppercase">{label}</span>
        <span className="num block text-[20px] leading-tight font-bold text-navy group-hover:underline">{value}</span>
        <span className="block text-xs text-slate-500">{sub}</span>
      </button>
      <SourceLink path={source} className="mt-0.5" />
    </div>
  )
}

export function OverviewV5() {
  const route = useRoute()
  const state = useDataState()
  const lm = useLayerMap()
  const { contracts, riskEvents } = useModuleData()
  const phase = useDemo((s) => s.phase)
  const env = useDemo((s) => s.env)
  const notify = useUi((u) => u.notify)
  const available = useAvailableScreens()
  const measure = (HEAT_MEASURES.some((m) => m.id === route.params.get('measure')) ? route.params.get('measure') : 'cost') as HeatMeasure

  const input = { state, lm, contracts, events: riskEvents }
  const list = useMemo(() => findings({ state, lm, contracts, events: riskEvents }), [state, lm, contracts, riskEvents])
  const health = mapHealth(state, phase, env)
  const h = useMemo(() => heatMatrix(state, lm, riskEvents), [state, lm, riskEvents])
  const renewals = contracts.filter((c) => daysUntil(c.renewal) >= 0 && daysUntil(c.renewal) <= 120).sort((a, b) => a.renewal.localeCompare(b.renewal))
  const monthAgo = Date.now() - 30 * 86_400_000
  const recent = state.history.filter((e) => new Date(e.at).getTime() >= monthAgo && !e.undone)
  const byKind = new Map<string, number>()
  for (const e of recent) byKind.set(e.kind, (byKind.get(e.kind) ?? 0) + 1)
  const lastFeed = state.feedRuns[0]

  /** Go to a screen if it is on in this phase; otherwise to the screen that switches it on. */
  const go = (screen: Finding['screen'], params: Record<string, string> = {}) => {
    if (available.includes(screen)) navigate(screen, params)
    else if (available.includes('modules')) {
      navigate('modules')
      notify('Switch the module on to open that view')
    }
  }

  return (
    <>
      <PageHeader
        title="Overview"
        description="How Investments runs its tools, in one page. Findings first, then the evidence behind them."
        actions={
          <>
            <Badge tone="neutral" title="Synthetic data; cost and contract values are estimates">
              Illustrative figures
            </Badge>
            <Button
              variant="primary"
              icon={<FileSpreadsheet size={14} />}
              onClick={() => {
                const file = downloadReportPack(input)
                notify(`Downloaded ${file}`)
              }}
            >
              Report pack
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card title="Headline findings" subtitle={`Worked out from the map just now · ${plural(list.length, 'finding')}`} bodyClassName="p-0">
          <ol className="divide-y divide-slate-100">
            {list.map((f, i) => (
              <li key={f.id} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms`, animationFillMode: 'backwards' }}>
                <div className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', TONE[f.tone])} />
                  <button type="button" onClick={() => go(f.screen, f.params as Record<string, string>)} className="flex-1 text-left font-display text-[15px] leading-snug text-ink hover:text-navy">
                    {f.sentence}
                  </button>
                  <SourceLink path={FINDING_PATH[f.id] ?? 'tools'} className="mt-1" />
                  <button type="button" onClick={() => go(f.screen, f.params as Record<string, string>)} aria-label="Open the evidence" className="mt-0.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent-600">
                    <ArrowRight size={15} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Map health" subtitle="Is the map fit to rely on?" bodyClassName="grid grid-cols-1 gap-1 p-2">
          <HealthTile icon={<CheckCircle2 size={16} />} label="Attestation coverage" source="attestation" value={`${health.attestation}%`} sub="of desk usage confirmed" good={health.attestation >= 80} onClick={() => go('desk')} />
          <HealthTile
            icon={<Database size={16} />}
            label="Data freshness" source="freshness"
            value={`${health.sourcesFresh}/${health.sourcesTotal}`}
            sub="sources inside their refresh window"
            good={health.sourcesFresh === health.sourcesTotal}
            onClick={() => go('architecture')}
          />
          <HealthTile
            icon={<GitCompare size={16} />}
            label="Reconciliation drift" source="issues"
            value={String(health.openIssues)}
            sub={`open issues${health.lastDrift !== null ? ` · ${plural(health.lastDrift, 'change')} at the last LeanIX sync` : ' · LeanIX not synced this month'}`}
            good={health.openIssues === 0}
            onClick={() => go('import', { tab: 'issues' })}
          />
          <HealthTile icon={<Tags size={16} />} label="Unclassified tools" source="unclassified" value={String(health.unclassified)} sub="no Tool type or capability" good={health.unclassified === 0} onClick={() => go('suggestions')} />
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Capability × strategy"
        subtitle={HEAT_MEASURES.find((m) => m.id === measure)!.label}
        actions={<span className="flex items-center gap-3"><SourceLink path={measure === 'cost' || measure === 'tools' ? 'cost' : 'risk'} /><Segmented size="sm" options={HEAT_MEASURES.map((m) => ({ id: m.id, label: m.short }))} value={measure} onChange={(v) => patchParams(route, { measure: v })} /></span>}
        bodyClassName="p-3"
      >
        <HeatGrid compact h={h} measure={measure} onCell={(cap, st) => go('heatmap', { measure, cell: heatKey(cap, st) })} />
        <p className="mt-2 text-[11px] text-slate-400">
          Cost split evenly across the strategies each tool reaches. {fmtMeasure(Math.round(h.unplacedCost), 'cost')} reaches no strategy. Click a cell for the tools behind it.
        </p>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Upcoming renewals" subtitle="Next 120 days" bodyClassName="p-0" actions={<span className="flex items-center gap-2"><SourceLink path="renewals" /><Button size="sm" variant="ghost" onClick={() => go('vendors')}>All contracts <ArrowRight size={13} /></Button></span>}>
          {renewals.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No renewals in the next 120 days.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {renewals.map((c) => {
                const passed = daysUntil(addDays(c.renewal, -c.noticeDays)) < 0
                return (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                    <CalendarClock size={15} className={passed ? 'text-brand-red' : 'text-slate-400'} />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-ink">{c.vendor}</span>
                      <span className="block truncate text-xs text-slate-500">{c.toolNames.join(', ')}</span>
                    </span>
                    <span className="text-right text-xs">
                      <span className="block font-semibold text-ink">{fmtDate(c.renewal)}</span>
                      {passed ? <span className="text-brand-red">notice passed</span> : <span className="text-slate-500">notice by {fmtDate(addDays(c.renewal, -c.noticeDays))}</span>}
                    </span>
                    <span className="num w-16 text-right font-semibold">{fmtK(c.valueK)}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        <Card title="What changed this month" subtitle={`${plural(recent.length, 'change')} in the last 30 days`} bodyClassName="p-0" actions={<Button size="sm" variant="ghost" onClick={() => go('changes')}>History <ArrowRight size={13} /></Button>}>
          <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-4 py-2.5">
            {[...byKind.entries()].map(([k, n]) => (
              <Badge key={k} tone="accent">
                {n} {k}
              </Badge>
            ))}
            {lastFeed && <Badge tone="neutral">LeanIX sync {fmtWhen(lastFeed.at)}: {plural(lastFeed.drift.length, 'change')}</Badge>}
          </div>
          <ul className="divide-y divide-slate-100">
            {recent.slice(0, 6).map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2 text-[13px]">
                <History size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 text-ink">{e.summary}</span>
                <span className="shrink-0 text-right text-xs text-slate-500">
                  {e.actor}
                  <span className="block">{fmtWhen(e.at)}</span>
                </span>
              </li>
            ))}
            {recent.length === 0 && <li className="px-4 py-3 text-xs text-slate-500">Nothing changed in the last 30 days.</li>}
          </ul>
        </Card>
      </div>
    </>
  )
}
