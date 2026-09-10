import * as THREE from 'three';
import type { BlueprintElement } from '../types';
import { computeMiterOffsets, samplePointsAlongPolyline, ensureCCW } from './math2d';

export interface ConvertedMeshInfo {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
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

// Daylight Material Palette for Clean Architectural/Civil Presentation
export const DAYLIGHT_MATERIALS = {
  asphalt: new THREE.MeshStandardMaterial({
    color: 0x242a35,
    roughness: 0.82,
    metalness: 0.1,
  }),
  roadMarking: new THREE.MeshBasicMaterial({
    color: 0xffffff,
  }),
  concreteDeck: new THREE.MeshStandardMaterial({
    color: 0xdde4ed,
    roughness: 0.6,
    metalness: 0.15,
  }),
  pierConcrete: new THREE.MeshStandardMaterial({
    color: 0xb8c5d6,
    roughness: 0.7,
    metalness: 0.2,
  }),
  girderSteel: new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.45,
    metalness: 0.65,
  }),
  buildingGlass: new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.85,
    transparent: true,
    opacity: 0.88,
  }),
  buildingMasonry: new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.75,
    metalness: 0.1,
  }),
  boundaryPlot: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    wireframe: false,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
  }),
  boundaryBorder: new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.4,
  }),
  selectedHighlight: new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    emissive: 0x0284c7,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.5,
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
 * Creates 3D extruded road geometry with continuous mitering and realistic depth
 */
function createRoad3D(element: BlueprintElement): ConvertedElement3D {
  const points = element.points;
  const width = element.width || 10;
  const elevation = element.elevation || 0.1;
  const thickness = 0.35;
  const halfWidth = width / 2;

  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, elevation, thickness);

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

  // Top surface vertices
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

  meshes.push({
    geometry,
    material: DAYLIGHT_MATERIALS.asphalt,
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_surface`,
  });

  // Center road striping
  const stripeGeom = new THREE.BufferGeometry();
  const stripeVerts: number[] = [];
  const stripeIndices: number[] = [];
  const stripeWidth = 0.3;

  const { left: sL, right: sR } = computeMiterOffsets(points, stripeWidth / 2);
  for (let i = 0; i < n; i++) {
    stripeVerts.push(sL[i].x, elevation + thickness + 0.02, -sL[i].y);
    stripeVerts.push(sR[i].x, elevation + thickness + 0.02, -sR[i].y);
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

  meshes.push({
    geometry: stripeGeom,
    material: DAYLIGHT_MATERIALS.roadMarking,
    name: `${element.id}_striping`,
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
 * Creates 3D bridge with elevated deck slab, structural girders, and auto-placed piers
 */
function createBridge3D(element: BlueprintElement): ConvertedElement3D {
  const points = element.points;
  const width = element.width || 12;
  const deckThickness = element.height || 1.4;
  const elevation = Math.max(element.elevation || 10, deckThickness + 2);
  const pierSpacing = element.pier_spacing || 25;
  const halfWidth = width / 2;

  const meshes: ConvertedMeshInfo[] = [];
  const { center, bounds } = computeElementBounds(points, 0, elevation);

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

  // Auto-placed Pier Meshes
  const sampledPiers = samplePointsAlongPolyline(points, pierSpacing, pierSpacing * 0.7);
  const pierHeight = elevation - deckThickness;
  const colRadius = Math.max(width * 0.08, 0.75);

  sampledPiers.forEach((sp, idx) => {
    const px = sp.point.x;
    const pz = -sp.point.y;
    const angle = Math.atan2(sp.normal.y, sp.normal.x);

    // Crosshead beam
    const crossheadGeom = new THREE.BoxGeometry(width * 0.88, 0.9, 2.0);
    meshes.push({
      geometry: crossheadGeom,
      material: DAYLIGHT_MATERIALS.girderSteel,
      position: new THREE.Vector3(px, elevation - deckThickness - 0.45, pz),
      rotation: new THREE.Euler(0, angle, 0),
      castShadow: true,
      name: `${element.id}_crosshead_${idx}`,
    });

    // Twin Cylindrical Pier Columns
    const columnSpacing = width * 0.35;
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
 * Creates 3D extruded prism for buildings
 */
function createBuilding3D(element: BlueprintElement): ConvertedElement3D {
  const points = ensureCCW(element.points);
  const height = Math.max(element.height || 15, 2);
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

  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, points[i].y);
  }
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: height,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.2,
    bevelThickness: 0.2,
  };

  const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geom.rotateX(Math.PI / 2);

  let mat = DAYLIGHT_MATERIALS.buildingGlass;
  if (element.metadata?.color) {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(element.metadata.color),
      roughness: 0.2,
      metalness: 0.7,
      transparent: true,
      opacity: 0.9,
    });
  } else if (element.material_label === 'masonry' || element.material_label === 'precast_concrete') {
    mat = DAYLIGHT_MATERIALS.buildingMasonry;
  }

  meshes.push({
    geometry: geom,
    material: mat,
    position: new THREE.Vector3(0, elevation + height, 0),
    castShadow: true,
    receiveShadow: true,
    name: `${element.id}_volume`,
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
  flatGeom.rotateX(Math.PI / 2);

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

  for (const element of elements) {
    if (!element.points || element.points.length === 0) continue;

    let converted: ConvertedElement3D | null = null;
    switch (element.type) {
      case 'road':
        converted = createRoad3D(element);
        break;
      case 'bridge_deck':
        converted = createBridge3D(element);
        break;
      case 'building':
        converted = createBuilding3D(element);
        break;
      case 'boundary':
        converted = createBoundary3D(element);
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
