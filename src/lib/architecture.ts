import { freshness } from './freshness'
import { activeSources, ARRIVAL_LABEL, PHASES, SOURCES, type Arrival, type Env, type PhaseId, type ScreenId, type SourceId } from './phases'
import { SCREEN_META } from './screens'

export type Column = 'source' | 'arrival' | 'store' | 'rule' | 'view' | 'user'

export const COLUMNS: { id: Column; label: string }[] = [
  { id: 'source', label: 'Sources' },
  { id: 'arrival', label: 'How it arrives' },
  { id: 'store', label: 'Store' },
  { id: 'rule', label: 'Rules' },
  { id: 'view', label: 'Views' },
  { id: 'user', label: 'Who uses it' },
]

export interface ArchNode {
  id: string
  column: Column
  label: string
  /** Active in this phase and environment. Inactive nodes are drawn faded. */
  active: boolean
  /** Short tag shown on the node, e.g. "Phase 3" or "File drop". */
  tag?: string
  what: string
  owner: string
  format: string
  refresh: string
  /** Screens and numbers that depend on it. */
  dependents: string[]
  status: string
}

export interface ArchEdge {
  from: string
  to: string
}

export interface PlatformItem {
  id: string
  label: string
  detail: string
  active: boolean
  tag?: string
}

export interface Architecture {
  nodes: ArchNode[]
  edges: ArchEdge[]
  platform: PlatformItem[] | null
}

/** Figures on the Overview that link here, and the path through the map that produces each one. */
export const FIGURE_PATHS: Record<string, { label: string; nodes: string[] }> = {
  tools: { label: 'Total tools', nodes: ['src:master', 'arr:file-drop', 'store', 'rule:taxonomy', 'view:overview'] },
  layers: { label: 'Applications and foundations', nodes: ['src:master', 'arr:file-drop', 'store', 'rule:taxonomy', 'rule:layer', 'view:overview'] },
  attestation: { label: 'Desk usage attested', nodes: ['src:master', 'arr:file-drop', 'store', 'rule:attestation', 'view:desk', 'view:overview'] },
  overlap: { label: 'Capabilities with overlapping tools', nodes: ['src:master', 'src:capmatrix', 'arr:file-drop', 'store', 'rule:taxonomy', 'rule:layer', 'view:capability', 'view:overview'] },
  renewals: { label: 'Upcoming renewals', nodes: ['src:vendors', 'arr:scheduled-export', 'store', 'view:vendors', 'view:overview'] },
  risk: { label: 'Risk-event loss', nodes: ['src:risk', 'arr:scheduled-export', 'store', 'rule:taxonomy', 'view:risk', 'view:heatmap', 'view:overview'] },
  unclassified: { label: 'Unclassified tools', nodes: ['src:master', 'src:leanix', 'arr:file-drop', 'arr:api', 'store', 'rule:taxonomy', 'view:suggestions', 'view:overview'] },
  freshness: { label: 'Data freshness', nodes: ['src:master', 'src:leanix', 'src:euc', 'src:capmatrix', 'src:finance', 'src:vendors', 'src:risk', 'src:jira', 'src:servicenow', 'src:people', 'arr:file-drop', 'arr:scheduled-export', 'arr:api', 'store', 'view:overview'] },
  issues: { label: 'Open issues', nodes: ['src:leanix', 'src:euc', 'arr:scheduled-export', 'arr:api', 'arr:file-drop', 'store', 'rule:matching', 'view:import', 'view:overview'] },
  cost: { label: 'Estimated annual cost', nodes: ['src:master', 'src:finance', 'arr:file-drop', 'arr:scheduled-export', 'store', 'rule:taxonomy', 'view:overview', 'view:capability'] },
  foundations: { label: 'Most depended-on foundations', nodes: ['src:master', 'arr:file-drop', 'store', 'rule:layer', 'view:foundation', 'view:overview'] },
}

const SOURCE_SCREENS: Record<SourceId, ScreenId[]> = {
  master: ['overview', 'explorer', 'capability', 'desk', 'foundation', 'taxonomy'],
  leanix: ['import', 'overview'],
  euc: ['import', 'desk'],
  capmatrix: ['taxonomy', 'capability', 'desk', 'explorer'],
  finance: ['overview', 'capability', 'foundation', 'heatmap'],
  vendors: ['vendors', 'overview'],
  risk: ['risk', 'heatmap', 'overview'],
  jira: ['overview'],
  servicenow: ['overview'],
  people: ['overview'],
}

const SOURCE_NUMBERS: Partial<Record<SourceId, string[]>> = {
  master: ['Total tools, applications, foundations', 'Estimated annual cost'],
  leanix: ['Open issues', 'Renames, only in LeanIX, missing from LeanIX'],
  euc: ['EUCs attested and missing'],
  capmatrix: ['Capabilities, desks and strategies', 'Desk usage attested'],
  finance: ['Cost by capability and foundation (replaces estimates)'],
  vendors: ['Renewals in 90 days, contract value'],
  risk: ['Risk event count and cost'],
}

const RULES: { id: string; label: string; what: string; owner: string; screens: ScreenId[]; from: PhaseId }[] = [
  { id: 'taxonomy', label: 'Taxonomy', what: 'Categories and terms behind every label. Rename or merge once and every tool follows.', owner: 'Change lead', screens: ['taxonomy', 'explorer', 'capability', 'overview', 'desk', 'heatmap'], from: 1 },
  { id: 'layer', label: 'Layer mapping', what: 'Which Tool types count as applications and which as foundations.', owner: 'Change lead', screens: ['desk', 'foundation', 'capability', 'overview'], from: 1 },
  { id: 'matching', label: 'Matching and aliases', what: 'Exact, alias and fuzzy name matching against each source. Confirmed renames become aliases.', owner: 'Change lead', screens: ['import', 'overview'], from: 1 },
  { id: 'attestation', label: 'Attestation', what: 'Desks confirm the tools they use, with a date. Coverage rolls up to the overview.', owner: 'Desk attesters', screens: ['desk', 'overview'], from: 2 },
]

const USERS: { id: string; label: string; what: string; screens: ScreenId[]; from: PhaseId }[] = [
  { id: 'team', label: 'Her team: change leads and SMEs', what: 'Maintain the list, the taxonomy and the reconciliation.', screens: ['import', 'taxonomy', 'explorer', 'capability', 'changes', 'modules', 'suggestions'], from: 1 },
  { id: 'tech', label: 'Tech leads', what: 'Keep tools, links and dependencies right.', screens: ['foundation', 'explorer', 'changes', 'import'], from: 2 },
  { id: 'tpo', label: 'Technical product owners', what: 'See what their product sits on and what breaks.', screens: ['foundation', 'capability'], from: 3 },
  { id: 'heads', label: 'Investment heads', what: 'Read the overview, their desk and the risk picture.', screens: ['overview', 'desk', 'heatmap', 'risk', 'vendors'], from: 2 },
  { id: 'group', label: 'Group, configuring from it', what: 'Group’s enterprise tool can take its configuration from this map. The map does not replace it.', screens: ['capability', 'heatmap', 'overview'], from: 3 },
  { id: 'recipients', label: 'Report recipients', what: 'People who won’t log in get the XLSX exports and the report pack.', screens: ['overview', 'desk', 'capability'], from: 2 },
]

const ARRIVAL_INFO: Record<Arrival, { what: string; owner: string; refresh: string; from: PhaseId }> = {
  'file-drop': { what: 'A file exported by hand and dropped into the app. Recognised by its headers and mapped column by column.', owner: 'Investments Change', refresh: 'When someone drops a new file', from: 1 },
  'scheduled-export': { what: 'The source system exports a file on a schedule to an agreed location, and the map picks it up.', owner: 'Source owner and platform team', refresh: 'Daily or monthly, per source', from: 1 },
  api: { what: 'A read-only connection to the source. Nothing is written back.', owner: 'Platform team', refresh: 'Each weekday at 06:00, or on demand', from: 3 },
}

export function buildArchitecture(phaseId: PhaseId, env: Env, enabledViews: ScreenId[]): Architecture {
  const active = activeSources(phaseId, env)
  const nodes: ArchNode[] = []
  const edges: ArchEdge[] = []
  const views: ScreenId[] = enabledViews.filter((v) => v !== 'journey' && v !== 'architecture')

  for (const s of SOURCES) {
    const a = active.find((x) => x.def.id === s.id)
    const later = PHASES.find((x) => x.sources.some((y) => y.id === s.id && y.arrives[env]))?.id
    nodes.push({
      id: `src:${s.id}`,
      column: 'source',
      label: s.name,
      active: !!a,
      tag: a ? ARRIVAL_LABEL[a.arrives] : later ? `Phase ${later}` : 'Production only',
      what: s.what,
      owner: s.owner,
      format: s.format,
      refresh: a ? (env === 'sandbox' ? 'When a new file is dropped in' : freshness(s.id, a.arrives)) : '—',
      dependents: [...(SOURCE_NUMBERS[s.id] ?? []), ...SOURCE_SCREENS[s.id].filter((v) => views.includes(v)).map((v) => SCREEN_META[v].label)],
      status: a ? `Active in Phase ${phaseId}: ${ARRIVAL_LABEL[a.arrives].toLowerCase()}` : later ? `Arrives in Phase ${later}` : 'Production only, from Phase 4',
    })
    if (a) edges.push({ from: `src:${s.id}`, to: `arr:${a.arrives}` })
  }

  const arrivalsUsed = new Set(active.map((a) => a.arrives))
  for (const ar of ['file-drop', 'scheduled-export', 'api'] as Arrival[]) {
    const info = ARRIVAL_INFO[ar]
    const on = arrivalsUsed.has(ar)
    nodes.push({
      id: `arr:${ar}`,
      column: 'arrival',
      label: ARRIVAL_LABEL[ar],
      active: on,
      tag: on ? `${active.filter((a) => a.arrives === ar).length} source${active.filter((a) => a.arrives === ar).length === 1 ? '' : 's'}` : env === 'sandbox' && ar !== 'file-drop' ? 'Production' : `Phase ${info.from}`,
      what: info.what,
      owner: info.owner,
      format: ar === 'api' ? 'JSON over HTTPS, read-only' : 'CSV or XLSX',
      refresh: info.refresh,
      dependents: active.filter((a) => a.arrives === ar).map((a) => a.def.name),
      status: on ? 'Active' : env === 'sandbox' ? 'Not used in the sandbox: files are dropped in by hand' : `Arrives in Phase ${info.from}`,
    })
    if (on) edges.push({ from: `arr:${ar}`, to: 'store' })
  }

  nodes.push(
    env === 'sandbox'
      ? {
          id: 'store',
          column: 'store',
          label: 'Browser storage',
          active: true,
          tag: 'This laptop',
          what: 'Everything is saved in this browser on this laptop. Nothing leaves the machine.',
          owner: 'Whoever runs the sandbox',
          format: 'Browser local storage (JSON)',
          refresh: 'On every edit',
          dependents: ['Every screen'],
          status: 'Active in the sandbox. One person, one laptop.',
        }
      : {
          id: 'store',
          column: 'store',
          label: 'Database in the client tenant',
          active: true,
          tag: 'Proposed',
          what: 'One shared store in the client’s own cloud tenant, so several people work on the same map.',
          owner: 'Platform team',
          format: 'Managed relational database',
          refresh: 'On every edit, with change history',
          dependents: ['Every screen', 'Change history and approvals (Phase 3 on)'],
          status: 'Proposed, to confirm with the platform team',
        },
  )

  for (const r of RULES) {
    const on = phaseId >= r.from
    nodes.push({
      id: `rule:${r.id}`,
      column: 'rule',
      label: r.label,
      active: on,
      tag: on ? undefined : `Phase ${r.from}`,
      what: r.what,
      owner: r.owner,
      format: 'Held in the store',
      refresh: 'Changes apply at once',
      dependents: r.screens.filter((v) => views.includes(v)).map((v) => SCREEN_META[v].label),
      status: on ? (phaseId >= 3 && r.id === 'taxonomy' ? 'Active, with approvals on merges and deletes' : 'Active') : `Arrives in Phase ${r.from}`,
    })
    if (on) {
      edges.push({ from: 'store', to: `rule:${r.id}` })
      for (const v of r.screens) if (views.includes(v)) edges.push({ from: `rule:${r.id}`, to: `view:${v}` })
    }
  }

  for (const v of views) {
    nodes.push({
      id: `view:${v}`,
      column: 'view',
      label: SCREEN_META[v].label,
      active: true,
      what: VIEW_WHAT[v],
      owner: 'Investments Change',
      format: 'Screen, with XLSX export where useful',
      refresh: 'Live from the store',
      dependents: USERS.filter((u) => u.screens.includes(v) && phaseId >= u.from).map((u) => u.label),
      status: `In Phase ${phaseId}`,
    })
  }
  // Views that only read the store directly (no single rule).
  for (const v of views) if (!edges.some((e) => e.to === `view:${v}`)) edges.push({ from: 'store', to: `view:${v}` })

  for (const u of USERS) {
    const on = phaseId >= u.from
    nodes.push({ id: `user:${u.id}`, column: 'user', label: u.label, active: on, tag: on ? undefined : `Phase ${u.from}`, what: u.what, owner: '—', format: '—', refresh: '—', dependents: u.screens.filter((v) => views.includes(v)).map((v) => SCREEN_META[v].label), status: on ? 'Using it in this phase' : `From Phase ${u.from}` })
    if (on) for (const v of u.screens) if (views.includes(v)) edges.push({ from: `view:${v}`, to: `user:${u.id}` })
  }

  const platform: PlatformItem[] | null =
    env === 'prod'
      ? [
          { id: 'code', label: 'Code in the client’s GitHub Enterprise', detail: 'The app’s source lives in the client’s own repositories, reviewed and released by their process.', active: true },
          { id: 'hosting', label: 'Hosting in her tenant', detail: 'Runs inside the client’s cloud tenant, next to the database.', active: true },
          { id: 'signin', label: 'Entra ID sign-in', detail: 'People sign in with their work account. Roles come from Entra ID groups.', active: true },
          { id: 'secrets', label: 'Secrets in a key vault', detail: 'Connection details for LeanIX and other feeds are held in a key vault, never in code.', active: phaseId >= 3, tag: phaseId >= 3 ? undefined : 'Phase 3' },
          { id: 'model', label: 'Approved model endpoint', detail: 'If “Ask the map” and suggested labels later use a model, it is one the client has approved, inside the tenant. Not connected in this demo.', active: phaseId >= 5, tag: phaseId >= 5 ? 'Not connected in demo' : 'Phase 5' },
        ]
      : null

  return { nodes, edges, platform }
}

const VIEW_WHAT: Record<ScreenId, string> = {
  journey: 'The story of the phases.',
  overview: 'The estate on one page.',
  import: 'Bring in a source and reconcile it to the master list.',
  taxonomy: 'Edit the reference data behind every label.',
  explorer: 'Slice the map like a pivot table.',
  capability: 'Tools by Cap L2 › Cap L3, with overlaps flagged.',
  desk: 'Each desk’s applications by strategy, with attestation.',
  foundation: 'What each foundation supports and what breaks without it.',
  changes: 'Change history, undo and approvals.',
  modules: 'The module library.',
  vendors: 'Contracts, vendor groups and renewals.',
  heatmap: 'Capability × strategy by cost, tools or risk.',
  risk: 'Risk events joined to tools.',
  suggestions: 'Suggested labels for a person to accept or reject.',
  architecture: 'Where everything comes from.',
}

/** Every node connected to `id`, upstream and downstream. */
export function connected(edges: ArchEdge[], id: string): Set<string> {
  const out = new Set<string>([id])
  const walk = (dir: 'up' | 'down', from: string) => {
    for (const e of edges) {
      const [a, b] = dir === 'down' ? [e.from, e.to] : [e.to, e.from]
      if (a === from && !out.has(b)) {
        out.add(b)
        walk(dir, b)
      }
    }
  }
  walk('down', id)
  walk('up', id)
  return out
}

/**
 * What to light up when a node is picked. A source lights only the views that use it,
 * not everything downstream of the shared store.
 */
export function highlightFor(arch: Architecture, id: string): Set<string> {
  if (!id.startsWith('src:')) return connected(arch.edges, id)
  const src = id.slice(4) as SourceId
  const out = new Set<string>([id])
  for (const e of arch.edges) if (e.from === id) out.add(e.to)
  out.add('store')
  const views = SOURCE_SCREENS[src].map((v) => `view:${v}`).filter((v) => arch.nodes.some((n) => n.id === v))
  for (const v of views) {
    out.add(v)
    for (const e of arch.edges) {
      if (e.to === v && e.from.startsWith('rule:')) out.add(e.from)
      if (e.from === v) out.add(e.to)
    }
  }
  return out
}
