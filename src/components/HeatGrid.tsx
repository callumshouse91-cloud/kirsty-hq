import { Fragment } from 'react'
import { capLabel } from '../lib/capability'
import { heatKey, heatValue, rowTotal, type HeatMatrix, type HeatMeasure } from '../lib/heatmap'
import { fmtK, fmtNum } from '../lib/util'
import { cx } from './ui'

/** Brand blues from tint to navy. */
const SCALE = ['#f3f8fe', '#d6eaff', '#aed3fb', '#6fb0ef', '#2a7fd0', '#005dba', '#001d6e']

function colour(v: number, max: number): { bg: string; fg: string } {
  if (v <= 0 || max <= 0) return { bg: 'transparent', fg: '#94a3b8' }
  const i = Math.min(SCALE.length - 1, Math.max(1, Math.ceil(Math.sqrt(v / max) * (SCALE.length - 1))))
  return { bg: SCALE[i], fg: i >= 4 ? '#ffffff' : '#1d1d1b' }
}

export function fmtMeasure(v: number, m: HeatMeasure, compact = false): string {
  if (m === 'cost' || m === 'riskCost') return compact ? (v >= 1000 ? `${fmtNum(v / 1000, 1)}m` : `${fmtNum(v)}`) : fmtK(v)
  return fmtNum(v)
}

export function HeatGrid({ h, measure, onCell, compact = false, selected }: { h: HeatMatrix; measure: HeatMeasure; onCell: (capKey: string, strategy: string) => void; compact?: boolean; selected?: string | null }) {
  let max = 0
  for (const n of h.rows) for (const c of h.cols) max = Math.max(max, heatValue(h.cells.get(heatKey(n.key, c.strategy)), measure))
  const desks = [...new Set(h.cols.map((c) => c.desk))]
  const label = compact ? 150 : 190
  const tmpl = `${label}px repeat(${h.cols.length}, minmax(0, 1fr)) ${compact ? '' : '64px'}`
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white text-[12px]">
      <div className="grid border-b border-slate-200 bg-panel" style={{ gridTemplateColumns: tmpl }}>
        <div />
        {desks.map((d) => {
          const span = h.cols.filter((c) => c.desk === d).length
          return (
            <div key={d} className="truncate border-l border-slate-200 px-1 py-1 text-center text-[10px] font-bold tracking-wide text-slate-500 uppercase" style={{ gridColumn: `span ${span}` }} title={d}>
              {d}
            </div>
          )
        })}
        {!compact && <div />}
      </div>
      <div className="grid border-b border-slate-300 bg-panel" style={{ gridTemplateColumns: tmpl }}>
        <div className="px-3 py-1.5 text-[11px] font-bold tracking-wide text-slate-600 uppercase">Capability</div>
        {h.cols.map((c) => (
          <div key={c.strategy} className="flex items-end justify-center border-l border-slate-200 px-0.5 py-1.5 text-center text-[10px] leading-tight font-semibold text-slate-600" title={`${c.desk} › ${c.strategy}`}>
            <span className="line-clamp-2">{c.strategy}</span>
          </div>
        ))}
        {!compact && <div className="border-l border-slate-200 px-1 py-1.5 text-right text-[10px] font-bold text-slate-600 uppercase">Total</div>}
      </div>
      {h.rows.map((n, ri) => {
        const newGroup = ri === 0 || h.rows[ri - 1].l2 !== n.l2
        return (
          <Fragment key={n.key}>
            {newGroup && (
              <div className="border-b border-slate-100 bg-slate-50/70 px-3 py-0.5 text-[10px] font-bold tracking-wide text-slate-500 uppercase">{n.l2}</div>
            )}
            <div className="grid border-b border-slate-100 last:border-0" style={{ gridTemplateColumns: tmpl }}>
              <div className="truncate px-3 py-1 text-[12px] text-ink" title={capLabel(n)}>
                {n.l3}
              </div>
              {h.cols.map((c) => {
                const v = heatValue(h.cells.get(heatKey(n.key, c.strategy)), measure)
                const { bg, fg } = colour(v, max)
                const k = heatKey(n.key, c.strategy)
                return (
                  <button
                    key={c.strategy}
                    type="button"
                    disabled={v === 0}
                    onClick={() => onCell(n.key, c.strategy)}
                    title={`${capLabel(n)} × ${c.strategy}: ${fmtMeasure(v, measure)}`}
                    className={cx('num m-px rounded-[3px] text-center text-[11px] font-semibold transition-[filter,box-shadow] enabled:hover:brightness-95 enabled:hover:ring-2 enabled:hover:ring-navy/40', compact ? 'py-1' : 'py-1.5', selected === k && 'ring-2 ring-navy')}
                    style={{ background: bg, color: fg }}
                  >
                    {v ? fmtMeasure(v, measure, true) : '·'}
                  </button>
                )
              })}
              {!compact && <div className="num px-1 py-1 text-right font-bold text-ink">{fmtMeasure(rowTotal(h, n, measure), measure, true)}</div>}
            </div>
          </Fragment>
        )
      })}
    </div>
  )
}
