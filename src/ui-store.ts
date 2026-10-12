import type { Answer } from './lib/ask'
import { create } from 'zustand'

export interface CellDrill {
  title: string
  subtitle: string
  toolIds: string[]
}

export interface AskTurn {
  id: string
  q: string
  at: string
  answer: Answer
}

interface UiState {
  askOpen: boolean
  turns: AskTurn[]
  setAskOpen: (v: boolean) => void
  addTurn: (t: AskTurn) => void
  clearTurns: () => void
  toolId: string | null
  cell: CellDrill | null
  toast: string | null
  openTool: (id: string) => void
  closeTool: () => void
  openCell: (c: CellDrill) => void
  closeCell: () => void
  notify: (msg: string) => void
}

let toastTimer: ReturnType<typeof setTimeout> | undefined

export const useUi = create<UiState>()((set) => ({
  askOpen: false,
  turns: [],
  setAskOpen: (v) => set({ askOpen: v }),
  addTurn: (t) => set((s) => ({ turns: [...s.turns, t].slice(-20) })),
  clearTurns: () => set({ turns: [] }),
  toolId: null,
  cell: null,
  toast: null,
  openTool: (id) => set({ toolId: id }),
  closeTool: () => set({ toolId: null }),
  openCell: (c) => set({ cell: c }),
  closeCell: () => set({ cell: null }),
  notify: (msg) => {
    clearTimeout(toastTimer)
    set({ toast: msg })
    toastTimer = setTimeout(() => set({ toast: null }), 3200)
  },
}))
