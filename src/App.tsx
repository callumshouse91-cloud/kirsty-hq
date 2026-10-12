import { CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { LayerBadge, VendorFlag } from './components/common'
import { Shell } from './components/Shell'
import { ToolDrawer } from './components/ToolDrawer'
import { Drawer, Td, Th } from './components/ui'
import { layerOf } from './lib/taxonomy'
import { fmtK } from './lib/util'
import { useDemo } from './demo-store'
import { phase as phaseDef, screenFrom } from './lib/phases'
import { isImplemented, SCREEN_META } from './lib/screens'
import { useAvailableScreens } from './nav'
import { navigate, useRoute } from './router'
import { SCREEN_COMPONENTS } from './screens/registry'
import { useLayerMap, useStore } from './store'
import { useUi } from './ui-store'

function CellDrawer() {
  const cell = useUi((s) => s.cell)
  const close = useUi((s) => s.closeCell)
  const openTool = useUi((s) => s.openTool)
  const tools = useStore((s) => s.tools)
  const usages = useStore((s) => s.usages)
  const lm = useLayerMap()
  if (!cell) return null
  const ids = new Set(cell.toolIds)
  const list = tools.filter((t) => ids.has(t.id)).sort((a, b) => b.costK - a.costK)
  const total = list.reduce((s, t) => s + t.costK, 0)
  return (
    <Drawer open onClose={close} title={cell.title} subtitle={`${cell.subtitle} · ${list.length} tool${list.length === 1 ? '' : 's'} · ${fmtK(total)}`} width="w-[520px]" z="z-30">
      <table className="w-full text-[13px]">
        <thead>
          <tr>
            <Th>Tool</Th>
            <Th>Layer</Th>
            <Th right>Desks</Th>
            <Th right>Cost</Th>
          </tr>
        </thead>
        <tbody>
          {list.map((t) => (
            <tr key={t.id} className="cursor-pointer hover:bg-accent-50" onClick={() => openTool(t.id)}>
              <Td>
                <div className="font-medium text-slate-800">{t.name}</div>
                <div className="mt-0.5">
                  <VendorFlag v={t.vendor} />
                </div>
              </Td>
              <Td>
                <LayerBadge layer={layerOf(t, lm)} />
              </Td>
              <Td right>{new Set(usages.filter((u) => u.toolId === t.id).map((u) => u.desk)).size}</Td>
              <Td right>{fmtK(t.costK)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </Drawer>
  )
}

function Toast() {
  const toast = useUi((s) => s.toast)
  if (!toast) return null
  return (
    <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-md bg-slate-900 px-4 py-2.5 text-[13px] text-white shadow-lg">
      <CheckCircle2 size={15} className="text-emerald-400" />
      {toast}
    </div>
  )
}

export default function App() {
  const { screen } = useRoute()
  const phase = useDemo((s) => s.phase)
  const available = useAvailableScreens()
  const enabled = screen !== null && available.includes(screen)
  useEffect(() => {
    useUi.getState().closeTool()
    useUi.getState().closeCell()
  }, [screen])
  // A screen outside the current phase is never rendered: go to the phase's first screen instead.
  useEffect(() => {
    if (enabled) return
    // A bare link opens on the Journey, the start of the story. Otherwise go to the phase's first screen.
    const first = screen === null && available.includes('journey') ? 'journey' : phaseDef(phase).firstScreen
    const target = available.includes(first) ? first : available[0]
    if (screen && SCREEN_META[screen]) useUi.getState().notify(`${SCREEN_META[screen].label} arrives in Phase ${screenFrom(screen)}`)
    if (target) navigate(target, {}, { replace: true })
  }, [enabled, screen, phase, available])
  const Screen = enabled && screen && isImplemented(screen) ? SCREEN_COMPONENTS[screen] : undefined
  return (
    <>
      <Shell>{Screen && <Screen />}</Shell>
      <CellDrawer />
      <ToolDrawer />
      <Toast />
    </>
  )
}
