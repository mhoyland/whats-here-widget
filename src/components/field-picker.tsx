import { React, css, DataSourceManager, type DataSource } from 'jimu-core'
import { Button, Checkbox, Label, TextInput } from 'jimu-ui'
import { DownOutlined } from 'jimu-icons/outlined/directional/down'
import { UpOutlined } from 'jimu-icons/outlined/directional/up'

export interface MapLayerField {
  name: string
  alias: string
}

// Fields that never help in a result list.
const HIDDEN_FIELD = /^(shape|shape[._]?(area|length|len)|st_area\(.*\)|st_length\(.*\)|globalid)$/i
const HIDDEN_TYPES = ['esriFieldTypeGeometry', 'esriFieldTypeBlob', 'esriFieldTypeRaster']

/** A layer data source's fields, from its schema or, failing that, its layer definition. */
export const fieldsOf = (ds: DataSource): MapLayerField[] => {
  const schemaFields = Object.values(ds.getSchema()?.fields ?? {}) as any[]
  const fields = schemaFields.length ? schemaFields : ((ds as any).getLayerDefinition?.()?.fields ?? [])
  return fields
    .filter((f: any) => f?.name && !HIDDEN_FIELD.test(f.name) && !HIDDEN_TYPES.includes(f.esriType ?? f.type))
    .map((f: any) => ({ name: f.name, alias: f.alias || f.name }))
}

/** The field names the layer's popup shows, in popup order, from the web map's popup settings. */
export const popupFieldsOf = (ds: DataSource): string[] => {
  const infos: any[] = (ds as any).getPopupInfo?.()?.fieldInfos ?? []
  const visible = infos.filter(info => info?.fieldName && info.visible !== false && !String(info.fieldName).startsWith('expression/'))
  return visible.length ? visible.map(info => info.fieldName) : ((ds as any).getPopupInfoFields?.() ?? [])
}

interface DataSourceFields {
  fields: MapLayerField[]
  popupFields: string[]
  loading: boolean
}

/** The fields of one data source, creating it in the builder if needed. */
export const useDataSourceFields = (dataSourceId: string | undefined): DataSourceFields => {
  const [state, setState] = React.useState<DataSourceFields>({ fields: [], popupFields: [], loading: !!dataSourceId })
  React.useEffect(() => {
    if (!dataSourceId) {
      setState({ fields: [], popupFields: [], loading: false })
      return
    }
    let cancelled = false
    setState(current => ({ ...current, loading: true }))
    const load = async () => {
      try {
        const manager = DataSourceManager.getInstance()
        const ds = manager.getDataSource(dataSourceId) ?? await manager.createDataSource(dataSourceId)
        if (!cancelled) setState({ fields: ds ? fieldsOf(ds) : [], popupFields: ds ? popupFieldsOf(ds) : [], loading: false })
      } catch (err) {
        console.warn("What's Here: could not read the layer's fields.", err)
        if (!cancelled) setState({ fields: [], popupFields: [], loading: false })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [dataSourceId])
  return state
}

const style = css`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--sys-spacing-2);

  .whs-field-tools {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sys-spacing-2);
    padding-bottom: var(--sys-spacing-1);
    margin-bottom: var(--sys-spacing-1);
    border-bottom: 1px solid var(--sys-color-divider-tertiary);
  }
  .whs-select-all {
    font-weight: 600;
  }
  .whs-field-filter {
    margin-bottom: var(--sys-spacing-1);
  }
  .whs-field-hint {
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--sys-color-surface-paper-hint);
    margin-bottom: var(--sys-spacing-1);
  }
  .whs-field {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 28px;
    padding: 0 var(--sys-spacing-1);
    border-radius: var(--sys-shape-shape1);
  }
  .whs-field:hover {
    background: var(--sys-color-action-hover);
  }
  .whs-field-label {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
  }
  .whs-row-tag {
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0 4px;
    border: 1px solid var(--sys-color-primary-main);
    border-radius: 3px;
    color: var(--sys-color-primary-main);
  }
  /* Move buttons appear on hover or keyboard focus to keep rows quiet. */
  .whs-move {
    display: flex;
    opacity: 0;
  }
  .whs-field:hover .whs-move,
  .whs-field:focus-within .whs-move {
    opacity: 1;
  }
`

interface Props {
  fields: MapLayerField[]
  /** Chosen field names, in order. */
  chosen: string[]
  /** Hint shown above the list: one for no fields chosen, one once some are. */
  hint: string
  emptyHint: string
  /** Tag on the first chosen field, e.g. "ROW"; none when the first field has no special role. */
  firstTag?: string
  /** The layer's popup fields; when given, a button sets the selection to them. */
  popupFields?: string[]
  translate: (id: string, values?: any) => string
  onChange: (fields: string[]) => void
}

/** Tick fields to show them; ticked fields come first, in order, and can be moved up and down. */
// Long lists get a filter box.
const FILTER_ABOVE = 8

export default function FieldPicker (props: Props) {
  const { fields, chosen, translate, onChange } = props
  const [filter, setFilter] = React.useState('')
  // Chosen fields first, in their order, then the rest in the layer's order.
  const ordered = [
    ...chosen.map(name => fields.find(f => f.name === name) ?? { name, alias: name }),
    ...fields.filter(f => !chosen.includes(f.name))
  ]
  const term = filter.trim().toLowerCase()
  const shown = term ? ordered.filter(f => f.alias.toLowerCase().includes(term) || f.name.toLowerCase().includes(term)) : ordered

  // Select all works on the fields shown, so a filter can tick or clear just its matches.
  const shownChosen = shown.filter(f => chosen.includes(f.name)).length
  const allOn = shown.length > 0 && shownChosen === shown.length
  const toggleAll = () => {
    const names = shown.map(f => f.name)
    onChange(allOn
      ? chosen.filter(name => !names.includes(name))
      : [...chosen, ...fields.filter(f => names.includes(f.name) && !chosen.includes(f.name)).map(f => f.name)])
  }
  const popupFields = (props.popupFields ?? []).filter(name => fields.some(f => f.name === name))
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= chosen.length) return
    const next = [...chosen]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div css={style} className='whs-fields'>
      <div className='whs-field-hint'>{chosen.length ? props.hint : props.emptyHint}</div>
      {fields.length > FILTER_ABOVE && (
        <TextInput size='sm' className='whs-field-filter' value={filter} allowClear
          placeholder={translate('whsFilterFields')} aria-label={translate('whsFilterFields')}
          onChange={e => { setFilter(e.target.value) }} />
      )}
      <div className='whs-field-tools'>
        <Label className='whs-field-label whs-select-all'>
          <Checkbox checked={allOn} indeterminate={shownChosen > 0 && !allOn} disabled={!shown.length} onChange={toggleAll} />
          {translate(term ? 'whsSelectMatches' : 'whsSelectAll', { count: shown.length })}
        </Label>
        {popupFields.length > 0 && (
          <Button size='sm' type='tertiary' title={translate('whsUsePopupFieldsTitle')} onClick={() => { onChange(popupFields) }}>
            {translate('whsUsePopupFields')}
          </Button>
        )}
      </div>
      {!shown.length && <div className='whs-field-hint'>{translate('whsNoFieldMatches')}</div>}
      {shown.map(field => {
        const index = chosen.indexOf(field.name)
        const on = index >= 0
        return (
          <div className='whs-field' key={field.name}>
            <Label className='whs-field-label' title={field.name}>
              <Checkbox checked={on} onChange={() => { onChange(on ? chosen.filter(n => n !== field.name) : [...chosen, field.name]) }} />
              {field.alias}
            </Label>
            {on && index === 0 && props.firstTag && <span className='whs-row-tag'>{props.firstTag}</span>}
            {on && (
              <span className='whs-move'>
                <Button size='sm' type='tertiary' icon disabled={index === 0}
                  aria-label={translate('whsMoveUp', { field: field.alias })} title={translate('whsMoveUp', { field: field.alias })}
                  onClick={() => { move(index, -1) }}>
                  <UpOutlined size={12} />
                </Button>
                <Button size='sm' type='tertiary' icon disabled={index === chosen.length - 1}
                  aria-label={translate('whsMoveDown', { field: field.alias })} title={translate('whsMoveDown', { field: field.alias })}
                  onClick={() => { move(index, 1) }}>
                  <DownOutlined size={12} />
                </Button>
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
