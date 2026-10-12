import type { Arrival, SourceId } from './phases'

/** Simulated "last arrived" offsets, so production freshness lines read naturally. Illustrative. */
const DAYS_AGO: Record<SourceId, number> = {
  master: 3,
  leanix: 0,
  euc: 1,
  capmatrix: 12,
  finance: 9,
  vendors: 6,
  risk: 2,
  jira: 0,
  servicenow: 0,
  people: 20,
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function dayLabel(daysAgo: number): string {
  if (daysAgo === 0) return 'today'
  if (daysAgo === 1) return 'yesterday'
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function freshness(source: SourceId, arrives: Arrival): string {
  const days = DAYS_AGO[source]
  switch (arrives) {
    case 'file-drop':
      return `file ${dayLabel(days)}`
    case 'scheduled-export':
      return days === 0 ? 'export 06:00 today' : `export ${dayLabel(days)}`
    case 'api':
      return 'synced 14 min ago'
  }
}

/** Stale if a file is more than ten days old. */
export function isStale(source: SourceId, arrives: Arrival): boolean {
  return arrives === 'file-drop' && DAYS_AGO[source] > 10
}

export function lastArrivedDaysAgo(source: SourceId): number {
  return DAYS_AGO[source]
}
