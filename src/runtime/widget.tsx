import {
  React, ReactRedux, hooks, classNames, appActions, getAppStore, MutableStoreManager, WidgetState, DataSourceManager,
  type AllWidgetProps, type DataRecordSet, type IMState
} from 'jimu-core'
import { JimuMapViewComponent, type JimuMapView } from 'jimu-arcgis'
import { Button, Checkbox, DataActionList, DataActionListStyle, Label, Loading, LoadingType, NumericInput, Option, Select } from 'jimu-ui'
import { useTheme } from 'jimu-theme'
import { SelectPointOutlined } from 'jimu-icons/outlined/gis/select-point'
import { SelectPolygonOutlined } from 'jimu-icons/outlined/gis/select-polygon'
import { SelectRectangleOutlined } from 'jimu-icons/outlined/gis/select-rectangle'
import { SelectLassoOutlined } from 'jimu-icons/outlined/gis/select-lasso'
import { DataPolygonOutlined } from 'jimu-icons/outlined/gis/data-polygon'
import { PinOutlined } from 'jimu-icons/outlined/application/pin'
import { CopyOutlined } from 'jimu-icons/outlined/editor/copy'
import { TableOutlined } from 'jimu-icons/outlined/data/table'
import { DocumentOutlined } from 'jimu-icons/outlined/data/document'
import { CloseOutlined } from 'jimu-icons/outlined/editor/close'
import { CheckOutlined } from 'jimu-icons/outlined/application/check'
import { ZoomInOutlined } from 'jimu-icons/outlined/editor/zoom-in'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'
import { InfoOutlined } from 'jimu-icons/outlined/suggested/info'
import { SettingOutlined } from 'jimu-icons/outlined/application/setting'
import GraphicsLayer from 'esri/layers/GraphicsLayer'
import Graphic from 'esri/Graphic'
import Color from 'esri/Color'
import SketchViewModel from 'esri/widgets/Sketch/SketchViewModel'
import {
  DEFAULT_MAX_FEATURES, DEFAULT_TOLERANCE,
  type DrawTool, type IMConfig, type Profile, type ProfileLayer, type WhatsHereRequest, type WhereMode
} from '../config'
import { buildSearchGeometry, collectTargets, pointToLatLon, queryTarget, requestToViewPoint } from './query'
import { type AreaFailure, buildSearchArea, prepareArea } from './area'
import { resolveAreaLayer, resolveProfileTargets } from './profiles'
import { buildLayerDataSet } from './actions'
import CustomisePanel from './customise-panel'
import { buildReportHtml, escapeHtml } from './report'
import { captureMap } from './report-map'
import {
  type FeatureResult, type LayerResult, clampNumber, countTotal, pickProfile, resolveWhere, formatBuffer, formatLatLon, layerCountText, layerTable, summaryText
} from './utils'
import { widgetStyle } from './style'
import defaultMessages from './translations/default'

type Status = 'idle' | 'finding-area' | 'searching' | 'done'
type Source = 'map' | 'context-menu'

interface SearchLocation {
  /** The clicked point, or the centre of a drawn polygon. */
  point: __esri.Point
  latitude: number
  longitude: number
  source: Source
  where: WhereMode
  /** The buffer applied, in metres (a point's is a radius; 0 means the click tolerance). */
  buffer: number
  /** The polygon the user drew, before any buffer, so the search can be repeated. */
  drawn?: __esri.Polygon
  /** The area layer a feature search used, so the search can be repeated. */
  areaLayerId?: string
  /** The polygon that was searched (a feature's, a drawn one, or a point's radius), or why there is none. */
  area?: { polygon: __esri.Polygon, name: string, layerTitle: string, features: FeatureResult[], layer: any }
  areaFailure?: AreaFailure
}

// Map Context Menu writes one of these to this widget's mutable state before opening it.
const REQUEST_KEYS = ['whatsHereRequest', 'mapContext'] as const
const COORD_DECIMALS = 6
const MIN_POINT_ZOOM = 16
// Above this many features an area search opens with every layer collapsed.
const COLLAPSE_ABOVE = 50

const WHERE_ICONS = { point: SelectPointOutlined, draw: SelectPolygonOutlined, feature: DataPolygonOutlined }
const TOOL_ICONS = { polygon: SelectPolygonOutlined, rectangle: SelectRectangleOutlined, freehand: SelectLassoOutlined }
const WHERE_LABEL_KEYS = { point: 'whWherePoint', draw: 'whWhereDraw', feature: 'whWhereFeature' }
const GO_LABEL_KEYS = { point: 'whGoPoint', draw: 'whGoDraw', feature: 'whGoFeature' }
const TOOL_LABEL_KEYS = { polygon: 'whToolPolygon', rectangle: 'whToolRectangle', freehand: 'whToolFreehand' }
// The prompt beside the Where buttons for drawing, by tool.
const DRAW_PROMPT_KEYS = { polygon: 'whGoDraw', rectangle: 'whPromptRectangle', freehand: 'whPromptFreehand' }
const AREA_FAILURE_KEYS: Record<AreaFailure, string> = {
  'no-layer': 'whAreaNoLayer',
  'not-found': 'whAreaNotFound',
  'buffer-empty': 'whAreaBufferEmpty',
  error: 'whAreaError'
}

// The last profile each user picked, per widget, on this device. Storage may be unavailable (private mode).
const profileStorageKey = (widgetId: string) => `whats-here:${widgetId}:profile`
const readStoredProfile = (widgetId: string): string | null => {
  try {
    return window.localStorage.getItem(profileStorageKey(widgetId))
  } catch {
    return null
  }
}
const storeProfile = (widgetId: string, profileId: string) => {
  try {
    window.localStorage.setItem(profileStorageKey(widgetId), profileId)
  } catch {
    // Not remembered; the default profile is used next time.
  }
}

// Each user's last where / layer / buffer choices, per widget, on this device.
interface StoredChoices {
  where?: WhereMode
  areaLayerId?: string
  drawTool?: DrawTool
  bufferOn?: boolean
  /** The user's own buffer per way: a radius for points, grow/shrink for polygons. */
  bufferValues?: { [mode in WhereMode]?: number }
}
const choicesStorageKey = (widgetId: string) => `whats-here:${widgetId}:choices`
const readStoredChoices = (widgetId: string): StoredChoices => {
  try {
    return JSON.parse(window.localStorage.getItem(choicesStorageKey(widgetId)) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
const storeChoices = (widgetId: string, choices: StoredChoices) => {
  try {
    window.localStorage.setItem(choicesStorageKey(widgetId), JSON.stringify(choices))
  } catch {
    // Not remembered; the app's defaults are used next time.
  }
}

// A user's My setup: the layers and fields they chose, and the profile they started from.
interface StoredSetup {
  baseId: string
  baseLabel: string
  layers: ProfileLayer[]
  savedAt: number
}
const MY_SETUP_ID = '__my-setup'
const ALL_VISIBLE_ID = '__all-visible'
const setupStorageKey = (widgetId: string) => `whats-here:${widgetId}:my-setup`
const readMySetup = (widgetId: string): StoredSetup | null => {
  try {
    const setup = JSON.parse(window.localStorage.getItem(setupStorageKey(widgetId)) ?? 'null')
    return Array.isArray(setup?.layers) ? setup : null
  } catch {
    return null
  }
}
const writeMySetup = (widgetId: string, setup: StoredSetup | null) => {
  try {
    if (setup) window.localStorage.setItem(setupStorageKey(widgetId), JSON.stringify(setup))
    else window.localStorage.removeItem(setupStorageKey(widgetId))
  } catch {
    // Kept for this visit only.
  }
}

const featureKey = (layer: LayerResult, feature: FeatureResult) => `${layer.key}::${feature.id}`
// The area polygon(s) are listed like a layer so they share selection, hover and details with result rows.
const AREA_KEY = '__whats-here-area'

const highlightSymbol = (geometry: __esri.Geometry, r: number, g: number, b: number): any => {
  if (geometry.type === 'polygon' || geometry.type === 'extent') {
    return { type: 'simple-fill', color: [r, g, b, 0.18], outline: { color: [r, g, b, 1], width: 2 } }
  }
  if (geometry.type === 'polyline') return { type: 'simple-line', color: [r, g, b, 1], width: 3 }
  if (geometry.type === 'point' || geometry.type === 'multipoint') {
    return { type: 'simple-marker', style: 'circle', size: 16, color: [r, g, b, 0.15], outline: { color: [r, g, b, 1], width: 2.5 } }
  }
  return null
}

const Widget = (props: AllWidgetProps<IMConfig>) => {
  const translate = hooks.useTranslation(defaultMessages)
  const theme = useTheme()
  const config = props.config
  const tolerance = clampNumber(config?.tolerance, 1, 50, DEFAULT_TOLERANCE)
  const maxFeatures = clampNumber(config?.maxFeaturesPerLayer, 1, 2000, DEFAULT_MAX_FEATURES)
  const showEmptyLayers = !!config?.showEmptyLayers
  const keepPickingActive = !!config?.keepPickingActive
  const collapseGroups = config?.collapseGroups !== false

  // A plain copy: array methods on immutable config return immutable results.
  const profiles = React.useMemo(() => Array.from((config?.profiles as unknown as Profile[]) ?? []), [config?.profiles])

  // ---------- My setup: a user's own layers and fields, on their device ----------
  const allowCustomise = config?.allowCustomise !== false
  const customisePool = config?.customisePool === 'profiles' ? 'profiles' : 'map'
  const [mySetup, setMySetup] = React.useState<StoredSetup | null>(() => readMySetup(props.id))
  // Without profiles the widget searches every visible layer; that is the starting point to customise from.
  const allVisibleLabel = translate('whAllVisibleLayers')
  const allVisible = React.useMemo<Profile>(() => ({ id: ALL_VISIBLE_ID, label: allVisibleLabel, layerScope: 'all' }), [allVisibleLabel])
  const baseProfiles = profiles.length ? profiles : [allVisible]
  const mySetupLabel = mySetup ? translate('whMySetup', { profile: mySetup.baseLabel }) : ''
  const mySetupProfile = React.useMemo<Profile | null>(() => allowCustomise && mySetup
    ? { id: MY_SETUP_ID, label: mySetupLabel, layerScope: 'chosen', layers: mySetup.layers, includeHiddenLayers: true }
    : null, [allowCustomise, mySetup, mySetupLabel])
  const choiceProfiles = mySetupProfile ? [mySetupProfile, ...baseProfiles] : baseProfiles

  const [profileId, setProfileId] = React.useState<string | null>(() => readStoredProfile(props.id))
  // The designer's default (first) profile unless the user picked another; My setup only when chosen.
  const activeProfile = choiceProfiles.find(p => p.id === profileId) ?? pickProfile(baseProfiles, null)
  const allowProfileSwitch = choiceProfiles.length > 1 && config?.allowProfileSwitch !== false
  const selectProfile = (id: string) => {
    setProfileId(id)
    storeProfile(props.id, id)
  }

  // ---------- where, buffer ----------
  const legacyAreaDataSourceId = props.useDataSources?.[0]?.dataSourceId
  const where = React.useMemo(() => resolveWhere(config as any, legacyAreaDataSourceId), [config, legacyAreaDataSourceId])
  const relationship = config?.relationship === 'inside' ? 'inside' : 'intersects'
  const multipleAreas = config?.multipleAreas === 'merge' ? 'merge' : 'first'
  const excludeAreaLayer = config?.excludeAreaLayer !== false

  const [choices, setChoices] = React.useState<StoredChoices>(() => readStoredChoices(props.id))
  const updateChoices = (patch: StoredChoices) => {
    setChoices(current => {
      const next = { ...current, ...patch }
      storeChoices(props.id, next)
      return next
    })
  }
  // Stored choices only count while the app still offers them.
  const whereMode: WhereMode = where.modes.includes(choices.where) ? choices.where : where.defaultMode
  const areaLayer = where.areaLayers.find(l => l.dataSourceId === choices.areaLayerId) ??
    where.areaLayers.find(l => l.dataSourceId === where.defaultAreaLayerId)
  const drawTool: DrawTool = where.drawTools.includes(choices.drawTool) ? choices.drawTool : where.drawTools[0]
  const bufferOn = where.allowCustomBuffer && !!choices.bufferOn
  /** The user's own buffer for a way, else the app's default for it. */
  const customBuffer = (mode: WhereMode) => {
    const value = choices.bufferValues?.[mode]
    return value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value) : where.buffers[mode]
  }
  const bufferValue = customBuffer(whereMode)
  /** Choosing where (or a layer or drawing tool) gets the map ready straight away: no second click. */
  const startPicking = (patch: StoredChoices) => {
    updateChoices(patch)
    setPicking(true)
  }
  /** The buffer for a search, in metres: the user's own when ticked, else the app's default. A point's is never negative. */
  const bufferFor = (mode: WhereMode) => {
    const value = bufferOn ? customBuffer(mode) : where.buffers[mode]
    return mode === 'point' ? Math.max(0, value) : value
  }

  const mapWidgetId = props.useMapWidgetIds?.[0]
  const [jimuMapView, setJimuMapView] = React.useState<JimuMapView>(null)
  const view = jimuMapView?.view
  const [picking, setPicking] = React.useState(false)
  const [status, setStatus] = React.useState<Status>('idle')
  const [location, setLocation] = React.useState<SearchLocation | null>(null)
  const [results, setResults] = React.useState<LayerResult[]>([])
  const [searchedCount, setSearchedCount] = React.useState(0)
  const [collapsed, setCollapsed] = React.useState<{ [key: string]: boolean }>({})
  const [selectedKey, setSelectedKey] = React.useState<string | null>(null)
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null)
  const [areaExpanded, setAreaExpanded] = React.useState(false)
  const [message, setMessage] = React.useState<{ text: string, ok: boolean } | null>(null)
  // The options under the bar start open, so first-time users see them, and close once a search starts.
  const [optionsOpen, setOptionsOpen] = React.useState(true)

  const runRef = React.useRef(0)
  const graphicsLayerRef = React.useRef<GraphicsLayer>(null)
  const hoverLayerRef = React.useRef<GraphicsLayer>(null)
  const hadMapControlRef = React.useRef(false)
  const messageTimerRef = React.useRef<number>(null)
  const keepPickingRef = React.useRef(keepPickingActive)
  keepPickingRef.current = keepPickingActive

  const autoControlWidgetId = ReactRedux.useSelector((state: IMState) =>
    mapWidgetId ? state.mapWidgetsInfo?.[mapWidgetId]?.autoControlWidgetId : undefined)

  const highlightColor = React.useMemo(() => {
    try {
      return new Color(theme?.sys?.color?.primary?.main || '#076fe5')
    } catch {
      return new Color('#076fe5')
    }
  }, [theme])

  const flash = React.useCallback((text: string, ok = true) => {
    window.clearTimeout(messageTimerRef.current)
    setMessage({ text, ok })
    messageTimerRef.current = window.setTimeout(() => { setMessage(null) }, 2600)
  }, [])
  React.useEffect(() => () => { window.clearTimeout(messageTimerRef.current) }, [])

  // ---------- search ----------
  /**
   * Searches every target layer. A drawn polygon is searched as drawn (plus its buffer). Otherwise the point is
   * used: with "feature" chosen, the polygon of the area layer's feature there; else the point itself, or a
   * circle around it when there is a point buffer. A right-click while "draw" is chosen searches the point.
   */
  const search = React.useCallback(async (
    point: __esri.Point,
    source: Source,
    drawn?: __esri.Polygon,
    repeat?: Pick<SearchLocation, 'where' | 'buffer' | 'areaLayerId'>
  ) => {
    if (!view?.map || !point) return
    const run = ++runRef.current
    const searchLayer = (repeat?.areaLayerId && where.areaLayers.find(l => l.dataSourceId === repeat.areaLayerId)) || areaLayer
    const kind: WhereMode = repeat?.where === 'feature' && !searchLayer
      ? 'point'
      : repeat?.where ?? (drawn ? 'draw' : (whereMode === 'feature' && areaLayer ? 'feature' : 'point'))
    const buffer = repeat ? repeat.buffer : bufferFor(kind)
    const { latitude, longitude } = pointToLatLon(point)
    const base: SearchLocation = {
      point, latitude, longitude, source, where: kind, buffer, drawn, areaLayerId: kind === 'feature' ? searchLayer.dataSourceId : undefined
    }

    setLocation(base)
    setOptionsOpen(false)
    setAreaExpanded(false)
    setResults([])
    setSelectedKey(null)
    setHoveredKey(null)
    setCollapsed({})
    setSearchedCount(0)

    const fail = (reason: AreaFailure) => {
      setLocation({ ...base, areaFailure: reason })
      setStatus('done')
    }

    try {
      let geometry = buildSearchGeometry(view, point, tolerance)
      let searchedLayer: any = null
      // A profile with chosen layers names its own targets; found alongside the area so the waits overlap.
      const profileTargets = resolveProfileTargets(jimuMapView, activeProfile)

      if (kind === 'feature') {
        setStatus('finding-area')
        searchedLayer = await resolveAreaLayer(jimuMapView, searchLayer.dataSourceId)
        const area = await buildSearchArea(searchedLayer, point, view.spatialReference, {
          multiple: multipleAreas, bufferDistance: buffer, bufferUnit: 'meters', fields: searchLayer.fields
        })
        if (run !== runRef.current) return
        if (typeof area === 'string') {
          fail(area)
          return
        }
        setLocation({ ...base, area: { polygon: area.polygon, name: area.name, layerTitle: searchedLayer?.title ?? '', features: area.features, layer: searchedLayer } })
        geometry = { ...geometry, area: area.polygon, relationship }
      } else if (kind === 'draw' || buffer > 0) {
        // A drawn polygon, or a point with a radius: no area layer, just the shape to search with.
        const polygon = await prepareArea(drawn ?? point, buffer)
        if (run !== runRef.current) return
        if (!polygon) {
          fail('buffer-empty')
          return
        }
        const name = kind === 'draw' ? translate('whDrawnArea') : formatLatLon(latitude, longitude, COORD_DECIMALS)
        setLocation({ ...base, area: { polygon, name, layerTitle: '', features: [], layer: null } })
        // "Completely inside" makes sense for a drawn shape; a radius around a point finds what it touches.
        geometry = { ...geometry, area: polygon, relationship: kind === 'draw' ? relationship : 'intersects' }
      }
      setStatus('searching')

      const chosen = await profileTargets
      if (run !== runRef.current) return
      // The area layer is matched by object, so a map image sublayer is left out as well as a feature layer.
      const targets = (chosen ?? collectTargets(view.map, view.scale))
        .filter(target => !(excludeAreaLayer && searchedLayer && target.layer === searchedLayer))
      setSearchedCount(targets.length)
      const queried = await Promise.all(targets.map(target => queryTarget(target, geometry, view.spatialReference, maxFeatures)))
      // Layers that cannot be queried at all (e.g. a scene layer without features) are left out, not shown as errors.
      const layerResults = queried.filter(result => !result.skipped)

      // A newer search (or a cleared one) supersedes this run.
      if (run !== runRef.current) return
      setSearchedCount(layerResults.length)
      setResults(layerResults)
      // Groups start collapsed (by default) so the layer names fit on screen; a single layer with results stays open.
      const layersWithResults = layerResults.filter(layer => layer.features.length > 0).length
      const collapse = collapseGroups ? layersWithResults > 1 : !!geometry.area && countTotal(layerResults) > COLLAPSE_ABOVE
      if (collapse) setCollapsed(Object.fromEntries(layerResults.map(layer => [layer.key, true])))
      setStatus('done')
    } catch (err) {
      // Anything unexpected (a layer that will not load, a buffer the geometry engine rejects) ends the search
      // with a message instead of leaving it spinning.
      console.warn("What's Here: the search failed.", err)
      if (run === runRef.current) fail('error')
    }
    // bufferFor reads the same state as its listed inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, jimuMapView, whereMode, areaLayer, bufferOn, choices.bufferValues, where, tolerance, maxFeatures, multipleAreas, relationship,
    excludeAreaLayer, activeProfile, translate, collapseGroups])

  // Switching profile repeats the current search with the new layers and fields.
  const locationRef = React.useRef(location)
  locationRef.current = location
  // My setup counts as a new profile each time it is saved, so editing it repeats the search too.
  const activeProfileId = `${activeProfile?.id}:${activeProfile?.id === MY_SETUP_ID ? mySetup?.savedAt : ''}`
  const previousProfileIdRef = React.useRef(activeProfileId)
  React.useEffect(() => {
    if (previousProfileIdRef.current === activeProfileId) return
    previousProfileIdRef.current = activeProfileId
    const current = locationRef.current
    // Repeat what was searched (the same way, area layer and buffer), not what is chosen now.
    if (current) void search(current.point, current.source, current.drawn, current)
  }, [activeProfileId, search])

  const searchRef = React.useRef(search)
  searchRef.current = search

  const clearResults = () => {
    runRef.current++
    setLocation(null)
    setResults([])
    setSelectedKey(null)
    setHoveredKey(null)
    setSearchedCount(0)
    setStatus('idle')
  }

  const onActiveViewChange = (jmv: JimuMapView) => {
    // Results and graphics belong to the old view.
    runRef.current++
    setPicking(false)
    setLocation(null)
    setResults([])
    setSelectedKey(null)
    setHoveredKey(null)
    setStatus('idle')
    setJimuMapView(jmv)
  }

  // ---------- map graphics ----------
  React.useEffect(() => {
    if (!view) return
    return () => {
      [graphicsLayerRef, hoverLayerRef].forEach(ref => {
        if (ref.current) {
          view.map?.remove(ref.current)
          ref.current.destroy()
        }
        ref.current = null
      })
    }
  }, [view])

  const areaResult = React.useMemo<LayerResult | null>(() =>
    location?.area ? { key: AREA_KEY, title: location.area.layerTitle, features: location.area.features, layer: location.area.layer } : null,
  [location])

  const findFeature = React.useCallback((key: string | null): FeatureResult | null => {
    if (!key) return null
    for (const layer of areaResult ? [areaResult, ...results] : results) {
      const feature = layer.features.find(f => featureKey(layer, f) === key)
      if (feature) return feature
    }
    return null
  }, [areaResult, results])

  const selectedFeature = React.useMemo(() => findFeature(selectedKey), [findFeature, selectedKey])
  const hoveredFeature = React.useMemo(() => findFeature(hoveredKey), [findFeature, hoveredKey])

  // Hover highlight lives in its own layer so moving along the list does not redraw the area and markers.
  React.useEffect(() => {
    if (!view?.map) return
    let layer = hoverLayerRef.current
    const geometry = hoveredFeature !== selectedFeature ? hoveredFeature?.graphic?.geometry : null
    if (!geometry) {
      layer?.removeAll()
      return
    }
    if (!layer) {
      layer = new GraphicsLayer({ id: `whats-here-hover-${props.id}`, title: "What's Here hover", listMode: 'hide' })
      hoverLayerRef.current = layer
    }
    if (!view.map.layers.includes(layer)) view.map.add(layer)
    layer.removeAll()
    const { r, g, b } = highlightColor
    const symbol = highlightSymbol(geometry, r, g, b)
    if (symbol) layer.add(new Graphic({ geometry, symbol }))
  }, [view, hoveredFeature, selectedFeature, highlightColor, props.id])

  React.useEffect(() => {
    if (!view?.map) return
    if (!location) {
      graphicsLayerRef.current?.removeAll()
      return
    }

    let layer = graphicsLayerRef.current
    if (!layer) {
      // listMode 'hide' keeps this layer out of the layer list and out of our own searches.
      layer = new GraphicsLayer({ id: `whats-here-${props.id}`, title: "What's Here", listMode: 'hide' })
      graphicsLayerRef.current = layer
    }
    if (!view.map.layers.includes(layer)) view.map.add(layer)
    layer.removeAll()

    const { r, g, b } = highlightColor
    if (location.area?.polygon) {
      layer.add(new Graphic({
        geometry: location.area.polygon,
        symbol: { type: 'simple-fill', color: [r, g, b, 0.06], outline: { color: [r, g, b, 1], width: 2, style: 'dash' } } as any
      }))
    }
    const geometry = selectedFeature?.graphic?.geometry
    const symbol = geometry && highlightSymbol(geometry, r, g, b)
    if (symbol) layer.add(new Graphic({ geometry, symbol }))

    // A drawn area has no clicked point to mark.
    if (location.where !== 'draw') {
      layer.add(new Graphic({
        geometry: location.point,
        symbol: { type: 'simple-marker', style: 'circle', size: 14, color: [255, 255, 255, 0.85], outline: { color: [r, g, b, 1], width: 2.5 } } as any
      }))
      layer.add(new Graphic({
        geometry: location.point,
        symbol: { type: 'simple-marker', style: 'circle', size: 5, color: [r, g, b, 1], outline: { color: [255, 255, 255, 0], width: 0 } } as any
      }))
    }
  }, [view, location, selectedFeature, highlightColor, props.id])

  // ---------- pick mode ----------

  // Point and feature: wait for a map click.
  React.useEffect(() => {
    if (!picking || !view || whereMode === 'draw') return
    const container = view.container as HTMLElement
    const previousCursor = container?.style.cursor
    if (container) container.style.cursor = 'crosshair'

    const handle = view.on('click', (event: __esri.ViewClickEvent) => {
      // Stop the map's own popup from opening for this click.
      event.stopPropagation()
      if (!event.mapPoint) return
      void searchRef.current(event.mapPoint, 'map')
      if (!keepPickingRef.current) setPicking(false)
    })
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPicking(false) }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      handle.remove()
      document.removeEventListener('keydown', onKeyDown)
      if (container) container.style.cursor = previousCursor
    }
  }, [picking, view, whereMode])

  // Draw: a sketch session on a temporary layer. The finished shape is searched, then the sketch is cleared.
  React.useEffect(() => {
    if (!picking || !view?.map || whereMode !== 'draw') return
    const { r, g, b } = highlightColor
    const sketchLayer = new GraphicsLayer({ id: `whats-here-sketch-${props.id}`, title: "What's Here sketch", listMode: 'hide' })
    view.map.add(sketchLayer)
    const sketch = new SketchViewModel({
      view: view as __esri.MapView,
      layer: sketchLayer,
      polygonSymbol: { type: 'simple-fill', color: [r, g, b, 0.08], outline: { color: [r, g, b, 1], width: 2 } } as any
    })
    let closing = false
    const start = () => {
      if (drawTool === 'freehand') sketch.create('polygon', { mode: 'freehand' })
      else sketch.create(drawTool)
    }
    const handle = sketch.on('create', (event: __esri.SketchViewModelCreateEvent) => {
      if (event.state === 'complete') {
        const polygon = event.graphic?.geometry as __esri.Polygon
        sketchLayer.removeAll()
        if (polygon?.type === 'polygon') {
          void searchRef.current(polygon.centroid ?? polygon.extent?.center, 'map', polygon)
        }
        if (keepPickingRef.current) start()
        else setPicking(false)
      } else if (event.state === 'cancel' && !closing) {
        setPicking(false)
      }
    })
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setPicking(false) }
    document.addEventListener('keydown', onKeyDown)
    start()

    return () => {
      closing = true
      handle.remove()
      document.removeEventListener('keydown', onKeyDown)
      sketch.cancel()
      sketch.destroy()
      view.map?.remove(sketchLayer)
      sketchLayer.destroy()
    }
  }, [picking, view, whereMode, drawTool, highlightColor, props.id])

  // Take map interaction ownership while picking, and give it back afterwards if we still have it.
  React.useEffect(() => {
    if (!picking || !mapWidgetId) return
    getAppStore().dispatch(appActions.requestAutoControlMapWidget(mapWidgetId, props.id))
    return () => {
      const owner = getAppStore().getState().mapWidgetsInfo?.[mapWidgetId]?.autoControlWidgetId
      if (owner === props.id) getAppStore().dispatch(appActions.releaseAutoControlMapWidget(mapWidgetId))
    }
  }, [picking, mapWidgetId, props.id])

  // Another widget took over the map: leave pick mode quietly.
  React.useEffect(() => {
    if (!picking) {
      hadMapControlRef.current = false
      return
    }
    if (autoControlWidgetId === props.id) hadMapControlRef.current = true
    else if (hadMapControlRef.current) setPicking(false)
  }, [picking, autoControlWidgetId, props.id])

  // Optionally be ready to search as soon as the widget opens (and the map is ready), so users just click the map.
  // Widgets placed on the page have no state and count as open.
  const readyOnOpen = !!config?.readyOnOpen
  const wasReadyRef = React.useRef(false)
  React.useEffect(() => {
    const open = props.state !== WidgetState.Closed && !!view
    if (readyOnOpen && open && !wasReadyRef.current) setPicking(true)
    wasReadyRef.current = open
  }, [readyOnOpen, view, props.state])

  // Stop picking when the widget is closed in a Widget Controller, or the map is hidden (cached).
  React.useEffect(() => {
    if (props.state === WidgetState.Closed) setPicking(false)
  }, [props.state])

  React.useEffect(() => {
    if (!jimuMapView?.addCacheListener) return
    const listener = () => { setPicking(false) }
    const handle = jimuMapView.addCacheListener(listener)
    return () => { handle?.remove?.() }
  }, [jimuMapView])

  // ---------- Map Context Menu hand-off ----------
  const mutableState = (props as any).mutableStateProps
  const pendingKey = REQUEST_KEYS.find(key => mutableState?.[key])
  const pendingRequest = pendingKey ? (mutableState[pendingKey] as WhatsHereRequest) : null

  React.useEffect(() => {
    if (!pendingRequest || !view) return
    // Clear the request first so a re-render or remount does not run the same search again.
    const store = MutableStoreManager.getInstance()
    REQUEST_KEYS.forEach(key => { if (mutableState?.[key]) store.updateStateValue(props.id, key, null) })

    const point = requestToViewPoint(pendingRequest, view)
    if (!point) {
      flash(translate('whInvalidRequest'), false)
      return
    }
    setPicking(false)
    void searchRef.current(point, 'context-menu')
    // mutableState is read inside but only pendingRequest identity matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingRequest, view])

  // ---------- layer actions ----------
  // Data actions (View in table, Export, Zoom to, ...) are switched on in the builder's Action tab.
  const enableDataAction = (props as any).enableDataAction !== false
  const [dataSets, setDataSets] = React.useState<{ [layerKey: string]: DataRecordSet }>({})
  React.useEffect(() => {
    setDataSets({})
    // The area polygon(s) get actions too, as their own data set.
    const sources = areaResult ? [areaResult, ...results] : results
    if (!enableDataAction || !jimuMapView || !sources.length) return
    let cancelled = false
    void Promise.all(sources.map(async result => [result.key, await buildLayerDataSet(jimuMapView, result)] as const))
      .then(entries => {
        if (!cancelled) setDataSets(Object.fromEntries(entries.filter(([, dataSet]) => dataSet)))
      })
    return () => { cancelled = true }
  }, [results, areaResult, jimuMapView, enableDataAction])

  /** Copies a layer as a table: HTML for email and documents, tab-separated text for spreadsheets. */
  const copyLayerTable = async (layer: LayerResult) => {
    const { text, html } = layerTable(layer)
    try {
      if (typeof ClipboardItem === 'function' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })])
      } else {
        await navigator.clipboard.writeText(text)
      }
      flash(translate('whTableCopied', { layer: layer.title }))
    } catch {
      flash(translate('whCopyFailed'), false)
    }
  }

  // ---------- result actions ----------
  const zoomTo = (feature: FeatureResult) => {
    const geometry = feature.graphic?.geometry
    if (!view || !geometry) return
    if (geometry.type === 'point') {
      void view.goTo({ target: geometry, zoom: Math.max(view.zoom ?? 0, MIN_POINT_ZOOM) })
    } else {
      void view.goTo(geometry.extent ? geometry.extent.clone().expand(1.4) : geometry)
    }
  }

  const toggleLayer = (key: string) => { setCollapsed(current => ({ ...current, [key]: !current[key] })) }
  const toggleFeature = (key: string) => { setSelectedKey(current => current === key ? null : key) }

  /** "−20 m, overlaps area": the buffer and rule a search used. A point radius has no rule. */
  const ruleText = (loc: SearchLocation) => [
    formatBuffer(loc.buffer, translate('whUnitM')),
    loc.where !== 'point' ? translate(relationship === 'inside' ? 'whRuleInside' : 'whRuleIntersects') : ''
  ].filter(Boolean).join(', ')

  const radiusText = (loc: SearchLocation) => `${loc.buffer.toLocaleString()} ${translate('whUnitM')}`

  /** One line on how a search was made, for the report. */
  const locationSubtitle = (loc: SearchLocation) => {
    if (loc.where === 'feature' && loc.area) return `${translate('whReportAreaFrom', { layer: loc.area.layerTitle })} · ${ruleText(loc)}`
    if (loc.where === 'draw') return [translate('whDrawnMeta'), ruleText(loc)].filter(Boolean).join(' · ')
    if (loc.area) return translate('whWithinRadius', { radius: radiusText(loc) })
    return translate(loc.source === 'context-menu' ? 'whFromContextMenu' : 'whFromMap')
  }

  /** The area layer's name, from the map once it has loaded. */
  const areaLayerLabel = (dataSourceId: string) =>
    jimuMapView?.getJimuLayerViewByDataSourceId(dataSourceId)?.layer?.title ??
    DataSourceManager.getInstance().getDataSource(dataSourceId)?.getLabel() ??
    translate('whWhereFeature')

  // ---------- customise ----------
  const [customiseOpen, setCustomiseOpen] = React.useState(false)
  // Editing My setup keeps the profile it was based on; otherwise the current profile is the base.
  const setupBase = activeProfile?.id === MY_SETUP_ID && mySetup
    ? { id: mySetup.baseId, label: mySetup.baseLabel }
    : { id: activeProfile?.id, label: activeProfile?.label }

  const openCustomise = () => {
    setPicking(false)
    setCustomiseOpen(true)
  }

  const saveMySetup = (layers: ProfileLayer[]) => {
    const setup: StoredSetup = { baseId: setupBase.id, baseLabel: setupBase.label, layers, savedAt: Date.now() }
    writeMySetup(props.id, setup)
    setMySetup(setup)
    selectProfile(MY_SETUP_ID)
    setCustomiseOpen(false)
  }

  const resetMySetup = () => {
    writeMySetup(props.id, null)
    setMySetup(null)
    selectProfile(baseProfiles.some(p => p.id === setupBase.id) ? setupBase.id : baseProfiles[0].id)
    setCustomiseOpen(false)
    flash(translate('whMySetupCleared'))
  }

  // ---------- report ----------
  const showReport = config?.showReport !== false
  const reportHeading = config?.reportHeading?.trim() || translate('whReportTitle')

  /** Opens a printable report in a new tab: header, map, the area's attributes, then a table per layer. */
  const openReport = async () => {
    if (!location || !view) return
    // Open the tab now, while the click still counts as a user action, so pop-up blockers allow it.
    const win = window.open('', '_blank')
    if (!win) {
      flash(translate('whReportBlocked'), false)
      return
    }
    win.document.write(`<!doctype html><meta charset="utf-8"><title>${escapeHtml(reportHeading)}</title>` +
      `<p style="font:14px system-ui,sans-serif;padding:24px">${escapeHtml(translate('whReportPreparing'))}</p>`)

    const state = getAppStore().getState()
    const user: any = state.user
    const coord = formatLatLon(location.latitude, location.longitude, COORD_DECIMALS)
    const area = location.area
    const mapImage = await captureMap(view, area?.polygon ?? location.point)
    if (win.closed) return

    const html = buildReportHtml({
      title: area?.name ?? coord,
      subtitle: locationSubtitle(location),
      meta: [
        activeProfile?.label ? translate('whReportProfile', { profile: activeProfile.label }) : '',
        new Date().toLocaleString(),
        user?.fullName || user?.username || ''
      ],
      mapImage,
      mapCaption: translate(location.where === 'draw' ? 'whReportCaptionDrawn' : area ? 'whReportCaptionArea' : 'whReportCaptionPoint', { coord }),
      areas: (area?.features ?? []).map(feature => ({ name: feature.description, attributes: feature.attributes })),
      layers: results,
      accent: theme?.sys?.color?.primary?.main || '#5b129f',
      footer: [state.appInfo?.name, translate('whReportFooter', { layers: results.map(layer => layer.title).join(', ') })]
        .filter(Boolean).join(' · '),
      lang: document.documentElement.lang,
      strings: {
        reportTitle: reportHeading,
        print: translate('whReportPrint'),
        mapAlt: translate('whReportMapAlt'),
        featuresFound: translate('whReportFeaturesFound'),
        layersWithResults: translate('whReportLayersWithResults'),
        layersSearched: translate('whReportLayersSearched'),
        layersWithErrors: translate('whReportLayersWithErrors'),
        noFeaturesIn: translate('whReportNoFeaturesIn'),
        errorsIn: translate('whReportErrorsIn'),
        limitNote: (shown, total) => translate('whReportLimit', { shown, total })
      }
    })
    win.document.open()
    win.document.write(html)
    win.document.close()
  }

  const copySummary = async () => {
    if (!location) return
    const coord = formatLatLon(location.latitude, location.longitude, COORD_DECIMALS)
    const heading = location.area
      ? translate('whSummaryHeadingArea', { area: location.area.name, rule: ruleText(location), coord })
      : translate('whSummaryHeading', { coord })
    try {
      await navigator.clipboard.writeText(summaryText(results, heading))
      flash(translate('whCopied'))
    } catch {
      flash(translate('whCopyFailed'), false)
    }
  }

  // ---------- render ----------
  const hasMap = !!mapWidgetId
  const GoIcon = WHERE_ICONS[whereMode]

  // The bar: a prompt beside the buttons, and a line with the profile in use (which opens the options).
  const hasOptions = where.allowCustomBuffer || allowProfileSwitch || allowCustomise
  const barDetail = activeProfile?.label ?? ''
  // The same short, quiet prompt whether or not the map is waiting; the coloured button shows that it is.
  const prompt = translate(whereMode === 'draw' ? DRAW_PROMPT_KEYS[drawTool] : GO_LABEL_KEYS[whereMode])

  // The result card: what was searched, and how.
  const cardTitle = location?.area?.name ?? (location ? formatLatLon(location.latitude, location.longitude, COORD_DECIMALS) : '')
  const cardMeta = !location
    ? ''
    : location.where === 'feature' && location.area
      ? `${location.area.layerTitle} · ${ruleText(location)}`
      : location.where === 'draw'
        ? [translate('whDrawnMeta'), ruleText(location)].filter(Boolean).join(' · ')
        : location.area
          ? translate('whRadiusChip', { radius: radiusText(location) })
          : translate(location.source === 'context-menu' ? 'whFromContextMenu' : 'whFromMap')

  const zoomToLocation = () => {
    if (!view || !location) return
    if (location.area) void view.goTo(location.area.polygon.extent?.clone().expand(1.2) ?? location.area.polygon)
    else void view.goTo({ target: location.point, zoom: Math.max(view.zoom ?? 0, MIN_POINT_ZOOM) })
  }
  const isBusy = status === 'searching' || status === 'finding-area'
  const featureTotal = countTotal(results)
  const layersWithFeatures = results.filter(layer => layer.features.length > 0).length
  const visibleResults = results.filter(layer => layer.features.length > 0 || layer.error || showEmptyLayers)
  const anyGroupOpen = visibleResults.some(layer => !collapsed[layer.key])
  const toggleAllGroups = () => {
    setCollapsed(anyGroupOpen ? Object.fromEntries(visibleResults.map(layer => [layer.key, true])) : {})
  }

  const summary = (() => {
    if (status === 'finding-area') return translate('whFindingArea')
    if (status === 'searching') return translate('whSearching', { count: searchedCount })
    if (status !== 'done') return ''
    if (location?.areaFailure) return translate(AREA_FAILURE_KEYS[location.areaFailure])
    if (searchedCount === 0) return translate('whNoVisibleLayers')
    if (featureTotal === 0) return translate('whNothingFound')
    if (featureTotal === 1) return translate('whFoundSummaryOne')
    if (layersWithFeatures === 1) return translate('whFoundSummaryOneLayer', { features: featureTotal.toLocaleString() })
    return translate('whFoundSummary', { features: featureTotal.toLocaleString(), layers: layersWithFeatures })
  })()

  const renderAttributes = (feature: FeatureResult, id: string) => feature.attributes.length
    ? (
      <dl className='wh-attributes' id={id}>
        {feature.attributes.map((attr, i) => (
          <React.Fragment key={`${attr.label}-${i}`}>
            <dt>{attr.label}</dt>
            <dd>{attr.value}</dd>
          </React.Fragment>
        ))}
      </dl>
      )
    : <div className='wh-attributes-empty' id={id}>{translate('whNoAttributes')}</div>

  const renderFeature = (layer: LayerResult, feature: FeatureResult) => {
    const key = featureKey(layer, feature)
    const selected = key === selectedKey
    const detailsId = `wh-details-${props.id}-${key.replace(/[^\w-]/g, '_')}`
    const hoverOn = () => { setHoveredKey(key) }
    const hoverOff = () => { setHoveredKey(current => current === key ? null : current) }
    return (
      <li key={key} className={classNames('wh-feature', { 'is-selected': selected })} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
        <div className='wh-feature-row'>
          <button
            type='button'
            className='wh-feature-button'
            onFocus={hoverOn}
            onBlur={hoverOff}
            aria-expanded={selected}
            aria-controls={detailsId}
            aria-label={translate(selected ? 'whHideDetails' : 'whShowDetails', { feature: feature.description })}
            onClick={() => { toggleFeature(key) }}
          >
            <span className='wh-chevron'>{selected ? <DownOutlined size={10} /> : <RightOutlined size={10} />}</span>
            <span className='wh-feature-name' title={feature.description}>{feature.description}</span>
          </button>
          <Button size='sm' type='tertiary' icon disabled={!view || !feature.graphic?.geometry}
            title={translate('whZoomTo', { feature: feature.description })}
            aria-label={translate('whZoomTo', { feature: feature.description })}
            onClick={() => { setSelectedKey(key); zoomTo(feature) }}>
            <ZoomInOutlined size={14} />
          </Button>
        </div>
        {selected && renderAttributes(feature, detailsId)}
      </li>
    )
  }

  /** Copy as table plus the data-action dropdown, for a result layer or the area card. */
  const renderActions = (layer: LayerResult, name: string) => (
    <>
      <Button size='sm' type='tertiary' icon
        title={translate('whCopyTable', { layer: name })} aria-label={translate('whCopyTable', { layer: name })}
        onClick={() => { void copyLayerTable(layer) }}>
        <TableOutlined size={14} />
      </Button>
      {dataSets[layer.key] && (
        <DataActionList
          widgetId={props.id}
          dataSets={[dataSets[layer.key]]}
          listStyle={DataActionListStyle.Dropdown}
          buttonType='tertiary'
          buttonSize='sm'
          hideGroupTitle
          shouldHideEmptyList
          disableDataSourceLevelActions
        />
      )}
    </>
  )

  const renderLayer = (layer: LayerResult) => {
    const isCollapsed = !!collapsed[layer.key]
    const empty = layer.features.length === 0
    const countText = layerCountText(layer)
    return (
      <li key={layer.key} className='wh-layer'>
        <div className='wh-layer-row'>
          <button
            type='button'
            className='wh-layer-header'
            aria-expanded={!isCollapsed}
            aria-label={translate(isCollapsed ? 'whExpandLayer' : 'whCollapseLayer', { layer: layer.title })}
            onClick={() => { toggleLayer(layer.key) }}
          >
            <span className='wh-chevron'>{isCollapsed ? <RightOutlined size={12} /> : <DownOutlined size={12} />}</span>
            <span className='wh-layer-titles'>
              <span className='wh-layer-title' title={layer.title}>{layer.title}</span>
              {layer.parentTitle && <span className='wh-layer-parent' title={layer.parentTitle}>{layer.parentTitle}</span>}
            </span>
          </button>
          {!empty && <span className='wh-layer-actions'>{renderActions(layer, layer.title)}</span>}
          <span className={classNames('wh-count', { 'is-empty': empty })} aria-hidden='true'>{layer.error ? '!' : countText}</span>
        </div>
        {!isCollapsed && (
          <>
            {layer.error && (
              <div className='wh-layer-note is-error'>
                {translate('whLayerError')}
                {layer.errorMessage && <span className='wh-error-detail'>{layer.errorMessage}</span>}
              </div>
            )}
            {!layer.error && empty && <div className='wh-layer-note'>{translate('whNoFeatures')}</div>}
            {layer.exceeded && (
              <div className='wh-layer-note'>
                {layer.total > layer.features.length
                  ? translate('whLimitReachedOf', { count: layer.features.length, total: layer.total.toLocaleString() })
                  : translate('whLimitReached', { count: layer.features.length })}
              </div>
            )}
            {!empty && <ul className='wh-features'>{layer.features.map(feature => renderFeature(layer, feature))}</ul>}
          </>
        )}
      </li>
    )
  }

  return (
    <div css={widgetStyle} className='jimu-widget widget-whats-here'>
      {hasMap && <JimuMapViewComponent useMapWidgetId={mapWidgetId} onActiveViewChange={onActiveViewChange} />}

      {customiseOpen && jimuMapView
        ? (
          <CustomisePanel
            jimuMapView={jimuMapView}
            start={activeProfile}
            startLabel={activeProfile?.id === MY_SETUP_ID ? mySetup?.baseLabel : activeProfile?.label}
            pool={customisePool}
            profiles={profiles}
            translate={translate}
            onCancel={() => { setCustomiseOpen(false) }}
            onReset={resetMySetup}
            onDone={saveMySetup}
          />
          )
        : (
          <>
      <div className='wh-bar'>
        {/* Line 1: the ways to search, with what to do next beside them. */}
        <div className='wh-bar-row'>
          {where.modes.length > 1
            ? (
              <div className='wh-where is-compact' role='group' aria-label={translate('whWhere')}>
                {where.modes.map(mode => {
                  const Icon = WHERE_ICONS[mode]
                  const waiting = picking && whereMode === mode
                  const label = waiting ? translate('whStopSelecting') : `${translate(WHERE_LABEL_KEYS[mode])}: ${translate(GO_LABEL_KEYS[mode])}`
                  return (
                    <button key={mode} type='button'
                      className={classNames('wh-where-button', { 'is-active': whereMode === mode, 'is-picking': waiting })}
                      aria-pressed={whereMode === mode}
                      aria-label={label}
                      title={label}
                      disabled={!view || (mode === 'feature' && !where.areaLayers.length)}
                      onClick={() => {
                        // A second click on the button that is waiting cancels.
                        if (waiting) setPicking(false)
                        else startPicking({ where: mode })
                      }}>
                      <Icon size={16} />
                    </button>
                  )
                })}
              </div>
              )
            : (
              <Button
                className='wh-select-button'
                type={picking ? 'primary' : 'default'}
                disabled={!view || (whereMode === 'feature' && !areaLayer)}
                aria-pressed={picking}
                onClick={() => { setPicking(p => !p) }}
              >
                {picking ? <CloseOutlined size={14} /> : <GoIcon size={16} />}
                {translate(picking ? 'whStopSelecting' : GO_LABEL_KEYS[whereMode])}
              </Button>
              )}
          {where.modes.length > 1 && (
            <span className='wh-prompt'>{prompt}</span>
          )}
          {picking && where.modes.length > 1 && (
            <button type='button' className='wh-link wh-prompt-cancel' onClick={() => { setPicking(false) }}>
              {translate('whStopSelecting')}
            </button>
          )}
        </div>

        {/* Line 2: the feature layer, or the drawing tool, at full width. */}
        {whereMode === 'feature' && where.areaLayers.length > 1 && (
          <Select size='sm' className='wh-layer-select' value={areaLayer?.dataSourceId ?? ''} aria-label={translate('whAreaLayerPick')}
            onChange={e => { startPicking({ areaLayerId: e.target.value }) }}>
            {where.areaLayers.map(layer => <Option key={layer.dataSourceId} value={layer.dataSourceId}>{areaLayerLabel(layer.dataSourceId)}</Option>)}
          </Select>
        )}
        {whereMode === 'draw' && where.drawTools.length > 1 && (
          <div className='wh-tools' role='group' aria-label={translate('whDrawTool')}>
            {where.drawTools.map(tool => {
              const Icon = TOOL_ICONS[tool]
              return (
                <button key={tool} type='button' className={classNames('wh-tool-button', { 'is-active': drawTool === tool })}
                  aria-pressed={drawTool === tool} onClick={() => { startPicking({ drawTool: tool }) }}>
                  <Icon size={14} />
                  {translate(TOOL_LABEL_KEYS[tool])}
                </button>
              )
            })}
          </div>
        )}

        {/* Line 3: buffer and profile in use; opens the options. */}
        {hasOptions
          ? (
            <button type='button' className='wh-details-toggle' aria-expanded={optionsOpen} aria-controls={`wh-options-${props.id}`}
              title={translate(optionsOpen ? 'whHideOptions' : 'whShowOptions')} onClick={() => { setOptionsOpen(open => !open) }}>
              <span className='wh-details-text'>{barDetail}</span>
              <DownOutlined size={10} className={classNames('wh-summary-chevron', { 'is-open': optionsOpen })} />
            </button>
            )
          : barDetail && <span className='wh-details-toggle is-static'><span className='wh-details-text'>{barDetail}</span></span>}

        {hasOptions && optionsOpen && (
          <div className='wh-options-panel' id={`wh-options-${props.id}`}>
            {where.allowCustomBuffer && (
              <div className='wh-buffer'>
                <Label className='wh-buffer-toggle'>
                  <Checkbox checked={bufferOn} onChange={() => { updateChoices({ bufferOn: !bufferOn }) }} />
                  {translate('whBuffer')}
                </Label>
                {bufferOn && (
                  <span className='wh-buffer-value'>
                    <NumericInput size='sm' style={{ width: 96 }} step={5} min={whereMode === 'point' ? 0 : undefined}
                      value={whereMode === 'point' ? Math.max(0, bufferValue) : bufferValue}
                      aria-label={translate('whBufferValue')}
                      onChange={value => {
                        updateChoices({ bufferValues: { ...choices.bufferValues, [whereMode]: Number.isFinite(Number(value)) ? Number(value) : 0 } })
                      }} />
                    <span>{translate('whUnitM')}</span>
                  </span>
                )}
              </div>
            )}
            {(allowProfileSwitch || allowCustomise) && (
              <div className='wh-step'>
                <div className='wh-step-head'>
                  <span className='wh-step-label' id={`wh-report-on-${props.id}`}>{translate('whReportOn')}</span>
                  {allowCustomise && (
                    <button type='button' className='wh-customise-link' disabled={!view} onClick={openCustomise}>
                      <SettingOutlined size={14} />
                      {translate('whCustomise')}
                    </button>
                  )}
                </div>
                {allowProfileSwitch
                  ? (
                    <Select size='sm' value={activeProfile?.id ?? ''} aria-labelledby={`wh-report-on-${props.id}`}
                      onChange={e => { selectProfile(e.target.value) }}>
                      {choiceProfiles.map(profile => <Option key={profile.id} value={profile.id}>{profile.label || translate('whProfile')}</Option>)}
                    </Select>
                    )
                  : <span className='wh-step-value'>{activeProfile?.label}</span>}
                {activeProfile?.id === MY_SETUP_ID && (
                  <span className='wh-step-note'>{translate('whMySetupSaved', { count: mySetup?.layers.length ?? 0 })}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {!hasMap && <div className='wh-notice'>{translate('whNoMap')}</div>}

      {location && (
        <div className={classNames('wh-location', { 'is-area': !!location.area, 'is-expanded': areaExpanded })}>
          {location.where === 'point'
            ? <PinOutlined className='wh-location-icon' size={16} />
            : <span className='wh-area-icon' aria-hidden='true' />}
          <div className='wh-location-text'>
            {location.area?.features.length > 0
              ? (
                <button
                  type='button'
                  className='wh-area-toggle'
                  aria-expanded={areaExpanded}
                  aria-controls={`wh-area-details-${props.id}`}
                  aria-label={translate(areaExpanded ? 'whHideDetails' : 'whShowDetails', { feature: location.area.name })}
                  onClick={() => { setAreaExpanded(e => !e) }}
                >
                  <span className='wh-area-name' title={location.area.name}>{location.area.name}</span>
                  <span className='wh-chevron'>{areaExpanded ? <DownOutlined size={10} /> : <RightOutlined size={10} />}</span>
                </button>
                )
              : (
                <span className={classNames('wh-area-name', { 'wh-mono': !location.area || location.where === 'point' })} title={cardTitle}>
                  {cardTitle}
                </span>
                )}
            <span className='wh-location-meta' title={locationSubtitle(location)}>{cardMeta}</span>
          </div>
          <span className='wh-area-actions'>
            {showReport && (
              <Button size='sm' type='tertiary' icon disabled={isBusy}
                title={translate('whOpenReport')} aria-label={translate('whOpenReport')}
                onClick={() => { void openReport() }}>
                <DocumentOutlined size={14} />
              </Button>
            )}
            <Button size='sm' type='tertiary' icon disabled={isBusy}
              title={translate('whCopySummary')} aria-label={translate('whCopySummary')}
              onClick={() => { void copySummary() }}>
              <CopyOutlined size={14} />
            </Button>
            <Button size='sm' type='tertiary' icon
              title={translate('whZoomTo', { feature: cardTitle })}
              aria-label={translate('whZoomTo', { feature: cardTitle })}
              onClick={zoomToLocation}>
              <ZoomInOutlined size={14} />
            </Button>
            <Button size='sm' type='tertiary' icon
              title={translate('whClear')} aria-label={translate('whClear')} onClick={clearResults}>
              <CloseOutlined size={14} />
            </Button>
          </span>
        </div>
      )}
      {location?.area && areaExpanded && areaResult.features.length > 0 && (
        <div className='wh-area-details' id={`wh-area-details-${props.id}`}>
          <div className='wh-area-details-actions'>{renderActions(areaResult, location.area.name)}</div>
          {areaResult.features.length === 1
            ? renderAttributes(areaResult.features[0], `wh-area-attrs-${props.id}`)
            : <ul className='wh-features'>{areaResult.features.map(feature => renderFeature(areaResult, feature))}</ul>}
        </div>
      )}

      {(isBusy || message || (status === 'done' && featureTotal === 0)) && (
        <div className='wh-status' role='status' aria-live='polite'>
          {isBusy && <span className='wh-loading'><Loading type={LoadingType.Donut} width={18} height={18} /></span>}
          {message && (message.ok ? <CheckOutlined size={14} /> : <InfoOutlined size={14} />)}
          <span className='wh-status-text'><strong>{message?.text || summary}</strong></span>
        </div>
      )}
      {status === 'done' && featureTotal > 0 && (
        <div className='wh-results-head'>
          <span className='wh-status-text' role='status' aria-live='polite'>
            <strong>{summary}</strong>
            <span className='wh-status-sub'>
              {activeProfile?.label
                ? translate('whSearchedLayersProfile', { profile: activeProfile.label, count: searchedCount })
                : translate('whSearchedLayers', { count: searchedCount })}
            </span>
          </span>
          {visibleResults.length > 1 && (
            <button type='button' className='wh-link' onClick={toggleAllGroups}>
              {translate(anyGroupOpen ? 'whCollapseAll' : 'whExpandAll')}
            </button>
          )}
        </div>
      )}

      {location
        ? (visibleResults.length > 0 && <ul className='wh-results'>{visibleResults.map(renderLayer)}</ul>)
        : (
          <div className='wh-empty'>
            <SelectPointOutlined size={28} />
            <strong>{translate('whEmptyTitle')}</strong>
            <span>{translate(whereMode === 'feature' ? 'whEmptyBodyArea' : whereMode === 'draw' ? 'whEmptyBodyDraw' : 'whEmptyBody')}</span>
          </div>
          )}
          </>
          )}
    </div>
  )
}

export default Widget
