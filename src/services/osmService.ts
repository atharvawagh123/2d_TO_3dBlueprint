import type { BlueprintElement, Point2D } from '../types';
import { 
  projectLatLonToMeters, 
  getBoundingBoxDimensions, 
  type BoundingBoxGPS 
} from '../engine/gisProjection';

export interface CivilSitePreset {
  id: string;
  name: string;
  region: string;
  description: string;
  bbox: BoundingBoxGPS;
}

export const CIVIL_SITE_PRESETS: CivilSitePreset[] = [
  {
    id: 'nagpur_ramjhula',
    name: 'Nagpur Ram Jhula & Metro Viaduct Corridor',
    region: 'Maharashtra, India',
    description: 'Central India iconic cable-stayed viaduct, dual carriageway Kingsway Road, and urban metro line.',
    bbox: {
      south: 21.1470,
      west: 79.0820,
      north: 21.1550,
      east: 79.0930,
    },
  },
  {
    id: 'mumbai_marine',
    name: 'Mumbai Marine Drive & Coastal Road',
    region: 'Maharashtra, India',
    description: 'Arterial seaside multi-lane expressway corridor, reclaimed seawalls, and commercial towers.',
    bbox: {
      south: 18.9390,
      west: 72.8180,
      north: 18.9490,
      east: 72.8280,
    },
  },
  {
    id: 'delhi_central',
    name: 'New Delhi Central Vista & Ring Road Expressway',
    region: 'Delhi NCR, India',
    description: 'Grand arterial boulevard network, multi-tiered grade-separated underpasses, and civil complexes.',
    bbox: {
      south: 28.6090,
      west: 77.2220,
      north: 28.6180,
      east: 77.2360,
    },
  },
  {
    id: 'bengaluru_silkboard',
    name: 'Bengaluru Silk Board & Outer Ring Road',
    region: 'Karnataka, India',
    description: 'High-density multi-level elevated metro interchange, grade-separated ramps, and tech parks.',
    bbox: {
      south: 12.9130,
      west: 77.6180,
      north: 12.9220,
      east: 77.6290,
    },
  },
  {
    id: 'hyderabad_hitec',
    name: 'Hyderabad HITEC City & Outer Ring Viaduct',
    region: 'Telangana, India',
    description: 'Elevated flyovers, urban expressway junctions, and high-rise commercial corporate towers.',
    bbox: {
      south: 17.4350,
      west: 78.3430,
      north: 17.4450,
      east: 78.3550,
    },
  },
];

export interface AOIFetchResult {
  elements: BlueprintElement[];
  source: 'live_overpass' | 'gis_synthesis';
  stats: {
    roadCount: number;
    roadTotalLengthM: number;
    roadPavementAreaM2: number;
    buildingCount: number;
    buildingTotalFootprintM2: number;
    estimatedDemolitionVolumeM3: number;
    bridgeCount: number;
    aoiAreaHectares: number;
    dimensions: { widthM: number; heightM: number };
  };
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

/**
 * Generates realistic civil infrastructure vector elements tailored to the specific AOI bounds
 */
function generateSynthesizedCivilData(bbox: BoundingBoxGPS): BlueprintElement[] {
  const { widthMeters, heightMeters, center } = getBoundingBoxDimensions(bbox);
  const elements: BlueprintElement[] = [];

  const halfW = widthMeters / 2;
  const halfH = heightMeters / 2;
  const latStr = center.lat.toFixed(3);
  const lonStr = center.lon.toFixed(3);

  // Main Arterial Expressway Corridor (anchored to GPS)
  elements.push({
    id: `syn_arterial_${Date.now()}_1`,
    type: 'road',
    name: `${latStr}°N, ${lonStr}°E Arterial Expressway Corridor`,
    points: [
      { x: -halfW * 0.95, y: -halfH * 0.2 },
      { x: -halfW * 0.3, y: -halfH * 0.05 },
      { x: halfW * 0.3, y: halfH * 0.1 },
      { x: halfW * 0.95, y: halfH * 0.25 },
    ],
    width: 16,
    elevation: 0.1,
    material_label: 'asphalt',
    metadata: { lanes: 6, roadType: 'expressway' },
  });

  // Elevated Flyover / Metro Viaduct Corridor
  elements.push({
    id: `syn_viaduct_${Date.now()}_2`,
    type: 'bridge_deck',
    name: `${latStr}°N Elevated Flyover Viaduct Deck`,
    points: [
      { x: -halfW * 0.7, y: -halfH * 0.55 },
      { x: -halfW * 0.1, y: -halfH * 0.15 },
      { x: halfW * 0.5, y: halfH * 0.35 },
      { x: halfW * 0.85, y: halfH * 0.7 },
    ],
    width: 12,
    elevation: 9.5,
    height: 1.4,
    pier_spacing: 28,
    material_label: 'reinforced_concrete',
    metadata: { lanes: 4, isViaduct: true },
  });

  // Secondary Cross Connector Road
  elements.push({
    id: `syn_connector_${Date.now()}_3`,
    type: 'road',
    name: `${lonStr}°E Access Boulevard`,
    points: [
      { x: -halfW * 0.15, y: -halfH * 0.9 },
      { x: 0, y: 0 },
      { x: halfW * 0.15, y: halfH * 0.9 },
    ],
    width: 10,
    elevation: 0.1,
    material_label: 'asphalt',
    metadata: { lanes: 3 },
  });

  // Commercial Tower Complex A
  const bldgAW = Math.min(widthMeters * 0.22, 65);
  const bldgAH = Math.min(heightMeters * 0.25, 75);
  const bldgACX = -halfW * 0.45;
  const bldgACY = halfH * 0.4;
  elements.push({
    id: `syn_bldg_${Date.now()}_1`,
    type: 'building',
    name: `Transit Interchange Commercial Tower (${latStr}°N)`,
    points: [
      { x: bldgACX - bldgAW / 2, y: bldgACY - bldgAH / 2 },
      { x: bldgACX + bldgAW / 2, y: bldgACY - bldgAH / 2 },
      { x: bldgACX + bldgAW / 2, y: bldgACY + bldgAH / 2 },
      { x: bldgACX - bldgAW / 2, y: bldgACY + bldgAH / 2 },
    ],
    height: 38,
    elevation: 0,
    material_label: 'glass_curtain_wall',
    metadata: { levels: 11 },
  });

  // Administrative / Operations Hub B
  const bldgBW = Math.min(widthMeters * 0.2, 55);
  const bldgBH = Math.min(heightMeters * 0.18, 50);
  const bldgBCX = halfW * 0.5;
  const bldgBCY = -halfH * 0.45;
  elements.push({
    id: `syn_bldg_${Date.now()}_2`,
    type: 'building',
    name: `Infrastructure Operations Facility (${lonStr}°E)`,
    points: [
      { x: bldgBCX - bldgBW / 2, y: bldgBCY - bldgBH / 2 },
      { x: bldgBCX + bldgBW / 2, y: bldgBCY - bldgBH / 2 },
      { x: bldgBCX + bldgBW / 2, y: bldgBCY + bldgBH / 2 },
      { x: bldgBCX - bldgBW / 2, y: bldgBCY + bldgBH / 2 },
    ],
    height: 22,
    elevation: 0,
    material_label: 'reinforced_concrete',
    metadata: { levels: 6 },
  });

  // Survey AOI Boundary
  elements.push({
    id: `syn_boundary_${Date.now()}_aoi`,
    type: 'boundary',
    name: `Site Boundary [${widthMeters}m x ${heightMeters}m]`,
    points: [
      { x: -halfW, y: -halfH },
      { x: halfW, y: -halfH },
      { x: halfW, y: halfH },
      { x: -halfW, y: halfH },
    ],
    elevation: 0,
    material_label: 'lod_boundary',
  });

  return elements;
}

/**
 * Fetches real-world roads, buildings, bridges, and railways from live OpenStreetMap Overpass API for a GPS AOI.
 * Uses high-efficiency `out geom;` for 100% exact geospatial points directly on ways.
 */
export async function fetchAOIInfrastructure(bbox: BoundingBoxGPS): Promise<AOIFetchResult> {
  const { widthMeters, heightMeters, areaHectares, center } = getBoundingBoxDimensions(bbox);
  const aoiAreaHectares = areaHectares ?? 0;

  // Ultra-precise Overpass QL with `out geom;` for direct, exact point arrays
  const overpassQuery = `
    [out:json][timeout:18];
    (
      way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["bridge"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["railway"~"rail|light_rail|subway|monorail"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
    );
    out geom;
  `;

  let elements: BlueprintElement[] = [];
  let source: 'live_overpass' | 'gis_synthesis' = 'gis_synthesis';
  const seenIds = new Set<string>();

  // Try multiple Overpass mirrors with timeout
  for (const endpoint of OVERPASS_ENDPOINTS) {
    if (elements.length > 0) break;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.elements && data.elements.length > 0) {
          data.elements.forEach((el: any) => {
            if (el.type !== 'way') return;
            const wayId = `osm_${el.id}`;
            if (seenIds.has(wayId)) return;

            // Extract 100% exact geospatial coordinates directly from `geometry` array
            let rawCoords: { lat: number; lon: number }[] = [];
            if (Array.isArray(el.geometry) && el.geometry.length >= 2) {
              rawCoords = el.geometry;
            }

            if (rawCoords.length < 2) return;

            // Convert exact GPS lat/lon to real-world metric meters relative to AOI center
            const pts: Point2D[] = rawCoords.map((coord) => projectLatLonToMeters(coord, center));
            if (pts.length < 2) return;

            const name = el.tags?.['name:en'] || el.tags?.name || '';

            // 1. Bridges and Elevated Viaducts
            const isBridge = el.tags?.bridge === 'yes' || el.tags?.man_made === 'bridge' || el.tags?.layer > 0;
            if (isBridge && (el.tags?.highway || el.tags?.railway)) {
              seenIds.add(wayId);
              const hwType = el.tags?.highway || el.tags?.railway || 'viaduct';
              let width = 12;
              if (hwType === 'motorway' || hwType === 'trunk') width = 16;
              else if (hwType === 'primary') width = 14;
              else if (hwType === 'rail' || hwType === 'subway') width = 10;

              elements.push({
                id: `osm_bridge_${el.id}`,
                type: 'bridge_deck',
                name: name ? `${name} (Viaduct)` : `Elevated Viaduct (${hwType})`,
                points: pts,
                width,
                elevation: 10.5,
                height: 1.4,
                pier_spacing: 26,
                material_label: 'reinforced_concrete',
                metadata: {
                  isBridge: true,
                  hwType,
                  osmId: el.id,
                },
              });
              return;
            }

            // 2. Surface Highways & Arterial Roads
            if (el.tags?.highway) {
              seenIds.add(wayId);
              const hwType = el.tags.highway;
              let width = 9;
              if (hwType === 'motorway' || hwType === 'trunk') width = 18;
              else if (hwType === 'primary') width = 14;
              else if (hwType === 'secondary') width = 11;
              else if (hwType === 'tertiary' || hwType === 'residential') width = 8;
              else if (hwType === 'service' || hwType === 'unclassified') width = 6;

              elements.push({
                id: `osm_road_${el.id}`,
                type: 'road',
                name: name || `Road Corridor (${hwType})`,
                points: pts,
                width,
                elevation: 0.1,
                material_label: 'asphalt',
                metadata: {
                  hwType,
                  osmId: el.id,
                  lanes: el.tags.lanes ? parseInt(el.tags.lanes, 10) : undefined,
                },
              });
              return;
            }

            // 3. Railway / Metro Transit Lines
            if (el.tags?.railway) {
              seenIds.add(wayId);
              elements.push({
                id: `osm_rail_${el.id}`,
                type: 'road',
                name: name || `Metro / Rail Corridor (${el.tags.railway})`,
                points: pts,
                width: 8,
                elevation: 0.2,
                material_label: 'asphalt',
                metadata: { railway: el.tags.railway, osmId: el.id },
              });
              return;
            }

            // 4. Buildings & Structural Envelopes
            if (el.tags?.building && pts.length >= 3) {
              seenIds.add(wayId);
              let height = 14;
              if (el.tags['building:levels']) {
                height = parseFloat(el.tags['building:levels']) * 3.5;
              } else if (el.tags.height) {
                height = parseFloat(el.tags.height);
              }

              elements.push({
                id: `osm_bldg_${el.id}`,
                type: 'building',
                name: name || 'Building Structure',
                points: pts,
                height: Math.min(Math.max(height, 5), 90),
                elevation: 0,
                material_label: 'glass_curtain_wall',
                metadata: {
                  buildingType: el.tags.building,
                  levels: el.tags['building:levels'] ? parseInt(el.tags['building:levels'], 10) : undefined,
                  osmId: el.id,
                },
              });
            }
          });

          if (elements.length > 0) {
            source = 'live_overpass';
            break;
          }
        }
      }
    } catch {
      // Continue to next mirror endpoint
    }
  }

  // Fallback to localized synthesized infrastructure if live Overpass was empty or throttled
  if (elements.length === 0) {
    elements = generateSynthesizedCivilData(bbox);
    source = 'gis_synthesis';
  }

  // Calculate stats
  let roadCount = 0;
  let roadTotalLengthM = 0;
  let roadPavementAreaM2 = 0;
  let buildingCount = 0;
  let buildingTotalFootprintM2 = 0;
  let estimatedDemolitionVolumeM3 = 0;
  let bridgeCount = 0;

  elements.forEach((elem) => {
    if (elem.type === 'road') {
      roadCount++;
      let len = 0;
      for (let i = 0; i < elem.points.length - 1; i++) {
        const dx = elem.points[i + 1].x - elem.points[i].x;
        const dy = elem.points[i + 1].y - elem.points[i].y;
        len += Math.sqrt(dx * dx + dy * dy);
      }
      roadTotalLengthM += len;
      roadPavementAreaM2 += len * (elem.width || 10);
    } else if (elem.type === 'bridge_deck') {
      bridgeCount++;
    } else if (elem.type === 'building') {
      buildingCount++;
      // Approximate footprint
      let area = 0;
      const n = elem.points.length;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += elem.points[i].x * elem.points[j].y;
        area -= elem.points[j].x * elem.points[i].y;
      }
      const absArea = Math.abs(area / 2);
      buildingTotalFootprintM2 += absArea;
      estimatedDemolitionVolumeM3 += absArea * (elem.height || 15);
    }
  });

  return {
    elements,
    source,
    stats: {
      roadCount,
      roadTotalLengthM: Math.round(roadTotalLengthM),
      roadPavementAreaM2: Math.round(roadPavementAreaM2),
      buildingCount,
      buildingTotalFootprintM2: Math.round(buildingTotalFootprintM2),
      estimatedDemolitionVolumeM3: Math.round(estimatedDemolitionVolumeM3),
      bridgeCount,
      aoiAreaHectares,
      dimensions: { widthM: widthMeters, heightM: heightMeters },
    },
  };
}
