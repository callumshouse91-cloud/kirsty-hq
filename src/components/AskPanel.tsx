import { ArrowRight, Info, MessageSquareText, RotateCcw, Send, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { answer, SUGGESTED_QUESTIONS, type Answer } from '../lib/ask'
import { SCREEN_META } from '../lib/screens'
import { uid } from '../lib/util'
import { useModuleData } from '../module-data'
import { useAvailableScreens } from '../nav'
import { navigate } from '../router'
import { useDataState, useLayerMap } from '../store'
import { useUi } from '../ui-store'
import { ToolLink } from './common'
import { cx } from './ui'

function Cite({ a }: { a: Answer }) {
  const available = useAvailableScreens()
  const setOpen = useUi((u) => u.setAskOpen)
  if (!a.cite) return null
  const on = available.includes(a.cite.screen)
  return (
    <div className="mt-2.5 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
      Source:{' '}
      {on ? (
        <button
          type="button"
          className="font-semibold text-accent-700 hover:underline"
          onClick={() => {
            navigate(a.cite!.screen, a.cite!.params)
            setOpen(false)
          }}
        >
          {a.cite.label} <ArrowRight size={10} className="inline" />
        </button>
      ) : (
        <span className="font-semibold text-slate-600">{a.cite.label}</span>
      )}{' '}
      · {a.cite.filters}
      {!on && available.includes('modules') && SCREEN_META[a.cite.screen].module && (
        <>
          {' '}
          ·{' '}
          <button type="button" className="text-accent-700 hover:underline" onClick={() => navigate('modules')}>
            switch the module on to open it
          </button>
        </>
      )}
    </div>
  )
}

function AnswerCard({ a }: { a: Answer }) {
  return (
    <div className="rounded-lg rounded-tl-sm border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-ink shadow-sm">
      {a.text.map((t) => (
        <p key={t} className="mb-1.5 last:mb-0">
          {t}
        </p>
      ))}
      {a.rows && a.rows.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-100 bg-panel/60">
          {a.rows.slice(0, 10).map((r) => (
            <li key={r.label} className="px-2.5 py-1.5 text-xs">
              <div className="font-semibold">{r.toolId ? <ToolLink id={r.toolId} /> : r.label}</div>
              <div className="text-slate-500">{r.value}</div>
            </li>
          ))}
          {a.rows.length > 10 && <li className="px-2.5 py-1.5 text-xs text-slate-500">and {a.rows.length - 10} more</li>}
        </ul>
      )}
      <Cite a={a} />
    </div>
  )
}

export function AskPanel() {
  const open = useUi((u) => u.askOpen)
  const setOpen = useUi((u) => u.setAskOpen)
  const turns = useUi((u) => u.turns)
  const addTurn = useUi((u) => u.addTurn)
  const clear = useUi((u) => u.clearTurns)
  const state = useDataState()
  const lm = useLayerMap()
  const contracts = useModuleData((m) => m.contracts)
  const [q, setQ] = useState('')
  const end = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [turns.length])
  useEffect(() => {
    if (!open) return
    input.current?.focus()
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, setOpen])

  const ask = (text: string) => {
    const t = text.trim()
    if (!t) return
    addTurn({ id: uid('ask'), q: t, at: new Date().toISOString(), answer: answer(t, { state, lm, contracts }) })
    setQ('')
  }

  if (!open) return null
  const last = turns.at(-1)
  const followUps = last ? last.answer.followUps : SUGGESTED_QUESTIONS

  return (
    <aside className="animate-slide-in fixed top-10 right-0 bottom-0 z-[45] flex w-[420px] max-w-[100vw] flex-col border-l border-slate-200 bg-panel shadow-2xl" aria-label="Ask the map">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
        <MessageSquareText size={18} className="text-accent-600" />
        <h2 className="font-display text-[15px] font-bold text-ink">Ask the map</h2>
        <span className="ml-auto flex items-center gap-1">
          {turns.length > 0 && (
            <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={clear} aria-label="Clear conversation" title="Clear conversation">
              <RotateCcw size={15} />
            </button>
          )}
          <button type="button" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={() => setOpen(false)} aria-label="Close">
            <X size={17} />
          </button>
        </span>
      </header>
      <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-[11px] leading-snug text-amber-900">
        <Info size={13} className="mt-px shrink-0" />
        <span>Preview: answers computed from the map, no AI model connected in this demo.</span>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 scroll-thin">
        {turns.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-[13px] text-slate-600">
            Ask about the estate in plain words. Each answer is worked out from the current map and says which screen it came from.
          </div>
        )}
        {turns.map((t) => (
          <div key={t.id} className="animate-fade-up space-y-2">
            <div className="ml-10 rounded-lg rounded-tr-sm bg-navy px-3 py-2 text-[13px] text-white">{t.q}</div>
            <AnswerCard a={t.answer} />
          </div>
        ))}
        <div ref={end} />
      </div>
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {followUps.slice(0, 4).map((s) => (
            <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-left text-[11px] text-slate-700 hover:border-accent-500 hover:text-accent-700">
              {s}
            </button>
          ))}
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            ask(q)
          }}
        >
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="e.g. What breaks if Kafka Event Bus goes away?"
            className="h-9 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-[13px] placeholder:text-slate-400 focus:border-accent-500 focus:ring-2 focus:ring-accent-100 focus:outline-none"
          />
          <button type="submit" disabled={!q.trim()} className={cx('inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent-600 text-white hover:bg-accent-700 disabled:opacity-40')} aria-label="Ask">
            <Send size={15} />
          </button>
        </form>
      </div>
    </aside>
  )
}
