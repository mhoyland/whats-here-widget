import * as reactiveUtils from 'esri/core/reactiveUtils'

const SETTLE_MS = 250
const MAX_WAIT_MS = 8000

const wait = (ms: number) => new Promise(resolve => { window.setTimeout(resolve, ms) })

/** Resolves once the view has finished drawing, or after a time limit so a slow layer never blocks the report. */
const whenDrawn = async (view: __esri.MapView | __esri.SceneView) => {
  // goTo() returns before layers start fetching, so give them a moment to report that they are updating.
  await wait(SETTLE_MS)
  await Promise.race([reactiveUtils.whenOnce(() => !view.updating), wait(MAX_WAIT_MS)])
}

/**
 * A PNG of the map for the report. An area is framed so all of it shows; a point is kept in view.
 * The user's view is put back afterwards. Returns null if the screenshot fails (e.g. tainted canvas).
 */
export const captureMap = async (view: __esri.MapView | __esri.SceneView, target: __esri.Geometry | null): Promise<string | null> => {
  if (!view) return null
  const saved = view.viewpoint?.clone()
  let moved = false
  try {
    if (target?.type === 'point') {
      if (!view.extent?.contains(target as __esri.Point)) {
        await view.goTo(target as __esri.Point, { animate: false })
        moved = true
      }
    } else if (target?.extent) {
      await view.goTo(target.extent.clone().expand(1.15), { animate: false })
      moved = true
    }
    if (moved) await whenDrawn(view)
    const screenshot = await view.takeScreenshot({ format: 'png' })
    return screenshot?.dataUrl ?? null
  } catch (err) {
    console.warn("What's Here: could not capture the map for the report.", err)
    return null
  } finally {
    if (moved && saved) void view.goTo(saved, { animate: false }).catch(() => null)
  }
}
