# Build brief: Investments Tech Map (prototype)

You are building a **demo-only, front-end-only** web app. No database, no auth, no backend. It must run with `npm install && npm run dev` and work entirely in the browser. It will be shown live to the Head of Change for an asset manager's Investments business, so it must look finished and every screen must work end to end with the seed data.

## Stack

- Vite + React + TypeScript
- Tailwind for styling; shadcn/ui components are fine
- `papaparse` for CSV, `xlsx` (SheetJS) for XLSX import in the browser
- `recharts` for any charts
- State: a single in-memory store (Zustand or React context). Persist to `localStorage` on change so a page refresh doesn't lose edits. Provide a "Reset to seed data" button in the header.
- Seed data lives in `/public/seed/*.csv` (provided — see below) and is loaded on first run.

## Step 0 — organise this folder before anything else

You are running inside a folder that currently contains only this brief, five CSV files and one XLSX workbook, all at the top level. Before scaffolding:

1. Create `public/seed/` and **move** these five files into it: `full_tech_list.csv`, `taxonomy.csv`, `desk_usage.csv`, `dependencies.csv`, `leanix_export.csv`.
2. Create `demo-assets/` and **move** `InvestmentsToolMapping_SYNTHETIC.xlsx` into it. This file is not used by the app — it's dragged into the Import screen during the live demo. Do not import it at build time.
3. Leave this brief at the top level.
4. Scaffold Vite (`npm create vite@latest . -- --template react-ts`) into this same folder. If the scaffold complains the directory is not empty, scaffold into a temp folder and move the generated files up into this one. The `public/seed/` folder must survive the scaffold — check it is still there afterwards.
5. Add `node_modules/` and `dist/` to `.gitignore` (this folder is OneDrive-synced, so keeping `node_modules` out of version control matters even though sync will still see it).

Confirm the resulting tree with me before continuing to step 1 of the build order.

## Seed data (now in `/public/seed/`)

| File | What it is |
|---|---|
| `full_tech_list.csv` | The master tool list. Columns: `App / Tool / EUC, Vendor, Tech Ownership, Kirsty Cat, Users, Inv User Group, Cap L2, Cap L3, Est Annual Cost (£k), Layer (derived)` |
| `taxonomy.csv` | Editable reference data. Columns: `Category, Term, Parent / Note`. Categories: Kirsty Cat, Cap L2, Cap L3, Users, Desk, Strategy |
| `desk_usage.csv` | Desk → Strategy → Application usage. Columns: `Desk, Strategy, Application, Criticality, Attestation, Attested On` |
| `dependencies.csv` | Application → Foundation links. Columns: `Application, Depends On (Foundation), Direction` |
| `leanix_export.csv` | A sample export from the central system of record, with deliberate mismatches. Columns: `LeanIX ID, Application Name, Fact Sheet Type, Lifecycle, Owning Org, Business Capability, Criticality Tier` |

**Key rule:** `Kirsty Cat` determines the layer. `UI` = **Application** (what users see and use). `Data`, `Data Tfr`, `Engine` = **Foundation** (what applications sit on top of). Never hardcode this — read it from the Taxonomy sheet's `Parent / Note` column for the Kirsty Cat category.

## Data model (in-memory)

```
Tool          { id, name, vendor: 'Y'|'N'|'?', ownership, kirstyCat, users, invUserGroup, capL2, capL3, costK, layer: 'Application'|'Foundation', sources: SourceRef[] }
TaxonomyTerm  { category, term, parent }
Usage         { desk, strategy, toolId, criticality, attestation, attestedOn }
Dependency    { appId, foundationId, direction }
SourceRecord  { source: 'Master List'|'LeanIX'|..., externalId, rawName, raw: Record<string,string>, matchedToolId?, matchType: 'exact'|'fuzzy'|'alias'|'unmatched' }
Alias         { toolId, alias }
Issue         { type: 'MissingInLeanIX'|'MissingInMaster'|'NameMismatch'|'TypeConflict', toolId?, sourceRecordId?, status: 'Open'|'Resolved', resolution? }
```

Everything taxonomy-driven: category values are never hardcoded in components. Renaming a term in the Taxonomy screen must re-label every tool/usage that uses it; merging two terms must re-point everything.

## App shell

Left sidebar navigation, main content area, header with app name, a global search box (searches tool names and aliases), and the Reset button. Six screens, in this order.

### 1. Overview (home)

Summary cards: total tools, applications vs foundations, % of desk usage attested, open reconciliation issues, total estimated annual cost. Below: a bar chart of cost by Cap L2, and a table of the top 10 foundations by number of dependent applications. Every number is clickable and drills into the relevant screen with the filter pre-applied.

### 2. Import & Reconcile

- Drop zone accepting CSV or XLSX. For XLSX, let the user pick the sheet.
- Column mapper: show the file's headers in one column and let the user map each to a Tool field or a Taxonomy category (or "ignore"). Pre-map by header name where it matches the known schemas (Master List and LeanIX).
- Preview the first 20 rows after mapping.
- On "Run reconciliation": match each row to existing tools by exact name → alias table → fuzzy (normalise case, strip brackets and punctuation, token overlap ≥ 0.6). Show a match report: matched exact / matched fuzzy (needs confirmation) / unmatched.
- Fuzzy matches: a side-by-side list with "Confirm match" / "Not a match". Confirming adds an alias so it's exact next time.
- Unmatched rows: "Create as new tool" (with suggested Kirsty Cat and Cap L2/L3 inferred from the source's type field, shown as a suggestion the user accepts or changes) or "Ignore".
- Tools in the master list that have no row in this source get an issue `MissingInLeanIX` (or `MissingIn<Source>`).
- Issues tab: filterable table of all open issues with a resolve action per row. Resolved issues stay visible with a strikethrough toggle.
- Imports are logged (source, date, row count, matched, created, ignored). Re-importing the same source replaces its SourceRecords and re-runs the diff.
- Ship with `leanix_export.csv` ready to demo: dragging it in should produce roughly 6 renames to confirm, 8 missing-in-LeanIX issues, and 5 unmatched LeanIX rows.

### 3. Taxonomy

- Left: category list. Right: terms for the selected category, each showing a count of tools/usages using it.
- Actions: add term, rename term (inline), merge term into another, delete term (blocked if in use, with a link to the affected tools). Add a new category.
- Every destructive action shows an impact preview first: "This will re-label 14 tools and 37 usage rows."
- A "Mapping" sub-view for Kirsty Cat → Layer so she can change which categories count as Application vs Foundation.

### 4. Explorer (pivot)

A pivot-style grid. Controls at the top: **Rows** (pick one or two fields: Desk, Strategy, Kirsty Cat, Cap L2, Cap L3, Users, Vendor, Ownership, Layer), **Columns** (one field or none), **Measure** (count of tools, sum of cost £k, count of desks using). Totals row and column. Click any cell to open a drawer listing the tools behind that cell; click a tool to open its detail panel. Filter chips above the grid (layer, attested only, vendor Y/N). "Export this view" button → XLSX download of the current grid.

### 5. Desk View

- Desk picker at the top (from the Desk taxonomy). Shows **applications only** — foundations are hidden here.
- Layout: strategies as collapsible sections; inside each, a card per application showing name, vendor flag, criticality, attestation status and date.
- Controls per app: "Attest" (sets Attested + today), "Remove", change criticality. "Add application" opens a search over existing applications, plus "It's a spreadsheet / local build" which creates a new tool tagged `(EUC)` with Vendor N, Inv User Group "Desk-built".
- Top-right: a "What this desk sits on" toggle that reveals a read-only panel listing the distinct foundations behind all of this desk's apps, with rolled-up cost. This is the bridge to screen 6.
- "Export attestation" → XLSX for this desk.

### 6. Foundation View

- Foundation picker (foundations only), or arrive here by clicking a foundation anywhere.
- Shows: the foundation's own metadata and cost; a list of every application that depends on it; every desk and strategy that reaches it through those apps (de-duplicated); a simple two-level dependency tree (foundation → apps → desks) rendered as an indented tree or a small node diagram.
- Cost roll-up: this foundation's cost, and an allocated view that splits its cost evenly across dependent apps and then across desks, labelled clearly as "even allocation — illustrative".
- "What breaks if this goes away" callout: count of apps, desks and critical usages affected.
- Editable: add/remove dependency links from an app search.

### Tool detail panel (shared drawer)

Opens from anywhere a tool name appears. Shows all fields (editable), its sources with raw values per source side by side, aliases, dependencies (up and down), desks using it, and open issues. Save writes to the store.

## Behaviour and quality bar

- Every taxonomy value shown in the UI comes from the store; changing it in Taxonomy updates everywhere instantly.
- No dead buttons. If a feature isn't built, don't render the control.
- Empty states on every screen with a one-line hint of what to do.
- Loading seed data must be instant; show nothing that looks like a spinner on first paint.
- All exports are real XLSX files via SheetJS, named `<screen>-<date>.xlsx`.
- Responsive enough to present on a laptop at 1366×768 without horizontal scroll.
- Clean, neutral, professional UI. White backgrounds, subtle borders, a single accent colour, legible density (this will be compared to Excel pivots — it has to be at least as scannable).
- Type everything. No `any`.

## Deliberately out of scope for this prototype

Authentication, multi-user, a backend, AI-suggested labelling, live LeanIX API connection, change history/audit log. Mention none of these in the UI.

## Build order

0. Organise the folder and scaffold (see Step 0 above) — confirm the tree with me
1. Store, seed loading, app shell, Tool detail drawer
2. Desk View
3. Foundation View
4. Explorer
5. Taxonomy
6. Import & Reconcile
7. Overview (last, because it aggregates everything)
8. Exports and polish

After each step, run the dev server and check the screen works with seed data before moving on. Fix TypeScript errors as you go; do not leave them for the end.
