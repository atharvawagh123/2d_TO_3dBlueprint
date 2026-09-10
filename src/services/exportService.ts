import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

/**
 * Exports a Three.js scene or object hierarchy to a binary .glb file
 * and triggers client browser download.
 */
export async function exportToGLB(
  sceneOrObject: THREE.Object3D,
  filename = 'blueprint-3d-model.glb'
): Promise<void> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();

    exporter.parse(
      sceneOrObject,
      (result) => {
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename.endsWith('.glb') ? filename : `${filename}.glb`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve();
        } else {
          // JSON format fallback
          const output = JSON.stringify(result, null, 2);
          const blob = new Blob([output], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${filename}.gltf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve();
        }
      },
      (error) => {
        console.error('GLTF Export Failed:', error);
        reject(error);
      },
      {
        binary: true,
        onlyVisible: true,
        embedImages: true,
      }
    );
  });
}

/**
 * Captures high-resolution PNG screenshot from WebGL canvas
 */
export function captureCanvasScreenshot(
  canvas: HTMLCanvasElement,
  filename = 'blueprint-3d-render.png'
): void {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename.endsWith('.png') ? filename : `${filename}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Screenshot capture error:', err);
  }
}
