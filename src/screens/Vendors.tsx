import { CalendarClock, ChevronDown, ChevronRight, Download } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ToolLink } from '../components/common'
import { Badge, Button, Card, Chip, cx, EmptyState, PageHeader, Td, Th } from '../components/ui'
import { exportXlsx } from '../lib/export'
import { addDays, daysUntil, useModuleData, type Contract } from '../module-data'
import { fmtDate, fmtK, plural } from '../lib/util'
import { patchParams, useRoute } from '../router'
import { useStore } from '../store'
import { useUi } from '../ui-store'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WINDOWS = [90, 180, 365]

function monthIndex(iso: string, start: Date): number {
  const d = new Date(`${iso}T00:00:00`)
  return (d.getFullYear() - start.getFullYear()) * 12 + d.getMonth() - start.getMonth()
}

function urgency(c: Contract): 'red' | 'amber' | 'neutral' {
  const toNotice = daysUntil(addDays(c.renewal, -c.noticeDays))
  if (toNotice < 0) return 'red'
  if (toNotice <= 60) return 'amber'
  return 'neutral'
}

function Calendar({ contracts, onPick, selected }: { contracts: Contract[]; onPick: (id: string) => void; selected: string | null }) {
  const start = new Date()
  start.setDate(1)
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(start)
    d.setMonth(start.getMonth() + i)
    return `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
  })
  const parents = [...new Set(contracts.map((c) => c.parent))].sort((a, b) => sum(contracts.filter((c) => c.parent === b)) - sum(contracts.filter((c) => c.parent === a)))
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="grid grid-cols-[150px_repeat(12,minmax(0,1fr))] border-b border-slate-300 bg-panel text-[11px] font-bold tracking-wide text-slate-600 uppercase">
        <div className="px-3 py-2">Parent company</div>
        {months.map((m, i) => (
          <div key={m} className={cx('border-l border-slate-200 px-1 py-2 text-center', i === 0 && 'text-accent-700')}>
            {m}
          </div>
        ))}
      </div>
      {parents.map((p) => {
        const cs = contracts.filter((c) => c.parent === p)
        return (
          <div key={p} className="grid min-h-9 grid-cols-[150px_repeat(12,minmax(0,1fr))] border-b border-slate-100 last:border-0">
            <div className="flex flex-col justify-center px-3 py-1.5">
              <span className="truncate text-[13px] font-medium text-ink">{p}</span>
              <span className="num text-[11px] text-slate-500">{fmtK(sum(cs))} a year</span>
            </div>
            {months.map((m, i) => {
              const here = cs.filter((c) => monthIndex(c.renewal, start) === i)
              const inNotice = cs.some((c) => {
                const n = monthIndex(addDays(c.renewal, -c.noticeDays), start)
                const r = monthIndex(c.renewal, start)
                return i >= n && i < r
              })
              return (
                <div key={m} className={cx('flex flex-col items-stretch justify-center gap-1 border-l border-slate-100 px-0.5 py-1', inNotice && 'bg-amber-50')}>
                  {here.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      title={`${c.vendor} · ${c.toolNames.join(', ')} · renews ${fmtDate(c.renewal)} · ${fmtK(c.valueK)}`}
                      onClick={() => onPick(c.id)}
                      className={cx(
                        'truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight font-semibold text-white transition-transform hover:scale-[1.03]',
                        urgency(c) === 'red' ? 'bg-brand-red' : urgency(c) === 'amber' ? 'bg-amber-600' : 'bg-accent-600',
                        selected === c.id && 'ring-2 ring-navy ring-offset-1',
                      )}
                    >
                      {c.vendor}
                    </button>
                  ))}
                </div>
              )
            })}
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-panel px-3 py-2 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-amber-50 ring-1 ring-amber-200" /> Notice window
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-brand-red" /> Notice deadline passed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-amber-600" /> Notice due within 60 days
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-accent-600" /> Later
        </span>
      </div>
    </div>
  )
}

function sum(cs: Contract[]): number {
  return cs.reduce((s, c) => s + c.valueK, 0)
}

export function VendorsScreen() {
  const route = useRoute()
  const { contracts, loaded } = useModuleData()
  const tools = useStore((s) => s.tools)
  const notify = useUi((u) => u.notify)
  const window = WINDOWS.includes(Number(route.params.get('within'))) ? Number(route.params.get('within')) : 180
  const selected = route.params.get('contract')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const upcoming = useMemo(() => contracts.filter((c) => daysUntil(c.renewal) >= 0 && daysUntil(c.renewal) <= window).sort((a, b) => a.renewal.localeCompare(b.renewal)), [contracts, window])
  const next90 = contracts.filter((c) => daysUntil(c.renewal) >= 0 && daysUntil(c.renewal) <= 90)
  const parents = [...new Set(contracts.map((c) => c.parent))].sort((a, b) => sum(contracts.filter((c) => c.parent === b)) - sum(contracts.filter((c) => c.parent === a)))
  const toolIds = new Set(tools.map((t) => t.id))

  if (!loaded || contracts.length === 0) {
    return (
      <>
        <PageHeader title="Vendors & renewals" />
        <EmptyState icon={<CalendarClock size={28} />} title="No contracts loaded" hint="Drop in the contract register from Procurement to see renewals." />
      </>
    )
  }

  const exportView = () => {
    const rows = [['Parent company', 'Vendor', 'Contract', 'Tools', 'Annual value (£k)', 'Renewal date', 'Notice (days)', 'Notice deadline', 'Owner']]
    for (const c of [...contracts].sort((a, b) => a.renewal.localeCompare(b.renewal))) rows.push([c.parent, c.vendor, c.id, c.toolNames.join('; '), String(c.valueK), c.renewal, String(c.noticeDays), addDays(c.renewal, -c.noticeDays), c.owner])
    const file = exportXlsx('vendors-renewals', [{ name: 'Contracts', rows }])
    notify(`Downloaded ${file}`)
  }

  return (
    <>
      <PageHeader
        title="Vendors & renewals"
        description="Contracts joined to the tools they cover, grouped by parent company so one vendor group can be seen together."
        actions={
          <>
            <Badge tone="neutral">Illustrative contracts</Badge>
            <Button icon={<Download size={14} />} onClick={exportView}>
              Export
            </Button>
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 md:grid-cols-4">
        {[
          ['Annual contract value', fmtK(sum(contracts)), `${plural(contracts.length, 'contract')}`],
          ['Vendor groups', String(parents.length), `${new Set(contracts.map((c) => c.vendor)).size} vendors`],
          ['Renewing in 90 days', String(next90.length), fmtK(sum(next90))],
          ['Notice deadline passed', String(contracts.filter((c) => urgency(c) === 'red' && daysUntil(c.renewal) >= 0).length), 'renewal will roll'],
        ].map(([l, v, s]) => (
          <div key={l} className="bg-white px-4 py-3">
            <div className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{l}</div>
            <div className="num mt-1 text-[24px] leading-none font-bold text-navy">{v}</div>
            <div className="mt-1 text-xs text-slate-500">{s}</div>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-[13px] font-bold text-ink">Renewal calendar, next 12 months</h2>
      <Calendar contracts={contracts} selected={selected} onPick={(id) => patchParams(route, { contract: id })} />

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <Card
          title="Upcoming renewals"
          subtitle="Notice deadline is the renewal date less the notice period"
          bodyClassName="p-0"
          actions={
            <span className="flex gap-1">
              {WINDOWS.map((w) => (
                <Chip key={w} active={w === window} onClick={() => patchParams(route, { within: String(w) })}>
                  {w} days
                </Chip>
              ))}
            </span>
          }
        >
          {upcoming.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No renewals in the next {window} days.</p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr>
                  <Th>Contract</Th>
                  <Th>Renews</Th>
                  <Th>Notice by</Th>
                  <Th right>Value</Th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((c) => {
                  const nd = addDays(c.renewal, -c.noticeDays)
                  const u = urgency(c)
                  return (
                    <tr key={c.id} className={cx('cursor-pointer hover:bg-slate-50', selected === c.id && 'bg-accent-50')} onClick={() => patchParams(route, { contract: c.id })}>
                      <Td>
                        <div className="font-medium text-ink">{c.vendor}</div>
                        <div className="text-xs text-slate-500">
                          {c.id} · {c.toolNames.join(', ')}
                        </div>
                      </Td>
                      <Td className="whitespace-nowrap">
                        {fmtDate(c.renewal)} <span className="text-xs text-slate-400">({daysUntil(c.renewal)}d)</span>
                      </Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone={u}>{u === 'red' ? `Passed ${fmtDate(nd)}` : fmtDate(nd)}</Badge>
                      </Td>
                      <Td right className="font-semibold">
                        {fmtK(c.valueK)}
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Vendor hierarchy" subtitle="Parent › vendor › contract › tools" bodyClassName="p-0">
          <ul className="max-h-[480px] divide-y divide-slate-100 overflow-y-auto scroll-thin">
            {parents.map((p) => {
              const cs = contracts.filter((c) => c.parent === p)
              const open = !collapsed.has(p)
              const vendors = [...new Set(cs.map((c) => c.vendor))]
              return (
                <li key={p}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-slate-50"
                    onClick={() =>
                      setCollapsed((c) => {
                        const n = new Set(c)
                        if (n.has(p)) n.delete(p)
                        else n.add(p)
                        return n
                      })
                    }
                  >
                    {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    <span className="flex-1 font-bold text-ink">{p}</span>
                    <span className="num text-xs font-semibold">{fmtK(sum(cs))}</span>
                  </button>
                  {open && (
                    <div className="pb-2">
                      {vendors.map((v) => (
                        <div key={v} className="pr-4 pl-9">
                          {vendors.length > 1 || v !== p ? <div className="pt-1 text-xs font-semibold text-slate-600">{v}</div> : null}
                          {cs
                            .filter((c) => c.vendor === v)
                            .map((c) => (
                              <div key={c.id} className={cx('mt-1 rounded-md border px-2.5 py-1.5', selected === c.id ? 'border-accent-500 bg-accent-50' : 'border-slate-200')}>
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-medium text-slate-700">
                                    {c.id} · renews {fmtDate(c.renewal)}
                                  </span>
                                  <span className="num font-semibold">{fmtK(c.valueK)}</span>
                                </div>
                                <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs">
                                  {c.toolIds.map((id, i) => (toolIds.has(id) ? <ToolLink key={id} id={id} /> : <span key={id} className="text-slate-500">{c.toolNames[i]}</span>))}
                                </div>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </>
  )
}
