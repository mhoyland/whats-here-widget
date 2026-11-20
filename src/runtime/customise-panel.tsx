import { React, css, classNames } from 'jimu-core'
import type { JimuMapView } from 'jimu-arcgis'
import { Button, Checkbox, TextInput } from 'jimu-ui'
import { LeftOutlined } from 'jimu-icons/outlined/directional/left'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'
import type { Profile, ProfileLayer } from '../config'
import FieldPicker, { type MapLayerField } from '../components/field-picker'
import { collectTargets } from './query'
import { defaultFields } from './utils'

interface Props {
  jimuMapView: JimuMapView
  /** What the user starts from: their My setup, or the profile they are on. */
  start: Profile
  startLabel: string
  /** 'profiles' limits the choice to layers named in the app's profiles. */
  pool: 'map' | 'profiles'
  profiles: Profile[]
  /** Layers the app's designer hid from Customise (data source ids). */
  exclude: string[]
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
  .map((f: any) => ({ name: f.name, alias: f.alias || f.name, type: f.type }))

// Long lists get a filter box.
const FILTER_ABOVE = 12

/** Consecutive layers under the same group or service, in layer-list order; top-level layers have no title. */
interface Section {
  title: string
  choices: Choice[]
}

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
  .whc-filter {
    padding: var(--sys-spacing-2) var(--sys-spacing-3) 0;
  }
  .whc-group-head {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 40px;
    padding: 0 var(--sys-spacing-3);
    border-bottom: 1px solid var(--sys-color-divider-tertiary);
    background: color-mix(in srgb, var(--sys-color-action-hover) 50%, var(--sys-color-surface-paper));
  }
  .whc-group-toggle {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-1) 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .whc-group-name {
    flex: 1 1 auto;
    min-width: 0;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whc-group-count {
    flex: 0 0 auto;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .whc-layer.is-child .whc-row {
    padding-left: calc(var(--sys-spacing-3) + 20px);
  }
  .whc-layer.is-child .whc-fields {
    margin-left: calc(36px + 20px);
  }
  .whc-off-note {
    font-style: italic;
  }
  .whc-group-toggle:focus-visible,
  .whc-expand:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }
`

/**
 * Lets a user pick the layers to search and their fields, starting from a profile or their My setup.
 * Layers are listed and grouped as in the map's layer list. Nothing is saved until Done.
 */
export default function CustomisePanel (props: Props) {
  const { jimuMapView, start, translate } = props
  const view = jimuMapView?.view

  // Every queryable layer in the map that ExB tracks (so it has a data source), turned off or not,
  // less the layers the designer excluded.
  const choices = React.useMemo<Choice[]>(() => {
    if (!view?.map) return []
    const excluded = new Set(props.exclude)
    const all = collectTargets(view.map, view.scale, true)
      .map(target => ({ ...target, dataSourceId: jimuMapView.getDataSourceIdByAPILayer(target.layer) }))
      .filter(target => target.dataSourceId && !excluded.has(target.dataSourceId))
    if (props.pool !== 'profiles') return all
    const allowed = new Set(props.profiles.flatMap(profile => Array.from(profile.layers ?? []).map(l => l.dataSourceId)))
    // Profiles that search every visible layer name none; then any layer is fair game.
    return allowed.size ? all.filter(target => allowed.has(target.dataSourceId)) : all
  }, [view, jimuMapView, props.pool, props.profiles, props.exclude])

  // Layers the map is currently showing; the others are noted as turned off.
  const visibleLayers = React.useMemo(() => new Set(view?.map ? collectTargets(view.map, view.scale).map(t => t.layer) : []), [view])

  // The draft: chosen layers in map order, each with its fields. A profile of "all visible layers" starts with those ticked.
  const [draft, setDraft] = React.useState<ProfileLayer[]>(() => {
    if (start.layerScope === 'chosen') {
      return Array.from(start.layers ?? []).map(l => ({ dataSourceId: l.dataSourceId, fields: Array.from(l.fields ?? []) }))
    }
    return choices.filter(c => visibleLayers.has(c.layer)).map(c => ({ dataSourceId: c.dataSourceId, fields: [] }))
  })
  const [expanded, setExpanded] = React.useState<string | null>(null)
  const [closedGroups, setClosedGroups] = React.useState<{ [title: string]: boolean }>({})
  const [filter, setFilter] = React.useState('')
  const [, setLoadedTick] = React.useState(0)

  const entryFor = (dataSourceId: string) => draft.find(l => l.dataSourceId === dataSourceId)

  /** The starting fields for a newly ticked layer: its pop-up fields, or its first few. */
  const startingFields = (choice: Choice) => defaultFields(layerFields(choice.layer), popupFields(choice.layer))

  /** Sublayers and unloaded layers only know their fields once loaded; fill in defaults then if still empty. */
  const whenLoaded = (picked: Choice[]) => {
    picked.filter(c => !c.layer?.loaded && typeof c.layer?.load === 'function').forEach(choice => {
      void choice.layer.load().then(() => {
        setDraft(current => current.map(l => l.dataSourceId === choice.dataSourceId && !l.fields?.length
          ? { ...l, fields: startingFields(choice) }
          : l))
        setLoadedTick(t => t + 1)
      }).catch(() => null)
    })
  }

  /** Ticks (or unticks) several layers at once, keeping the map's order and any chosen layers not listed now. */
  const setTicked = (changed: Choice[], on: boolean) => {
    const ids = new Set(changed.map(c => c.dataSourceId))
    const listed = new Set(choices.map(c => c.dataSourceId))
    setDraft([
      ...choices
        .filter(c => ids.has(c.dataSourceId) ? on : !!entryFor(c.dataSourceId))
        .map(c => entryFor(c.dataSourceId) ?? { dataSourceId: c.dataSourceId, fields: startingFields(c) }),
      ...draft.filter(l => !listed.has(l.dataSourceId))
    ])
    if (on) whenLoaded(changed.filter(c => !entryFor(c.dataSourceId)))
  }
  const setFields = (dataSourceId: string, fields: string[]) => {
    setDraft(current => current.map(l => l.dataSourceId === dataSourceId ? { ...l, fields } : l))
  }

  const expand = (choice: Choice) => {
    const open = expanded === choice.dataSourceId
    setExpanded(open ? null : choice.dataSourceId)
    if (!open) whenLoaded([choice])
  }

  // Filtering matches layer and group names; groups with matches open by themselves.
  const term = filter.trim().toLowerCase()
  const shown = term
    ? choices.filter(c => c.title?.toLowerCase().includes(term) || c.parentTitle?.toLowerCase().includes(term))
    : choices
  const sections: Section[] = []
  shown.forEach(choice => {
    const title = choice.parentTitle ?? ''
    const last = sections[sections.length - 1]
    if (last && last.title === title) last.choices.push(choice)
    else sections.push({ title, choices: [choice] })
  })

  const renderChoice = (choice: Choice, child: boolean) => {
    const entry = entryFor(choice.dataSourceId)
    const open = expanded === choice.dataSourceId && !!entry
    const fields = layerFields(choice.layer)
    const chosen = entry?.fields ? Array.from(entry.fields) : []
    const aliases = chosen.map(name => fields.find(f => f.name === name)?.alias ?? name)
    const turnedOff = !visibleLayers.has(choice.layer)
    const meta = !entry
      ? translate('whCustomiseLayerOff')
      : aliases.length ? aliases.join(', ') : translate('whsUsePopupFields')
    return (
      <div key={choice.dataSourceId} className={classNames('whc-layer', { 'is-off': !entry, 'is-child': child })}>
        <div className='whc-row'>
          <Checkbox checked={!!entry} aria-label={translate('whCustomiseSearchLayer', { layer: choice.title })}
            onChange={() => { setTicked([choice], !entry) }} />
          <button type='button' className='whc-expand' disabled={!entry} aria-expanded={open}
            aria-label={translate(open ? 'whCustomiseHideFields' : 'whCustomiseShowFields', { layer: choice.title })}
            onClick={() => { expand(choice) }}>
            <span className='whc-names'>
              <span className='whc-name' title={choice.title}>{choice.title}</span>
              <span className='whc-meta'>
                {turnedOff && <span className='whc-off-note'>{translate('whCustomiseTurnedOff')} · </span>}
                {meta}
              </span>
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
  }

  const renderSection = (section: Section, index: number) => {
    if (!section.title) return section.choices.map(choice => renderChoice(choice, false))
    // The same group can appear more than once if its layers are not next to each other; each gets its own key.
    const key = `${section.title}-${index}`
    const open = !!term || !closedGroups[section.title]
    const tickedCount = section.choices.filter(c => entryFor(c.dataSourceId)).length
    const all = tickedCount === section.choices.length
    return (
      <div key={key} className='whc-group'>
        <div className='whc-group-head'>
          <Checkbox checked={all} indeterminate={tickedCount > 0 && !all}
            aria-label={translate('whCustomiseGroupTick', { group: section.title })}
            onChange={() => { setTicked(section.choices, !all) }} />
          <button type='button' className='whc-group-toggle' aria-expanded={open}
            onClick={() => { setClosedGroups(current => ({ ...current, [section.title]: open })) }}>
            {open ? <DownOutlined size={12} /> : <RightOutlined size={12} />}
            <span className='whc-group-name' title={section.title}>{section.title}</span>
            <span className='whc-group-count'>{translate('whsTickedOf', { ticked: tickedCount, total: section.choices.length })}</span>
          </button>
        </div>
        {open && section.choices.map(choice => renderChoice(choice, true))}
      </div>
    )
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
      {choices.length > FILTER_ABOVE && (
        <div className='whc-filter'>
          <TextInput size='sm' value={filter} allowClear placeholder={translate('whsFilterLayers')} aria-label={translate('whsFilterLayers')}
            onChange={e => { setFilter(e.target.value) }} />
        </div>
      )}

      <div className='whc-list'>
        {!choices.length && <div className='whc-empty'>{translate('whCustomiseNoLayers')}</div>}
        {choices.length > 0 && !shown.length && <div className='whc-empty'>{translate('whsNoLayerMatches')}</div>}
        {sections.map(renderSection)}
      </div>

      <div className='whc-foot'>
        <Button size='sm' type='default' onClick={props.onReset}>{translate('whCustomiseReset')}</Button>
        <span className='whc-spacer' />
        <Button size='sm' type='primary' onClick={() => { props.onDone(draft) }}>{translate('whCustomiseDone')}</Button>
      </div>
    </div>
  )
}
