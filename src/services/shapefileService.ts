/**
 * Shapefile Import Service
 * Parses .shp/.zip files using shpjs and converts GeoJSON features
 * into BlueprintElement civil infrastructure for 2D/3D rendering.
 */
import type { BlueprintElement } from '../types';
import type { BoundingBoxGPS } from '../engine/gisProjection';
import { projectLatLonToMeters } from '../engine/gisProjection';

export interface ShapefileImportResult {
  elements: BlueprintElement[];
  bbox: BoundingBoxGPS;
  featureCount: number;
  layerName: string;
}

type GeoJSONGeometry =
  | { type: 'Point'; coordinates: [number, number] }
  | { type: 'LineString'; coordinates: [number, number][] }
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][]}
  | { type: 'MultiLineString'; coordinates: [number, number][][]};

type GeoJSONFeature = {
  type: 'Feature';
  geometry: GeoJSONGeometry | null;
  properties: Record<string, unknown> | null;
};

type GeoJSONFeatureCollection = {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
};

function inferElementType(props: Record<string, unknown>): BlueprintElement['type'] {
  const name = Object.values(props).join(' ').toLowerCase();
  if (name.includes('road') || name.includes('highway') || name.includes('street') || name.includes('marg')) return 'road';
  if (name.includes('bridge') || name.includes('flyover') || name.includes('viaduct')) return 'bridge_deck';
  if (name.includes('park') || name.includes('garden') || name.includes('water') || name.includes('lake') || name.includes('pond')) return 'ground';
  if (name.includes('boundary') || name.includes('plot') || name.includes('parcel') || name.includes('zone')) return 'boundary';
  return 'building';
}

function inferGroundType(props: Record<string, unknown>): string {
  const name = Object.values(props).join(' ').toLowerCase();
  if (name.includes('water') || name.includes('lake') || name.includes('river') || name.includes('pond') || name.includes('reservoir')) return 'water';
  if (name.includes('parking') || name.includes('carpark')) return 'parking';
  if (name.includes('plaza') || name.includes('square') || name.includes('chowk')) return 'plaza';
  return 'park';
}

function computeGeoJSONBbox(features: GeoJSONFeature[]): BoundingBoxGPS {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;

  function processCoords(coords: unknown[]): void {
    if (typeof coords[0] === 'number') {
      const [lon, lat] = coords as [number, number];
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      if (lon < west) west = lon;
      if (lon > east) east = lon;
    } else {
      (coords as unknown[][]).forEach(processCoords);
    }
  }

  features.forEach(f => {
    if (!f.geometry) return;
    if ('coordinates' in f.geometry) {
      processCoords(f.geometry.coordinates as unknown[]);
    }
  });

  return { south, west, north, east };
}

function extractCoordRings(geometry: GeoJSONGeometry): [number, number][][] {
  if (geometry.type === 'Polygon') return geometry.coordinates;
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(1);
  if (geometry.type === 'LineString') return [geometry.coordinates];
  if (geometry.type === 'MultiLineString') return geometry.coordinates;
  return [];
}

export async function importShapefile(file: File): Promise<ShapefileImportResult> {
  const shpjs = await import('shpjs');
  const parse = (shpjs.default ?? shpjs) as unknown as (buf: ArrayBuffer) => Promise<GeoJSONFeatureCollection | GeoJSONFeatureCollection[]>;

  const arrayBuffer = await file.arrayBuffer();

  let geojson: GeoJSONFeatureCollection | GeoJSONFeatureCollection[];
  try {
    geojson = await parse(arrayBuffer);
  } catch (err) {
    throw new Error(`Failed to parse shapefile: ${(err as Error).message}`);
  }

  const collections: GeoJSONFeatureCollection[] = Array.isArray(geojson) ? geojson : [geojson];
  const allFeatures: GeoJSONFeature[] = collections.flatMap(c => c.features || []);

  if (allFeatures.length === 0) {
    throw new Error('No features found in shapefile.');
  }

  const bbox = computeGeoJSONBbox(allFeatures);

  if (!isFinite(bbox.south) || !isFinite(bbox.north)) {
    throw new Error('Shapefile contains no valid coordinate data.');
  }

  const origin = {
    lat: (bbox.south + bbox.north) / 2,
    lon: (bbox.west + bbox.east) / 2,
  };

  const elements: BlueprintElement[] = [];
  let elementIdx = 0;

  for (const feature of allFeatures) {
    if (!feature.geometry) continue;
    const geom = feature.geometry;
    const props = feature.properties || {};

    const elemType = inferElementType(props);
    const coordRings = extractCoordRings(geom);

    if (coordRings.length === 0) continue;

    for (const ring of coordRings) {
      if (ring.length < 2) continue;

      const points = ring
        .slice(0, 500)
        .map(([lon, lat]) => projectLatLonToMeters({ lat, lon }, origin));

      if (points.length < 2) continue;

      const nameVal = (props['name'] || props['NAME'] || props['Name'] || props['LABEL'] || '') as string;
      const heightVal = Number(props['height'] || props['HEIGHT'] || 0);
      const widthVal = Number(props['width'] || props['WIDTH'] || 0);

      elementIdx++;
      const id = `shp_${elemType}_${elementIdx}_${Date.now()}`;

      const base: Partial<BlueprintElement> = {
        id,
        type: elemType,
        name: nameVal ? String(nameVal).slice(0, 60) : `${elemType.replace('_', ' ')} ${elementIdx}`,
        points,
        elevation: 0,
      };

      if (elemType === 'building') {
        const floors = Number(props['floors'] || props['FLOORS'] || 0);
        const heightM = heightVal || (floors > 0 ? floors * 3.5 : 12);
        Object.assign(base, {
          height: Math.round(heightM),
          material_label: 'glass_curtain_wall',
          metadata: { buildingType: 'commercial', color: '#3b82f6' },
        });
      } else if (elemType === 'road' || elemType === 'bridge_deck') {
        Object.assign(base, {
          width: widthVal || 12,
          material_label: elemType === 'bridge_deck' ? 'reinforced_concrete' : 'asphalt',
          metadata: { lanes: Math.round((widthVal || 12) / 3.5) },
        });
      } else if (elemType === 'ground') {
        Object.assign(base, {
          metadata: { groundType: inferGroundType(props) },
        });
      }

      elements.push(base as BlueprintElement);
    }
  }

  const layerName = file.name.replace(/\.(zip|shp)$/i, '');

  return { elements, bbox, featureCount: allFeatures.length, layerName };
}
