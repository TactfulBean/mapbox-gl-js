/**
 * Rewrites the hard-coded Web Mercator latitude formulas used by the data
 * indexing dependencies when building the EPSG:4490 variant.
 */
import type {Plugin, PluginContext} from 'rollup';

const VECTOR_TILE_ANCHOR = `360 / Math.PI * Math.atan(Math.exp((1 - (p.y + y0) * 2 / size) * Math.PI)) - 90`;
const GEOJSON_VT_ANCHOR = `const sin = Math.sin(y * Math.PI / 180);\n    const y2 = 0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;\n    const yc = y2 < 0 ? 0 : y2 > 1 ? 1 : y2;`;
const SUPERCLUSTER_LAT_Y_ANCHOR = `const sin = Math.sin(lat * Math.PI / 180);\n    const y = (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);\n    return y < 0 ? 0 : y > 1 ? 1 : y;`;
const SUPERCLUSTER_Y_LAT_ANCHOR = `const y2 = (180 - y * 360) * Math.PI / 180;\n    return 360 * Math.atan(Math.exp(y2)) / Math.PI - 90;`;

function replaceOnce(plugin: Pick<PluginContext, 'error'>, code: string, anchor: string, replacement: string, id: string): string {
    const matches = code.split(anchor).length - 1;
    if (matches !== 1) {
        plugin.error(`EPSG:4490 patch anchor matched ${matches} times in ${id}`);
    }
    return code.replace(anchor, replacement);
}

export function epsg4490Patches(): Plugin {
    return {
        name: 'epsg4490-patches',
        transform(code, id) {
            const normalizedId = id.replace(/\\/g, '/');

            if (normalizedId.includes('/@mapbox/vector-tile/') && normalizedId.endsWith('/index.js')) {
                return {
                    code: replaceOnce(this, code, VECTOR_TILE_ANCHOR, '90 - (p.y + y0) * 360 / size', id),
                    map: null
                };
            }

            if (normalizedId.includes('/geojson-vt/') && normalizedId.endsWith('/src/convert.js')) {
                return {
                    code: replaceOnce(this, code, GEOJSON_VT_ANCHOR,
                        'const y2 = 0.25 - y / 360;\n    const yc = y2 < 0 ? 0 : y2 > 0.5 ? 0.5 : y2;', id),
                    map: null
                };
            }

            if (normalizedId.includes('/supercluster/') && normalizedId.endsWith('/index.js')) {
                let patched = replaceOnce(this, code, SUPERCLUSTER_LAT_Y_ANCHOR,
                    'const y = 0.25 - lat / 360;\n    return y < 0 ? 0 : y > 0.5 ? 0.5 : y;', id);
                patched = replaceOnce(this, patched, SUPERCLUSTER_Y_LAT_ANCHOR,
                    'return 90 - y * 360;', id);
                return {code: patched, map: null};
            }

            return null;
        }
    };
}
