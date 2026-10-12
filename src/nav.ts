import { useMemo } from 'react'
import { useDemo } from './demo-store'
import { phase as phaseDef, type ScreenId } from './lib/phases'
import { isImplemented, SCREEN_META } from './lib/screens'

/** Screens shown in the current phase: in the phase config, built, and (for modules) switched on. */
export function useAvailableScreens(): ScreenId[] {
  const phase = useDemo((s) => s.phase)
  const modules = useDemo((s) => s.modules)
  return useMemo(
    () =>
      phaseDef(phase).screens.filter((id) => {
        if (!isImplemented(id)) return false
        const m = SCREEN_META[id].module
        return !m || modules[m]
      }),
    [phase, modules],
  )
}

export function useScreenEnabled(id: ScreenId): boolean {
  return useAvailableScreens().includes(id)
}
