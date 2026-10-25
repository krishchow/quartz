export interface Coordinate {
  lat: number
  lng: number
}

const tileSize = 256
const maxLatitude = 85.0511287798066
const wrap = (value: number) => ((value % 1) + 1) % 1
const nearest = (value: number, center: number) => center + wrap(value - center + 0.5) - 0.5

export function project({ lat, lng }: Coordinate) {
  const latitude = (Math.max(-maxLatitude, Math.min(maxLatitude, lat)) * Math.PI) / 180
  return { x: wrap((lng + 180) / 360), y: (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2 }
}

/** Fit the shortest longitude arc, so points across the date line stay together. */
export function mapLayout(
  points: Coordinate[],
  width: number,
  height: number,
  center?: Coordinate,
  zoom?: number,
) {
  const projected = points.map(project)
  let middle = project(center ?? { lat: 0, lng: 0 })
  if (!center && projected.length) {
    const xs = projected.map((point) => point.x).sort((a, b) => a - b)
    let gapIndex = 0
    let largestGap = -1
    for (let index = 0; index < xs.length; index++) {
      const gap = (index === xs.length - 1 ? xs[0] + 1 : xs[index + 1]) - xs[index]
      if (gap > largestGap) {
        largestGap = gap
        gapIndex = index
      }
    }
    const start = xs[(gapIndex + 1) % xs.length]
    let end = xs[gapIndex]
    if (end < start) end += 1
    const ys = projected.map((point) => point.y)
    middle = { x: wrap((start + end) / 2), y: (Math.min(...ys) + Math.max(...ys)) / 2 }
  }
  let level = zoom ?? (points.length === 0 ? 2 : points.length === 1 ? 13 : 15)
  if (zoom === undefined && projected.length > 1) {
    while (level > 0) {
      const size = tileSize * 2 ** level
      const fits = projected.every(
        (point) =>
          Math.abs(nearest(point.x, middle.x) - middle.x) * size <= width / 2 - 40 &&
          Math.abs(point.y - middle.y) * size <= height / 2 - 40,
      )
      if (fits) break
      level--
    }
  }
  const count = 2 ** level
  const size = tileSize * count
  const left = middle.x * size - width / 2
  const top = middle.y * size - height / 2
  const tiles = []
  for (
    let y = Math.max(0, Math.floor(top / tileSize));
    y < Math.min(count, Math.ceil((top + height) / tileSize));
    y++
  ) {
    for (let x = Math.floor(left / tileSize); x < Math.ceil((left + width) / tileSize); x++) {
      tiles.push({
        x: ((x % count) + count) % count,
        y,
        left: x * tileSize - left,
        top: y * tileSize - top,
      })
    }
  }
  return {
    zoom: level,
    tiles,
    markers: projected.map((point) => ({
      x: (nearest(point.x, middle.x) - middle.x) * size + width / 2,
      y: (point.y - middle.y) * size + height / 2,
    })),
  }
}
