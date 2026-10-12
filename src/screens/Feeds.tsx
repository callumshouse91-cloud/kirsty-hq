import { ArrowRight, CloudDownload, FileUp, Minus, Pencil, Plus, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card, EmptyState } from '../components/ui'
import { useDemo, usePermissions } from '../demo-store'
import { computeDrift, leanixRowsForRun, SCRIPTED_RUNS } from '../lib/feed'
import { freshness } from '../lib/freshness'
import { EUC_SOURCE, LEANIX_SOURCE, preMap } from '../lib/mapping'
import { activeSources, ARRIVAL_LABEL, type SourceId } from '../lib/phases'
import { fetchSampleFile, parseCsv } from '../lib/seed'
import { fmtWhen, plural } from '../lib/util'
import { useStore } from '../store'
import type { DriftItem, FeedRun } from '../types'
import { useUi } from '../ui-store'

const FEEDS: { source: string; sourceId: SourceId; file: string }[] = [
  { source: LEANIX_SOURCE, sourceId: 'leanix', file: 'leanix_export.csv' },
  { source: EUC_SOURCE, sourceId: 'euc', file: 'euc_register.csv' },
]

function DriftList({ drift }: { drift: DriftItem[] }) {
  if (drift.length === 0) return <p className="text-xs text-slate-500">No drift: every record matches the last sync.</p>
  const icon = { added: <Plus size={12} />, removed: <Minus size={12} />, changed: <Pencil size={11} /> }
  const tone = { added: 'green', removed: 'red', changed: 'amber' } as const
  const shown = drift.slice(0, 8)
  return (
    <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
      {shown.map((d) => (
        <li key={`${d.externalId}-${d.change}`} className="flex items-start gap-2.5 px-3 py-2 text-[13px]">
          <Badge tone={tone[d.change]} className="mt-px">
            {icon[d.change]} {d.change}
          </Badge>
          <div className="min-w-0">
            <span className="font-medium text-ink">{d.name}</span> <span className="text-xs text-slate-400">{d.externalId}</span>
            {d.fields && (
              <div className="mt-0.5 space-y-0.5 text-xs text-slate-600">
                {Object.entries(d.fields).map(([f, [a, b]]) => (
                  <div key={f}>
                    {f}: <span className="text-slate-400 line-through">{a || 'blank'}</span> <ArrowRight size={10} className="inline" /> <span className="font-medium">{b || 'blank'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
      {drift.length > shown.length && <li className="px-3 py-2 text-xs text-slate-500">and {drift.length - shown.length} more</li>}
    </ul>
  )
}

function FeedCard({ source, sourceId, file, onOpenReport }: { source: string; sourceId: SourceId; file: string; onOpenReport: (importId: string) => void }) {
  const phase = useDemo((s) => s.phase)
  const env = useDemo((s) => s.env)
  const allRuns = useStore((s) => s.feedRuns)
  const runs = allRuns.filter((r) => r.source === source)
  const categories = useStore((s) => s.categories)
  const importRows = useStore((s) => s.importRows)
  const addFeedRun = useStore((s) => s.addFeedRun)
  const imports = useStore((s) => s.imports)
  const notify = useUi((u) => u.notify)
  const canImport = usePermissions().can('import')
  const [busy, setBusy] = useState(false)
  const arrives = activeSources(phase, env).find((s) => s.def.id === sourceId)?.arrives
  const last: FeedRun | undefined = runs[0]
  const isFeed = env === 'prod' && arrives !== 'file-drop'
  const lastImport = imports.find((l) => l.source === source && l.id !== 'seed')

  const run = async () => {
    setBusy(true)
    try {
      const text = await (await fetchSampleFile(file)).text()
      const { headers, rows: base } = parseCsv(text)
      const n = Math.min(runs.length + 1, SCRIPTED_RUNS)
      const rows = sourceId === 'leanix' ? leanixRowsForRun(base, n) : base
      const headerMap = preMap(headers, categories)
      const previous = useStore.getState().sourceRecords.filter((r) => r.source === source)
      const drift = previous.length ? computeDrift(previous, rows, headerMap) : []
      importRows({ source, fileName: isFeed ? `${ARRIVAL_LABEL[arrives ?? 'api']} · ${file}` : file, headerMap, rows })
      addFeedRun({ source, at: new Date().toISOString(), mode: isFeed ? 'manual' : 'file', rows: rows.length, drift })
      notify(previous.length ? `${source}: ${plural(drift.length, 'change')} since the last sync, reconciled` : `${source}: first sync, ${plural(rows.length, 'row')} reconciled`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          {source}
          <Badge tone={isFeed ? 'green' : 'amber'}>{isFeed ? (arrives === 'api' ? 'Read-only API' : 'Scheduled export') : 'File drop'}</Badge>
        </span>
      }
      subtitle={isFeed ? `Every weekday at 06:00 · read-only · ${last ? `last run ${fmtWhen(last.at)}` : `last run ${freshness(sourceId, arrives ?? 'api')}`}` : 'Dropped in by hand. The latest file replaces the last one.'}
      actions={
        canImport ? (
          <Button size="sm" variant={isFeed ? 'secondary' : 'primary'} icon={isFeed ? <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> : <FileUp size={13} />} disabled={busy} onClick={run}>
            {isFeed ? 'Run now (simulated)' : 'Drop in the next sample file'}
          </Button>
        ) : undefined
      }
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">Drift since the last sync</h3>
        {last && (
          <span className="text-xs text-slate-500">
            {fmtWhen(last.at)} · {plural(last.rows, 'row')}
          </span>
        )}
      </div>
      {last ? (
        <DriftList drift={last.drift} />
      ) : (
        <p className="text-xs text-slate-500">{canImport ? `No sync run in this demo yet. ${isFeed ? 'Run now' : 'Drop in a file'} to pull the next ${source} export and see what moved.` : 'No sync run in this demo yet.'}</p>
      )}
      {lastImport && (
        <Button variant="link" className="mt-3 text-xs" onClick={() => onOpenReport(lastImport.id)}>
          Open the reconciliation report →
        </Button>
      )}
    </Card>
  )
}

export function FeedsTab({ onOpenReport }: { onOpenReport: (importId: string) => void }) {
  const env = useDemo((s) => s.env)
  const runs = useStore((s) => s.feedRuns)
  return (
    <div className="space-y-4">
      <p className="max-w-3xl text-[13px] text-slate-600">
        {env === 'prod'
          ? 'LeanIX is read on a schedule through a read-only connection. Nothing is written back: LeanIX stays the central record and the map reconciles to it. Simulated in this demo.'
          : 'In the sandbox there are no feeds. You drop the latest export in by hand and the map shows what moved since the last file.'}
      </p>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {FEEDS.map((f) => (
          <FeedCard key={f.source} {...f} onOpenReport={onOpenReport} />
        ))}
      </div>
      {runs.length > 0 && (
        <Card title="Sync log" bodyClassName="p-0">
          <ul className="divide-y divide-slate-100">
            {runs.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2 text-[13px]">
                <CloudDownload size={14} className="text-slate-400" />
                <span className="w-32 text-slate-600">{fmtWhen(r.at)}</span>
                <span className="font-medium text-ink">{r.source}</span>
                <span className="text-slate-500">{r.mode === 'file' ? 'file drop' : 'run now'}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {plural(r.rows, 'row')} · {plural(r.drift.length, 'change')}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {runs.length === 0 && env === 'prod' && <EmptyState title="No manual runs yet" hint="The schedule runs at 06:00 each weekday. Use “Run now” to see the next sync and its drift." />}
    </div>
  )
}
