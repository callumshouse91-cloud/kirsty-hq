import { useMemo } from 'react'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { envFor, hasFeature, phase as phaseDef, PHASE_IDS, type Env, type FeatureId, type PhaseId } from './lib/phases'
import { permissionsFor, role as roleDef, ROLES, type Permission, type RoleId } from './lib/roles'

export type ModuleId = 'vendors' | 'heatmap' | 'risk'

interface DemoState {
  phase: PhaseId
  env: Env
  role: RoleId
  modules: Record<ModuleId, boolean>
  setPhase: (p: PhaseId) => void
  setEnv: (e: Env) => void
  setRole: (r: RoleId) => void
  setModule: (m: ModuleId, on: boolean) => void
}

const DEMO_KEY = 'investments-tech-map:demo'

function readUrl(): { phase?: PhaseId; env?: Env; role?: RoleId } {
  const q = new URLSearchParams(window.location.search)
  const p = Number(q.get('phase'))
  const e = q.get('env')
  const r = q.get('role')
  return {
    phase: (PHASE_IDS as number[]).includes(p) ? (p as PhaseId) : undefined,
    env: e === 'prod' || e === 'production' ? 'prod' : e === 'sandbox' || e === 'local' ? 'sandbox' : undefined,
    role: ROLES.some((x) => x.id === r) ? (r as RoleId) : undefined,
  }
}

/** Mirror phase, env and role into the query string so a demo state can be linked to. The hash (screen) is kept. */
export function writeUrl(s: Pick<DemoState, 'phase' | 'env' | 'role'>) {
  const q = new URLSearchParams(window.location.search)
  q.set('phase', String(s.phase))
  q.set('env', s.env)
  if (s.env === 'prod') q.set('role', s.role)
  else q.delete('role')
  const url = `${window.location.pathname}?${q.toString()}${window.location.hash}`
  if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) history.replaceState(null, '', url)
}

export const useDemo = create<DemoState>()(
  persist(
    (set) => ({
      phase: 1,
      env: 'sandbox',
      role: 'change-lead',
      modules: { vendors: true, heatmap: true, risk: true },
      setPhase: (p) => set((s) => ({ phase: p, env: envFor(p, s.env) })),
      setEnv: (e) => set((s) => ({ env: envFor(s.phase, e) })),
      setRole: (r) => set({ role: r }),
      setModule: (m, on) => set((s) => ({ modules: { ...s.modules, [m]: on } })),
    }),
    {
      name: DEMO_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ phase: s.phase, env: s.env, role: s.role, modules: s.modules }),
      // The URL wins over what was saved, so a shared link always opens the state it names.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<DemoState>
        const url = readUrl()
        const phase = url.phase ?? saved.phase ?? current.phase
        return {
          ...current,
          ...saved,
          phase,
          env: envFor(phase, url.env ?? saved.env ?? current.env),
          role: url.role ?? saved.role ?? current.role,
          modules: { ...current.modules, ...(saved.modules ?? {}) },
        }
      },
    },
  ),
)

useDemo.subscribe((s) => writeUrl(s))
writeUrl(useDemo.getState())

export function usePhase() {
  const phase = useDemo((s) => s.phase)
  return phaseDef(phase)
}

export function useFeature(f: FeatureId): boolean {
  const phase = useDemo((s) => s.phase)
  return hasFeature(phase, f)
}

export function usePermissions(): { can: (p: Permission) => boolean; role: ReturnType<typeof roleDef>; env: Env; readOnly: boolean; canAttestDesk: (desk: string) => boolean } {
  const phase = useDemo((s) => s.phase)
  const env = useDemo((s) => s.env)
  const roleId = useDemo((s) => s.role)
  return useMemo(() => {
    const perms = permissionsFor(phase, env, roleId)
    const r = roleDef(roleId)
    const scoped = env === 'prod' && phase >= 3 && !!r.desk
    return {
      can: (p: Permission) => perms.has(p),
      role: r,
      env,
      readOnly: perms.size === 0,
      canAttestDesk: (desk: string) => perms.has('attest') && (!scoped || r.desk === desk),
    }
  }, [phase, env, roleId])
}
