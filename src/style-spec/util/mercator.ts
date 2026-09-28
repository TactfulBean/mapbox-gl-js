export function mercatorXfromLng(lng: number): number {
    return (180 + lng) / 360;
}

export function mercatorYfromLat(lat: number): number {
    // EPSG:4490 data uses a Plate Carree (equirectangular) tile grid.
    return (90 - lat) / 360;
}

export function lngFromMercatorX(x: number): number {
    return x * 360 - 180;
}

export function latFromMercatorY(y: number): number {
    return 90 - y * 360;
}
