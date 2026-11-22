# What's Here

Lists the features of every visible map layer at a point (ArcGIS Experience Builder Developer Edition 1.21).

Pick the point with the **Select point** button, or right-click the map and choose **What's here?** from the
[Map Context Menu](https://github.com/mhoyland/map-context-menu-widget).

With an **area layer** set (for example counties), the widget can instead search the polygon under the point: it finds
that polygon, optionally grows or shrinks it, and lists what every visible layer has in it.

## Requirements

- A Map widget, selected in the widget settings.
- `jimu-arcgis` (declared in `manifest.json`).
- Optional: a Map Context Menu widget attached to the same map, for right-click hand-off.

## Installation

ArcGIS Experience Builder Developer Edition 1.21.

1. Copy this folder to `client/your-extensions/widgets/whats-here`.
2. Restart the client dev server (`npm start` in `client/`).
3. Add the widget to an experience in the builder.

## Settings

| Setting | Default | Notes |
|---|---|---|
| Map | — | The Map widget to search. |
| Click tolerance (px) | 6 | Search box around the point for point and line layers. Polygons are found when the point falls inside them. |
| Max features per layer | 100 | 1–2000. A `+` on the count and a note show when the limit was reached. |
| List layers with no features | off | Show every searched layer, not only those with results. |
| Start with layer groups collapsed | on | A single layer with results stays open. |
| Stay in select mode after a click | off | When off, one click runs a search and leaves select mode. |
| Ready to search when opened | off | The widget starts waiting for a map click (or drawing) as soon as it opens, using the default or the user's last Where. Map pop-ups don't open on click while it waits. |

### Where, buffer and profile

The panel opens with a compact bar. Line 1 has three icon buttons (Point, Draw, Feature; each starts straight away)
with a prompt beside them: *Click on the map*, *Draw on the map* or *Click a feature on the map*, which becomes the
instruction (e.g. *Click a feature of USA Census Counties on the map*) with **Cancel** while waiting. Line 2 is the
feature layer list (or drawing tools) at full width. Line 3 shows the profile in use, e.g. *County Profile*;
clicking it opens Buffer and Report on (with Customise). The options start open and close
when a search starts. The result card carries Report, Copy summary, Zoom and Clear; a feature's copy-as-table and
data actions are in its expanded details. A header above the results has **Expand all / Collapse all**, and with
*Start with layer groups collapsed* (Behaviour, on by default) each layer's results start collapsed unless only one
layer has any.


The widget asks three things, top to bottom:

1. **Where**: *Point* (click the map), *Draw* (draw a polygon, rectangle or freehand shape) or *Feature* (click a
   feature of a polygon layer, e.g. a county). With Feature, a list picks the layer when there is more than one.
2. **Buffer**: a tick box. Unticked, the app's default buffer is used; ticked, users type their own distance in
   metres. For a point the buffer is a radius (never negative; 0 means the click tolerance); for a polygon it grows
   (positive) or shrinks (negative) the shape.
3. **Report on**: the profile, when there is more than one.

The main button reads *Click on the map*, *Draw on the map* or *Select feature*, and *Cancel* while waiting.
Each user's last choices (where, layer, drawing tool, buffer, profile) are remembered on their device.

Builder settings:

| Section | Settings |
|---|---|
| Search where | Tick the ways to offer and pick the default. With Draw, tick the drawing tools. |
| Feature layers | Only the offered layers are listed, each with a ★ for the default and a ⋯ menu (Edit fields, Make default, Remove); selecting one opens its fields (select all, filter, pop-up fields) in a side panel. **Choose feature layers…** opens a side panel listing the map's polygon layers with a filter, *Show ticked only*, and groups by service (map image sublayers) or group layer. Also *Feature is found when it*, *Several polygons at the point* and *Leave the area layer out of results*. |
| Default buffer (metres) | One each for feature polygons (−20), drawn polygons (0) and point radius (0), and *Users can set their own buffer*. |
| Profiles | What to report on (the profile's layer list has the same filter, *Show ticked only* and groups): cards (drag to reorder; ⋯ for Edit, Duplicate, Make default, Delete) that open a side panel with the profile's layers and fields. *Users can switch profiles*. |

Saved as `whereModes`, `defaultWhere`, `drawTools`, `areaLayers: [{ dataSourceId, fields }]`, `defaultAreaLayerId`,
`bufferFeature`, `bufferDraw`, `bufferPoint`, `allowCustomBuffer`; profiles as
`{ id, label, layerScope, layers: [{ dataSourceId, fields }], includeHiddenLayers }`.

### Customise (My setup)

With **Users can customise layers and fields** on (the default, under Profiles), a **Customise** link sits beside
*Report on*. It opens a panel listing the map's feature layers in layer-list order, grouped like the Layers widget
(group layers and map image services as headings; nested groups as one heading with their path, e.g.
*USA 2020 Census › Population*). Each group heading opens and closes, shows how many of its layers are ticked, and
has a tick box for the whole group. Lists of more than 12 layers get a filter box. Layers turned off in the map are
noted but can still be chosen. A newly ticked layer starts with its pop-up fields (or, without a pop-up, its first
four non-ID fields); open a layer to change them (select all, filter, pop-up fields; the first field is the one-line
row). **Done** saves the choice on the user's device as **My setup (based on …)**, selects it and repeats the current
search; opening Customise again edits My setup. **Reset to profile** removes it; the back arrow leaves without saving.

**Exclude layers…** (builder, under *Users can customise*) opens a side panel (filter, groups, *Show ticked only*)
where ticked layers are hidden from every user's Customise list, e.g. feeds that cannot be searched. Saved as
`customiseExclude` (data source ids); profiles are not affected.

Saved in the browser's local storage as `whats-here:<widget id>:my-setup`
(`{ baseId, baseLabel, layers: [{ dataSourceId, fields }], savedAt }`). Layers are matched to the map by data source,
so layers added at runtime cannot be chosen.

**Apps saved before 1.7** are carried over when they load: the old area layer (and any 1.6 profile area layers)
become the feature layers, the old area fields their fields, the old buffer the feature buffer (in metres), and the
old start mode the default. The builder saves the new settings the first time any of them is changed.

## Number and date formats

Values follow each layer's **popup settings** in the web map (Map Viewer › Configure pop-ups › Fields): a number
field's *thousands separator* and *decimal places*, and a date field's *date format*. This applies to the list,
details, Copy as table and the report.

Fields without popup settings keep these defaults: whole-number fields plain (so IDs and FIPS codes are never
grouped), decimal fields with separators and up to 6 places, dates in the local format. A field whose value type
is *unique identifier* stays plain even if it is a decimal field.

## Which layers are searched

Layers that are ticked on in the layer list and visible at the current scale, top of the list first:

- Feature, CSV, GeoJSON, OGC Feature, WFS, subtype group, oriented imagery, and scene layers (scene layers need an associated feature layer).
- Group layers are expanded, and so are map image layer sublayers.
- A layer is skipped if it or any of its parents is turned off, out of scale range, a table, or hidden from the layer list (`listMode: 'hide'`).
  The last rule also skips temporary graphics layers added by widgets, including this one.

Each layer's own definition expression is applied.

## Results

- The summary at the top counts the features found and the layers they came from.
- Results are grouped by layer. The layer's parent (a group or map image layer) is shown under its name.
- A feature's description is the first of these that exists:
  - its popup title, filled in from its attributes
  - its display field
  - its object ID
- Select a feature to highlight it on the map and see its attributes. The attributes are the popup's visible fields, or all fields if the layer has no popup. Coded values are shown by name and dates use the local format.
- Hover a layer heading (or tab to it) to highlight all of that layer's listed features on the map in a lighter style; hovering a feature row shows just that feature.
- The zoom button zooms to the feature. The copy button copies a plain-text summary.
- A marker shows the searched location. It is removed when you clear the results or close the map.

## Layer actions

Hover a layer heading (they are always shown on touch screens) for the actions below. In area mode the area card
(e.g. the county) has the same two actions next to its zoom button, using the area layer's own data source.

- **Copy as a table**: copies that layer's features with a column per field. Pastes as a table into email and
  documents (HTML) and into spreadsheets (tab-separated).
- **Data actions** (the dropdown): the Experience Builder data actions for that layer's results, such as
  *View in table* (needs a Table widget in the app), *Export to CSV/JSON*, and the map's *Zoom to* and *Pan to*.
  The records come from the map layer's own data source; with profile fields, the actions are given those fields.
  Turn data actions on or off, and choose which are offered, in the widget's **Action** tab in the builder
  (`manifest.properties.canConsumeDataAction`). Layers ExB does not track (added at runtime) show only the copy button.

## Report

The report button (toolbar, next to Copy summary) opens a printable page in a new tab:

- Header: the area name (or the coordinates of a point search), the area layer, buffer and rule, then the
  profile, date and time, and the signed-in user.
- A picture of the map. In area mode the map is briefly framed on the whole area for the picture, then put back
  where it was; a point search keeps the current view unless the point is off screen.
- The area polygon's attributes as *Heading: value* pairs in two columns (one block per polygon when merged).
- Counts, then a table for each layer with features, using the profile fields (or popup fields). Layers with no
  features or errors are listed by name.

The small heading at the top ("What's Here report" by default) can be set to a company or app name with
**Report heading** under Behaviour; it is also the browser tab's title.

Use **Print or save as PDF** on the page, or the browser's print, for a PDF. If nothing opens, allow pop-ups for
the site. Turn the button off with **Report button** under Behaviour.

## Map Context Menu hand-off

1. In the Map Context Menu settings, add a menu item and set its action to **What's here?**.
2. Choose this widget as the target.
3. Right-clicking the map now writes `mutableStateProps.whatsHereRequest` to this widget and opens it:

```ts
{ requestId, sourceWidgetId, source: 'map-context-menu', latitude, longitude, mapX, mapY, wkid }
```

The widget also accepts the generic `mapContext` payload sent by the menu's *Open widget* action. It clears the request once it has used it, so reopening the widget does not repeat the search. If `wkid` matches the view's spatial reference, the widget uses `mapX`/`mapY`. Otherwise it uses latitude/longitude.

## Map interaction

While selecting, the widget takes control of the map with `requestAutoControlMapWidget`. The map's own popup does not open for that click. Select mode ends when any of these happens:

- you press Esc, or select **Cancel**
- the widget is closed
- the map is hidden
- another widget takes control of the map

## Accessibility

- The buttons have labels.
- Layer groups and feature rows use `aria-expanded`.
- Search progress and results are announced through a polite live region.
- Colours come from the app theme's `sys` tokens.

## Tests

```
npx jest your-extensions/widgets/whats-here
```

## Licence

[MIT](LICENSE)
