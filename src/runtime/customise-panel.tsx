import { React, css, classNames } from 'jimu-core'
import type { JimuMapView } from 'jimu-arcgis'
import { Button, Checkbox } from 'jimu-ui'
import { LeftOutlined } from 'jimu-icons/outlined/directional/left'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'
import type { Profile, ProfileLayer } from '../config'
import FieldPicker, { type MapLayerField } from '../components/field-picker'
import { collectTargets } from './query'

interface Props {
  jimuMapView: JimuMapView
  /** What the user starts from: their My setup, or the profile they are on. */
  start: Profile
  startLabel: string
  /** 'profiles' limits the choice to layers named in the app's profiles. */
  pool: 'map' | 'profiles'
  profiles: Profile[]
  translate: (id: string, values?: any) => string
  onCancel: () => void
  onReset: () => void
  onDone: (layers: ProfileLayer[]) => void
}

interface Choice {
  dataSourceId: string
  title: string
  parentTitle?: string
  layer: any
}

// Fields that never help in a result list.
const HIDDEN_FIELD = /^(shape|shape[._]?(area|length|len)|st_area\(.*\)|st_length\(.*\)|globalid)$/i
const HIDDEN_TYPES = new Set(['geometry', 'blob', 'raster', 'xml'])

const layerFields = (layer: any): MapLayerField[] => (layer?.fields ?? [])
  .filter((f: any) => f?.name && !HIDDEN_TYPES.has(f.type) && !HIDDEN_FIELD.test(f.name))
  .map((f: any) => ({ name: f.name, alias: f.alias || f.name }))

const popupFields = (layer: any): string[] => (layer?.popupTemplate?.fieldInfos ?? [])
  .filter((info: any) => info?.fieldName && info.visible !== false && !String(info.fieldName).startsWith('expression/'))
  .map((info: any) => info.fieldName)

const style = css`
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;

  .whc-head {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    padding: var(--sys-spacing-2) var(--sys-spacing-3) var(--sys-spacing-2) var(--sys-spacing-1);
    border-bottom: 1px solid var(--sys-color-divider-secondary);
  }
  .whc-titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .whc-title {
    font-weight: 600;
    font-size: 0.9375rem;
  }
  .whc-sub,
  .whc-hint {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .whc-hint {
    padding: var(--sys-spacing-2) var(--sys-spacing-3);
    background: var(--sys-color-action-hover);
    border-bottom: 1px solid var(--sys-color-divider-tertiary);
  }
  .whc-list {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
  }
  .whc-layer {
    border-bottom: 1px solid var(--sys-color-divider-tertiary);
  }
  .whc-row {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 48px;
    padding: 0 var(--sys-spacing-3);
  }
  .whc-expand {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-2) 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .whc-names {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .whc-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whc-layer.is-off .whc-name {
    font-weight: 400;
    color: var(--sys-color-surface-paper-hint);
  }
  .whc-meta {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whc-fields {
    margin: 0 var(--sys-spacing-3) var(--sys-spacing-3) 36px;
    border: 1px solid var(--sys-color-divider-tertiary);
    border-radius: var(--sys-shape-shape1);
  }
  .whc-empty {
    padding: var(--sys-spacing-4) var(--sys-spacing-3);
    color: var(--sys-color-surface-paper-hint);
  }
  .whc-foot {
    display: flex;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-3);
    border-top: 1px solid var(--sys-color-divider-secondary);
  }
  .whc-foot .whc-spacer {
    flex: 1 1 auto;
  }
  .whc-expand:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }
`

/**
 * Lets a user pick the layers to search and their fields, starting from a profile or their My setup.
 * Nothing is saved until Done.
 */
export default function CustomisePanel (props: Props) {
  const { jimuMapView, start, translate } = props
  const view = jimuMapView?.view

  // Every queryable layer in the map that ExB tracks (so it has a data source), turned off or not.
  const choices = React.useMemo<Choice[]>(() => {
    if (!view?.map) return []
    const all = collectTargets(view.map, view.scale, true)
      .map(target => ({ ...target, dataSourceId: jimuMapView.getDataSourceIdByAPILayer(target.layer) }))
      .filter(target => target.dataSourceId)
    if (props.pool !== 'profiles') return all
    const allowed = new Set(props.profiles.flatMap(profile => Array.from(profile.layers ?? []).map(l => l.dataSourceId)))
    // Profiles that search every visible layer name none; then any layer is fair game.
    return allowed.size ? all.filter(target => allowed.has(target.dataSourceId)) : all
  }, [view, jimuMapView, props.pool, props.profiles])

  // The draft: chosen layers in map order, each with its fields. A profile of "all visible layers" starts with those ticked.
  const [draft, setDraft] = React.useState<ProfileLayer[]>(() => {
    if (start.layerScope === 'chosen') {
      return Array.from(start.layers ?? []).map(l => ({ dataSourceId: l.dataSourceId, fields: Array.from(l.fields ?? []) }))
    }
    if (!view?.map) return []
    const visible = new Set(collectTargets(view.map, view.scale).map(t => t.layer))
    return choices.filter(c => visible.has(c.layer)).map(c => ({ dataSourceId: c.dataSourceId, fields: [] }))
  })
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [, setLoadedTick] = React.useState(0)

  const entryFor = (dataSourceId: string) => draft.find(l => l.dataSourceId === dataSourceId)
  const toggle = (choice: Choice) => {
    const on = !!entryFor(choice.dataSourceId)
    // Keep the map's order; layers chosen before but not listed now (not in this map today, or outside the pool)
    // are kept at the end rather than lost.
    const listed = new Set(choices.map(c => c.dataSourceId))
    setDraft([
      ...choices
        .filter(c => c.dataSourceId === choice.dataSourceId ? !on : !!entryFor(c.dataSourceId))
        .map(c => entryFor(c.dataSourceId) ?? { dataSourceId: c.dataSourceId, fields: [] }),
      ...draft.filter(l => !listed.has(l.dataSourceId))
    ])
  }
  const setFields = (dataSourceId: string, fields: string[]) => {
    setDraft(current => current.map(l => l.dataSourceId === dataSourceId ? { ...l, fields } : l))
  }

  // Sublayers and unloaded layers only know their fields once loaded.
  const expand = (choice: Choice) => {
    const open = expanded === choice.dataSourceId
    setExpanded(open ? null : choice.dataSourceId)
    if (!open && !choice.layer?.loaded && typeof choice.layer?.load === 'function') {
      void choice.layer.load().then(() => { setLoadedTick(t => t + 1) }).catch(() => null)
    }
  }

  return (
    <div css={style} className='whats-here-customise'>
      <div className='whc-head'>
        <Button size='sm' type='tertiary' icon aria-label={translate('whCustomiseBack')} title={translate('whCustomiseBack')}
          onClick={props.onCancel}>
          <LeftOutlined size={16} />
        </Button>
        <span className='whc-titles'>
          <span className='whc-title'>{translate('whCustomiseTitle')}</span>
          <span className='whc-sub'>{translate('whCustomiseFrom', { profile: props.startLabel })}</span>
        </span>
      </div>
      <div className='whc-hint'>{translate('whCustomiseHint')}</div>

      <div className='whc-list'>
        {!choices.length && <div className='whc-empty'>{translate('whCustomiseNoLayers')}</div>}
        {choices.map(choice => {
          const entry = entryFor(choice.dataSourceId)
          const open = expanded === choice.dataSourceId && !!entry
          const fields = layerFields(choice.layer)
          const chosen = entry?.fields ? Array.from(entry.fields) : []
          const aliases = chosen.map(name => fields.find(f => f.name === name)?.alias ?? name)
          const meta = !entry
            ? translate('whCustomiseLayerOff')
            : [choice.parentTitle, aliases.length ? aliases.join(', ') : translate('whsUsePopupFields')].filter(Boolean).join(' · ')
          return (
            <div key={choice.dataSourceId} className={classNames('whc-layer', { 'is-off': !entry })}>
              <div className='whc-row'>
                <Checkbox checked={!!entry} aria-label={translate('whCustomiseSearchLayer', { layer: choice.title })}
                  onChange={() => { toggle(choice) }} />
                <button type='button' className='whc-expand' disabled={!entry} aria-expanded={open}
                  aria-label={translate(open ? 'whCustomiseHideFields' : 'whCustomiseShowFields', { layer: choice.title })}
                  onClick={() => { expand(choice) }}>
                  <span className='whc-names'>
                    <span className='whc-name' title={choice.title}>{choice.title}</span>
                    <span className='whc-meta'>{meta}</span>
                  </span>
                  {entry && (open ? <DownOutlined size={12} /> : <RightOutlined size={12} />)}
                </button>
              </div>
              {open && (
                <div className='whc-fields'>
                  {fields.length
                    ? (
                      <FieldPicker
                        fields={fields}
                        popupFields={popupFields(choice.layer)}
                        chosen={chosen}
                        hint={translate('whFieldsHintRuntime')}
                        emptyHint={translate('whFieldsPopupHintRuntime')}
                        firstTag={translate('whsRowTag')}
                        translate={translate}
                        onChange={next => { setFields(choice.dataSourceId, next) }}
                      />
                      )
                    : <div className='whc-empty'>{translate('whCustomiseLoading')}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className='whc-foot'>
        <Button size='sm' type='default' onClick={props.onReset}>{translate('whCustomiseReset')}</Button>
        <span className='whc-spacer' />
        <Button size='sm' type='primary' onClick={() => { props.onDone(draft) }}>{translate('whCustomiseDone')}</Button>
      </div>
    </div>
  )
}
