import { Download, Table2, X } from 'lucide-react'
import { Fragment, useMemo } from 'react'
import { Button, Chip, cx, EmptyState, Label, PageHeader, Segmented, Select } from '../components/ui'
import { exportXlsx, type CellValue } from '../lib/export'
import { cellKey, encodeWhere, MEASURES, parseWhere, measureValue, pivotFields, rowKey, runPivot, type Cell, type Measure, type PivotFilters } from '../lib/pivot'
import { fmtNum } from '../lib/util'
import { patchParams, useRoute } from '../router'
import { useDataState } from '../store'
import { LAYERS, VENDORS, type Layer, type Vendor } from '../types'
import { useUi } from '../ui-store'

export function Explorer() {
  const route = useRoute()
  const state = useDataState()
  const openCell = useUi((s) => s.openCell)
  const notify = useUi((s) => s.notify)
  const fields = useMemo(() => pivotFields(state), [state])
  const fieldIds = fields.map((f) => f.id)
  const label = (id: string) => fields.find((f) => f.id === id)?.label ?? id

  const p = route.params
  const rows = (p.get('rows') ?? 'desk').split(',').filter((r) => fieldIds.includes(r)).slice(0, 2)
  const rawCol = p.has('col') ? p.get('col') : 'capL2'
  const col = rawCol && fieldIds.includes(rawCol) && !rows.includes(rawCol) ? rawCol : null
  const measure = (MEASURES.some((m) => m.id === p.get('measure')) ? p.get('measure') : 'tools') as Measure
  const layer = (LAYERS as string[]).includes(p.get('layer') ?? '') ? (p.get('layer') as Layer) : null
  const vendors = (p.get('vendor') ?? '').split(',').filter((v): v is Vendor => (VENDORS as string[]).includes(v))
  const attestedOnly = p.get('attested') === '1'
  const where = parseWhere(p.get('where')).filter((w) => fieldIds.includes(w.field))
  const filters: PivotFilters = { layer, attestedOnly, vendors, where }

  const result = runPivot(state, fields, rows, col, filters)
  const costById = useMemo(() => new Map(state.tools.map((t) => [t.id, t.costK])), [state.tools])
  const val = (c: Cell | undefined) => measureValue(c, measure, costById)
  const fmt = (n: number) => (measure === 'cost' ? `£${fmtNum(n)}k` : fmtNum(n))
  const measureLabel = MEASURES.find((m) => m.id === measure)!.label

  let max = 0
  for (const rk of result.rowKeys) for (const ck of result.colKeys) max = Math.max(max, measureValue(result.cells.get(cellKey(rk, ck)), measure, costById))

  const set = (patch: Record<string, string | null>) => patchParams(route, patch)
  const drill = (title: string, cell: Cell | undefined) => {
    if (!cell || cell.tools.size === 0) return
    openCell({ title, subtitle: `${measureLabel}: ${fmt(val(cell))}`, toolIds: [...cell.tools] })
  }

  const hasCol = !!col
  const describe = (rk: string[], ck?: string) => [...rk, ...(ck !== undefined && hasCol ? [ck] : [])].join(' × ') || 'All tools'

  const exportView = () => {
    const header: CellValue[] = [...rows.map(label), ...(hasCol ? result.colKeys : [measureLabel]), ...(hasCol ? ['Total'] : [])]
    const out: CellValue[][] = [header]
    const line = (labels: CellValue[], getCell: (ck: string) => Cell | undefined, total: Cell | undefined) => [
      ...labels,
      ...result.colKeys.map((ck) => val(getCell(ck)) || null),
      ...(hasCol ? [val(total)] : []),
    ]
    let prev = ''
    result.rowKeys.forEach((rk, i) => {
      out.push(line(rk.length > 1 && rk[0] === prev ? ['', rk[1]] : rk, (ck) => result.cells.get(cellKey(rk, ck)), result.rowTotals.get(rowKey(rk))))
      prev = rk[0]
      const next = result.rowKeys[i + 1]
      if (rows.length > 1 && (!next || next[0] !== rk[0]) && result.rowKeys[i - 1]?.[0] === rk[0]) {
        out.push(line([`${rk[0]} total`, ''], (ck) => subCell(rk[0], ck), result.subTotals.get(rk[0])))
      }
    })
    out.push(line(['Grand total', ...rows.slice(1).map(() => '')], (ck) => result.colTotals.get(ck), result.grand))
    const meta: CellValue[][] = [
      ['Measure', measureLabel],
      ['Rows', rows.map(label).join(' › ')],
      ['Columns', col ? label(col) : '(none)'],
      ['Layer', layer ?? 'All'],
      ['Vendor', vendors.length ? vendors.join(', ') : 'All'],
      ['Attested only', attestedOnly ? 'Yes' : 'No'],
      ...where.map((w): CellValue[] => [`Filter: ${label(w.field)}`, w.value]),
    ]
    const file = exportXlsx('explorer', [
      { name: 'Pivot', rows: out },
      { name: 'View settings', rows: meta },
    ])
    notify(`Downloaded ${file}`)
  }

  // subtotal per (first row value, column) — union of the underlying cells
  const subCell = (r0: string, ck: string): Cell | undefined => {
    const c: Cell = { tools: new Set(), desks: new Set() }
    for (const rk of result.rowKeys) {
      if (rk[0] !== r0) continue
      const x = result.cells.get(cellKey(rk, ck))
      if (!x) continue
      x.tools.forEach((t) => c.tools.add(t))
      x.desks.forEach((d) => c.desks.add(d))
    }
    return c
  }

  const shade = (v: number) => (v && max ? { backgroundColor: `rgba(15,108,189,${(0.03 + 0.2 * (v / max)).toFixed(3)})` } : undefined)
  const rowOptions = (exclude: string[]) => fields.filter((f) => !exclude.includes(f.id))

  return (
    <>
      <PageHeader
        title="Explorer"
        description="Pivot the tool estate any way you like. Click a number to see the tools behind it."
        actions={
          <Button icon={<Download size={14} />} onClick={exportView} disabled={result.rowKeys.length === 0}>
            Export this view
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
        <label>
          <Label>Rows</Label>
          <Select value={rows[0] ?? ''} onChange={(e) => set({ rows: [e.target.value, ...rows.slice(1).filter((r) => r !== e.target.value)].join(',') })} className="w-36">
            {rowOptions(col ? [col] : []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <Label>then by</Label>
          <Select value={rows[1] ?? ''} onChange={(e) => set({ rows: [rows[0], e.target.value].filter(Boolean).join(',') })} className="w-36">
            <option value="">— none —</option>
            {rowOptions([rows[0], ...(col ? [col] : [])]).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <Label>Columns</Label>
          <Select value={col ?? ''} onChange={(e) => set({ col: e.target.value })} className="w-36">
            <option value="">— none —</option>
            {rowOptions(rows).map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </Select>
        </label>
        <div>
          <Label>Measure</Label>
          <Segmented options={MEASURES.map((m) => ({ id: m.id, label: m.label }))} value={measure} onChange={(m) => set({ measure: m })} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-slate-500">Layer</span>
        <Chip active={!layer} onClick={() => set({ layer: null })}>
          All
        </Chip>
        {LAYERS.map((l) => (
          <Chip key={l} active={layer === l} onClick={() => set({ layer: layer === l ? null : l })}>
            {l}s
          </Chip>
        ))}
        <span className="mx-2 h-5 w-px bg-slate-200" />
        <Chip active={attestedOnly} onClick={() => set({ attested: attestedOnly ? null : '1' })} title="Only count desk usage that has been attested">
          Attested only
        </Chip>
        <span className="mx-2 h-5 w-px bg-slate-200" />
        <span className="mr-1 text-xs font-medium text-slate-500">Vendor</span>
        {VENDORS.map((v) => (
          <Chip key={v} active={vendors.includes(v)} onClick={() => set({ vendor: (vendors.includes(v) ? vendors.filter((x) => x !== v) : [...vendors, v]).join(',') || null })}>
            {v}
          </Chip>
        ))}
        {where.map((w, i) => (
          <span key={`${w.field}:${w.value}`} className="ml-1 inline-flex h-7 items-center gap-1 rounded-full border border-accent-200 bg-accent-50 pr-1 pl-3 text-xs font-medium text-accent-800">
            {label(w.field)}: {w.value}
            <button className="rounded-full p-0.5 hover:bg-accent-100" aria-label="Remove filter" onClick={() => set({ where: encodeWhere(where.filter((_, j) => j !== i)) || null })}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {result.rowKeys.length === 0 ? (
        <EmptyState icon={<Table2 size={28} />} title="Nothing matches these filters" hint="Clear a filter chip above, or switch off “Attested only”." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 scroll-thin">
          <table className="w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {rows.map((r) => (
                  <th key={r} className="sticky top-0 border-b border-slate-300 bg-slate-100 px-3 py-2 text-left text-xs font-semibold text-slate-700">
                    {label(r)}
                  </th>
                ))}
                {hasCol ? (
                  result.colKeys.map((ck) => (
                    <th key={ck} className="sticky top-0 border-b border-l border-slate-300 bg-slate-100 px-3 py-2 text-right text-xs font-semibold text-slate-700">
                      {ck}
                    </th>
                  ))
                ) : (
                  <th className="sticky top-0 border-b border-l border-slate-300 bg-slate-100 px-3 py-2 text-right text-xs font-semibold text-slate-700">{measureLabel}</th>
                )}
                {hasCol && <th className="sticky top-0 border-b border-l border-slate-300 bg-slate-200/70 px-3 py-2 text-right text-xs font-semibold text-slate-800">Total</th>}
              </tr>
            </thead>
            <tbody>
              {result.rowKeys.map((rk, i) => {
                const prev = result.rowKeys[i - 1]
                const next = result.rowKeys[i + 1]
                const firstOfGroup = !prev || prev[0] !== rk[0]
                const lastOfGroup = rows.length > 1 && (!next || next[0] !== rk[0]) && !firstOfGroup
                return (
                  <Fragment key={rowKey(rk)}>
                    <tr className="group">
                      {rk.map((v, j) => (
                        <td key={j} className={cx('border-b border-slate-100 px-3 py-1.5 whitespace-nowrap', j === 0 ? 'font-medium text-slate-800' : 'text-slate-700', j === 0 && rows.length > 1 && !firstOfGroup && 'text-transparent select-none')}>
                          {v}
                        </td>
                      ))}
                      {result.colKeys.map((ck) => {
                        const c = result.cells.get(cellKey(rk, ck))
                        const v = val(c)
                        return (
                          <td key={ck} style={shade(v)} className="num border-b border-l border-slate-100 px-0 py-0 text-right">
                            {v ? (
                              <button type="button" className="h-full w-full px-3 py-1.5 text-right hover:bg-accent-600 hover:text-white" onClick={() => drill(describe(rk, ck), c)}>
                                {fmt(v)}
                              </button>
                            ) : (
                              <span className="block px-3 py-1.5 text-slate-200">·</span>
                            )}
                          </td>
                        )
                      })}
                      {hasCol && (
                        <td className="num border-b border-l border-slate-200 bg-slate-50 p-0 text-right font-semibold">
                          <button type="button" className="w-full px-3 py-1.5 text-right hover:bg-accent-600 hover:text-white" onClick={() => drill(`${describe(rk)} (all ${label(col!)})`, result.rowTotals.get(rowKey(rk)))}>
                            {fmt(val(result.rowTotals.get(rowKey(rk))))}
                          </button>
                        </td>
                      )}
                    </tr>
                    {lastOfGroup && (
                      <tr className="bg-slate-50 font-semibold">
                        <td className="border-b border-slate-200 px-3 py-1.5 text-slate-800" colSpan={rows.length}>
                          {rk[0]} total
                        </td>
                        {result.colKeys.map((ck) => {
                          const c = subCell(rk[0], ck)
                          const v = val(c)
                          return (
                            <td key={ck} className="num border-b border-l border-slate-200 p-0 text-right">
                              {v ? (
                                <button type="button" className="w-full px-3 py-1.5 text-right hover:bg-accent-600 hover:text-white" onClick={() => drill(describe([rk[0]], ck), c)}>
                                  {fmt(v)}
                                </button>
                              ) : (
                                <span className="block px-3 py-1.5 text-slate-300">·</span>
                              )}
                            </td>
                          )
                        })}
                        {hasCol && (
                          <td className="num border-b border-l border-slate-200 bg-slate-100 p-0 text-right">
                            <button type="button" className="w-full px-3 py-1.5 text-right hover:bg-accent-600 hover:text-white" onClick={() => drill(`${rk[0]} (all)`, result.subTotals.get(rk[0]))}>
                              {fmt(val(result.subTotals.get(rk[0])))}
                            </button>
                          </td>
                        )}
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 font-semibold text-slate-900">
                <td className="border-t-2 border-slate-300 px-3 py-2" colSpan={rows.length}>
                  Grand total
                </td>
                {result.colKeys.map((ck) => (
                  <td key={ck} className="num border-t-2 border-l border-slate-300 p-0 text-right">
                    <button type="button" className="w-full px-3 py-2 text-right hover:bg-accent-600 hover:text-white" onClick={() => drill(hasCol ? `${ck} (all rows)` : 'All rows', result.colTotals.get(ck))}>
                      {fmt(val(result.colTotals.get(ck)))}
                    </button>
                  </td>
                ))}
                {hasCol && (
                  <td className="num border-t-2 border-l border-slate-300 bg-slate-200/70 p-0 text-right">
                    <button type="button" className="w-full px-3 py-2 text-right hover:bg-accent-600 hover:text-white" onClick={() => drill('Everything in view', result.grand)}>
                      {fmt(val(result.grand))}
                    </button>
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] text-slate-400">
        Totals count each tool once, so a tool used by several desks (or with several user groups) appears in each of those rows but only once in the total.
      </p>
    </>
  )
}
