import { CheckCircle2, Circle, Search } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { buildIndex, similarity } from '../lib/match'
import { CAT, layerOf, termsOf } from '../lib/taxonomy'
import { fmtDate } from '../lib/util'
import { navigate } from '../router'
import { useLayerMap, useStore } from '../store'
import { ATTESTED, type Layer, type Tool, type Vendor } from '../types'
import { useUi } from '../ui-store'
import { Badge, cx, Input } from './ui'

export function ToolLink({ id, className, children }: { id: string; className?: string; children?: ReactNode }) {
  const tool = useStore((s) => s.tools.find((t) => t.id === id))
  const openTool = useUi((s) => s.openTool)
  if (!tool) return <span className="text-slate-400 italic">Unknown tool</span>
  return (
    <button type="button" onClick={() => openTool(id)} className={cx('text-left font-medium text-slate-800 decoration-accent-500/60 underline-offset-2 hover:text-accent-700 hover:underline', className)}>
      {children ?? tool.name}
    </button>
  )
}

/** A foundation name that takes you to the Foundation View. */
export function FoundationLink({ id, className }: { id: string; className?: string }) {
  const tool = useStore((s) => s.tools.find((t) => t.id === id))
  if (!tool) return null
  return (
    <button type="button" onClick={() => navigate('foundation', { id })} className={cx('text-left font-medium text-slate-800 decoration-accent-500/60 underline-offset-2 hover:text-accent-700 hover:underline', className)}>
      {tool.name}
    </button>
  )
}

export function VendorFlag({ v }: { v: Vendor }) {
  if (v === 'Y') return <Badge tone="accent" title="Vendor product">Vendor</Badge>
  if (v === 'N') return <Badge tone="violet" title="Built in-house">In-house</Badge>
  return <Badge tone="amber" title="Vendor status unknown">Vendor ?</Badge>
}

export function LayerBadge({ layer }: { layer: Layer }) {
  return layer === 'Application' ? <Badge tone="neutral">Application</Badge> : <Badge tone="neutral" className="bg-slate-700 text-white ring-slate-700">Foundation</Badge>
}

export function useCriticalityTone() {
  const taxonomy = useStore((s) => s.taxonomy)
  const order = termsOf(taxonomy, CAT.criticality)
  return (c: string): 'red' | 'amber' | 'neutral' => {
    const i = order.indexOf(c)
    return i === 0 ? 'red' : i === 1 ? 'amber' : 'neutral'
  }
}

export function AttestationBadge({ status, on }: { status: string; on: string }) {
  if (status === ATTESTED)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
        <CheckCircle2 size={13} /> Attested {on && <span className="text-slate-500">· {fmtDate(on)}</span>}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-xs text-amber-700">
      <Circle size={13} /> Not yet attested
    </span>
  )
}

/** Search over tools by name and alias. */
export function useToolSearch(query: string, filter?: (t: Tool, layer: Layer) => boolean, limit = 12) {
  const tools = useStore((s) => s.tools)
  const aliases = useStore((s) => s.aliases)
  const lm = useLayerMap()
  return useMemo(() => {
    const q = query.trim().toLowerCase()
    const idx = buildIndex(tools, aliases)
    const out: { tool: Tool; layer: Layer; alias?: string; score: number }[] = []
    for (const t of tools) {
      const layer = layerOf(t, lm)
      if (filter && !filter(t, layer)) continue
      if (!q) {
        out.push({ tool: t, layer, score: 0 })
        continue
      }
      const name = t.name.toLowerCase()
      let score = name.startsWith(q) ? 3 : name.includes(q) ? 2 : 0
      let alias: string | undefined
      if (!score) {
        const a = (idx.aliasesByTool.get(t.id) ?? []).find((x) => x.toLowerCase().includes(q))
        if (a) {
          score = 1.5
          alias = a
        } else if (q.length >= 3 && similarity(q, t.name) >= 0.5) score = 1
      }
      if (score) out.push({ tool: t, layer, alias, score })
    }
    out.sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
    return out.slice(0, limit)
  }, [query, tools, aliases, lm, filter, limit])
}

export function ToolPicker({
  filter,
  onPick,
  placeholder = 'Search tools…',
  exclude,
  footer,
}: {
  filter?: (t: Tool, layer: Layer) => boolean
  onPick: (t: Tool) => void
  placeholder?: string
  exclude?: Set<string>
  footer?: ReactNode
}) {
  const [q, setQ] = useState('')
  const results = useToolSearch(q, filter, 60).filter((r) => !exclude?.has(r.tool.id))
  return (
    <div>
      <div className="relative">
        <Search size={14} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-slate-400" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="w-full pl-8" />
      </div>
      <ul className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200 scroll-thin">
        {results.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-500">No matching tools.</li>}
        {results.map((r) => (
          <li key={r.tool.id}>
            <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-accent-50" onClick={() => onPick(r.tool)}>
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800">{r.tool.name}</span>
                <span className="block truncate text-xs text-slate-500">
                  {r.alias ? `also known as “${r.alias}” · ` : ''}
                  {[r.tool.toolType, r.tool.capL2, r.tool.capL3].filter(Boolean).join(' · ')}
                </span>
              </span>
              <VendorFlag v={r.tool.vendor} />
            </button>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  )
}

export function Stat({ label, value, sub, onClick, tone }: { label: string; value: ReactNode; sub?: ReactNode; onClick?: () => void; tone?: 'accent' | 'amber' }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cx('num mt-1 self-start text-left text-[26px] leading-none font-bold tracking-tight', tone === 'amber' ? 'text-amber-700' : 'text-navy', onClick && 'hover:text-accent-700 hover:underline decoration-2 underline-offset-4')}
      >
        {value}
      </button>
      {sub && <span className="mt-0.5 text-xs text-slate-500">{sub}</span>}
    </div>
  )
}
