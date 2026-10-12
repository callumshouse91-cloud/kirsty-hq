import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { useDemo } from './demo-store'
import { buildData } from './lib/demoData'
import { useModuleData } from './module-data'
import { hasPersistedState, useStore } from './store'

async function boot() {
  // Edits persist in localStorage; the sample data is only built on first run, on Reset or when the data mode changes.
  const modules = useModuleData.getState().load()
  if (!hasPersistedState()) {
    useStore.getState().hydrateFrom(await buildData(useDemo.getState().dataMode))
  }
  await modules
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void boot()
