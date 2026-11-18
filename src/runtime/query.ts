import Point from 'esri/geometry/Point'
import Extent from 'esri/geometry/Extent'
import SpatialReference from 'esri/geometry/SpatialReference'
import * as webMercatorUtils from 'esri/geometry/support/webMercatorUtils'
import type { AreaRelationship, WhatsHereRequest } from '../config'
import { type FeatureAttribute, type FeatureResult, type LayerResult, dateFormatOptions, fillTemplate, formatNumber, isVisibleAtScale } from './utils'

/** A layer or sublayer that supports queryFeatures(). Typed loosely because several SDK classes qualify. */
export interface QueryTarget {
  key: string
  title: string
  parentTitle?: string
  layer: any
  /** Profile fields to show, in order. Undefined uses the popup fields. */
  fields?: string[]
}

export interface SearchGeometry {
  point: __esri.Point
  /** Pixel-tolerance box around the point; null when it cannot be computed (e.g. clicking the sky in 3D). */
  extent: __esri.Extent | null
  /** Area search: the (buffered) polygon to search with instead of the point. */
  area?: __esri.Polygon
  relationship?: AreaRelationship
}

const WGS84 = new SpatialReference({ wkid: 4326 })

// Layer types whose features can be queried at a location.
const QUERYABLE_TYPES = new Set(['feature', 'csv', 'geojson', 'ogc-feature', 'wfs', 'scene', 'subtype-group', 'oriented-imagery'])

// Field types that are never useful in an attribute list.
const HIDDEN_FIELD_TYPES = new Set(['geometry', 'blob', 'raster', 'xml'])
const HIDDEN_FIELD_NAMES = /^(shape|shape[._]?(area|length|len)|st_area\(.*\)|st_length\(.*\))$/i

export const pointToLatLon = (point: __esri.Point): { latitude: number, longitude: number } => {
  if (!point) return { latitude: NaN, longitude: NaN }
  if (Number.isFinite(point.latitude) && Number.isFinite(point.longitude)) {
    return { latitude: point.latitude, longitude: point.longitude }
  }
  try {
    if (webMercatorUtils.canProject(point, WGS84)) {
      const projected = webMercatorUtils.project(point, WGS84) as __esri.Point
      if (projected) return { latitude: projected.y, longitude: projected.x }
    }
  } catch (err) {
    console.warn("What's Here: coordinate conversion failed.", err)
  }
  return { latitude: NaN, longitude: NaN }
}

/**
 * Turns a Map Context Menu payload into a point in the view's spatial reference.
 * Map coordinates are used when they share the view's wkid; otherwise latitude/longitude.
 */
export const requestToViewPoint = (request: WhatsHereRequest, view: __esri.MapView | __esri.SceneView): __esri.Point | null => {
  const viewSR = view?.spatialReference
  if (!viewSR) return null

  const { mapX, mapY, wkid, latitude, longitude } = request ?? ({} as WhatsHereRequest)
  if (Number.isFinite(mapX) && Number.isFinite(mapY) && wkid && viewSR.wkid === wkid) {
    return new Point({ x: mapX, y: mapY, spatialReference: viewSR })
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const geographic = new Point({ latitude, longitude, spatialReference: WGS84 })
  if (viewSR.isWGS84) return geographic
  if (webMercatorUtils.canProject(geographic, viewSR)) return webMercatorUtils.project(geographic, viewSR) as __esri.Point
  // Other projections: queries still work with a geographic point, only the pixel tolerance is lost.
  return geographic
}

export const buildSearchGeometry = (view: __esri.MapView | __esri.SceneView, point: __esri.Point, tolerancePx: number): SearchGeometry => {
  const sameSR = point.spatialReference?.equals?.(view.spatialReference)

  if (view.type === '2d' && sameSR) {
    const r = (view as __esri.MapView).resolution * tolerancePx
    return {
      point,
      extent: new Extent({ xmin: point.x - r, ymin: point.y - r, xmax: point.x + r, ymax: point.y + r, spatialReference: point.spatialReference })
    }
  }

  // 3D, or a point the 2D resolution maths cannot be applied to: measure the box in screen space.
  try {
    const screen = view.toScreen(point)
    const a = screen && view.toMap({ x: screen.x - tolerancePx, y: screen.y - tolerancePx } as any)
    const b = screen && view.toMap({ x: screen.x + tolerancePx, y: screen.y + tolerancePx } as any)
    if (a && b) {
      return {
        point,
        extent: new Extent({
          xmin: Math.min(a.x, b.x), ymin: Math.min(a.y, b.y), xmax: Math.max(a.x, b.x), ymax: Math.max(a.y, b.y),
          spatialReference: a.spatialReference
        })
      }
    }
  } catch {
    // Fall through to a point-only search.
  }
  return { point, extent: null }
}

/**
 * Every layer the user can see at the current scale, top of the layer list first. Group layers and map image
 * sublayers are expanded; layers hidden from the layer list (listMode 'hide') are skipped, which also skips
 * temporary graphics layers added by widgets.
 */
export const collectTargets = (map: __esri.Map, scale: number, includeHidden = false): QueryTarget[] => {
  const targets: QueryTarget[] = []
  // includeHidden walks layers that are turned off or out of scale too (profiles can ask for that).
  const shown = (item: any) => includeHidden || (item.visible && isVisibleAtScale(item.minScale, item.maxScale, scale))

  const walkSublayers = (sublayers: __esri.Collection<any>, rootId: string, parentTitle: string) => {
    // Map image sublayers are already ordered top first.
    sublayers?.toArray().forEach((sublayer: any) => {
      if (sublayer.listMode === 'hide' || !shown(sublayer)) return
      if (sublayer.sublayers?.length) {
        // 'hide-children' keeps a sublayer's own children out of the layer list, and out of the search.
        if (sublayer.listMode === 'hide-children') return
        walkSublayers(sublayer.sublayers, rootId, parentTitle)
        return
      }
      if (typeof sublayer.queryFeatures !== 'function' || sublayer.isTable) return
      targets.push({ key: `${rootId}::${sublayer.id}`, title: sublayer.title, parentTitle, layer: sublayer })
    })
  }

  const walk = (layers: __esri.Collection<any>, parentTitle?: string) => {
    // Map layer collections are ordered bottom first; reverse so results follow the layer list.
    layers?.toArray().slice().reverse().forEach((layer: any) => {
      if (layer.listMode === 'hide' || !shown(layer)) return

      if (layer.type === 'group') {
        if (layer.listMode !== 'hide-children') walk(layer.layers, layer.title)
      } else if (layer.type === 'map-image') {
        if (layer.listMode !== 'hide-children') walkSublayers(layer.sublayers, layer.id, layer.title)
      } else if (QUERYABLE_TYPES.has(layer.type) && !layer.isTable && typeof layer.queryFeatures === 'function') {
        targets.push({ key: layer.id, title: layer.title, parentTitle, layer })
      }
    })
  }

  walk(map?.layers as any)
  return targets
}

const NUMBER_TYPES = new Set(['double', 'single', 'integer', 'small-integer', 'big-integer', 'long', 'oid',
  'esriFieldTypeDouble', 'esriFieldTypeSingle', 'esriFieldTypeInteger', 'esriFieldTypeSmallInteger', 'esriFieldTypeBigInteger', 'esriFieldTypeOID'])
const DECIMAL_TYPES = new Set(['double', 'single', 'esriFieldTypeDouble', 'esriFieldTypeSingle'])

/** The popup's settings for a field (Map Viewer › Configure pop-ups › Fields), if the layer has any. */
const popupFieldFormat = (layer: any, fieldName: string): any => {
  const name = fieldName.toLowerCase()
  return layer.popupTemplate?.fieldInfos?.find((info: any) => String(info?.fieldName ?? '').toLowerCase() === name)?.format ?? null
}

const makeFormatter = (layer: any, graphic: __esri.Graphic) => (fieldName: string, value: any): string => {
  if (value === null || value === undefined || value === '') return ''
  const field = layer.fieldsIndex?.get?.(fieldName) ?? layer.fields?.find((f: any) => f.name === fieldName)

  let domain: any
  try {
    domain = layer.getFieldDomain?.(fieldName, { feature: graphic }) ?? field?.domain
  } catch {
    domain = field?.domain
  }
  if (domain?.type === 'coded-value') {
    const coded = domain.codedValues?.find((c: any) => c.code === value)
    if (coded) return String(coded.name)
  }

  if ((field?.type === 'date' || field?.type === 'esriFieldTypeDate') && Number.isFinite(Number(value))) {
    const options = dateFormatOptions(popupFieldFormat(layer, fieldName)?.dateFormat)
    return options ? new Date(Number(value)).toLocaleString(undefined, options) : new Date(Number(value)).toLocaleString()
  }
  if (typeof value === 'number' && NUMBER_TYPES.has(field?.type)) {
    return formatNumber(value, {
      format: popupFieldFormat(layer, fieldName),
      isInteger: !DECIMAL_TYPES.has(field.type),
      isIdentifier: field.valueType === 'unique-identifier'
    })
  }
  return String(value)
}

const attributeList = (layer: any, graphic: __esri.Graphic, format: (field: string, value: any) => string): FeatureAttribute[] => {
  const attributes = graphic.attributes ?? {}
  const fieldInfos: any[] = layer.popupTemplate?.fieldInfos ?? []
  const visibleInfos = fieldInfos.filter(info => info?.visible !== false && info?.fieldName && !String(info.fieldName).startsWith('expression/'))

  const rows = visibleInfos.length
    ? visibleInfos.map(info => {
      const field = layer.fieldsIndex?.get?.(info.fieldName)
      return { name: field?.name ?? info.fieldName, label: info.label || field?.alias || info.fieldName }
    })
    : (layer.fields ?? [])
        .filter((f: any) => !HIDDEN_FIELD_TYPES.has(f.type) && !HIDDEN_FIELD_NAMES.test(f.name))
        .map((f: any) => ({ name: f.name, label: f.alias || f.name }))

  return rows
    .filter(row => row.name in attributes)
    .map(row => ({ label: row.label, value: format(row.name, attributes[row.name]) }))
    .filter(row => row.value !== '')
}

/** The feature's popup title, its display field value, or its object ID, in that order. */
const describe = (layer: any, graphic: __esri.Graphic, format: (field: string, value: any) => string, index: number): string => {
  const attributes = graphic.attributes ?? {}
  const title = layer.popupTemplate?.title
  if (typeof title === 'string' && title.includes('{')) {
    const filled = fillTemplate(title, attributes, format)
    if (filled) return filled
  }

  const displayField = layer.displayField
  if (displayField && attributes[displayField] !== null && attributes[displayField] !== undefined && attributes[displayField] !== '') {
    return format(displayField, attributes[displayField])
  }

  const oidField = layer.objectIdField
  if (oidField && attributes[oidField] !== null && attributes[oidField] !== undefined) return `${oidField} ${attributes[oidField]}`
  return `#${index + 1}`
}

/** The layer's own spelling of a field name, so attributes are found whatever case a profile saved. */
const layerFieldName = (layer: any, name: string): string => layer.fieldsIndex?.get?.(name)?.name ?? name

/** Profile fields: the first is the row title, and all of them the details. */
const profileAttributes = (layer: any, graphic: __esri.Graphic, format: (field: string, value: any) => string, fields: string[]) =>
  fields.map(name => {
    const fieldName = layerFieldName(layer, name)
    const field = layer.fieldsIndex?.get?.(fieldName)
    return { label: field?.alias || fieldName, value: format(fieldName, graphic.attributes?.[fieldName]) }
  })

/** The popup title, display field or object ID of a feature, ignoring any profile fields. */
export const describeFeature = (layer: any, graphic: __esri.Graphic, index: number): string =>
  describe(layer, graphic, makeFormatter(layer, graphic), index)

/** A result row: description, display attributes and the graphic, keyed by object ID where there is one. */
export const toFeatureResult = (layer: any, graphic: __esri.Graphic, index: number, fields?: string[]): FeatureResult => {
  const format = makeFormatter(layer, graphic)
  const oid = layer.objectIdField ? graphic.attributes?.[layer.objectIdField] : undefined
  const id = oid !== undefined && oid !== null ? String(oid) : String(index)

  if (fields?.length) {
    const values = profileAttributes(layer, graphic, format, fields)
    return {
      id,
      description: values[0]?.value || describe(layer, graphic, format, index),
      attributes: values.filter(row => row.value !== ''),
      graphic
    }
  }
  return { id, description: describe(layer, graphic, format, index), attributes: attributeList(layer, graphic, format), graphic }
}

export const queryTarget = async (
  target: QueryTarget,
  geometry: SearchGeometry,
  outSpatialReference: __esri.SpatialReference,
  maxFeatures: number
): Promise<LayerResult> => {
  const { layer } = target
  const base: LayerResult = { key: target.key, title: target.title || layer?.title || target.key, parentTitle: target.parentTitle, features: [], layer }

  try {
    if (typeof layer.load === 'function') await layer.load()
    // A scene layer can only be queried through an associated feature layer; without one it is skipped.
    if (layer.type === 'scene' && !layer.associatedLayer) return { ...base, skipped: true }

    // Polygons are hit only where the point falls inside them; points and lines need the tolerance box.
    const searchArea = geometry.area ?? (layer.geometryType === 'polygon' || !geometry.extent ? geometry.point : geometry.extent)
    const query = typeof layer.createQuery === 'function' ? layer.createQuery() : ({} as any)
    query.geometry = searchArea
    // The SDK's 'contains' returns features the query geometry completely contains (its 'within' is the reverse).
    query.spatialRelationship = geometry.area && geometry.relationship === 'inside' ? 'contains' : 'intersects'
    // Profile fields only need those fields (plus the object ID); otherwise popups and descriptions need them all.
    // A saved field the layer no longer has would make the server reject the whole query, so it is dropped.
    const fields = target.fields?.filter(name => !layer.fieldsIndex || layer.fieldsIndex.has(name))
    query.outFields = fields?.length
      ? Array.from(new Set([layer.objectIdField, ...fields.map(name => layerFieldName(layer, name))].filter(Boolean)))
      : ['*']
    query.returnGeometry = true
    query.outSpatialReference = outSpatialReference
    // Ask for one extra feature so we know when the limit was reached.
    query.num = maxFeatures + 1
    if (!query.where) query.where = '1=1'

    const featureSet = await layer.queryFeatures(query)
    const graphics: __esri.Graphic[] = featureSet?.features ?? []
    const exceeded = graphics.length > maxFeatures || featureSet?.exceededTransferLimit === true
    // Only layers over the limit pay for a second request, to turn "100+" into "100 of 2,341".
    let total: number | undefined
    if (exceeded && typeof layer.queryFeatureCount === 'function') {
      try {
        const countQuery = query.clone ? query.clone() : { ...query }
        countQuery.num = undefined
        countQuery.returnGeometry = false
        total = await layer.queryFeatureCount(countQuery)
      } catch {
        total = undefined
      }
    }
    const features: FeatureResult[] = graphics.slice(0, maxFeatures).map((graphic, index) => toFeatureResult(layer, graphic, index, fields))

    return { ...base, title: target.title || layer.title || target.key, features, exceeded, total, fields: fields?.length ? fields : undefined }
  } catch (err) {
    console.warn(`What's Here: could not query "${base.title}".`, err)
    return { ...base, error: true, errorMessage: (err as any)?.details?.messages?.[0] ?? (err as any)?.message }
  }
}
