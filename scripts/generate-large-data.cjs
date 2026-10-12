/**
 * Generates large synthetic demo files (1,000+ rows each) for upload into the Tech Map:
 *   public/samples/InvestmentsToolMapping_LARGE.xlsx  master workbook (same sheets as the demo workbook)
 *   public/samples/leanix_export_large.csv            LeanIX fact sheet export, with deliberate mismatches
 *   public/samples/jira_export_large.csv              Jira issue export, each issue tagged with a tool component
 *
 * Every name and number is invented. Run: node scripts/generate-large-data.cjs
 */
const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const OUT = path.join(__dirname, '..', 'public', 'samples')
fs.mkdirSync(OUT, { recursive: true })

// Deterministic random numbers so the files are the same every run.
let seed = 20261012
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const pick = (a) => a[Math.floor(rnd() * a.length)]
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
const chance = (p) => rnd() < p

// ── Capability matrix (same terms as the app's taxonomy) ─────────────────────
const CAPS = [
  ['PM', 'Order Management', ['Order', 'Allocation', 'Rebalance', 'Trade Blotter']],
  ['PM', 'Portfolio Construction', ['Portfolio', 'Model Portfolio', 'Mandate', 'Fund Structure']],
  ['PM', 'Optimisation', ['Optimiser', 'Tax Lot', 'Constraint']],
  ['PM', 'Cash Management', ['Cash', 'Liquidity', 'Collateral', 'Margin']],
  ['Trading', 'Execution', ['Execution', 'Venue', 'RFQ', 'Algo']],
  ['Trading', 'Market Data', ['Market Data', 'Price', 'Curve', 'Index Data']],
  ['Research', 'Research & Analytics', ['Credit Research', 'Equity Research', 'Macro', 'Screening']],
  ['Research', 'ESG', ['ESG', 'Stewardship', 'Climate', 'Engagement']],
  ['Risk', 'Risk Analytics', ['Risk', 'Exposure', 'Stress', 'VaR', 'Liquidity Risk']],
  ['Other', 'Data Platform', ['Reference Data', 'Security Master', 'Holdings', 'Positions']],
  ['Other', 'Integration', ['Trade Feed', 'Event', 'Message', 'File Transfer']],
  ['Other', 'Reporting & MI', ['Client Reporting', 'Performance', 'Attribution', 'Board MI']],
  ['Other', 'NON-Inv', ['HR', 'Expenses', 'Facilities', 'Learning']],
]
const ASSET = ['Credit', 'Rates', 'Equity', 'FX', 'Multi-Asset', 'LDI', 'Index', 'Private Credit', 'Property', 'Sterling', 'EMD', 'Global']

// Function word decides the Tool type and therefore the layer.
const FUNCTIONS = [
  ['Dashboard', 'UI'], ['Workbench', 'UI'], ['Portal', 'UI'], ['Monitor', 'UI'], ['Tracker', 'UI'], ['Viewer', 'UI'], ['Calculator', 'UI'], ['Blotter', 'UI'],
  ['Feed', 'Data Tfr'], ['Loader', 'Data Tfr'], ['Gateway', 'Data Tfr'], ['Bridge', 'Data Tfr'], ['Pipeline', 'Data Tfr'],
  ['Store', 'Data'], ['Mart', 'Data'], ['Database', 'Data'], ['Cache', 'Data'],
  ['Engine', 'Engine'], ['Model', 'Engine'], ['Service', 'Engine'], ['Simulator', 'Engine'],
]
const LAYER = { UI: 'Application', Data: 'Foundation', 'Data Tfr': 'Foundation', Engine: 'Foundation' }
const USERS = ['Inv', 'Ops', 'Inv & Ops', 'Inv & Distn', 'ALL', 'Distn', 'Inv & Distn & Ops']

const DESKS = {
  'Active Fixed Income': ['Global Credit', 'Emerging Market Debt', 'Sovereign Rates'],
  'Index Equity': ['Developed Index', 'Factor Index'],
  'LDI & Solutions': ['Pension Hedging', 'Buy & Maintain'],
  'Multi-Asset': ['Diversified Growth', 'Retirement Income'],
  'Cash & Liquidity': ['Sterling Liquidity', 'Short-Term Credit'],
  'Real Assets': ['Private Credit', 'Property Debt'],
}

// A few well-known market products, so the list reads like a real estate.
const MARKET = [
  ['Bloomberg Terminals', 'UI', 'Trading', 'Market Data', 'Y', 2100], ['Bloomberg AIM', 'UI', 'PM', 'Order Management', 'Y', 1250], ['Charles River IMS', 'UI', 'PM', 'Order Management', 'Y', 1100],
  ['Aladdin Risk', 'UI', 'Risk', 'Risk Analytics', 'Y', 1800], ['FactSet Workstation', 'UI', 'Research', 'Research & Analytics', 'Y', 520], ['Refinitiv Eikon', 'UI', 'Trading', 'Market Data', 'Y', 340],
  ['TradeWeb', 'UI', 'Trading', 'Execution', 'Y', 290], ['MarketAxess', 'UI', 'Trading', 'Execution', 'Y', 275], ['Snowflake (Inv Data Lake)', 'Data', 'Other', 'Data Platform', 'Y', 950],
  ['Kafka Event Bus', 'Data Tfr', 'Other', 'Integration', 'Y', 260], ['Power BI Service', 'UI', 'Other', 'Reporting & MI', 'Y', 180], ['Azure Data Factory Pipelines', 'Data Tfr', 'Other', 'Integration', 'Y', 310],
  ['Domino Data Lab', 'Engine', 'Research', 'Research & Analytics', 'Y', 400], ['Axioma Risk Analytics', 'UI', 'Risk', 'Risk Analytics', 'Y', 420], ['Oracle Securities DB', 'Data', 'Other', 'Data Platform', 'Y', 480],
]

// ── Master tool list ─────────────────────────────────────────────────────────
const TARGET_TOOLS = 1100
const tools = []
const seen = new Set()
for (const [name, type, l2, l3, vendor, cost] of MARKET) {
  seen.add(name)
  tools.push({ name, vendor, ownership: 'In-house', type, users: pick(USERS), group: '', l2, l3, cost })
}
while (tools.length < TARGET_TOOLS) {
  const [l2, l3, subjects] = pick(CAPS)
  const [fn, type] = pick(FUNCTIONS)
  const subject = pick(subjects)
  const prefix = chance(0.55) ? `${pick(ASSET)} ` : ''
  const euc = type === 'UI' && chance(0.12)
  let name = `${prefix}${subject} ${fn}${euc ? ' (EUC)' : ''}`
  if (seen.has(name)) name = `${name.replace(' (EUC)', '')} ${pick(['II', 'Lite', 'Pro', 'Next', 'Legacy', 'Hub'])}${euc ? ' (EUC)' : ''}`
  if (seen.has(name)) continue
  seen.add(name)
  const vendor = euc ? 'N' : pick(['Y', 'Y', 'N', 'N', 'N', '?'])
  const base = type === 'UI' ? 60 : type === 'Engine' ? 90 : 50
  tools.push({
    name,
    vendor,
    ownership: chance(0.7) ? 'In-house' : 'Group Technology',
    type,
    users: pick(USERS),
    group: euc ? 'Desk-built' : '',
    l2,
    l3,
    cost: euc ? 0 : Math.round(base + rnd() * rnd() * 900),
  })
}
// About 2% arrive unclassified, as they would from a hand-built list.
for (const t of tools.slice(MARKET.length)) if (chance(0.02)) Object.assign(t, { type: '', l2: '', l3: '' })

const masterRows = tools.map((t) => ({
  'App / Tool / EUC': t.name,
  Vendor: t.vendor,
  'Tech Ownership': t.ownership,
  'Tool type': t.type,
  Users: t.users,
  'Inv User Group': t.group,
  'Cap L2': t.l2,
  'Cap L3': t.l3,
  'Est Annual Cost (£k)': t.cost,
  'Layer (derived)': t.type ? LAYER[t.type] : '',
}))

// ── Taxonomy ─────────────────────────────────────────────────────────────────
const taxonomy = [
  ['Tool type', 'UI', 'Application'], ['Tool type', 'Data', 'Foundation'], ['Tool type', 'Data Tfr', 'Foundation'], ['Tool type', 'Engine', 'Foundation'],
  ...[...new Set(CAPS.map((c) => c[0]))].map((l2) => ['Cap L2', l2, '']),
  ...CAPS.map(([l2, l3]) => ['Cap L3', l3, l2]),
  ['Users', 'Inv', ''], ['Users', 'Ops', ''], ['Users', 'Distn', ''], ['Users', 'ALL', ''],
  ...Object.keys(DESKS).map((d) => ['Desk', d, '']),
  ...Object.entries(DESKS).flatMap(([d, ss]) => ss.map((s) => ['Strategy', s, d])),
].map(([Category, Term, note]) => ({ Category, Term, 'Parent / Note': note }))

// ── Desk usage (applications only) ───────────────────────────────────────────
const apps = tools.filter((t) => t.type === 'UI')
const foundations = tools.filter((t) => t.type && t.type !== 'UI')
const usage = []
const usageKey = new Set()
const strategies = Object.entries(DESKS).flatMap(([d, ss]) => ss.map((s) => [d, s]))
const isoDay = (daysAgo) => {
  const d = new Date('2026-10-12T00:00:00Z')
  d.setUTCDate(d.getUTCDate() - daysAgo)
  return d.toISOString().slice(0, 10)
}
while (usage.length < 1600) {
  const app = pick(apps)
  const [desk, strategy] = pick(strategies)
  const k = `${desk}|${strategy}|${app.name}`
  if (usageKey.has(k)) continue
  usageKey.add(k)
  const attested = chance(0.68)
  usage.push({ Desk: desk, Strategy: strategy, Application: app.name, Criticality: pick(['Critical', 'Critical', 'Important', 'Nice to have']), Attestation: attested ? 'Attested' : 'Not yet attested', 'Attested On': attested ? isoDay(int(1, 120)) : '' })
}

// ── Dependencies (application → foundation) ──────────────────────────────────
const deps = []
const depKey = new Set()
while (deps.length < 1500) {
  const app = pick(apps)
  // Prefer foundations in the same Cap L2, as real estates cluster.
  const near = foundations.filter((f) => f.l2 === app.l2)
  const f = chance(0.7) && near.length ? pick(near) : pick(foundations)
  const k = `${app.name}|${f.name}`
  if (depKey.has(k)) continue
  depKey.add(k)
  deps.push({ Application: app.name, 'Depends On (Foundation)': f.name, Direction: pick(['Reads', 'Writes', 'Both', 'Reads']) })
}

// ── LeanIX export: most tools, some renamed, some missing, some extra ────────
const FS_TYPE = { UI: 'Application', Data: 'Data Object', 'Data Tfr': 'Interface', Engine: 'IT Component', '': 'Application' }
const BIZCAP = { PM: 'Investment Management', Trading: 'Trading', Research: 'Research', Risk: 'Risk', Other: 'Data Services', '': 'Data Services' }
const rename = (n) => {
  const base = n.replace(/\s*\((EUC|Legacy)\)\s*$/, '')
  const r = rnd()
  if (r < 0.3) return base.replace('Dashboard', 'Dash').replace('Database', 'DB').replace('Calculator', 'Calc')
  if (r < 0.6) return `${base} Platform`
  if (r < 0.8) return base.toUpperCase()
  return `${base} (Prod)`
}
const leanix = []
let lxId = 10000
let renamed = 0
let missing = 0
for (const t of tools) {
  // EUCs are rarely in LeanIX; a few other tools are simply missing.
  if (t.group === 'Desk-built' ? chance(0.9) : chance(0.03)) {
    missing++
    continue
  }
  let name = t.name
  if (chance(0.04)) {
    const r = rename(name)
    if (r !== name) {
      name = r
      renamed++
    }
  }
  leanix.push({
    'LeanIX ID': `APP-${lxId++}`,
    'Application Name': name,
    'Fact Sheet Type': FS_TYPE[t.type],
    Lifecycle: pick(['Active', 'Active', 'Active', 'Plan', 'Phase Out', 'End of Life']),
    'Owning Org': t.ownership === 'Group Technology' ? 'Group Technology' : 'Investments',
    'Business Capability': BIZCAP[t.l2],
    'Criticality Tier': pick(['Tier 1', 'Tier 2', 'Tier 2', 'Tier 3']),
  })
}
const EXTRA = ['Murex', 'Calypso', 'SimCorp Dimension', 'Clearwater Analytics', 'Informatica MDM', 'Bloomberg PORT Enterprise', 'ION Trading', 'Broadridge Gloss', 'Workday Finance', 'ServiceNow ITSM', 'Confluence Wiki', 'Tableau Server', 'MSCI RiskMetrics', 'Sustainalytics Feed', 'ICE Data Services', 'S&P Capital IQ', 'Moody’s Analytics', 'Enfusion', 'Arcesium Forge', 'Linedata Longview']
for (const n of EXTRA) leanix.push({ 'LeanIX ID': `APP-${lxId++}`, 'Application Name': n, 'Fact Sheet Type': 'Application', Lifecycle: pick(['Active', 'Plan']), 'Owning Org': pick(['Group Technology', 'Investments']), 'Business Capability': pick(Object.values(BIZCAP)), 'Criticality Tier': pick(['Tier 2', 'Tier 3']) })

// ── Jira export: change work tagged with the tool it touches ─────────────────
const PROJECTS = [['INVCH', 'Investments Change'], ['TRDT', 'Trading Technology'], ['DATA', 'Data Platform'], ['RISKT', 'Risk Technology']]
const TEAMS = ['Platform Squad', 'Orders Squad', 'Data Squad', 'Risk Squad', 'Reporting Squad', 'Desk Tools Squad']
const VERBS = ['Add', 'Fix', 'Migrate', 'Upgrade', 'Decommission', 'Automate', 'Reconcile', 'Improve', 'Validate', 'Retire']
const OBJECTS = ['data load', 'user access review', 'month-end report', 'price feed', 'allocation rules', 'LeanIX record', 'audit trail', 'error handling', 'performance', 'golden source link', 'attestation reminder', 'API client']
const jiraTools = tools.filter((t) => t.type)
const jira = []
const counters = Object.fromEntries(PROJECTS.map(([k]) => [k, 100]))
for (let i = 0; i < 1500; i++) {
  const [key, projName] = pick(PROJECTS)
  const t = pick(jiraTools)
  // About 3% of tickets name a component the map does not recognise yet.
  const comp = chance(0.03) ? pick(['Legacy Batch Server', 'Team SharePoint', 'Vendor Portal X', 'Old FTP Box']) : chance(0.03) ? rename(t.name) : t.name
  const type = pick(['Story', 'Story', 'Story', 'Bug', 'Task', 'Epic'])
  const status = pick(['To Do', 'In Progress', 'In Review', 'Done', 'Done', 'Done'])
  const created = int(5, 400)
  const resolved = status === 'Done' ? Math.max(0, created - int(2, 60)) : null
  counters[key]++
  jira.push({
    'Issue key': `${key}-${counters[key]}`,
    Summary: `${pick(VERBS)} ${pick(OBJECTS)} for ${comp}`,
    'Issue Type': type,
    Status: status,
    Priority: pick(['Low', 'Medium', 'Medium', 'High', 'Highest']),
    Project: projName,
    'Component/s': comp,
    'Epic Link': `${key}-${int(1, 40)}`,
    Labels: [t.l3 ? t.l3.replace(/[^A-Za-z]/g, '') : 'Unclassified', pick(['platform-move', 'run', 'regulatory', 'cost-out'])].join(' '),
    Team: pick(TEAMS),
    'Story Points': type === 'Epic' ? '' : pick([1, 2, 3, 5, 8, 13]),
    Created: isoDay(created),
    Resolved: resolved === null ? '' : isoDay(resolved),
    'Fix Version': pick(['2026.Q3', '2026.Q4', '2027.Q1', '']),
    Sprint: status === 'To Do' ? '' : `Sprint ${int(40, 62)}`,
  })
}

// ── Write ────────────────────────────────────────────────────────────────────
const sheet = (rows) => XLSX.utils.json_to_sheet(rows)
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ['Note'],
    ['SYNTHETIC demo data for the Investments Tech Map. Same structure as the Investments enterprise tool mapping workbook. Every name and figure is invented.'],
    [`FullTechList ${masterRows.length} tools · DeskUsage ${usage.length} rows · Dependencies ${deps.length} links · LeanIX_Export ${leanix.length} fact sheets`],
    ['Load it on Import & Reconcile with “Load as the master list”, then import leanix_export_large.csv and jira_export_large.csv.'],
  ]),
  'README',
)
XLSX.utils.book_append_sheet(wb, sheet(masterRows), 'FullTechList')
XLSX.utils.book_append_sheet(wb, sheet(taxonomy), 'Taxonomy')
XLSX.utils.book_append_sheet(wb, sheet(usage), 'DeskUsage')
XLSX.utils.book_append_sheet(wb, sheet(deps), 'Dependencies')
XLSX.utils.book_append_sheet(wb, sheet(leanix), 'LeanIX_Export')
XLSX.writeFile(wb, path.join(OUT, 'InvestmentsToolMapping_LARGE.xlsx'), { compression: true })

const csv = (rows) => XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(rows))
fs.writeFileSync(path.join(OUT, 'leanix_export_large.csv'), csv(leanix))
fs.writeFileSync(path.join(OUT, 'jira_export_large.csv'), csv(jira))

console.log(`master ${masterRows.length} tools (${apps.length} applications, ${foundations.length} foundations), usage ${usage.length}, deps ${deps.length}`)
console.log(`leanix ${leanix.length} rows: ${renamed} renamed, ${missing} master tools missing, ${EXTRA.length} only in LeanIX`)
console.log(`jira ${jira.length} issues`)
