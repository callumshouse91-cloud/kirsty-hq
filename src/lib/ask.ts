import type { Contract } from '../module-data'
import { daysUntil, addDays } from '../module-data'
import type { Params } from '../router'
import type { DataState, Layer, Tool } from '../types'
import { capabilityTree, capLabel, duplicateCaps, overlapCount } from './capability'
import { foundationReach } from './graph'
import { LEANIX_SOURCE } from './mapping'
import { tokens } from './match'
import type { ScreenId } from './phases'
import { CAT, layerOf, termsOf } from './taxonomy'
import { fmtDate, fmtK, pct, plural } from './util'
import { ATTESTED } from '../types'

/**
 * "Ask the map": intent matching over the store for a fixed set of questions.
 * No language model is involved. Every answer is computed from the live map and cites where it came from.
 */

export type IntentId = 'breaks' | 'attestation' | 'cost' | 'duplicates' | 'renewals' | 'onlyLeanix' | 'help'

export interface AnswerRow {
  label: string
  value: string
  toolId?: string
}

export interface Answer {
  intent: IntentId
  text: string[]
  rows?: AnswerRow[]
  cite?: { screen: ScreenId; params: Params; label: string; filters: string }
  followUps: string[]
}

export interface AskContext {
  state: DataState
  lm: Map<string, Layer>
  contracts: Contract[]
}

export const SUGGESTED_QUESTIONS = [
  'What breaks if Snowflake goes away?',
  'Which desks have not attested?',
  'What is the cost by capability?',
  'Where do several tools do the same job?',
  'What renews in the next 90 days?',
  'Which tools are only in LeanIX?',
]

const PATTERNS: { id: IntentId; re: RegExp }[] = [
  { id: 'onlyLeanix', re: /only in leanix|leanix only|not in (the )?master|missing from (the )?(master|list)|in leanix but/i },
  { id: 'breaks', re: /break|goes away|go away|switch(ed)? off|decommission|retire|depends? on|impact of|lose|turn(ed)? off/i },
  { id: 'attestation', re: /attest|confirm(ed)? (their|the) (tools|toolkit)|sign(ed)? off/i },
  { id: 'duplicates', re: /duplicat|overlap|same (job|capabilit|thing)|redundan|rationalis|more than one tool/i },
  { id: 'renewals', re: /renew|contract|notice|expir/i },
  { id: 'cost', re: /cost|spend|expensive|budget/i },
]

export function matchIntent(q: string): IntentId {
  return PATTERNS.find((p) => p.re.test(q))?.id ?? 'help'
}

/** The tool a question names: the longest tool name or alias whose words all appear in it. */
export function findTool(q: string, state: DataState): Tool | null {
  const qt = new Set(tokens(q))
  let best: { tool: Tool; score: number } | null = null
  const consider = (tool: Tool, name: string) => {
    const core = tokens(name.replace(/\([^)]*\)/g, ' '))
    if (core.length === 0 || !core.every((t) => qt.has(t))) return
    const score = core.join(' ').length
    if (!best || score > best.score) best = { tool, score }
  }
  for (const t of state.tools) consider(t, t.name)
  for (const a of state.aliases) {
    const t = state.tools.find((x) => x.id === a.toolId)
    if (t) consider(t, a.alias)
  }
  return (best as { tool: Tool; score: number } | null)?.tool ?? null
}

function breaks(q: string, { state, lm }: AskContext): Answer {
  const tool = findTool(q, state)
  const follow = ['Which desks have not attested?', 'Where do several tools do the same job?']
  if (!tool) {
    return { intent: 'breaks', text: ['I could not find a tool by that name in the map. Try the name as it appears in the master list, or an alias.'], followUps: ['What breaks if Snowflake goes away?', 'What breaks if Reference Data Master goes away?'] }
  }
  const critical = termsOf(state.taxonomy, CAT.criticality)[0] ?? ''
  if (layerOf(tool, lm) === 'Foundation') {
    const reach = foundationReach(state, tool.id)
    const apps = reach.consumers.filter((c) => c.layer === 'Application')
    const strategies = new Set([...reach.desks.values()].flatMap((s) => [...s]))
    const crit = reach.usages.filter((u) => u.criticality === critical).length
    return {
      intent: 'breaks',
      text: [
        `If ${tool.name} went away, ${plural(apps.length, 'application')} that sit on it would be affected, directly or indirectly.`,
        `Through them it reaches ${plural(reach.desks.size, 'desk')} and ${plural(strategies.size, 'strategy', 'strategies')}. ${plural(crit, 'usage')} of those applications ${crit === 1 ? 'is' : 'are'} marked ${critical.toLowerCase()}.`,
      ],
      rows: apps.slice(0, 8).map((c) => ({ label: c.tool.name, value: c.via.length === 0 ? 'sits on it directly' : `via ${c.via.map((v) => v.name).join(' › ')}`, toolId: c.tool.id })),
      cite: { screen: 'foundation', params: { id: tool.id }, label: 'Foundation View', filters: tool.name },
      followUps: follow,
    }
  }
  const us = state.usages.filter((u) => u.toolId === tool.id)
  const desks = [...new Set(us.map((u) => u.desk))]
  const crit = us.filter((u) => u.criticality === critical)
  return {
    intent: 'breaks',
    text: [
      `${tool.name} is an application used by ${plural(desks.length, 'desk')} across ${plural(new Set(us.map((u) => u.strategy)).size, 'strategy', 'strategies')}.`,
      crit.length ? `${plural(crit.length, 'usage')} ${crit.length === 1 ? 'is' : 'are'} marked ${critical.toLowerCase()}, so losing it would hit ${[...new Set(crit.map((u) => u.desk))].join(', ')} first.` : `None of those usages is marked ${critical.toLowerCase()}.`,
    ],
    rows: desks.map((d) => ({ label: d, value: us.filter((u) => u.desk === d).map((u) => `${u.strategy} (${u.criticality})`).join(', ') })),
    cite: desks[0] ? { screen: 'desk', params: { desk: crit[0]?.desk ?? desks[0] }, label: 'Desk View', filters: crit[0]?.desk ?? desks[0] } : undefined,
    followUps: follow,
  }
}

function attestation({ state }: AskContext): Answer {
  const critical = termsOf(state.taxonomy, CAT.criticality)[0] ?? ''
  const desks = termsOf(state.taxonomy, CAT.desk).map((d) => {
    const us = state.usages.filter((u) => u.desk === d)
    const open = us.filter((u) => u.attestation !== ATTESTED)
    return { d, total: us.length, open: open.length, crit: open.filter((u) => u.criticality === critical).length }
  })
  const behind = desks.filter((x) => x.open > 0).sort((a, b) => b.crit - a.crit || b.open - a.open)
  const open = desks.reduce((s, x) => s + x.open, 0)
  const total = desks.reduce((s, x) => s + x.total, 0)
  const crit = desks.reduce((s, x) => s + x.crit, 0)
  return {
    intent: 'attestation',
    text: behind.length
      ? [`${behind.length === desks.length ? `All ${desks.length} desks still have` : `${plural(behind.length, 'desk')} of ${desks.length} still ${behind.length === 1 ? 'has' : 'have'}`} usage to attest. ${plural(open, 'usage row')} of ${total} ${open === 1 ? 'is' : 'are'} outstanding (${pct(total - open, total)}% attested).`, `${plural(crit, 'outstanding row')} ${crit === 1 ? 'is' : 'are'} ${critical.toLowerCase()}. ${behind[0].d} has the most.`]
      : ['Every desk has attested all of its usage.'],
    rows: behind.map((x) => ({ label: x.d, value: `${x.open} outstanding${x.crit ? `, ${x.crit} ${critical.toLowerCase()}` : ''}` })),
    cite: behind[0] ? { screen: 'desk', params: { desk: behind[0].d }, label: 'Desk View', filters: behind[0].d } : { screen: 'overview', params: {}, label: 'Overview', filters: 'all desks' },
    followUps: ['What breaks if Snowflake goes away?', 'What is the cost by capability?'],
  }
}

function cost({ state, lm }: AskContext): Answer {
  const tree = capabilityTree(state, lm).sort((a, b) => b.cost - a.cost)
  const total = tree.reduce((s, g) => s + g.cost, 0)
  const top = tree[0]
  const l3 = tree.flatMap((g) => g.children).sort((a, b) => b.cost - a.cost)[0]
  return {
    intent: 'cost',
    text: [
      `Estimated annual cost is ${fmtK(total)} across ${plural(tree.length, `${CAT.capL2} group`)}. ${top.l2} is the largest at ${fmtK(top.cost)} (${pct(top.cost, total)}%).`,
      `The most expensive single capability is ${capLabel(l3)} at ${fmtK(l3.cost)}, from ${plural(l3.tools.length, 'tool')}. Figures are the master list estimates and are illustrative.`,
    ],
    rows: tree.map((g) => ({ label: g.l2, value: `${fmtK(g.cost)} · ${plural(g.tools.length, 'tool')}` })),
    cite: { screen: 'capability', params: {}, label: 'Capability View', filters: 'all tools' },
    followUps: ['Where do several tools do the same job?', 'What renews in the next 90 days?'],
  }
}

function duplicates({ state, lm }: AskContext): Answer {
  const dups = duplicateCaps(capabilityTree(state, lm), 4)
  return {
    intent: 'duplicates',
    text: dups.length
      ? [`${plural(dups.length, 'capability', 'capabilities')} ${dups.length === 1 ? 'is' : 'are'} served by 4 or more tools of the same layer.`, `The largest overlap is ${capLabel(dups[0])}: ${plural(overlapCount(dups[0]).count, overlapCount(dups[0]).layer === 'Application' ? 'application' : 'foundation')}, ${fmtK(dups[0].cost)} a year between them.`]
      : ['No capability is served by 4 or more tools of one layer.'],
    rows: dups.map((n) => {
      const o = overlapCount(n)
      const list = o.layer === 'Application' ? n.apps : n.foundations
      return { label: capLabel(n), value: list.map((t) => t.name).join(', ') }
    }),
    cite: { screen: 'capability', params: { only: '1', dup: '4' }, label: 'Capability View', filters: 'overlaps only, 4+ tools' },
    followUps: ['What is the cost by capability?', 'What renews in the next 90 days?'],
  }
}

function renewals({ contracts }: AskContext): Answer {
  const next = contracts.filter((c) => daysUntil(c.renewal) >= 0 && daysUntil(c.renewal) <= 90).sort((a, b) => a.renewal.localeCompare(b.renewal))
  const passed = next.filter((c) => daysUntil(addDays(c.renewal, -c.noticeDays)) < 0)
  const value = next.reduce((s, c) => s + c.valueK, 0)
  return {
    intent: 'renewals',
    text: next.length
      ? [`${plural(next.length, 'contract')} ${next.length === 1 ? 'renews' : 'renew'} in the next 90 days, worth ${fmtK(value)} a year.`, passed.length ? `The notice deadline has already passed on ${plural(passed.length, 'of them', 'of them')}: ${passed.map((c) => c.vendor).join(', ')}.` : 'No notice deadline has passed yet.']
      : ['No contract renews in the next 90 days.'],
    rows: next.map((c) => ({ label: `${c.vendor} (${c.id})`, value: `${fmtDate(c.renewal)} · ${fmtK(c.valueK)} · ${c.toolNames.join(', ')}` })),
    cite: { screen: 'vendors', params: { within: '90' }, label: 'Vendors & renewals', filters: 'next 90 days' },
    followUps: ['Where do several tools do the same job?', 'What is the cost by capability?'],
  }
}

function onlyLeanix({ state }: AskContext): Answer {
  const recs = state.sourceRecords.filter((r) => r.source === LEANIX_SOURCE)
  if (recs.length === 0) {
    return {
      intent: 'onlyLeanix',
      text: ['LeanIX has not been reconciled in this session, so I cannot say yet. Run the reconciliation and ask again.'],
      cite: { screen: 'import', params: {}, label: 'Import & Reconcile', filters: 'no LeanIX import yet' },
      followUps: ['Which desks have not attested?'],
    }
  }
  const only = recs.filter((r) => r.matchType === 'unmatched' && r.resolution === 'pending')
  const importId = recs[0].importId
  return {
    intent: 'onlyLeanix',
    text: only.length ? [`${plural(only.length, 'fact sheet')} in LeanIX ${only.length === 1 ? 'has' : 'have'} no match in the master list and no decision yet.`, 'Each can be created as a new tool or ignored. LeanIX stays the record either way.'] : ['Every LeanIX fact sheet is matched, created or ignored.'],
    rows: only.map((r) => ({ label: r.rawName, value: r.externalId })),
    cite: { screen: 'import', params: { run: importId }, label: 'Import & Reconcile', filters: 'latest LeanIX report' },
    followUps: ['What breaks if Snowflake goes away?', 'Which desks have not attested?'],
  }
}

export function answer(q: string, ctx: AskContext): Answer {
  switch (matchIntent(q)) {
    case 'breaks':
      return breaks(q, ctx)
    case 'attestation':
      return attestation(ctx)
    case 'cost':
      return cost(ctx)
    case 'duplicates':
      return duplicates(ctx)
    case 'renewals':
      return renewals(ctx)
    case 'onlyLeanix':
      return onlyLeanix(ctx)
    default:
      return {
        intent: 'help',
        text: ['I answer a fixed set of questions from the map. Try one of these, or ask “what breaks if …” about any tool.'],
        followUps: SUGGESTED_QUESTIONS,
      }
  }
}
