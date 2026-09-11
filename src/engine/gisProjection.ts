import type { Point2D } from '../types';

export interface BoundingBoxGPS {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS = 6378137; // WGS84 Earth radius in meters

/**
 * Projects GPS (Latitude, Longitude) coordinates into local Cartesian metric coordinates (X, Y)
 * centered at a local reference point (lat0, lon0).
 * Output unit: 1.0 = 1.0 meter.
 */
export function projectLatLonToMeters(
  coord: LatLon,
  origin: LatLon
): Point2D {
  const dLat = (coord.lat - origin.lat) * (Math.PI / 180);
  const dLon = (coord.lon - origin.lon) * (Math.PI / 180);
  const latRad = origin.lat * (Math.PI / 180);

  const x = dLon * Math.cos(latRad) * EARTH_RADIUS;
  const y = dLat * EARTH_RADIUS;

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

/**
 * Reverse projection: Converts local Cartesian metric coordinates (X, Y) back to GPS (Lat, Lon)
 */
export function projectMetersToLatLon(
  point: Point2D,
  origin: LatLon
): LatLon {
  const latRad = origin.lat * (Math.PI / 180);
  const dLat = point.y / EARTH_RADIUS;
  const dLon = point.x / (EARTH_RADIUS * Math.cos(latRad));

  return {
    lat: origin.lat + dLat * (180 / Math.PI),
    lon: origin.lon + dLon * (180 / Math.PI),
  };
}

/**
 * Calculates real-world dimensions in meters of a GPS Bounding Box
 */
export function getBoundingBoxDimensions(bbox: BoundingBoxGPS): {
  widthMeters: number;
  heightMeters: number;
  areaHectares: number;
  center: LatLon;
} {
  const centerLat = (bbox.south + bbox.north) / 2;
  const centerLon = (bbox.west + bbox.east) / 2;
  const center = { lat: centerLat, lon: centerLon };

  const sw = projectLatLonToMeters({ lat: bbox.south, lon: bbox.west }, center);
  const ne = projectLatLonToMeters({ lat: bbox.north, lon: bbox.east }, center);

  const widthMeters = Math.abs(ne.x - sw.x);
  const heightMeters = Math.abs(ne.y - sw.y);
  const areaM2 = widthMeters * heightMeters;
  const areaHectares = Math.round((areaM2 / 10000) * 10) / 10;

  return {
    widthMeters: Math.round(widthMeters),
    heightMeters: Math.round(heightMeters),
    areaHectares,
    center,
  };
}

/**
 * Generates an aerial satellite orthophoto URL from Esri World Imagery REST service
 * for a specific GPS bounding box.
 */
export function getSatelliteTextureUrl(
  bbox: BoundingBoxGPS,
  width = 1024,
  height = 1024
): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=jpg&f=image`;
}

/**
 * Generates a crisp reference street map image URL from Esri World Street Map REST service
 * for a specific GPS bounding box. Shows road alignments, street names, intersections, and building footprints.
 */
export function getStreetMapTextureUrl(
  bbox: BoundingBoxGPS,
  width = 1024,
  height = 1024
): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/export?bbox=${bbox.west},${bbox.south},${bbox.east},${bbox.north}&bboxSR=4326&imageSR=4326&size=${width},${height}&format=png&f=image`;
}
