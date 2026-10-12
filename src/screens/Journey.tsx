import { ArrowRight, ChevronDown, ChevronRight, Clock, Database, MessageCircle, PackageCheck } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, cx, PageHeader } from '../components/ui'
import { useDemo } from '../demo-store'
import { HORIZONS, phase as phaseDef, type Phase } from '../lib/phases'
import { navigate } from '../router'

const HORIZON_ACCENT = { now: 'bg-brand-blue', next: 'bg-brand-green', future: 'bg-navy' } as const

function PhaseCard({ p }: { p: Phase }) {
  const current = useDemo((s) => s.phase)
  const setPhase = useDemo((s) => s.setPhase)
  const [talk, setTalk] = useState(false)
  const isCurrent = current === p.id
  return (
    <article className={cx('rounded-lg border bg-white transition-shadow hover:shadow-md', isCurrent ? 'border-accent-600 ring-1 ring-accent-600' : 'border-slate-200')}>
      <header className="flex items-start gap-3 border-b border-slate-100 px-4 py-3">
        <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-bold text-white">{p.id}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[16px] leading-snug font-bold text-ink">{p.name}</h3>
          <p className="mt-0.5 text-[12px] text-slate-600">{p.purpose}</p>
        </div>
        {isCurrent && <Badge tone="accent">Showing</Badge>}
      </header>
      <div className="space-y-3 px-4 py-3 text-[12px]">
        <section>
          <h4 className="mb-1 flex items-center gap-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            <PackageCheck size={12} /> What it delivers
          </h4>
          <ul className="space-y-0.5 text-ink">
            {p.delivers.map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </section>
        <section>
          <h4 className="mb-1 flex items-center gap-1 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            <Database size={12} /> What we need from her team
          </h4>
          <ul className="space-y-0.5 text-ink">
            {p.dataNeeded.map((d) => (
              <li key={d}>· {d}</li>
            ))}
          </ul>
        </section>
        <div className="flex items-center gap-2 rounded-md bg-panel px-2.5 py-1.5">
          <Clock size={13} className="text-slate-500" />
          <span className="text-ink">{p.duration}</span>
          <Badge tone="amber" className="ml-auto">
            {p.durationStatus}
          </Badge>
        </div>
      </div>
      <footer className="border-t border-slate-100">
        <div className="flex items-center gap-2 px-4 py-2.5">
          <button type="button" onClick={() => setTalk(!talk)} className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-accent-700" aria-expanded={talk}>
            {talk ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            <MessageCircle size={13} /> Talk track
          </button>
          <Button
            size="sm"
            variant="primary"
            className="ml-auto"
            onClick={() => {
              setPhase(p.id)
              navigate(phaseDef(p.id).firstScreen)
            }}
          >
            Show me <ArrowRight size={13} />
          </Button>
        </div>
        {talk && (
          <ol className="animate-fade-up space-y-1.5 border-t border-slate-100 bg-accent-50/50 px-4 py-3 text-[13px] text-ink">
            {p.talkTrack.map((t, i) => (
              <li key={t} className="flex gap-2">
                <span className="num font-bold text-accent-700">{i + 1}.</span>
                {t}
              </li>
            ))}
          </ol>
        )}
      </footer>
    </article>
  )
}

export function JourneyScreen() {
  return (
    <>
      <PageHeader title="Journey" description="Her problem now, next and in the future, and the phase that answers each one. Durations are indicative drafts, not agreed." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {HORIZONS.map((h) => (
          <section key={h.id} className="flex flex-col gap-3">
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className={cx('h-1 rounded-t-lg', HORIZON_ACCENT[h.id])} />
              <div className="px-4 py-3">
                <h2 className="font-display text-[18px] font-bold text-ink">{h.title}</h2>
                <ul className="mt-2 space-y-1.5 text-[13px] text-slate-700">
                  {h.problems.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className={cx('mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full', HORIZON_ACCENT[h.id])} />
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[11px] font-bold tracking-wider text-slate-500 uppercase">Answered by Phase {h.answeredBy.join(' and ')}</p>
              </div>
            </div>
            {h.answeredBy.map((id) => (
              <PhaseCard key={id} p={phaseDef(id)} />
            ))}
          </section>
        ))}
      </div>
    </>
  )
}
