import { React, css, classNames } from 'jimu-core'
import { Checkbox, Label, Switch, TextInput } from 'jimu-ui'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { RightOutlined } from 'jimu-icons/outlined/directional/right'
import type { MapLayer } from './map-layers'

interface Props {
  layers: MapLayer[]
  isTicked: (layer: MapLayer) => boolean
  onToggle: (layer: MapLayer) => void
  /** Accessible name of a row's tick box; defaults to "Search {layer}". */
  tickLabel?: (layer: MapLayer) => string
  translate: (id: string, values?: any) => string
  /** The row's main content after the tick box; defaults to the layer name. */
  renderName?: (layer: MapLayer, ticked: boolean) => React.ReactNode
  /** Anything shown under a row, e.g. its field picker. */
  renderBelow?: (layer: MapLayer, ticked: boolean) => React.ReactNode
  /** Extra controls at the end of a row, e.g. a default star. */
  renderEnd?: (layer: MapLayer, ticked: boolean) => React.ReactNode
}

// Short lists start with every group open; long ones only open groups that already have ticked layers.
const OPEN_ALL_UP_TO = 12

const style = css`
  display: flex;
  flex-direction: column;
  gap: var(--sys-spacing-2);
  width: 100%;

  .whl-tools {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
  }
  .whl-only {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sys-spacing-2);
    margin: 0;
  }
  .whl-count {
    color: var(--sys-color-surface-paper-hint);
  }
  .whl-group-head {
    width: 100%;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 32px;
    padding: 0 var(--sys-spacing-1);
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .whl-group-name {
    flex: 1 1 auto;
    min-width: 0;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whl-rows {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-1);
    padding-left: var(--sys-spacing-3);
  }
  .whl-row {
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
  }
  .whl-row.is-ticked {
    border-color: var(--sys-color-divider-primary);
  }
  .whl-row-main {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 34px;
    padding: 0 var(--sys-spacing-1) 0 var(--sys-spacing-2);
  }
  .whl-name {
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whl-row:not(.is-ticked) .whl-name {
    color: var(--sys-color-surface-paper-hint);
  }
  .whl-empty {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .whl-group-head:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }
`

/** A long list of map layers made manageable: filter, ticked-only, and groups by service (map image sublayers) or group layer. */
export default function LayerPicker (props: Props) {
  const { layers, isTicked, translate } = props
  const [filter, setFilter] = React.useState('')
  const [tickedOnly, setTickedOnly] = React.useState(false)
  const [openGroups, setOpenGroups] = React.useState<{ [group: string]: boolean }>({})

  const groupOf = (layer: MapLayer) => layer.parentLabel || translate('whsMapLayersGroup')
  const term = filter.trim().toLowerCase()
  const shown = layers.filter(layer =>
    (!term || layer.label.toLowerCase().includes(term) || groupOf(layer).toLowerCase().includes(term)) &&
    (!tickedOnly || isTicked(layer)))
  const groupNames = Array.from(new Set(layers.map(groupOf)))
  const tickedCount = layers.filter(isTicked).length

  const isOpen = (name: string, all: MapLayer[]) => {
    // Filtering opens every matching group, so the matches are visible.
    if (term || tickedOnly) return true
    if (name in openGroups) return openGroups[name]
    return layers.length <= OPEN_ALL_UP_TO || all.some(isTicked)
  }

  return (
    <div css={style} className='whats-here-layer-picker'>
      <div className='whl-tools'>
        <TextInput size='sm' value={filter} allowClear placeholder={translate('whsFilterLayers')} aria-label={translate('whsFilterLayers')}
          onChange={e => { setFilter(e.target.value) }} />
        <Label className='whl-only'>
          <span>{translate('whsTickedOnly')} <span className='whl-count'>({tickedCount})</span></span>
          <Switch checked={tickedOnly} onChange={e => { setTickedOnly(e.target.checked) }} />
        </Label>
      </div>

      {groupNames.map(name => {
        const all = layers.filter(layer => groupOf(layer) === name)
        const rows = shown.filter(layer => groupOf(layer) === name)
        if (!rows.length) return null
        const open = isOpen(name, all)
        return (
          <div key={name} className='whl-group'>
            <button type='button' className='whl-group-head' aria-expanded={open}
              onClick={() => { setOpenGroups(current => ({ ...current, [name]: !open })) }}>
              {open ? <DownOutlined size={12} /> : <RightOutlined size={12} />}
              <span className='whl-group-name' title={name}>{name}</span>
              <span className='whl-count'>{translate('whsTickedOf', { ticked: all.filter(isTicked).length, total: all.length })}</span>
            </button>
            {open && (
              <div className='whl-rows'>
                {rows.map(layer => {
                  const ticked = isTicked(layer)
                  return (
                    <div key={layer.dataSourceId} className={classNames('whl-row', { 'is-ticked': ticked })}>
                      <div className='whl-row-main'>
                        <Checkbox checked={ticked} aria-label={props.tickLabel?.(layer) ?? translate('whsIncludeLayer', { layer: layer.label })}
                          onChange={() => { props.onToggle(layer) }} />
                        {props.renderName
                          ? props.renderName(layer, ticked)
                          : <span className='whl-name' title={layer.label}>{layer.label}</span>}
                        {props.renderEnd?.(layer, ticked)}
                      </div>
                      {props.renderBelow?.(layer, ticked)}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
      {!shown.length && <div className='whl-empty'>{translate('whsNoLayerMatches')}</div>}
    </div>
  )
}
