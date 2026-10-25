// Dwindle tiling, as in Hyprland: the first tile takes `mainRatio` of the area, split
// along its longer side; every following tile splits what's left in half the same way.
// Rects are fractions (0..1) of the container, so the layout scales with it.

export interface TileFrame {
  x: number
  y: number
  w: number
  h: number
}

/** An item TilingLayout arranges. */
export interface TilingItem {
  id: string
  // Accessible name, e.g. "Maya's camera"
  label: string
  // Becomes the main tile when it first appears (screen shares)
  main?: boolean
}

export interface DwindleResult {
  frames: Record<string, TileFrame>
  // The main split, for drawing its drag handle; absent with fewer than two tiles
  mainSplit?: { axis: 'x' | 'y', at: number, span: TileFrame }
}

/**
 * Lay out tiles in a container of the given aspect (width / height). The aspect decides
 * which way each split goes, so a tall container stacks and a wide one goes side by side.
 */
export function dwindle(ids: string[], aspect: number, mainRatio: number): DwindleResult {
  const frames: Record<string, TileFrame> = {}
  let mainSplit: DwindleResult['mainSplit']
  let rest: TileFrame = { x: 0, y: 0, w: 1, h: 1 }

  ids.forEach((id, i) => {
    if (i === ids.length - 1) {
      frames[id] = rest
      return
    }
    const ratio = i === 0 ? mainRatio : 0.5
    // Compare real proportions: a 1x1 fraction of a 16:9 container is wide, not square
    const splitSideways = rest.w * aspect >= rest.h
    if (splitSideways) {
      const cut = rest.w * ratio
      frames[id] = { x: rest.x, y: rest.y, w: cut, h: rest.h }
      if (i === 0) mainSplit = { axis: 'x', at: rest.x + cut, span: rest }
      rest = { x: rest.x + cut, y: rest.y, w: rest.w - cut, h: rest.h }
    } else {
      const cut = rest.h * ratio
      frames[id] = { x: rest.x, y: rest.y, w: rest.w, h: cut }
      if (i === 0) mainSplit = { axis: 'y', at: rest.y + cut, span: rest }
      rest = { x: rest.x, y: rest.y + cut, w: rest.w, h: rest.h - cut }
    }
  })

  return { frames, mainSplit }
}

// Ids kept in the remembered order, so a tile that's away for a while (camera off,
// reload) comes back to its spot; the oldest absent ones fall off past this
const MAX_REMEMBERED = 50

/**
 * The remembered order with this update's items folded in: known ids keep their place
 * even while absent, new ids are appended, and new `main` items (screen shares) go in
 * front of everything currently shown.
 */
export function orderTiles(items: TilingItem[], order: string[], seen: Set<string>): string[] {
  const present = new Set(items.map(item => item.id))
  const next = [...order]
  for (const item of items) {
    if (next.includes(item.id)) continue
    if (item.main && !seen.has(item.id)) {
      const firstShown = next.findIndex(id => present.has(id))
      next.splice(firstShown < 0 ? next.length : firstShown, 0, item.id)
    } else {
      next.push(item.id)
    }
  }
  while (next.length > MAX_REMEMBERED) {
    const stale = next.findIndex(id => !present.has(id))
    if (stale < 0) break
    next.splice(stale, 1)
  }
  return next
}

export function swapTiles(order: string[], a: string, b: string): string[] {
  const next = [...order]
  const i = next.indexOf(a)
  const j = next.indexOf(b)
  if (i < 0 || j < 0) return order
  next[i] = b
  next[j] = a
  return next
}
