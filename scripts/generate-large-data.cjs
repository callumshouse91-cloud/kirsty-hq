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
  // Non-investment tools are plain applications; investment ones can be any layer.
  const [fn, type] = l3 === 'NON-Inv' ? pick(FUNCTIONS.filter((f) => f[1] === 'UI')) : pick(FUNCTIONS)
  const subject = pick(subjects)
  // Never repeat a word ("Model Portfolio Model", "Trade Blotter Blotter").
  if (subject.toLowerCase().split(' ').some((w) => fn.toLowerCase().startsWith(w.slice(0, 5)))) continue
  const prefix = l2 !== 'Other' && chance(0.55) ? `${pick(ASSET)} ` : ''
  const euc = type === 'UI' && l3 !== 'NON-Inv' && chance(0.12)
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

// ── Vendor contracts: vendor products grouped under parent companies ─────────
const VENDOR_GROUPS = [
  ['Bloomberg', 'Bloomberg L.P.'], ['Charles River Development', 'State Street'], ['State Street Alpha', 'State Street'], ['Axioma', 'Deutsche Börse'], ['SimCorp', 'Deutsche Börse'],
  ['BlackRock Solutions', 'BlackRock'], ['Refinitiv', 'LSEG'], ['Tradeweb', 'LSEG'], ['FactSet', 'FactSet'], ['MarketAxess', 'MarketAxess'], ['Snowflake', 'Snowflake'],
  ['Oracle', 'Oracle'], ['Microsoft', 'Microsoft'], ['Domino Data Lab', 'Domino Data Lab'], ['Confluent', 'Confluent'], ['MSCI', 'MSCI'], ['ICE Data Services', 'Intercontinental Exchange'], ['S&P Global', 'S&P Global'],
]
const KNOWN_VENDOR = {
  'Bloomberg Terminals': 'Bloomberg', 'Bloomberg AIM': 'Bloomberg', 'Charles River IMS': 'Charles River Development', 'Aladdin Risk': 'BlackRock Solutions', 'FactSet Workstation': 'FactSet',
  'Refinitiv Eikon': 'Refinitiv', TradeWeb: 'Tradeweb', MarketAxess: 'MarketAxess', 'Snowflake (Inv Data Lake)': 'Snowflake', 'Kafka Event Bus': 'Confluent', 'Power BI Service': 'Microsoft',
  'Azure Data Factory Pipelines': 'Microsoft', 'Domino Data Lab': 'Domino Data Lab', 'Axioma Risk Analytics': 'Axioma', 'Oracle Securities DB': 'Oracle',
}
// Vendors that plausibly sell into each capability.
const VENDOR_BY_CAP = {
  'Order Management': ['Charles River Development', 'Bloomberg'], Execution: ['Bloomberg', 'Tradeweb', 'MarketAxess'], 'Market Data': ['Bloomberg', 'Refinitiv', 'ICE Data Services', 'S&P Global'],
  'Risk Analytics': ['MSCI', 'Axioma', 'BlackRock Solutions'], 'Portfolio Construction': ['BlackRock Solutions', 'SimCorp'], Optimisation: ['Axioma', 'SimCorp'], 'Cash Management': ['State Street Alpha', 'SimCorp'],
  'Research & Analytics': ['FactSet', 'S&P Global', 'Bloomberg'], ESG: ['MSCI', 'S&P Global'], 'Data Platform': ['Snowflake', 'Oracle'], Integration: ['Confluent', 'Microsoft'], 'Reporting & MI': ['Microsoft', 'State Street Alpha'], 'NON-Inv': ['Microsoft'],
}
const byVendor = new Map()
for (const t of tools.filter((x) => x.vendor === 'Y')) {
  const v = KNOWN_VENDOR[t.name] ?? pick(VENDOR_BY_CAP[t.l3] ?? ['Microsoft'])
  byVendor.set(v, [...(byVendor.get(v) ?? []), t])
}
const contracts = []
let con = 2001
// Renewals spread over the next 15 months; the first two have already passed their notice date.
let order = 0
for (const [vendor, ts] of byVendor) {
  const parent = VENDOR_GROUPS.find((g) => g[0] === vendor)[1]
  for (let i = 0; i < ts.length; i += 12) {
    const chunk = ts.slice(i, i + 12)
    const notice = pick([30, 60, 90, 90, 120, 180])
    const daysAhead = order < 2 ? int(20, 60) : int(25, 450)
    const effNotice = order < 2 ? Math.max(notice, daysAhead + 30) : Math.min(notice, daysAhead - 10)
    order++
    const renewal = new Date('2026-10-12T00:00:00Z')
    renewal.setUTCDate(renewal.getUTCDate() + daysAhead)
    const start = new Date(renewal)
    start.setUTCFullYear(start.getUTCFullYear() - pick([1, 2, 3]))
    contracts.push({
      'Contract ID': `CON-${con++}`,
      Vendor: vendor,
      'Parent company': parent,
      Tools: chunk.map((t) => t.name).join('; '),
      'Annual value (£k)': Math.round(chunk.reduce((a, t) => a + t.cost, 0) * (0.9 + rnd() * 0.2)),
      'Start date': start.toISOString().slice(0, 10),
      'Renewal date': renewal.toISOString().slice(0, 10),
      'Notice (days)': Math.max(30, effNotice),
      'Contract owner': pick(['Investments Change', 'Market data team', 'Group Technology', 'Risk', 'Trading', 'Research']),
    })
  }
}

// ── Risk events: biased towards EUCs, legacy and order management, as real logs are ──
const usageByApp = new Map()
for (const u of usage) usageByApp.set(u.Application, [...(usageByApp.get(u.Application) ?? []), u.Strategy])
const allStrategies = strategies.map((x) => x[1])
const CATEGORIES = [['Systems failure', 'outage delayed'], ['Data quality', 'bad data in'], ['Process', 'manual step missed in'], ['EUC error', 'spreadsheet error in'], ['Model error', 'wrong assumption in']]
const riskPool = tools.filter((t) => t.type && (t.group === 'Desk-built' || /Legacy/.test(t.name) || t.l3 === 'Order Management' || t.l3 === 'Data Platform' || chance(0.15)))
const events = []
for (let i = 0; i < 90; i++) {
  const t = pick(riskPool)
  const [cat, phrase] = t.group === 'Desk-built' ? CATEGORIES[3] : pick(CATEGORIES.filter((c) => c[0] !== 'EUC error'))
  const days = int(3, 360)
  events.push({
    'Event ID': `RE-${2026 - (days > 285 ? 1 : 0)}-${String(100 + i).padStart(3, '0')}`,
    Date: isoDay(days),
    Title: `${phrase[0].toUpperCase()}${phrase.slice(1)} ${t.name}`,
    Tool: t.name,
    Strategy: pick(usageByApp.get(t.name) ?? allStrategies),
    Category: cat,
    'Loss (£k)': Math.round(5 + rnd() * rnd() * 300),
    Status: days < 90 && chance(0.6) ? 'Open' : 'Closed',
  })
}
events.sort((a, b) => a.Date.localeCompare(b.Date))

// ── EUC register: most desk-built tools, a few the master list has not caught ──
const eucTools = tools.filter((t) => t.group === 'Desk-built')
const euc = []
let eucId = 300
for (const t of eucTools) {
  if (chance(0.05)) continue
  const attested = chance(0.85)
  euc.push({ 'EUC ID': `EUC-${eucId++}`, 'EUC Name': t.name, 'Owning Desk': pick(Object.keys(DESKS)), Kind: pick(['Spreadsheet', 'Spreadsheet', 'Access database', 'Python script']), 'Risk Rating': pick(['Low', 'Medium', 'High']), 'Last Attested': attested ? isoDay(int(5, 200)) : '', Status: attested ? 'Attested' : 'Overdue' })
}
for (const n of ['Duration Bucket Tool', 'FX Hedge Calculator', 'Rebalance Checker', 'Index Rebalance Calendar', 'Coupon Schedule Builder', 'Fund Flow Forecaster']) {
  euc.push({ 'EUC ID': `EUC-${eucId++}`, 'EUC Name': n, 'Owning Desk': pick(Object.keys(DESKS)), Kind: 'Spreadsheet', 'Risk Rating': pick(['Medium', 'High']), 'Last Attested': isoDay(int(5, 120)), Status: 'Attested' })
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
fs.writeFileSync(path.join(OUT, 'vendor_contracts_large.csv'), csv(contracts))
fs.writeFileSync(path.join(OUT, 'risk_events_large.csv'), csv(events))
fs.writeFileSync(path.join(OUT, 'euc_register_large.csv'), csv(euc))

console.log(`master ${masterRows.length} tools (${apps.length} applications, ${foundations.length} foundations), usage ${usage.length}, deps ${deps.length}`)
console.log(`leanix ${leanix.length} rows: ${renamed} renamed, ${missing} master tools missing, ${EXTRA.length} only in LeanIX`)
console.log(`jira ${jira.length} issues, contracts ${contracts.length}, risk events ${events.length}, EUC register ${euc.length}`)
