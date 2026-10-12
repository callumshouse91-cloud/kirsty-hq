import { ArrowRight, Blocks, CheckCircle2, Clock, Database, HelpCircle } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, cx, Drawer, PageHeader, Switch } from '../components/ui'
import { useDemo, usePermissions } from '../demo-store'
import { MODULES, type ModuleDef } from '../lib/modules'
import { SCREEN_META } from '../lib/screens'
import { navigate } from '../router'
import { useUi } from '../ui-store'

function StatusBadge({ m, on }: { m: ModuleDef; on: boolean }) {
  if (m.status === 'available') return <Badge tone="neutral">Available, not yet built</Badge>
  return on ? <Badge tone="green">Built · switched on</Badge> : <Badge tone="accent">Built · switched off</Badge>
}

function Sheet({ m, onClose }: { m: ModuleDef; onClose: () => void }) {
  const modules = useDemo((s) => s.modules)
  const on = m.builtId ? modules[m.builtId] : false
  return (
    <Drawer
      open
      onClose={onClose}
      title={m.name}
      subtitle={<StatusBadge m={m} on={on} />}
      width="w-[520px]"
      footer={
        m.builtId && on ? (
          <Button variant="primary" onClick={() => navigate(m.builtId!)}>
            Open {SCREEN_META[m.builtId].label} <ArrowRight size={14} />
          </Button>
        ) : (
          <Button onClick={onClose}>Close</Button>
        )
      }
    >
      <div className="space-y-5 px-5 py-4 text-[13px] text-slate-700">
        <p className="text-sm text-ink">{m.summary}</p>
        <section>
          <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Questions it answers</h3>
          <ul className="list-disc space-y-1 pl-5">
            {m.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Data it needs, and where it comes from</h3>
          <ul className="space-y-1.5">
            {m.data.map((d) => (
              <li key={d.what} className="rounded-md border border-slate-200 px-3 py-2">
                <div className="font-medium text-ink">{d.what}</div>
                <div className="text-xs text-slate-500">{d.from}</div>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">What it adds to the map</h3>
          <ul className="list-disc space-y-1 pl-5">
            {m.adds.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3 className="mb-1.5 text-[11px] font-bold tracking-wide text-slate-500 uppercase">Before it can start</h3>
          <ul className="list-disc space-y-1 pl-5">
            {m.prerequisites.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
        <section className="flex items-center gap-2 rounded-md bg-panel px-3 py-2.5">
          <Clock size={15} className="text-slate-500" />
          <span>
            Indicative effort: <span className="font-bold text-ink">{m.effort.toLowerCase()}</span>
          </span>
          <Badge tone="amber" className="ml-auto">
            Draft, not agreed
          </Badge>
        </section>
        {m.status === 'available' && <p className="text-xs text-slate-500">Built on the same map: the data joins to tools, capabilities and strategies that are already here. No new system.</p>}
      </div>
    </Drawer>
  )
}

function ModuleCard({ m, onOpen }: { m: ModuleDef; onOpen: () => void }) {
  const modules = useDemo((s) => s.modules)
  const setModule = useDemo((s) => s.setModule)
  const notify = useUi((u) => u.notify)
  const canConfigure = usePermissions().can('approve')
  const on = m.builtId ? modules[m.builtId] : false
  return (
    <article className={cx('flex flex-col rounded-lg border bg-white p-4 transition-shadow hover:shadow-md', m.status === 'built' ? 'border-slate-200' : 'border-dashed border-slate-300')}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-[15px] leading-snug font-bold text-ink">{m.name}</h2>
        {m.builtId && canConfigure && (
          <Switch
            checked={on}
            label={`Switch ${m.name} ${on ? 'off' : 'on'}`}
            onChange={(v) => {
              setModule(m.builtId!, v)
              notify(v ? `${m.name} switched on. It now has its own screen.` : `${m.name} switched off. Its data stays.`)
            }}
          />
        )}
      </div>
      <div className="mt-1.5">
        <StatusBadge m={m} on={on} />
      </div>
      <p className="mt-2 text-[13px] text-slate-600">{m.summary}</p>
      <div className="mt-3 space-y-2 text-xs">
        <div>
          <div className="mb-1 flex items-center gap-1 font-bold tracking-wide text-slate-500 uppercase">
            <HelpCircle size={12} /> Answers
          </div>
          <ul className="space-y-0.5 text-slate-700">
            {m.questions.slice(0, 2).map((q) => (
              <li key={q}>· {q}</li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-1 font-bold tracking-wide text-slate-500 uppercase">
            <Database size={12} /> Needs
          </div>
          <ul className="space-y-0.5 text-slate-700">
            {m.data.map((d) => (
              <li key={d.what}>
                · {d.what} <span className="text-slate-400">({d.from})</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3">
        <span className="inline-flex items-center gap-1 text-xs text-slate-600">
          <Clock size={12} /> {m.effort} <span className="text-slate-400">· draft</span>
        </span>
        <span className="ml-auto flex items-center gap-1">
          {m.builtId && on && (
            <Button size="sm" variant="ghost" onClick={() => navigate(m.builtId!)}>
              Open
            </Button>
          )}
          <Button size="sm" onClick={onOpen}>
            Details
          </Button>
        </span>
      </div>
    </article>
  )
}

export function ModulesScreen() {
  const [open, setOpen] = useState<ModuleDef | null>(null)
  const canConfigure = usePermissions().can('approve')
  const built = MODULES.filter((m) => m.status === 'built')
  const available = MODULES.filter((m) => m.status === 'available')
  return (
    <>
      <PageHeader
        title="Modules"
        description="Each module joins one more source to the same map and answers a set of questions. Switch one on when you need it. Efforts are indicative."
        actions={!canConfigure ? <Badge tone="neutral">A change lead switches modules on</Badge> : undefined}
      />
      <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
        <CheckCircle2 size={13} className="text-emerald-600" /> Built in this demo
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {built.map((m) => (
          <ModuleCard key={m.id} m={m} onOpen={() => setOpen(m)} />
        ))}
      </div>
      <h2 className="mt-6 mb-2 flex items-center gap-2 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
        <Blocks size={13} /> Available, not yet built
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {available.map((m) => (
          <ModuleCard key={m.id} m={m} onOpen={() => setOpen(m)} />
        ))}
      </div>
      {open && <Sheet m={open} onClose={() => setOpen(null)} />}
    </>
  )
}
