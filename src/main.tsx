import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { loadSeed } from './lib/seed'
import { useModuleData } from './module-data'
import { hasPersistedState, useStore } from './store'

async function boot() {
  // Edits persist in localStorage; the seed CSVs are only read on first run (or after Reset).
  const modules = useModuleData.getState().load()
  if (!hasPersistedState()) {
    useStore.getState().hydrateFrom(await loadSeed())
  }
  await modules
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
