import type { DataRecordSet } from 'jimu-core'
import type { JimuMapView } from 'jimu-arcgis'
import type { LayerResult } from './utils'

/**
 * Turns one layer's results into a data set for Experience Builder data actions (View in table, Export,
 * Zoom to, ...). The records come from the map layer's own data source, so the actions see the real layer.
 * Returns null when the layer has no data source, e.g. a layer added at runtime that ExB does not track.
 */
export const buildLayerDataSet = async (jimuMapView: JimuMapView, result: LayerResult): Promise<DataRecordSet | null> => {
  if (!result.layer || !result.features.length) return null
  try {
    const layerView = jimuMapView?.getJimuLayerViewByAPILayer(result.layer)
    const ds: any = await layerView?.getOrCreateLayerDataSource()
    if (typeof ds?.buildRecord !== 'function') return null

    // Profile fields are field names; data actions want the data source's jimu field names.
    const schemaFields = Object.values(ds.getSchema?.()?.fields ?? {}) as any[]
    const fields = result.fields?.length
      ? result.fields
        .map(name => schemaFields.find(f => String(f.name).toLowerCase() === name.toLowerCase())?.jimuName)
        .filter(Boolean)
      : undefined

    return {
      name: `whats-here-${result.key}`,
      label: result.title,
      type: 'loaded',
      dataSource: ds,
      records: result.features.map(feature => ds.buildRecord(feature.graphic)),
      fields: fields?.length ? fields : undefined
    }
  } catch (err) {
    console.warn(`What's Here: no data actions for "${result.title}".`, err)
    return null
  }
}
