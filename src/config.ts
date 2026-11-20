import type { ImmutableObject } from 'jimu-core'

export type SearchMode = 'point' | 'area'
export type BufferUnit = 'meters' | 'kilometers' | 'feet' | 'miles'
/** 'inside' keeps only features that lie completely inside the area. */
export type AreaRelationship = 'intersects' | 'inside'
export type MultipleAreas = 'first' | 'merge'
/** Where to search: a clicked point, a polygon the user draws, or the polygon of a feature under the click. */
export type WhereMode = 'point' | 'draw' | 'feature'
export type DrawTool = 'polygon' | 'rectangle' | 'freehand'
export const WHERE_MODES: WhereMode[] = ['point', 'draw', 'feature']
export const DRAW_TOOLS: DrawTool[] = ['polygon', 'rectangle', 'freehand']

/** A polygon layer users can pick for "Feature", with the fields shown for its feature. */
export interface AreaLayer {
  dataSourceId: string
  rootDataSourceId?: string
  /** Fields for the area details, report and copy, in order. Empty uses the popup fields. */
  fields?: string[]
}

/** 'all' searches every visible layer with its popup fields; 'chosen' only the profile's layers and fields. */
export type LayerScope = 'all' | 'chosen'

export interface ProfileLayer {
  /** A feature layer data source of the selected map (map image sublayers included). */
  dataSourceId: string
  rootDataSourceId?: string
  /** Field names to show, in order; the first is the list row's title. Empty uses the popup fields. */
  fields?: string[]
}

/** @deprecated 1.6 only: a profile's own area. Read once to carry its layer into `areaLayers`. */
export interface ProfileArea {
  /** A polygon feature layer data source of the selected map. */
  dataSourceId?: string
  rootDataSourceId?: string
  /** Area layer fields for the area details, report and copy, in order. Empty uses the popup fields. */
  fields?: string[]
  bufferDistance?: number
  bufferUnit?: BufferUnit
  relationship?: AreaRelationship
  multipleAreas?: MultipleAreas
  /** Leave the area layer out of the results. On unless set to false. */
  excludeAreaLayer?: boolean
}

/** A named set of layers and fields, such as "Planning check". The first profile is the default. */
export interface Profile {
  id: string
  label: string
  /** @deprecated 1.6 only. Where to search is now chosen in the widget; see `whereModes`. */
  searchBy?: SearchMode
  /** @deprecated 1.6 only; carried into `areaLayers`. */
  area?: ProfileArea
  layerScope?: LayerScope
  layers?: ProfileLayer[]
  /** Search the profile's layers even when they are turned off or out of scale range. */
  includeHiddenLayers?: boolean
}

export interface Config {
  /** Search radius around the clicked point, in screen pixels. */
  tolerance?: number
  /** Upper limit on features returned for each layer. */
  maxFeaturesPerLayer?: number
  /** List layers that were searched but had nothing at the point. */
  showEmptyLayers?: boolean
  /** Stay in pick mode after a click instead of returning to idle. */
  keepPickingActive?: boolean
  /** Start with each layer's results collapsed (a single layer with results stays open). On unless set to false. */
  collapseGroups?: boolean
  /** Be ready to search (default or last-used Where) as soon as the widget opens. Off unless set. */
  readyOnOpen?: boolean

  // Where to search (1.7). Apps saved before have none of these; resolveWhere() derives them from the old settings.
  /** The ways users can choose where to search. Default: all three ("feature" needs an area layer). */
  whereModes?: WhereMode[]
  defaultWhere?: WhereMode
  /** Drawing tools offered for "draw". Default: polygon and rectangle. */
  drawTools?: DrawTool[]
  /** Polygon layers users can pick for "feature". */
  areaLayers?: AreaLayer[]
  defaultAreaLayerId?: string
  /** Default buffers in metres. Feature and drawn polygons grow (positive) or shrink (negative); a point's is a radius. */
  bufferFeature?: number
  bufferDraw?: number
  bufferPoint?: number
  /** Show the Buffer tick box so users can type their own distance. On unless set to false. */
  allowCustomBuffer?: boolean

  relationship?: AreaRelationship
  /** What to do when several area polygons are under the point. */
  multipleAreas?: MultipleAreas
  /** Leave the area layer out of the results. On unless set to false. */
  excludeAreaLayer?: boolean

  // Before 1.7. Read only by resolveWhere() to carry old apps over; the area layer was props.useDataSources[0].
  /** @deprecated */
  searchMode?: SearchMode
  /** @deprecated use bufferFeature */
  bufferDistance?: number
  /** @deprecated */
  bufferUnit?: BufferUnit
  /** @deprecated use areaLayers[].fields */
  areaFields?: string[]
  /** @deprecated */
  allowModeSwitch?: boolean

  /** No profiles keeps the original behaviour: every visible layer, popup fields. */
  profiles?: Profile[]
  /** Show a profile picker when there is more than one profile. On unless set to false. */
  allowProfileSwitch?: boolean
  /** Let users choose their own layers and fields ("My setup", saved on their device). On unless set to false. */
  allowCustomise?: boolean
  /** Layers users can choose from: any feature layer in the map (default), or only layers in the profiles. */
  customisePool?: 'map' | 'profiles'
  /** Layers hidden from Customise, as data source ids. Set by the designer; users cannot change it. */
  customiseExclude?: string[]
  /** Show the report button. On unless set to false. */
  showReport?: boolean
  /** The small heading at the top of the report, e.g. a company or app name. Empty uses "What's Here report". */
  reportHeading?: string
}

export type IMConfig = ImmutableObject<Config>

export const DEFAULT_TOLERANCE = 6
export const DEFAULT_MAX_FEATURES = 100
export const DEFAULT_BUFFER = -20
export const DEFAULT_BUFFER_UNIT: BufferUnit = 'meters'
export const BUFFER_UNITS: BufferUnit[] = ['meters', 'kilometers', 'feet', 'miles']

/**
 * Written to this widget's mutable state by Map Context Menu ("What's here?" action), or as the
 * generic `mapContext` payload by its "Open widget" action. Plain JSON only.
 */
export interface WhatsHereRequest {
  requestId?: string
  source?: string
  latitude: number
  longitude: number
  mapX?: number
  mapY?: number
  wkid?: number
}
