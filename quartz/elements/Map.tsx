import type { ElementRegistry } from "./types"
import { mapLayout } from "./map-layout"

/** Replace the provider here if you use a different raster tile service. */
export const mapTileProvider = {
  url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  attributionUrl: "https://www.openstreetmap.org/copyright",
}

export const mapElements: ElementRegistry = {
  Map: {
    description:
      "A static geographic map with numbered markers and a place list. No browser map JavaScript.",
    examples: [
      '<Map title="Places to visit">\n  <Point lat="40.7308" lng="-73.9973" label="Park" />\n  <Point lat="40.7336" lng="-73.9906" label="Bookshop" />\n</Map>',
      `<Map title="Manhattan" center='[40.732, -73.994]' zoom="14" width="800" height="450">\n  <Point lat="40.7308" lng="-73.9973" label="Park" />\n</Map>`,
    ],
    notes: [
      "Omit center and zoom to fit the points automatically. A single point defaults to zoom 13; an empty map defaults to zoom 2.",
      "Basemap images load lazily from OpenStreetMap in the visitor's browser; an internet connection is needed for the background.",
      "Width and height set the layout aspect ratio; the map scales to fit the article. Explicit center or zoom may put points outside the view.",
      "Mercator projection clamps polar latitudes to approximately ±85.05 degrees.",
    ],
    constraints: [
      "center must be a JSON array [latitude, longitude] of exactly two finite numbers, with latitude in [-90, 90] and longitude in [-180, 180].",
    ],
    content: "data",
    childElements: ["Point"],
    props: {
      center: { type: "json", description: "Optional viewport center as [latitude, longitude]." },
      zoom: {
        type: "number",
        integer: true,
        min: 0,
        max: 19,
        description: "Optional fixed map zoom level.",
      },
      width: {
        type: "number",
        integer: true,
        min: 256,
        max: 1600,
        default: 800,
        description: "Layout width in pixels before responsive scaling.",
      },
      height: {
        type: "number",
        integer: true,
        min: 180,
        max: 1200,
        default: 450,
        description: "Layout height in pixels before responsive scaling.",
      },
      title: {
        type: "string",
        default: "Map",
        description: "Accessible map title and visible caption.",
      },
    },
    validate: ({ center }) => {
      if (center === undefined) return
      if (
        !Array.isArray(center) ||
        center.length !== 2 ||
        !center.every((value) => typeof value === "number" && Number.isFinite(value)) ||
        Math.abs(center[0]) > 90 ||
        Math.abs(center[1]) > 180
      ) {
        throw new Error(
          "Map center must be [latitude, longitude], within [-90, 90] and [-180, 180]",
        )
      }
    },
    render: ({ center, zoom, width, height, title }, _, { elements }) => {
      const w = Number(width)
      const h = Number(height)
      const points = elements.map(({ props }, index) => ({
        lat: Number(props.lat),
        lng: Number(props.lng),
        label: String(props.label || `Point ${index + 1}`),
      }))
      const coordinates = center as number[] | undefined
      const layout = mapLayout(
        points,
        w,
        h,
        coordinates ? { lat: coordinates[0], lng: coordinates[1] } : undefined,
        zoom === undefined ? undefined : Number(zoom),
      )
      return (
        <figure class="md-map">
          <div class="md-map__viewport" style={{ aspectRatio: `${w} / ${h}` }}>
            <div aria-hidden="true">
              {layout.tiles.map((tile) => (
                <img
                  class="md-map__tile"
                  src={mapTileProvider.url
                    .replace("{z}", String(layout.zoom))
                    .replace("{x}", String(tile.x))
                    .replace("{y}", String(tile.y))}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerpolicy="strict-origin-when-cross-origin"
                  width="256"
                  height="256"
                  style={{
                    left: `${(tile.left / w) * 100}%`,
                    top: `${(tile.top / h) * 100}%`,
                    width: `${(256 / w) * 100}%`,
                    height: `${(256 / h) * 100}%`,
                  }}
                />
              ))}
            </div>
            <svg
              class="md-map__markers"
              viewBox={`0 0 ${w} ${h}`}
              role="img"
              aria-label={String(title)}
            >
              <title>{String(title)}</title>
              {layout.markers.map((marker, index) => (
                <g transform={`translate(${marker.x} ${marker.y})`}>
                  <title>{`${index + 1}. ${points[index].label}`}</title>
                  <circle r="15" fill="#284b63" stroke="white" stroke-width="2" />
                  <text
                    text-anchor="middle"
                    dominant-baseline="central"
                    fill="white"
                    font-size="13"
                    font-family="sans-serif"
                    font-weight="bold"
                  >
                    {index + 1}
                  </text>
                </g>
              ))}
            </svg>
            <a class="md-map__attribution" href={mapTileProvider.attributionUrl}>
              {mapTileProvider.attribution}
            </a>
          </div>
          <figcaption>
            <strong>{String(title)}</strong>
            {points.length > 0 && (
              <ol class="md-map__places">
                {points.map((point) => (
                  <li>{point.label}</li>
                ))}
              </ol>
            )}
          </figcaption>
        </figure>
      )
    },
    css: `
      .md-map { margin: 1.5rem 0; }
      .md-map__viewport { position: relative; overflow: hidden; isolation: isolate; border: 1px solid var(--lightgray); border-radius: .5rem; background: #dce8ec; }
      .md-map .md-map__tile { position: absolute; max-width: none; margin: 0; border-radius: 0; }
      .md-map__markers { position: absolute; inset: 0; width: 100%; height: 100%; }
      .md-map .md-map__attribution { position: absolute; right: 0; bottom: 0; padding: .15rem .35rem; background: #fff; color: #284b63; font: 11px/1.4 sans-serif; border-radius: .25rem 0 0; }
      .md-map > figcaption { margin-top: .5rem; }
      .md-map__places { margin: .4rem 0 0; padding-left: 1.5rem; }
    `,
  },
  Point: {
    description: "One geographic place consumed by its parent Map; cannot be rendered on its own.",
    examples: [
      '<Map title="A place">\n  <Point lat="40.7308" lng="-73.9973" label="Coffee &amp; tea" />\n</Map>',
    ],
    notes: [
      "Keep points directly inside Map. Labels default to Point 1, Point 2, and so on when omitted or empty.",
    ],
    dataOnly: true,
    parents: ["Map"],
    props: {
      lat: {
        type: "number",
        required: true,
        min: -90,
        max: 90,
        description: "Latitude in degrees.",
      },
      lng: {
        type: "number",
        required: true,
        min: -180,
        max: 180,
        description: "Longitude in degrees.",
      },
      label: {
        type: "string",
        default: "",
        description: "Place name shown in the numbered list and marker tooltip.",
      },
    },
  },
}
