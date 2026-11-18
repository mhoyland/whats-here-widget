import { DataSourceManager } from 'jimu-core'
import type { JimuMapView } from 'jimu-arcgis'
import * as geodesicBufferOperator from 'esri/geometry/operators/geodesicBufferOperator'
import * as bufferOperator from 'esri/geometry/operators/bufferOperator'
import * as unionOperator from 'esri/geometry/operators/unionOperator'
import * as generalizeOperator from 'esri/geometry/operators/generalizeOperator'
import type { BufferUnit, MultipleAreas } from '../config'
import { describeFeature, toFeatureResult } from './query'
import { type FeatureResult, toMeters } from './utils'

export interface SearchArea {
  polygon: __esri.Polygon
  /** The area polygon's description, e.g. "Cherry County". Several names are joined when merged. */
  name: string
  /** The area polygon(s) under the point, with their attributes. */
  features: FeatureResult[]
}

export type AreaFailure = 'no-layer' | 'not-found' | 'buffer-empty' | 'error'

// Counties and similar layers rarely stack more than a few polygons at a point.
const MAX_MERGED_AREAS = 25
// Above this many vertices the area is generalized before it is sent to every layer.
const GENERALIZE_VERTEX_LIMIT = 2000

/**
 * The map layer (or map image sublayer) behind a layer data source, so that the layer's own definition
 * expression still applies. Falls back to the data source's layer when it is not in the map.
 */
export const resolveMapLayer = async (jimuMapView: JimuMapView, dataSourceId: string): Promise<any> => {
  if (!dataSourceId) return null
  try {
    const ds = DataSourceManager.getInstance().getDataSource(dataSourceId)
    const layerView = ds && jimuMapView?.whenJimuLayerViewLoadedByDataSource
      ? await jimuMapView.whenJimuLayerViewLoadedByDataSource(ds)
      : jimuMapView?.getJimuLayerViewByDataSourceId(dataSourceId)
    const layer = layerView?.layer ?? (ds as any)?.layer ?? null
    if (layer && typeof layer.load === 'function') await layer.load()
    return typeof layer?.queryFeatures === 'function' ? layer : null
  } catch (err) {
    console.warn(`What's Here: layer for data source "${dataSourceId}" could not be loaded.`, err)
    return null
  }
}

const vertexCount = (polygon: __esri.Polygon) => (polygon?.rings ?? []).reduce((sum, ring) => sum + ring.length, 0)

const bufferGeometry = async (geometry: __esri.Polygon | __esri.Point, distance: number, unit: BufferUnit): Promise<__esri.Polygon | null> => {
  const sr = geometry.spatialReference
  // Geodesic buffers measure true ground distance but only work in geographic or Web Mercator coordinates.
  if (sr?.isGeographic || sr?.isWebMercator) {
    if (!geodesicBufferOperator.isLoaded()) await geodesicBufferOperator.load()
    return geodesicBufferOperator.execute(geometry, distance, { unit }) ?? null
  }
  return bufferOperator.execute(geometry, distance, { unit }) ?? null
}

/**
 * The polygon to search with: the geometry buffered by `distance` (a point becomes a circle), then
 * generalized if it is very detailed. Null when a negative buffer leaves nothing.
 */
export const prepareArea = async (
  geometry: __esri.Polygon | __esri.Point,
  distance: number,
  unit: BufferUnit = 'meters'
): Promise<__esri.Polygon | null> => {
  let polygon = distance ? await bufferGeometry(geometry, distance, unit) : geometry as __esri.Polygon
  if (!polygon || polygon.type !== 'polygon' || polygon.rings?.length === 0) return null
  if (vertexCount(polygon) > GENERALIZE_VERTEX_LIMIT) {
    // Small enough not to undo the buffer: a quarter of it, but at least half a metre.
    const deviation = Math.max(0.5, Math.abs(toMeters(distance, unit)) / 4)
    polygon = (generalizeOperator.execute(polygon, deviation, { unit: 'meters' }) as __esri.Polygon) ?? polygon
  }
  return polygon
}

/**
 * Finds the polygon(s) in the area layer under the point, merges them if asked, then applies the buffer.
 * The result is in the view's spatial reference.
 */
export const buildSearchArea = async (
  layer: any,
  point: __esri.Point,
  outSpatialReference: __esri.SpatialReference,
  options: { multiple: MultipleAreas, bufferDistance: number, bufferUnit: BufferUnit, fields?: string[] }
): Promise<SearchArea | AreaFailure> => {
  if (!layer) return 'no-layer'
  try {
    const query = typeof layer.createQuery === 'function' ? layer.createQuery() : ({} as any)
    query.geometry = point
    query.spatialRelationship = 'intersects'
    query.outFields = ['*']
    query.returnGeometry = true
    query.outSpatialReference = outSpatialReference
    query.num = options.multiple === 'merge' ? MAX_MERGED_AREAS : 1
    if (!query.where) query.where = '1=1'

    const featureSet = await layer.queryFeatures(query)
    const graphics: __esri.Graphic[] = (featureSet?.features ?? []).filter((g: __esri.Graphic) => g.geometry?.type === 'polygon')
    if (!graphics.length) return 'not-found'

    const merged = graphics.length === 1
      ? graphics[0].geometry as __esri.Polygon
      : unionOperator.executeMany(graphics.map(g => g.geometry)) as __esri.Polygon
    if (!merged) return 'error'

    const polygon = await prepareArea(merged, options.bufferDistance, options.bufferUnit)
    if (!polygon) return 'buffer-empty'

    // Chosen fields set the details; the name still comes from the popup title or display field.
    const fields = options.fields?.filter(name => !layer.fieldsIndex || layer.fieldsIndex.has(name))
    const features = graphics.map((graphic, index) => ({
      ...toFeatureResult(layer, graphic, index, fields?.length ? fields : undefined),
      description: describeFeature(layer, graphic, index)
    }))
    return { polygon, name: Array.from(new Set(features.map(f => f.description))).join(', '), features }
  } catch (err) {
    console.warn("What's Here: could not build the search area.", err)
    return 'error'
  }
}
