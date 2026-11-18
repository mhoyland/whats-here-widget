import { React, DataSourceManager, DataSourceTypes } from 'jimu-core'
import { type MapLayerField, fieldsOf, popupFieldsOf } from '../components/field-picker'

/** A feature layer of the selected map, as the builder sees it through its data source. */
export interface MapLayer {
  dataSourceId: string
  rootDataSourceId: string
  label: string
  parentLabel?: string
  geometryType: string
  fields: MapLayerField[]
  popupFields: string[]
}

export const GEOMETRY_KEYS: { [type: string]: string } = {
  esriGeometryPoint: 'whsGeomPoint',
  esriGeometryMultipoint: 'whsGeomPoint',
  esriGeometryPolyline: 'whsGeomLine',
  esriGeometryPolygon: 'whsGeomPolygon'
}

export const isPolygonLayer = (layer: MapLayer) => layer.geometryType === 'esriGeometryPolygon'

/** Every feature layer with geometry under the map's data sources, map image sublayers included. */
export const useMapLayers = (rootIds: string[]): { layers: MapLayer[], loading: boolean } => {
  const [state, setState] = React.useState<{ layers: MapLayer[], loading: boolean }>({ layers: [], loading: true })
  const key = rootIds.join(',')

  React.useEffect(() => {
    let cancelled = false
    setState(current => ({ ...current, loading: true }))
    const load = async () => {
      const manager = DataSourceManager.getInstance()
      const layers: MapLayer[] = []
      for (const rootId of key ? key.split(',') : []) {
        try {
          const root = manager.getDataSource(rootId) ?? await manager.createDataSource(rootId)
          if (!root?.isDataSourceSet?.()) continue
          await root.childDataSourcesReady()
          root.getAllChildDataSources()
            .filter(ds => ds.type === DataSourceTypes.FeatureLayer && (ds as any).getGeometryType?.())
            .forEach(ds => {
              const parent = ds.parentDataSource
              layers.push({
                dataSourceId: ds.id,
                rootDataSourceId: rootId,
                label: ds.getLabel(),
                parentLabel: parent && parent.id !== rootId ? parent.getLabel() : undefined,
                geometryType: (ds as any).getGeometryType(),
                fields: fieldsOf(ds),
                popupFields: popupFieldsOf(ds)
              })
            })
        } catch (err) {
          console.warn("What's Here: could not list the map's layers.", err)
        }
      }
      if (!cancelled) setState({ layers, loading: false })
    }
    void load()
    return () => { cancelled = true }
  }, [key])

  return state
}
