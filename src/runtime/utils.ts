// Pure helpers with no ArcGIS Maps SDK imports, so they can be unit tested directly.
import {
  DEFAULT_BUFFER, DRAW_TOOLS, WHERE_MODES,
  type AreaLayer, type Config, type DrawTool, type Profile, type WhereMode
} from '../config'

/** The design-time "where" settings in effect, with apps saved before 1.7 carried over. */
export interface WhereSettings {
  /** The ways offered, in display order. Never empty; "feature" only when there is an area layer. */
  modes: WhereMode[]
  defaultMode: WhereMode
  drawTools: DrawTool[]
  areaLayers: AreaLayer[]
  defaultAreaLayerId?: string
  /** Default buffers in metres. The point radius is never negative; 0 means the click tolerance. */
  buffers: { [mode in WhereMode]: number }
  allowCustomBuffer: boolean
}

const finiteOr = (value: unknown, fallback: number): number =>
  value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : fallback

const plainLayer = (layer: AreaLayer): AreaLayer => ({ ...layer, fields: Array.from(layer.fields ?? []) })

/**
 * Before 1.7 there was one widget-wide area layer (props.useDataSources[0]) and, in 1.6, one per profile.
 * They become the area layers, widget-wide first.
 */
const legacyAreaLayers = (config: Partial<Config> | undefined, legacyAreaDataSourceId: string | undefined): AreaLayer[] => {
  const layers: AreaLayer[] = []
  const add = (dataSourceId: string | undefined, fields: readonly string[] | undefined, rootDataSourceId?: string) => {
    if (dataSourceId && !layers.some(l => l.dataSourceId === dataSourceId)) {
      layers.push({ dataSourceId, rootDataSourceId, fields: Array.from(fields ?? []) })
    }
  }
  add(legacyAreaDataSourceId, config?.areaFields)
  Array.from((config?.profiles ?? []) as Profile[]).forEach(profile => {
    if (profile?.searchBy) add(profile.area?.dataSourceId, profile.area?.fields, profile.area?.rootDataSourceId)
  })
  return layers
}

export const resolveWhere = (config: Partial<Config> | undefined, legacyAreaDataSourceId: string | undefined): WhereSettings => {
  const areaLayers = config?.areaLayers
    ? Array.from(config.areaLayers).filter(layer => layer?.dataSourceId).map(plainLayer)
    : legacyAreaLayers(config, legacyAreaDataSourceId)
  const defaultAreaLayerId = areaLayers.some(l => l.dataSourceId === config?.defaultAreaLayerId)
    ? config.defaultAreaLayerId
    : areaLayers[0]?.dataSourceId

  const requested = config?.whereModes ? Array.from(config.whereModes) : WHERE_MODES
  const offered = WHERE_MODES.filter(mode => requested.includes(mode) && (mode !== 'feature' || areaLayers.length > 0))
  const modes: WhereMode[] = offered.length ? offered : ['point']
  const firstProfile = (config?.profiles as Profile[] | undefined)?.[0]
  const legacyDefault: WhereMode = config?.searchMode === 'area' || firstProfile?.searchBy === 'area' ? 'feature' : 'point'
  const wanted = config?.defaultWhere ?? legacyDefault
  const defaultMode = modes.includes(wanted) ? wanted : modes[0]

  const requestedTools = config?.drawTools ? Array.from(config.drawTools) : ['polygon', 'rectangle']
  const drawTools = DRAW_TOOLS.filter(tool => requestedTools.includes(tool))

  // The old single buffer may have had another unit; the new defaults are metres.
  const legacyBuffer = config?.bufferDistance !== undefined
    ? toMeters(finiteOr(config.bufferDistance, DEFAULT_BUFFER), config.bufferUnit ?? 'meters')
    : DEFAULT_BUFFER

  return {
    modes,
    defaultMode,
    drawTools: drawTools.length ? drawTools : ['polygon'],
    areaLayers,
    defaultAreaLayerId,
    buffers: {
      feature: finiteOr(config?.bufferFeature, legacyBuffer),
      draw: finiteOr(config?.bufferDraw, 0),
      point: Math.max(0, finiteOr(config?.bufferPoint, 0))
    },
    allowCustomBuffer: config?.allowCustomBuffer !== false
  }
}

/** The profile with this id, else the first (default) profile, else null when there are none. */
export const pickProfile = <P extends { id: string }>(profiles: readonly P[] | undefined, id: string | null | undefined): P | null =>
  profiles?.find(profile => profile.id === id) ?? profiles?.[0] ?? null

export interface FeatureAttribute {
  label: string
  value: string
}

export interface FeatureResult {
  id: string
  description: string
  attributes: FeatureAttribute[]
  graphic: __esri.Graphic
}

export interface LayerResult {
  key: string
  title: string
  /** Parent layer title, e.g. the map image layer that owns a sublayer. */
  parentTitle?: string
  features: FeatureResult[]
  /** True when the per-layer limit was reached and more features may exist. */
  exceeded?: boolean
  /** Full number of matching features, counted only when the limit was reached. */
  total?: number
  error?: boolean
  /** The service's reason, shown under the error note. */
  errorMessage?: string
  /** The searched map layer (or sublayer), for data actions. */
  layer?: any
  /** Profile fields used for this layer, if any. */
  fields?: string[]
  /** The layer cannot be queried at all and is left out of the results. */
  skipped?: boolean
}

/** ArcGIS scale ranges use 0 for "no limit". minScale is the most zoomed-out scale. */
export const isVisibleAtScale = (minScale: number | undefined, maxScale: number | undefined, scale: number | undefined): boolean => {
  if (!Number.isFinite(scale)) return true
  if (minScale && scale > minScale) return false
  if (maxScale && scale < maxScale) return false
  return true
}

/**
 * Fills a popup title such as "{NAME} ({STATUS})" from feature attributes.
 * Arcade placeholders ({expression/expr0}) and unknown fields resolve to empty text.
 */
export const fillTemplate = (template: string, attributes: { [key: string]: any }, format: (field: string, value: any) => string): string => {
  if (!template) return ''
  const lookup = new Map<string, string>()
  Object.keys(attributes ?? {}).forEach(key => { lookup.set(key.toLowerCase(), key) })

  return template
    .replace(/\{([^{}]+)\}/g, (_match, token: string) => {
      const field = lookup.get(token.trim().toLowerCase())
      if (!field) return ''
      const value = attributes[field]
      return value === null || value === undefined ? '' : format(field, value)
    })
    .replace(/\s*\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s:,\-–]+|[\s:,\-–]+$/g, '')
}

/** A popup field's number format, as set in Map Viewer ("Show thousands separator", decimal places). */
export interface NumberFormat {
  digitSeparator?: boolean
  places?: number | null
}

/**
 * Formats a number field value. The popup's format wins when the field has one. Otherwise identifiers
 * (field value type "unique identifier") and whole-number fields stay plain, so IDs and codes are never
 * grouped, and decimals get separators with up to 6 places.
 */
export const formatNumber = (
  value: number,
  options: { format?: NumberFormat | null, isInteger: boolean, isIdentifier: boolean },
  locale?: string
): string => {
  const format = options.format
  if (format && (format.digitSeparator !== undefined || (format.places !== undefined && format.places !== null))) {
    const places = Number.isInteger(format.places) && format.places >= 0 ? Math.min(format.places, 20) : undefined
    return value.toLocaleString(locale, places === undefined
      ? { useGrouping: !!format.digitSeparator, maximumFractionDigits: 6 }
      : { useGrouping: !!format.digitSeparator, minimumFractionDigits: places, maximumFractionDigits: places })
  }
  if (options.isIdentifier || options.isInteger) return String(value)
  return value.toLocaleString(locale, { maximumFractionDigits: 6 })
}

/**
 * Intl options for a popup date format such as "short-date-short-time" or "long-month-day-year".
 * Returns null for formats it does not know, so the caller can use its default.
 */
export const dateFormatOptions = (dateFormat: string | null | undefined): Intl.DateTimeFormatOptions | null => {
  if (!dateFormat) return null
  const f = dateFormat.toLowerCase()
  if (f === 'year') return { year: 'numeric' }
  if (f === 'long-month-year') return { year: 'numeric', month: 'long' }
  if (f === 'short-month-year') return { year: 'numeric', month: 'short' }

  let dateStyle: Intl.DateTimeFormatOptions['dateStyle']
  if (f.startsWith('long-date')) dateStyle = 'full'
  else if (f.startsWith('long-month-day-year')) dateStyle = 'long'
  else if (f.startsWith('day-short-month-year')) dateStyle = 'medium'
  else if (f.startsWith('short-date')) dateStyle = 'short'
  else return null

  const options: Intl.DateTimeFormatOptions = { dateStyle }
  if (f.includes('short-time')) options.timeStyle = 'short'
  else if (f.includes('long-time')) options.timeStyle = 'medium'
  if (options.timeStyle && f.endsWith('-24')) options.hourCycle = 'h23'
  return options
}

// ID fields mean nothing to readers, so they are never picked as defaults.
const ID_FIELD_TYPES = new Set(['oid', 'global-id', 'guid', 'esriFieldTypeOID', 'esriFieldTypeGlobalID', 'esriFieldTypeGUID'])
const ID_FIELD_NAMES = /^(objectid|object_id|fid|oid|globalid|global_id)$/i
const DEFAULT_FIELD_COUNT = 4

/**
 * The fields ticked when a layer is first ticked: its pop-up fields in pop-up order, or, without a pop-up,
 * the first few fields that are not IDs. Users can change them; nothing is ticked if there are no fields yet.
 */
export const defaultFields = (fields: ReadonlyArray<{ name: string, type?: string }>, popupFields: readonly string[]): string[] => {
  const names = new Set(fields.map(f => f.name))
  const fromPopup = popupFields.filter(name => names.has(name))
  if (fromPopup.length) return fromPopup
  return fields
    .filter(f => !ID_FIELD_TYPES.has(f.type) && !ID_FIELD_NAMES.test(f.name))
    .slice(0, DEFAULT_FIELD_COUNT)
    .map(f => f.name)
}

export const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export const formatLatLon = (latitude: number, longitude: number, decimals = 6): string =>
  Number.isFinite(latitude) && Number.isFinite(longitude) ? `${latitude.toFixed(decimals)}, ${longitude.toFixed(decimals)}` : ''

export const countFeatures = (results: LayerResult[]): number =>
  results.reduce((sum, layer) => sum + layer.features.length, 0)

/** Like countFeatures, but uses a layer's full count where one is known. */
export const countTotal = (results: LayerResult[]): number =>
  results.reduce((sum, layer) => sum + Math.max(layer.features.length, layer.total ?? 0), 0)

/** "12", "100+" when more exist but the total is unknown, or "2,341" when it is known. */
export const layerCountText = (layer: LayerResult): string => {
  if (layer.total !== undefined && layer.total > layer.features.length) return layer.total.toLocaleString()
  return `${layer.features.length}${layer.exceeded ? '+' : ''}`
}

const METERS_PER_UNIT = { meters: 1, kilometers: 1000, feet: 0.3048, miles: 1609.344 }

export const toMeters = (distance: number, unit: keyof typeof METERS_PER_UNIT): number =>
  (Number(distance) || 0) * (METERS_PER_UNIT[unit] ?? 1)

/** "−20 m", "+1.5 km", or '' for no buffer. Uses a true minus sign. */
export const formatBuffer = (distance: number, unitLabel: string): string => {
  const n = Number(distance) || 0
  if (n === 0) return ''
  return `${n > 0 ? '+' : '\u2212'}${Math.abs(n).toLocaleString()} ${unitLabel}`
}

/** Text made safe for HTML content and attribute values. */
export const escapeHtml = (text: string | number | null | undefined): string => String(text ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cleanCell = (text: string) => String(text ?? '').replace(/[\t\r\n]+/g, ' ').trim()

/**
 * One layer's features as a table: a column per attribute label (in first-seen order, as features can
 * leave out empty values), or a single description column when there are no attributes.
 * Returns tab-separated text for spreadsheets and an HTML table for email.
 */
export const layerTable = (layer: LayerResult): { text: string, html: string } => {
  const columns: string[] = []
  layer.features.forEach(feature => {
    feature.attributes.forEach(attr => {
      if (!columns.includes(attr.label)) columns.push(attr.label)
    })
  })
  const header = columns.length ? columns : [layer.title]
  const rows = layer.features.map(feature => columns.length
    ? columns.map(label => cleanCell(feature.attributes.find(attr => attr.label === label)?.value ?? ''))
    : [cleanCell(feature.description)])

  const text = [header.map(cleanCell), ...rows].map(row => row.join('\t')).join('\n')
  const html = '<table><thead><tr>' + header.map(h => `<th>${escapeHtml(h)}</th>`).join('') + '</tr></thead><tbody>' +
    rows.map(row => '<tr>' + row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('') + '</tr>').join('') +
    '</tbody></table>'
  return { text, html }
}

/** Plain-text summary for the clipboard. */
export const summaryText = (results: LayerResult[], heading: string): string => {
  const lines = [heading, '']
  results.forEach(layer => {
    if (!layer.features.length) return
    lines.push(`${layer.parentTitle ? `${layer.parentTitle} / ` : ''}${layer.title} (${layerCountText(layer)})`)
    layer.features.forEach(feature => { lines.push(`  - ${feature.description}`) })
    lines.push('')
  })
  return lines.join('\n').trim()
}
