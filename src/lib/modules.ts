import type { ModuleId } from '../demo-store'

export type ModuleStatus = 'built' | 'available'

export interface ModuleDef {
  id: string
  /** Set for modules built in this demo; switching one on adds its own screen. */
  builtId?: ModuleId
  name: string
  summary: string
  questions: string[]
  data: { what: string; from: string }[]
  effort: string
  status: ModuleStatus
  /** What the module adds to the map, for the detail sheet. */
  adds: string[]
  /** What has to be true first. */
  prerequisites: string[]
}

export const MODULES: ModuleDef[] = [
  {
    id: 'vendors',
    builtId: 'vendors',
    name: 'Vendor costs and renewals',
    summary: 'Contracts joined to tools, grouped by parent company, with a renewal calendar.',
    questions: ['Which contracts renew in the next 90 days, and what is the notice deadline?', 'What do we spend with one vendor group across all its contracts?', 'Which tools would a renewal decision affect?'],
    data: [
      { what: 'Contract register: vendor, parent, value, renewal, notice', from: 'Procurement, monthly export' },
      { what: 'Tools covered by each contract', from: 'Procurement, matched to the map by name and alias' },
    ],
    effort: 'About two weeks',
    status: 'built',
    adds: ['Vendors & renewals screen', 'Renewal calendar with notice windows', 'Vendor hierarchy: parent › vendor › contract › tools'],
    prerequisites: ['A contract register with one row per contract'],
  },
  {
    id: 'heatmap',
    builtId: 'heatmap',
    name: 'Capability × strategy heat map',
    summary: 'Where cost, tools and risk concentrate, by capability and investment strategy.',
    questions: ['Which capabilities cost most for each strategy?', 'Where do risk events cluster?', 'Which strategies depend on the most tools for one capability?'],
    data: [
      { what: 'Capability matrix and desk usage', from: 'Already in the map' },
      { what: 'Risk events, for the risk measures', from: 'Operational Risk, via the risk events module' },
    ],
    effort: 'About one week',
    status: 'built',
    adds: ['Capability heat map screen', 'Cell measure: platform cost, risk event count, risk event cost, tool count', 'Drill from any cell to the tools behind it'],
    prerequisites: ['Desk usage recorded for each strategy'],
  },
  {
    id: 'risk',
    builtId: 'risk',
    name: 'Risk events overlay',
    summary: 'Risk events joined to the tools involved, by capability and strategy.',
    questions: ['Which capabilities carry the most risk events and loss?', 'Which tools keep appearing in risk events?', 'Are EUCs over-represented?'],
    data: [{ what: 'Risk event log: date, tool, strategy, category, loss', from: 'Operational Risk, monthly export' }],
    effort: 'About two weeks',
    status: 'built',
    adds: ['Risk events screen', 'Count and cost by capability and strategy', 'Each event links to the tool involved'],
    prerequisites: ['Events tagged with a tool name the map recognises (aliases help)'],
  },
  {
    id: 'products',
    name: 'Product and project mapping',
    summary: 'Which products and projects change which tools and capabilities.',
    questions: ['Which tools does each product own?', 'Which projects touch a capability this year?', 'Where do two projects change the same tool?'],
    data: [
      { what: 'Product catalogue and owners', from: 'Product operating model team' },
      { what: 'Project portfolio', from: 'Portfolio office export' },
    ],
    effort: 'About three weeks',
    status: 'available',
    adds: ['Products and projects as new layers above tools', 'Overlap warnings between projects', 'Product view of cost and risk'],
    prerequisites: ['An agreed product list for the platform and product operating model'],
  },
  {
    id: 'people',
    name: 'People and skills',
    summary: 'Who knows which tools, and the skills gaps for next year’s change.',
    questions: ['Which tools rely on one or two people?', 'Which skills does next year’s change need that we don’t have?', 'Where is key-person risk highest?'],
    data: [{ what: 'Skills extract by person and tool', from: 'HR business partner, quarterly' }],
    effort: 'About three weeks',
    status: 'available',
    adds: ['Skills coverage per tool and capability', 'Key-person risk flags', 'Gap view against planned change'],
    prerequisites: ['Agreement on how skills data can be used and who can see it'],
  },
  {
    id: 'change',
    name: 'Change data across Jira and ServiceNow',
    summary: 'Work in flight and incidents, joined to the tools and capabilities they touch.',
    questions: ['How much change is in flight per capability?', 'Which tools have the most incidents?', 'Is change landing where the cost and risk are?'],
    data: [
      { what: 'Epics and releases from each Jira instance', from: 'Read-only API per instance' },
      { what: 'Incidents and changes', from: 'ServiceNow read-only API' },
    ],
    effort: 'About four weeks',
    status: 'available',
    adds: ['Change and incident counts on every tool', 'Capability view of change in flight', 'Trend lines by quarter'],
    prerequisites: ['Read-only service accounts', 'A tool or component field used consistently in tickets'],
  },
  {
    id: 'benefits',
    name: 'Benefits tracking after go-live',
    summary: 'Whether a change delivered what it promised, measured on the map.',
    questions: ['Did decommissioning a tool remove the cost we expected?', 'Did consolidating a capability reduce risk events?', 'Which benefits are overdue?'],
    data: [
      { what: 'Business case benefits and dates', from: 'Portfolio office' },
      { what: 'Before and after measures', from: 'Already in the map once cost and risk modules are on' },
    ],
    effort: 'About two weeks',
    status: 'available',
    adds: ['Benefit register linked to tools and capabilities', 'Before and after comparison', 'Overdue benefit alerts'],
    prerequisites: ['Vendor costs and risk events modules switched on'],
  },
]
