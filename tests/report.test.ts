import { buildReportHtml, type ReportData } from '../src/runtime/report'

const strings: ReportData['strings'] = {
  reportTitle: "What's Here report",
  print: 'Print or save as PDF',
  mapAlt: 'Map',
  featuresFound: 'features found',
  layersWithResults: 'layers with results',
  layersSearched: 'layers searched',
  layersWithErrors: 'layers with errors',
  noFeaturesIn: 'No features in:',
  errorsIn: 'Could not search:',
  limitNote: (shown, total) => `Showing ${shown} of ${total}.`
}

const base = (patch: Partial<ReportData> = {}): ReportData => ({
  title: 'Pennington County, SD',
  subtitle: 'Area from USA Census Counties',
  meta: ['Profile: County Profile', ''],
  areas: [{ name: 'Pennington County', attributes: [{ label: 'County Name', value: 'Pennington' }, { label: 'State', value: 'South Dakota' }] }],
  layers: [
    { key: 'c', title: 'USA Major Cities', features: [{ id: '1', description: 'Rapid City', attributes: [{ label: 'Name', value: 'Rapid City' }], graphic: null }] },
    { key: 'w', title: 'Wildfires', features: [] },
    { key: 'e', title: 'Broken', features: [], error: true }
  ],
  accent: '#5b129f',
  footer: 'Layers searched: USA Major Cities, Wildfires, Broken',
  strings,
  ...patch
})

describe('whats-here report', () => {
  it('shows the area as heading: value pairs, without a name heading for a single area', () => {
    const html = buildReportHtml(base())
    expect(html).toContain('<div class="pair"><dt>County Name:</dt><dd>Pennington</dd></div>')
    expect(html).toContain('<dt>State:</dt><dd>South Dakota</dd>')
    expect(html).not.toContain('<h3>Pennington County</h3>')
  })

  it('names each area when several were merged', () => {
    const html = buildReportHtml(base({ areas: [{ name: 'A', attributes: [] }, { name: 'B', attributes: [] }] }))
    expect(html).toContain('<h3>A</h3>')
    expect(html).toContain('<h3>B</h3>')
  })

  it('tables layers with features and lists empty and failed layers', () => {
    const html = buildReportHtml(base())
    expect(html).toContain('<h2>USA Major Cities <span class="count">· 1</span></h2>')
    expect(html).toContain('<td>Rapid City</td>')
    expect(html).toContain('No features in: Wildfires')
    expect(html).toContain('Could not search: Broken')
    expect(html).toContain('<b>1</b><span>layers with errors</span>')
  })

  it('escapes text and only accepts a real colour as the accent', () => {
    const html = buildReportHtml(base({ title: '<script>x</script>', accent: 'red;}</style><script>' }))
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;')
    expect(html).not.toContain('<script>x')
    expect(html).toContain('--accent: #5b129f;')
  })

  it('includes the map only as an image data URL', () => {
    expect(buildReportHtml(base({ mapImage: 'data:image/png;base64,AAA' }))).toContain('<img src="data:image/png;base64,AAA"')
    expect(buildReportHtml(base({ mapImage: 'javascript:alert(1)' }))).not.toContain('<img')
  })
})
