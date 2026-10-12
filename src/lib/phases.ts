/**
 * The phase model: the single source of truth for what the demo shows in each phase
 * and environment. Screens, features, sources, the Journey and Architecture tabs all read from here.
 */

export type PhaseId = 1 | 2 | 3 | 4 | 5
export type Horizon = 'now' | 'next' | 'future'
export type Env = 'sandbox' | 'prod'

export const PHASE_IDS: PhaseId[] = [1, 2, 3, 4, 5]

export type ScreenId =
  | 'journey'
  | 'overview'
  | 'import'
  | 'taxonomy'
  | 'explorer'
  | 'capability'
  | 'desk'
  | 'foundation'
  | 'changes'
  | 'modules'
  | 'vendors'
  | 'heatmap'
  | 'risk'
  | 'suggestions'
  | 'architecture'

export type FeatureId =
  | 'euc-register'
  | 'cost'
  | 'attestation'
  | 'exports'
  | 'leanix-feed'
  | 'change-history'
  | 'approvals'
  | 'role-editing'
  | 'modules'
  | 'overview-v5'
  | 'ask-map'
  | 'suggested-labels'
  | 'report-pack'

export type SourceId = 'master' | 'leanix' | 'euc' | 'capmatrix' | 'finance' | 'vendors' | 'risk' | 'jira' | 'servicenow' | 'people'
export type Arrival = 'file-drop' | 'scheduled-export' | 'api'

export const ARRIVAL_LABEL: Record<Arrival, string> = {
  'file-drop': 'File drop',
  'scheduled-export': 'Scheduled export',
  api: 'Read-only API',
}

export interface SourceDef {
  id: SourceId
  name: string
  owner: string
  format: string
  /** What it gives the map, in one line. */
  what: string
  /** Phase in which the source first appears. */
  from: PhaseId
}

export const SOURCES: SourceDef[] = [
  { id: 'master', name: 'Master tool list', owner: 'Investments Change', format: 'Excel workbook', what: 'Every tool, its type, users, capability and estimated cost.', from: 1 },
  { id: 'leanix', name: 'LeanIX', owner: 'Enterprise Architecture', format: 'Fact sheet export (CSV/XLSX), later API', what: 'The central record of applications. The map reconciles to it.', from: 1 },
  { id: 'euc', name: 'EUC register', owner: 'Operational Risk', format: 'Register export (CSV)', what: 'Attested spreadsheets and local builds.', from: 1 },
  { id: 'capmatrix', name: 'Capability matrix', owner: 'Investments Change', format: 'Excel workbook', what: 'Cap L2 › Cap L3 terms, desks and strategies.', from: 1 },
  { id: 'finance', name: 'Finance cost allocation', owner: 'Finance business partner', format: 'Monthly extract (XLSX)', what: 'Run cost by tool, to replace the estimates.', from: 2 },
  { id: 'vendors', name: 'Vendor list', owner: 'Procurement', format: 'Contract register (XLSX)', what: 'Vendors, parent companies, contracts and renewal dates.', from: 4 },
  { id: 'risk', name: 'Risk events', owner: 'Operational Risk', format: 'Event log export (CSV)', what: 'Risk events, their cost and the tools involved.', from: 4 },
  { id: 'jira', name: 'Jira instances', owner: 'Delivery teams', format: 'Read-only API', what: 'Change work in flight, by product and capability.', from: 5 },
  { id: 'servicenow', name: 'ServiceNow', owner: 'Technology Operations', format: 'Read-only API', what: 'Incidents and changes against each tool.', from: 5 },
  { id: 'people', name: 'People and skills', owner: 'HR business partner', format: 'Skills extract (XLSX)', what: 'Who knows which tools, for next year’s change.', from: 5 },
]

export interface PhaseSource {
  id: SourceId
  arrives: Partial<Record<Env, Arrival>>
}

export interface Phase {
  id: PhaseId
  name: string
  horizon: Horizon
  purpose: string
  /** The client problem this phase answers, in her terms. */
  problem: string
  duration: string
  durationStatus: 'Draft, not agreed'
  screens: ScreenId[]
  features: FeatureId[]
  sources: PhaseSource[]
  envs: Env[]
  /** Where "Show me" lands. */
  firstScreen: ScreenId
  delivers: string[]
  dataNeeded: string[]
  talkTrack: string[]
}

const drop = (prod: Arrival = 'file-drop'): Partial<Record<Env, Arrival>> => ({ sandbox: 'file-drop', prod })

const P1_SOURCES: PhaseSource[] = [
  { id: 'master', arrives: drop() },
  { id: 'leanix', arrives: drop('scheduled-export') },
  { id: 'euc', arrives: drop('scheduled-export') },
  { id: 'capmatrix', arrives: drop() },
]

const P3_SOURCES: PhaseSource[] = [
  { id: 'master', arrives: drop() },
  { id: 'leanix', arrives: drop('api') },
  { id: 'euc', arrives: drop('scheduled-export') },
  { id: 'capmatrix', arrives: drop() },
  { id: 'finance', arrives: drop('scheduled-export') },
]

const P1_SCREENS: ScreenId[] = ['journey', 'import', 'taxonomy', 'explorer', 'architecture']
const P2_SCREENS: ScreenId[] = ['journey', 'overview', 'import', 'taxonomy', 'explorer', 'capability', 'desk', 'foundation', 'architecture']
const P3_SCREENS: ScreenId[] = [...P2_SCREENS.slice(0, -1), 'changes', 'architecture']
const P4_SCREENS: ScreenId[] = [...P3_SCREENS.slice(0, -1), 'modules', 'vendors', 'heatmap', 'risk', 'architecture']
const P5_SCREENS: ScreenId[] = [...P4_SCREENS.slice(0, -1), 'suggestions', 'architecture']

const P1_FEATURES: FeatureId[] = ['euc-register', 'cost']
const P2_FEATURES: FeatureId[] = [...P1_FEATURES, 'attestation', 'exports']
const P3_FEATURES: FeatureId[] = [...P2_FEATURES, 'leanix-feed', 'change-history', 'approvals', 'role-editing']
const P4_FEATURES: FeatureId[] = [...P3_FEATURES, 'modules']
const P5_FEATURES: FeatureId[] = [...P4_FEATURES, 'overview-v5', 'ask-map', 'suggested-labels', 'report-pack']

export const PHASES: Phase[] = [
  {
    id: 1,
    name: 'One list, reconciled',
    horizon: 'now',
    purpose: 'The master list, taxonomy and capability matrix in one place, reconciled against LeanIX and the EUC register.',
    problem: 'The tool list is built by hand and checked against LeanIX by scrolling.',
    duration: 'About 4 weeks',
    durationStatus: 'Draft, not agreed',
    screens: P1_SCREENS,
    features: P1_FEATURES,
    sources: P1_SOURCES,
    envs: ['sandbox', 'prod'],
    firstScreen: 'import',
    delivers: ['One reconciled tool list', 'The taxonomy has a home, with impact previews on every change', 'A pivot you can slice like Excel', 'Differences with LeanIX and the EUC register listed, not hunted for'],
    dataNeeded: ['Current master tool list', 'Latest LeanIX fact sheet export', 'EUC register export', 'Capability matrix'],
    talkTrack: [
      'Your list, your taxonomy, in one place. Nothing is retyped.',
      'LeanIX stays the record. We reconcile to it and show you the gaps.',
      'Renames are confirmed once and remembered as aliases.',
      'It runs on a laptop first, so we prove it before anyone builds anything.',
    ],
  },
  {
    id: 2,
    name: 'The views for January',
    horizon: 'now',
    purpose: 'Overview, desk, foundation and capability views, with attestation and exports for people who won’t log in.',
    problem: 'Requests for information land with a week’s notice, and January needs something presentable for the platform and product operating model.',
    duration: 'About 4 weeks',
    durationStatus: 'Draft, not agreed',
    screens: P2_SCREENS,
    features: P2_FEATURES,
    sources: [...P1_SOURCES, { id: 'finance', arrives: drop() }],
    envs: ['sandbox', 'prod'],
    firstScreen: 'overview',
    delivers: ['Overview of the estate', 'Desk View with attestation of the whole critical toolkit', 'Foundation View with cost and “what breaks”', 'Capability View with duplicates highlighted', 'XLSX exports'],
    dataNeeded: ['Desk and strategy usage', 'Application to foundation links', 'A named attester per desk', 'Finance cost allocation (optional, estimates work)'],
    talkTrack: [
      'The next request for information is a filter and an export, not a week.',
      'Desks attest their own critical toolkit. You see coverage at a glance.',
      'Capability View shows where several tools do the same job.',
      'Foundations show what breaks if one goes away.',
    ],
  },
  {
    id: 3,
    name: 'Connected and shared',
    horizon: 'next',
    purpose: 'A read-only LeanIX feed, change history with undo, approvals on destructive taxonomy changes, and role-based editing.',
    problem: 'More than one person has to maintain it without it decaying, and the centre needs to see the same picture.',
    duration: 'About 6 weeks',
    durationStatus: 'Draft, not agreed',
    screens: P3_SCREENS,
    features: P3_FEATURES,
    sources: P3_SOURCES,
    envs: ['sandbox', 'prod'],
    firstScreen: 'changes',
    delivers: ['Scheduled read-only LeanIX feed with drift since last sync', 'Change history with undo', 'Approvals on merges and deletes', 'Edit rights by role'],
    dataNeeded: ['A LeanIX read-only service account', 'Who holds which role', 'Who approves taxonomy changes'],
    talkTrack: [
      'Several people can maintain it. Every change is attributed and can be undone.',
      'Merges and deletes wait for a change lead to approve.',
      'LeanIX is read on a schedule. You see what drifted since last time.',
      'The centre and Group see the same picture you do.',
    ],
  },
  {
    id: 4,
    name: 'Add a module when you need it',
    horizon: 'next',
    purpose: 'A library of modules that plug into the same map: vendors and renewals, heat maps, risk events and more.',
    problem: 'Vendor renewals, risk events and cost by capability and strategy each live somewhere else.',
    duration: 'About 2 weeks per module',
    durationStatus: 'Draft, not agreed',
    screens: P4_SCREENS,
    features: P4_FEATURES,
    sources: [...P3_SOURCES, { id: 'vendors', arrives: { prod: 'scheduled-export' } }, { id: 'risk', arrives: { prod: 'scheduled-export' } }],
    envs: ['prod'],
    firstScreen: 'modules',
    delivers: ['Vendor costs and renewals', 'Capability × strategy heat map', 'Risk events overlay', 'A library of further modules, each sized'],
    dataNeeded: ['Contract register from Procurement', 'Risk event log from Operational Risk'],
    talkTrack: [
      'Each module is one more source joined to the same map.',
      'You switch one on when there is a question it answers.',
      'Vendors are grouped by parent company, so contracts can be seen together.',
      'Each card says what data it needs and roughly how long it takes.',
    ],
  },
  {
    id: 5,
    name: 'The management-information layer',
    horizon: 'future',
    purpose: 'One management-information layer for how Investments runs change and product delivery.',
    problem: 'Products, projects, people, change data and benefits each need a new build today.',
    duration: 'Ongoing, by module',
    durationStatus: 'Draft, not agreed',
    screens: P5_SCREENS,
    features: P5_FEATURES,
    sources: [
      ...P3_SOURCES,
      { id: 'vendors', arrives: { prod: 'scheduled-export' } },
      { id: 'risk', arrives: { prod: 'scheduled-export' } },
      { id: 'jira', arrives: { prod: 'api' } },
      { id: 'servicenow', arrives: { prod: 'api' } },
      { id: 'people', arrives: { prod: 'scheduled-export' } },
    ],
    envs: ['prod'],
    firstScreen: 'overview',
    delivers: ['Headline findings written as sentences', 'Map health: coverage, freshness, drift, unclassified', '“Ask the map” over live data', 'Suggested labels for a person to accept or reject', 'One-click report pack'],
    dataNeeded: ['Jira and ServiceNow read access', 'People and skills extract', 'Agreement on an approved model endpoint'],
    talkTrack: [
      'Each new view is configuration on the same map, not a new build.',
      'The overview reads like a briefing: findings first, then the evidence.',
      'Ask the map answers from the data and shows where the answer came from.',
      'Suggestions are only suggestions. A person accepts or rejects each one.',
    ],
  },
]

export const HORIZON_LABEL: Record<Horizon, string> = { now: 'Now', next: 'Next', future: 'Future' }

export function phase(id: PhaseId): Phase {
  return PHASES[id - 1]
}

export function screensFor(id: PhaseId): ScreenId[] {
  return phase(id).screens
}

export function hasFeature(id: PhaseId, f: FeatureId): boolean {
  return phase(id).features.includes(f)
}

export function sourceDef(id: SourceId): SourceDef {
  const s = SOURCES.find((x) => x.id === id)
  if (!s) throw new Error(`Unknown source ${id}`)
  return s
}

/** Sources active in a phase for an environment, with how each arrives. */
export function activeSources(id: PhaseId, env: Env): { def: SourceDef; arrives: Arrival }[] {
  const out: { def: SourceDef; arrives: Arrival }[] = []
  for (const s of phase(id).sources) {
    const a = s.arrives[env]
    if (a) out.push({ def: sourceDef(s.id), arrives: a })
  }
  return out
}

/** The first phase in which a screen appears. */
export function screenFrom(screen: ScreenId): PhaseId {
  return PHASES.find((p) => p.screens.includes(screen))?.id ?? 5
}

export function envFor(id: PhaseId, wanted: Env): Env {
  const envs = phase(id).envs
  return envs.includes(wanted) ? wanted : envs[0]
}
