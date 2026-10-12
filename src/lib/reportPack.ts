import { addDays, daysUntil } from '../module-data'
import { ATTESTED } from '../types'
import { capabilityTree, duplicateCaps, overlapCount } from './capability'
import { exportXlsx, type CellValue } from './export'
import { findings, type FindingsInput } from './findings'
import { directDependentCounts, foundationReach } from './graph'
import { isUnclassified } from './suggest'
import { CAT, layerOf, termsOf } from './taxonomy'
import { today } from './util'

/** One workbook with the key views, for people who won't log in. Every figure is illustrative. */
export function downloadReportPack(input: FindingsInput): string {
  const { state, lm, contracts, events } = input
  const tree = capabilityTree(state, lm)
  const capOf = new Map<string, string>()
  for (const g of tree) for (const n of g.children) for (const t of n.tools) capOf.set(t.id, `${n.l2} › ${n.l3}`)

  const summary: CellValue[][] = [
    ['Investments Tech Map: report pack'],
    [`Generated ${today()}. Synthetic demo data; every figure is illustrative.`],
    [],
    ['Headline findings'],
    ...findings(input).map((f): CellValue[] => [f.sentence]),
    [],
    ['Tools', state.tools.length],
    ['Applications', state.tools.filter((t) => layerOf(t, lm) === 'Application').length],
    ['Foundations', state.tools.filter((t) => layerOf(t, lm) === 'Foundation').length],
    ['Estimated annual cost (£k)', state.tools.reduce((s, t) => s + t.costK, 0)],
    ['Usage attested', `${Math.round((state.usages.filter((u) => u.attestation === ATTESTED).length / Math.max(1, state.usages.length)) * 100)}%`],
  ]

  const caps: CellValue[][] = [[CAT.capL2, CAT.capL3, 'Tools', 'Applications', 'Foundations', 'Desks', 'Est annual cost (£k)', 'Tools in this capability']]
  for (const g of tree) for (const n of g.children) caps.push([n.l2, n.l3, n.tools.length, n.apps.length, n.foundations.length, n.desks.size, n.cost, n.tools.map((t) => t.name).join('; ')])

  const overlaps: CellValue[][] = [['Capability', 'Layer', 'Tools of that layer', 'Est annual cost (£k)', 'Names']]
  for (const n of duplicateCaps(tree, 4)) {
    const o = overlapCount(n)
    const list = o.layer === 'Application' ? n.apps : n.foundations
    overlaps.push([`${n.l2} › ${n.l3}`, o.layer, o.count, list.reduce((s, t) => s + t.costK, 0), list.map((t) => t.name).join('; ')])
  }

  const critical = termsOf(state.taxonomy, CAT.criticality)[0] ?? ''
  const attest: CellValue[][] = [['Desk', 'Usage rows', 'Attested', `${critical} rows`, `${critical} attested`, 'Last attested']]
  for (const d of termsOf(state.taxonomy, CAT.desk)) {
    const us = state.usages.filter((u) => u.desk === d)
    const cr = us.filter((u) => u.criticality === critical)
    attest.push([d, us.length, us.filter((u) => u.attestation === ATTESTED).length, cr.length, cr.filter((u) => u.attestation === ATTESTED).length, us.map((u) => u.attestedOn).filter(Boolean).sort().at(-1) ?? ''])
  }

  const counts = directDependentCounts(state)
  const foundations: CellValue[][] = [['Foundation', 'Direct dependents', 'Desks reached', 'Est annual cost (£k)']]
  for (const f of state.tools.filter((t) => layerOf(t, lm) === 'Foundation').sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))) {
    foundations.push([f.name, counts.get(f.id) ?? 0, foundationReach(state, f.id).desks.size, f.costK])
  }

  const renewals: CellValue[][] = [['Contract', 'Parent company', 'Vendor', 'Tools', 'Annual value (£k)', 'Renewal date', 'Notice deadline', 'Days to renewal']]
  for (const c of contracts.filter((x) => daysUntil(x.renewal) >= 0 && daysUntil(x.renewal) <= 180).sort((a, b) => a.renewal.localeCompare(b.renewal))) {
    renewals.push([c.id, c.parent, c.vendor, c.toolNames.join('; '), c.valueK, c.renewal, addDays(c.renewal, -c.noticeDays), daysUntil(c.renewal)])
  }

  const risk: CellValue[][] = [['Event', 'Date', 'Title', 'Tool', 'Capability', 'Strategy', 'Category', 'Loss (£k)', 'Status']]
  for (const e of events) risk.push([e.id, e.date, e.title, e.toolName, capOf.get(e.toolId) ?? '', e.strategy, e.category, e.lossK, e.status])

  const tools: CellValue[][] = [['Tool', 'Layer', CAT.toolType, CAT.capL2, CAT.capL3, 'Vendor', 'Ownership', 'Users', 'Est annual cost (£k)', 'Classified']]
  for (const t of [...state.tools].sort((a, b) => a.name.localeCompare(b.name))) tools.push([t.name, layerOf(t, lm), t.toolType, t.capL2, t.capL3, t.vendor, t.ownership, t.users, t.costK, isUnclassified(t) ? 'No' : 'Yes'])

  return exportXlsx('report-pack', [
    { name: 'Summary', rows: summary, widths: [90, 14] },
    { name: 'Capabilities', rows: caps },
    { name: 'Overlaps', rows: overlaps },
    { name: 'Attestation by desk', rows: attest },
    { name: 'Foundations', rows: foundations },
    { name: 'Renewals 180 days', rows: renewals },
    { name: 'Risk events', rows: risk },
    { name: 'Tool list', rows: tools },
  ])
}
