import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import type { BlueprintElement } from '../../types';
import { 
  CIVIL_SITE_PRESETS, 
  fetchAOIInfrastructure, 
  type CivilSitePreset, 
  type AOIFetchResult 
} from '../../services/osmService';
import { projectMetersToLatLon, type BoundingBoxGPS } from '../../engine/gisProjection';
import { 
  Globe, 
  MapPin, 
  Sparkles, 
  HardHat, 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw,
  Download,
  Crosshair,
  Search,
  Trash2,
  Move,
  X,
  Box, 
  Layers, 
  Compass, 
  Sun, 
  Maximize2,
  Building2,
  Mountain,
  MountainSnow,
  Car,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  ExternalLink,
  FolderPlus
} from 'lucide-react';
import {
  loadArcGISModules,
  ARCGIS_SLPK_BUILDINGS_URL,
  GLOBAL_3D_BUILDINGS_URL,
  WORLD_ELEVATION_URL,
  WELLINGTON_3D_SCENE_URL,
  WELLINGTON_CENTER,
  EAST_POINT_CENTER,
  type ArcGISModules
} from '../../services/arcgisLoader';

export interface SLPKLayerItem {
  id: string;
  title: string;
  url: string;
  visible: boolean;
  type: 'slpk' | 'sceneserver' | 'osm';
  center?: { lat: number; lon: number };
  layerRef?: any;
  isBuiltIn?: boolean;
}

const INITIAL_SLPK_LAYERS: SLPKLayerItem[] = [
  {
    id: 'east_point_slpk',
    title: 'East Point 3D Building Digital Twin (SLPK)',
    url: ARCGIS_SLPK_BUILDINGS_URL,
    visible: true,
    type: 'slpk',
    center: { lat: EAST_POINT_CENTER.latitude, lon: EAST_POINT_CENTER.longitude },
    isBuiltIn: true
  },
  {
    id: 'wellington_wcc_3d',
    title: 'Wellington Central 3D Digital Twin (WCC)',
    url: WELLINGTON_3D_SCENE_URL,
    visible: true,
    type: 'sceneserver',
    center: { lat: WELLINGTON_CENTER.latitude, lon: WELLINGTON_CENTER.longitude },
    isBuiltIn: true
  },
  {
    id: 'global_osm_3d',
    title: 'Worldwide 3D OSM Buildings',
    url: GLOBAL_3D_BUILDINGS_URL,
    visible: true,
    type: 'osm',
    isBuiltIn: true
  }
];

interface SiteMapAOIProps {
  onImportToBlueprint: (elements: BlueprintElement[], notes: string, bbox?: BoundingBoxGPS) => void;
  onCreateProjectFromAOI: (
    projectName: string, 
    location: string, 
    elements: BlueprintElement[], 
    notes: string,
    bbox?: BoundingBoxGPS
  ) => void;
}

type MapTileProvider = 'streets' | 'satellite';

interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: string[];
}

const QUICK_GLOBAL_HUBS = [
  { name: 'East Point (ArcGIS 3D SLPK)', lat: 33.6665, lon: -84.4745 },
  { name: 'Wellington 3D (WCC SceneServer)', lat: -41.2865, lon: 174.7762 },
  { name: 'Mont Blanc Alps (Real 3D Mountain Slopes)', lat: 45.8326, lon: 6.8652 },
  { name: 'Mount Fuji & Slopes (Japan 3D Terrain)', lat: 35.3606, lon: 138.7274 },
  { name: 'Manhattan, New York (3D Towers)', lat: 40.7580, lon: -73.9855 },
  { name: 'Dubai (Downtown 3D Towers)', lat: 25.1972, lon: 55.2744 },
  { name: 'Mumbai (Coastal Sea Link)', lat: 18.9438, lon: 72.8232 },
  { name: 'London (Docklands & City)', lat: 51.5050, lon: -0.0200 },
  { name: 'Nagpur (Zero Mile Hub)', lat: 21.1508, lon: 79.0867 },
  { name: 'New Delhi (Ring Road)', lat: 28.6139, lon: 77.2295 },
  { name: 'Bengaluru (Outer Ring Road)', lat: 12.9176, lon: 77.6234 },
  { name: 'Hyderabad (HITEC City)', lat: 17.4401, lon: 78.3489 },
];

export const SiteMapAOI: React.FC<SiteMapAOIProps> = ({ 
  onImportToBlueprint, 
  onCreateProjectFromAOI 
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const aoiRectRef = useRef<L.Rectangle | null>(null);
  const cornerHandlesRef = useRef<L.Marker[]>([]);
  const featuresLayerRef = useRef<L.LayerGroup | null>(null);
  const activeRequestIdRef = useRef<number>(0);

  // Active state - Default to Mumbai Vidhan Bhavan Square / Marine Drive
  const [selectedPreset, setSelectedPreset] = useState<CivilSitePreset | null>(CIVIL_SITE_PRESETS[0]);
  const [activeBbox, setActiveBbox] = useState<BoundingBoxGPS | null>(CIVIL_SITE_PRESETS[0].bbox);
  const [activeLocationName, setActiveLocationName] = useState<string>(CIVIL_SITE_PRESETS[0].name);
  const [tileMode, setTileMode] = useState<MapTileProvider>('streets');

  // Drawing mode state
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const drawStartLatLngRef = useRef<L.LatLng | null>(null);
  const tempDrawRectRef = useRef<L.Rectangle | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Data fetch state
  const [isLoading, setIsLoading] = useState(false);
  const [fetchResult, setFetchResult] = useState<AOIFetchResult | null>(null);

  // Construction Logistics Toggles
  const [includeTowerCrane, setIncludeTowerCrane] = useState(true);
  const [includeLaydownYard, setIncludeLaydownYard] = useState(true);

  // 2D vs 3D Dimension Mode ('2d' = Leaflet Vector/Satellite Map, '3d' = ArcGIS Digital Twin SceneView with SLPK)
  const [mapDimensionMode, setMapDimensionMode] = useState<'2d' | '3d'>('2d');
  const [isArcgisLoading, setIsArcgisLoading] = useState(false);
  const [cameraPitch, setCameraPitch] = useState(58);
  const [cameraHeading, setCameraHeading] = useState(320);
  const [show3DBuildings, setShow3DBuildings] = useState(true);
  const [show3DTerrain, setShow3DTerrain] = useState(true);
  const [sunTimePreset, setSunTimePreset] = useState<'noon' | 'morning' | 'golden'>('noon');

  // Sidebar visibility state (default to closed for clean, minimal full-screen map)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // 3D SLPK & Layer Manager state
  const [isSLPKManagerOpen, setIsSLPKManagerOpen] = useState(false);
  const [slpkLayers, setSlpkLayers] = useState<SLPKLayerItem[]>(INITIAL_SLPK_LAYERS);
  const [newLayerTitle, setNewLayerTitle] = useState('');
  const [newLayerUrl, setNewLayerUrl] = useState('');
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');

  // 3D Road Traffic Animation state
  const [isTrafficActive, setIsTrafficActive] = useState(false);

  const arcgisContainerRef = useRef<HTMLDivElement | null>(null);
  const arcgisViewRef = useRef<any>(null);
  const arcgisMapRef = useRef<any>(null);
  const arcgisModulesRef = useRef<ArcGISModules | null>(null);
  const globalBuildingsLayerRef = useRef<any>(null);
  const slpkBuildingsLayerRef = useRef<any>(null);
  const wellingtonLayerRef = useRef<any>(null);
  const elevationLayerRef = useRef<any>(null);
  const trafficGraphicsLayerRef = useRef<any>(null);
  const trafficAnimFrameRef = useRef<number | null>(null);
  const trafficCarsRef = useRef<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize or synchronize ArcGIS 3D SceneView
  useEffect(() => {
    if (mapDimensionMode !== '3d' || !arcgisContainerRef.current) return;

    let isCancelled = false;

    const initArcGIS = async () => {
      if (arcgisViewRef.current) {
        return;
      }

      setIsArcgisLoading(true);
      try {
        const modules: ArcGISModules = await loadArcGISModules();
        if (isCancelled || !arcgisContainerRef.current) return;

        arcgisModulesRef.current = modules;
        const { EsriMap, SceneView, SceneLayer, ElevationLayer, GraphicsLayer } = modules;

        // 1. World 3D Elevation Layer for Real-Earth Mountain Slopes, Elevation & Terrain Relief
        const elevationLayer = new ElevationLayer({
          url: WORLD_ELEVATION_URL,
          title: 'World 3D Terrain & Mountain Slopes'
        });
        elevationLayerRef.current = elevationLayer;

        // 2. Global 3D Buildings Layer (Covers all cities across the entire world)
        const globalBuildingsLayer = new SceneLayer({
          url: GLOBAL_3D_BUILDINGS_URL,
          title: 'Worldwide 3D Buildings',
          popupTemplate: {
            title: '3D Building {name}',
            content: `
              <div style="font-family: Inter, system-ui, sans-serif; font-size: 12px; line-height: 1.6; color: #1e293b; padding: 4px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                  <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 10px; font-weight: 600;">Approx Height:</span><br/>
                    <strong style="color: #0284c7; font-size: 14px;">{height} m</strong>
                  </div>
                  <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 10px; font-weight: 600;">Building Levels:</span><br/>
                    <strong style="color: #334155; font-size: 14px;">{building:levels}</strong>
                  </div>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 11px; color: #64748b;">
                  <div><strong>Type:</strong> {building}</div>
                  <div><strong>Roof Shape:</strong> {roof:shape}</div>
                </div>
              </div>
            `
          }
        });
        globalBuildingsLayerRef.current = globalBuildingsLayer;

        // 3. Dense East Point SLPK Buildings Layer
        const slpkLayer = new SceneLayer({
          url: ARCGIS_SLPK_BUILDINGS_URL,
          title: '3D Buildings (East Point SLPK)',
          popupTemplate: {
            title: '3D Building {OBJECTID}',
            content: `
              <div style="font-family: Inter, system-ui, sans-serif; font-size: 12px; line-height: 1.6; color: #1e293b; padding: 4px;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;">
                  <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 10px; font-weight: 600;">Stories / Floors:</span><br/>
                    <strong style="color: #0284c7; font-size: 15px;">{Stories}</strong>
                  </div>
                  <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 10px; font-weight: 600;">Year Built:</span><br/>
                    <strong style="color: #334155; font-size: 14px;">{YearBuilt}</strong>
                  </div>
                  <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 10px; font-weight: 600;">Gross Footprint:</span><br/>
                    <strong style="color: #334155; font-size: 13px;">{AreaSqFt} sq ft</strong>
                  </div>
                  <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 10px; font-weight: 600;">Roof Elevation:</span><br/>
                    <strong style="color: #059669; font-size: 13px;">{RoofElev} m</strong>
                  </div>
                </div>
                <div style="border-top: 1px solid #e2e8f0; padding-top: 6px; font-size: 11px; color: #64748b;">
                  <div><strong>Feature Type:</strong> {FeatType}</div>
                  <div><strong>Structure ID:</strong> {STRUCT_ID}</div>
                  <div><strong>Land Use:</strong> {LUCDesc}</div>
                </div>
              </div>
            `
          }
        });
        slpkBuildingsLayerRef.current = slpkLayer;

        // 4. Wellington Central 3D Digital Twin (WCC SceneServer)
        const wellingtonLayer = new SceneLayer({
          url: WELLINGTON_3D_SCENE_URL,
          title: 'Wellington Central 3D Buildings (WCC)',
          popupTemplate: {
            title: 'Wellington 3D {Name}',
            content: `
              <div style="font-family: Inter, system-ui, sans-serif; font-size: 12px; line-height: 1.6; color: #1e293b; padding: 4px;">
                <div style="background: #f8fafc; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 6px;">
                  <span style="color: #64748b; font-size: 10px; font-weight: 600;">Building Asset:</span><br/>
                  <strong style="color: #0284c7; font-size: 14px;">{Name}</strong>
                </div>
                <div style="font-size: 11px; color: #64748b;">
                  <div><strong>Suburb:</strong> {Suburb}</div>
                  <div><strong>Source:</strong> Wellington City Council 3D WebScene</div>
                </div>
              </div>
            `
          }
        });
        wellingtonLayerRef.current = wellingtonLayer;

        // 5. 3D Live Traffic Graphics Layer
        const trafficGraphicsLayer = new GraphicsLayer({
          title: '3D Road Traffic Live',
          elevationInfo: { mode: 'on-the-ground' }
        });
        trafficGraphicsLayerRef.current = trafficGraphicsLayer;

        const map = new EsriMap({
          basemap: 'osm',
          ground: {
            layers: [elevationLayer]
          },
          layers: [globalBuildingsLayer, slpkLayer, wellingtonLayer, trafficGraphicsLayer]
        });
        arcgisMapRef.current = map;

        // Attach live layer references to slpkLayers state
        setSlpkLayers(prev => prev.map(l => {
          if (l.id === 'east_point_slpk') return { ...l, layerRef: slpkLayer };
          if (l.id === 'wellington_wcc_3d') return { ...l, layerRef: wellingtonLayer };
          if (l.id === 'global_osm_3d') return { ...l, layerRef: globalBuildingsLayer };
          return l;
        }));

        // Determine starting center
        const targetLat = activeBbox ? (activeBbox.south + activeBbox.north) / 2 : EAST_POINT_CENTER.latitude;
        const targetLon = activeBbox ? (activeBbox.west + activeBbox.east) / 2 : EAST_POINT_CENTER.longitude;

        const view = new SceneView({
          container: arcgisContainerRef.current,
          map: map,
          camera: {
            position: {
              latitude: targetLat - 0.007,
              longitude: targetLon,
              z: 850
            },
            tilt: 58,
            heading: 320
          },
          environment: {
            lighting: {
              directShadowsEnabled: true,
              ambientOcclusionEnabled: true,
              date: new Date('2026-06-21T13:00:00Z')
            },
            atmosphere: {
              quality: 'high'
            }
          },
          qualityProfile: 'high',
          popup: {
            dockEnabled: false,
            dockOptions: {
              buttonEnabled: false,
              breakpoint: false
            }
          }
        });

        arcgisViewRef.current = view;

        view.when(() => {
          setIsArcgisLoading(false);
          if (selectedPreset?.id === 'east_point_slpk') {
            slpkLayer.load().then(() => {
              if (slpkLayer.fullExtent) {
                view.goTo(slpkLayer.fullExtent);
              }
            }).catch(() => {});
          } else if (selectedPreset?.id === 'wellington_3d') {
            wellingtonLayer.load().then(() => {
              if (wellingtonLayer.fullExtent) {
                view.goTo(wellingtonLayer.fullExtent);
              }
            }).catch(() => {});
          }
        }).catch((err: any) => {
          console.error('SceneView initialization error:', err);
          setIsArcgisLoading(false);
        });

      } catch (err) {
        console.error('Failed to load ArcGIS 3D view:', err);
        setIsArcgisLoading(false);
      }
    };

    initArcGIS();

    return () => {
      isCancelled = true;
    };
  }, [mapDimensionMode, activeBbox]);

  // 3D Animated Traffic Engine
  useEffect(() => {
    if (mapDimensionMode !== '3d' || !isTrafficActive || !arcgisModulesRef.current || !trafficGraphicsLayerRef.current) {
      if (trafficAnimFrameRef.current) {
        cancelAnimationFrame(trafficAnimFrameRef.current);
        trafficAnimFrameRef.current = null;
      }
      if (trafficGraphicsLayerRef.current) {
        trafficGraphicsLayerRef.current.removeAll();
      }
      trafficCarsRef.current = [];
      return;
    }

    const { Graphic, Point, PointSymbol3D, ObjectSymbol3DLayer } = arcgisModulesRef.current;
    const layer = trafficGraphicsLayerRef.current;
    layer.removeAll();

    // Determine center of current region
    const centerLat = activeBbox ? (activeBbox.south + activeBbox.north) / 2 : (arcgisViewRef.current?.center?.latitude || 33.6665);
    const centerLon = activeBbox ? (activeBbox.west + activeBbox.east) / 2 : (arcgisViewRef.current?.center?.longitude || -84.4745);

    // Generate road corridors around the active scene
    const roadCorridors: { p1: [number, number]; p2: [number, number]; heading: number }[] = [];
    const roadElements = fetchResult?.elements?.filter(e => e.type === 'road') || [];

    if (roadElements.length > 2 && activeBbox) {
      roadElements.forEach(road => {
        if (road.points && road.points.length >= 2) {
          for (let i = 0; i < road.points.length - 1; i++) {
            const pt1 = projectMetersToLatLon(road.points[i], { lat: (activeBbox.south + activeBbox.north) / 2, lon: (activeBbox.west + activeBbox.east) / 2 });
            const pt2 = projectMetersToLatLon(road.points[i + 1], { lat: (activeBbox.south + activeBbox.north) / 2, lon: (activeBbox.west + activeBbox.east) / 2 });
            const dLon = pt2.lon - pt1.lon;
            const dLat = pt2.lat - pt1.lat;
            const heading = (Math.atan2(dLon, dLat) * 180) / Math.PI;
            roadCorridors.push({ p1: [pt1.lon, pt1.lat], p2: [pt2.lon, pt2.lat], heading });
          }
        }
      });
    }

    // Fallback or augment with realistic arterial road grid
    if (roadCorridors.length < 8) {
      const span = 0.006;
      const offsets = [-0.0035, -0.0018, 0, 0.0018, 0.0035];
      offsets.forEach(dy => {
        roadCorridors.push({
          p1: [centerLon - span, centerLat + dy],
          p2: [centerLon + span, centerLat + dy],
          heading: 90
        });
        roadCorridors.push({
          p1: [centerLon + span, centerLat + dy + 0.00004],
          p2: [centerLon - span, centerLat + dy + 0.00004],
          heading: 270
        });
      });
      offsets.forEach(dx => {
        roadCorridors.push({
          p1: [centerLon + dx, centerLat - span],
          p2: [centerLon + dx, centerLat + span],
          heading: 0
        });
        roadCorridors.push({
          p1: [centerLon + dx + 0.00004, centerLat + span],
          p2: [centerLon + dx + 0.00004, centerLat - span],
          heading: 180
        });
      });
    }

    // Spawn fleet of stylized white low-poly 3D cars (matching image 2)
    const carFleet: any[] = [];
    const numCars = Math.min(32, roadCorridors.length * 3);

    for (let i = 0; i < numCars; i++) {
      const corridor = roadCorridors[i % roadCorridors.length];
      const initialT = (i * 0.07 + Math.random() * 0.1) % 1;
      const speed = 0.0006 + Math.random() * 0.0007;

      const curLon = corridor.p1[0] + (corridor.p2[0] - corridor.p1[0]) * initialT;
      const curLat = corridor.p1[1] + (corridor.p2[1] - corridor.p1[1]) * initialT;

      const carSymbol = new PointSymbol3D({
        symbolLayers: [
          new ObjectSymbol3DLayer({
            width: 2.1,
            height: 1.45,
            depth: 4.4,
            resource: { primitive: 'cube' },
            material: { color: [252, 252, 255] }, // Stylized clean white car matching image 2
            heading: corridor.heading
          })
        ]
      });

      const graphic = new Graphic({
        geometry: new Point({
          longitude: curLon,
          latitude: curLat,
          spatialReference: { wkid: 4326 }
        }),
        symbol: carSymbol
      });

      layer.add(graphic);

      carFleet.push({
        graphic,
        corridor,
        t: initialT,
        speed
      });
    }

    trafficCarsRef.current = carFleet;

    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = Math.min((time - lastTime) / 16.66, 2.0);
      lastTime = time;

      carFleet.forEach(car => {
        car.t += car.speed * dt;
        if (car.t >= 1) {
          car.t = 0;
        }

        const lon = car.corridor.p1[0] + (car.corridor.p2[0] - car.corridor.p1[0]) * car.t;
        const lat = car.corridor.p1[1] + (car.corridor.p2[1] - car.corridor.p1[1]) * car.t;

        car.graphic.geometry = new Point({
          longitude: lon,
          latitude: lat,
          spatialReference: { wkid: 4326 }
        });
      });

      trafficAnimFrameRef.current = requestAnimationFrame(animate);
    };

    trafficAnimFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (trafficAnimFrameRef.current) {
        cancelAnimationFrame(trafficAnimFrameRef.current);
        trafficAnimFrameRef.current = null;
      }
      if (trafficGraphicsLayerRef.current) {
        trafficGraphicsLayerRef.current.removeAll();
      }
    };
  }, [mapDimensionMode, isTrafficActive, activeBbox, fetchResult]);

  // Cleanup ArcGIS on unmount
  useEffect(() => {
    return () => {
      if (arcgisViewRef.current) {
        arcgisViewRef.current.destroy();
        arcgisViewRef.current = null;
      }
    };
  }, []);

  // Switch between 2D Map and 3D SceneView with viewpoint synchronization
  const handleSwitchDimension = (mode: '2d' | '3d') => {
    if (mode === mapDimensionMode) return;

    if (mode === '3d') {
      setMapDimensionMode('3d');
      setTimeout(() => {
        if (arcgisViewRef.current) {
          const map = mapInstanceRef.current;
          let targetLat = EAST_POINT_CENTER.latitude;
          let targetLon = EAST_POINT_CENTER.longitude;
          if (activeBbox) {
            targetLat = (activeBbox.south + activeBbox.north) / 2;
            targetLon = (activeBbox.west + activeBbox.east) / 2;
          } else if (map) {
            const center = map.getCenter();
            targetLat = center.lat;
            targetLon = center.lng;
          }
          arcgisViewRef.current.goTo({
            center: [targetLon, targetLat],
            tilt: 58,
            heading: 320
          }, { duration: 1000 });
        }
      }, 100);
    } else {
      setMapDimensionMode('2d');
      setTimeout(() => {
        const map = mapInstanceRef.current;
        if (map) {
          if (arcgisViewRef.current?.center) {
            const c = arcgisViewRef.current.center;
            map.setView([c.latitude, c.longitude], 17);
          }
          map.invalidateSize();
        }
      }, 100);
    }
  };

  // 3D Layer Visibility Toggles
  const toggle3DBuildings = () => {
    setShow3DBuildings((prev) => {
      const next = !prev;
      slpkLayers.forEach(l => {
        if (l.layerRef) l.layerRef.visible = next;
      });
      return next;
    });
  };

  const toggle3DTerrain = () => {
    setShow3DTerrain((prev) => {
      const next = !prev;
      if (elevationLayerRef.current) {
        elevationLayerRef.current.visible = next;
      }
      if (arcgisMapRef.current?.ground) {
        arcgisMapRef.current.ground.layers = next && elevationLayerRef.current ? [elevationLayerRef.current] : [];
      }
      return next;
    });
  };

  const toggleTrafficActive = () => {
    setIsTrafficActive(prev => !prev);
  };

  // SLPK Layer Manager Methods
  const toggleLayerVisibility = (id: string) => {
    setSlpkLayers(prev => prev.map(l => {
      if (l.id === id) {
        const nextVis = !l.visible;
        if (l.layerRef) {
          l.layerRef.visible = nextVis;
        }
        return { ...l, visible: nextVis };
      }
      return l;
    }));
  };

  const flyToSLPKItem = (item: SLPKLayerItem) => {
    if (!arcgisViewRef.current) return;
    if (item.layerRef?.fullExtent) {
      arcgisViewRef.current.goTo(item.layerRef.fullExtent, { duration: 1400 });
    } else if (item.center) {
      arcgisViewRef.current.goTo({
        center: [item.center.lon, item.center.lat],
        tilt: 58,
        heading: 320,
        zoom: 16
      }, { duration: 1400 });
    }
  };

  const handleStartEditLayer = (l: SLPKLayerItem) => {
    setEditingLayerId(l.id);
    setEditTitle(l.title);
    setEditUrl(l.url);
  };

  const handleSaveEditLayer = (id: string) => {
    if (!editTitle.trim()) return;
    setSlpkLayers(prev => prev.map(l => {
      if (l.id === id) {
        const urlChanged = editUrl.trim() !== l.url;
        let newRef = l.layerRef;
        if (urlChanged && arcgisModulesRef.current && arcgisMapRef.current) {
          if (l.layerRef) {
            arcgisMapRef.current.layers.remove(l.layerRef);
          }
          try {
            newRef = new arcgisModulesRef.current.SceneLayer({
              url: editUrl.trim(),
              title: editTitle.trim()
            });
            arcgisMapRef.current.layers.add(newRef);
          } catch (err) {
            console.error('Failed to create updated SceneLayer:', err);
          }
        } else if (l.layerRef) {
          l.layerRef.title = editTitle.trim();
        }
        return { ...l, title: editTitle.trim(), url: editUrl.trim(), layerRef: newRef };
      }
      return l;
    }));
    setEditingLayerId(null);
  };

  const handleDeleteLayer = (id: string) => {
    const item = slpkLayers.find(l => l.id === id);
    if (item?.layerRef && arcgisMapRef.current) {
      arcgisMapRef.current.layers.remove(item.layerRef);
    }
    setSlpkLayers(prev => prev.filter(l => l.id !== id));
  };

  const handleAddNewSLPKLayer = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newLayerTitle.trim() || !newLayerUrl.trim()) return;
    
    let newSceneLayer: any = null;
    if (arcgisModulesRef.current && arcgisMapRef.current) {
      try {
        newSceneLayer = new arcgisModulesRef.current.SceneLayer({
          url: newLayerUrl.trim(),
          title: newLayerTitle.trim()
        });
        arcgisMapRef.current.layers.add(newSceneLayer);
        newSceneLayer.load().then(() => {
          if (newSceneLayer.fullExtent && arcgisViewRef.current) {
            arcgisViewRef.current.goTo(newSceneLayer.fullExtent);
          }
        }).catch(() => {});
      } catch (err) {
        console.error('Failed to add custom SceneLayer:', err);
      }
    }

    const newLayerItem: SLPKLayerItem = {
      id: `custom_slpk_${Date.now()}`,
      title: newLayerTitle.trim(),
      url: newLayerUrl.trim(),
      visible: true,
      type: 'slpk',
      layerRef: newSceneLayer,
      isBuiltIn: false
    };

    setSlpkLayers(prev => [newLayerItem, ...prev]);
    setNewLayerTitle('');
    setNewLayerUrl('');
  };

  const handleUploadLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const layerName = file.name.replace(/\.[^/.]+$/, '');
    setNewLayerTitle(`Local: ${layerName}`);
    const fileUrl = URL.createObjectURL(file);
    setNewLayerUrl(fileUrl);
  };

  const cycleSunLighting = () => {
    if (!arcgisViewRef.current?.environment?.lighting) return;
    const presets: { id: 'noon' | 'morning' | 'golden'; date: Date; name: string }[] = [
      { id: 'noon', date: new Date('2026-06-21T13:00:00Z'), name: 'High Noon ☀️' },
      { id: 'golden', date: new Date('2026-06-21T18:15:00Z'), name: 'Golden Sunset 🌅' },
      { id: 'morning', date: new Date('2026-06-21T07:45:00Z'), name: 'Morning Sunrise 🌄' }
    ];
    const currentIndex = presets.findIndex(p => p.id === sunTimePreset);
    const nextPreset = presets[(currentIndex + 1) % presets.length];
    setSunTimePreset(nextPreset.id);
    arcgisViewRef.current.environment.lighting.date = nextPreset.date;
    arcgisViewRef.current.environment.lighting.directShadowsEnabled = true;
  };

  // 3D Camera Helpers
  const flyToSLPKLayer = () => {
    if (!arcgisViewRef.current) return;
    if (slpkBuildingsLayerRef.current?.fullExtent) {
      arcgisViewRef.current.goTo(slpkBuildingsLayerRef.current.fullExtent, { duration: 1200 });
    } else {
      arcgisViewRef.current.goTo({
        center: [EAST_POINT_CENTER.longitude, EAST_POINT_CENTER.latitude],
        tilt: 58,
        heading: 320,
        zoom: 16
      }, { duration: 1200 });
    }
  };

  const flyToWellington = () => {
    if (!arcgisViewRef.current) return;
    if (wellingtonLayerRef.current?.fullExtent) {
      arcgisViewRef.current.goTo(wellingtonLayerRef.current.fullExtent, { duration: 1500 });
    } else {
      arcgisViewRef.current.goTo({
        center: [WELLINGTON_CENTER.longitude, WELLINGTON_CENTER.latitude],
        tilt: 58,
        heading: 30,
        zoom: 16
      }, { duration: 1500 });
    }
  };

  const flyToMountainSlope = () => {
    if (!arcgisViewRef.current) return;
    // Mont Blanc & Alps summit with 65° tilt facing the steep slopes and peaks
    arcgisViewRef.current.goTo({
      position: {
        latitude: 45.8100,
        longitude: 6.8400,
        z: 3400
      },
      tilt: 65,
      heading: 40
    }, { duration: 1500 });
  };

  const setCameraAngle = (tilt: number, heading?: number) => {
    if (!arcgisViewRef.current) return;
    setCameraPitch(tilt);
    const targetHeading = heading !== undefined ? heading : arcgisViewRef.current.camera.heading;
    if (heading !== undefined) setCameraHeading(heading);
    arcgisViewRef.current.goTo({
      tilt,
      heading: targetHeading
    }, { duration: 800 });
  };

  const rotateCamera3D = () => {
    if (!arcgisViewRef.current) return;
    const currentHeading = arcgisViewRef.current.camera.heading || 0;
    const nextHeading = (currentHeading + 45) % 360;
    setCameraHeading(nextHeading);
    arcgisViewRef.current.goTo({
      heading: nextHeading
    }, { duration: 700 });
  };


  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenterLat = (CIVIL_SITE_PRESETS[0].bbox.south + CIVIL_SITE_PRESETS[0].bbox.north) / 2;
    const initialCenterLon = (CIVIL_SITE_PRESETS[0].bbox.west + CIVIL_SITE_PRESETS[0].bbox.east) / 2;

    const map = L.map(mapContainerRef.current, {
      center: [initialCenterLat, initialCenterLon],
      zoom: 17,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer (OpenStreetMap standard street tiles)
    const initialTiles = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }
    ).addTo(map);

    tileLayerRef.current = initialTiles;

    // Feature group for detected vectors (non-interactive so they never block clicks)
    const featureGroup = L.layerGroup().addTo(map);
    featuresLayerRef.current = featureGroup;

    mapInstanceRef.current = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Tile Layer Swapper (Street Vector vs Satellite)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !tileLayerRef.current) return;

    map.removeLayer(tileLayerRef.current);

    if (tileMode === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri World Imagery',
          maxZoom: 19,
        }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }
      ).addTo(map);
    }
  }, [tileMode]);

  // 3. Fetch Infrastructure Data for Active Bounding Box (with stale response cancellation)
  const loadDataForBbox = useCallback(async (bbox: BoundingBoxGPS) => {
    const reqId = ++activeRequestIdRef.current;
    setIsLoading(true);
    setFetchResult(null); // Instantly discard previous response data so it never attaches
    featuresLayerRef.current?.clearLayers(); // Instantly clear old vector overlays from map
    try {
      const res = await fetchAOIInfrastructure(bbox);
      // Only commit if this is still the active, latest request
      if (reqId === activeRequestIdRef.current) {
        setFetchResult(res);
      }
    } catch (err) {
      if (reqId === activeRequestIdRef.current) {
        console.error('Failed to fetch infrastructure:', err);
      }
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (activeBbox) {
      loadDataForBbox(activeBbox);
    } else {
      activeRequestIdRef.current++;
      setFetchResult(null);
      featuresLayerRef.current?.clearLayers();
    }
  }, [activeBbox, loadDataForBbox]);

  // 4. Update AOI Rectangle, Draggable Resize Handles, and Vector Overlays
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean previous AOI rectangle and corner handles
    if (aoiRectRef.current) {
      map.removeLayer(aoiRectRef.current);
      aoiRectRef.current = null;
    }
    cornerHandlesRef.current.forEach((h) => map.removeLayer(h));
    cornerHandlesRef.current = [];

    const fg = featuresLayerRef.current;
    if (fg) fg.clearLayers();

    if (!activeBbox) return;

    const bounds: L.LatLngBoundsExpression = [
      [activeBbox.south, activeBbox.west],
      [activeBbox.north, activeBbox.east],
    ];

    // Draw prominent AOI bounding box (interactive: false so clicks pass through)
    const rect = L.rectangle(bounds, {
      color: '#0284c7',
      weight: 2.5,
      dashArray: '8, 6',
      fillColor: '#38bdf8',
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(map);

    aoiRectRef.current = rect;

    // Create 4 interactive Draggable Corner Handles to EDIT and RESIZE the AOI
    const cornerPositions: { id: string; lat: number; lng: number }[] = [
      { id: 'nw', lat: activeBbox.north, lng: activeBbox.west },
      { id: 'ne', lat: activeBbox.north, lng: activeBbox.east },
      { id: 'sw', lat: activeBbox.south, lng: activeBbox.west },
      { id: 'se', lat: activeBbox.south, lng: activeBbox.east },
    ];

    const handles: L.Marker[] = [];

    cornerPositions.forEach((corner) => {
      // Sleek pulsing circular corner handle
      const icon = L.divIcon({
        className: 'custom-aoi-handle',
        html: `
          <div style="
            width: 14px;
            height: 14px;
            background: #ffffff;
            border: 2.5px solid #0284c7;
            border-radius: 50%;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            cursor: move;
            transform: translate(-50%, -50%);
          "></div>
        `,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      const marker = L.marker([corner.lat, corner.lng], {
        draggable: true,
        icon,
      }).addTo(map);

      // Handle corner drag to dynamically resize AOI
      marker.on('drag', () => {
        const markerLatLng = marker.getLatLng();
        let newN = activeBbox.north;
        let newS = activeBbox.south;
        let newW = activeBbox.west;
        let newE = activeBbox.east;

        if (corner.id === 'nw') {
          newN = markerLatLng.lat;
          newW = markerLatLng.lng;
        } else if (corner.id === 'ne') {
          newN = markerLatLng.lat;
          newE = markerLatLng.lng;
        } else if (corner.id === 'sw') {
          newS = markerLatLng.lat;
          newW = markerLatLng.lng;
        } else if (corner.id === 'se') {
          newS = markerLatLng.lat;
          newE = markerLatLng.lng;
        }

        const updatedBounds = L.latLngBounds([
          [Math.min(newS, newN), Math.min(newW, newE)],
          [Math.max(newS, newN), Math.max(newW, newE)],
        ]);

        if (aoiRectRef.current) {
          aoiRectRef.current.setBounds(updatedBounds);
        }
      });

      // On dragend, commit new bounding box and fetch updated infrastructure!
      marker.on('dragend', () => {
        const markerLatLng = marker.getLatLng();
        let newN = activeBbox.north;
        let newS = activeBbox.south;
        let newW = activeBbox.west;
        let newE = activeBbox.east;

        if (corner.id === 'nw') {
          newN = markerLatLng.lat;
          newW = markerLatLng.lng;
        } else if (corner.id === 'ne') {
          newN = markerLatLng.lat;
          newE = markerLatLng.lng;
        } else if (corner.id === 'sw') {
          newS = markerLatLng.lat;
          newW = markerLatLng.lng;
        } else if (corner.id === 'se') {
          newS = markerLatLng.lat;
          newE = markerLatLng.lng;
        }

        const finalBbox: BoundingBoxGPS = {
          south: Math.min(newS, newN),
          north: Math.max(newS, newN),
          west: Math.min(newW, newE),
          east: Math.max(newW, newE),
        };

        activeRequestIdRef.current++;
        setFetchResult(null);
        featuresLayerRef.current?.clearLayers();
        setActiveBbox(finalBbox);
        setActiveLocationName(`Edited AOI (${((finalBbox.south + finalBbox.north) / 2).toFixed(4)}, ${((finalBbox.west + finalBbox.east) / 2).toFixed(4)})`);
      });

      handles.push(marker);
    });

    cornerHandlesRef.current = handles;

    // Render Detected Vectors & Logistics Overlays (all non-interactive)
    if (fg && fetchResult && fetchResult.elements.length > 0) {
      const centerLat = (activeBbox.south + activeBbox.north) / 2;
      const centerLon = (activeBbox.west + activeBbox.east) / 2;
      const origin = { lat: centerLat, lon: centerLon };

      fetchResult.elements.forEach((elem) => {
        // Roads
        if (elem.type === 'road' || elem.type === 'bridge_deck') {
          const latLngs = elem.points.map((p) => {
            const ll = projectMetersToLatLon(p, origin);
            return [ll.lat, ll.lon] as [number, number];
          });

          if (latLngs.length >= 2) {
            L.polyline(latLngs, {
              color: elem.type === 'bridge_deck' ? '#0284c7' : '#f59e0b',
              weight: Math.max((elem.width || 10) * 0.45, 4),
              opacity: 0.85,
              interactive: false,
            }).addTo(fg);
          }
        }

        // Buildings
        if (elem.type === 'building' && elem.points.length >= 3) {
          const latLngs = elem.points.map((p) => {
            const ll = projectMetersToLatLon(p, origin);
            return [ll.lat, ll.lon] as [number, number];
          });

          L.polygon(latLngs, {
            color: elem.metadata?.color || '#0284c7',
            weight: 1.5,
            fillColor: elem.metadata?.color || '#38bdf8',
            fillOpacity: 0.35,
            interactive: false,
          }).addTo(fg);
        }

        // Ground Parcels (Parks, Water, Parking, Plazas)
        if (elem.type === 'ground' && elem.points.length >= 3) {
          const latLngs = elem.points.map((p) => {
            const ll = projectMetersToLatLon(p, origin);
            return [ll.lat, ll.lon] as [number, number];
          });

          const gType = elem.metadata?.groundType;
          let color = '#16a34a';
          let fillColor = '#4ade80';
          if (gType === 'water') {
            color = '#0284c7';
            fillColor = '#38bdf8';
          } else if (gType === 'parking' || gType === 'plaza') {
            color = '#475569';
            fillColor = '#94a3b8';
          }

          L.polygon(latLngs, {
            color,
            weight: 1.2,
            fillColor,
            fillOpacity: 0.28,
            interactive: false,
          }).addTo(fg);
        }
      });

      // Tower Crane Overlay (55m radius)
      if (includeTowerCrane) {
        const cranePos = projectMetersToLatLon({ x: -25, y: -15 }, origin);
        L.circle([cranePos.lat, cranePos.lon], {
          radius: 55,
          color: '#d97706',
          weight: 1.5,
          dashArray: '6, 4',
          fillColor: '#f59e0b',
          fillOpacity: 0.15,
          interactive: false,
        }).addTo(fg);

        L.circleMarker([cranePos.lat, cranePos.lon], {
          radius: 4,
          color: '#b45309',
          fillColor: '#d97706',
          fillOpacity: 1,
          interactive: false,
        }).addTo(fg);
      }

      // Material Laydown Yard Overlay
      if (includeLaydownYard) {
        const yardPts = [
          { x: 25, y: 25 },
          { x: 80, y: 25 },
          { x: 80, y: 65 },
          { x: 25, y: 65 },
        ].map((p) => {
          const ll = projectMetersToLatLon(p, origin);
          return [ll.lat, ll.lon] as [number, number];
        });

        L.polygon(yardPts, {
          color: '#059669',
          weight: 1.5,
          fillColor: '#10b981',
          fillOpacity: 0.25,
          interactive: false,
        }).addTo(fg);
      }
    }
  }, [activeBbox, fetchResult, includeTowerCrane, includeLaydownYard]);

  // 5. Preset selection
  const handleSelectPreset = (preset: CivilSitePreset) => {
    activeRequestIdRef.current++;
    setFetchResult(null);
    featuresLayerRef.current?.clearLayers();
    setSelectedPreset(preset);
    setActiveBbox(preset.bbox);
    setActiveLocationName(preset.name);

    const centerLat = (preset.bbox.south + preset.bbox.north) / 2;
    const centerLon = (preset.bbox.west + preset.bbox.east) / 2;

    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([centerLat, centerLon], 16, { duration: 1.2 });
    }

    if (arcgisViewRef.current) {
      arcgisViewRef.current.goTo({
        center: [centerLon, centerLat],
        tilt: 58,
        heading: 320,
        zoom: 16
      }, { duration: 1400 });
    }
  };

  // 6. Global Quick Hub Jump
  const handleJumpToHub = (hub: typeof QUICK_GLOBAL_HUBS[0]) => {
    activeRequestIdRef.current++;
    setFetchResult(null);
    featuresLayerRef.current?.clearLayers();
    const halfSpan = 0.0025;
    const newBbox: BoundingBoxGPS = {
      south: hub.lat - halfSpan,
      north: hub.lat + halfSpan,
      west: hub.lon - halfSpan * 1.3,
      east: hub.lon + halfSpan * 1.3,
    };
    setSelectedPreset(null);
    setActiveLocationName(hub.name);
    setActiveBbox(newBbox);

    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([hub.lat, hub.lon], 16, { duration: 1.2 });
    }

    if (arcgisViewRef.current) {
      arcgisViewRef.current.goTo({
        center: [hub.lon, hub.lat],
        tilt: 58,
        heading: 320,
        zoom: 16
      }, { duration: 1400 });
    }
  };

  // 7. Location Search via OpenStreetMap Nominatim API
  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
      );
      if (res.ok) {
        const data: SearchResult[] = await res.json();
        setSearchResults(data);
        setShowSearchDropdown(true);
      }
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: SearchResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);

    let newBbox: BoundingBoxGPS;
    if (result.boundingbox && result.boundingbox.length === 4) {
      const south = parseFloat(result.boundingbox[0]);
      const north = parseFloat(result.boundingbox[1]);
      const west = parseFloat(result.boundingbox[2]);
      const east = parseFloat(result.boundingbox[3]);

      // If bounding box is huge (e.g. whole country/state), clamp to ~700m radius
      const latSpan = Math.abs(north - south);
      if (latSpan > 0.01) {
        newBbox = {
          south: lat - 0.003,
          north: lat + 0.003,
          west: lon - 0.004,
          east: lon + 0.004,
        };
      } else {
        newBbox = { south, north, west, east };
      }
    } else {
      newBbox = {
        south: lat - 0.003,
        north: lat + 0.003,
        west: lon - 0.004,
        east: lon + 0.004,
      };
    }

    activeRequestIdRef.current++;
    setFetchResult(null);
    featuresLayerRef.current?.clearLayers();
    setSelectedPreset(null);
    const placeName = result.display_name.split(',')[0];
    setActiveLocationName(placeName);
    setActiveBbox(newBbox);
    setShowSearchDropdown(false);
    setSearchQuery('');

    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([lat, lon], 16, { duration: 1.2 });
    }

    if (arcgisViewRef.current) {
      arcgisViewRef.current.goTo({
        center: [lon, lat],
        tilt: 58,
        heading: 320,
        zoom: 16
      }, { duration: 1400 });
    }
  };

  // 8. Delete / Clear Drawn AOI
  const handleClearAOI = () => {
    activeRequestIdRef.current++;
    setActiveBbox(null);
    setFetchResult(null);
    setSelectedPreset(null);
    setActiveLocationName('No Active AOI (Draw or Select Site)');

    if (aoiRectRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(aoiRectRef.current);
      aoiRectRef.current = null;
    }
    cornerHandlesRef.current.forEach((h) => mapInstanceRef.current?.removeLayer(h));
    cornerHandlesRef.current = [];
    featuresLayerRef.current?.clearLayers();
  };

  // 9. Interactive Custom AOI Box Drawing Tool
  const toggleDrawingMode = () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (!isDrawingMode) {
      setIsDrawingMode(true);
      map.dragging.disable();
      map.getContainer().style.cursor = 'crosshair';

      const handleMouseDown = (e: L.LeafletMouseEvent) => {
        drawStartLatLngRef.current = e.latlng;

        if (tempDrawRectRef.current) {
          map.removeLayer(tempDrawRectRef.current);
          tempDrawRectRef.current = null;
        }

        const handleMouseMove = (moveEvent: L.LeafletMouseEvent) => {
          if (!drawStartLatLngRef.current) return;
          const start = drawStartLatLngRef.current;
          const current = moveEvent.latlng;

          const bounds = L.latLngBounds(start, current);
          if (!tempDrawRectRef.current) {
            tempDrawRectRef.current = L.rectangle(bounds, {
              color: '#0284c7',
              weight: 2,
              dashArray: '6, 4',
              fillColor: '#38bdf8',
              fillOpacity: 0.25,
              interactive: false,
            }).addTo(map);
          } else {
            tempDrawRectRef.current.setBounds(bounds);
          }
        };

        const handleMouseUp = (upEvent: L.LeafletMouseEvent) => {
          map.off('mousemove', handleMouseMove);
          map.off('mouseup', handleMouseUp);

          if (drawStartLatLngRef.current) {
            const start = drawStartLatLngRef.current;
            const end = upEvent.latlng;
            const bounds = L.latLngBounds(start, end);

            const latDiff = Math.abs(bounds.getNorth() - bounds.getSouth());
            const lonDiff = Math.abs(bounds.getEast() - bounds.getWest());

            if (latDiff > 0.0003 && lonDiff > 0.0003) {
              const newBbox: BoundingBoxGPS = {
                south: bounds.getSouth(),
                north: bounds.getNorth(),
                west: bounds.getWest(),
                east: bounds.getEast(),
              };
              activeRequestIdRef.current++;
              setFetchResult(null);
              featuresLayerRef.current?.clearLayers();
              setSelectedPreset(null);
              setActiveBbox(newBbox);
              setActiveLocationName(`Custom AOI (${bounds.getCenter().lat.toFixed(4)}, ${bounds.getCenter().lng.toFixed(4)})`);
            }
          }

          if (tempDrawRectRef.current) {
            map.removeLayer(tempDrawRectRef.current);
            tempDrawRectRef.current = null;
          }

          drawStartLatLngRef.current = null;
          setIsDrawingMode(false);
          map.dragging.enable();
          map.getContainer().style.cursor = '';
        };

        map.on('mousemove', handleMouseMove);
        map.on('mouseup', handleMouseUp);
      };

      map.once('mousedown', handleMouseDown);
    } else {
      setIsDrawingMode(false);
      map.dragging.enable();
      map.getContainer().style.cursor = '';
      if (tempDrawRectRef.current) {
        map.removeLayer(tempDrawRectRef.current);
        tempDrawRectRef.current = null;
      }
    }
  };

  // 10. Compile elements and include logistics
  const prepareElementsForBlueprint = () => {
    if (!fetchResult || fetchResult.elements.length === 0) return [];
    const elements: BlueprintElement[] = JSON.parse(JSON.stringify(fetchResult.elements));

    if (includeTowerCrane) {
      elements.push({
        id: `logistics_crane_${Date.now()}`,
        type: 'building',
        name: 'Tower Crane Lattice Mast (55m Radius)',
        points: [
          { x: -28, y: -18 },
          { x: -22, y: -18 },
          { x: -22, y: -12 },
          { x: -28, y: -12 },
        ],
        height: 60,
        elevation: 0,
        material_label: 'structural_steel',
        metadata: { color: '#f59e0b', isLogisticsCrane: true },
      });
    }

    if (includeLaydownYard) {
      elements.push({
        id: `logistics_laydown_${Date.now()}`,
        type: 'boundary',
        name: 'Material Laydown & Equipment Staging Yard',
        points: [
          { x: 25, y: 25 },
          { x: 80, y: 25 },
          { x: 80, y: 65 },
          { x: 25, y: 65 },
        ],
        elevation: 0,
        material_label: 'staging_gravel',
      });
    }

    return elements;
  };

  // Action: Create Brand New Project
  const handleCreateNewProject = () => {
    const elements = prepareElementsForBlueprint();
    if (elements.length === 0 || !activeBbox) return;

    const projectName = `Site: ${activeLocationName.replace(/[\(\)]/g, '').trim()}`;
    const location = `${activeBbox.south.toFixed(4)}, ${activeBbox.west.toFixed(4)}`;
    const notes = `Created from GIS AOI: ${activeLocationName} (${fetchResult?.stats.dimensions.widthM}m x ${fetchResult?.stats.dimensions.heightM}m). Live infrastructure extracted into 2D & 3D.`;

    onCreateProjectFromAOI(projectName, location, elements, notes, activeBbox || undefined);
  };

  // Action: Import into active blueprint
  const handleImportToActiveBlueprint = () => {
    const elements = prepareElementsForBlueprint();
    if (elements.length === 0) return;

    const notes = `Imported from GIS AOI: ${activeLocationName} (${fetchResult?.stats.dimensions.widthM}m x ${fetchResult?.stats.dimensions.heightM}m)`;
    onImportToBlueprint(elements, notes, activeBbox || undefined);
  };

  return (
    <div className="w-full h-full flex bg-slate-100 overflow-hidden select-none">
      {/* Left Takeoffs & Survey Configuration Sidebar */}
      {isSidebarOpen && (
        <aside className="w-88 h-full bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm shrink-0 animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-sky-50 rounded-xl text-sky-600 border border-sky-200 shadow-xs">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Geospatial AOI Survey
                </h2>
                <p className="text-[10px] text-slate-500 font-mono">Live Real-World Extraction</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {activeBbox && (
                <button
                  onClick={handleClearAOI}
                  className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shadow-xs cursor-pointer"
                  title="Delete / Clear AOI"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {activeBbox && (
                <button
                  onClick={() => loadDataForBbox(activeBbox)}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:border-sky-300 transition-colors shadow-xs cursor-pointer"
                  title="Re-scan AOI"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              )}

              <button
                onClick={() => setIsSidebarOpen(false)}
                className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer ml-1"
                title="Close / Hide Survey Panel for full-screen view"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
                <span>Hide</span>
              </button>
            </div>
          </div>

        {/* Civil Project Presets & Hubs */}
        <div className="p-3.5 border-b border-slate-200 space-y-2.5 overflow-y-auto max-h-[35%]">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>Civil Project Hubs</span>
            </label>
            <span className="text-[10px] text-slate-400 font-mono">1-click jump</span>
          </div>

          <div className="space-y-1.5">
            {CIVIL_SITE_PRESETS.map((preset) => {
              const isSelected = selectedPreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className={`w-full text-left p-2 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-300 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{preset.name}</span>
                    <span className="text-[10px] font-mono text-slate-500">{preset.region}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{preset.description}</p>
                </button>
              );
            })}
          </div>

          {/* Quick Jump Global Cities */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-[10px] font-semibold text-slate-500 mb-1.5">Worldwide High-Density Sites:</div>
            <div className="flex flex-wrap gap-1">
              {QUICK_GLOBAL_HUBS.map((hub) => (
                <button
                  key={hub.name}
                  onClick={() => handleJumpToHub(hub)}
                  className="px-2 py-0.5 text-[10px] font-medium rounded-md bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 transition-colors"
                >
                  {hub.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Pre-Construction Takeoffs & Earthwork Volume */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
              Pre-Construction Quantities
            </span>
            {fetchResult && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                {fetchResult.source === 'live_overpass' ? 'LIVE OSM VECTORS' : 'LOCALIZED SYNTHESIS'}
              </span>
            )}
          </div>

          {fetchResult ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium">Road Corridors</div>
                  <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                    {fetchResult.stats.roadCount} Detected
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {fetchResult.stats.roadTotalLengthM}m linear
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-[10px] text-slate-500 font-medium">Structures</div>
                  <div className="text-xs font-bold font-mono text-slate-900 mt-0.5">
                    {fetchResult.stats.buildingCount} Footprints
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {fetchResult.stats.buildingTotalFootprintM2.toLocaleString()} m²
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 col-span-2 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-500 font-medium">3D Ground Parcels (Parks, Water, Plazas)</div>
                    <div className="text-xs font-bold font-mono text-emerald-800 mt-0.5">
                      {fetchResult.stats.groundParcelCount} Parcels Extracted
                    </div>
                  </div>
                  <div className="text-xs font-mono font-bold text-slate-700">
                    {fetchResult.stats.groundTotalAreaM2.toLocaleString()} m²
                  </div>
                </div>
              </div>

              {/* Demolition / Clearance Volume */}
              <div className="p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs">
                <div className="text-[10px] text-amber-800 font-bold uppercase tracking-wider flex items-center justify-between">
                  <span>Demolition / Earthwork Volume</span>
                  <span className="text-amber-600">🏗️</span>
                </div>
                <div className="text-base font-extrabold font-mono text-amber-950 mt-0.5">
                  {fetchResult.stats.estimatedDemolitionVolumeM3.toLocaleString()} m³
                </div>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Calculated from detected building footprints and heights for site clearance estimation.
                </p>
              </div>

              {/* Physical Area Footprint */}
              <div className="p-2 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-600 text-[11px] font-sans font-medium">Site Dimensions:</span>
                <span className="font-bold text-sky-800">
                  {fetchResult.stats.dimensions.widthM}m × {fetchResult.stats.dimensions.heightM}m ({fetchResult.stats.aoiAreaHectares} ha)
                </span>
              </div>

              {/* AOI Edit Helper Tip */}
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <span>Drag the 4 corner handles on the map to resize your AOI.</span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-500">
              No AOI selected. Search a city or click <strong>Draw Custom AOI Box</strong> to select an area.
            </div>
          )}

          {/* Construction Site Logistics Staging Toggles */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-sky-600" />
              <span>Logistics & Staging Elements</span>
            </div>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 text-xs transition-colors">
              <span className="text-slate-700 font-medium">Tower Crane (55m radius)</span>
              <input
                type="checkbox"
                checked={includeTowerCrane}
                onChange={(e) => setIncludeTowerCrane(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 text-xs transition-colors">
              <span className="text-slate-700 font-medium">Material Laydown Yard</span>
              <input
                type="checkbox"
                checked={includeLaydownYard}
                onChange={(e) => setIncludeLaydownYard(e.target.checked)}
                className="w-4 h-4 text-sky-600 rounded cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Bottom Dual-Action CTAs */}
        <div className="p-3.5 border-t border-slate-200 bg-slate-50 space-y-2">
          {/* Primary: Create New Project from AOI */}
          <button
            onClick={handleCreateNewProject}
            disabled={!fetchResult || fetchResult.elements.length === 0}
            className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Create New Project & 2D/3D Blueprint</span>
          </button>

          {/* Secondary: Import into Active Project */}
          <button
            onClick={handleImportToActiveBlueprint}
            disabled={!fetchResult || fetchResult.elements.length === 0}
            className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 disabled:opacity-40 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5 text-sky-600" />
            <span>Import to Current Blueprint ({fetchResult?.elements.length || 0} items)</span>
          </button>
        </div>
      </aside>
      )}

      {/* Center Live Leaflet Map Stage */}
      <div className="flex-1 h-full relative overflow-hidden flex flex-col">
        {/* Top Controls Floating Bar */}
        <div className="absolute top-3 left-4 right-4 z-[450] flex items-center justify-between gap-3 pointer-events-none">
          {/* Left: Location Search Bar + Sidebar Reopen button */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md text-xs font-bold text-slate-800 flex items-center gap-1.5 hover:bg-slate-50 transition-all cursor-pointer"
                title="Open Geospatial AOI Survey & Tools panel"
              >
                <PanelLeftOpen className="w-4 h-4 text-sky-600" />
                <span>Survey Panel</span>
              </button>
            )}

            <div className="relative w-80">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value) setShowSearchDropdown(false);
                  }}
                  onFocus={() => {
                    setShowSearchDropdown(true);
                  }}
                  placeholder={mapDimensionMode === '3d' ? "🔍 Search 3D cities, SLPK, or landmarks..." : "Search city, address, or landmark..."}
                  className="w-full pl-8 pr-8 py-2 bg-white/95 backdrop-blur-md rounded-xl text-xs border border-slate-200 shadow-md focus:outline-none focus:ring-2 focus:ring-sky-500 font-medium text-slate-800"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                {isSearching ? (
                  <RefreshCw className="w-3.5 h-3.5 text-sky-600 absolute right-2.5 animate-spin" />
                ) : searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setShowSearchDropdown(false);
                    }}
                    className="absolute right-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </form>

              {/* Search Results Dropdown */}
              {showSearchDropdown && (
                <div className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-1100 max-h-64 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((r) => (
                      <button
                        key={r.place_id}
                        onClick={() => handleSelectSearchResult(r)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-sky-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2 cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                        <span className="text-slate-800 line-clamp-2">{r.display_name}</span>
                      </button>
                    ))
                  ) : mapDimensionMode === '3d' ? (
                    <div className="p-2.5 text-[11px] text-slate-500">
                      <div className="font-semibold text-slate-700 mb-1.5 px-1">Quick 3D Destinations:</div>
                      <div className="space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            flyToSLPKLayer();
                            setShowSearchDropdown(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-sky-50 text-slate-700 flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-medium">🏢 East Point 3D SLPK</span>
                          <span className="text-[10px] text-sky-600 font-mono">USA</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            flyToWellington();
                            setShowSearchDropdown(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-sky-50 text-slate-700 flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-medium">🏙️ Wellington 3D Digital Twin</span>
                          <span className="text-[10px] text-indigo-600 font-mono">WCC New Zealand</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            flyToMountainSlope();
                            setShowSearchDropdown(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-sky-50 text-slate-700 flex items-center justify-between cursor-pointer"
                        >
                          <span className="font-medium">🏔️ Mont Blanc Alps (Real Slopes)</span>
                          <span className="text-[10px] text-emerald-600 font-mono">France/Italy</span>
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* Center: 2D/3D Toggle Switch & Active AOI Pill */}
          <div className="flex items-center gap-2 pointer-events-auto">
            {/* 2D / 3D Mode Toggle Switch */}
            <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-sm pointer-events-auto">
              <button
                onClick={() => handleSwitchDimension('2d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mapDimensionMode === '2d'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Switch to 2D Top-Down Blueprint Map"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>2D Map</span>
              </button>
              <button
                onClick={() => handleSwitchDimension('3d')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  mapDimensionMode === '3d'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
                title="Switch to 3D Digital Twin (ArcGIS SceneView with 3D Buildings SLPK)"
              >
                <Box className="w-3.5 h-3.5 text-sky-200" />
                <span>3D Scene</span>
                <span className="text-[9px] font-mono font-bold bg-sky-500/30 text-white px-1.5 py-0.5 rounded">
                  SLPK
                </span>
              </button>
            </div>

            <div className="light-panel px-3 py-1.5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 text-xs text-slate-800 bg-white/95 backdrop-blur-md">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Site: <strong>{activeLocationName}</strong>
              </span>
            </div>

            {/* Custom AOI Box Draw Button (in 2D mode) */}
            <button
              onClick={toggleDrawingMode}
              style={{ display: mapDimensionMode === '2d' ? 'inline-flex' : 'none' }}
              className={`items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer ${
                isDrawingMode
                  ? 'bg-rose-600 text-white ring-2 ring-rose-400 animate-pulse'
                  : 'light-panel bg-white hover:bg-sky-50 text-sky-700 border border-sky-300'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isDrawingMode ? 'Drawing (Drag Box on Map)' : '📐 Draw Custom AOI Box'}</span>
            </button>

            <button
              onClick={handleClearAOI}
              style={{ display: activeBbox && mapDimensionMode === '2d' ? 'inline-flex' : 'none' }}
              className="light-panel bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm items-center gap-1 transition-colors cursor-pointer"
              title="Delete active AOI"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear AOI</span>
            </button>
          </div>

          {/* Right: Map Style Switcher (2D) or 3D Quick Focus (3D) */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div 
              style={{ display: mapDimensionMode === '2d' ? 'flex' : 'none' }}
              className="items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-sm"
            >
              <button
                onClick={() => setTileMode('streets')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  tileMode === 'streets'
                    ? 'bg-slate-900 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🗺️ Streets</span>
              </button>
              <button
                onClick={() => setTileMode('satellite')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  tileMode === 'satellite'
                    ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🛰️ Satellite</span>
              </button>
            </div>

            <button
              onClick={flyToSLPKLayer}
              style={{ display: mapDimensionMode === '3d' ? 'inline-flex' : 'none' }}
              className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold items-center gap-1.5 shadow-sm border border-sky-400/30 transition-all cursor-pointer"
              title="Focus camera directly on the East Point 3D Building SLPK dataset"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Focus 3D SLPK Buildings</span>
            </button>
          </div>
        </div>

        {/* Drawing Mode Helper Banner */}
        {isDrawingMode && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-1000 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2 rounded-2xl shadow-lg border border-sky-500/50 flex items-center gap-2 text-xs font-semibold">
            <Crosshair className="w-4 h-4 text-sky-400 animate-spin" />
            <span>Click and drag across any area on the map to define your Area of Interest (AOI).</span>
            <button
              onClick={() => setIsDrawingMode(false)}
              className="ml-2 text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Map Stage Wrapper */}
        <div className="flex-1 w-full h-full relative overflow-hidden bg-slate-100">
          {/* 2D Leaflet Map Container */}
          <div 
            ref={mapContainerRef} 
            className={`absolute inset-0 w-full h-full z-0 bg-slate-100 transition-opacity duration-200 ${
              mapDimensionMode === '2d' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'
            }`}
          />

          {/* 3D ArcGIS SceneView Container */}
          <div 
            ref={arcgisContainerRef} 
            className={`absolute inset-0 w-full h-full z-0 bg-slate-100 transition-opacity duration-200 ${
              mapDimensionMode === '3d' ? 'opacity-100 pointer-events-auto z-10' : 'opacity-0 pointer-events-none z-0'
            }`}
          />

          {/* 3D Loading Spinner (Sibling overlay) */}
          {mapDimensionMode === '3d' && isArcgisLoading && (
            <div className="absolute inset-0 z-50 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center gap-3 pointer-events-none">
              <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin shadow-sm" />
              <div className="text-xs font-bold text-slate-800">Connecting to ArcGIS 3D Digital Twin Engine...</div>
              <div className="text-[11px] font-mono text-sky-600">Streaming 3D Buildings & Real Earth Terrain Slopes</div>
            </div>
          )}

          {/* 3D Scene Interactive Overlay Controls (Sibling overlay floating at bottom) */}
          <div 
            className="absolute bottom-11 left-4 right-4 z-[450] items-center justify-between gap-2.5 pointer-events-none flex-wrap"
            style={{ display: mapDimensionMode === '3d' ? 'flex' : 'none' }}
          >
            {/* 3D Layer Toggles & Manager */}
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-1 shadow-sm flex items-center gap-1.5 text-xs flex-wrap">
              {/* 3D Buildings Toggle */}
              <button
                onClick={toggle3DBuildings}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  show3DBuildings
                    ? 'bg-sky-50 border border-sky-300 text-sky-700 font-semibold shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
                title={show3DBuildings ? 'Worldwide 3D Buildings: Visible (Click to hide)' : 'Worldwide 3D Buildings: Hidden (Click to show)'}
              >
                <Building2 className="w-3.5 h-3.5 text-sky-600" />
                <span>3D Buildings</span>
                <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
                  show3DBuildings ? 'bg-sky-100 text-sky-800' : 'bg-slate-200 text-slate-500'
                }`}>
                  {show3DBuildings ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* 3D Terrain & Slope Toggle */}
              <button
                onClick={toggle3DTerrain}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  show3DTerrain
                    ? 'bg-emerald-50 border border-emerald-300 text-emerald-700 font-semibold shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-400 hover:text-slate-600'
                }`}
                title={show3DTerrain ? 'Real Earth 3D Terrain & Slopes: Active (Click to flatten)' : '3D Terrain: Flat Ground (Click to activate real slopes)'}
              >
                <Mountain className="w-3.5 h-3.5 text-emerald-600" />
                <span>3D Terrain & Slopes</span>
                <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
                  show3DTerrain ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'
                }`}>
                  {show3DTerrain ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* 3D SLPK & Layers Manager Modal Trigger */}
              <button
                onClick={() => setIsSLPKManagerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-700 transition-all shadow-xs cursor-pointer"
                title="Manage 3D Building Layers, SLPK files, links, and visibility"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>SLPK & Layers</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded font-bold bg-indigo-200 text-indigo-900">
                  {slpkLayers.length}
                </span>
              </button>

              {/* 3D Animated Road Traffic Toggle */}
              <button
                onClick={toggleTrafficActive}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isTrafficActive
                    ? 'bg-amber-50 border border-amber-300 text-amber-800 shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-700'
                }`}
                title="Show 3D cars driving along roads on the map"
              >
                <Car className={`w-3.5 h-3.5 ${isTrafficActive ? 'text-amber-600 animate-bounce' : 'text-slate-400'}`} />
                <span>3D Road Cars</span>
                <span className={`text-[10px] font-mono px-1 py-0.2 rounded font-bold ${
                  isTrafficActive ? 'bg-amber-200 text-amber-900' : 'bg-slate-200 text-slate-500'
                }`}>
                  {isTrafficActive ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>

            {/* 3D Navigation & Camera Controls */}
            <div className="pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-1 shadow-sm flex items-center gap-1 text-xs text-slate-700 flex-wrap">
              {/* Quick Fly Buttons */}
              <button
                onClick={flyToSLPKLayer}
                className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer text-xs"
                title="Fly directly to East Point 3D Buildings SLPK dataset"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>East Point SLPK</span>
              </button>

              <button
                onClick={flyToWellington}
                className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer text-xs"
                title="Fly to Wellington Central 3D City Digital Twin (WCC ArcGIS SceneServer)"
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Wellington 3D</span>
              </button>

              <button
                onClick={flyToMountainSlope}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer text-xs"
                title="Fly to Mont Blanc Alps to view real 3D mountain slopes, valleys, and summit elevation"
              >
                <MountainSnow className="w-3.5 h-3.5" />
                <span>Alps Slopes</span>
              </button>

              <div className="h-4 w-px bg-slate-200 mx-0.5" />

              {/* Camera Angle Presets */}
              <button
                onClick={() => setCameraAngle(0)}
                className={`px-2 py-1.5 rounded-lg font-medium text-[11px] transition-colors cursor-pointer ${
                  cameraPitch === 0 ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Top-down 90° view"
              >
                Top
              </button>
              <button
                onClick={() => setCameraAngle(45, 315)}
                className={`px-2 py-1.5 rounded-lg font-medium text-[11px] transition-colors cursor-pointer ${
                  cameraPitch === 45 ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Isometric 45° Perspective"
              >
                45°
              </button>
              <button
                onClick={() => setCameraAngle(75)}
                className={`px-2 py-1.5 rounded-lg font-medium text-[11px] transition-colors cursor-pointer ${
                  cameraPitch === 75 ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Street-level 75° Oblique"
              >
                Street
              </button>

              {/* Rotate 360 */}
              <button
                onClick={rotateCamera3D}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer flex items-center gap-1"
                title="Rotate 3D Scene +45°"
              >
                <Compass className="w-4 h-4" />
                <span className="text-[10px] font-mono text-slate-500">{cameraHeading}°</span>
              </button>

              {/* Sunlight / Time of Day Cycle */}
              <button
                onClick={cycleSunLighting}
                className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer flex items-center gap-1"
                title={`Sun Position: ${sunTimePreset} (Click to cycle Morning / Noon / Sunset)`}
              >
                <Sun className="w-4 h-4" />
                <span className="text-[10px] font-medium capitalize text-amber-700">{sunTimePreset}</span>
              </button>
            </div>
          </div>

          {/* 3D SLPK & Building Layers Manager Modal Dialog */}
          {isSLPKManagerOpen && (
            <div className="absolute inset-0 z-[600] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-sky-100 text-sky-700 border border-sky-200">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">3D Building Layers & SLPK Manager</h3>
                      <p className="text-xs text-slate-500">Manage 3D digital twins, ArcGIS SceneServer SLPK datasets, and local files</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSLPKManagerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                    title="Close Manager"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-5 overflow-y-auto space-y-4 flex-1">
                  {/* Wellington 3D Resource Reference Banner */}
                  <div className="p-3 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">🏙️</span>
                      <div>
                        <div className="text-xs font-bold text-sky-900">Wellington City Council 3D Digital Twin</div>
                        <div className="text-[11px] text-sky-700">Official ArcGIS 3D WebScene integrated into engine</div>
                      </div>
                    </div>
                    <a
                      href="https://wcc.maps.arcgis.com/apps/3DScene/index.html?appid=4561446e7f384a969cfbe368e9ca0002"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 flex items-center gap-1 shadow-xs transition-colors shrink-0"
                    >
                      <span>Open ArcGIS WCC</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Active Layers List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active 3D Layers ({slpkLayers.length})</span>
                      <span className="text-[11px] text-slate-400">Toggle eye for visibility, click target to fly</span>
                    </div>

                    <div className="space-y-2">
                      {slpkLayers.map((layer) => (
                        <div
                          key={layer.id}
                          className={`p-3 rounded-xl border transition-all ${
                            layer.visible 
                              ? 'bg-white border-slate-200 shadow-xs' 
                              : 'bg-slate-50/70 border-slate-200 opacity-60'
                          }`}
                        >
                          {editingLayerId === layer.id ? (
                            /* Inline Edit Form */
                            <div className="space-y-2">
                              <div className="text-xs font-bold text-slate-700">Edit Layer Info</div>
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="Layer Title"
                                className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                              <input
                                type="text"
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                placeholder="SceneServer or SLPK URL"
                                className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                              <div className="flex items-center justify-end gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setEditingLayerId(null)}
                                  className="px-2.5 py-1 text-xs rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditLayer(layer.id)}
                                  className="px-3 py-1 text-xs rounded-lg font-semibold bg-sky-600 hover:bg-sky-500 text-white cursor-pointer"
                                >
                                  Save Changes
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Layer Row Display */
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleLayerVisibility(layer.id)}
                                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                                    layer.visible 
                                      ? 'text-sky-600 bg-sky-50 hover:bg-sky-100' 
                                      : 'text-slate-400 bg-slate-100 hover:bg-slate-200'
                                  }`}
                                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                                >
                                  {layer.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>

                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-800 truncate">{layer.title}</span>
                                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                      layer.type === 'slpk' 
                                        ? 'bg-sky-100 text-sky-800' 
                                        : layer.type === 'sceneserver' 
                                        ? 'bg-indigo-100 text-indigo-800' 
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}>
                                      {layer.type.toUpperCase()}
                                    </span>
                                  </div>
                                  <div className="text-[11px] font-mono text-slate-400 truncate max-w-md">
                                    {layer.url}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => {
                                    flyToSLPKItem(layer);
                                    setIsSLPKManagerOpen(false);
                                  }}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                                  title="Fly camera to this 3D layer"
                                >
                                  <Maximize2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleStartEditLayer(layer)}
                                  className="p-1.5 rounded-lg text-slate-600 hover:text-sky-600 hover:bg-sky-50 transition-colors cursor-pointer"
                                  title="Edit title & URL"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {!layer.isBuiltIn && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLayer(layer.id)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="Delete custom layer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Add New 3D SLPK or SceneServer Layer */}
                  <div className="border-t border-slate-200 pt-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2 flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-sky-600" />
                      <span>Add New 3D Layer or File</span>
                    </div>

                    <form onSubmit={handleAddNewSLPKLayer} className="space-y-2.5 bg-slate-50/70 p-3 rounded-xl border border-slate-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newLayerTitle}
                          onChange={(e) => setNewLayerTitle(e.target.value)}
                          placeholder="Layer Name (e.g. City Digital Twin)"
                          className="text-xs px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                        <input
                          type="text"
                          value={newLayerUrl}
                          onChange={(e) => setNewLayerUrl(e.target.value)}
                          placeholder="ArcGIS SceneServer or SLPK Link..."
                          className="text-xs font-mono px-3 py-2 bg-white rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                        {/* Local File Upload Trigger */}
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleUploadLocalFile}
                            accept=".slpk,.json,.geojson"
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                          >
                            <FolderPlus className="w-3.5 h-3.5 text-slate-500" />
                            <span>Select Local .slpk / File</span>
                          </button>
                        </div>

                        <button
                          type="submit"
                          disabled={!newLayerTitle.trim() || !newLayerUrl.trim()}
                          className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer ${
                            newLayerTitle.trim() && newLayerUrl.trim()
                              ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-xs'
                              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add 3D Layer</span>
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-500">
                  <span>Supports ArcGIS SceneServer layers, I3S 3D Building packages, and SLPK assets.</span>
                  <button
                    type="button"
                    onClick={() => setIsSLPKManagerOpen(false)}
                    className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Status Bar */}
        <div className="h-8 border-t border-slate-200 bg-white px-4 flex items-center justify-between text-[11px] font-mono text-slate-500 z-10">
          <div className="flex items-center gap-4">
            <span>
              Engine: <strong>{mapDimensionMode === '3d' ? 'ArcGIS Maps SDK 3D (WebGL SceneView)' : 'Leaflet 2D Geospatial Engine'}</strong>
            </span>
            {activeBbox && (
              <span>Center GPS: <strong>{((activeBbox.south + activeBbox.north) / 2).toFixed(5)}, {((activeBbox.west + activeBbox.east) / 2).toFixed(5)}</strong></span>
            )}
            {mapDimensionMode === '3d' && (
              <>
                <span className="text-sky-600">3D Buildings: <strong>{show3DBuildings ? 'Global + SLPK Active' : 'Hidden'}</strong></span>
                <span className="text-emerald-600">3D Terrain: <strong>{show3DTerrain ? 'WorldElevation3D (Real Slopes)' : 'Flat Plane'}</strong></span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{mapDimensionMode === '3d' ? '3D Real Earth & Buildings Streaming' : (isLoading ? 'Fetching Overpass Infrastructure...' : 'Geospatial Vectors Ready')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
