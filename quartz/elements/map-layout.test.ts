import test from "node:test"
import assert from "node:assert/strict"
import { mapLayout, project } from "./map-layout"

test("Mercator projection matches the equator and clamps polar coordinates", () => {
  assert.deepEqual(project({ lat: 0, lng: 0 }), { x: 0.5, y: 0.5 })
  assert.ok(Math.abs(project({ lat: 90, lng: 0 }).y) < 1e-12)
  assert.ok(Math.abs(project({ lat: -90, lng: 0 }).y - 1) < 1e-12)
  assert.equal(project({ lat: 0, lng: 180 }).x, project({ lat: 0, lng: -180 }).x)
})

test("explicit center projects its point to the viewport center and wraps tile coordinates", () => {
  const point = { lat: 40.73, lng: -73.99 }
  const layout = mapLayout([point], 800, 450, point, 12)
  assert.deepEqual(layout.markers[0], { x: 400, y: 225 })
  for (const { tiles, zoom } of [layout, mapLayout([], 800, 450, { lat: 90, lng: 180 }, 0)]) {
    assert.ok(tiles.length < 20)
    for (const tile of tiles) {
      assert.ok(tile.x >= 0 && tile.x < 2 ** zoom)
      assert.ok(tile.y >= 0 && tile.y < 2 ** zoom)
    }
  }
})

test("auto-fit keeps nearby and date-line points inside the viewport", () => {
  for (const points of [
    [
      { lat: 40.73, lng: -73.99 },
      { lat: 40.75, lng: -74 },
    ],
    [
      { lat: 10, lng: 179.9 },
      { lat: 10.1, lng: -179.9 },
    ],
    [
      { lat: 51, lng: -1 },
      { lat: -33, lng: 151 },
    ],
    [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0 },
    ],
  ]) {
    const layout = mapLayout(points, 800, 450)
    for (const marker of layout.markers) {
      assert.ok(marker.x >= 40 && marker.x <= 760, JSON.stringify(layout))
      assert.ok(marker.y >= 40 && marker.y <= 410, JSON.stringify(layout))
    }
  }
  assert.ok(
    mapLayout(
      [
        { lat: 10, lng: 179.9 },
        { lat: 10, lng: -179.9 },
      ],
      800,
      450,
    ).zoom > 8,
  )
})
