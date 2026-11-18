import { React, css, classNames } from 'jimu-core'
import { AlertPopup, Button, Dropdown, DropdownButton, DropdownItem, DropdownMenu, Label, Radio, Switch } from 'jimu-ui'
import { SettingRow, SettingSection, SidePopper } from 'jimu-ui/advanced/setting-components'
import { PlusOutlined } from 'jimu-icons/outlined/editor/plus'
import { MoreHorizontalOutlined } from 'jimu-icons/outlined/application/more-horizontal'
import { HandleDotVerticalOutlined } from 'jimu-icons/outlined/application/handle-dot-vertical'
import type { Config, Profile } from '../config'
import ProfileEditor from './profile-editor'
import type { MapLayer } from './map-layers'

interface Props {
  widgetId: string
  profiles: Profile[]
  allowProfileSwitch: boolean
  allowCustomise: boolean
  customisePool: 'map' | 'profiles'
  hasMap: boolean
  /** Feature layers of the selected map. */
  mapLayers: MapLayer[]
  loading: boolean
  translate: (id: string, values?: any) => string
  onProfilesChange: (profiles: Profile[]) => void
  onAllowProfileSwitchChange: (allow: boolean) => void
  onCustomiseChange: (patch: Pick<Config, 'allowCustomise' | 'customisePool'>) => void
}

const NAMES_IN_SUMMARY = 3

const makeId = () => `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const style = css`
  .whs-hint {
    font-size: 0.75rem;
    line-height: 1.4;
    color: var(--sys-color-surface-paper-hint);
  }
  .whs-cards {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
    width: 100%;
  }
  .whs-card {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    padding: 0 var(--sys-spacing-1);
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape2);
    background: var(--sys-color-surface-paper);
    transition: border-color 120ms ease, opacity 120ms ease;
  }
  .whs-card:hover {
    border-color: var(--sys-color-divider-primary);
  }
  .whs-card.is-editing {
    border-color: var(--sys-color-primary-main);
    box-shadow: inset 3px 0 0 var(--sys-color-primary-main);
  }
  .whs-card.is-dragging {
    opacity: 0.5;
  }
  .whs-card.is-drag-over {
    box-shadow: 0 -2px 0 0 var(--sys-color-primary-main);
  }
  .whs-drag {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 32px;
    border-radius: var(--sys-shape-shape1);
    color: var(--sys-color-surface-paper-hint);
    cursor: grab;
  }
  .whs-drag:hover {
    background: var(--sys-color-action-hover);
  }
  .whs-card-main {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sys-spacing-2) 0;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .whs-card-title {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    font-weight: 600;
  }
  .whs-card-title > span:first-of-type {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whs-tag {
    flex: 0 0 auto;
    font-size: 0.625rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    padding: 0 4px;
    border: 1px solid var(--sys-color-primary-main);
    border-radius: 3px;
    color: var(--sys-color-primary-main);
  }
  .whs-card-line {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-width: 0;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .whs-card-line > span:last-of-type {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .whs-card-main:focus-visible,
  .whs-drag:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: 1px;
  }
`

/** Profiles as a list of cards. Selecting a card opens its settings in a side panel. */
export default function ProfilesSetting (props: Props) {
  const { profiles, translate } = props
  const { mapLayers, loading } = props
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [focusNode, setFocusNode] = React.useState<HTMLElement | null>(null)
  const [draggedId, setDraggedId] = React.useState<string | null>(null)
  const [dragOverId, setDragOverId] = React.useState<string | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  // Deleting cannot be undone, so it is confirmed first.
  const [pendingDelete, setPendingDelete] = React.useState<Profile | null>(null)

  const editing = profiles.find(p => p.id === editingId) ?? null
  const openEditor = (id: string, from?: HTMLElement) => {
    setFocusNode(from ?? null)
    setEditingId(id)
  }

  const replace = (profile: Profile) => { props.onProfilesChange(profiles.map(p => p.id === profile.id ? profile : p)) }

  const addProfile = (event: React.MouseEvent<HTMLElement>) => {
    const profile: Profile = {
      id: makeId(),
      label: translate('whsNewProfileName', { number: profiles.length + 1 }),
      layerScope: 'all',
      layers: []
    }
    props.onProfilesChange([...profiles, profile])
    openEditor(profile.id, event.currentTarget)
  }

  const duplicate = (profile: Profile) => {
    const copy: Profile = { ...profile, id: makeId(), label: translate('whsCopyOf', { name: profile.label }) }
    const index = profiles.findIndex(p => p.id === profile.id)
    props.onProfilesChange([...profiles.slice(0, index + 1), copy, ...profiles.slice(index + 1)])
  }

  const remove = (profile: Profile) => {
    props.onProfilesChange(profiles.filter(p => p.id !== profile.id))
    if (editingId === profile.id) setEditingId(null)
  }

  const moveTo = (sourceId: string, targetIndex: number) => {
    const from = profiles.findIndex(p => p.id === sourceId)
    if (from < 0 || targetIndex < 0 || targetIndex >= profiles.length || from === targetIndex) return
    const next = [...profiles]
    const [moved] = next.splice(from, 1)
    next.splice(targetIndex, 0, moved)
    props.onProfilesChange(next)
  }

  const endDrag = () => {
    setDraggedId(null)
    setDragOverId(null)
  }

  const layersSummary = (profile: Profile): string => {
    if ((profile.layerScope ?? 'all') === 'all') return translate('whsScopeAll')
    const entries = Array.from(profile.layers ?? [])
    const names = entries.map(e => mapLayers.find(l => l.dataSourceId === e.dataSourceId)?.label).filter(Boolean)
    const shown = names.slice(0, NAMES_IN_SUMMARY).join(', ') + (names.length > NAMES_IN_SUMMARY ? '…' : '')
    // Layers the map no longer has (or a different map's) are searched for nothing; say so.
    const missing = loading ? 0 : entries.length - names.length
    return [
      translate('whsLayerCount', { count: entries.length }),
      shown,
      missing > 0 ? translate('whsLayersMissing', { count: missing }) : ''
    ].filter(Boolean).join(' · ')
  }

  return (
    <div css={style}>
      <SettingSection title={translate('whsProfiles')}>
        <SettingRow>
          <div className='whs-hint'>{translate(profiles.length ? 'whsProfilesHint' : 'whsNoProfilesHint')}</div>
        </SettingRow>

        {profiles.length > 0 && (
          <SettingRow flow='wrap'>
            <div className='whs-cards' ref={listRef}>
              {profiles.map((profile, index) => {
                const name = profile.label || translate('whsUnnamedProfile')
                return (
                  <div
                    key={profile.id}
                    className={classNames('whs-card', {
                      'is-editing': editingId === profile.id,
                      'is-dragging': draggedId === profile.id,
                      'is-drag-over': dragOverId === profile.id && draggedId !== profile.id
                    })}
                    onDragOver={event => {
                      event.preventDefault()
                      if (dragOverId !== profile.id) setDragOverId(profile.id)
                    }}
                    onDrop={event => {
                      event.preventDefault()
                      const sourceId = event.dataTransfer.getData('text/plain') || draggedId
                      if (sourceId) moveTo(sourceId, index)
                      endDrag()
                    }}
                  >
                    <span
                      className='whs-drag'
                      draggable
                      role='button'
                      tabIndex={0}
                      title={translate('whsDragProfile', { profile: name })}
                      aria-label={translate('whsDragProfile', { profile: name })}
                      onDragStart={event => {
                        setDraggedId(profile.id)
                        event.dataTransfer.effectAllowed = 'move'
                        event.dataTransfer.setData('text/plain', profile.id)
                      }}
                      onDragEnd={endDrag}
                      onKeyDown={event => {
                        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                          event.preventDefault()
                          moveTo(profile.id, index + (event.key === 'ArrowUp' ? -1 : 1))
                        }
                      }}
                    >
                      <HandleDotVerticalOutlined size={14} />
                    </span>

                    <button type='button' className='whs-card-main' aria-label={translate('whsEditProfileNamed', { profile: name })}
                      onClick={event => { openEditor(profile.id, event.currentTarget) }}>
                      <span className='whs-card-title'>
                        <span>{name}</span>
                        {index === 0 && <span className='whs-tag'>{translate('whsDefaultTag')}</span>}
                      </span>
                      <span className='whs-card-line'><span>{layersSummary(profile)}</span></span>
                    </button>

                    <Dropdown activeIcon>
                      <DropdownButton size='sm' type='tertiary' icon arrow={false}
                        aria-label={translate('whsMoreFor', { profile: name })} title={translate('whsMoreFor', { profile: name })}>
                        <MoreHorizontalOutlined size={14} />
                      </DropdownButton>
                      <DropdownMenu>
                        <DropdownItem onClick={() => { openEditor(profile.id) }}>{translate('whsEdit')}</DropdownItem>
                        <DropdownItem onClick={() => { duplicate(profile) }}>{translate('whsDuplicate')}</DropdownItem>
                        <DropdownItem disabled={index === 0} onClick={() => { moveTo(profile.id, 0) }}>{translate('whsMakeDefault')}</DropdownItem>
                        <DropdownItem onClick={() => { setPendingDelete(profile) }}>{translate('whsDelete')}</DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                )
              })}
            </div>
          </SettingRow>
        )}

        <SettingRow>
          <Button className='w-100' size='sm' type='primary' onClick={addProfile}>
            <PlusOutlined size={14} className='mr-1' />
            {translate('whsNewProfile')}
          </Button>
        </SettingRow>

        {(profiles.length > 1 || props.allowCustomise) && (
          <SettingRow label={translate('whsAllowProfileSwitch')}>
            <Switch checked={props.allowProfileSwitch} aria-label={translate('whsAllowProfileSwitch')}
              onChange={e => { props.onAllowProfileSwitchChange(e.target.checked) }} />
          </SettingRow>
        )}
        <SettingRow label={translate('whsAllowCustomise')}>
          <Switch checked={props.allowCustomise} aria-label={translate('whsAllowCustomise')}
            onChange={e => { props.onCustomiseChange({ allowCustomise: e.target.checked }) }} />
        </SettingRow>
        {props.allowCustomise && (
          <>
            <SettingRow flow='wrap' label={translate('whsCustomisePool')} role='radiogroup' aria-label={translate('whsCustomisePool')}>
              {(['map', 'profiles'] as const).map(pool => (
                <Label key={pool} className='d-flex align-items-center w-100 mb-1' style={{ gap: 6 }}>
                  <Radio name={`whs-pool-${props.widgetId}`} checked={props.customisePool === pool}
                    onChange={() => { props.onCustomiseChange({ customisePool: pool }) }} />
                  {translate(pool === 'map' ? 'whsPoolMap' : 'whsPoolProfiles')}
                </Label>
              ))}
            </SettingRow>
            <SettingRow><div className='whs-hint'>{translate('whsCustomiseHint')}</div></SettingRow>
          </>
        )}
      </SettingSection>

      <AlertPopup
        severity='warning'
        withIcon
        isOpen={!!pendingDelete}
        title={translate('whsDeleteProfileTitle')}
        description={translate('whsDeleteProfileBody', { profile: pendingDelete?.label || translate('whsUnnamedProfile') })}
        okLabel={translate('whsDelete')}
        onClickOk={() => {
          remove(pendingDelete)
          setPendingDelete(null)
        }}
        toggle={() => { setPendingDelete(null) }}
      />

      <SidePopper
        position='right'
        isOpen={!!editing}
        toggle={() => { setEditingId(null) }}
        trigger={listRef.current}
        backToFocusNode={focusNode}
        title={editing?.label || translate('whsUnnamedProfile')}
      >
        {editing && (
          <ProfileEditor
            key={editing.id}
            widgetId={props.widgetId}
            profile={editing}
            hasMap={props.hasMap}
            mapLayers={mapLayers}
            loading={loading}
            translate={translate}
            onChange={replace}
          />
        )}
      </SidePopper>
    </div>
  )
}
