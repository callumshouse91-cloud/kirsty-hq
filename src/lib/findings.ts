import { addDays, daysUntil, type Contract, type RiskEvent } from '../module-data'
import type { Params } from '../router'
import { ATTESTED, type DataState, type Layer } from '../types'
import { capabilityTree, capLabel, duplicateCaps } from './capability'
import { isStale } from './freshness'
import { LEANIX_SOURCE } from './mapping'
import { missingType } from './reconcile'
import { activeSources, type Env, type PhaseId, type ScreenId } from './phases'
import { isUnclassified } from './suggest'
import { CAT, termsOf } from './taxonomy'
import { fmtK, pct, plural } from './util'

export interface Finding {
  id: string
  sentence: string
  tone: 'neutral' | 'amber' | 'red' | 'green'
  screen: ScreenId
  params: Params
}

export interface FindingsInput {
  state: DataState
  lm: Map<string, Layer>
  contracts: Contract[]
  events: RiskEvent[]
}

/** Headline findings, written as sentences, each pointing at the screen that shows the evidence. */
export function findings({ state, lm, contracts, events }: FindingsInput): Finding[] {
  const out: Finding[] = []
  const tree = capabilityTree(state, lm)
  const dups = duplicateCaps(tree, 4)
  const appDup = dups.find((d) => d.apps.length >= 4)
  if (dups.length) {
    out.push({
      id: 'overlap',
      sentence: `${plural(dups.length, 'capability', 'capabilities')} ${dups.length === 1 ? 'is' : 'are'} served by 4 or more tools of the same layer. ${appDup ? `${capLabel(appDup)} alone has ${appDup.apps.length} applications.` : `The largest is ${capLabel(dups[0])}.`}`,
      tone: 'amber',
      screen: 'capability',
      params: { only: '1', dup: '4' },
    })
  }

  const critical = termsOf(state.taxonomy, CAT.criticality)[0] ?? ''
  const crit = state.usages.filter((u) => u.criticality === critical)
  const critOpen = crit.filter((u) => u.attestation !== ATTESTED)
  const worst = termsOf(state.taxonomy, CAT.desk)
    .map((d) => ({ d, n: critOpen.filter((u) => u.desk === d).length }))
    .sort((a, b) => b.n - a.n)[0]
  out.push({
    id: 'attest',
    sentence: critOpen.length ? `${pct(crit.length - critOpen.length, crit.length)}% of the ${critical.toLowerCase()} toolkit is attested. ${worst.d} has the most still to confirm (${worst.n}).` : `The whole ${critical.toLowerCase()} toolkit is attested.`,
    tone: critOpen.length ? 'amber' : 'green',
    screen: 'desk',
    params: { desk: worst?.d ?? '' },
  })

  const next = contracts.filter((c) => daysUntil(c.renewal) >= 0 && daysUntil(c.renewal) <= 90)
  const passed = next.filter((c) => daysUntil(addDays(c.renewal, -c.noticeDays)) < 0)
  if (next.length) {
    out.push({
      id: 'renew',
      sentence: `${plural(next.length, 'contract')} worth ${fmtK(next.reduce((s, c) => s + c.valueK, 0))} ${next.length === 1 ? 'renews' : 'renew'} in the next 90 days.${passed.length ? ` Notice has passed on ${passed.length}.` : ''}`,
      tone: passed.length ? 'red' : 'neutral',
      screen: 'vendors',
      params: { within: '90' },
    })
  }

  if (events.length) {
    const byCap = new Map<string, { label: string; loss: number; n: number }>()
    const capOf = new Map<string, { key: string; label: string }>()
    for (const g of tree) for (const n of g.children) for (const t of n.tools) capOf.set(t.id, { key: n.key, label: capLabel(n) })
    for (const e of events) {
      const c = capOf.get(e.toolId)
      if (!c) continue
      const x = byCap.get(c.key) ?? { label: c.label, loss: 0, n: 0 }
      x.loss += e.lossK
      x.n++
      byCap.set(c.key, x)
    }
    const top = [...byCap.entries()].sort((a, b) => b[1].loss - a[1].loss)[0]
    if (top) {
      out.push({ id: 'risk', sentence: `${top[1].label} carries the most risk-event loss: ${fmtK(top[1].loss)} from ${plural(top[1].n, 'event')} in the last 12 months.`, tone: 'red', screen: 'risk', params: { cap: top[0] } })
    }
  }

  const lx = state.sourceRecords.filter((r) => r.source === LEANIX_SOURCE)
  const missing = state.issues.filter((i) => i.status === 'Open' && i.type === missingType(LEANIX_SOURCE)).length
  out.push(
    lx.length
      ? { id: 'leanix', sentence: `${plural(missing, 'tool')} in the master list ${missing === 1 ? 'has' : 'have'} no LeanIX record, and ${plural(lx.filter((r) => r.matchType === 'fuzzy' && r.resolution === 'pending').length, 'rename')} still to confirm.`, tone: missing ? 'amber' : 'green', screen: 'import', params: { tab: 'issues' } }
      : { id: 'leanix', sentence: 'LeanIX has not been reconciled this month. Run the feed to see the gaps.', tone: 'amber', screen: 'import', params: {} },
  )

  const unclassified = state.tools.filter(isUnclassified).length
  if (unclassified) out.push({ id: 'unclassified', sentence: `${plural(unclassified, 'tool')} ${unclassified === 1 ? 'has' : 'have'} no Tool type or capability yet. Suggestions are waiting for review.`, tone: 'neutral', screen: 'suggestions', params: {} })
  return out
}

export interface Health {
  attestation: number
  sourcesFresh: number
  sourcesTotal: number
  openIssues: number
  lastDrift: number | null
  unclassified: number
}

export function mapHealth(state: DataState, phase: PhaseId, env: Env): Health {
  const sources = activeSources(phase, env)
  const lastRun = state.feedRuns.find((r) => r.source === LEANIX_SOURCE)
  return {
    attestation: pct(state.usages.filter((u) => u.attestation === ATTESTED).length, state.usages.length),
    sourcesFresh: sources.filter((s) => !isStale(s.def.id, s.arrives)).length,
    sourcesTotal: sources.length,
    openIssues: state.issues.filter((i) => i.status === 'Open').length,
    lastDrift: lastRun ? lastRun.drift.length : null,
    unclassified: state.tools.filter(isUnclassified).length,
  }
}
