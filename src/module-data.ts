import { create } from 'zustand'
import { parseCsv, toNumber } from './lib/seed'
import { slugify } from './lib/util'

/**
 * Synthetic data for the Phase 4 modules: a contract register and a risk event log.
 * Read-only and reloaded on each visit, so it is not part of the editable map. Illustrative.
 */
export interface Contract {
  id: string
  vendor: string
  parent: string
  /** Tool ids, resolved from the names in the register (seed ids are slugs of the name). */
  toolIds: string[]
  toolNames: string[]
  valueK: number
  start: string
  renewal: string
  noticeDays: number
  owner: string
}

export interface RiskEvent {
  id: string
  date: string
  title: string
  toolId: string
  toolName: string
  strategy: string
  category: string
  lossK: number
  status: 'Open' | 'Closed'
}

interface ModuleData {
  loaded: boolean
  contracts: Contract[]
  riskEvents: RiskEvent[]
  load: () => Promise<void>
}

/** The synthetic dates were written for this day. They are shifted so the demo reads the same whenever it is shown. */
const ANCHOR = '2026-10-12'

function shift(iso: string): string {
  if (!iso) return iso
  const offset = Math.round((new Date(new Date().toDateString()).getTime() - new Date(`${ANCHOR}T00:00:00`).getTime()) / 86_400_000)
  return offset ? addDays(iso, offset) : iso
}

async function csv(name: string) {
  const res = await fetch(`${import.meta.env.BASE_URL}seed/${name}`)
  if (!res.ok) throw new Error(`Could not load seed/${name}`)
  return parseCsv(await res.text()).rows
}

export const useModuleData = create<ModuleData>()((set, get) => ({
  loaded: false,
  contracts: [],
  riskEvents: [],
  load: async () => {
    if (get().loaded) return
    const [c, r] = await Promise.all([csv('vendor_contracts.csv'), csv('risk_events.csv')])
    set({
      loaded: true,
      contracts: c.map((x) => {
        const names = x['Tools'].split(';').map((s) => s.trim()).filter(Boolean)
        return {
          id: x['Contract ID'],
          vendor: x['Vendor'],
          parent: x['Parent company'],
          toolNames: names,
          toolIds: names.map(slugify),
          valueK: toNumber(x['Annual value (£k)']),
          start: shift(x['Start date']),
          renewal: shift(x['Renewal date']),
          noticeDays: toNumber(x['Notice (days)']),
          owner: x['Contract owner'],
        }
      }),
      riskEvents: r.map((x) => ({
        id: x['Event ID'],
        date: shift(x['Date']),
        title: x['Title'],
        toolId: slugify(x['Tool']),
        toolName: x['Tool'],
        strategy: x['Strategy'],
        category: x['Category'],
        lossK: toNumber(x['Loss (£k)']),
        status: x['Status'] === 'Open' ? 'Open' : 'Closed',
      })),
    })
  },
}))

export function daysUntil(iso: string): number {
  const d = new Date(`${iso}T00:00:00`)
  const t = new Date(new Date().toDateString())
  return Math.round((d.getTime() - t.getTime()) / 86_400_000)
}

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
