import type { Env, PhaseId } from './phases'

export type RoleId = 'change-lead' | 'tech-lead' | 'desk-attester' | 'viewer'
export type Permission = 'editTaxonomy' | 'editTools' | 'import' | 'attest' | 'approve'

export interface Role {
  id: RoleId
  name: string
  summary: string
  /** Fine-grained permissions, applied from Phase 3 (role-based editing). */
  perms: Permission[]
  /** Desk an attester may attest for. */
  desk?: string
}

export const ROLES: Role[] = [
  { id: 'change-lead', name: 'Change lead', summary: 'Owns the taxonomy and data model. Approves merges and deletes.', perms: ['editTaxonomy', 'editTools', 'import', 'attest', 'approve'] },
  { id: 'tech-lead', name: 'Tech lead', summary: 'Maintains tools, links and imports. Proposes taxonomy changes.', perms: ['editTaxonomy', 'editTools', 'import'] },
  { id: 'desk-attester', name: 'Desk attester', summary: 'Attests the critical toolkit for one desk.', perms: ['attest'], desk: 'Active Fixed Income' },
  { id: 'viewer', name: 'Viewer', summary: 'Reads every view and exports. Cannot edit.', perms: [] },
]

export const ALL_PERMS: Permission[] = ['editTaxonomy', 'editTools', 'import', 'attest', 'approve']

export function role(id: RoleId): Role {
  return ROLES.find((r) => r.id === id) ?? ROLES[0]
}

/**
 * What the current user may do.
 * - Sandbox: one person on one laptop, so everything.
 * - Production, Phases 1–2: signed in; a Viewer is read-only, everyone else can edit.
 * - Production, Phase 3 on: role-based editing, approvals and desk-scoped attestation.
 */
export function permissionsFor(phase: PhaseId, env: Env, roleId: RoleId): Set<Permission> {
  if (env === 'sandbox') return new Set(ALL_PERMS)
  const r = role(roleId)
  if (phase < 3) return new Set(r.id === 'viewer' ? [] : ALL_PERMS.filter((p) => p !== 'approve'))
  return new Set(r.perms)
}

export const PERM_LABEL: Record<Permission, string> = {
  editTaxonomy: 'edit the taxonomy',
  editTools: 'edit tools and links',
  import: 'import and reconcile',
  attest: 'attest usage',
  approve: 'approve changes',
}
