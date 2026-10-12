import { ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, FileSpreadsheet, FileUp, Plus, RotateCcw, Sparkles, Upload, X } from 'lucide-react'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import { usePermissions } from '../demo-store'
import { ToolLink, VendorFlag } from '../components/common'
import { Badge, Button, Card, Chip, cx, EmptyState, Input, Label, PageHeader, Select, Tabs, Td, Th } from '../components/ui'
import { readWorkbook, type ParsedSheet } from '../lib/export'
import { catKey, FIELD_TARGETS, fieldKey, guessSource, IGNORE, mappedValue, parseTarget, preMap, targetLabel } from '../lib/mapping'
import { learn, missingType, MISSING_IN_MASTER, NAME_MISMATCH, suggestTool, TYPE_CONFLICT } from '../lib/reconcile'
import { fetchSampleFile, parseCsv } from '../lib/seed'
import { CAT, isToolCategory, termsOf } from '../lib/taxonomy'
import { fmtDate, plural } from '../lib/util'
import { patchParams, useRoute } from '../router'
import { useDataState, useStore } from '../store'
import { MASTER_SOURCE, type Issue, type SourceRecord, type Tool } from '../types'
import { useUi } from '../ui-store'

// ───────────────────────────── file → mapping ─────────────────────────────

interface LoadedFile {
  fileName: string
  sheets: ParsedSheet[]
}

function DropZone({ onFile }: { onFile: (f: File) => void }) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
      onClick={() => input.current?.click()}
      className={cx(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
        over ? 'border-accent-500 bg-accent-50' : 'border-slate-300 bg-slate-50/60 hover:border-slate-400 hover:bg-slate-50',
      )}
    >
      <Upload size={28} className={over ? 'text-accent-600' : 'text-slate-400'} />
      <p className="mt-3 text-sm font-medium text-slate-800">Drop a CSV or Excel file here</p>
      <p className="mt-1 text-xs text-slate-500">or click to browse · .csv, .xlsx — the master list format and LeanIX exports are recognised automatically</p>
      <input
        ref={input}
        type="file"
        accept=".csv,.xlsx,.xls,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function TargetSelect({ value, onChange, categories }: { value: string; onChange: (v: string) => void; categories: string[] }) {
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)} className={cx('h-7 w-full text-xs', value === IGNORE && 'text-slate-400')}>
      <option value={IGNORE}>Ignore</option>
      <optgroup label="Tool field">
        {FIELD_TARGETS.map((f) => (
          <option key={f.field} value={fieldKey(f.field)}>
            {f.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Taxonomy category">
        {categories.map((c) => (
          <option key={c} value={catKey(c)}>
            {c}
          </option>
        ))}
      </optgroup>
    </Select>
  )
}

function Mapper({ file, onCancel, onRun }: { file: LoadedFile; onCancel: () => void; onRun: (source: string, sheet: ParsedSheet, headerMap: Record<string, string>) => void }) {
  const state = useDataState()
  const toolCats = state.categories.filter(isToolCategory)
  const usable = file.sheets.filter((s) => s.headers.length > 0 && s.rows.length > 0)
  // prefer a recognised export from another system (LeanIX), then the master list format, then anything with a name column
  const rank = (s: ParsedSheet) => {
    const g = guessSource(s.headers, file.fileName)
    if (g === 'LeanIX') return 0
    if (g === MASTER_SOURCE) return 1
    return Object.values(preMap(s.headers, toolCats)).includes(fieldKey('name')) ? 2 : 3
  }
  const firstGood = [...usable].sort((a, b) => rank(a) - rank(b))[0]
  const [sheetName, setSheetName] = useState(firstGood?.name ?? '')
  const sheet = usable.find((s) => s.name === sheetName) ?? firstGood
  const [map, setMap] = useState<Record<string, string>>(() => (sheet ? preMap(sheet.headers, toolCats) : {}))
  const [source, setSource] = useState(() => (sheet ? guessSource(sheet.headers, file.fileName) : ''))

  if (!sheet) {
    return <EmptyState title="Nothing to import" hint="That file has no rows with a header. Check the first row holds column names." action={<Button onClick={onCancel}>Choose another file</Button>} />
  }

  const pickSheet = (name: string) => {
    const s = usable.find((x) => x.name === name)
    if (!s) return
    setSheetName(name)
    setMap(preMap(s.headers, toolCats))
    setSource(guessSource(s.headers, file.fileName))
  }

  const mapped = sheet.headers.filter((h) => (map[h] ?? IGNORE) !== IGNORE)
  const hasName = Object.values(map).includes(fieldKey('name'))
  const existing = state.sourceRecords.filter((r) => r.source === source.trim()).length
  const dupTargets = Object.values(map).filter((t, i, a) => t !== IGNORE && a.indexOf(t) !== i)

  const validCell = (target: string, v: string) => {
    const t = parseTarget(target)
    if (t.kind !== 'cat' || !v) return true
    return termsOf(state.taxonomy, t.category).includes(v)
  }

  return (
    <div className="space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <FileSpreadsheet size={15} className="text-emerald-700" /> {file.fileName}
          </span>
        }
        subtitle={`${plural(sheet.rows.length, 'row')} · ${plural(sheet.headers.length, 'column')}`}
        actions={
          <Button size="sm" variant="ghost" icon={<X size={13} />} onClick={onCancel}>
            Choose another file
          </Button>
        }
      >
        {usable.length > 1 && (
          <div className="mb-4">
            <Label>Sheet</Label>
            <div className="flex flex-wrap gap-1.5">
              {usable.map((s) => (
                <Chip key={s.name} active={s.name === sheet.name} onClick={() => pickSheet(s.name)}>
                  {s.name} <span className="opacity-70">· {s.rows.length}</span>
                </Chip>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-end gap-4">
          <label>
            <Label>Source name</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} className="w-56" />
          </label>
          <p className="pb-1.5 text-xs text-slate-500">
            {existing > 0 ? (
              <span className="text-amber-700">Re-importing “{source}” replaces its {plural(existing, 'existing record')} and re-runs the diff.</span>
            ) : (
              <>Tools in the master list with no row here will be flagged as {missingType(source || 'Source')}.</>
            )}
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card title="Map columns" subtitle="Pre-mapped where the header matches a known schema" bodyClassName="p-0">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <Th>File column</Th>
                <Th>Maps to</Th>
              </tr>
            </thead>
            <tbody>
              {sheet.headers.map((h) => (
                <tr key={h}>
                  <Td>
                    <div className="font-medium text-slate-800">{h}</div>
                    <div className="max-w-40 truncate text-xs text-slate-400">e.g. {sheet.rows[0]?.[h] || '—'}</div>
                  </Td>
                  <Td className="w-52">
                    <TargetSelect value={map[h] ?? IGNORE} onChange={(v) => setMap({ ...map, [h]: v })} categories={toolCats} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card
          title="Preview"
          subtitle={`First ${Math.min(20, sheet.rows.length)} of ${sheet.rows.length} rows, as mapped`}
          actions={
            <Button variant="primary" icon={<Sparkles size={14} />} disabled={!hasName || !source.trim() || dupTargets.length > 0} onClick={() => onRun(source.trim(), sheet, map)}>
              Run reconciliation
            </Button>
          }
          bodyClassName="p-0"
        >
          {!hasName && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">Map one column to “Tool name” to match rows against the master list.</p>}
          {dupTargets.length > 0 && <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">Two columns map to “{targetLabel(dupTargets[0])}”. Each target can only be used once.</p>}
          <div className="max-h-[440px] overflow-auto scroll-thin">
            {mapped.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">Map at least one column to see a preview.</p>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0">
                  <tr>
                    {mapped.map((h) => (
                      <th key={h} className="border-b border-slate-200 bg-slate-50 px-2.5 py-1.5 text-left font-semibold whitespace-nowrap text-slate-600">
                        {targetLabel(map[h])}
                        <div className="font-normal text-slate-400">{h}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sheet.rows.slice(0, 20).map((r, i) => (
                    <tr key={i}>
                      {mapped.map((h) => {
                        const ok = validCell(map[h], r[h] ?? '')
                        return (
                          <td key={h} className={cx('border-b border-slate-100 px-2.5 py-1 whitespace-nowrap', !ok && 'bg-amber-50 text-amber-800')} title={ok ? undefined : `“${r[h]}” is not a ${targetLabel(map[h])} term`}>
                            {r[h]}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {mapped.some((h) => sheet.rows.some((r) => !validCell(map[h], r[h] ?? ''))) && (
            <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-amber-100 align-middle ring-1 ring-amber-200" /> Values not in the taxonomy are kept as raw source data — they never overwrite a tool, and are only used to suggest values for new tools.
            </p>
          )}
        </Card>
      </div>
    </div>
  )
}

// ───────────────────────────── report ─────────────────────────────

function FuzzyRow({ rec }: { rec: SourceRecord }) {
  const s = useStore()
  const notify = useUi((u) => u.notify)
  const canImport = usePermissions().can('import')
  const [pick, setPick] = useState(rec.matchedToolId ?? rec.candidates[0]?.toolId ?? '')
  const toolById = new Map(s.tools.map((t) => [t.id, t]))
  const done = rec.resolution === 'accepted'
  const cand = rec.candidates.find((c) => c.toolId === pick)
  return (
    <li className={cx('grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5', done && 'bg-emerald-50/40')}>
      <div className="min-w-0">
        <div className="truncate font-medium text-slate-800">{rec.rawName}</div>
        <div className="text-xs text-slate-500">
          {rec.source}
          {rec.externalId && ` · ${rec.externalId}`}
        </div>
      </div>
      <ArrowRight size={16} className="text-slate-300" />
      <div className="min-w-0">
        {done ? (
          <ToolLink id={rec.matchedToolId!} />
        ) : rec.candidates.length > 1 ? (
          <Select value={pick} onChange={(e) => setPick(e.target.value)} className="h-7 w-full text-xs font-medium">
            {rec.candidates.map((c) => (
              <option key={c.toolId} value={c.toolId}>
                {toolById.get(c.toolId)?.name} ({Math.round(c.score * 100)}%)
              </option>
            ))}
          </Select>
        ) : (
          <ToolLink id={pick} />
        )}
        <div className="text-xs text-slate-500">
          Master list{!done && cand && <> · {Math.round(cand.score * 100)}% name similarity</>}
          {rec.candidates.length > 1 && !done && ` · ${rec.candidates.length} candidates`}
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {done ? (
          <Badge tone="green">
            <Check size={11} /> Confirmed · alias saved
          </Badge>
        ) : !canImport ? (
          <Badge tone="amber">Awaiting confirmation</Badge>
        ) : (
          <>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                s.confirmFuzzy(rec.id, pick)
                notify(`“${rec.rawName}” saved as an alias of ${toolById.get(pick)?.name}`)
              }}
            >
              Confirm match
            </Button>
            <Button size="sm" onClick={() => s.rejectFuzzy(rec.id)}>
              Not a match
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

function UnmatchedRow({ rec, learned }: { rec: SourceRecord; learned: ReturnType<typeof learn> }) {
  const state = useDataState()
  const s = useStore()
  const notify = useUi((u) => u.notify)
  const canImport = usePermissions().can('import')
  const suggestion = useMemo(() => suggestTool(state, rec, learned), [state, rec, learned])
  const [draft, setDraft] = useState<Omit<Tool, 'id'>>(suggestion.tool)
  const type = mappedValue(rec.raw, rec.headerMap, fieldKey('sourceType'))

  if (rec.resolution === 'created' || rec.resolution === 'ignored') {
    return (
      <li className="flex items-center justify-between gap-3 px-4 py-2 text-slate-500">
        <span className={cx('truncate', rec.resolution === 'ignored' && 'line-through')}>{rec.rawName}</span>
        {rec.resolution === 'created' ? (
          <span className="flex items-center gap-2">
            <Badge tone="green">Created</Badge>
            <ToolLink id={rec.matchedToolId!} className="text-xs" />
          </span>
        ) : (
          <Badge>Ignored</Badge>
        )}
      </li>
    )
  }

  const sel = (category: string, key: 'toolType' | 'capL2' | 'capL3') => (
    <label className="min-w-0">
      <span className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
        {category}
        {suggestion.inferred.includes(category) && draft[key] === suggestion.tool[key] && (
          <span className="rounded bg-violet-50 px-1 text-[9px] font-semibold text-violet-700 normal-case ring-1 ring-violet-200" title={`Suggested from ${rec.source}’s own values`}>
            suggested
          </span>
        )}
      </span>
      <Select value={draft[key]} onChange={(e) => setDraft({ ...draft, [key]: e.target.value })} className="h-7 w-full text-xs">
        <option value="">—</option>
        {termsOf(state.taxonomy, category).map((t) => (
          <option key={t}>{t}</option>
        ))}
      </Select>
    </label>
  )

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="font-medium text-slate-800">{rec.rawName}</span>
          <span className="ml-2 text-xs text-slate-500">
            {[rec.externalId, type && `type “${type}”`].filter(Boolean).join(' · ')}
          </span>
        </div>
        {canImport ? (
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="primary"
            icon={<Plus size={13} />}
            onClick={() => {
              s.createFromRecord(rec.id, { ...draft, name: draft.name.trim() || rec.rawName })
              notify(`Created ${rec.rawName}`)
            }}
          >
            Create as new tool
          </Button>
          <Button size="sm" onClick={() => s.ignoreRecord(rec.id)}>
            Ignore
          </Button>
        </div>
        ) : (
          <Badge tone="violet">Awaiting a decision</Badge>
        )}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {sel(CAT.toolType, 'toolType')}
        {sel(CAT.capL2, 'capL2')}
        {sel(CAT.capL3, 'capL3')}
      </div>
    </li>
  )
}

function Collapsible({ title, count, children, defaultOpen = true, tone }: { title: ReactNode; count: number; children: ReactNode; defaultOpen?: boolean; tone?: 'amber' | 'red' | 'green' }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left">
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        <span className="text-[13px] font-semibold text-slate-800">{title}</span>
        <Badge tone={tone ?? 'neutral'}>{count}</Badge>
      </button>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </section>
  )
}

function Report({ importId, onNew }: { importId: string; onNew: () => void }) {
  const state = useDataState()
  const log = state.imports.find((l) => l.id === importId)
  const records = state.sourceRecords.filter((r) => r.importId === importId)
  const learned = useMemo(() => (log ? learn(state, log.source) : null), [state, log])
  if (!log || !learned) return <EmptyState title="That import is no longer available" hint="It was replaced by a newer import of the same source." action={<Button onClick={onNew}>Import a file</Button>} />

  const exact = records.filter((r) => r.matchType === 'exact' || r.matchType === 'alias')
  const fuzzy = records.filter((r) => r.matchType === 'fuzzy')
  const fuzzyPending = fuzzy.filter((r) => r.resolution === 'pending')
  const unmatched = records.filter((r) => r.matchType === 'unmatched')
  const unmatchedPending = unmatched.filter((r) => r.resolution === 'pending')
  const missing = state.issues.filter((i) => i.type === missingType(log.source) && i.status === 'Open')
  const conflicts = state.issues.filter((i) => i.type === TYPE_CONFLICT && i.source === log.source && i.status === 'Open')

  const tile = (label: string, n: number, sub: string, tone: string) => (
    <div className={cx('rounded-lg border px-4 py-3', tone)}>
      <div className="text-[11px] font-semibold tracking-wide uppercase opacity-80">{label}</div>
      <div className="num mt-0.5 text-2xl font-semibold">{n}</div>
      <div className="text-xs opacity-80">{sub}</div>
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-slate-600">
          <span className="font-semibold text-slate-900">{log.source}</span> · {log.fileName} · {fmtDate(log.date)} · {plural(log.rowCount, 'row')}
        </p>
        <Button icon={<FileUp size={14} />} onClick={onNew}>
          Import another file
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tile('Matched exactly', exact.length + fuzzy.filter((r) => r.resolution === 'accepted').length, `${exact.filter((r) => r.matchType === 'alias').length} via alias · ${fuzzy.filter((r) => r.resolution === 'accepted').length} confirmed`, 'border-emerald-200 bg-emerald-50/60 text-emerald-900')}
        {tile('Possible renames', fuzzyPending.length, fuzzyPending.length ? 'need confirmation' : 'all reviewed', 'border-amber-200 bg-amber-50/60 text-amber-900')}
        {tile(`Only in ${log.source}`, unmatchedPending.length, `${unmatched.filter((r) => r.resolution === 'created').length} created · ${unmatched.filter((r) => r.resolution === 'ignored').length} ignored`, 'border-violet-200 bg-violet-50/60 text-violet-900')}
        {tile(`Missing in ${log.source}`, missing.length, 'master-list tools with no row', 'border-red-200 bg-red-50/60 text-red-900')}
      </div>

      {fuzzy.length > 0 && (
        <Collapsible title="Possible renames — same tool, different name?" count={fuzzyPending.length} tone={fuzzyPending.length ? 'amber' : 'green'}>
          <ul className="divide-y divide-slate-100 text-[13px]">
            {[...fuzzyPending, ...fuzzy.filter((r) => r.resolution !== 'pending')].map((r) => (
              <FuzzyRow key={r.id} rec={r} />
            ))}
          </ul>
        </Collapsible>
      )}

      {unmatched.length > 0 && (
        <Collapsible title={`In ${log.source} but not in the master list`} count={unmatchedPending.length} tone={unmatchedPending.length ? 'amber' : 'green'}>
          <ul className="divide-y divide-slate-100 text-[13px]">
            {[...unmatchedPending, ...unmatched.filter((r) => r.resolution !== 'pending')].map((r) => (
              <UnmatchedRow key={r.id} rec={r} learned={learned} />
            ))}
          </ul>
        </Collapsible>
      )}

      {missing.length > 0 && (
        <Collapsible title={`In the master list but missing from ${log.source}`} count={missing.length} tone="red">
          <ul className="grid grid-cols-1 gap-x-6 px-4 py-2 text-[13px] md:grid-cols-2">
            {missing.map((i) => {
              const t = state.tools.find((x) => x.id === i.toolId)
              return (
                <li key={i.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5">
                  {i.toolId && <ToolLink id={i.toolId} />}
                  {t && <VendorFlag v={t.vendor} />}
                </li>
              )
            })}
          </ul>
          <p className="px-4 pb-3 text-xs text-slate-500">Each is logged as a {missingType(log.source)} issue — resolve them on the Issues tab.</p>
        </Collapsible>
      )}

      {conflicts.length > 0 && (
        <Collapsible title="Type conflicts" count={conflicts.length} tone="amber">
          <ul className="divide-y divide-slate-100 px-4 text-[13px]">
            {conflicts.map((i) => (
              <li key={i.id} className="py-2 text-slate-700">
                {i.detail}
              </li>
            ))}
          </ul>
        </Collapsible>
      )}

      <Collapsible title="Matched exactly" count={exact.length} defaultOpen={false} tone="green">
        <ul className="grid grid-cols-1 gap-x-6 px-4 py-2 text-[13px] md:grid-cols-3">
          {exact.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5">
              <ToolLink id={r.matchedToolId!} />
              {r.matchType === 'alias' && <Badge tone="accent">alias</Badge>}
            </li>
          ))}
        </ul>
      </Collapsible>

      {fuzzyPending.length === 0 && unmatchedPending.length === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          <CheckCircle2 size={16} /> Every row from this import has been reviewed.
        </div>
      )}
    </div>
  )
}

// ───────────────────────────── issues & log ─────────────────────────────

const REASONS = ['Not tracked there (expected)', 'Raised with source owner', 'Fixed in source system', 'Not a real tool']

function IssueAction({ issue, onReview }: { issue: Issue; onReview: (importId: string) => void }) {
  const s = useStore()
  const [reason, setReason] = useState(REASONS[0])
  const rec = issue.sourceRecordId ? s.sourceRecords.find((r) => r.id === issue.sourceRecordId) : undefined
  const canImport = usePermissions().can('import')
  if (!canImport) return <span className="text-xs text-slate-400">{issue.status === 'Resolved' ? 'Resolved' : 'Open'}</span>
  if (issue.status === 'Resolved') {
    return (
      <Button size="sm" variant="ghost" icon={<RotateCcw size={12} />} onClick={() => s.reopenIssue(issue.id)}>
        Reopen
      </Button>
    )
  }
  if (rec && rec.resolution === 'pending' && (issue.type === NAME_MISMATCH || issue.type === MISSING_IN_MASTER)) {
    return (
      <Button size="sm" variant="primary" onClick={() => onReview(rec.importId)}>
        Review match
      </Button>
    )
  }
  return (
    <span className="inline-flex items-center gap-1">
      <Select value={reason} onChange={(e) => setReason(e.target.value)} className="h-7 w-44 text-xs" aria-label="Resolution">
        {REASONS.map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
      <Button size="sm" onClick={() => s.resolveIssue(issue.id, reason)}>
        Resolve
      </Button>
    </span>
  )
}

function IssuesTab({ onReview }: { onReview: (importId: string) => void }) {
  const route = useRoute()
  const state = useDataState()
  const type = route.params.get('type') ?? ''
  const source = route.params.get('source') ?? ''
  const showResolved = route.params.get('resolved') === '1'
  const [q, setQ] = useState('')
  const toolById = new Map(state.tools.map((t) => [t.id, t]))
  const recById = new Map(state.sourceRecords.map((r) => [r.id, r]))
  const types = [...new Set(state.issues.map((i) => i.type))].sort()
  const sources = [...new Set(state.issues.map((i) => i.source))].sort()
  const list = state.issues
    .filter((i) => (showResolved ? true : i.status === 'Open'))
    .filter((i) => !type || i.type === type)
    .filter((i) => !source || i.source === source)
    .filter((i) => !q || `${i.detail} ${toolById.get(i.toolId ?? '')?.name ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (a.status === b.status ? a.type.localeCompare(b.type) : a.status === 'Open' ? -1 : 1))
  const openCount = state.issues.filter((i) => i.status === 'Open').length

  if (state.issues.length === 0) {
    return <EmptyState title="No issues yet" hint="Import a file on the Import tab — reconciliation raises an issue for every mismatch it finds." action={<Button onClick={() => patchParams(route, { tab: null })}>Go to Import</Button>} />
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select value={type} onChange={(e) => patchParams(route, { type: e.target.value })} aria-label="Issue type">
          <option value="">All types</option>
          {types.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Select value={source} onChange={(e) => patchParams(route, { source: e.target.value })} aria-label="Source">
          <option value="">All sources</option>
          {sources.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by tool or text…" className="w-56" />
        <Chip active={showResolved} onClick={() => patchParams(route, { resolved: showResolved ? null : '1' })}>
          Show resolved
        </Chip>
        <span className="ml-auto text-xs text-slate-500">
          {plural(openCount, 'open issue')} · showing {list.length}
        </span>
      </div>
      {list.length === 0 ? (
        <EmptyState title="No issues match" hint="Clear a filter, or turn on “Show resolved”." />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-[13px]">
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Item</Th>
                <Th>Detail</Th>
                <Th right>Action</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const resolved = i.status === 'Resolved'
                const rec = i.sourceRecordId ? recById.get(i.sourceRecordId) : undefined
                return (
                  <tr key={i.id} className={cx(resolved && 'bg-slate-50/70 text-slate-400')}>
                    <Td className="w-40">
                      <Badge tone={resolved ? 'neutral' : i.type === NAME_MISMATCH || i.type === TYPE_CONFLICT ? 'amber' : i.type === MISSING_IN_MASTER ? 'violet' : 'red'}>{i.type}</Badge>
                      <div className="mt-0.5 text-[11px] text-slate-400">{i.source}</div>
                    </Td>
                    <Td className={cx('w-56', resolved && 'line-through')}>{i.toolId && toolById.has(i.toolId) ? <ToolLink id={i.toolId} className={resolved ? 'text-slate-400' : ''} /> : <span className="font-medium">{rec?.rawName ?? '—'}</span>}</Td>
                    <Td>
                      <span className={cx(resolved && 'line-through')}>{i.detail}</span>
                      {resolved && i.resolution && <div className="mt-0.5 text-xs text-emerald-700 no-underline">✓ {i.resolution}</div>}
                    </Td>
                    <Td right className="whitespace-nowrap">
                      <IssueAction issue={i} onReview={onReview} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LogTab({ onOpen }: { onOpen: (importId: string) => void }) {
  const state = useDataState()
  const live = new Set(state.sourceRecords.map((r) => r.importId))
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            <Th>Source</Th>
            <Th>File</Th>
            <Th>Date</Th>
            <Th right>Rows</Th>
            <Th right>Matched</Th>
            <Th right>To confirm</Th>
            <Th right>Created</Th>
            <Th right>Ignored</Th>
            <Th right>Unmatched</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {state.imports.map((l) => (
            <tr key={l.id} className={cx(!live.has(l.id) && 'text-slate-400')}>
              <Td className="font-medium">{l.source}</Td>
              <Td className="text-xs">{l.fileName}</Td>
              <Td className="text-xs whitespace-nowrap">{fmtDate(l.date)}</Td>
              <Td right>{l.rowCount}</Td>
              <Td right>{l.matched}</Td>
              <Td right>{l.fuzzy || ''}</Td>
              <Td right>{l.created}</Td>
              <Td right>{l.ignored || ''}</Td>
              <Td right>{l.unmatched || ''}</Td>
              <Td right>
                {l.id === 'seed' ? (
                  <span className="text-xs text-slate-400">initial load</span>
                ) : live.has(l.id) ? (
                  <Button size="sm" variant="link" className="text-xs" onClick={() => onOpen(l.id)}>
                    Open report
                  </Button>
                ) : (
                  <span className="text-xs">replaced</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ───────────────────────────── screen ─────────────────────────────

export function ImportScreen() {
  const route = useRoute()
  const state = useDataState()
  const importRows = useStore((s) => s.importRows)
  const notify = useUi((u) => u.notify)
  const [file, setFile] = useState<LoadedFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tab = (['issues', 'log'] as const).find((t) => t === route.params.get('tab')) ?? 'import'
  const runId = route.params.get('run')
  const openIssues = state.issues.filter((i) => i.status === 'Open').length
  const canImport = usePermissions().can('import')

  const load = async (f: File) => {
    setError(null)
    try {
      if (/\.(xlsx|xls)$/i.test(f.name)) {
        setFile({ fileName: f.name, sheets: await readWorkbook(f) })
      } else {
        const { headers, rows } = parseCsv(await f.text())
        setFile({ fileName: f.name, sheets: [{ name: f.name, headers, rows }] })
      }
      patchParams(route, { run: null, tab: null })
    } catch {
      setError(`Couldn’t read ${f.name}. Is it a CSV or Excel file?`)
    }
  }

  const latestOpen = state.imports.find((l) => l.id !== 'seed' && state.sourceRecords.some((r) => r.importId === l.id))

  let body: ReactNode
  if (tab === 'issues') body = <IssuesTab onReview={(id) => patchParams(route, { tab: null, run: id, type: null, source: null, resolved: null })} />
  else if (tab === 'log') body = <LogTab onOpen={(id) => patchParams(route, { tab: null, run: id })} />
  else if (runId) body = <Report importId={runId} onNew={() => patchParams(route, { run: null })} />
  else if (file)
    body = (
      <Mapper
        key={file.fileName}
        file={file}
        onCancel={() => setFile(null)}
        onRun={(source, sheet, headerMap) => {
          const id = importRows({ source, fileName: file.fileName === sheet.name ? file.fileName : `${file.fileName} › ${sheet.name}`, headerMap, rows: sheet.rows })
          setFile(null)
          patchParams(route, { run: id })
          notify(`Reconciled ${sheet.rows.length} rows from ${source}`)
        }}
      />
    )
  else if (!canImport)
    body = (
      <EmptyState
        icon={<FileSpreadsheet size={26} />}
        title="Imports are run by change leads and tech leads"
        hint={latestOpen ? 'You can read the latest reconciliation report, the issues and the import log.' : 'No reconciliation has been run yet. The Issues and Import log tabs show what has been done so far.'}
        action={
          latestOpen ? (
            <Button variant="primary" onClick={() => patchParams(route, { run: latestOpen.id })}>
              Open the last report ({latestOpen.source})
            </Button>
          ) : undefined
        }
      />
    )
  else
    body = (
      <div className="space-y-4">
        <DropZone onFile={load} />
        {error && <p className="text-[13px] text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <Button
            icon={<FileSpreadsheet size={14} />}
            onClick={async () => {
              await load(await fetchSampleFile('leanix_export.csv'))
            }}
          >
            Use the sample LeanIX export
          </Button>
          {latestOpen && (
            <Button variant="link" onClick={() => patchParams(route, { run: latestOpen.id })}>
              Back to the last report ({latestOpen.source}, {fmtDate(latestOpen.date)}) →
            </Button>
          )}
        </div>
      </div>
    )

  return (
    <>
      <PageHeader title="Import & Reconcile" description="Bring in another source, match it to the master list, and work through the differences." />
      <div className="mb-4">
        <Tabs
          tabs={[
            { id: 'import', label: 'Import' },
            {
              id: 'issues',
              label: (
                <>
                  Issues {openIssues > 0 && <span className="num rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{openIssues}</span>}
                </>
              ),
            },
            { id: 'log', label: 'Import log' },
          ]}
          value={tab}
          onChange={(t) => patchParams(route, { tab: t === 'import' ? null : t })}
        />
      </div>
      {body}
    </>
  )
}
