import { Building2, FileInput, LayoutDashboard, Layers, RotateCcw, Search, Table2, Tags } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { brandOn, LOGO_SRC } from '../lib/brand'
import { href, useRoute, type Screen } from '../router'
import { useStore } from '../store'
import { useUi } from '../ui-store'
import { LayerBadge, useToolSearch } from './common'
import { Button, cx, Modal } from './ui'

const NAV: { screen: Screen; label: string; icon: ReactNode }[] = [
  { screen: 'overview', label: 'Overview', icon: <LayoutDashboard size={16} /> },
  { screen: 'import', label: 'Import & Reconcile', icon: <FileInput size={16} /> },
  { screen: 'taxonomy', label: 'Taxonomy', icon: <Tags size={16} /> },
  { screen: 'explorer', label: 'Explorer', icon: <Table2 size={16} /> },
  { screen: 'desk', label: 'Desk View', icon: <Building2 size={16} /> },
  { screen: 'foundation', label: 'Foundation View', icon: <Layers size={16} /> },
]

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
      <Button icon={<RotateCcw size={14} />} onClick={() => setOpen(true)}>
        Reset to seed data
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset to seed data?"
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
                notify('Data reset to the seed files')
              }}
            >
              Reset
            </Button>
          </>
        }
      >
        <p className="text-[13px] text-slate-600">All edits, imports, aliases and resolved issues will be replaced with the original seed files. This can’t be undone.</p>
      </Modal>
    </>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  const { screen } = useRoute()
  const main = useRef<HTMLElement>(null)
  useEffect(() => {
    main.current?.scrollTo(0, 0)
  }, [screen])
  const openIssues = useStore((s) => s.issues.filter((i) => i.status === 'Open').length)
  return (
    <div className="flex h-full min-w-0">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-200 bg-panel">
        <div className="flex h-14 items-center gap-2.5 border-b border-slate-200 px-4">
          {brandOn ? <img src={LOGO_SRC} alt="L&G" className="h-8 w-auto" /> : <img src="/favicon.svg" alt="" className="h-7 w-7" />}
          <div className="leading-tight">
            <div className="font-display text-[13px] font-bold text-ink">Investments</div>
            <div className="text-[11px] tracking-wide text-slate-500 uppercase">Tech Map</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map((n) => (
            <a
              key={n.screen}
              href={href(n.screen)}
              className={cx(
                'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors',
                screen === n.screen ? 'bg-white font-bold text-navy shadow-sm ring-1 ring-slate-200 before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent-600' : 'text-slate-600 hover:bg-white/70 hover:text-ink',
              )}
            >
              <span className={screen === n.screen ? 'text-accent-600' : 'text-slate-400'}>{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {n.screen === 'import' && openIssues > 0 && <span className="num rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-800">{openIssues}</span>}
            </a>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 text-[11px] leading-snug text-slate-400">Prototype · synthetic data</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-slate-200 bg-white px-5">
          <span className="hidden font-display text-sm font-bold whitespace-nowrap text-ink xl:block">Investments Tech Map</span>
          <div className="flex flex-1 justify-center">
            <GlobalSearch />
          </div>
          <ResetButton />
        </header>
        <main ref={main} className="min-w-0 flex-1 overflow-y-auto px-5 py-5 scroll-thin">{children}</main>
      </div>
    </div>
  )
}
