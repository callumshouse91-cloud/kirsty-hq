export type Vendor = 'Y' | 'N' | '?'
export type Layer = 'Application' | 'Foundation'

export const LAYERS: Layer[] = ['Application', 'Foundation']
export const VENDORS: Vendor[] = ['Y', 'N', '?']

export const ATTESTED = 'Attested'
export const NOT_ATTESTED = 'Not yet attested'
export type Attestation = typeof ATTESTED | typeof NOT_ATTESTED

/** The source name used for the master tool list. */
export const MASTER_SOURCE = 'Master List'

export interface Tool {
  id: string
  name: string
  vendor: Vendor
  ownership: string
  toolType: string
  /** One or more Users terms joined with " & " (e.g. "Inv & Ops"). */
  users: string
  invUserGroup: string
  capL2: string
  capL3: string
  costK: number
  /** Values for user-added taxonomy categories, keyed by category name. */
  custom: Record<string, string>
}

export interface TaxonomyTerm {
  id: string
  category: string
  term: string
  parent: string
}

export interface Usage {
  id: string
  desk: string
  strategy: string
  toolId: string
  criticality: string
  attestation: Attestation
  attestedOn: string
}

export interface Dependency {
  id: string
  /** The consuming tool (usually an Application). */
  appId: string
  /** The tool it sits on (usually a Foundation). */
  foundationId: string
  direction: string
}

export type MatchType = 'exact' | 'alias' | 'fuzzy' | 'unmatched'
export type Resolution = 'pending' | 'accepted' | 'rejected' | 'created' | 'ignored'

export interface MatchCandidate {
  toolId: string
  score: number
}

export interface SourceRecord {
  id: string
  importId: string
  source: string
  externalId: string
  rawName: string
  raw: Record<string, string>
  /** header -> mapping target key, as chosen in the column mapper */
  headerMap: Record<string, string>
  matchedToolId?: string
  matchType: MatchType
  resolution: Resolution
  candidates: MatchCandidate[]
}

export interface Alias {
  id: string
  toolId: string
  alias: string
  source: string
}

export type IssueType = string // 'MissingIn<Source>' | 'MissingInMaster' | 'NameMismatch' | 'TypeConflict'

export interface Issue {
  id: string
  type: IssueType
  source: string
  toolId?: string
  sourceRecordId?: string
  detail: string
  status: 'Open' | 'Resolved'
  resolution?: string
  createdOn: string
}

export interface ImportLog {
  id: string
  source: string
  fileName: string
  date: string
  rowCount: number
  matched: number
  fuzzy: number
  created: number
  ignored: number
  unmatched: number
}

export interface DataState {
  tools: Tool[]
  categories: string[]
  taxonomy: TaxonomyTerm[]
  usages: Usage[]
  dependencies: Dependency[]
  sourceRecords: SourceRecord[]
  aliases: Alias[]
  issues: Issue[]
  imports: ImportLog[]
}
