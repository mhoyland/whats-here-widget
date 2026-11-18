import { DataSourceManager } from 'jimu-core'
import type { JimuMapView } from 'jimu-arcgis'
import type { Profile } from '../config'
import { type QueryTarget, collectTargets } from './query'
import { resolveMapLayer } from './area'

const LAYER_VIEW_WAIT_MS = 3000

/** A layer's REST URL including its layer id, lower case, for matching a data source to a map layer. */
const layerUrl = (layer: any): string => {
  const url = String(layer?.url ?? '').replace(/\/+$/, '')
  if (!url) return ''
  const id = layer?.layerId ?? (layer?.layer ? layer.id : undefined)
  return (/\/\d+$/.test(url) || id === undefined || id === null ? url : `${url}/${id}`).toLowerCase()
}

/**
 * The map's own layer for a profile entry: the one its layer view reports, else the map layer with the same
 * service URL. The data source's private copy of the layer is never used, so results, highlights and the
 * area-layer exclusion all work on the same objects as an "all visible layers" search.
 */
export const findMapTarget = (jimuMapView: JimuMapView, candidates: QueryTarget[], dataSourceId: string): QueryTarget | null => {
  const viewLayer = jimuMapView.getJimuLayerViewByDataSourceId(dataSourceId)?.layer
  const byView = viewLayer && candidates.find(target => target.layer === viewLayer)
  if (byView) return byView

  const ds: any = DataSourceManager.getInstance().getDataSource(dataSourceId)
  const url = layerUrl(ds) || layerUrl(ds?.layer)
  return (url && candidates.find(target => layerUrl(target.layer) === url)) || null
}

const layerViewsReady = new WeakMap<JimuMapView, Promise<unknown>>()

/**
 * Layer views are created asynchronously; wait for them, but never let one slow layer hold up a search. The wait
 * is shared per map view, so a map with a layer that never loads costs it once, not on every search.
 */
const whenLayerViewsReady = (jimuMapView: JimuMapView): Promise<unknown> => {
  if (!layerViewsReady.has(jimuMapView)) {
    layerViewsReady.set(jimuMapView, Promise.race([
      jimuMapView.whenAllJimuLayerViewLoaded?.().catch(() => null),
      new Promise(resolve => { window.setTimeout(resolve, LAYER_VIEW_WAIT_MS) })
    ]))
  }
  return layerViewsReady.get(jimuMapView)
}

/**
 * The map's own layer for an area data source, turned off or not, so results and the area-layer exclusion
 * use the same object. Falls back to the data source lookup for layers the map list does not hold.
 */
export const resolveAreaLayer = async (jimuMapView: JimuMapView, dataSourceId: string | undefined): Promise<any> => {
  const view = jimuMapView?.view
  if (!dataSourceId || !view?.map) return null
  await whenLayerViewsReady(jimuMapView)
  const match = findMapTarget(jimuMapView, collectTargets(view.map, view.scale, true), dataSourceId)
  if (!match) return resolveMapLayer(jimuMapView, dataSourceId)
  if (typeof match.layer.load === 'function') await match.layer.load()
  return match.layer
}

/**
 * The layers a profile searches, in the profile's order, each with the fields to show.
 * Returns null when the profile searches every visible layer (or there is no profile).
 */
export const resolveProfileTargets = async (
  jimuMapView: JimuMapView,
  profile: Profile | null
): Promise<QueryTarget[] | null> => {
  const view = jimuMapView?.view
  if (!profile || profile.layerScope !== 'chosen' || !view?.map) return null

  await whenLayerViewsReady(jimuMapView)
  // The visible list follows the layer-list rules (turned off, out of scale, hidden parents) unless the profile overrides them.
  const candidates = collectTargets(view.map, view.scale, !!profile.includeHiddenLayers)

  // The profile comes from immutable widget config. Its array methods return immutable results, which would
  // deep-freeze the map layers into plain objects without queryFeatures(), so copy to a plain array first.
  const entries = Array.from(profile.layers ?? [])
  const seen = new Set<string>()
  const targets: QueryTarget[] = []
  entries.forEach(entry => {
    const match = findMapTarget(jimuMapView, candidates, entry.dataSourceId)
    if (match && !seen.has(match.key)) {
      seen.add(match.key)
      targets.push({ ...match, fields: entry.fields?.length ? Array.from(entry.fields) : undefined })
    }
  })
  return targets
}
