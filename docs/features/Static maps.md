---
title: Static maps
---

Use a `Map` element with nested `Point` elements to show places in a post. Markers are numbered to match the place list below the map.

```xml
<Map title="An afternoon in Manhattan">
  <Point lat="40.7308" lng="-73.9973" label="Washington Square Park" />
  <Point lat="40.7336" lng="-73.9906" label="Strand Book Store" />
</Map>
```

<Map title="An afternoon in Manhattan">
  <Point lat="40.7308" lng="-73.9973" label="Washington Square Park" />
  <Point lat="40.7336" lng="-73.9906" label="Strand Book Store" />
</Map>

The map fits all points automatically. A single point defaults to zoom 13; an empty map defaults to a world overview. You can set the viewport explicitly:

```xml
<Map
  title="Places to visit"
  center='[40.732, -73.994]'
  zoom="14"
  width="800"
  height="450"
>
  <Point lat="40.7308" lng="-73.9973" label="Washington Square Park" />
  <Point lat="40.7336" lng="-73.9906" label="Strand Book Store" />
</Map>
```

`center` uses **[latitude, longitude]**. Zoom is an integer from 0 to 19. Width (256–1600) and height (180–1200) set the layout dimensions and aspect ratio; the map scales to fit the article on smaller screens. Explicit center or zoom can place points outside the viewport; they remain in the place list. Points across the international date line are fitted using the shortest longitude span. The Mercator basemap clamps polar latitudes to approximately ±85.05°.

Each `Point` requires numeric `lat` (−90 to 90) and `lng` (−180 to 180). Labels are optional, defaulting to “Point 1”, “Point 2”, and so on. XML escaping applies, for example `label="Coffee &amp; tea"`. Build errors identify invalid coordinates, unknown props, malformed XML, and misplaced children. `Point` can appear only directly inside `Map`, and `Map` accepts only points and whitespace.

The markup and marker positions are generated at build time. No map JavaScript, API key, geocoding, panning, or zoom controls are involved. Basemap images are loaded lazily by the visitor's browser from OpenStreetMap; they are not downloaded during the build or embedded for offline use. The map includes visible attribution, and uses normal browser caching and referrers in accordance with the [OpenStreetMap tile policy](https://operations.osmfoundation.org/policies/tiles/). The list of places remains available if tile images cannot load.

Definitions live in `quartz/elements/Map.tsx`; the `mapTileProvider` configuration there can be changed when using another raster tile provider. Coordinate projection and automatic fitting live in `quartz/elements/map-layout.ts`.
