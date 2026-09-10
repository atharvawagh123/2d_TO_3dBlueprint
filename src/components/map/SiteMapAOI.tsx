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
  X
} from 'lucide-react';

interface SiteMapAOIProps {
  onImportToBlueprint: (elements: BlueprintElement[], notes: string) => void;
  onCreateProjectFromAOI: (
    projectName: string, 
    location: string, 
    elements: BlueprintElement[], 
    notes: string
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
  { name: 'Nagpur (Zero Mile Hub)', lat: 21.1508, lon: 79.0867 },
  { name: 'Mumbai (Coastal Sea Link)', lat: 18.9438, lon: 72.8232 },
  { name: 'New Delhi (Ring Road)', lat: 28.6139, lon: 77.2295 },
  { name: 'Bengaluru (Outer Ring Road)', lat: 12.9176, lon: 77.6234 },
  { name: 'Hyderabad (HITEC City)', lat: 17.4401, lon: 78.3489 },
  { name: 'Dubai (Downtown)', lat: 25.1972, lon: 55.2744 },
  { name: 'London (Docklands)', lat: 51.5050, lon: -0.0200 },
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

  // Active state - Default to Central India (Nagpur Ram Jhula & Metro)
  const [selectedPreset, setSelectedPreset] = useState<CivilSitePreset | null>(CIVIL_SITE_PRESETS[0]);
  const [activeBbox, setActiveBbox] = useState<BoundingBoxGPS | null>(CIVIL_SITE_PRESETS[0].bbox);
  const [activeLocationName, setActiveLocationName] = useState<string>(CIVIL_SITE_PRESETS[0].name);
  const [tileMode, setTileMode] = useState<MapTileProvider>('satellite');

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

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialCenterLat = (CIVIL_SITE_PRESETS[0].bbox.south + CIVIL_SITE_PRESETS[0].bbox.north) / 2;
    const initialCenterLon = (CIVIL_SITE_PRESETS[0].bbox.west + CIVIL_SITE_PRESETS[0].bbox.east) / 2;

    const map = L.map(mapContainerRef.current, {
      center: [initialCenterLat, initialCenterLon],
      zoom: 16,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Initial tile layer (Free Esri World Imagery Satellite)
    const initialTiles = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri World Imagery (Free)',
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

    const map = mapInstanceRef.current;
    if (map) {
      const centerLat = (preset.bbox.south + preset.bbox.north) / 2;
      const centerLon = (preset.bbox.west + preset.bbox.east) / 2;
      map.flyTo([centerLat, centerLon], 16, { duration: 1.2 });
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
        height: 65,
        elevation: 0,
        material_label: 'structural_steel',
        metadata: { color: '#f59e0b' },
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

    onCreateProjectFromAOI(projectName, location, elements, notes);
  };

  // Action: Import into active blueprint
  const handleImportToActiveBlueprint = () => {
    const elements = prepareElementsForBlueprint();
    if (elements.length === 0) return;

    const notes = `Imported from GIS AOI: ${activeLocationName} (${fetchResult?.stats.dimensions.widthM}m x ${fetchResult?.stats.dimensions.heightM}m)`;
    onImportToBlueprint(elements, notes);
  };

  return (
    <div className="w-full h-full flex bg-slate-100 overflow-hidden select-none">
      {/* Left Takeoffs & Survey Configuration Sidebar */}
      <aside className="w-88 h-full bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm shrink-0">
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
                className="p-1.5 rounded-lg bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 transition-colors shadow-xs"
                title="Delete / Clear AOI"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {activeBbox && (
              <button
                onClick={() => loadDataForBbox(activeBbox)}
                disabled={isLoading}
                className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-sky-600 hover:border-sky-300 transition-colors shadow-xs"
                title="Re-scan AOI"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
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

      {/* Center Live Leaflet Map Stage */}
      <div className="flex-1 h-full relative overflow-hidden flex flex-col">
        {/* Top Controls Floating Bar */}
        <div className="absolute top-3 left-4 right-4 z-1000 flex items-center justify-between gap-3 pointer-events-none">
          {/* Left: Location Search Bar */}
          <div className="relative pointer-events-auto w-80">
            <form onSubmit={handleSearchSubmit} className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value) setShowSearchDropdown(false);
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchDropdown(true);
                }}
                placeholder="Search city, address, or landmark..."
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
                  className="absolute right-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </form>

            {/* Search Results Dropdown */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-1100 max-h-60 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.place_id}
                    onClick={() => handleSelectSearchResult(r)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-sky-50 border-b border-slate-100 last:border-b-0 flex items-start gap-2"
                  >
                    <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0 mt-0.5" />
                    <span className="text-slate-800 line-clamp-2">{r.display_name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center: Active AOI Pill & Draw Button */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <div className="light-panel px-3.5 py-1.5 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 text-xs text-slate-800">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Site: <strong>{activeLocationName}</strong>
              </span>
            </div>

            {/* Custom AOI Box Draw Button */}
            <button
              onClick={toggleDrawingMode}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all ${
                isDrawingMode
                  ? 'bg-rose-600 text-white ring-2 ring-rose-400 animate-pulse'
                  : 'light-panel bg-white hover:bg-sky-50 text-sky-700 border border-sky-300'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>{isDrawingMode ? 'Drawing (Drag Box on Map)' : '📐 Draw Custom AOI Box'}</span>
            </button>

            {activeBbox && (
              <button
                onClick={handleClearAOI}
                className="light-panel bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1 transition-colors"
                title="Delete active AOI"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear AOI</span>
              </button>
            )}
          </div>

          {/* Right: Map Style Switcher (Street vs Satellite) */}
          <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-sm pointer-events-auto">
            <button
              onClick={() => setTileMode('streets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tileMode === 'streets'
                  ? 'bg-slate-900 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🗺️ Street Map</span>
            </button>
            <button
              onClick={() => setTileMode('satellite')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                tileMode === 'satellite'
                  ? 'bg-emerald-700 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🛰️ Free Satellite (Esri HD)</span>
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
              className="ml-2 text-[10px] bg-white/20 hover:bg-white/30 px-2 py-0.5 rounded-md"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Real Leaflet Map Container */}
        <div 
          ref={mapContainerRef} 
          className="flex-1 w-full h-full relative z-0 bg-slate-200" 
        />

        {/* Bottom Status Bar */}
        <div className="h-8 border-t border-slate-200 bg-white px-4 flex items-center justify-between text-[11px] font-mono text-slate-500 z-10">
          <div className="flex items-center gap-4">
            <span>Projection: <strong>WGS84 EPSG:4326 → Local Metric (1.0 = 1.0m)</strong></span>
            {activeBbox && (
              <span>Center GPS: <strong>{((activeBbox.south + activeBbox.north) / 2).toFixed(5)}, {((activeBbox.west + activeBbox.east) / 2).toFixed(5)}</strong></span>
            )}
          </div>
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isLoading ? 'Fetching Overpass Infrastructure...' : 'Geospatial Vectors Ready'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
