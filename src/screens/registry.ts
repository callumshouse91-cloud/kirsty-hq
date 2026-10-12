import type { ComponentType } from 'react'
import type { ImplementedScreen } from '../lib/screens'
import { CapabilityView } from './CapabilityView'
import { ChangesScreen } from './Changes'
import { DeskView } from './DeskView'
import { Explorer } from './Explorer'
import { FoundationView } from './FoundationView'
import { ImportScreen } from './Import'
import { Overview } from './Overview'
import { HeatmapScreen } from './Heatmap'
import { ModulesScreen } from './Modules'
import { RiskEventsScreen } from './RiskEvents'
import { TaxonomyScreen } from './Taxonomy'
import { VendorsScreen } from './Vendors'

/** One component per built screen. The phase config decides which of them show. */
export const SCREEN_COMPONENTS: Record<ImplementedScreen, ComponentType> = {
  overview: Overview,
  import: ImportScreen,
  taxonomy: TaxonomyScreen,
  explorer: Explorer,
  capability: CapabilityView,
  desk: DeskView,
  foundation: FoundationView,
  changes: ChangesScreen,
  modules: ModulesScreen,
  vendors: VendorsScreen,
  heatmap: HeatmapScreen,
  risk: RiskEventsScreen,
}
