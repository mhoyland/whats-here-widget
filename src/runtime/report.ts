// Builds the printable HTML report. Pure string work with no ArcGIS Maps SDK imports, so it can be unit tested.
import { type FeatureAttribute, type LayerResult, countTotal, escapeHtml, layerCountText, layerTable } from './utils'

// The widget opens the report window with this too.
export { escapeHtml }

export interface ReportStrings {
  /** Browser tab title and the small heading above the main title. */
  reportTitle: string
  print: string
  mapAlt: string
  featuresFound: string
  layersWithResults: string
  layersSearched: string
  layersWithErrors: string
  noFeaturesIn: string
  errorsIn: string
  limitNote: (shown: number, total: string) => string
}

export interface ReportArea {
  name: string
  attributes: FeatureAttribute[]
}

export interface ReportData {
  /** Main title: the area name, or the coordinates of a point search. */
  title: string
  subtitle: string
  /** Lines at the top right, e.g. profile, date and user. */
  meta: string[]
  /** PNG data URL of the map, if a screenshot could be taken. */
  mapImage?: string
  mapCaption?: string
  /** The area polygon(s), shown as heading: value pairs in two columns. */
  areas: ReportArea[]
  layers: LayerResult[]
  /** Accent colour from the app theme. */
  accent: string
  footer: string
  /** Page language, e.g. "en". */
  lang?: string
  strings: ReportStrings
}


// Only hex, rgb() and hsl() colours reach the page's CSS.
const safeColor = (color: string) => /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([\d\s.,%]+\))$/i.test(color?.trim() ?? '') ? color.trim() : '#5b129f'

const renderArea = (area: ReportArea, showName: boolean) => `
  <section class="area">
    ${showName ? `<h3>${escapeHtml(area.name)}</h3>` : ''}
    <dl class="pairs">
      ${area.attributes.map(attr => `<div class="pair"><dt>${escapeHtml(attr.label)}:</dt><dd>${escapeHtml(attr.value)}</dd></div>`).join('')}
    </dl>
  </section>`

const renderLayer = (layer: LayerResult, strings: ReportStrings) => {
  const note = layer.exceeded
    ? `<p class="note">${escapeHtml(strings.limitNote(layer.features.length, layer.total > layer.features.length ? layer.total.toLocaleString() : `${layer.features.length}+`))}</p>`
    : ''
  return `
  <section class="layer">
    <h2>${escapeHtml(layer.title)} <span class="count">· ${escapeHtml(layerCountText(layer))}</span></h2>
    ${layer.parentTitle ? `<p class="parent">${escapeHtml(layer.parentTitle)}</p>` : ''}
    ${layerTable(layer).html}
    ${note}
  </section>`
}

export const buildReportHtml = (data: ReportData): string => {
  const { strings } = data
  const accent = safeColor(data.accent)
  const withFeatures = data.layers.filter(layer => layer.features.length > 0)
  const empty = data.layers.filter(layer => !layer.features.length && !layer.error)
  const failed = data.layers.filter(layer => layer.error)
  const featureTotal = countTotal(data.layers)

  const stats = [
    [featureTotal.toLocaleString(), strings.featuresFound],
    [String(withFeatures.length), strings.layersWithResults],
    [String(data.layers.length), strings.layersSearched],
    ...(failed.length ? [[String(failed.length), strings.layersWithErrors]] : [])
  ]

  return `<!doctype html>
<html lang="${escapeHtml(data.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${strings.reportTitle} – ${data.title}`)}</title>
<style>
  :root { --accent: ${accent}; --ink: #1d1d1f; --muted: #5f5869; --line: #e3dfe8; --tint: color-mix(in srgb, var(--accent) 9%, #fff); }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f3f2f5; color: var(--ink); font: 13px/1.45 'Avenir Next', 'Segoe UI', system-ui, -apple-system, sans-serif; }
  .page { max-width: 860px; margin: 24px auto; padding: 40px 48px; background: #fff; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
  .toolbar { max-width: 860px; margin: 16px auto 0; display: flex; justify-content: flex-end; }
  .toolbar button { font: inherit; font-weight: 600; padding: 8px 18px; border: 0; border-radius: 3px; background: var(--accent); color: #fff; cursor: pointer; }
  header { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; padding-bottom: 14px; border-bottom: 2px solid var(--accent); }
  .eyebrow { margin: 0; font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); }
  h1 { margin: 4px 0; font-size: 26px; line-height: 1.2; }
  .subtitle { margin: 0; color: var(--muted); }
  .meta { margin: 0; text-align: right; color: var(--muted); white-space: nowrap; }
  figure { margin: 20px 0 0; }
  figure img { display: block; width: 100%; height: auto; border: 1px solid var(--line); }
  figcaption { margin-top: 6px; font-size: 11px; color: var(--muted); }
  .area { margin-top: 20px; padding: 14px 18px; background: var(--tint); border-radius: 4px; break-inside: avoid; }
  .area h3 { margin: 0 0 8px; font-size: 14px; }
  .pairs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 28px; margin: 0; }
  .pair { display: flex; gap: 6px; min-width: 0; }
  .pair dt { flex: 0 0 auto; font-weight: 600; }
  .pair dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
  .stats { display: grid; grid-template-columns: repeat(${stats.length}, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
  .stat { padding: 10px 14px; border: 1px solid var(--line); border-radius: 4px; }
  .stat b { display: block; font-size: 20px; }
  .stat span { color: var(--muted); }
  .layer { margin-top: 24px; }
  .layer h2 { margin: 0; font-size: 15px; }
  .layer .count { font-weight: 400; color: var(--muted); }
  .parent { margin: 0; font-size: 11px; color: var(--muted); }
  table { width: 100%; margin-top: 8px; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { text-align: left; padding: 6px 10px; background: var(--tint); font-weight: 600; }
  td { padding: 6px 10px; border-bottom: 1px solid var(--line); vertical-align: top; overflow-wrap: anywhere; }
  tr { break-inside: avoid; }
  .note { margin: 6px 0 0; font-size: 11px; color: var(--muted); }
  .others { margin-top: 20px; color: var(--muted); }
  .others p { margin: 4px 0 0; }
  footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }
  @page { margin: 14mm; }
  @media print {
    body { background: #fff; }
    .toolbar { display: none; }
    .page { margin: 0; padding: 0; max-width: none; box-shadow: none; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
  @media (max-width: 640px) {
    .page { margin: 0; padding: 20px 16px; }
    header { flex-direction: column; align-items: flex-start; }
    .meta { text-align: left; }
    .pairs, .stats { grid-template-columns: minmax(0, 1fr); }
  }
</style>
</head>
<body>
<div class="toolbar"><button type="button" onclick="window.print()">${escapeHtml(strings.print)}</button></div>
<main class="page">
  <header>
    <div>
      <p class="eyebrow">${escapeHtml(strings.reportTitle)}</p>
      <h1>${escapeHtml(data.title)}</h1>
      ${data.subtitle ? `<p class="subtitle">${escapeHtml(data.subtitle)}</p>` : ''}
    </div>
    <p class="meta">${data.meta.filter(Boolean).map(escapeHtml).join('<br>')}</p>
  </header>
  ${data.mapImage?.startsWith('data:image/') ? `
  <figure>
    <img src="${escapeHtml(data.mapImage)}" alt="${escapeHtml(strings.mapAlt)}">
    ${data.mapCaption ? `<figcaption>${escapeHtml(data.mapCaption)}</figcaption>` : ''}
  </figure>` : ''}
  ${data.areas.map(area => renderArea(area, data.areas.length > 1)).join('')}
  <div class="stats">${stats.map(([value, label]) => `<div class="stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join('')}</div>
  ${withFeatures.map(layer => renderLayer(layer, strings)).join('')}
  ${empty.length || failed.length ? `
  <div class="others">
    ${empty.length ? `<p>${escapeHtml(strings.noFeaturesIn)} ${escapeHtml(empty.map(l => l.title).join(', '))}</p>` : ''}
    ${failed.length ? `<p>${escapeHtml(strings.errorsIn)} ${escapeHtml(failed.map(l => l.title).join(', '))}</p>` : ''}
  </div>` : ''}
  <footer>${escapeHtml(data.footer)}</footer>
</main>
</body>
</html>`
}
