import * as THREE from 'three';
import type { BlueprintElement } from '../types';
import { computeMiterOffsets, samplePointsAlongPolyline, ensureCCW } from './math2d';

export interface ConvertedMeshInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
  position?: THREE.Vector3;
  rotation?: THREE.Euler;
  name?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

export interface ElementBoundingBox {
  min: THREE.Vector3;
  max: THREE.Vector3;
  size: THREE.Vector3;
  radius: number;
}

export interface ConvertedElement3D {
  id: string;
  name: string;
  type: BlueprintElement['type'];
  elevation: number;
  center: THREE.Vector3;
  bounds: ElementBoundingBox;
  meshes: ConvertedMeshInfo[];
}

export interface ConvertedScene3D {
  elements: ConvertedElement3D[];
  bounds: {
    min: THREE.Vector3;
    max: THREE.Vector3;
    center: THREE.Vector3;
    size: THREE.Vector3;
  };
}

// ---------------------------------------------------------------------------
// Procedural Architectural Textures for Realistic CAD & BIM Presentation
// ---------------------------------------------------------------------------

function createFacadeTexture(type: 'glass' | 'concrete' | 'masonry' | 'brick'): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  if (type === 'glass') {
    // Ultra-crisp modern glass curtain wall with reflective panes, silver mullions & spandrels
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 512, 512);

    const floors = 4;
    const bays = 4;
    const floorH = 512 / floors;
    const bayW = 512 / bays;

    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      // Floor spandrel slab band
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, y, 512, 14);

      for (let b = 0; b < bays; b++) {
        const x = b * bayW;

        // Window pane gradient reflection
        const grad = ctx.createLinearGradient(x, y + 14, x, y + floorH - 4);
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(0.35, '#0284c7');
        grad.addColorStop(1, '#0f2744');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 4, y + 16, bayW - 8, floorH - 22);

        // Window specular reflection highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 18);
        ctx.lineTo(x + (bayW - 12) * 0.7, y + 18);
        ctx.lineTo(x + 6, y + (floorH - 24) * 0.75);
        ctx.closePath();
        ctx.fill();

        // Silver/aluminum mullions
        ctx.fillStyle = '#64748b';
        ctx.fillRect(x, y + 14, 3, floorH - 14);
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x + 1, y + 14, 1, floorH - 14);
      }
    }
  } else if (type === 'concrete') {
    // Architectural precast concrete panels with clean recessed window bays
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 0, 512, 512);

    const floors = 4;
    const bays = 4;
    const floorH = 512 / floors;
    const bayW = 512 / bays;

    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(0, y, 512, 4);

      for (let b = 0; b < bays; b++) {
        const x = b * bayW;
        ctx.fillStyle = '#94a3b8';
        ctx.fillRect(x, y, 4, floorH);

        // Window reveal shadow
        ctx.fillStyle = '#475569';
        ctx.fillRect(x + 14, y + 18, bayW - 28, floorH - 32);

        // Window glass
        const grad = ctx.createLinearGradient(x, y + 20, x, y + floorH - 16);
        grad.addColorStop(0, '#0284c7');
        grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 16, y + 20, bayW - 32, floorH - 36);

        // Window light glare
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x + 18, y + 22, (bayW - 36) * 0.5, (floorH - 40) * 0.45);
      }
    }
  } else if (type === 'masonry') {
    // Warm limestone / residential masonry facade
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, 512, 512);

    const floors = 4;
    const bays = 4;
    const floorH = 512 / floors;
    const bayW = 512 / bays;

    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, y, 512, 6);

      for (let b = 0; b < bays; b++) {
        const x = b * bayW;
        // Window frame
        ctx.fillStyle = '#334155';
        ctx.fillRect(x + 16, y + 16, bayW - 32, floorH - 28);
        // Window glass
        ctx.fillStyle = '#0369a1';
        ctx.fillRect(x + 18, y + 18, bayW - 36, floorH - 32);
        // Window highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.fillRect(x + 20, y + 20, (bayW - 40) * 0.45, (floorH - 36) * 0.5);
      }
    }
  } else {
    // Commercial brick / terracotta
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(0, 0, 512, 512);

    const floors = 4;
    const bays = 4;
    const floorH = 512 / floors;
    const bayW = 512 / bays;

    for (let f = 0; f < floors; f++) {
      const y = f * floorH;
      ctx.fillStyle = '#541c0b';
      ctx.fillRect(0, y, 512, 4);

      for (let b = 0; b < bays; b++) {
        const x = b * bayW;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(x + 14, y + 16, bayW - 28, floorH - 28);
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(x + 16, y + 18, bayW - 32, floorH - 32);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // Three.js ExtrudeGeometry WorldUVGenerator outputs UV coordinates in world units (1 unit = 1 meter).
  // Glass has 8 bays (3.5m each = 28m) and 8 floors (3.2m each = 25.6m).
  // Concrete, Masonry & Brick have 4 bays (14m) and 4 floors (12.8m).
  if (type === 'glass') {
    texture.repeat.set(1 / 28, 1 / 25.6);
  } else {
    texture.repeat.set(1 / 14, 1 / 12.8);
  }
  return texture;
}

function createRoofTexture(): THREE.CanvasTexture | undefined {
  if (typeof document === 'undefined') return undefined;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, 256, 256);

  // Fine gravel stippling for realistic roof membrane
  for (let i = 0; i < 800; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const s = 1 + Math.random() * 2;
    ctx.fillStyle = Math.random() > 0.5 ? '#1e293b' : '#475569';
    ctx.fillRect(x, y, s, s);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 10, 1 / 10);
  return texture;
}

const FACADE_TEXTURES = {
  glass: createFacadeTexture('glass'),
  concrete: createFacadeTexture('concrete'),
  masonry: createFacadeTexture('masonry'),
  brick: createFacadeTexture('brick'),
};

const ROOF_TEXTURE = createRoofTexture();

// Daylight Material Palette
export const DAYLIGHT_MATERIALS = {
  asphalt: new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.85,
    metalness: 0.12,
  }),
  asphaltPedestrian: new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.78,
    metalness: 0.08,
  }),
  roadMarking: new THREE.MeshBasicMaterial({
    color: 0xffffff,
  }),
  roadMarkingYellow: new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
  }),
  curbConcrete: new THREE.MeshStandardMaterial({
    color: 0xcfd8dc,
    roughness: 0.75,
    metalness: 0.15,
  }),
  concreteDeck: new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.55,
    metalness: 0.2,
  }),
  pierConcrete: new THREE.MeshStandardMaterial({
    color: 0xb0bec5,
    roughness: 0.68,
    metalness: 0.18,
  }),
  girderSteel: new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.7,
  }),
  // Realistic Building Materials with Textures
  buildingGlassFacade: new THREE.MeshStandardMaterial({
    map: FACADE_TEXTURES.glass,
    roughness: 0.18,
    metalness: 0.75,
    envMapIntensity: 1.2,
  }),
  buildingConcreteFacade: new THREE.MeshStandardMaterial({
    map: FACADE_TEXTURES.concrete,
    roughness: 0.65,
    metalness: 0.15,
  }),
  buildingMasonryFacade: new THREE.MeshStandardMaterial({
    map: FACADE_TEXTURES.masonry,
    roughness: 0.7,
    metalness: 0.1,
  }),
  buildingBrickFacade: new THREE.MeshStandardMaterial({
    map: FACADE_TEXTURES.brick,
    roughness: 0.75,
    metalness: 0.1,
  }),
  roofMembrane: new THREE.MeshStandardMaterial({
    map: ROOF_TEXTURE,
    color: 0x475569,
    roughness: 0.92,
    metalness: 0.1,
  }),
  hvacMetal: new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.35,
    metalness: 0.8,
  }),
  buildingPlinth: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
    metalness: 0.2,
  }),
  // 3D Ground Parcels Materials
  parkGrass: new THREE.MeshStandardMaterial({
    color: 0x2d5a27,
    roughness: 0.95,
    metalness: 0.02,
  }),
  parkFoliage: new THREE.MeshStandardMaterial({
    color: 0x1e3a24,
    roughness: 0.9,
    metalness: 0.02,
  }),
  parkFoliageAlt: new THREE.MeshStandardMaterial({
    color: 0x2d6a4f,
    roughness: 0.88,
    metalness: 0.02,
  }),
  treeTrunk: new THREE.MeshStandardMaterial({
    color: 0x4a2e18,
    roughness: 0.92,
  }),
  waterSurface: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.08,
    metalness: 0.82,
    transparent: true,
    opacity: 0.92,
  }),
  waterBed: new THREE.MeshStandardMaterial({
    color: 0x075985,
    roughness: 0.9,
  }),
  parkingLot: new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.82,
    metalness: 0.12,
  }),
  plazaStone: new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.65,
    metalness: 0.15,
  }),
  boundaryPlot: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  }),
  boundaryBorder: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.4,
  }),
  // Construction Crane
  craneSteel: new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    roughness: 0.35,
    metalness: 0.75,
  }),
  craneConcrete: new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.8,
    metalness: 0.1,
  }),
  // Stadium
  stadiumPitch: new THREE.MeshStandardMaterial({
    color: 0x15803d,
    roughness: 0.85,
    metalness: 0.05,
    side: THREE.DoubleSide,
  }),
  stadiumWicket: new THREE.MeshStandardMaterial({
    color: 0xca8a04,
    roughness: 0.9,
    metalness: 0.05,
    side: THREE.DoubleSide,
  }),
  stadiumMarking: new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.3,
    side: THREE.DoubleSide,
  }),
  stadiumSeats: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.55,
    metalness: 0.15,
    side: THREE.DoubleSide,
  }),
  stadiumSeatsUpper: new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.55,
    metalness: 0.15,
    side: THREE.DoubleSide,
  }),
  stadiumConcrete: new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.75,
    metalness: 0.1,
    side: THREE.DoubleSide,
  }),
  stadiumFacade: new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.4,
    metalness: 0.35,
    side: THREE.DoubleSide,
  }),
  stadiumRoof: new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.35,
    metalness: 0.45,
    side: THREE.DoubleSide,
  }),
  stadiumPylon: new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.75,
  }),
  stadiumFloodlight: new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfef08a,
    emissiveIntensity: 1.2,
  }),
  stadiumScoreboard: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.8,
  }),
  stadiumScoreboardScreen: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.6,
  }),
  // Electric Pole & Utility
  electricPole: new THREE.MeshStandardMaterial({
    color: 0x78350f,
    roughness: 0.88,
  }),
  electricCrossarm: new THREE.MeshStandardMaterial({
    color: 0x451a03,
    roughness: 0.85,
  }),
  electricInsulator: new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.2,
    metalness: 0.7,
  }),
  electricTransformer: new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.4,
    metalness: 0.6,
  }),
  electricWire: new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.3,
    metalness: 0.85,
  }),
  // Water Pool
  poolCoping: new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.6,
    metalness: 0.1,
  }),
  poolWater: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.05,
    metalness: 0.85,
    transparent: true,
    opacity: 0.88,
  }),
  poolFloor: new THREE.MeshStandardMaterial({
    color: 0x0369a1,
    roughness: 0.5,
  }),
};

function computeElementBounds(points: { x: number; y: number }[], elevation: number, height: number, width = 10): { center: THREE.Vector3; bounds: ElementBoundingBox } {
  const halfW = width / 2;
  const min = new THREE.Vector3(Infinity, elevation, Infinity);
  const max = new THREE.Vector3(-Infinity, elevation + Math.max(height, 1), -Infinity);

  points.forEach(p => {
    min.x = Math.min(min.x, p.x - halfW);
    min.z = Math.min(min.z, -p.y - halfW);
    max.x = Math.max(max.x, p.x + halfW);
    max.z = Math.max(max.z, -p.y + halfW);
  });

  if (!isFinite(min.x)) {
    min.set(0, 0, 0);
    max.set(10, 10, 10);
  }

  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(max, min);
  const radius = Math.max(size.x, size.z, size.y) * 0.5;

  return { center, bounds: { min, max, size, radius } };
}

/**
 * Creates 3D extruded road geometry with curbs, continuous mitering, and realistic markings
 */
function createRoad3D(element: BlueprintElement): ConvertedElement3D {
  const points = element.points;
  const width = element.width || 10;
  const elevation = element.elevation || 0.1;
  const thickness = 0.3;
  const halfWidth = width / 2;

  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, elevation, thickness, width);

  if (points.length < 2) {
    return {
      id: element.id,
      name: element.name || 'Road Corridor',
      type: 'road',
      elevation,
      center,
      bounds,
      meshes,
    };
  }

  const { left, right } = computeMiterOffsets(points, halfWidth);
  const n = points.length;

  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Top surface vertices (z = -y)
  for (let i = 0; i < n; i++) {
    vertices.push(left[i].x, elevation + thickness, -left[i].y);
    uvs.push(0, i / (n - 1));
    vertices.push(right[i].x, elevation + thickness, -right[i].y);
    uvs.push(1, i / (n - 1));
  }

  // Bottom surface vertices
  const botOffset = 2 * n;
  for (let i = 0; i < n; i++) {
    vertices.push(left[i].x, elevation, -left[i].y);
    uvs.push(0, i / (n - 1));
    vertices.push(right[i].x, elevation, -right[i].y);
    uvs.push(1, i / (n - 1));
  }

  // Top quads
  for (let i = 0; i < n - 1; i++) {
    const l0 = i * 2;
    const r0 = i * 2 + 1;
    const l1 = (i + 1) * 2;
    const r1 = (i + 1) * 2 + 1;
    indices.push(l0, r0, r1);
    indices.push(l0, r1, l1);
  }

  // Sides
  for (let i = 0; i < n - 1; i++) {
    const tl0 = i * 2;
    const tl1 = (i + 1) * 2;
    const bl0 = botOffset + i * 2;
    const bl1 = botOffset + (i + 1) * 2;
    indices.push(tl0, tl1, bl1);
    indices.push(tl0, bl1, bl0);

    const tr0 = i * 2 + 1;
    const tr1 = (i + 1) * 2 + 1;
    const br0 = botOffset + i * 2 + 1;
    const br1 = botOffset + (i + 1) * 2 + 1;
    indices.push(tr0, br1, tr1);
    indices.push(tr0, br0, br1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const isPedestrian = element.material_label === 'pavement_pedestrian' || element.metadata?.hwType === 'footway';
  meshes.push({
    geometry,
    material: isPedestrian ? DAYLIGHT_MATERIALS.asphaltPedestrian : DAYLIGHT_MATERIALS.asphalt,
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_surface`,
  });

  // Road Markings: Centerline (only for roads >= 6m wide)
  if (width >= 6) {
    const stripeGeom = new THREE.BufferGeometry();
    const stripeVerts: number[] = [];
    const stripeIndices: number[] = [];
    const stripeWidth = width >= 12 ? 0.35 : 0.25;

    const { left: sL, right: sR } = computeMiterOffsets(points, stripeWidth / 2);
    for (let i = 0; i < n; i++) {
      stripeVerts.push(sL[i].x, elevation + thickness + 0.015, -sL[i].y);
      stripeVerts.push(sR[i].x, elevation + thickness + 0.015, -sR[i].y);
    }
    for (let i = 0; i < n - 1; i++) {
      const l0 = i * 2;
      const r0 = i * 2 + 1;
      const l1 = (i + 1) * 2;
      const r1 = (i + 1) * 2 + 1;
      stripeIndices.push(l0, r0, r1);
      stripeIndices.push(l0, r1, l1);
    }
    stripeGeom.setAttribute('position', new THREE.Float32BufferAttribute(stripeVerts, 3));
    stripeGeom.setIndex(stripeIndices);
    stripeGeom.computeVertexNormals();

    const isHighway = width >= 14 || element.metadata?.roadType === 'expressway';
    meshes.push({
      geometry: stripeGeom,
      material: isHighway ? DAYLIGHT_MATERIALS.roadMarkingYellow : DAYLIGHT_MATERIALS.roadMarking,
      name: `${element.id}_striping`,
    });
  }

  // Raised Concrete Curbs along road outer edges
  const curbOffset = 0.25;
  const curbHeight = 0.2;
  const { left: curbL1, right: curbR1 } = computeMiterOffsets(points, halfWidth);
  const { left: curbL2, right: curbR2 } = computeMiterOffsets(points, halfWidth + curbOffset);

  const curbVerts: number[] = [];
  const curbIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    // Left curb (inner & outer)
    curbVerts.push(curbL1[i].x, elevation + thickness + curbHeight, -curbL1[i].y);
    curbVerts.push(curbL2[i].x, elevation + thickness + curbHeight, -curbL2[i].y);
    // Right curb (inner & outer)
    curbVerts.push(curbR1[i].x, elevation + thickness + curbHeight, -curbR1[i].y);
    curbVerts.push(curbR2[i].x, elevation + thickness + curbHeight, -curbR2[i].y);
  }

  for (let i = 0; i < n - 1; i++) {
    // Left curb quad
    const l0 = i * 4;
    const l1 = i * 4 + 1;
    const l2 = (i + 1) * 4;
    const l3 = (i + 1) * 4 + 1;
    curbIndices.push(l0, l1, l3);
    curbIndices.push(l0, l3, l2);

    // Right curb quad
    const r0 = i * 4 + 2;
    const r1 = i * 4 + 3;
    const r2 = (i + 1) * 4 + 2;
    const r3 = (i + 1) * 4 + 3;
    curbIndices.push(r0, r1, r3);
    curbIndices.push(r0, r3, r2);
  }

  const curbGeom = new THREE.BufferGeometry();
  curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
  curbGeom.setIndex(curbIndices);
  curbGeom.computeVertexNormals();

  meshes.push({
    geometry: curbGeom,
    material: DAYLIGHT_MATERIALS.curbConcrete,
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_curbs`,
  });

  return {
    id: element.id,
    name: element.name || 'Road Corridor',
    type: 'road',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * Creates 3D bridge with elevated deck slab, crash barriers, structural girders, and auto-placed piers
 */
function createBridge3D(element: BlueprintElement): ConvertedElement3D {
  const points = element.points;
  const width = element.width || 12;
  const deckThickness = element.height || 1.4;
  const elevation = Math.max(element.elevation || 10, deckThickness + 2);
  const pierSpacing = element.pier_spacing || 26;
  const halfWidth = width / 2;

  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, 0, elevation, width);

  if (points.length < 2) {
    return {
      id: element.id,
      name: element.name || 'Viaduct Structure',
      type: 'bridge_deck',
      elevation,
      center,
      bounds,
      meshes,
    };
  }

  const { left, right } = computeMiterOffsets(points, halfWidth);
  const n = points.length;

  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Top surface
  for (let i = 0; i < n; i++) {
    vertices.push(left[i].x, elevation, -left[i].y);
    uvs.push(0, i / (n - 1));
    vertices.push(right[i].x, elevation, -right[i].y);
    uvs.push(1, i / (n - 1));
  }

  // Bottom surface
  const botOffset = 2 * n;
  for (let i = 0; i < n; i++) {
    vertices.push(left[i].x, elevation - deckThickness, -left[i].y);
    uvs.push(0, i / (n - 1));
    vertices.push(right[i].x, elevation - deckThickness, -right[i].y);
    uvs.push(1, i / (n - 1));
  }

  // Quads
  for (let i = 0; i < n - 1; i++) {
    const l0 = i * 2;
    const r0 = i * 2 + 1;
    const l1 = (i + 1) * 2;
    const r1 = (i + 1) * 2 + 1;
    indices.push(l0, r0, r1);
    indices.push(l0, r1, l1);

    const bl0 = botOffset + i * 2;
    const br0 = botOffset + i * 2 + 1;
    const bl1 = botOffset + (i + 1) * 2;
    const br1 = botOffset + (i + 1) * 2 + 1;
    indices.push(bl0, br1, br0);
    indices.push(bl0, bl1, br1);

    // Sides
    indices.push(l0, l1, bl1);
    indices.push(l0, bl1, bl0);
    indices.push(r0, br1, r1);
    indices.push(r0, br0, br1);
  }

  const deckGeom = new THREE.BufferGeometry();
  deckGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  deckGeom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  deckGeom.setIndex(indices);
  deckGeom.computeVertexNormals();

  meshes.push({
    geometry: deckGeom,
    material: DAYLIGHT_MATERIALS.concreteDeck,
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_deck`,
  });

  // Concrete Parapet / Crash Barriers on Deck Edges (0.9m high)
  const barrierH = 0.9;
  const barrierThick = 0.35;
  const { left: bL_inner } = computeMiterOffsets(points, halfWidth - barrierThick);
  const { right: bR_inner } = computeMiterOffsets(points, halfWidth - barrierThick);

  const barrierVerts: number[] = [];
  const barrierIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    // Left barrier: outer top, inner top, outer bottom, inner bottom
    barrierVerts.push(left[i].x, elevation + barrierH, -left[i].y);
    barrierVerts.push(bL_inner[i].x, elevation + barrierH, -bL_inner[i].y);
    // Right barrier: inner top, outer top
    barrierVerts.push(bR_inner[i].x, elevation + barrierH, -bR_inner[i].y);
    barrierVerts.push(right[i].x, elevation + barrierH, -right[i].y);
  }

  for (let i = 0; i < n - 1; i++) {
    // Left barrier top quad
    const l0 = i * 4;
    const l1 = i * 4 + 1;
    const l2 = (i + 1) * 4;
    const l3 = (i + 1) * 4 + 1;
    barrierIndices.push(l0, l1, l3);
    barrierIndices.push(l0, l3, l2);

    // Right barrier top quad
    const r0 = i * 4 + 2;
    const r1 = i * 4 + 3;
    const r2 = (i + 1) * 4 + 2;
    const r3 = (i + 1) * 4 + 3;
    barrierIndices.push(r0, r1, r3);
    barrierIndices.push(r0, r3, r2);
  }

  const barrierGeom = new THREE.BufferGeometry();
  barrierGeom.setAttribute('position', new THREE.Float32BufferAttribute(barrierVerts, 3));
  barrierGeom.setIndex(barrierIndices);
  barrierGeom.computeVertexNormals();

  meshes.push({
    geometry: barrierGeom,
    material: DAYLIGHT_MATERIALS.pierConcrete,
    castShadow: true,
    name: `${element.id}_barriers`,
  });

  // Auto-placed Pier Meshes
  const sampledPiers = samplePointsAlongPolyline(points, pierSpacing, pierSpacing * 0.7);
  const pierHeight = elevation - deckThickness;
  const colRadius = Math.max(width * 0.07, 0.7);

  sampledPiers.forEach((sp, idx) => {
    const px = sp.point.x;
    const pz = -sp.point.y;
    const angle = Math.atan2(sp.normal.y, sp.normal.x);

    // Flared crosshead beam
    const crossheadGeom = new THREE.BoxGeometry(width * 0.9, 1.1, 2.2);
    meshes.push({
      geometry: crossheadGeom,
      material: DAYLIGHT_MATERIALS.girderSteel,
      position: new THREE.Vector3(px, elevation - deckThickness - 0.55, pz),
      rotation: new THREE.Euler(0, angle, 0),
      castShadow: true,
      name: `${element.id}_crosshead_${idx}`,
    });

    // Twin Cylindrical Pier Columns
    const columnSpacing = width * 0.32;
    [-columnSpacing, columnSpacing].forEach((offset, colIdx) => {
      const colGeom = new THREE.CylinderGeometry(colRadius, colRadius * 1.15, pierHeight, 16);
      const cx = px + Math.cos(angle) * offset;
      const cz = pz - Math.sin(angle) * offset;

      meshes.push({
        geometry: colGeom,
        material: DAYLIGHT_MATERIALS.pierConcrete,
        position: new THREE.Vector3(cx, pierHeight / 2, cz),
        castShadow: true,
        receiveShadow: true,
        name: `${element.id}_pier_${idx}_col_${colIdx}`,
      });

      // Concrete Footing Pad
      const padGeom = new THREE.BoxGeometry(colRadius * 3.2, 0.6, colRadius * 3.2);
      meshes.push({
        geometry: padGeom,
        material: DAYLIGHT_MATERIALS.pierConcrete,
        position: new THREE.Vector3(cx, 0.3, cz),
        castShadow: true,
        name: `${element.id}_footing_${idx}_col_${colIdx}`,
      });
    });
  });

  return {
    id: element.id,
    name: element.name || 'Bridge Viaduct',
    type: 'bridge_deck',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * Constructs a high-performance 3D lattice truss tower crane with foundation, slewing cab, jib, and hook
 */
function createTowerCrane3D(element: BlueprintElement): ConvertedElement3D {
  const points = element.points;
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cz = points.reduce((s, p) => s + (-p.y), 0) / points.length;
  const height = Math.max(element.height || 55, 30);
  const elevation = element.elevation || 0;

  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, elevation, height, 40);

  // 0. Heavy Concrete Foundation Pad
  const padGeom = new THREE.BoxGeometry(6, 1.2, 6);
  meshes.push({
    geometry: padGeom,
    material: DAYLIGHT_MATERIALS.craneConcrete,
    position: new THREE.Vector3(cx, elevation + 0.6, cz),
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_foundation_pad`,
  });

  // 1. Vertical Lattice Mast (4 corner tubular columns)
  const mastWidth = 2.4;
  const colRadius = 0.12;
  const colHalf = mastWidth / 2;

  [[-colHalf, -colHalf], [colHalf, -colHalf], [colHalf, colHalf], [-colHalf, colHalf]].forEach(([ox, oz], i) => {
    const mastColGeom = new THREE.CylinderGeometry(colRadius, colRadius, height, 8);
    meshes.push({
      geometry: mastColGeom,
      material: DAYLIGHT_MATERIALS.craneSteel,
      position: new THREE.Vector3(cx + ox, elevation + height / 2, cz + oz),
      castShadow: true,
      name: `${element.id}_mast_leg_${i}`,
    });
  });

  // Horizontal lattice braces up the mast
  const braceLevels = Math.floor(height / 4);
  for (let l = 1; l <= braceLevels; l++) {
    const by = elevation + l * 4;
    const braceGeom = new THREE.BoxGeometry(mastWidth + 0.1, 0.15, mastWidth + 0.1);
    meshes.push({
      geometry: braceGeom,
      material: DAYLIGHT_MATERIALS.craneSteel,
      position: new THREE.Vector3(cx, by, cz),
      name: `${element.id}_mast_brace_${l}`,
    });
  }

  // 2. Slewing Unit & Operator Cab
  const cabGeom = new THREE.BoxGeometry(2.0, 2.2, 2.2);
  meshes.push({
    geometry: cabGeom,
    material: DAYLIGHT_MATERIALS.buildingGlassFacade,
    position: new THREE.Vector3(cx + 1.2, elevation + height + 1.2, cz),
    name: `${element.id}_cab`,
  });

  // 3. Jib Arm (Horizontal Boom extending 45m)
  const jibLength = 45;
  const jibGeom = new THREE.BoxGeometry(jibLength, 1.4, 1.4);
  meshes.push({
    geometry: jibGeom,
    material: DAYLIGHT_MATERIALS.craneSteel,
    position: new THREE.Vector3(cx + jibLength / 2, elevation + height + 2.5, cz),
    castShadow: true,
    name: `${element.id}_jib_boom`,
  });

  // 4. Counter-Jib with Concrete Counterweight
  const counterJibLen = 16;
  const cJibGeom = new THREE.BoxGeometry(counterJibLen, 1.4, 1.4);
  meshes.push({
    geometry: cJibGeom,
    material: DAYLIGHT_MATERIALS.craneSteel,
    position: new THREE.Vector3(cx - counterJibLen / 2, elevation + height + 2.5, cz),
    castShadow: true,
    name: `${element.id}_counter_jib`,
  });

  const counterweightGeom = new THREE.BoxGeometry(3.5, 2.2, 2.0);
  meshes.push({
    geometry: counterweightGeom,
    material: DAYLIGHT_MATERIALS.craneConcrete,
    position: new THREE.Vector3(cx - counterJibLen + 2.5, elevation + height + 2.5, cz),
    castShadow: true,
    name: `${element.id}_counterweight`,
  });

  // 5. A-Frame Apex & Tie Rods
  const apexGeom = new THREE.ConeGeometry(1.6, 6, 4);
  meshes.push({
    geometry: apexGeom,
    material: DAYLIGHT_MATERIALS.craneSteel,
    position: new THREE.Vector3(cx, elevation + height + 5.5, cz),
    name: `${element.id}_apex`,
  });

  // 6. Hoist Trolley, Cable and Hook Spreader
  const trolleyOffset = jibLength * 0.55;
  const trolleyGeom = new THREE.BoxGeometry(1.2, 0.6, 1.2);
  meshes.push({
    geometry: trolleyGeom,
    material: DAYLIGHT_MATERIALS.craneSteel,
    position: new THREE.Vector3(cx + trolleyOffset, elevation + height + 1.5, cz),
    name: `${element.id}_trolley`,
  });

  const cableDrop = height * 0.6;
  const cableGeom = new THREE.CylinderGeometry(0.04, 0.04, cableDrop, 4);
  meshes.push({
    geometry: cableGeom,
    material: DAYLIGHT_MATERIALS.electricWire,
    position: new THREE.Vector3(cx + trolleyOffset, elevation + height + 1.5 - cableDrop / 2, cz),
    name: `${element.id}_cable`,
  });

  const hookBlockGeom = new THREE.BoxGeometry(0.9, 0.8, 0.9);
  meshes.push({
    geometry: hookBlockGeom,
    material: DAYLIGHT_MATERIALS.craneSteel,
    position: new THREE.Vector3(cx + trolleyOffset, elevation + height + 1.5 - cableDrop, cz),
    castShadow: true,
    name: `${element.id}_hook_block`,
  });

  return {
    id: element.id,
    name: element.name || 'Tower Crane',
    type: (element.type as any) || 'crane',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * Creates an authentic, world-class 3D Stadium arena with manicured turf, central wicket,
 * 360-degree tiered spectator seating bowl, architectural facade colonnade, open cantilevered canopy roof,
 * dual jumbotron scoreboards, and high-mast corner floodlight towers.
 */
function createStadium3D(element: BlueprintElement): ConvertedElement3D {
  const points = element.points;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  points.forEach(p => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, -p.y);
    maxZ = Math.max(maxZ, -p.y);
  });

  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const rx = Math.max((maxX - minX) / 2, 45);
  const rz = Math.max((maxZ - minZ) / 2, 35);
  // Realistic urban stadium height: ~18m (approx 5-6 stories) so it is proportional to city architecture
  const height = Math.min(Math.max(element.height || 18, 14), 22);
  const elevation = element.elevation || 0;

  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, elevation, height, Math.max(rx, rz) * 2.5);

  const scaleZ = rz / rx;

  // 1. Surrounding Concrete Plinth / Ground Apron
  const plinthGeom = new THREE.CylinderGeometry(rx * 1.08, rx * 1.10, 0.4, 32);
  plinthGeom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: plinthGeom,
    material: DAYLIGHT_MATERIALS.stadiumConcrete,
    position: new THREE.Vector3(cx, elevation + 0.2, cz),
    receiveShadow: true,
    name: `${element.id}_plinth`,
  });

  // 2. Central Lush Playing Field (Pitch / Infield Oval)
  const pitchRx = rx * 0.60;
  const turfGeom = new THREE.CylinderGeometry(pitchRx, pitchRx, 0.35, 32);
  turfGeom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: turfGeom,
    material: DAYLIGHT_MATERIALS.stadiumPitch,
    position: new THREE.Vector3(cx, elevation + 0.35, cz),
    receiveShadow: true,
    name: `${element.id}_turf_field`,
  });

  // 3. Central Cricket Pitch Wicket Strip
  const wicketL = Math.min(pitchRx * 0.70, 22);
  const wicketW = 3.6;
  const wicketGeom = new THREE.BoxGeometry(wicketL, 0.08, wicketW);
  meshes.push({
    geometry: wicketGeom,
    material: DAYLIGHT_MATERIALS.stadiumWicket,
    position: new THREE.Vector3(cx, elevation + 0.55, cz),
    receiveShadow: true,
    name: `${element.id}_cricket_wicket`,
  });

  // Batting / Bowling crease markings at ends of the pitch
  [-wicketL / 2 + 1.2, wicketL / 2 - 1.2].forEach((ox, creaseIdx) => {
    const creaseGeom = new THREE.BoxGeometry(0.2, 0.1, wicketW * 0.9);
    meshes.push({
      geometry: creaseGeom,
      material: DAYLIGHT_MATERIALS.stadiumMarking,
      position: new THREE.Vector3(cx + ox, elevation + 0.58, cz),
      name: `${element.id}_crease_${creaseIdx}`,
    });

    // 3 Wicket stumps at each crease
    [-0.3, 0, 0.3].forEach((oz, stumpIdx) => {
      const stumpGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 6);
      meshes.push({
        geometry: stumpGeom,
        material: DAYLIGHT_MATERIALS.stadiumMarking,
        position: new THREE.Vector3(cx + ox, elevation + 0.95, cz + oz),
        name: `${element.id}_stump_${creaseIdx}_${stumpIdx}`,
      });
    });
  });

  // Oval Boundary Rope Marking Line
  const boundaryGeom = new THREE.RingGeometry(pitchRx * 0.94, pitchRx * 0.97, 32);
  boundaryGeom.rotateX(-Math.PI / 2);
  boundaryGeom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: boundaryGeom,
    material: DAYLIGHT_MATERIALS.stadiumMarking,
    position: new THREE.Vector3(cx, elevation + 0.56, cz),
    name: `${element.id}_boundary_rope`,
  });

  // Infield 30-Yard Fielding Circle Line
  const infieldCircleGeom = new THREE.RingGeometry(pitchRx * 0.55, pitchRx * 0.57, 32);
  infieldCircleGeom.rotateX(-Math.PI / 2);
  infieldCircleGeom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: infieldCircleGeom,
    material: DAYLIGHT_MATERIALS.stadiumMarking,
    position: new THREE.Vector3(cx, elevation + 0.56, cz),
    name: `${element.id}_infield_circle`,
  });

  // 4. 360-Degree Continuous Tiered Spectator Seating Bowl (Sloped Raked Stands)
  // Tier 1: Lower Bowl (pitch edge to 45% height)
  const t1H = height * 0.45;
  const t1Geom = new THREE.CylinderGeometry(
    rx * 0.78,
    pitchRx,
    t1H,
    32,
    1,
    false
  );
  t1Geom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: t1Geom,
    material: DAYLIGHT_MATERIALS.stadiumSeats,
    position: new THREE.Vector3(cx, elevation + 0.4 + t1H / 2, cz),
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_bowl_tier_1`,
  });

  // Tier 2: Upper Grandstand Deck (45% to 88% height)
  const t2H = height * 0.43;
  const t2Geom = new THREE.CylinderGeometry(
    rx * 0.98,
    rx * 0.78,
    t2H,
    32,
    1,
    false
  );
  t2Geom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: t2Geom,
    material: DAYLIGHT_MATERIALS.stadiumSeatsUpper,
    position: new THREE.Vector3(cx, elevation + 0.4 + t1H + t2H / 2, cz),
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_bowl_tier_2`,
  });

  // 5. Exterior Architectural Facade Shell
  const facadeH = height * 0.92;
  const facadeGeom = new THREE.CylinderGeometry(rx * 1.01, rx * 1.03, facadeH, 32, 1, false);
  facadeGeom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: facadeGeom,
    material: DAYLIGHT_MATERIALS.stadiumFacade,
    position: new THREE.Vector3(cx, elevation + facadeH / 2, cz),
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_facade_shell`,
  });

  // 6. 16 Structural Architectural Colonnade Pylons around exterior
  const pylonCount = 16;
  for (let p = 0; p < pylonCount; p++) {
    const angle = (p * Math.PI * 2) / pylonCount;
    const px = cx + Math.cos(angle) * (rx * 1.025);
    const pz = cz + Math.sin(angle) * (rz * 1.025);

    const colGeom = new THREE.BoxGeometry(1.4, height * 0.96, 1.4);
    meshes.push({
      geometry: colGeom,
      material: DAYLIGHT_MATERIALS.stadiumPylon,
      position: new THREE.Vector3(px, elevation + (height * 0.96) / 2, pz),
      castShadow: true,
      name: `${element.id}_exterior_col_${p}`,
    });
  }

  // 7. Cantilevered Tension Canopy Roof (covers only back rows of stands, leaves 82% of bowl OPEN to the sky)
  const roofGeom = new THREE.RingGeometry(rx * 0.82, rx * 1.06, 32);
  roofGeom.rotateX(-Math.PI / 2);
  roofGeom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: roofGeom,
    material: DAYLIGHT_MATERIALS.stadiumRoof,
    position: new THREE.Vector3(cx, elevation + height + 0.4, cz),
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_canopy_roof`,
  });

  // Outer Compression Fascia Ring on Roof
  const fasciaGeom = new THREE.CylinderGeometry(rx * 1.065, rx * 1.065, 0.8, 32, 1, true);
  fasciaGeom.scale(1, 1, scaleZ);
  meshes.push({
    geometry: fasciaGeom,
    material: DAYLIGHT_MATERIALS.stadiumPylon,
    position: new THREE.Vector3(cx, elevation + height + 0.4, cz),
    castShadow: true,
    name: `${element.id}_roof_fascia`,
  });

  // 8. Dual High-Definition Stadium Jumbotron Video Scoreboards
  [
    { name: 'north', posZ: cz - rz * 0.94, rotY: 0 },
    { name: 'south', posZ: cz + rz * 0.94, rotY: Math.PI },
  ].forEach((board) => {
    // Scoreboard Frame
    const frameGeom = new THREE.BoxGeometry(11, 5.2, 1.0);
    meshes.push({
      geometry: frameGeom,
      material: DAYLIGHT_MATERIALS.stadiumScoreboard,
      position: new THREE.Vector3(cx, elevation + height * 0.82, board.posZ),
      castShadow: true,
      name: `${element.id}_scoreboard_frame_${board.name}`,
    });

    // Scoreboard Digital LED Display Screen
    const screenGeom = new THREE.BoxGeometry(10.2, 4.6, 0.15);
    meshes.push({
      geometry: screenGeom,
      material: DAYLIGHT_MATERIALS.stadiumScoreboardScreen,
      position: new THREE.Vector3(
        cx,
        elevation + height * 0.82,
        board.posZ + (board.name === 'north' ? 0.52 : -0.52)
      ),
      name: `${element.id}_scoreboard_screen_${board.name}`,
    });
  });

  // 9. 4 Giant Corner High-Mast Floodlight Pylons positioned gracefully outside the stadium
  const floodlightAngles = [
    Math.PI * 0.25, // NE
    Math.PI * 0.75, // SE
    Math.PI * 1.25, // SW
    Math.PI * 1.75, // NW
  ];

  floodlightAngles.forEach((ang, idx) => {
    const fx = cx + Math.cos(ang) * (rx * 1.25);
    const fz = cz + Math.sin(ang) * (rz * 1.25);
    const mastHeight = height * 1.55;

    // Tapered Steel Lattice Mast
    const mastGeom = new THREE.CylinderGeometry(0.4, 1.2, mastHeight, 8);
    meshes.push({
      geometry: mastGeom,
      material: DAYLIGHT_MATERIALS.stadiumPylon,
      position: new THREE.Vector3(fx, elevation + mastHeight / 2, fz),
      castShadow: true,
      name: `${element.id}_floodlight_mast_${idx}`,
    });

    // Multi-tier lighting rack gantry head
    const gantryGeom = new THREE.BoxGeometry(5.2, 2.6, 1.0);
    meshes.push({
      geometry: gantryGeom,
      material: DAYLIGHT_MATERIALS.stadiumPylon,
      position: new THREE.Vector3(fx, elevation + mastHeight, fz),
      castShadow: true,
      name: `${element.id}_floodlight_gantry_${idx}`,
    });

    // Glowing Emissive Floodlight Array Panel
    const lampGeom = new THREE.BoxGeometry(4.8, 2.2, 0.2);
    meshes.push({
      geometry: lampGeom,
      material: DAYLIGHT_MATERIALS.stadiumFloodlight,
      position: new THREE.Vector3(
        fx - Math.cos(ang) * 0.5,
        elevation + mastHeight,
        fz - Math.sin(ang) * 0.5
      ),
      name: `${element.id}_floodlight_lamps_${idx}`,
    });
  });

  return {
    id: element.id,
    name: element.name || 'Athletic Stadium',
    type: 'stadium',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * Creates 3D Electric Utility Poles with crossarms, ceramic insulators, transformer, and overhead catenary wires
 */
function createElectricPole3D(element: BlueprintElement): ConvertedElement3D {
  const points = element.points;
  const poleHeight = Math.max(element.height || 11, 8);
  const elevation = element.elevation || 0;
  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, elevation, poleHeight, 15);

  const poleCoords: { x: number; z: number }[] = [];

  points.forEach((pt) => {
    poleCoords.push({ x: pt.x, z: -pt.y });
  });

  // Create a utility pole assembly at each coordinate
  poleCoords.forEach((coord, i) => {
    // 1. Main Pole Mast (treated timber or galvanized concrete)
    const poleGeom = new THREE.CylinderGeometry(0.18, 0.26, poleHeight, 8);
    meshes.push({
      geometry: poleGeom,
      material: DAYLIGHT_MATERIALS.electricPole,
      position: new THREE.Vector3(coord.x, elevation + poleHeight / 2, coord.z),
      castShadow: true,
      name: `${element.id}_pole_${i}`,
    });

    // 2. Upper Crossarm
    const topArmGeom = new THREE.BoxGeometry(2.8, 0.16, 0.16);
    meshes.push({
      geometry: topArmGeom,
      material: DAYLIGHT_MATERIALS.electricCrossarm,
      position: new THREE.Vector3(coord.x, elevation + poleHeight - 0.35, coord.z),
      name: `${element.id}_top_arm_${i}`,
    });

    // 3. Lower Crossarm (Secondary)
    const btmArmGeom = new THREE.BoxGeometry(3.6, 0.16, 0.16);
    meshes.push({
      geometry: btmArmGeom,
      material: DAYLIGHT_MATERIALS.electricCrossarm,
      position: new THREE.Vector3(coord.x, elevation + poleHeight - 1.4, coord.z),
      name: `${element.id}_btm_arm_${i}`,
    });

    // 4. Ceramic Disc Insulators
    [-1.2, 0, 1.2].forEach((offset, insIdx) => {
      const insGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 6);
      meshes.push({
        geometry: insGeom,
        material: DAYLIGHT_MATERIALS.electricInsulator,
        position: new THREE.Vector3(coord.x + offset, elevation + poleHeight - 0.18, coord.z),
        name: `${element.id}_insulator_top_${i}_${insIdx}`,
      });
    });

    [-1.6, 1.6].forEach((offset, insIdx) => {
      const insGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.25, 6);
      meshes.push({
        geometry: insGeom,
        material: DAYLIGHT_MATERIALS.electricInsulator,
        position: new THREE.Vector3(coord.x + offset, elevation + poleHeight - 1.25, coord.z),
        name: `${element.id}_insulator_btm_${i}_${insIdx}`,
      });
    });

    // 5. Pole-mounted Distribution Transformer (every alternating pole)
    if (i % 2 === 0) {
      const transformerGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.95, 8);
      meshes.push({
        geometry: transformerGeom,
        material: DAYLIGHT_MATERIALS.electricTransformer,
        position: new THREE.Vector3(coord.x + 0.45, elevation + poleHeight - 2.5, coord.z),
        castShadow: true,
        name: `${element.id}_transformer_${i}`,
      });
    }
  });

  // 6. Overhead Catenary Transmission Wires connecting consecutive poles
  if (poleCoords.length > 1) {
    for (let i = 0; i < poleCoords.length - 1; i++) {
      const p1 = poleCoords[i];
      const p2 = poleCoords[i + 1];
      const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z);
      if (dist < 0.5) continue;

      const offsets = [-1.2, 0, 1.2];
      offsets.forEach((ox, wireIdx) => {
        const start = new THREE.Vector3(p1.x + ox, elevation + poleHeight - 0.2, p1.z);
        const end = new THREE.Vector3(p2.x + ox, elevation + poleHeight - 0.2, p2.z);
        const sag = Math.min(dist * 0.04, 1.4);
        const mid = new THREE.Vector3((p1.x + p2.x) / 2 + ox, elevation + poleHeight - 0.2 - sag, (p1.z + p2.z) / 2);

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const wireGeom = new THREE.TubeGeometry(curve, 8, 0.03, 4, false);

        meshes.push({
          geometry: wireGeom,
          material: DAYLIGHT_MATERIALS.electricWire,
          name: `${element.id}_cable_${i}_${wireIdx}`,
        });
      });
    }
  }

  return {
    id: element.id,
    name: element.name || 'Electric Utility Grid',
    type: 'electric_pole',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * Creates 3D Water Pool / Basin with concrete coping rim, sunken bed, translucent water surface, and fountain jet
 */
function createWaterPool3D(element: BlueprintElement): ConvertedElement3D {
  const points = ensureCCW(element.points);
  const elevation = element.elevation || 0.05;
  const depth = Math.max(element.height || 2.5, 1.2);
  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, elevation, depth, 15);

  if (points.length < 3) {
    return {
      id: element.id,
      name: element.name || 'Water Pool Basin',
      type: 'water_pool',
      elevation,
      center,
      bounds,
      meshes,
    };
  }

  // 1. Water Surface Plane (translucent cyan-blue)
  const waterShape = new THREE.Shape();
  waterShape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    waterShape.lineTo(points[i].x, points[i].y);
  }
  waterShape.closePath();

  const waterGeom = new THREE.ShapeGeometry(waterShape);
  waterGeom.rotateX(-Math.PI / 2);
  meshes.push({
    geometry: waterGeom,
    material: DAYLIGHT_MATERIALS.poolWater,
    position: new THREE.Vector3(0, elevation + 0.15, 0),
    receiveShadow: true,
    name: `${element.id}_water_surface`,
  });

  // 2. Sunken Pool Basin Floor
  const floorGeom = new THREE.ShapeGeometry(waterShape);
  floorGeom.rotateX(-Math.PI / 2);
  meshes.push({
    geometry: floorGeom,
    material: DAYLIGHT_MATERIALS.poolFloor,
    position: new THREE.Vector3(0, elevation - depth + 0.2, 0),
    receiveShadow: true,
    name: `${element.id}_pool_floor`,
  });

  // 3. Concrete Coping Perimeter Curb Rim
  const closedPts = [...points, points[0]];
  const { left, right } = computeMiterOffsets(closedPts, 0.5);
  const n = closedPts.length;

  const vertices: number[] = [];
  const indices: number[] = [];
  const curbH = 0.35;

  for (let i = 0; i < n; i++) {
    vertices.push(left[i].x, elevation + curbH, -left[i].y);
    vertices.push(right[i].x, elevation + curbH, -right[i].y);
    vertices.push(left[i].x, elevation - depth + 0.2, -left[i].y);
    vertices.push(right[i].x, elevation - depth + 0.2, -right[i].y);
  }

  for (let i = 0; i < n - 1; i++) {
    const tL0 = i * 4;
    const tR0 = i * 4 + 1;
    const bL0 = i * 4 + 2;
    const bR0 = i * 4 + 3;

    const tL1 = (i + 1) * 4;
    const tR1 = (i + 1) * 4 + 1;
    const bL1 = (i + 1) * 4 + 2;
    const bR1 = (i + 1) * 4 + 3;

    indices.push(tL0, tR0, tR1);
    indices.push(tL0, tR1, tL1);
    indices.push(tL0, tL1, bL1);
    indices.push(tL0, bL1, bL0);
    indices.push(tR0, bR1, tR1);
    indices.push(tR0, bR0, bR1);
  }

  const curbGeom = new THREE.BufferGeometry();
  curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  curbGeom.setIndex(indices);
  curbGeom.computeVertexNormals();

  meshes.push({
    geometry: curbGeom,
    material: DAYLIGHT_MATERIALS.poolCoping,
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_coping_rim`,
  });

  // 4. Central Aerator / Fountain Spout Jet
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cz = points.reduce((s, p) => s + (-p.y), 0) / points.length;

  const nozzleGeom = new THREE.CylinderGeometry(0.2, 0.25, 0.6, 8);
  meshes.push({
    geometry: nozzleGeom,
    material: DAYLIGHT_MATERIALS.hvacMetal,
    position: new THREE.Vector3(cx, elevation + 0.3, cz),
    name: `${element.id}_fountain_nozzle`,
  });

  const sprayGeom = new THREE.ConeGeometry(0.6, 2.0, 8);
  meshes.push({
    geometry: sprayGeom,
    material: DAYLIGHT_MATERIALS.poolWater,
    position: new THREE.Vector3(cx, elevation + 1.3, cz),
    name: `${element.id}_fountain_spray`,
  });

  return {
    id: element.id,
    name: element.name || 'Water Pool Basin',
    type: 'water_pool',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * Creates 3D architectural extruded building with procedural facade, rooftop parapet, and mechanical equipment
 */
function createBuilding3D(element: BlueprintElement): ConvertedElement3D {
  // If this is a logistics tower crane, construct the realistic lattice crane model
  if (element.metadata?.isLogisticsCrane || element.id.includes('crane')) {
    return createTowerCrane3D(element);
  }

  const points = ensureCCW(element.points);
  const height = Math.max(element.height || 15, 3.5);
  const elevation = element.elevation || 0;
  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, elevation, height);

  if (points.length < 3) {
    return {
      id: element.id,
      name: element.name || 'Building Structure',
      type: 'building',
      elevation,
      center,
      bounds,
      meshes,
    };
  }

  // Create 2D cross-section shape
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();

  // Extrude along +Z by depth `height`
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: height,
    bevelEnabled: false,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);

  // EXACT COORDINATE FIX:
  // Rotating around X by -Math.PI / 2 maps:
  // (x, y, z_ext) -> (x, z_ext, -y)
  // Base at z_ext=0 is at Y = 0 (and position.y = elevation -> Y = elevation).
  // Top at z_ext=height is at Y = height (and position.y = elevation -> Y = elevation + height).
  // And Z = -y, which aligns 100% with roads and bridges!
  geom.rotateX(-Math.PI / 2);

  // Select architectural facade material
  let wallMat: THREE.Material = DAYLIGHT_MATERIALS.buildingConcreteFacade;
  const matLabel = element.material_label || '';
  const bldgType = element.metadata?.buildingType || '';

  if (matLabel === 'glass_curtain_wall' || bldgType === 'commercial' || bldgType === 'office') {
    wallMat = DAYLIGHT_MATERIALS.buildingGlassFacade;
  } else if (matLabel === 'warm_masonry' || bldgType === 'apartments' || bldgType === 'residential') {
    wallMat = DAYLIGHT_MATERIALS.buildingMasonryFacade;
  } else if (matLabel === 'commercial_brick' || bldgType === 'retail') {
    wallMat = DAYLIGHT_MATERIALS.buildingBrickFacade;
  } else if (element.metadata?.color) {
    // Retain textured window bays tinted with user's selected accent color
    wallMat = new THREE.MeshStandardMaterial({
      map: FACADE_TEXTURES.concrete,
      color: new THREE.Color(element.metadata.color),
      roughness: 0.5,
      metalness: 0.25,
    });
  }

  // In Three.js ExtrudeGeometry:
  // materials[0] = Caps (top roof and bottom base)
  // materials[1] = Extruded side faces (building facade walls)
  const materials = [DAYLIGHT_MATERIALS.roofMembrane, wallMat];

  meshes.push({
    geometry: geom,
    material: materials,
    position: new THREE.Vector3(0, elevation, 0),
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_volume`,
  });

  // Perimeter Roof Parapet (0.45m high curb along roof border)
  const closedPts = [...points, points[0]];
  const parapetOffset = 0.25;
  const parapetH = 0.45;
  const { left: pL, right: pR } = computeMiterOffsets(closedPts, parapetOffset / 2);
  const n = closedPts.length;

  const parapetVerts: number[] = [];
  const parapetIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    parapetVerts.push(pL[i].x, elevation + height + parapetH, -pL[i].y);
    parapetVerts.push(pR[i].x, elevation + height + parapetH, -pR[i].y);
    parapetVerts.push(pL[i].x, elevation + height, -pL[i].y);
    parapetVerts.push(pR[i].x, elevation + height, -pR[i].y);
  }

  for (let i = 0; i < n - 1; i++) {
    const t0 = i * 4;
    const t1 = i * 4 + 1;
    const t2 = (i + 1) * 4;
    const t3 = (i + 1) * 4 + 1;
    parapetIndices.push(t0, t1, t3);
    parapetIndices.push(t0, t3, t2);
  }

  const parapetGeom = new THREE.BufferGeometry();
  parapetGeom.setAttribute('position', new THREE.Float32BufferAttribute(parapetVerts, 3));
  parapetGeom.setIndex(parapetIndices);
  parapetGeom.computeVertexNormals();

  meshes.push({
    geometry: parapetGeom,
    material: DAYLIGHT_MATERIALS.curbConcrete,
    castShadow: true,
    name: `${element.id}_parapet`,
  });

  // Rooftop Mechanical Penthouse & HVAC Equipment (for buildings >= 12m)
  if (height >= 12) {
    const bCenter = center;
    const penthouseW = Math.min(bounds.size.x * 0.35, 12);
    const penthouseD = Math.min(bounds.size.z * 0.35, 12);
    const penthouseH = Math.min(height * 0.15, 3.8);

    const penthouseGeom = new THREE.BoxGeometry(penthouseW, penthouseH, penthouseD);
    meshes.push({
      geometry: penthouseGeom,
      material: DAYLIGHT_MATERIALS.buildingConcreteFacade,
      position: new THREE.Vector3(bCenter.x, elevation + height + penthouseH / 2, bCenter.z),
      castShadow: true,
      name: `${element.id}_penthouse`,
    });

    // 1-2 HVAC Chiller Units
    const hvacGeom = new THREE.BoxGeometry(2.2, 1.4, 2.8);
    meshes.push({
      geometry: hvacGeom,
      material: DAYLIGHT_MATERIALS.hvacMetal,
      position: new THREE.Vector3(bCenter.x + penthouseW * 0.65, elevation + height + 0.7, bCenter.z),
      castShadow: true,
      name: `${element.id}_hvac_1`,
    });
  }

  // Base Foundation Plinth Trim (0.4m high dark stone rim around building base)
  const plinthH = 0.4;
  const { left: plL, right: plR } = computeMiterOffsets(closedPts, 0.2);
  const plinthVerts: number[] = [];
  const plinthIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    plinthVerts.push(plL[i].x, elevation + plinthH, -plL[i].y);
    plinthVerts.push(plR[i].x, elevation + plinthH, -plR[i].y);
    plinthVerts.push(plL[i].x, elevation, -plL[i].y);
    plinthVerts.push(plR[i].x, elevation, -plR[i].y);
  }

  for (let i = 0; i < n - 1; i++) {
    const t0 = i * 4;
    const t1 = i * 4 + 1;
    const t2 = (i + 1) * 4;
    const t3 = (i + 1) * 4 + 1;
    plinthIndices.push(t0, t1, t3);
    plinthIndices.push(t0, t3, t2);
  }

  const plinthGeom = new THREE.BufferGeometry();
  plinthGeom.setAttribute('position', new THREE.Float32BufferAttribute(plinthVerts, 3));
  plinthGeom.setIndex(plinthIndices);
  plinthGeom.computeVertexNormals();

  meshes.push({
    geometry: plinthGeom,
    material: DAYLIGHT_MATERIALS.buildingPlinth,
    name: `${element.id}_plinth`,
  });

  return {
    id: element.id,
    name: element.name || 'Building Structure',
    type: 'building',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * Creates 3D Ground Parcels (Parks, Water Bodies, Parking Lots, Civic Plazas)
 */
function createGround3D(element: BlueprintElement): ConvertedElement3D {
  const points = ensureCCW(element.points);
  const groundType = element.metadata?.groundType || 'park';
  const meshes: ConvertedMeshInfo[] = [];

  const isWater = groundType === 'water';
  const elevation = isWater ? -0.15 : (element.elevation || 0.04);
  const thickness = isWater ? 0.35 : 0.12;

  const { center, bounds } = computeElementBounds(points, elevation, thickness);

  if (points.length < 3) {
    return {
      id: element.id,
      name: element.name || 'Ground Parcel',
      type: 'ground',
      elevation,
      center,
      bounds,
      meshes,
    };
  }

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();

  // Extrude ground parcel
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: false,
  };
  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.rotateX(-Math.PI / 2);

  // Material selection
  let mat: THREE.Material = DAYLIGHT_MATERIALS.parkGrass;
  if (isWater) mat = DAYLIGHT_MATERIALS.waterSurface;
  else if (groundType === 'parking') mat = DAYLIGHT_MATERIALS.parkingLot;
  else if (groundType === 'plaza') mat = DAYLIGHT_MATERIALS.plazaStone;

  meshes.push({
    geometry: geom,
    material: mat,
    position: new THREE.Vector3(0, elevation, 0),
    receiveShadow: true,
    name: `${element.id}_ground_surface`,
  });

  // Perimeter Curb / Retaining Wall for Ground Parcel
  const closedPts = [...points, points[0]];
  const curbOffset = isWater ? 0.4 : 0.25;
  const curbH = isWater ? 0.3 : 0.15;
  const { left, right } = computeMiterOffsets(closedPts, curbOffset / 2);
  const n = closedPts.length;

  const curbVerts: number[] = [];
  const curbIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    curbVerts.push(left[i].x, elevation + curbH, -left[i].y);
    curbVerts.push(right[i].x, elevation + curbH, -right[i].y);
    curbVerts.push(left[i].x, elevation, -left[i].y);
    curbVerts.push(right[i].x, elevation, -right[i].y);
  }

  for (let i = 0; i < n - 1; i++) {
    const t0 = i * 4;
    const t1 = i * 4 + 1;
    const t2 = (i + 1) * 4;
    const t3 = (i + 1) * 4 + 1;
    curbIndices.push(t0, t1, t3);
    curbIndices.push(t0, t3, t2);
  }

  const curbGeom = new THREE.BufferGeometry();
  curbGeom.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
  curbGeom.setIndex(curbIndices);
  curbGeom.computeVertexNormals();

  meshes.push({
    geometry: curbGeom,
    material: isWater ? DAYLIGHT_MATERIALS.waterBed : DAYLIGHT_MATERIALS.curbConcrete,
    receiveShadow: true,
    name: `${element.id}_curb`,
  });

  // For Parks: Scatter 3D Low-Poly Trees along interior points
  if (
    groundType === 'park' && 
    bounds.size.x > 15 && 
    bounds.size.z > 15 &&
    !/stadium|maidan|cricket|pitch|arena|sports|brabourne|wankhede/i.test(element.name || '')
  ) {
    const treeCount = Math.min(Math.floor((bounds.size.x * bounds.size.z) / 450), 10);
    const bMin = bounds.min;
    const bSize = bounds.size;

    for (let t = 0; t < treeCount; t++) {
      // Deterministic tree positioning
      const tx = bMin.x + bSize.x * (0.2 + ((t * 37) % 60) / 100);
      const tz = bMin.z + bSize.z * (0.2 + ((t * 53) % 60) / 100);
      const treeH = 4.5 + (t % 3) * 1.5;
      const trunkH = treeH * 0.45;
      const crownH = treeH * 0.7;

      // Tree trunk
      const trunkGeom = new THREE.CylinderGeometry(0.2, 0.28, trunkH, 6);
      meshes.push({
        geometry: trunkGeom,
        material: DAYLIGHT_MATERIALS.treeTrunk,
        position: new THREE.Vector3(tx, elevation + trunkH / 2, tz),
        castShadow: true,
        name: `${element.id}_tree_${t}_trunk`,
      });

      // Realistic tree foliage crowns
      const isPine = t % 2 === 0;
      if (isPine) {
        // Stacked double-cone for realistic conifer silhouette
        const lowerH = crownH * 0.55;
        const upperH = crownH * 0.55;
        const lowerCone = new THREE.ConeGeometry(treeH * 0.38, lowerH, 8);
        const upperCone = new THREE.ConeGeometry(treeH * 0.28, upperH, 8);

        meshes.push({
          geometry: lowerCone,
          material: DAYLIGHT_MATERIALS.parkFoliage,
          position: new THREE.Vector3(tx, elevation + trunkH + lowerH * 0.45, tz),
          castShadow: true,
          receiveShadow: true,
          name: `${element.id}_tree_${t}_crown_lower`,
        });
        meshes.push({
          geometry: upperCone,
          material: DAYLIGHT_MATERIALS.parkFoliageAlt,
          position: new THREE.Vector3(tx, elevation + trunkH + lowerH * 0.75 + upperH * 0.45, tz),
          castShadow: true,
          receiveShadow: true,
          name: `${element.id}_tree_${t}_crown_upper`,
        });
      } else {
        // Multi-lobed organic canopy for deciduous tree
        const mainRadius = treeH * 0.32;
        const mainGeom = new THREE.DodecahedronGeometry(mainRadius, 1);
        const subGeom1 = new THREE.DodecahedronGeometry(mainRadius * 0.72, 1);
        const subGeom2 = new THREE.DodecahedronGeometry(mainRadius * 0.65, 1);

        meshes.push({
          geometry: mainGeom,
          material: DAYLIGHT_MATERIALS.parkFoliage,
          position: new THREE.Vector3(tx, elevation + trunkH + mainRadius * 0.9, tz),
          castShadow: true,
          receiveShadow: true,
          name: `${element.id}_tree_${t}_crown_main`,
        });
        meshes.push({
          geometry: subGeom1,
          material: DAYLIGHT_MATERIALS.parkFoliageAlt,
          position: new THREE.Vector3(tx + mainRadius * 0.45, elevation + trunkH + mainRadius * 1.1, tz + mainRadius * 0.3),
          castShadow: true,
          receiveShadow: true,
          name: `${element.id}_tree_${t}_crown_lobe1`,
        });
        meshes.push({
          geometry: subGeom2,
          material: DAYLIGHT_MATERIALS.parkFoliage,
          position: new THREE.Vector3(tx - mainRadius * 0.4, elevation + trunkH + mainRadius * 0.8, tz - mainRadius * 0.35),
          castShadow: true,
          receiveShadow: true,
          name: `${element.id}_tree_${t}_crown_lobe2`,
        });
      }
    }
  }

  return {
    id: element.id,
    name: element.name || 'Ground Parcel',
    type: 'ground',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * Creates 3D ground boundary ribbon / fence and plot tint
 */
function createBoundary3D(element: BlueprintElement): ConvertedElement3D {
  const points = ensureCCW(element.points);
  const elevation = element.elevation || 0.05;
  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, elevation, 0.4);

  if (points.length < 3) {
    return {
      id: element.id,
      name: element.name || 'Site Plot',
      type: 'boundary',
      elevation,
      center,
      bounds,
      meshes,
    };
  }

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();

  const flatGeom = new THREE.ShapeGeometry(shape);
  // EXACT COORDINATE FIX: Rotate around X by -Math.PI / 2 so Z aligns with -y
  flatGeom.rotateX(-Math.PI / 2);

  meshes.push({
    geometry: flatGeom,
    material: DAYLIGHT_MATERIALS.boundaryPlot,
    position: new THREE.Vector3(0, elevation, 0),
    receiveShadow: true,
    name: `${element.id}_plot`,
  });

  const closedPts = [...points, points[0]];
  const { left, right } = computeMiterOffsets(closedPts, 0.3);
  const n = closedPts.length;

  const vertices: number[] = [];
  const indices: number[] = [];
  const curbHeight = 0.4;

  for (let i = 0; i < n; i++) {
    vertices.push(left[i].x, elevation + curbHeight, -left[i].y);
    vertices.push(right[i].x, elevation + curbHeight, -right[i].y);
    vertices.push(left[i].x, elevation, -left[i].y);
    vertices.push(right[i].x, elevation, -right[i].y);
  }

  for (let i = 0; i < n - 1; i++) {
    const tL0 = i * 4;
    const tR0 = i * 4 + 1;
    const bL0 = i * 4 + 2;
    const bR0 = i * 4 + 3;

    const tL1 = (i + 1) * 4;
    const tR1 = (i + 1) * 4 + 1;
    const bL1 = (i + 1) * 4 + 2;
    const bR1 = (i + 1) * 4 + 3;

    indices.push(tL0, tR0, tR1);
    indices.push(tL0, tR1, tL1);
    indices.push(tL0, tL1, bL1);
    indices.push(tL0, bL1, bL0);
    indices.push(tR0, bR1, tR1);
    indices.push(tR0, bR0, bR1);
  }

  const borderGeom = new THREE.BufferGeometry();
  borderGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  borderGeom.setIndex(indices);
  borderGeom.computeVertexNormals();

  meshes.push({
    geometry: borderGeom,
    material: DAYLIGHT_MATERIALS.boundaryBorder,
    castShadow: true,
    name: `${element.id}_curb`,
  });

  return {
    id: element.id,
    name: element.name || 'Site Plot Boundary',
    type: 'boundary',
    elevation,
    center,
    bounds,
    meshes,
  };
}

/**
 * PURE FUNCTION: Converts an array of BlueprintElements into Three.js-ready 3D models.
 */
export function blueprintTo3D(elements: BlueprintElement[]): ConvertedScene3D {
  const convertedElements: ConvertedElement3D[] = [];

  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

  // 1. Identify any stadium footprints to avoid overlapping/colliding buildings or cranes
  const stadiumZones: { cx: number; cz: number; rx: number; rz: number }[] = [];
  for (const el of elements) {
    const isStadium =
      el.type === 'stadium' ||
      (el.type === 'ground' && /stadium|arena|pitch|maidan|cricket|football|brabourne|wankhede|sports/i.test(el.name || '')) ||
      (el.type === 'building' && /stadium|arena|grandstand/i.test(el.name || ''));

    if (isStadium && el.points && el.points.length > 0) {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      el.points.forEach(p => {
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, -p.y);
        maxZ = Math.max(maxZ, -p.y);
      });
      const cx = (minX + maxX) / 2;
      const cz = (minZ + maxZ) / 2;
      const rx = Math.max((maxX - minX) / 2, 45);
      const rz = Math.max((maxZ - minZ) / 2, 35);
      stadiumZones.push({ cx, cz, rx: rx * 1.15, rz: rz * 1.15 });
    }
  }

  for (const element of elements) {
    if (!element.points || element.points.length === 0) continue;

    const isThisAStadium =
      element.type === 'stadium' ||
      (element.type === 'ground' && /stadium|arena|pitch|maidan|cricket|football|brabourne|wankhede|sports/i.test(element.name || '')) ||
      (element.type === 'building' && /stadium|arena|grandstand/i.test(element.name || ''));

    // Check if element is positioned inside a stadium zone
    const isInsideStadium = stadiumZones.some(zone => {
      const ecx = element.points.reduce((s, p) => s + p.x, 0) / element.points.length;
      const ecz = element.points.reduce((s, p) => s + (-p.y), 0) / element.points.length;
      const dx = (ecx - zone.cx) / zone.rx;
      const dz = (ecz - zone.cz) / zone.rz;
      return dx * dx + dz * dz < 1.0;
    });

    // If an ordinary building or ground parcel is inside the stadium bowl, skip it so it doesn't poke through!
    if (isInsideStadium && !isThisAStadium && (element.type === 'building' || element.type === 'ground')) {
      continue;
    }

    let workingElement = element;
    // If a crane is inside the stadium, offset it outside the stadium perimeter to the logistics gate
    if (isInsideStadium && (element.type === 'crane' || element.metadata?.isLogisticsCrane)) {
      const zone = stadiumZones[0];
      const offsetPoints = element.points.map(p => ({
        x: p.x + (zone.rx + 20),
        y: p.y - 15,
      }));
      workingElement = { ...element, points: offsetPoints };
    }

    let converted: ConvertedElement3D | null = null;
    switch (workingElement.type) {
      case 'road':
        converted = createRoad3D(workingElement);
        break;
      case 'bridge_deck':
        converted = createBridge3D(workingElement);
        break;
      case 'building':
        if (
          /stadium|arena|grandstand/i.test(workingElement.name || '') ||
          workingElement.metadata?.buildingType === 'stadium' ||
          workingElement.metadata?.buildingType === 'grandstand'
        ) {
          converted = createStadium3D(workingElement);
          break;
        }
        converted = createBuilding3D(workingElement);
        break;
      case 'ground':
        if (
          /stadium|arena|pitch|maidan|cricket|football|brabourne|wankhede|sports/i.test(workingElement.name || '') ||
          workingElement.metadata?.groundType === 'stadium' ||
          workingElement.metadata?.sport
        ) {
          converted = createStadium3D(workingElement);
          break;
        }
        converted = createGround3D(workingElement);
        break;
      case 'boundary':
        converted = createBoundary3D(workingElement);
        break;
      case 'stadium':
        converted = createStadium3D(workingElement);
        break;
      case 'crane':
        converted = createTowerCrane3D(workingElement);
        break;
      case 'electric_pole':
        converted = createElectricPole3D(workingElement);
        break;
      case 'water_pool':
        converted = createWaterPool3D(workingElement);
        break;
    }

    if (converted) {
      convertedElements.push(converted);

      min.x = Math.min(min.x, converted.bounds.min.x);
      min.y = Math.min(min.y, converted.bounds.min.y);
      min.z = Math.min(min.z, converted.bounds.min.z);

      max.x = Math.max(max.x, converted.bounds.max.x);
      max.y = Math.max(max.y, converted.bounds.max.y);
      max.z = Math.max(max.z, converted.bounds.max.z);
    }
  }

  if (!isFinite(min.x)) {
    min.set(-50, 0, -50);
    max.set(50, 20, 50);
  }

  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const size = new THREE.Vector3().subVectors(max, min);

  return {
    elements: convertedElements,
    bounds: { min, max, center, size },
  };
}
