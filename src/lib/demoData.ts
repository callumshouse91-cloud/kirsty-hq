import type { DataState } from '../types'
import { readWorkbook } from './export'
import { preMap } from './mapping'
import { runImport } from './reconcile'
import { fetchSampleFile, parseCsv, seedFromSheets } from './seed'

export type DataMode = 'demo' | 'manual'

export const EMPTY_DATA: DataState = {
  tools: [],
  categories: [],
  taxonomy: [],
  usages: [],
  dependencies: [],
  sourceRecords: [],
  aliases: [],
  issues: [],
  imports: [],
  history: [],
  approvals: [],
  feedRuns: [],
}

/** The sample files, in the order they would be dropped in. */
export const SAMPLE_FILES = {
  master: 'InvestmentsToolMapping_LARGE.xlsx',
  leanix: 'leanix_export_large.csv',
  jira: 'jira_export_large.csv',
  euc: 'euc_register_large.csv',
} as const

async function importCsv(state: DataState, file: string, source: string): Promise<DataState> {
  const { headers, rows } = parseCsv(await (await fetchSampleFile(file)).text())
  return runImport(state, { source, fileName: file, headerMap: preMap(headers, state.categories), rows }).state
}

/**
 * Demo mode: the sample master workbook loaded, with LeanIX, the EUC register and Jira already reconciled.
 * Manual mode starts empty and the files are dropped in by hand.
 */
export async function buildData(mode: DataMode): Promise<DataState> {
  if (mode === 'manual') return { ...EMPTY_DATA }
  const sheets = await readWorkbook(await fetchSampleFile(SAMPLE_FILES.master))
  let state = seedFromSheets(sheets)
  if (!state) throw new Error('The sample master workbook could not be read')
  state = await importCsv(state, SAMPLE_FILES.leanix, 'LeanIX')
  state = await importCsv(state, SAMPLE_FILES.euc, 'EUC register')
  state = await importCsv(state, SAMPLE_FILES.jira, 'Jira')
  return state
}
