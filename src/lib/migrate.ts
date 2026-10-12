/**
 * Migrations for state saved in this browser by earlier builds.
 * v1 → v2: the "Kirsty Cat" category became "Tool type" (field kirstyCat → toolType),
 * and organisation and in-house system names in the seed were replaced with neutral ones.
 */

const OLD_CATEGORY = ['Kirsty', 'Cat'].join(' ')
const OLD_FIELD = 'kirsty' + 'Cat'

/** Longest first, so compound names are replaced before their parts. */
const RENAMES: [string, string][] = [
  ['Incursion (Quasar / Scope / Phoenix data)', 'Tributary (Meridian / Lens / Atlas data)'],
  ['Marketplace (Historical Data)', 'Data Bazaar (Historical Data)'],
  ['Marketplace (Non ADP Data)', 'Data Bazaar (External Data)'],
  ['Charles River IMS - STOM', 'Charles River IMS - Core'],
  ['CRIMS (STOM PMS)', 'CRIMS (Core PMS)'],
  ['LGIM Investments', 'Investments'],
  [OLD_CATEGORY, 'Tool type'],
  ['Marketplace', 'Data Bazaar'],
  ['Quasar', 'Meridian'],
  ['Scope', 'Lens'],
  ['Phoenix', 'Atlas'],
  ['CEDAR', 'BIRCH'],
  ['MAPLE', 'ROWAN'],
  ['OTC-X', 'Swapline'],
  ['Alice', 'Quill'],
  ['L&G', 'In-house'],
  ['GTI', 'Group Technology'],
]

const PATTERNS = RENAMES.map(([from, to]) => [new RegExp(`(?<![A-Za-z])${from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z])`, 'g'), to] as const)

function renameString(s: string): string {
  let out = s
  for (const [re, to] of PATTERNS) out = out.replace(re, to)
  return out
}

function deep(v: unknown): unknown {
  if (typeof v === 'string') return renameString(v)
  if (Array.isArray(v)) return v.map(deep)
  if (v && typeof v === 'object') {
    const o: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) o[k === OLD_FIELD ? 'toolType' : renameString(k)] = deep(x)
    return o
  }
  return v
}

export function migrateState(persisted: unknown, version: number): unknown {
  if (version < 2) return deep(persisted)
  return persisted
}
