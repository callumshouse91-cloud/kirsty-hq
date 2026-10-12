import type { Approval, ChangeEvent, DataState } from '../types'
import { CAT, impactSentence, termImpact } from './taxonomy'

function daysAgo(n: number, hour = 10, minute = 15): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

/** History that came with the demo data. It reads like real history but has no undo record. Illustrative. */
export function seededHistory(): ChangeEvent[] {
  return [
    { id: 'seed-h1', at: daysAgo(1, 16, 40), actor: 'Change lead', kind: 'taxonomy', summary: `Added ${CAT.capL3} “Cash Management” under PM` },
    { id: 'seed-h2', at: daysAgo(2, 11, 5), actor: 'Tech lead', kind: 'dependency', summary: 'Linked BBG AIM to Kafka Event Bus (Reads)' },
    { id: 'seed-h3', at: daysAgo(3, 9, 30), actor: 'Desk attester', kind: 'usage', summary: 'Attested 6 usages for Active Fixed Income' },
    { id: 'seed-h4', at: daysAgo(6, 14, 20), actor: 'Change lead', kind: 'mapping', summary: `Mapped ${CAT.toolType} “Engine” to Foundation` },
    { id: 'seed-h5', at: daysAgo(8, 10, 0), actor: 'Change lead', kind: 'taxonomy', summary: `Renamed ${CAT.capL2} “Portfolio Mgmt” to “PM”`, approvedBy: 'Change lead' },
  ]
}

/** One request waiting for a change lead, and two already decided. */
export function seededApprovals(state: Pick<DataState, 'tools' | 'usages' | 'taxonomy'>): Approval[] {
  const full = { ...state, categories: [], dependencies: [], sourceRecords: [], aliases: [], issues: [], imports: [], history: [], approvals: [], feedRuns: [] }
  const impact = impactSentence(termImpact(full, CAT.capL3, 'Optimisation'), 're-point')
  return [
    {
      id: 'seed-a1',
      at: daysAgo(0, 8, 52),
      requestedBy: 'Tech lead',
      action: { kind: 'merge', category: CAT.capL3, term: 'Optimisation', into: 'Portfolio Construction' },
      impact,
      status: 'Pending',
    },
    {
      id: 'seed-a2',
      at: daysAgo(4, 15, 10),
      requestedBy: 'Tech lead',
      action: { kind: 'delete', category: CAT.users, term: 'Distn' },
      impact: 'This will re-label 4 tools.',
      status: 'Rejected',
      decidedBy: 'Change lead',
      decidedAt: daysAgo(4, 17, 2),
      note: 'Distribution still uses these tools. Keep the term.',
    },
    {
      id: 'seed-a3',
      at: daysAgo(9, 9, 45),
      requestedBy: 'Tech lead',
      action: { kind: 'merge', category: CAT.capL2, term: 'Portfolio Mgmt', into: 'PM' },
      impact: 'This will re-point 13 tools.',
      status: 'Approved',
      decidedBy: 'Change lead',
      decidedAt: daysAgo(8, 10, 0),
    },
  ]
}
