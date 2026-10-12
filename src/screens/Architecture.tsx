import { ChevronRight, Cloud, KeyRound, Lock, Server, Sparkles, X } from 'lucide-react'
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Badge, Button, cx, Drawer, PageHeader } from '../components/ui'
import { useDemo } from '../demo-store'
import { buildArchitecture, COLUMNS, FIGURE_PATHS, highlightFor, type ArchNode } from '../lib/architecture'
import { phase as phaseDef } from '../lib/phases'
import { useAvailableScreens } from '../nav'
import { navigate, patchParams, useRoute } from '../router'
import type { ScreenId } from '../lib/phases'

const PLATFORM_ICON: Record<string, ReactNode> = {
  code: <Server size={14} />,
  hosting: <Cloud size={14} />,
  signin: <Lock size={14} />,
  secrets: <KeyRound size={14} />,
  model: <Sparkles size={14} />,
}

interface Line {
  key: string
  d: string
  on: boolean
  active: boolean
}

function NodeBox({ n, selected, lit, dim, onClick, setRef }: { n: ArchNode; selected: boolean; lit: boolean; dim: boolean; onClick: () => void; setRef: (el: HTMLButtonElement | null) => void }) {
  return (
    <button
      ref={setRef}
      type="button"
      onClick={onClick}
      className={cx(
        'relative z-10 w-full rounded-md border px-2.5 py-1.5 text-left text-[12px] leading-snug transition-all duration-200',
        n.active ? 'border-slate-300 bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,0.05)] hover:border-accent-500' : 'border-dashed border-slate-300 bg-slate-50 text-slate-400 hover:text-slate-600',
        lit && n.active && 'border-accent-600 bg-accent-50 text-navy ring-1 ring-accent-600',
        lit && !n.active && 'border-accent-300 text-slate-600',
        selected && 'ring-2 ring-navy',
        dim && 'opacity-40',
      )}
    >
      <span className="block font-semibold">{n.label}</span>
      {n.tag && <span className={cx('mt-0.5 block text-[10px] font-semibold tracking-wide uppercase', n.active ? 'text-accent-700' : 'text-slate-400')}>{n.tag}</span>}
    </button>
  )
}

function Panel({ n, onClose }: { n: ArchNode; onClose: () => void }) {
  const available = useAvailableScreens()
  const viewId = n.id.startsWith('view:') ? (n.id.slice(5) as ScreenId) : null
  const rows: [string, ReactNode][] = [
    ['What it is', n.what],
    ['Owner', n.owner],
    ['Format', n.format],
    ['Refresh', n.refresh],
    ['Status in this phase', <Badge key="s" tone={n.active ? 'green' : 'neutral'}>{n.status}</Badge>],
  ]
  return (
    <Drawer
      open
      onClose={onClose}
      title={n.label}
      subtitle={COLUMNS.find((c) => c.id === n.column)?.label}
      width="w-[400px]"
      footer={
        viewId && available.includes(viewId) ? (
          <Button variant="primary" onClick={() => navigate(viewId)}>
            Open {n.label}
          </Button>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <dl className="divide-y divide-slate-100 px-5 text-[13px]">
        {rows.map(([k, v]) => (
          <div key={k} className="py-2.5">
            <dt className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{k}</dt>
            <dd className="mt-0.5 text-ink">{v}</dd>
          </div>
        ))}
        <div className="py-2.5">
          <dt className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">{n.column === 'user' ? 'Screens they use' : n.column === 'view' ? 'Who uses it' : 'Screens and numbers that depend on it'}</dt>
          <dd className="mt-1">
            {n.dependents.length ? (
              <ul className="space-y-0.5">
                {n.dependents.map((d) => (
                  <li key={d} className="flex items-center gap-1 text-ink">
                    <ChevronRight size={12} className="text-slate-400" />
                    {d}
                  </li>
                ))}
              </ul>
            ) : (
              <span className="text-slate-500">Nothing in this phase.</span>
            )}
          </dd>
        </div>
      </dl>
    </Drawer>
  )
}

export function ArchitectureScreen() {
  const route = useRoute()
  const phase = useDemo((s) => s.phase)
  const env = useDemo((s) => s.env)
  const available = useAvailableScreens()
  const arch = useMemo(() => buildArchitecture(phase, env, available), [phase, env, available])
  const pathId = route.params.get('path')
  const figure = pathId ? FIGURE_PATHS[pathId] : undefined
  const selectedId = route.params.get('node')
  const selected = arch.nodes.find((n) => n.id === selectedId) ?? null
  const [hover, setHover] = useState<string | null>(null)

  const lit = useMemo(() => {
    if (figure) return new Set(figure.nodes.filter((id) => arch.nodes.some((n) => n.id === id && n.active)))
    const focus = hover ?? selectedId
    return focus ? highlightFor(arch, focus) : null
  }, [figure, hover, selectedId, arch])

  const wrap = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const [lines, setLines] = useState<Line[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const draw = () => {
      const box = el.getBoundingClientRect()
      setSize({ w: box.width, h: box.height })
      const out: Line[] = []
      for (const e of arch.edges) {
        const a = refs.current.get(e.from)?.getBoundingClientRect()
        const b = refs.current.get(e.to)?.getBoundingClientRect()
        if (!a || !b) continue
        const x1 = a.right - box.left
        const y1 = a.top + a.height / 2 - box.top
        const x2 = b.left - box.left
        const y2 = b.top + b.height / 2 - box.top
        const mx = (x1 + x2) / 2
        out.push({ key: `${e.from}>${e.to}`, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, on: !!lit && lit.has(e.from) && lit.has(e.to), active: true })
      }
      setLines(out)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(el)
    return () => ro.disconnect()
  }, [arch, lit])

  const p = phaseDef(phase)
  return (
    <>
      <PageHeader
        title="Architecture"
        description={`Where everything comes from in Phase ${p.id}, ${env === 'sandbox' ? 'local sandbox' : 'production'}. Click any box for its owner, format, refresh and what depends on it.`}
        actions={<Badge tone={env === 'sandbox' ? 'amber' : 'neutral'}>{env === 'sandbox' ? 'Local sandbox' : 'Production'}</Badge>}
      />

      {figure && (
        <div className="animate-fade-up mb-3 flex items-center gap-3 rounded-lg border border-accent-200 bg-accent-50 px-4 py-2.5 text-[13px] text-accent-800">
          <span>
            Showing the path behind <span className="font-bold">{figure.label}</span> on the Overview.
          </span>
          <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs font-semibold hover:underline" onClick={() => patchParams(route, { path: null })}>
            <X size={12} /> Clear
          </button>
        </div>
      )}

      <div className="mb-2 grid grid-cols-6 gap-6 px-1">
        {COLUMNS.map((c, i) => (
          <div key={c.id} className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
            <span className="num flex h-4 w-4 items-center justify-center rounded-full bg-navy text-[9px] text-white">{i + 1}</span>
            {c.label}
          </div>
        ))}
      </div>

      <div ref={wrap} className="relative rounded-lg border border-slate-200 bg-[linear-gradient(to_right,#f4f5f5_1px,transparent_1px)] bg-[size:calc(100%/6)_100%] p-3" onMouseLeave={() => setHover(null)}>
        <svg className="pointer-events-none absolute inset-0" width={size.w} height={size.h} aria-hidden="true">
          {lines
            .filter((l) => !l.on)
            .map((l) => (
              <path key={l.key} d={l.d} fill="none" stroke={lit ? '#e2e8f0' : '#cbd5e1'} strokeWidth={1} />
            ))}
          {lines
            .filter((l) => l.on)
            .map((l) => (
              <path key={l.key} d={l.d} fill="none" stroke="#005dba" strokeWidth={1.75} className="transition-all" />
            ))}
        </svg>
        <div className="grid grid-cols-6 gap-6">
          {COLUMNS.map((c) => (
            <div key={c.id} className="flex flex-col justify-center gap-1.5">
              {arch.nodes
                .filter((n) => n.column === c.id)
                .map((n) => (
                  <div key={n.id} onMouseEnter={() => !figure && setHover(n.id)}>
                    <NodeBox
                      n={n}
                      selected={selectedId === n.id}
                      lit={!!lit?.has(n.id)}
                      dim={!!lit && !lit.has(n.id)}
                      onClick={() => patchParams(route, { node: n.id, path: null })}
                      setRef={(el) => {
                        if (el) refs.current.set(n.id, el)
                        else refs.current.delete(n.id)
                      }}
                    />
                  </div>
                ))}
            </div>
          ))}
        </div>
      </div>

      {arch.platform ? (
        <section className="mt-4 rounded-lg border border-slate-300 bg-panel p-3">
          <div className="mb-2 flex items-center gap-2">
            <h2 className="text-[11px] font-bold tracking-wider text-slate-600 uppercase">Platform</h2>
            <Badge tone="amber">Proposed, to confirm with the platform team</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {arch.platform.map((x) => (
              <div key={x.id} className={cx('rounded-md border bg-white px-3 py-2', x.active ? 'border-slate-200' : 'border-dashed border-slate-300 opacity-60')} title={x.detail}>
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-ink">
                  <span className="text-accent-600">{PLATFORM_ICON[x.id]}</span>
                  {x.label}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-slate-500">{x.detail}</p>
                {x.tag && <span className="mt-1 inline-block text-[10px] font-semibold tracking-wide text-slate-400 uppercase">{x.tag}</span>}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="mt-3 text-xs text-slate-500">In the sandbox nothing is hosted: the app and its data stay on this laptop. Switch to Production to see the proposed platform.</p>
      )}
      <p className="mt-3 text-xs text-slate-500">LeanIX stays the central record: the map reads from it and reconciles to it, and never writes back.</p>

      {selected && <Panel n={selected} onClose={() => patchParams(route, { node: null })} />}
    </>
  )
}
