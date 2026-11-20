import { React, css } from 'jimu-core'
import { Label, Loading, LoadingType, Radio, Switch, TextInput } from 'jimu-ui'
import { SettingRow } from 'jimu-ui/advanced/setting-components'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'
import type { LayerScope, Profile, ProfileLayer } from '../config'
import FieldPicker from '../components/field-picker'
import LayerPicker from './layer-picker'
import { defaultFields } from '../runtime/utils'
import { GEOMETRY_KEYS, type MapLayer } from './map-layers'

interface Props {
  widgetId: string
  profile: Profile
  hasMap: boolean
  mapLayers: MapLayer[]
  loading: boolean
  translate: (id: string, values?: any) => string
  onChange: (profile: Profile) => void
}

const style = css`
  .whs-hint {
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--sys-color-surface-paper-hint);
  }
  .whs-group {
    border-bottom: 1px solid var(--sys-color-divider-secondary);
  }
  .whs-group-head {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-3) var(--sys-spacing-4);
    border: 0;
    background: transparent;
    color: inherit;
    font-weight: 600;
    text-align: start;
    cursor: pointer;
  }
  .whs-group-summary {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-width: 0;
    font-weight: 400;
    color: var(--sys-color-surface-paper-hint);
  }
  .whs-group-summary span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whs-group-body {
    padding: 0 var(--sys-spacing-4) var(--sys-spacing-3);
  }
  .whs-segment {
    display: flex;
    width: 100%;
    padding: 2px;
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-action-hover);
  }
  .whs-segment button {
    flex: 1 1 0;
    height: 28px;
    border: 0;
    border-radius: var(--sys-shape-shape1);
    background: transparent;
    color: var(--sys-color-surface-paper-hint);
    cursor: pointer;
  }
  .whs-segment button.is-active {
    background: var(--sys-color-surface-paper);
    color: var(--sys-color-surface-paper-text);
    font-weight: 600;
    box-shadow: 0 0 0 1px var(--sys-color-divider-secondary);
  }
  .whs-box {
    width: 100%;
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
  }
  .whs-box-head {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-2);
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .whs-box-titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .whs-box-title {
    font-weight: 600;
  }
  .whs-box-sub {
    font-size: 0.6875rem;
    color: var(--sys-color-surface-paper-hint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whs-layers {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-1);
    width: 100%;
  }
  .whs-layer.is-excluded .whs-box-title {
    color: var(--sys-color-surface-paper-hint);
    font-weight: 400;
  }
  .whs-layer-head {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding-left: var(--sys-spacing-2);
  }
  .whs-fields {
    border-top: 1px solid var(--sys-color-divider-tertiary);
  }
  .whs-group-head:focus-visible,
  .whs-box-head:focus-visible,
  .whs-segment button:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }
`

/** A section of the editor that opens and closes, with a one-line summary for when it is closed. */
const Group = (props: { title: string, summary: string, open: boolean, onToggle: () => void, children: React.ReactNode }) => (
  <div className='whs-group'>
    <button type='button' className='whs-group-head' aria-expanded={props.open} onClick={props.onToggle}>
      <span>{props.title}</span>
      <span className='whs-group-summary'>
        <span>{props.summary}</span>
        {props.open ? <DownOutlined size={12} /> : <RightOutlined size={12} />}
      </span>
    </button>
    {props.open && <div className='whs-group-body'>{props.children}</div>}
  </div>
)

/** Everything one profile sets: its name, and which layers and fields to report on. */
export default function ProfileEditor (props: Props) {
  const { profile, mapLayers, translate } = props
  const [layersOpen, setLayersOpen] = React.useState(true)
  const [expandedLayer, setExpandedLayer] = React.useState<string | null>(null)

  const update = (patch: Partial<Profile>) => {
    // Profiles from 1.6 also held where to search; that now lives in the widget settings.
    const next: Profile = { ...profile, ...patch }
    delete next.searchBy
    delete next.area
    props.onChange(next)
  }

  // ---------- layers ----------
  const profileLayers: ProfileLayer[] = profile.layers ? Array.from(profile.layers) : []
  const entryFor = (dataSourceId: string) => profileLayers.find(l => l.dataSourceId === dataSourceId)
  const toggleLayer = (layer: MapLayer) => {
    const included = !!entryFor(layer.dataSourceId)
    // Keep the map's layer order; entries for layers no longer listed are kept at the end.
    const known = new Set(mapLayers.map(l => l.dataSourceId))
    const next = mapLayers
      .filter(l => l.dataSourceId === layer.dataSourceId ? !included : !!entryFor(l.dataSourceId))
      // A newly ticked layer starts with its pop-up fields (or its first few), so it never looks empty.
      .map(l => entryFor(l.dataSourceId) ?? { dataSourceId: l.dataSourceId, rootDataSourceId: l.rootDataSourceId, fields: defaultFields(l.fields, l.popupFields) })
    update({ layers: [...next, ...profileLayers.filter(l => !known.has(l.dataSourceId))] })
  }
  const setLayerFields = (dataSourceId: string, fields: string[]) => {
    update({ layers: profileLayers.map(l => l.dataSourceId === dataSourceId ? { ...l, fields } : l) })
  }

  const scope: LayerScope = profile.layerScope ?? 'all'
  const layersSummary = scope === 'all'
    ? translate('whsScopeAllShort')
    : translate('whsLayerCount', { count: profileLayers.length })

  const renderLayers = () => {
    if (!props.hasMap) return <div className='whs-hint'>{translate('whsAreaNeedsMap')}</div>
    if (props.loading) return <div style={{ position: 'relative', height: 32 }}><Loading type={LoadingType.Donut} width={20} height={20} /></div>
    if (!mapLayers.length) return <div className='whs-hint'>{translate('whsNoLayers')}</div>
    return (
      <LayerPicker
        layers={mapLayers}
        isTicked={layer => !!entryFor(layer.dataSourceId)}
        onToggle={toggleLayer}
        translate={translate}
        renderName={(layer, ticked) => {
          const entry = entryFor(layer.dataSourceId)
          const expanded = expandedLayer === layer.dataSourceId && ticked
          const fieldCount = entry?.fields?.length
          const meta = [
            translate(GEOMETRY_KEYS[layer.geometryType] ?? 'whsGeomOther'),
            ticked ? (fieldCount ? translate('whsFieldCount', { count: fieldCount }) : translate('whsPopupFields')) : null
          ].filter(Boolean).join(' · ')
          return (
            <button type='button' className='whs-box-head' disabled={!ticked} aria-expanded={expanded}
              aria-label={translate(expanded ? 'whsHideFields' : 'whsShowFields', { layer: layer.label })}
              onClick={() => { setExpandedLayer(expanded ? null : layer.dataSourceId) }}>
              <span className='whs-box-titles'>
                <span className='whs-box-title' title={layer.label}>{layer.label}</span>
                <span className='whs-box-sub'>{meta}</span>
              </span>
              {ticked && (expanded ? <DownOutlined size={12} /> : <RightOutlined size={12} />)}
            </button>
          )
        }}
        renderBelow={(layer, ticked) => {
          const entry = entryFor(layer.dataSourceId)
          if (!ticked || expandedLayer !== layer.dataSourceId || !entry) return null
          return (
            <FieldPicker
              fields={layer.fields}
              popupFields={layer.popupFields}
              chosen={entry.fields ? Array.from(entry.fields) : []}
              hint={translate('whsFieldsHint')}
              emptyHint={translate('whsFieldsPopupHint')}
              firstTag={translate('whsRowTag')}
              translate={translate}
              onChange={fields => { setLayerFields(layer.dataSourceId, fields) }}
            />
          )
        }}
      />
    )
  }

  return (
    <div css={style} className='whats-here-profile-editor'>
      <div className='whs-group' style={{ padding: 'var(--sys-spacing-3) var(--sys-spacing-4)' }}>
        <SettingRow flow='wrap' label={translate('whsProfileName')}>
          <TextInput size='sm' className='w-100' value={profile.label} aria-label={translate('whsProfileName')}
            onChange={e => { update({ label: e.target.value }) }} />
        </SettingRow>
      </div>

      <Group title={translate('whsLayersToSearch')} summary={layersSummary} open={layersOpen}
        onToggle={() => { setLayersOpen(o => !o) }}>
        <SettingRow flow='wrap' role='radiogroup' aria-label={translate('whsLayersToSearch')}>
          {(['all', 'chosen'] as LayerScope[]).map(option => (
            <Label key={option} className='d-flex align-items-center w-100 mb-1' style={{ gap: 6 }}>
              <Radio name={`whs-scope-${props.widgetId}-${profile.id}`} checked={scope === option}
                onChange={() => { update({ layerScope: option }) }} />
              {translate(option === 'all' ? 'whsScopeAll' : 'whsScopeChosen')}
            </Label>
          ))}
        </SettingRow>
        {scope === 'chosen' && (
          <>
            <SettingRow flow='wrap'>{renderLayers()}</SettingRow>
            <SettingRow label={translate('whsIncludeHidden')}>
              <Switch checked={!!profile.includeHiddenLayers} aria-label={translate('whsIncludeHidden')}
                onChange={e => { update({ includeHiddenLayers: e.target.checked }) }} />
            </SettingRow>
          </>
        )}
      </Group>
    </div>
  )
}
