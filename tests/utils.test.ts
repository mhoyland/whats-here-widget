import {
  clampNumber, defaultFields, escapeHtml, dateFormatOptions, formatNumber, countFeatures, countTotal, fillTemplate, formatBuffer, formatLatLon, isVisibleAtScale, layerCountText, layerTable, pickProfile, resolveWhere, summaryText, toMeters,
  type LayerResult
} from '../src/runtime/utils'

const raw = (_field: string, value: any) => String(value)

describe('whats-here utils', () => {
  it('fills popup title placeholders case-insensitively', () => {
    expect(fillTemplate('{NAME} ({status})', { name: 'Lot 12', STATUS: 'Active' }, raw)).toBe('Lot 12 (Active)')
  })

  it('drops unknown fields, Arcade placeholders and empty brackets', () => {
    expect(fillTemplate('Parcel: {LOT} ({expression/expr0})', { LOT: 7 }, raw)).toBe('Parcel: 7')
    expect(fillTemplate('{MISSING}', { LOT: 7 }, raw)).toBe('')
    expect(fillTemplate('{LOT}', { LOT: null }, raw)).toBe('')
  })

  it('uses the formatter for values', () => {
    expect(fillTemplate('{TYPE}', { TYPE: 1 }, (_f, v) => (v === 1 ? 'Residential' : String(v)))).toBe('Residential')
  })

  it('treats 0 as no scale limit', () => {
    expect(isVisibleAtScale(0, 0, 1e9)).toBe(true)
    expect(isVisibleAtScale(50000, 0, 100000)).toBe(false)
    expect(isVisibleAtScale(50000, 0, 20000)).toBe(true)
    expect(isVisibleAtScale(0, 1000, 500)).toBe(false)
    expect(isVisibleAtScale(50000, 1000, undefined)).toBe(true)
  })

  it('clamps and rounds numbers with a fallback', () => {
    expect(clampNumber('abc', 1, 10, 5)).toBe(5)
    expect(clampNumber(100, 1, 10, 5)).toBe(10)
    expect(clampNumber(2.6, 1, 10, 5)).toBe(3)
  })

  it('formats coordinates and returns empty text for invalid ones', () => {
    expect(formatLatLon(-33.8568, 151.2153, 2)).toBe('-33.86, 151.22')
    expect(formatLatLon(NaN, 151, 2)).toBe('')
  })

  it('builds a clipboard summary of layers with features', () => {
    const results: LayerResult[] = [
      { key: 'a', title: 'Parcels', features: [{ id: '1', description: 'Lot 1', attributes: [], graphic: null }, { id: '2', description: 'Lot 2', attributes: [], graphic: null }], exceeded: true },
      { key: 'b', title: 'Roads', features: [] },
      { key: 'c', title: 'Zones', parentTitle: 'Planning', features: [{ id: '9', description: 'R2', attributes: [], graphic: null }] }
    ]
    expect(countFeatures(results)).toBe(3)
    expect(summaryText(results, 'Heading')).toBe('Heading\n\nParcels (2+)\n  - Lot 1\n  - Lot 2\n\nPlanning / Zones (1)\n  - R2')
  })

  it('shows full counts when the total is known', () => {
    const features = [{ id: '1', description: 'A', attributes: [], graphic: null }]
    const known: LayerResult = { key: 'a', title: 'A', features, exceeded: true, total: 2341 }
    const unknown: LayerResult = { key: 'b', title: 'B', features, exceeded: true }
    const plain: LayerResult = { key: 'c', title: 'C', features }
    expect(layerCountText(known)).toBe((2341).toLocaleString())
    expect(layerCountText(unknown)).toBe('1+')
    expect(layerCountText(plain)).toBe('1')
    expect(countTotal([known, unknown, plain])).toBe(2343)
  })

  it('converts buffer units and formats signed buffers', () => {
    expect(toMeters(-20, 'meters')).toBe(-20)
    expect(toMeters(2, 'kilometers')).toBe(2000)
    expect(toMeters(1, 'miles')).toBeCloseTo(1609.344)
    expect(formatBuffer(0, 'm')).toBe('')
    expect(formatBuffer(-20, 'm')).toBe('\u221220 m')
    expect(formatBuffer(5, 'km')).toBe('+5 km')
  })

  it('picks the chosen profile, else the first, else none', () => {
    const profiles = [{ id: 'a', label: 'Default' }, { id: 'b', label: 'Planning check' }]
    expect(pickProfile(profiles, 'b')?.label).toBe('Planning check')
    expect(pickProfile(profiles, 'gone')?.label).toBe('Default')
    expect(pickProfile(profiles, null)?.label).toBe('Default')
    expect(pickProfile([], 'a')).toBeNull()
    expect(pickProfile(undefined, 'a')).toBeNull()
  })


  it('copies a layer as a table with a column per attribute', () => {
    const layer: LayerResult = {
      key: 'c',
      title: 'Cities',
      features: [
        { id: '1', description: 'Rapid City', attributes: [{ label: 'Name', value: 'Rapid City' }, { label: 'Class', value: 'city' }], graphic: null },
        // Empty values are left out of attributes, so the column must still line up.
        { id: '2', description: 'A<B', attributes: [{ label: 'Name', value: 'A<B' }], graphic: null }
      ]
    }
    const { text, html } = layerTable(layer)
    expect(text).toBe('Name\tClass\nRapid City\tcity\nA<B\t')
    expect(html).toContain('<th>Name</th><th>Class</th>')
    expect(html).toContain('<td>A&lt;B</td><td></td>')
  })

  it('falls back to a description column when there are no attributes', () => {
    const layer: LayerResult = { key: 'x', title: 'Things', features: [{ id: '1', description: 'One\tthing', attributes: [], graphic: null }] }
    expect(layerTable(layer).text).toBe('Things\nOne thing')
  })

  it('formats numbers from the popup settings, else keeps whole numbers and identifiers plain', () => {
    const plain = { isInteger: true, isIdentifier: false }
    expect(formatNumber(762784, { ...plain, format: { digitSeparator: true, places: 0 } }, 'en-US')).toBe('762,784')
    expect(formatNumber(762784, { ...plain, format: { digitSeparator: false, places: 0 } }, 'en-US')).toBe('762784')
    expect(formatNumber(358.3, { isInteger: false, isIdentifier: false, format: { digitSeparator: true, places: 2 } }, 'en-US')).toBe('358.30')
    // No popup settings: whole numbers (FIPS, IDs) stay plain, decimals are grouped.
    expect(formatNumber(8041, plain, 'en-US')).toBe('8041')
    expect(formatNumber(2129.14, { isInteger: false, isIdentifier: false }, 'en-US')).toBe('2,129.14')
    // An identifier stays plain even when it is a decimal field.
    expect(formatNumber(1234567.5, { isInteger: false, isIdentifier: true }, 'en-US')).toBe('1234567.5')
  })

  it('maps popup date formats to Intl options', () => {
    expect(dateFormatOptions('short-date')).toEqual({ dateStyle: 'short' })
    expect(dateFormatOptions('short-date-short-time-24')).toEqual({ dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' })
    expect(dateFormatOptions('long-month-day-year-long-time')).toEqual({ dateStyle: 'long', timeStyle: 'medium' })
    expect(dateFormatOptions('long-month-year')).toEqual({ year: 'numeric', month: 'long' })
    expect(dateFormatOptions('something-new')).toBeNull()
    expect(dateFormatOptions(undefined)).toBeNull()
  })


  it('offers every way by default, but Feature only with an area layer', () => {
    expect(resolveWhere({}, undefined)).toMatchObject({
      modes: ['point', 'draw'], defaultMode: 'point', drawTools: ['polygon', 'rectangle'],
      areaLayers: [], buffers: { feature: -20, draw: 0, point: 0 }, allowCustomBuffer: true
    })
    const where = resolveWhere({
      whereModes: ['feature', 'point'], defaultWhere: 'feature', areaLayers: [{ dataSourceId: 'a' }, { dataSourceId: 'b', fields: ['NAME'] }],
      defaultAreaLayerId: 'b', bufferFeature: -5, bufferPoint: -10, drawTools: ['freehand']
    }, undefined)
    // Modes keep display order; a negative point radius becomes 0.
    expect(where).toMatchObject({ modes: ['point', 'feature'], defaultMode: 'feature', defaultAreaLayerId: 'b', drawTools: ['freehand'] })
    expect(where.buffers).toEqual({ feature: -5, draw: 0, point: 0 })
    expect(where.areaLayers[1].fields).toEqual(['NAME'])
  })

  it('carries apps from before 1.7 over: widget-wide area layer first, then 1.6 profile areas', () => {
    const where = resolveWhere({
      searchMode: 'area', bufferDistance: -0.05, bufferUnit: 'kilometers', areaFields: ['COUNTY'],
      profiles: [
        { id: 'p1', label: 'Parcels', searchBy: 'area', area: { dataSourceId: 'parcels', fields: ['APN'] } },
        { id: 'p2', label: 'Same', searchBy: 'area', area: { dataSourceId: 'counties' } },
        { id: 'p3', label: 'Old', area: { dataSourceId: 'ignored' } }
      ]
    }, 'counties')
    expect(where.areaLayers).toEqual([
      { dataSourceId: 'counties', rootDataSourceId: undefined, fields: ['COUNTY'] },
      { dataSourceId: 'parcels', rootDataSourceId: undefined, fields: ['APN'] }
    ])
    expect(where).toMatchObject({ defaultMode: 'feature', defaultAreaLayerId: 'counties' })
    // The old buffer is converted to metres.
    expect(where.buffers.feature).toBeCloseTo(-50)
  })

  it('falls back when the stored default is not offered', () => {
    expect(resolveWhere({ whereModes: ['draw'], defaultWhere: 'point' }, undefined).defaultMode).toBe('draw')
    expect(resolveWhere({ whereModes: ['feature'] }, undefined).modes).toEqual(['point'])
    expect(resolveWhere({ areaLayers: [{ dataSourceId: 'a' }], defaultAreaLayerId: 'gone' }, undefined).defaultAreaLayerId).toBe('a')
  })

  it('escapes HTML, including quotes for attribute values', () => {
    expect(escapeHtml('<a href="x">R&D</a>')).toBe('&lt;a href=&quot;x&quot;&gt;R&amp;D&lt;/a&gt;')
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(5)).toBe('5')
  })

  it('defaults to the pop-up fields, else the first four non-ID fields', () => {
    const fields = [
      { name: 'OBJECTID', type: 'esriFieldTypeOID' }, { name: 'NAME' }, { name: 'GlobalID_2', type: 'global-id' },
      { name: 'STATE' }, { name: 'FIPS' }, { name: 'POP' }, { name: 'AREA' }
    ]
    expect(defaultFields(fields, ['POP', 'NAME', 'GONE'])).toEqual(['POP', 'NAME'])
    expect(defaultFields(fields, [])).toEqual(['NAME', 'STATE', 'FIPS', 'POP'])
    expect(defaultFields([], ['NAME'])).toEqual([])
  })
})
