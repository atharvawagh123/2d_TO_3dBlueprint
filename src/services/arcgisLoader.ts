// ArcGIS JavaScript API Loader & Integration Service

export const ARCGIS_SLPK_BUILDINGS_URL = 
  'https://tiles.arcgis.com/tiles/CPLm4MuWYjfnA2R9/arcgis/rest/services/3D_BUILDINGS_SLPK/SceneServer/layers/0';

export const GLOBAL_3D_BUILDINGS_URL = 
  'https://basemaps3d.arcgis.com/arcgis/rest/services/OpenStreetMap3D_Buildings_v1/SceneServer';

export const WORLD_ELEVATION_URL = 
  'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer';

export const WELLINGTON_3D_SCENE_URL =
  'https://tiles.arcgis.com/tiles/CPYspmTk3abe6d7i/arcgis/rest/services/Wellington_Central_3D_Buildings/SceneServer/layers/0';

export const WELLINGTON_CENTER = {
  latitude: -41.2865,
  longitude: 174.7762,
};

export const EAST_POINT_BBOX = {
  south: 33.62712,
  west: -84.53365,
  north: 33.70583,
  east: -84.41530,
};

export const EAST_POINT_CENTER = {
  latitude: 33.6665,
  longitude: -84.4745,
};

export interface ArcGISModules {
  EsriMap: any;
  SceneView: any;
  MapView: any;
  SceneLayer: any;
  ElevationLayer: any;
  GraphicsLayer: any;
  Graphic: any;
  Point: any;
  PointSymbol3D: any;
  ObjectSymbol3DLayer: any;
  Extent: any;
  SpatialReference: any;
  Camera: any;
}

let cachedModules: ArcGISModules | null = null;
let loadingPromise: Promise<ArcGISModules> | null = null;

export function loadArcGISModules(): Promise<ArcGISModules> {
  if (cachedModules) {
    return Promise.resolve(cachedModules);
  }
  if (loadingPromise) {
    return loadingPromise;
  }

  loadingPromise = new Promise<ArcGISModules>((resolve, reject) => {
    const checkOrLoadRequire = () => {
      const win = window as any;
      if (typeof win.require === 'function') {
        win.require([
          'esri/Map',
          'esri/views/SceneView',
          'esri/views/MapView',
          'esri/layers/SceneLayer',
          'esri/layers/ElevationLayer',
          'esri/layers/GraphicsLayer',
          'esri/Graphic',
          'esri/geometry/Point',
          'esri/symbols/PointSymbol3D',
          'esri/symbols/ObjectSymbol3DLayer',
          'esri/geometry/Extent',
          'esri/geometry/SpatialReference',
          'esri/Camera'
        ], (
          EsriMap: any,
          SceneView: any,
          MapView: any,
          SceneLayer: any,
          ElevationLayer: any,
          GraphicsLayer: any,
          Graphic: any,
          Point: any,
          PointSymbol3D: any,
          ObjectSymbol3DLayer: any,
          Extent: any,
          SpatialReference: any,
          Camera: any
        ) => {
          cachedModules = {
            EsriMap,
            SceneView,
            MapView,
            SceneLayer,
            ElevationLayer,
            GraphicsLayer,
            Graphic,
            Point,
            PointSymbol3D,
            ObjectSymbol3DLayer,
            Extent,
            SpatialReference,
            Camera
          };
          resolve(cachedModules);
        }, (err: any) => {
          console.error('ArcGIS AMD require error:', err);
          reject(err);
        });
        return true;
      }
      return false;
    };

    if (checkOrLoadRequire()) return;

    // In case script tag is still streaming, wait for window.require
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      if (checkOrLoadRequire()) {
        clearInterval(interval);
      } else if (attempts > 50) {
        clearInterval(interval);
        // Attempt dynamic injection if somehow not loaded
        const script = document.createElement('script');
        script.src = 'https://js.arcgis.com/4.31/';
        script.onload = () => {
          if (!checkOrLoadRequire()) {
            reject(new Error('ArcGIS JS SDK loaded but require() not available.'));
          }
        };
        script.onerror = () => reject(new Error('Failed to load ArcGIS JS SDK from CDN'));
        document.head.appendChild(script);
      }
    }, 100);
  });

  return loadingPromise;
}
