import { React, Immutable, ReactRedux, hooks, type IMState } from 'jimu-core'
import type { AllWidgetSettingProps } from 'jimu-for-builder'
import { NumericInput, Switch, TextInput } from 'jimu-ui'
import { MapWidgetSelector, SettingRow, SettingSection } from 'jimu-ui/advanced/setting-components'
import { DEFAULT_MAX_FEATURES, DEFAULT_TOLERANCE, WHERE_MODES, type Config, type IMConfig, type Profile } from '../config'
import { clampNumber, resolveWhere } from '../runtime/utils'
import ProfilesSetting from './profiles-setting'
import WhereSetting from './where-setting'
import { useMapLayers } from './map-layers'
import defaultMessages from './translations/default'

const hintStyle: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--sys-color-surface-paper-hint)' }

export default function Setting (props: AllWidgetSettingProps<IMConfig>) {
  const translate = hooks.useTranslation(defaultMessages)
  const config = (props.config?.asMutable?.({ deep: true }) ?? {}) as Config

  const update = (patch: Partial<Config>) => {
    props.onSettingChange({ id: props.id, config: Immutable({ ...config, ...patch }) as IMConfig })
  }

  // Layers are listed from the selected map's data sources.
  const mapWidgetId = props.useMapWidgetIds?.[0]
  const mapDataSourceIds = ReactRedux.useSelector((state: IMState) => {
    const uses = (state as any).appStateInBuilder?.appConfig?.widgets?.[mapWidgetId]?.useDataSources
    return (uses?.map((use: any) => use.dataSourceId).join(',') as string) || ''
  })
  const rootIds = React.useMemo(() => (mapDataSourceIds ? mapDataSourceIds.split(',') : []), [mapDataSourceIds])
  const { layers: mapLayers, loading } = useMapLayers(rootIds)

  // Apps saved before 1.7 had one area layer in useDataSources; resolveWhere carries it over.
  const where = resolveWhere(config, props.useDataSources?.[0]?.dataSourceId)
  const profiles = config.profiles ?? []

  /** Writes every where setting explicitly, so an older app's carried-over values are saved as they are shown. */
  const updateWhere = (patch: Partial<Config>) => {
    update({
      // The ways ticked, not those in effect: "feature" stays offered while it waits for its first layer.
      whereModes: config.whereModes ?? WHERE_MODES,
      defaultWhere: where.defaultMode,
      drawTools: where.drawTools,
      areaLayers: where.areaLayers,
      defaultAreaLayerId: where.defaultAreaLayerId,
      bufferFeature: where.buffers.feature,
      bufferDraw: where.buffers.draw,
      bufferPoint: where.buffers.point,
      allowCustomBuffer: where.allowCustomBuffer,
      ...patch
    })
  }

  const selectMap = (useMapWidgetIds: string[]) => {
    // Layers from the previous map no longer apply: feature layers are cleared, and profiles that chose layers
    // go back to every visible layer (keeping their names) so they still find something until they are edited.
    const nextProfiles = profiles.map(profile => profile.layerScope === 'chosen'
      ? { ...profile, layerScope: 'all' as const, layers: [] }
      : profile)
    props.onSettingChange({
      id: props.id,
      useMapWidgetIds,
      useDataSources: [],
      config: Immutable({ ...config, areaLayers: [], defaultAreaLayerId: undefined, profiles: nextProfiles }) as IMConfig
    })
  }

  return (
    <div className='widget-setting-whats-here'>
      <SettingSection title={translate('whsMap')}>
        <SettingRow>
          <MapWidgetSelector useMapWidgetIds={props.useMapWidgetIds} onSelect={selectMap} />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('whsMapHint')}</div>
        </SettingRow>
      </SettingSection>

      <WhereSetting
        widgetId={props.id}
        config={config}
        where={where}
        hasMap={rootIds.length > 0}
        mapLayers={mapLayers}
        loading={loading}
        translate={translate}
        onChange={updateWhere}
      />

      <ProfilesSetting
        widgetId={props.id}
        profiles={profiles}
        allowProfileSwitch={config.allowProfileSwitch !== false}
        allowCustomise={config.allowCustomise !== false}
        customisePool={config.customisePool === 'profiles' ? 'profiles' : 'map'}
        hasMap={rootIds.length > 0}
        mapLayers={mapLayers}
        loading={loading}
        translate={translate}
        onProfilesChange={(next: Profile[]) => { update({ profiles: next }) }}
        onAllowProfileSwitchChange={allowProfileSwitch => { update({ allowProfileSwitch }) }}
        onCustomiseChange={patch => { update(patch) }}
      />

      <SettingSection title={translate('whsSearch')}>
        <SettingRow label={translate('whsTolerance')}>
          <NumericInput size='sm' min={1} max={50} style={{ width: 72 }}
            value={clampNumber(config.tolerance, 1, 50, DEFAULT_TOLERANCE)}
            aria-label={translate('whsTolerance')}
            onChange={v => { update({ tolerance: clampNumber(v, 1, 50, DEFAULT_TOLERANCE) }) }} />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('whsToleranceHint')}</div>
        </SettingRow>
        <SettingRow label={translate('whsMaxFeatures')}>
          <NumericInput size='sm' min={1} max={2000} style={{ width: 72 }}
            value={clampNumber(config.maxFeaturesPerLayer, 1, 2000, DEFAULT_MAX_FEATURES)}
            aria-label={translate('whsMaxFeatures')}
            onChange={v => { update({ maxFeaturesPerLayer: clampNumber(v, 1, 2000, DEFAULT_MAX_FEATURES) }) }} />
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('whsBehaviour')}>
        <SettingRow label={translate('whsCollapseGroups')}>
          <Switch checked={config.collapseGroups !== false} aria-label={translate('whsCollapseGroups')}
            onChange={e => { update({ collapseGroups: e.target.checked }) }} />
        </SettingRow>
        <SettingRow label={translate('whsShowEmptyLayers')}>
          <Switch checked={!!config.showEmptyLayers} aria-label={translate('whsShowEmptyLayers')}
            onChange={e => { update({ showEmptyLayers: e.target.checked }) }} />
        </SettingRow>
        <SettingRow label={translate('whsShowReport')}>
          <Switch checked={config.showReport !== false} aria-label={translate('whsShowReport')}
            onChange={e => { update({ showReport: e.target.checked }) }} />
        </SettingRow>
        {config.showReport !== false && (
          <SettingRow flow='wrap' label={translate('whsReportHeading')}>
            <TextInput size='sm' className='w-100' value={config.reportHeading ?? ''} placeholder={translate('whsReportHeadingDefault')}
              aria-label={translate('whsReportHeading')}
              onChange={e => { update({ reportHeading: e.target.value }) }} />
          </SettingRow>
        )}
        <SettingRow label={translate('whsReadyOnOpen')}>
          <Switch checked={!!config.readyOnOpen} aria-label={translate('whsReadyOnOpen')}
            onChange={e => { update({ readyOnOpen: e.target.checked }) }} />
        </SettingRow>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('whsReadyOnOpenHint')}</div>
        </SettingRow>
        <SettingRow label={translate('whsKeepPicking')}>
          <Switch checked={!!config.keepPickingActive} aria-label={translate('whsKeepPicking')}
            onChange={e => { update({ keepPickingActive: e.target.checked }) }} />
        </SettingRow>
      </SettingSection>

      <SettingSection title={translate('whsContextMenu')}>
        <SettingRow>
          <div className='text-break' style={hintStyle}>{translate('whsContextMenuHint')}</div>
        </SettingRow>
      </SettingSection>
    </div>
  )
}
