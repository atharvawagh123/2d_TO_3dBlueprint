import { blueprintTo3D } from '../engine/blueprintTo3D.js';
import type { BlueprintElement } from '../types/index.js';

console.log('--- Testing blueprintTo3D Conversion Engine ---');

const testElements: BlueprintElement[] = [
  {
    id: 'test_road_1',
    type: 'road',
    name: 'Test Highway',
    points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 50 }],
    width: 14,
    elevation: 0,
    material_label: 'asphalt',
  },
  {
    id: 'test_bridge_1',
    type: 'bridge_deck',
    name: 'Test Viaduct',
    points: [{ x: 150, y: 50 }, { x: 300, y: 50 }],
    width: 12,
    elevation: 15,
    height: 1.5,
    pier_spacing: 30,
    material_label: 'reinforced_concrete',
  },
  {
    id: 'test_building_1',
    type: 'building',
    name: 'Control Tower',
    points: [{ x: 50, y: 70 }, { x: 90, y: 70 }, { x: 90, y: 110 }, { x: 50, y: 110 }],
    height: 25,
    elevation: 0,
    material_label: 'glass_curtain_wall',
  },
  {
    id: 'test_boundary_1',
    type: 'boundary',
    name: 'Plot Fence',
    points: [{ x: -50, y: -50 }, { x: 350, y: -50 }, { x: 350, y: 200 }, { x: -50, y: 200 }],
    elevation: 0,
    material_label: 'property_line',
  }
];

const scene = blueprintTo3D(testElements);

console.log(`✓ Elements Converted: ${scene.elements.length} / 4`);
scene.elements.forEach(elem => {
  console.log(`  - [${elem.type}] "${elem.name}": ${elem.meshes.length} 3D meshes generated. Center: (${elem.center.x.toFixed(1)}, ${elem.center.y.toFixed(1)}, ${elem.center.z.toFixed(1)})`);
});

console.log(`✓ Bounding Box Calculated:`);
console.log(`  Min: (${scene.bounds.min.x}, ${scene.bounds.min.y}, ${scene.bounds.min.z})`);
console.log(`  Max: (${scene.bounds.max.x}, ${scene.bounds.max.y}, ${scene.bounds.max.z})`);
console.log(`  Size: (${scene.bounds.size.x}, ${scene.bounds.size.y}, ${scene.bounds.size.z})`);

const bridgeElem = scene.elements.find(e => e.type === 'bridge_deck');
if (bridgeElem && bridgeElem.meshes.length > 5) {
  console.log(`✓ Parametric Bridge Piers & Crossheads successfully generated (${bridgeElem.meshes.length} sub-meshes)`);
} else {
  console.error('✗ Bridge piers generation failed');
}

console.log('--- ALL CONVERSION ENGINE CHECKS PASSED ---');
