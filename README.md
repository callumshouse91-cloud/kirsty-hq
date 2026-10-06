# Investments Tech Map (prototype)

Front-end-only demo: maps the Investments tool estate (applications vs. the foundations they sit on), who uses what, and how it reconciles with LeanIX. No backend; everything runs in the browser and edits persist in `localStorage`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. **Reset to seed data** (top right) restores the CSVs in `public/seed/`.

## Demo script (about 10 minutes)

1. **Overview**: headline numbers. Click any of them to drill into the detail.
2. **Desk View** → *Active Fixed Income*: strategies, criticality, attestation. Attest a card, add an application, or add *"It's a spreadsheet / local build"*. Toggle **What this desk sits on**.
3. **Foundation View**: pick *Snowflake (Inv Data Lake)* or *Bulk Optimiser* (indirect via Pricing Engine). Show "What breaks if this goes away" and the illustrative cost allocation.
4. **Explorer**: Rows = Cap L2 › Cap L3, Columns = Desk, Measure = cost. Click a cell, then a tool. **Export this view**.
5. **Taxonomy**: rename a term (shows the impact preview), merge two terms, change the layer mapping.
6. **Import & Reconcile**: drag `demo-assets/InvestmentsToolMapping_SYNTHETIC.xlsx` in (the LeanIX_Export sheet is preselected), or click *Use the sample LeanIX export*. Run reconciliation → **6 renames to confirm, 5 only in LeanIX, 8 missing from LeanIX**. Confirm a rename (it's saved as an alias), create or ignore the extras, then work through the **Issues** tab.

## Layout

| Path | What |
|---|---|
| `public/seed/` | Seed CSVs loaded on first run |
| `demo-assets/` | Workbook for the live import demo (not bundled) |
| `src/store.ts` | Zustand store + all actions, persisted to localStorage |
| `src/lib/` | Pure logic: seed parsing, taxonomy bindings, matching, reconciliation, dependency graph, pivot, XLSX I/O |
| `src/screens/` | The six screens |
| `src/components/` | Shell, tool detail drawer, shared UI |

Layer is never hard-coded: it comes from the Kirsty Cat terms' *Parent / Note* in the taxonomy (`UI` → Application; `Data`, `Data Tfr`, `Engine` → Foundation) and can be changed in Taxonomy → Layer mapping.
