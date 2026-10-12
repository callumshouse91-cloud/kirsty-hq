import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Copy, GitPullRequestArrow, History, RefreshCw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, Button, Card, cx } from '../components/ui'
import { useDemo } from '../demo-store'
import { capabilityTree, capLabel, duplicateCaps, overlapCount } from '../lib/capability'
import { LEANIX_SOURCE } from '../lib/mapping'
import { fmtDate, fmtK, fmtWhen, plural } from '../lib/util'
import { addDays, daysUntil, useModuleData } from '../module-data'
import { useAvailableScreens } from '../nav'
import { navigate, type Params } from '../router'
import { useDataState, useLayerMap } from '../store'
import type { ScreenId } from '../lib/phases'

function NewBadge({ phase }: { phase: number }) {
  return (
    <Badge tone="accent" title={`Added in Phase ${phase}`}>
      Phase {phase}
    </Badge>
  )
}

function Row({ icon, label, value, tone = 'neutral', onClick }: { icon: ReactNode; label: string; value: ReactNode; tone?: 'neutral' | 'amber' | 'green' | 'red'; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className="group flex w-full items-center gap-3 px-4 py-2.5 text-left enabled:hover:bg-slate-50">
      <span className={cx('rounded-md p-1.5', tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700' : tone === 'red' ? 'bg-red-50 text-brand-red' : 'bg-slate-100 text-slate-500')}>{icon}</span>
      <span className="flex-1 text-[13px] text-slate-700">{label}</span>
      <span className="num text-[15px] font-bold text-navy group-enabled:group-hover:underline">{value}</span>
    </button>
  )
}

/**
 * The parts of the Overview that arrive with each phase, so the dashboard visibly grows:
 * Phase 2 overlaps, Phase 3 map health, Phase 4 renewals and risk.
 */
export function OverviewGrowth() {
  const phase = useDemo((s) => s.phase)
  const state = useDataState()
  const lm = useLayerMap()
  const { contracts, riskEvents } = useModuleData()
  const available = useAvailableScreens()
  const go = (screen: ScreenId, params: Params = {}) => {
    if (available.includes(screen)) navigate(screen, params)
    else navigate('modules')
  }
  if (phase < 2) return null

  const tree = capabilityTree(state, lm)
  const dups = duplicateCaps(tree, 4).slice(0, 5)

  const lastSync = state.feedRuns.find((r) => r.source === LEANIX_SOURCE)
  const openIssues = state.issues.filter((i) => i.status === 'Open').length
  const pending = state.approvals.filter((a) => a.status === 'Pending').length
  const monthAgo = Date.now() - 30 * 86_400_000
  const changes = state.history.filter((h) => !h.undone && new Date(h.at).getTime() >= monthAgo).length

  const renewals = contracts.filter((c) => daysUntil(c.renewal) >= 0 && daysUntil(c.renewal) <= 90).sort((a, b) => a.renewal.localeCompare(b.renewal))
  const capOf = new Map<string, { key: string; label: string }>()
  for (const g of tree) for (const n of g.children) for (const t of n.tools) capOf.set(t.id, { key: n.key, label: capLabel(n) })
  const byCap = new Map<string, { key: string; label: string; n: number; loss: number }>()
  for (const e of riskEvents) {
    const c = capOf.get(e.toolId)
    if (!c) continue
    const x = byCap.get(c.key) ?? { ...c, n: 0, loss: 0 }
    x.n++
    x.loss += e.lossK
    byCap.set(c.key, x)
  }
  const risk = [...byCap.values()].sort((a, b) => b.loss - a.loss).slice(0, 5)
  const maxLoss = Math.max(1, ...risk.map((r) => r.loss))

  return (
    <>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title={
            <span className="flex items-center gap-2">
              Where tools overlap <NewBadge phase={2} />
            </span>
          }
          subtitle="Capabilities served by 4 or more tools of the same layer"
          bodyClassName="p-0"
          actions={
            <Button size="sm" variant="ghost" onClick={() => go('capability', { only: '1', dup: '4' })}>
              Capability View <ArrowRight size={13} />
            </Button>
          }
        >
          {dups.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No capability has 4 or more tools of one layer.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dups.map((n) => {
                const o = overlapCount(n)
                return (
                  <li key={n.key}>
                    <button type="button" onClick={() => go('capability', { sel: n.key })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
                      <Copy size={14} className="text-amber-600" />
                      <span className="flex-1 text-[13px] text-ink">{capLabel(n)}</span>
                      <span className="text-xs text-slate-500">
                        {o.count} {o.layer === 'Application' ? 'applications' : 'foundations'}
                      </span>
                      <span className="num w-16 text-right text-[13px] font-semibold">{fmtK(n.cost)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {phase >= 3 ? (
          <Card
            title={
              <span className="flex items-center gap-2">
                Is the map up to date? <NewBadge phase={3} />
              </span>
            }
            subtitle="Shared by the team, kept in step with LeanIX"
            bodyClassName="p-0 divide-y divide-slate-100"
          >
            <Row icon={<RefreshCw size={15} />} label="LeanIX sync" value={lastSync ? `${fmtWhen(lastSync.at)} · ${plural(lastSync.drift.length, 'change')}` : 'Every weekday 06:00'} tone={lastSync ? 'green' : 'neutral'} onClick={() => go('import', { tab: 'feeds' })} />
            <Row icon={<AlertTriangle size={15} />} label="Open reconciliation issues" value={openIssues} tone={openIssues ? 'amber' : 'green'} onClick={() => go('import', { tab: 'issues' })} />
            <Row icon={<GitPullRequestArrow size={15} />} label="Taxonomy changes waiting for approval" value={pending} tone={pending ? 'amber' : 'green'} onClick={() => go('changes', { tab: 'approvals' })} />
            <Row icon={<History size={15} />} label="Changes in the last 30 days" value={changes} onClick={() => go('changes')} />
          </Card>
        ) : (
          <Card title="Unclassified and desk-built tools" subtitle="What still needs a home in the taxonomy" bodyClassName="p-0 divide-y divide-slate-100">
            <Row icon={<CheckCircle2 size={15} />} label="Tools with no Tool type or capability" value={state.tools.filter((t) => !t.toolType || !t.capL2 || !t.capL3).length} tone="amber" onClick={() => go('explorer', { rows: 'capL2', col: 'toolType', measure: 'tools' })} />
            <Row icon={<CheckCircle2 size={15} />} label="Desk-built tools (EUCs)" value={state.tools.filter((t) => /\(EUC\)/.test(t.name) || t.invUserGroup === 'Desk-built').length} onClick={() => go('import')} />
          </Card>
        )}
      </div>

      {phase >= 4 && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card
            title={
              <span className="flex items-center gap-2">
                Renewals in the next 90 days <NewBadge phase={4} />
              </span>
            }
            subtitle={`${plural(renewals.length, 'contract')} · ${fmtK(renewals.reduce((s, c) => s + c.valueK, 0))} a year`}
            bodyClassName="p-0"
            actions={
              <Button size="sm" variant="ghost" onClick={() => go('vendors', { within: '90' })}>
                Vendors <ArrowRight size={13} />
              </Button>
            }
          >
            {renewals.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">No renewals in the next 90 days.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {renewals.map((c) => {
                  const passed = daysUntil(addDays(c.renewal, -c.noticeDays)) < 0
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                      <CalendarClock size={14} className={passed ? 'text-brand-red' : 'text-slate-400'} />
                      <span className="min-w-0 flex-1 truncate text-ink">{c.vendor}</span>
                      <span className={cx('text-xs', passed ? 'font-semibold text-brand-red' : 'text-slate-500')}>{passed ? 'notice passed' : fmtDate(c.renewal)}</span>
                      <span className="num w-16 text-right font-semibold">{fmtK(c.valueK)}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          <Card
            title={
              <span className="flex items-center gap-2">
                Risk events by capability <NewBadge phase={4} />
              </span>
            }
            subtitle="Loss in the last 12 months"
            bodyClassName="p-0"
            actions={
              <Button size="sm" variant="ghost" onClick={() => go('risk')}>
                Risk events <ArrowRight size={13} />
              </Button>
            }
          >
            {risk.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">No risk events link to tools in the map.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {risk.map((r) => (
                  <li key={r.key}>
                    <button type="button" onClick={() => go('risk', { cap: r.key })} className="grid w-full grid-cols-[minmax(0,1fr)_120px_64px] items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-slate-50">
                      <span className="truncate text-ink">{r.label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <span className="block h-full rounded-full bg-brand-red" style={{ width: `${(r.loss / maxLoss) * 100}%` }} />
                      </span>
                      <span className="num text-right font-semibold">{fmtK(r.loss)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  )
}
