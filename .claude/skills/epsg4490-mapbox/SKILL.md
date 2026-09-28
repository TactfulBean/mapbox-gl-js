---
name: epsg4490-mapbox
description: Adapt or compare Mapbox GL JS versions for EPSG:4490 geographic tile services. Use when migrating the 3.19.0-4490 changes to another Mapbox GL JS version, debugging 4490 tile URLs, or checking zoom, row, bbox, projection, and tile-indexing behavior.
---

# EPSG:4490 Mapbox GL JS

Use this skill when adapting a Mapbox GL JS source tree or comparing it with a known 4490-enabled bundle. Preserve the target version's architecture and unrelated local changes. Treat EPSG:4490 support as a distinct compatibility change: several projection and indexing functions are shared by ordinary Web Mercator maps.

## Compare versions

Find the baseline artifact and the corresponding 4490-enabled artifact first. They may be bundled JavaScript files, source trees, or build outputs. Record which artifact is the baseline and which contains the 4490 behavior before comparing them.

Minified bundles are useful to identify behavior, not to copy wholesale. Search for `canonical.url`, `{z}`, `{y}`, `{bbox-epsg-3857}`, `zoomOffset`, projection conversion functions, and the vector-tile/GeoJSON indexing formulas. Then locate and read the corresponding source and tests in both source trees. Check target-version history or blame when an existing calculation is unclear.

The verified 3.19.0-4490 URL rules are:

```ts
{z} = canonical.z + (zoomOffset || 0)
{x} = canonical.x
{y} = scheme === 'tms'
    ? (canonical.z === 0 ? 0 : 2 ** (canonical.z - 1) - 1 - canonical.y)
    : canonical.y
```

The 4490 grid has `2^z` columns and `2^(z-1)` rows for `z > 0`. The URL template uses `canonical.z`, not `overscaledZ`: above a source's `maxzoom`, overzooming does not by itself increase `{z}`. The service zoom offset changes only URL substitution; it does not change the map's canonical tile ID, camera zoom, or internal x/y tile coordinates. For example, if canonical map zoom 5 must request service zoom 6, use `zoomOffset: 1`. Do not guess the offset: confirm it from a working service URL, TileJSON, or known tile coordinates.

The legacy `{bbox-epsg-3857}` token in the 4490 bundle resolves to geographic bounds in degrees:

```ts
const size = 360 / 2 ** z;
const bbox = [
    x * size - 180,
    90 - (y + 1) * size,
    (x + 1) * size - 180,
    90 - y * size
].join(',');
```

Despite the token name, this is not an EPSG:3857 meter bbox in that variant.

## Migrate the source changes

Adapt these responsibilities to the target version's current structure; names and call sites can move between releases:

1. **Tile URL generation:** update `CanonicalTileID.url()` in `src/source/tile_id.ts` for the 4490 `{z}`, TMS `{y}`, and bbox rules. Keep ordinary XYZ y unchanged. Check callers before changing the method signature.
2. **Source options:** vector, raster, and raster-dem sources need a default `zoomOffset` of `0`, must accept the source option, and must pass it when generating tile URLs. The 3.19.0-4490 bundle applies it to these three types. Its raster-array source does not pass `zoomOffset`; treat that as a reference-version fact, not a universal limitation. If the target service requires it for raster-array, verify both normal tile loading and query loading build URLs with the same resolved offset.
3. **TileJSON:** retain `zoomOffset` when picking TileJSON properties and add it to the TileJSON type. Source-level options take precedence over TileJSON values. Confirm the metadata merge assigns the resolved value onto the live source.
4. **Style specification:** add `zoomOffset` to the supported source schemas and TypeScript source types where appropriate. Follow the target version's schema conventions, including `sdk-support` and `experimental` metadata requirements. Regenerate generated style types rather than hand-editing generated outputs.
5. **Projection:** the 4490 variant uses the equirectangular/Plate Carrée latitude mapping `y = (90 - latitude) / 360`, its inverse `latitude = 90 - y * 360`, and allows latitudes through both poles. Adapt `MercatorCoordinate`, projection classes, constants, and style-spec conversion helpers only after tracing their consumers.
6. **Data indexing dependencies:** the 4490 build patches Web-Mercator latitude calculations used by `@mapbox/vector-tile`, `geojson-vt`, and `supercluster`. Find the target release's corresponding formulas and patch those exact dependency modules during the build. Use guarded, uniquely checked anchors so dependency upgrades fail visibly when code changes.

## Keep ordinary builds compatible

The 3.19.0-4490 bundle provides evidence of the intended 4490 behavior, but it does not make every change safe as a default in a general Mapbox GL JS build. In particular, changing `MercatorCoordinate`, `style-spec` Mercator helpers, the global tile bbox token, or dependency indexing changes behavior beyond a single 4490 source.

Before migrating, decide whether the output is a dedicated 4490 build or a general build that must continue to support EPSG:3857. For a dedicated variant, keep all related projection and indexing changes consistent. For a general build, isolate behavior behind an explicit projection/build option where the target architecture allows it; do not install unconditional dependency rewrites in shared Rollup plugins without confirming their effect on standard builds. Do not leave the engine half-converted: tile selection, projection conversion, worker indexing, and rendered geometry must use the same grid.

## Debug a service that still fails

Inspect the final request URL in browser Network tools and work through these checks:

- Verify whether `{z}` is replaced with the expected service zoom. Configure a signed numeric `zoomOffset` only when the service's zoom numbering differs from the map's canonical zoom.
- Verify whether the service uses XYZ or the 4490 half-height TMS row convention. A 404 at one edge can indicate a wrong `{y}` scheme even when `{z}` and `{x}` are correct.
- Verify the service matrix profile and expected bbox units. A server may use a different origin, row count, or tile matrix identifier from the assumptions above.
- Check whether the style source is vector, raster, raster-dem, or raster-array; confirm its actual load path passes the intended values.
- Separate URL/HTTP errors from projection/indexing errors. Correct tile bytes with displaced or clipped features point to projection or worker-indexing behavior, not necessarily `{z}`.

Do not infer a service's offset, matrix profile, or row scheme solely from “EPSG:4490”. If the actual service URL, TileJSON, or a known-good `{z}/{x}/{y}` request is unavailable, document what remains unconfirmed.

## Tests and build checks

Add focused tests for observable behavior in the target version:

- URL substitution with zero and nonzero zoom offsets, including repeated `{z}` tokens.
- 4490 TMS rows at zoom 0 and at a zoom with multiple rows; ordinary XYZ y remains unchanged.
- The bbox values and coordinate order for a known tile.
- TileJSON `zoomOffset` propagation and explicit source-option precedence.
- At least one vector or raster load-path test asserting the requested URL uses the offset.
- Projection and indexing conversions at the equator, representative mid-latitudes, and both poles, where those modules changed.

Run focused tests first, then use the repository-required checks for the target version. For this repository, schema/type changes require `npm run codegen` and `npm run test-typings`; finish with `npm run tsc`, `npm run lint`, and a suitable development build. Review generated diffs and build the ordinary configuration too when the same build plugins are shared. Compare a second-version baseline for standards compatibility if 4490 behavior was made unconditional.
