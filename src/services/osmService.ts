import type { BlueprintElement, Point2D, GroundType } from '../types';
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
    id: 'mumbai_marine',
    name: 'Mumbai Vidhan Bhavan & Marine Drive Coastal Corridor',
    region: 'Nariman Point, Mumbai, India',
    description: 'Arterial Vidhan Bhavan / Marine Drive corridor, government complexes, commercial towers, and coastal link.',
    bbox: {
      south: 18.9310,
      west: 72.8240,
      north: 18.9400,
      east: 72.8350,
    },
  },
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
    groundParcelCount: number;
    groundTotalAreaM2: number;
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
 * Strips closing duplicate point from OSM closed-way rings to prevent
 * zero-length degenerate edges in Three.js ExtrudeGeometry
 */
function sanitizePolygonPoints(pts: Point2D[]): Point2D[] {
  if (pts.length < 3) return pts;
  const res = [...pts];
  const first = res[0];
  const last = res[res.length - 1];
  if (Math.hypot(first.x - last.x, first.y - last.y) < 0.2) {
    res.pop();
  }
  return res;
}

/**
 * Calculates 2D polygon footprint area in square meters
 */
function calculateFootprintArea(pts: Point2D[]): number {
  const n = pts.length;
  if (n < 3) return 0;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area / 2);
}

/**
 * Deterministic pseudo-random number based on string or ID
 */
function deterministicHash(str: string | number): number {
  const s = String(str);
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

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

  // 1. Main Arterial Expressway Corridor (anchored to GPS)
  elements.push({
    id: `syn_arterial_${Date.now()}_1`,
    type: 'road',
    name: `${latStr}°N Arterial Expressway (6-Lane)`,
    points: [
      { x: -halfW * 0.95, y: -halfH * 0.18 },
      { x: -halfW * 0.3, y: -halfH * 0.05 },
      { x: halfW * 0.3, y: halfH * 0.1 },
      { x: halfW * 0.95, y: halfH * 0.25 },
    ],
    width: 18,
    elevation: 0.1,
    material_label: 'asphalt',
    metadata: { lanes: 6, roadType: 'expressway' },
  });

  // 2. Elevated Flyover / Metro Viaduct Corridor
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
    width: 13,
    elevation: 10.5,
    height: 1.4,
    pier_spacing: 28,
    material_label: 'reinforced_concrete',
    metadata: { lanes: 4, isViaduct: true },
  });

  // 3. Secondary Cross Connector Boulevard
  elements.push({
    id: `syn_connector_${Date.now()}_3`,
    type: 'road',
    name: `${lonStr}°E Access Boulevard (4-Lane)`,
    points: [
      { x: -halfW * 0.15, y: -halfH * 0.88 },
      { x: 0, y: 0 },
      { x: halfW * 0.15, y: halfH * 0.88 },
    ],
    width: 12,
    elevation: 0.1,
    material_label: 'asphalt',
    metadata: { lanes: 4 },
  });

  // 4. Urban Pedestrian Promenade / Walkway
  elements.push({
    id: `syn_pedestrian_${Date.now()}_4`,
    type: 'road',
    name: `Transit Station Pedestrian Promenade`,
    points: [
      { x: -halfW * 0.55, y: halfH * 0.15 },
      { x: -halfW * 0.15, y: halfH * 0.25 },
      { x: halfW * 0.25, y: halfH * 0.35 },
    ],
    width: 4.5,
    elevation: 0.12,
    material_label: 'pavement_pedestrian',
    metadata: { roadType: 'footway' },
  });

  // 5. 3D Ground Parcel: City Park & Green Lawn
  const parkW = Math.min(widthMeters * 0.26, 85);
  const parkH = Math.min(heightMeters * 0.28, 90);
  const parkCX = -halfW * 0.48;
  const parkCY = -halfH * 0.45;
  elements.push({
    id: `syn_ground_park_${Date.now()}`,
    type: 'ground',
    name: 'Central Urban Botanical Park',
    points: [
      { x: parkCX - parkW / 2, y: parkCY - parkH / 2 },
      { x: parkCX + parkW / 2, y: parkCY - parkH / 2 },
      { x: parkCX + parkW / 2, y: parkCY + parkH / 2 },
      { x: parkCX - parkW / 2, y: parkCY + parkH / 2 },
    ],
    elevation: 0.05,
    material_label: 'lush_grass',
    metadata: { groundType: 'park', color: '#22c55e' },
  });

  // 6. 3D Ground Parcel: Water Canal / Retention Lake
  const waterW = Math.min(widthMeters * 0.2, 60);
  const waterH = Math.min(heightMeters * 0.32, 100);
  const waterCX = halfW * 0.55;
  const waterCY = halfH * 0.42;
  elements.push({
    id: `syn_ground_water_${Date.now()}`,
    type: 'ground',
    name: 'Civil Waterfront Canal',
    points: [
      { x: waterCX - waterW / 2, y: waterCY - waterH / 2 },
      { x: waterCX + waterW / 2, y: waterCY - waterH / 2 },
      { x: waterCX + waterW / 2, y: waterCY + waterH / 2 },
      { x: waterCX - waterW / 2, y: waterCY + waterH / 2 },
    ],
    elevation: -0.15,
    material_label: 'water_surface',
    metadata: { groundType: 'water', color: '#0284c7' },
  });

  // 7. 3D Ground Parcel: Commercial Plaza & Parking Lot
  const plazaW = Math.min(widthMeters * 0.18, 55);
  const plazaH = Math.min(heightMeters * 0.22, 65);
  const plazaCX = -halfW * 0.2;
  const plazaCY = halfH * 0.48;
  elements.push({
    id: `syn_ground_plaza_${Date.now()}`,
    type: 'ground',
    name: 'Interchange Station Plaza & Stalls',
    points: [
      { x: plazaCX - plazaW / 2, y: plazaCY - plazaH / 2 },
      { x: plazaCX + plazaW / 2, y: plazaCY - plazaH / 2 },
      { x: plazaCX + plazaW / 2, y: plazaCY + plazaH / 2 },
      { x: plazaCX - plazaW / 2, y: plazaCY + plazaH / 2 },
    ],
    elevation: 0.04,
    material_label: 'stone_plaza',
    metadata: { groundType: 'plaza', color: '#94a3b8' },
  });

  // 8. Commercial Glass Curtain Tower A (High-Rise)
  const bldgAW = Math.min(widthMeters * 0.18, 52);
  const bldgAH = Math.min(heightMeters * 0.2, 58);
  const bldgACX = -halfW * 0.48;
  const bldgACY = halfH * 0.48;
  elements.push({
    id: `syn_bldg_${Date.now()}_1`,
    type: 'building',
    name: `Metro Commercial Center (${latStr}°N)`,
    points: [
      { x: bldgACX - bldgAW / 2, y: bldgACY - bldgAH / 2 },
      { x: bldgACX + bldgAW / 2, y: bldgACY - bldgAH / 2 },
      { x: bldgACX + bldgAW / 2, y: bldgACY + bldgAH / 2 },
      { x: bldgACX - bldgAW / 2, y: bldgACY + bldgAH / 2 },
    ],
    height: 48,
    elevation: 0,
    material_label: 'glass_curtain_wall',
    metadata: { levels: 14, buildingType: 'commercial' },
  });

  // 9. Administrative / Operations Hub B (Mid-Rise Concrete)
  const bldgBW = Math.min(widthMeters * 0.16, 45);
  const bldgBH = Math.min(heightMeters * 0.15, 42);
  const bldgBCX = halfW * 0.45;
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
    height: 24,
    elevation: 0,
    material_label: 'modern_concrete',
    metadata: { levels: 7, buildingType: 'office' },
  });

  // 10. Mixed-Use Residential Complex C (Masonry / Terracotta)
  const bldgCW = Math.min(widthMeters * 0.22, 60);
  const bldgCH = Math.min(heightMeters * 0.14, 38);
  const bldgCCX = halfW * 0.28;
  const bldgCCY = -halfH * 0.15;
  elements.push({
    id: `syn_bldg_${Date.now()}_3`,
    type: 'building',
    name: `Transit Boulevard Apartments`,
    points: [
      { x: bldgCCX - bldgCW / 2, y: bldgCCY - bldgCH / 2 },
      { x: bldgCCX + bldgCW / 2, y: bldgCCY - bldgCH / 2 },
      { x: bldgCCX + bldgCW / 2, y: bldgCCY + bldgCH / 2 },
      { x: bldgCCX - bldgCW / 2, y: bldgCCY + bldgCH / 2 },
    ],
    height: 18,
    elevation: 0,
    material_label: 'warm_masonry',
    metadata: { levels: 5, buildingType: 'apartments' },
  });

  // 11. Low-Rise Retail Pavilion D
  const bldgDW = Math.min(widthMeters * 0.12, 32);
  const bldgDH = Math.min(heightMeters * 0.12, 30);
  const bldgDCX = -halfW * 0.22;
  const bldgDCY = -halfH * 0.52;
  elements.push({
    id: `syn_bldg_${Date.now()}_4`,
    type: 'building',
    name: `Parkside Retail Pavilion`,
    points: [
      { x: bldgDCX - bldgDW / 2, y: bldgDCY - bldgDH / 2 },
      { x: bldgDCX + bldgDW / 2, y: bldgDCY - bldgDH / 2 },
      { x: bldgDCX + bldgDW / 2, y: bldgDCY + bldgDH / 2 },
      { x: bldgDCX - bldgDW / 2, y: bldgDCY + bldgDH / 2 },
    ],
    height: 7.5,
    elevation: 0,
    material_label: 'commercial_brick',
    metadata: { levels: 2, buildingType: 'retail' },
  });

  // 12. Survey AOI Boundary
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
 * Fetches real-world roads, buildings, bridges, and ground data from live OpenStreetMap Overpass API
 * Uses high-efficiency `out geom;` for 100% exact geospatial points directly on ways.
 */
export async function fetchAOIInfrastructure(bbox: BoundingBoxGPS): Promise<AOIFetchResult> {
  const { widthMeters, heightMeters, areaHectares, center } = getBoundingBoxDimensions(bbox);
  const aoiAreaHectares = areaHectares ?? 0;

  // Ultra-precise Overpass QL querying roads, buildings, viaducts, transit, AND ground parcels
  const overpassQuery = `
    [out:json][timeout:25];
    (
      way["highway"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["building"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["bridge"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["railway"~"rail|light_rail|subway|monorail"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["leisure"~"park|garden|pitch|playground|golf_course"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["landuse"~"grass|meadow|forest|commercial|residential|industrial|construction|recreation_ground|retail|cemetery"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["natural"~"water|wood|scrub|grassland|sand"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["waterway"~"river|canal|dock|stream"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
      way["amenity"~"parking|marketplace"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
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
      const timeoutId = setTimeout(() => controller.abort(), 14000);

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
            const rawPts: Point2D[] = rawCoords.map((coord) => projectLatLonToMeters(coord, center));
            if (rawPts.length < 2) return;

            const name = el.tags?.['name:en'] || el.tags?.name || '';
            const hash = deterministicHash(el.id);

            // 1. Bridges and Elevated Viaducts
            const isBridge = el.tags?.bridge === 'yes' || el.tags?.man_made === 'bridge' || el.tags?.layer > 0;
            if (isBridge && (el.tags?.highway || el.tags?.railway)) {
              seenIds.add(wayId);
              const hwType = el.tags?.highway || el.tags?.railway || 'viaduct';
              let width = 12;
              if (hwType === 'motorway' || hwType === 'trunk') width = 16;
              else if (hwType === 'primary') width = 14;
              else if (hwType === 'rail' || hwType === 'subway') width = 10;
              if (el.tags.lanes) {
                width = Math.max(width, parseInt(el.tags.lanes, 10) * 3.4);
              }

              elements.push({
                id: `osm_bridge_${el.id}`,
                type: 'bridge_deck',
                name: name ? `${name} (Viaduct)` : `Elevated Viaduct (${hwType})`,
                points: rawPts,
                width,
                elevation: 10.5,
                height: 1.4,
                pier_spacing: 26,
                material_label: 'reinforced_concrete',
                metadata: {
                  isBridge: true,
                  hwType,
                  osmId: el.id,
                  lanes: el.tags.lanes ? parseInt(el.tags.lanes, 10) : 4,
                },
              });
              return;
            }

            // 2. Surface Highways, Arterial Roads, and Pedestrian Pathways
            if (el.tags?.highway) {
              seenIds.add(wayId);
              const hwType = el.tags.highway;
              let width = 8;
              let mat = 'asphalt';

              if (hwType === 'motorway' || hwType === 'trunk') {
                width = 18;
              } else if (hwType === 'primary') {
                width = 14;
              } else if (hwType === 'secondary') {
                width = 11;
              } else if (hwType === 'tertiary') {
                width = 8.5;
              } else if (hwType === 'residential' || hwType === 'living_street') {
                width = 7.5;
              } else if (hwType === 'service' || hwType === 'unclassified') {
                width = 5.5;
              } else if (hwType === 'footway' || hwType === 'pedestrian' || hwType === 'path' || hwType === 'cycleway') {
                width = 3.5;
                mat = 'pavement_pedestrian';
              }

              if (el.tags.lanes) {
                const parsedLanes = parseInt(el.tags.lanes, 10);
                if (parsedLanes > 0) width = Math.max(width, parsedLanes * 3.4);
              }

              elements.push({
                id: `osm_road_${el.id}`,
                type: 'road',
                name: name || `Road Corridor (${hwType})`,
                points: rawPts,
                width,
                elevation: 0.1,
                material_label: mat,
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
                points: rawPts,
                width: 8,
                elevation: 0.2,
                material_label: 'asphalt',
                metadata: { railway: el.tags.railway, osmId: el.id },
              });
              return;
            }

            // 4. Buildings & Structural Envelopes (Sanitized Polygons + Realistic Heights)
            if (el.tags?.building && rawPts.length >= 3) {
              seenIds.add(wayId);
              const pts = sanitizePolygonPoints(rawPts);
              if (pts.length < 3) return;

              const footprintArea = calculateFootprintArea(pts);

              // Parse or intelligently estimate height
              let height = 0;
              let levels: number | undefined;

              if (el.tags['building:levels']) {
                levels = parseFloat(el.tags['building:levels']);
                if (!isNaN(levels) && levels > 0) {
                  height = levels * 3.4;
                }
              }

              if (height === 0 && el.tags.height) {
                const hStr = String(el.tags.height).trim().toLowerCase();
                const rawH = parseFloat(hStr);
                if (!isNaN(rawH) && rawH > 0) {
                  if (hStr.includes('ft') || hStr.includes("'")) {
                    height = rawH * 0.3048;
                  } else {
                    height = rawH;
                  }
                }
              }

              // Realistic contextual estimation based on building type and footprint
              const bType = el.tags.building;
              let mat = 'modern_concrete';

              if (height === 0) {
                if (['commercial', 'office', 'hotel', 'hospital', 'apartments'].includes(bType)) {
                  levels = 4 + (hash % 10); // 4 to 13 floors
                  height = levels * 3.4;
                  mat = hash % 2 === 0 ? 'glass_curtain_wall' : 'modern_concrete';
                } else if (['house', 'residential', 'detached', 'bungalow', 'cabin', 'terrace', 'shed', 'garage'].includes(bType)) {
                  levels = 1 + (hash % 2); // 1 to 2 floors
                  height = 4.0 + (hash % 3) * 1.8;
                  mat = 'warm_masonry';
                } else if (['industrial', 'warehouse', 'hangar'].includes(bType)) {
                  levels = 2;
                  height = 7.5 + (hash % 3) * 2;
                  mat = 'commercial_brick';
                } else {
                  // General building tag (yes) - scale by footprint area
                  if (footprintArea > 1200) {
                    levels = 6 + (hash % 8); // 6 to 13 floors
                    height = levels * 3.4;
                    mat = 'glass_curtain_wall';
                  } else if (footprintArea > 350) {
                    levels = 3 + (hash % 4); // 3 to 6 floors
                    height = levels * 3.3;
                    mat = hash % 2 === 0 ? 'modern_concrete' : 'warm_masonry';
                  } else {
                    levels = 1 + (hash % 2); // 1 to 2 floors
                    height = 4.5 + (hash % 3) * 1.8;
                    mat = 'warm_masonry';
                  }
                }
              }

              elements.push({
                id: `osm_bldg_${el.id}`,
                type: 'building',
                name: name || (bType !== 'yes' ? `${bType.toUpperCase()} Structure` : 'Building Structure'),
                points: pts,
                height: Math.min(Math.max(height, 3.5), 110),
                elevation: 0,
                material_label: mat,
                metadata: {
                  buildingType: bType,
                  levels: levels ? Math.round(levels) : undefined,
                  osmId: el.id,
                },
              });
              return;
            }

            // 4.5. Sports Stadiums, Cricket Grounds, Arenas, and Athletic Pitches
            const isStadium =
              el.tags?.leisure === 'stadium' ||
              el.tags?.building === 'stadium' ||
              el.tags?.building === 'grandstand' ||
              el.tags?.leisure === 'sports_centre' ||
              el.tags?.sport === 'cricket' ||
              el.tags?.sport === 'football' ||
              el.tags?.sport === 'soccer' ||
              (Boolean(name) && /stadium|arena|maidan|cricket|football|brabourne|wankhede/i.test(name));

            if (isStadium && rawPts.length >= 3) {
              seenIds.add(wayId);
              const pts = sanitizePolygonPoints(rawPts);
              if (pts.length < 3) return;

              elements.push({
                id: `osm_stadium_${el.id}`,
                type: 'stadium',
                name: name || 'Sports Stadium Arena',
                points: pts,
                height: 24,
                elevation: 0,
                material_label: 'stadium_arena',
                metadata: {
                  stadiumType: el.tags?.sport || 'stadium',
                  osmId: el.id,
                },
              });
              return;
            }

            // 5. 3D Ground Parcels (Parks, Water Bodies, Parking Lots, Plazas)
            const isWater = el.tags?.natural === 'water' || el.tags?.waterway || el.tags?.landuse === 'basin' || el.tags?.landuse === 'reservoir';
            const isPark = el.tags?.leisure === 'park' || el.tags?.leisure === 'garden' || el.tags?.landuse === 'grass' || el.tags?.landuse === 'forest' || el.tags?.natural === 'wood';
            const isParking = el.tags?.amenity === 'parking';
            const isPlaza = el.tags?.amenity === 'marketplace' || el.tags?.highway === 'pedestrian';
            const isZoning = el.tags?.landuse === 'commercial' || el.tags?.landuse === 'residential' || el.tags?.landuse === 'industrial';

            if ((isWater || isPark || isParking || isPlaza || isZoning) && rawPts.length >= 3) {
              seenIds.add(wayId);
              const pts = sanitizePolygonPoints(rawPts);
              if (pts.length < 3) return;

              let groundType: GroundType = 'park';
              let mat = 'lush_grass';
              let elev = 0.05;
              let defaultName = 'Park Grounds';

              if (isWater) {
                groundType = 'water';
                mat = 'water_surface';
                elev = -0.15;
                defaultName = el.tags?.waterway ? `Waterway (${el.tags.waterway})` : 'Water Basin';
              } else if (isParking) {
                groundType = 'parking';
                mat = 'parking_asphalt';
                elev = 0.04;
                defaultName = 'Surface Parking Lot';
              } else if (isPlaza) {
                groundType = 'plaza';
                mat = 'stone_plaza';
                elev = 0.05;
                defaultName = 'Civic Plaza Ground';
              } else if (isZoning) {
                groundType = el.tags.landuse === 'commercial' ? 'commercial_zone' : 'residential_zone';
                mat = 'commercial_zone';
                elev = 0.02;
                defaultName = `${el.tags.landuse.toUpperCase()} Parcel`;
              }

              elements.push({
                id: `osm_ground_${el.id}`,
                type: 'ground',
                name: name || defaultName,
                points: pts,
                elevation: elev,
                material_label: mat,
                metadata: {
                  groundType,
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
  let groundParcelCount = 0;
  let groundTotalAreaM2 = 0;
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
      const absArea = calculateFootprintArea(elem.points);
      buildingTotalFootprintM2 += absArea;
      estimatedDemolitionVolumeM3 += absArea * (elem.height || 15);
    } else if (elem.type === 'ground') {
      groundParcelCount++;
      const absArea = calculateFootprintArea(elem.points);
      groundTotalAreaM2 += absArea;
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
      groundParcelCount,
      groundTotalAreaM2: Math.round(groundTotalAreaM2),
      estimatedDemolitionVolumeM3: Math.round(estimatedDemolitionVolumeM3),
      bridgeCount,
      aoiAreaHectares,
      dimensions: { widthM: widthMeters, heightM: heightMeters },
    },
  };
}
