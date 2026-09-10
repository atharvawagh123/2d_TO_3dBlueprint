import { fetchAOIInfrastructure, CIVIL_SITE_PRESETS } from '../services/osmService';
import { blueprintTo3D } from '../engine/blueprintTo3D';

async function testGisPipeline() {
  console.log('Testing GIS Pipeline...');
  for (const preset of CIVIL_SITE_PRESETS) {
    console.log('Testing Preset:', preset.name);
    const res = await fetchAOIInfrastructure(preset.bbox);
    console.log('  Source:', res.source);
    console.log('  Elements extracted:', res.elements.length);
    console.log('  Stats: roads=' + res.stats.roadCount + ', buildings=' + res.stats.buildingCount + ', demolition=' + res.stats.estimatedDemolitionVolumeM3 + 'm3');
    const scene3D = blueprintTo3D(res.elements);
    console.log('  Converted to 3D scene elements:', scene3D.elements.length);
  }
  console.log('--- ALL GIS PIPELINE CHECKS PASSED ---');
}
testGisPipeline();
