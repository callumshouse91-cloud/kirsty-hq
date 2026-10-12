import type { ComponentType } from 'react'
import type { ImplementedScreen } from '../lib/screens'
import { DeskView } from './DeskView'
import { Explorer } from './Explorer'
import { FoundationView } from './FoundationView'
import { ImportScreen } from './Import'
import { Overview } from './Overview'
import { TaxonomyScreen } from './Taxonomy'

/** One component per built screen. The phase config decides which of them show. */
export const SCREEN_COMPONENTS: Record<ImplementedScreen, ComponentType> = {
  overview: Overview,
  import: ImportScreen,
  taxonomy: TaxonomyScreen,
  explorer: Explorer,
  desk: DeskView,
  foundation: FoundationView,
}
