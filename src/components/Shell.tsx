import {
  AlertTriangle,
  Blocks,
  Building2,
  CalendarClock,
  Compass,
  FileInput,
  Flame,
  GitPullRequestArrow,
  LayoutDashboard,
  MessageSquareText,
  Layers,
  Network,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Table2,
  Tags,
  Workflow,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useDemo, useFeature } from '../demo-store'
import { AskPanel } from './AskPanel'
import { brandOn, LOGO_SRC } from '../lib/brand'
import { buildData, type DataMode } from '../lib/demoData'
import { activeSources, ARRIVAL_LABEL, phase as phaseDef, PHASES, type ScreenId } from '../lib/phases'
import { freshness, isStale } from '../lib/freshness'
import { ROLES, type RoleId } from '../lib/roles'
import { NAV_GROUP_LABEL, SCREEN_META, type NavGroup } from '../lib/screens'
import { useAvailableScreens } from '../nav'
import { href, useRoute } from '../router'
import { useStore } from '../store'
import { useUi } from '../ui-store'
import { LayerBadge, useToolSearch } from './common'
import { Button, cx, Modal } from './ui'

const ICONS: Record<ScreenId, ReactNode> = {
  journey: <Compass size={16} />,
  overview: <LayoutDashboard size={16} />,
  import: <FileInput size={16} />,
  taxonomy: <Tags size={16} />,
  explorer: <Table2 size={16} />,
  capability: <Network size={16} />,
  desk: <Building2 size={16} />,
  foundation: <Layers size={16} />,
  changes: <GitPullRequestArrow size={16} />,
  suggestions: <Sparkles size={16} />,
  modules: <Blocks size={16} />,
  vendors: <CalendarClock size={16} />,
  heatmap: <Flame size={16} />,
  risk: <AlertTriangle size={16} />,
  architecture: <Workflow size={16} />,
}

function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const results = useToolSearch(q, undefined, 8)
  const openTool = useUi((s) => s.openTool)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  const pick = (id: string) => {
    openTool(id)
    setQ('')
    setOpen(false)
    ref.current?.blur()
  }

  const show = open && q.trim().length > 0
  return (
    <div className="relative w-full max-w-md">
      <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
      <input
        ref={ref}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1))
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0))
          else if (e.key === 'Enter' && results[active]) pick(results[active].tool.id)
          else if (e.key === 'Escape') {
            setQ('')
            ref.current?.blur()
          }
        }}
        placeholder="Search tools and aliases…"
        className="h-8 w-full rounded-md border border-slate-300 bg-slate-50 pr-14 pl-9 text-[13px] placeholder:text-slate-400 focus:border-accent-500 focus:bg-white focus:ring-2 focus:ring-accent-100 focus:outline-none"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-slate-200 bg-white px-1.5 text-[10px] text-slate-400">Ctrl K</kbd>
      {show && (
        <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
          {results.length === 0 && <div className="px-3 py-3 text-xs text-slate-500">No tool or alias matches “{q}”.</div>}
          {results.map((r, i) => (
            <button
              key={r.tool.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(r.tool.id)}
              onMouseEnter={() => setActive(i)}
              className={cx('flex w-full items-center justify-between gap-3 px-3 py-2 text-left', i === active && 'bg-accent-50')}
            >
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-slate-800">{r.tool.name}</span>
                {r.alias && <span className="block truncate text-xs text-slate-500">alias: {r.alias}</span>}
              </span>
              <LayerBadge layer={r.layer} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ResetButton() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const reset = useStore((s) => s.resetToSeed)
  const notify = useUi((s) => s.notify)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white">
        <RotateCcw size={13} /> Reset data
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset the data?"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                await reset()
                useUi.getState().closeTool()
                useUi.getState().closeCell()
                setBusy(false)
                setOpen(false)
                notify('Data reset')
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-slate-600">All edits, imports, aliases and resolved issues are cleared and the map goes back to its starting point for this mode (sample data in Demo, empty in Manual). The phase stays as it is. This can’t be undone.</p>
      </Modal>
    </>
  )
}

/** Demo: sample data already there. Manual: start empty and drop the files in. */
function DataModeToggle() {
  const mode = useDemo((s) => s.dataMode)
  const setMode = useDemo((s) => s.setDataMode)
  const hydrate = useStore((s) => s.hydrateFrom)
  const notify = useUi((s) => s.notify)
  const [busy, setBusy] = useState(false)
  const choose = async (m: DataMode) => {
    if (m === mode || busy) return
    setBusy(true)
    setMode(m)
    useUi.getState().closeTool()
    useUi.getState().closeCell()
    hydrate(await buildData(m))
    setBusy(false)
    notify(m === 'demo' ? 'Demo data loaded: 1,100 tools, with LeanIX, EUC register and Jira reconciled' : 'Manual mode: the map is empty. Drop the files in on Import & Reconcile.')
    if (m === 'manual') window.location.hash = '#/import'
  }
  return (
    <div className="inline-flex items-center rounded bg-white/10 p-0.5" role="radiogroup" aria-label="Data">
      {(['demo', 'manual'] as DataMode[]).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          disabled={busy}
          onClick={() => void choose(m)}
          title={m === 'demo' ? 'Sample data already loaded and reconciled' : 'Start empty and drop the files in yourself'}
          className={cx('h-6 rounded px-2.5 text-xs font-semibold transition-colors', mode === m ? 'bg-white text-navy' : 'text-white/75 hover:text-white', busy && 'opacity-60')}
        >
          {m === 'demo' ? 'Demo data' : 'Manual'}
        </button>
      ))}
    </div>
  )
}

/** Presenter controls: the phase. The environment follows from it. Kept visually apart from the product chrome. */
function DemoBar() {
  const phase = useDemo((s) => s.phase)
  const setPhase = useDemo((s) => s.setPhase)
  const p = phaseDef(phase)
  return (
    <div className="flex h-10 shrink-0 items-center gap-3 bg-navy px-4 text-white">
      <span className="text-[11px] font-bold tracking-wider text-white/60 uppercase">Demo</span>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Phase">
        {PHASES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={x.id === phase}
            title={`Phase ${x.id}: ${x.name}`}
            onClick={() => setPhase(x.id)}
            className={cx(
              'num h-7 min-w-7 rounded px-2 text-xs font-bold transition-colors',
              x.id === phase ? 'bg-white text-navy shadow-sm' : 'text-white/75 hover:bg-white/10 hover:text-white',
            )}
          >
            {x.id}
          </button>
        ))}
      </div>
      <div className="min-w-0 truncate text-[13px]">
        <span className="font-bold">Phase {p.id}</span>
        <span className="text-white/60"> · </span>
        <span className="font-display">{p.name}</span>
      </div>
      <div className="ml-auto flex items-center gap-3">
        <DataModeToggle />
        <ResetButton />
      </div>
    </div>
  )
}

function RolePicker() {
  const roleId = useDemo((s) => s.role)
  const setRole = useDemo((s) => s.setRole)
  const r = ROLES.find((x) => x.id === roleId)
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600" title={r?.summary}>
      <ShieldCheck size={14} className="text-accent-600" />
      <span className="hidden lg:inline">Signed in as</span>
      <select
        value={roleId}
        onChange={(e) => setRole(e.target.value as RoleId)}
        className="h-7 rounded border border-slate-300 bg-white pr-6 pl-1.5 text-xs font-semibold text-ink hover:border-slate-400 focus:border-accent-500 focus:outline-none"
        aria-label="Simulated signed-in role"
      >
        {ROLES.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Environment chrome under the header: what kind of install this is, and how fresh each source is. */
function EnvStrip() {
  const phase = useDemo((s) => s.phase)
  const env = useDemo((s) => s.env)
  if (env === 'sandbox') {
    return (
      <div className="flex shrink-0 items-center gap-2.5 border-b border-amber-200 bg-amber-50 px-5 py-1.5 text-xs text-amber-900">
        <span className="rounded bg-amber-400/90 px-1.5 py-px text-[11px] font-bold text-amber-950">{phase === 1 ? 'Local' : 'Sandbox'}</span>
        <span>{phase === 1 ? 'Runs on this laptop. Files dropped in by hand. Saved in this browser only.' : 'A test copy her team can try together. Files dropped in by hand. Not connected to live systems.'}</span>
      </div>
    )
  }
  const sources = activeSources(phase, env)
  const shown = sources.slice(0, 4)
  const more = sources.length - shown.length
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-panel px-5 py-1.5 text-xs text-slate-600">
      <span className="rounded bg-slate-700 px-1.5 py-px text-[11px] font-bold text-white">Production</span>
      <div className="flex min-w-0 flex-1 items-center gap-x-3 overflow-hidden whitespace-nowrap">
        <span className="font-semibold text-slate-700">Freshness</span>
        {shown.map(({ def, arrives }) => (
          <span key={def.id} title={`${def.name}: ${ARRIVAL_LABEL[arrives]}`} className="inline-flex items-center gap-1">
            <span className={cx('h-1.5 w-1.5 rounded-full', isStale(def.id, arrives) ? 'bg-amber-500' : 'bg-emerald-500')} />
            {def.name} <span className="text-slate-400">{freshness(def.id, arrives)}</span>
          </span>
        ))}
        {more > 0 && (
          <span className="font-medium text-slate-500" title={sources.slice(4).map((x) => `${x.def.name}: ${freshness(x.def.id, x.arrives)}`).join('\n')}>
            +{more} more
          </span>
        )}
      </div>
      <span className="shrink-0 rounded border border-slate-300 bg-white px-1.5 py-px text-[11px] font-semibold text-slate-500" title="Sign-in, sources and figures are simulated in this demo">
        Illustrative
      </span>
    </div>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { screen } = useRoute()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    main.current?.scrollTo(0, 0)
  }, [screen])
  const openIssues = useStore((s) => s.issues.filter((i) => i.status === 'Open').length)
  const env = useDemo((s) => s.env)
  const screens = useAvailableScreens()
  const askOn = useFeature('ask-map')
  const askOpen = useUi((u) => u.askOpen)
  const setAskOpen = useUi((u) => u.setAskOpen)
  const groups: NavGroup[] = ['story', 'map', 'modules']
  return (
    <div className="flex h-full min-w-0 flex-col">
      <DemoBar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-panel">
          <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4">
            {brandOn ? <img src={LOGO_SRC} alt="L&G" className="h-8 w-auto" /> : <img src="/favicon.svg" alt="" className="h-7 w-7" />}
            <div className="leading-tight">
              <div className="font-display text-[13px] font-bold text-ink">Investments</div>
              <div className="text-[11px] tracking-wide text-slate-500 uppercase">Tech Map</div>
            </div>
          </div>
          <nav className="flex-1 overflow-y-auto p-2 scroll-thin">
            {groups.map((g) => {
              const items = screens.filter((id) => SCREEN_META[id].group === g)
              if (!items.length) return null
              return (
                <div key={g} className="mb-2">
                  <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{NAV_GROUP_LABEL[g]}</div>
                  <div className="space-y-0.5">
                    {items.map((id) => (
                      <a
                        key={id}
                        href={href(id)}
                        className={cx(
                          'relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] font-medium transition-colors',
                          screen === id
                            ? 'bg-white font-bold text-navy shadow-sm ring-1 ring-slate-200 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent-600'
                            : 'text-slate-600 hover:bg-white/70 hover:text-ink',
                        )}
                      >
                        <span className={screen === id ? 'text-accent-600' : 'text-slate-400'}>{ICONS[id]}</span>
                        <span className="flex-1 truncate">{SCREEN_META[id].label}</span>
                        {id === 'import' && openIssues > 0 && <span className="num rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{openIssues}</span>}
                      </a>
                    ))}
                  </div>
                </div>
              )
            })}
          </nav>
          <div className="border-t border-slate-200 p-3 text-[11px] leading-snug text-slate-400">Demo · synthetic data</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5">
            <span className="hidden font-display text-sm font-bold whitespace-nowrap text-ink xl:block">Investments Tech Map</span>
            <div className="flex flex-1 justify-center">
              <GlobalSearch />
            </div>
            {askOn && (
              <button
                type="button"
                onClick={() => setAskOpen(!askOpen)}
                className={cx('inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-[13px] font-semibold transition-colors', askOpen ? 'border-accent-600 bg-accent-600 text-white' : 'border-accent-200 bg-accent-50 text-accent-800 hover:bg-accent-100')}
              >
                <MessageSquareText size={15} /> Ask the map
              </button>
            )}
            {env === 'prod' && <RolePicker />}
          </header>
          <EnvStrip />
          <main ref={main} className="min-w-0 flex-1 overflow-y-auto px-5 py-5 scroll-thin">
            <div key={screen ?? ''} className="animate-fade-up">
              {children}
            </div>
          </main>
        </div>
      </div>
      {askOn && <AskPanel />}
    </div>
  )
}
