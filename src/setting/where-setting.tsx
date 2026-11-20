import { React, css, classNames } from 'jimu-core'
import { AlertPopup, Button, Checkbox, Dropdown, DropdownButton, DropdownItem, DropdownMenu, Label, Loading, LoadingType, NumericInput, Option, Radio, Select, Switch } from 'jimu-ui'
import { SettingRow, SettingSection, SidePopper } from 'jimu-ui/advanced/setting-components'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'
import { StarFilled } from 'jimu-icons/filled/application/star'
import { StarOutlined } from 'jimu-icons/outlined/application/star'
import { MoreHorizontalOutlined } from 'jimu-icons/outlined/application/more-horizontal'
import {
  DRAW_TOOLS, WHERE_MODES,
  type AreaLayer, type AreaRelationship, type Config, type DrawTool, type MultipleAreas, type WhereMode
} from '../config'
import { type WhereSettings, defaultFields } from '../runtime/utils'
import FieldPicker from '../components/field-picker'
import { type MapLayer, isPolygonLayer } from './map-layers'
import LayerPicker from './layer-picker'

interface Props {
  widgetId: string
  config: Config
  /** The settings in effect, with apps saved before 1.7 carried over. */
  where: WhereSettings
  hasMap: boolean
  mapLayers: MapLayer[]
  loading: boolean
  translate: (id: string, values?: any) => string
  /** Writes the where settings; the caller fills in every where field so old apps become explicit. */
  onChange: (patch: Partial<Config>) => void
}

const MODE_KEYS: { [mode in WhereMode]: string } = { point: 'whsWherePoint', draw: 'whsWhereDraw', feature: 'whsWhereFeature' }
const TOOL_KEYS: { [tool in DrawTool]: string } = { polygon: 'whsToolPolygon', rectangle: 'whsToolRectangle', freehand: 'whsToolFreehand' }

const style = css`
  .whs-hint {
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--sys-color-surface-paper-hint);
  }
  .whs-rows {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-1);
    width: 100%;
  }
  .whs-way {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 32px;
    padding: 0 var(--sys-spacing-2);
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
  }
  .whs-way-label {
    flex: 1 1 auto;
    margin: 0;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    cursor: pointer;
  }
  .whs-way-default {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .whs-tools {
    display: flex;
    flex-wrap: wrap;
    gap: var(--sys-spacing-1) var(--sys-spacing-3);
  }
  .whs-tools label {
    display: flex;
    align-items: center;
    gap: 4px;
    margin: 0;
  }
  .whs-box {
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
  }
  .whs-box.is-off .whs-box-title {
    color: var(--sys-color-surface-paper-hint);
    font-weight: 400;
  }
  .whs-box-row {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    padding-left: var(--sys-spacing-2);
  }
  .whs-box-head {
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
  .whs-box-titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .whs-box-title {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whs-box-sub {
    font-size: 0.6875rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .whs-star.is-default {
    color: var(--sys-color-warning-main);
  }
  .whs-fields {
    border-top: 1px solid var(--sys-color-divider-tertiary);
  }
  .whs-buffers {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 96px;
    gap: var(--sys-spacing-2) var(--sys-spacing-3);
    align-items: center;
    width: 100%;
  }
  .whs-box-head:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }
`

// The side panel renders outside this section, so it carries its own styles.
const panelStyle = css`
  display: flex;
  flex-direction: column;
  gap: var(--sys-spacing-3);
  padding: var(--sys-spacing-3) var(--sys-spacing-4);

  .whs-hint {
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--sys-color-surface-paper-hint);
  }
  .whs-star.is-default {
    flex: 0 0 auto;
    color: var(--sys-color-warning-main);
  }
  .whs-fields {
    border: 1px solid var(--sys-color-divider-tertiary);
    border-radius: var(--sys-shape-shape1);
  }
`

/** Design-time "where" settings: the ways offered, the feature layers and the default buffers. */
export default function WhereSetting (props: Props) {
  const { config, where, mapLayers, translate, onChange } = props
  // The side panel shows either the layer chooser or one layer's fields.
  const [panel, setPanel] = React.useState<'choose' | { fieldsOf: string } | null>(null)
  const [focusNode, setFocusNode] = React.useState<HTMLElement | null>(null)
  const sectionRef = React.useRef<HTMLDivElement>(null)
  // Removing cannot be undone, so it is confirmed first.
  const [pendingRemove, setPendingRemove] = React.useState<string | null>(null)
  const openPanel = (next: 'choose' | { fieldsOf: string }, from?: HTMLElement) => {
    setFocusNode(from ?? null)
    setPanel(next)
  }

  // The ways ticked, even "feature" with no layers yet (the widget then leaves it out).
  const offered: WhereMode[] = config.whereModes ? Array.from(config.whereModes) : WHERE_MODES
  const tools: DrawTool[] = where.drawTools
  const areaLayers = where.areaLayers
  const polygonLayers = mapLayers.filter(isPolygonLayer)

  const toggleMode = (mode: WhereMode) => {
    const next = offered.includes(mode) ? offered.filter(m => m !== mode) : WHERE_MODES.filter(m => m === mode || offered.includes(m))
    // At least one way must stay offered.
    if (next.length) onChange({ whereModes: next })
  }

  const toggleTool = (tool: DrawTool) => {
    const next = tools.includes(tool) ? tools.filter(t => t !== tool) : DRAW_TOOLS.filter(t => t === tool || tools.includes(t))
    if (next.length) onChange({ drawTools: next })
  }

  const entryFor = (dataSourceId: string) => areaLayers.find(l => l.dataSourceId === dataSourceId)
  const toggleLayer = (layer: MapLayer) => {
    const on = !!entryFor(layer.dataSourceId)
    // Keep the map's layer order; entries for layers no longer listed are kept at the end.
    const known = new Set(mapLayers.map(l => l.dataSourceId))
    const next: AreaLayer[] = [
      ...polygonLayers
        .filter(l => l.dataSourceId === layer.dataSourceId ? !on : !!entryFor(l.dataSourceId))
        // A newly ticked layer starts with its pop-up fields (or its first few).
        .map(l => entryFor(l.dataSourceId) ?? { dataSourceId: l.dataSourceId, rootDataSourceId: l.rootDataSourceId, fields: defaultFields(l.fields, l.popupFields) }),
      ...areaLayers.filter(l => !known.has(l.dataSourceId))
    ]
    onChange({ areaLayers: next })
  }
  const setLayerFields = (dataSourceId: string, fields: string[]) => {
    onChange({ areaLayers: areaLayers.map(l => l.dataSourceId === dataSourceId ? { ...l, fields } : l) })
  }

  const removeLayer = (dataSourceId: string) => {
    onChange({ areaLayers: areaLayers.filter(l => l.dataSourceId !== dataSourceId) })
    if (panel !== 'choose' && panel?.fieldsOf === dataSourceId) setPanel(null)
  }
  const layerFor = (dataSourceId: string) => polygonLayers.find(l => l.dataSourceId === dataSourceId)

  /** Only the offered layers: short rows that open their fields, with a default star and a menu. */
  const renderOffered = () => {
    if (!props.hasMap) return <div className='whs-hint'>{translate('whsAreaNeedsMap')}</div>
    if (props.loading) return <div style={{ position: 'relative', height: 32 }}><Loading type={LoadingType.Donut} width={20} height={20} /></div>
    if (!polygonLayers.length) return <div className='whs-hint'>{translate('whsNoPolygonLayers')}</div>
    return (
      <div className='whs-rows'>
        {areaLayers.map(entry => {
          const layer = layerFor(entry.dataSourceId)
          const label = layer?.label ?? translate('whsLayerNotInMap')
          const isDefault = where.defaultAreaLayerId === entry.dataSourceId
          const fieldCount = entry.fields?.length
          const meta = [
            isDefault ? translate('whsDefault') : '',
            layer?.parentLabel,
            fieldCount ? translate('whsFieldCount', { count: fieldCount }) : translate('whsPopupFields')
          ].filter(Boolean).join(' · ')
          return (
            <div key={entry.dataSourceId} className={classNames('whs-box', { 'is-off': !layer })}>
              <div className='whs-box-row'>
                <button type='button' className='whs-box-head' disabled={!layer}
                  aria-label={translate('whsEditFieldsFor', { layer: label })}
                  onClick={e => { openPanel({ fieldsOf: entry.dataSourceId }, e.currentTarget) }}>
                  <span className='whs-box-titles'>
                    <span className='whs-box-title' title={label}>{label}</span>
                    <span className='whs-box-sub'>{meta}</span>
                  </span>
                  {layer && <RightOutlined size={12} />}
                </button>
                <Button size='sm' type='tertiary' icon
                  className={classNames('whs-star', { 'is-default': isDefault })}
                  aria-pressed={isDefault}
                  title={translate('whsMakeDefaultLayer', { layer: label })}
                  aria-label={translate('whsMakeDefaultLayer', { layer: label })}
                  onClick={() => { onChange({ defaultAreaLayerId: entry.dataSourceId }) }}>
                  {isDefault ? <StarFilled size={14} /> : <StarOutlined size={14} />}
                </Button>
                <Dropdown activeIcon>
                  <DropdownButton size='sm' type='tertiary' icon arrow={false}
                    aria-label={translate('whsMoreForLayer', { layer: label })} title={translate('whsMoreForLayer', { layer: label })}>
                    <MoreHorizontalOutlined size={14} />
                  </DropdownButton>
                  <DropdownMenu>
                    <DropdownItem disabled={!layer} onClick={() => { openPanel({ fieldsOf: entry.dataSourceId }) }}>{translate('whsEditFields')}</DropdownItem>
                    <DropdownItem disabled={isDefault} onClick={() => { onChange({ defaultAreaLayerId: entry.dataSourceId }) }}>{translate('whsMakeDefault')}</DropdownItem>
                    <DropdownItem onClick={() => { setPendingRemove(entry.dataSourceId) }}>{translate('whsRemove')}</DropdownItem>
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const fieldsLayer = panel && panel !== 'choose' ? layerFor(panel.fieldsOf) : null
  const fieldsEntry = fieldsLayer ? entryFor(fieldsLayer.dataSourceId) : null

  return (
    <div css={style}>
      <SettingSection title={translate('whsWhere')}>
        <SettingRow><div className='whs-hint'>{translate('whsWhereHint')}</div></SettingRow>
        <SettingRow flow='wrap'>
          <div className='whs-rows'>
            {WHERE_MODES.map(mode => {
              const on = offered.includes(mode)
              return (
                <div key={mode} className='whs-way'>
                  <Label className='whs-way-label'>
                    <Checkbox checked={on} onChange={() => { toggleMode(mode) }} />
                    {translate(MODE_KEYS[mode])}
                  </Label>
                  <Label className='whs-way-default'>
                    <Radio name={`whs-default-where-${props.widgetId}`} checked={on && where.defaultMode === mode} disabled={!on}
                      onChange={() => { onChange({ defaultWhere: mode }) }} />
                    {translate('whsDefault')}
                  </Label>
                </div>
              )
            })}
          </div>
        </SettingRow>
        {offered.includes('draw') && (
          <SettingRow flow='wrap' label={translate('whsDrawTools')}>
            <div className='whs-tools'>
              {DRAW_TOOLS.map(tool => (
                <Label key={tool}>
                  <Checkbox checked={tools.includes(tool)} onChange={() => { toggleTool(tool) }} />
                  {translate(TOOL_KEYS[tool])}
                </Label>
              ))}
            </div>
          </SettingRow>
        )}
      </SettingSection>

      {offered.includes('feature') && (
        <div ref={sectionRef}>
        <SettingSection title={translate('whsFeatureLayers')}>
          <SettingRow>
            <div className='whs-hint'>
              {translate('whsFeatureLayersHint')} {polygonLayers.length > 0 && translate('whsOfferedOf', { offered: areaLayers.length, total: polygonLayers.length })}
            </div>
          </SettingRow>
          <SettingRow flow='wrap'>{renderOffered()}</SettingRow>
          {!props.loading && props.hasMap && !areaLayers.length && (
            <SettingRow><div className='whs-hint'>{translate('whsNoFeatureLayers')}</div></SettingRow>
          )}
          {props.hasMap && polygonLayers.length > 0 && (
            <SettingRow>
              <Button size='sm' type='default' className='w-100' onClick={e => { openPanel('choose', e.currentTarget) }}>
                {translate('whsChooseFeatureLayers')}
              </Button>
            </SettingRow>
          )}
          <SettingRow flow='wrap' label={translate('whsRelationship')}>
            <Select size='sm' value={config.relationship ?? 'intersects'} aria-label={translate('whsRelationship')}
              onChange={e => { onChange({ relationship: e.target.value as AreaRelationship }) }}>
              <Option value='intersects'>{translate('whsRelIntersects')}</Option>
              <Option value='inside'>{translate('whsRelInside')}</Option>
            </Select>
          </SettingRow>
          <SettingRow flow='wrap' label={translate('whsMultipleAreas')}>
            <Select size='sm' value={config.multipleAreas ?? 'first'} aria-label={translate('whsMultipleAreas')}
              onChange={e => { onChange({ multipleAreas: e.target.value as MultipleAreas }) }}>
              <Option value='first'>{translate('whsMultipleFirst')}</Option>
              <Option value='merge'>{translate('whsMultipleMerge')}</Option>
            </Select>
          </SettingRow>
          <SettingRow label={translate('whsExcludeAreaLayer')}>
            <Switch checked={config.excludeAreaLayer !== false} aria-label={translate('whsExcludeAreaLayer')}
              onChange={e => { onChange({ excludeAreaLayer: e.target.checked }) }} />
          </SettingRow>
        </SettingSection>
        </div>
      )}

      <AlertPopup
        severity='warning'
        withIcon
        isOpen={!!pendingRemove}
        title={translate('whsRemoveLayerTitle')}
        description={translate('whsRemoveLayerBody', { layer: pendingRemove ? (layerFor(pendingRemove)?.label ?? translate('whsLayerNotInMap')) : '' })}
        okLabel={translate('whsRemove')}
        onClickOk={() => {
          removeLayer(pendingRemove)
          setPendingRemove(null)
        }}
        toggle={() => { setPendingRemove(null) }}
      />

      <SidePopper
        position='right'
        isOpen={!!panel}
        toggle={() => { setPanel(null) }}
        trigger={sectionRef.current}
        backToFocusNode={focusNode}
        title={panel === 'choose' ? translate('whsFeatureLayers') : (fieldsLayer?.label ?? '')}
      >
        {panel === 'choose' && (
          <div className='whs-panel-body' css={panelStyle}>
            <div className='whs-hint'>{translate('whsChooseFeatureLayersHint')}</div>
            <LayerPicker
              layers={polygonLayers}
              isTicked={layer => !!entryFor(layer.dataSourceId)}
              onToggle={toggleLayer}
              tickLabel={layer => translate('whsOfferLayer', { layer: layer.label })}
              translate={translate}
              renderEnd={(layer, ticked) => ticked && where.defaultAreaLayerId === layer.dataSourceId
                ? <StarFilled size={14} className='whs-star is-default' title={translate('whsDefault')} />
                : null}
            />
          </div>
        )}
        {fieldsLayer && fieldsEntry && (
          <div className='whs-panel-body' css={panelStyle}>
            <FieldPicker
              fields={fieldsLayer.fields}
              popupFields={fieldsLayer.popupFields}
              chosen={fieldsEntry.fields ? Array.from(fieldsEntry.fields) : []}
              hint={translate('whsAreaFieldsHint')}
              emptyHint={translate('whsAreaFieldsPopupHint')}
              translate={translate}
              onChange={fields => { setLayerFields(fieldsLayer.dataSourceId, fields) }}
            />
          </div>
        )}
      </SidePopper>

      <SettingSection title={translate('whsBufferDefaults')}>
        <SettingRow flow='wrap'>
          <div className='whs-buffers'>
            {offered.includes('feature') && (
              <>
                <span>{translate('whsBufferFeature')}</span>
                <NumericInput size='sm' step={5} value={where.buffers.feature} aria-label={translate('whsBufferFeature')}
                  onChange={v => { onChange({ bufferFeature: Number.isFinite(Number(v)) ? Number(v) : 0 }) }} />
              </>
            )}
            {offered.includes('draw') && (
              <>
                <span>{translate('whsBufferDraw')}</span>
                <NumericInput size='sm' step={5} value={where.buffers.draw} aria-label={translate('whsBufferDraw')}
                  onChange={v => { onChange({ bufferDraw: Number.isFinite(Number(v)) ? Number(v) : 0 }) }} />
              </>
            )}
            {offered.includes('point') && (
              <>
                <span>{translate('whsBufferPoint')}</span>
                <NumericInput size='sm' step={5} min={0} value={where.buffers.point} aria-label={translate('whsBufferPoint')}
                  onChange={v => { onChange({ bufferPoint: Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0) }) }} />
              </>
            )}
          </div>
        </SettingRow>
        <SettingRow><div className='whs-hint'>{translate('whsBufferDefaultsHint')}</div></SettingRow>
        <SettingRow label={translate('whsAllowCustomBuffer')}>
          <Switch checked={where.allowCustomBuffer} aria-label={translate('whsAllowCustomBuffer')}
            onChange={e => { onChange({ allowCustomBuffer: e.target.checked }) }} />
        </SettingRow>
      </SettingSection>
    </div>
  )
}
