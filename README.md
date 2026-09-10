# AURA 3D Civil — Blueprint-to-3D Digital Twin & GIS Infrastructure Platform

[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?logo=vite)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black?logo=three.js)](https://threejs.org/)
[![Leaflet](https://img.shields.io/badge/Leaflet-GIS-199900?logo=leaflet)](https://leafletjs.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript)](https://www.typescriptlang.org/)

A web-based civil engineering and infrastructure modeling platform that transforms 2D CAD site blueprints and live geospatial satellite Area-of-Interest (AOI) surveys into interactive 3D WebGL digital twins in real time.

---

## Key Features

### 1. 🌐 Geospatial AOI Survey (GIS Live Map)
* **Real-Time OSM Overpass API Engine**: High-efficiency `out geom;` queries fetch 100% exact GPS geometry for roads, elevated viaducts, metro/rail transit corridors, and structural building envelopes.
* **Free Sub-Meter Satellite Imagery**: Direct integration with Esri World Imagery (ArcGIS Global Satellite Basemap) offering sub-meter aerial clarity worldwide without API keys.
* **Live Search & Geocoding**: Instant location search powered by OpenStreetMap Nominatim with debounced dropdown suggestions and auto-framing.
* **Interactive Bounding Box Drafting & Editing**:
  * Freehand click-and-drag AOI drafting across any location on Earth.
  * 4 draggable corner resize handles (NW, NE, SW, SE) to resize active AOIs on the fly.
  * Instant state purge and atomic request sequence guarding to prevent stale responses.
* **Pre-Construction Civil Takeoffs**: Real-time calculations of linear road length ($m$), asphalt pavement area ($m^2$), building footprints ($m^2$), site dimensions ($ha$), and estimated demolition/earthwork volume ($m^3$).

### 2. 📐 Precision 2D CAD Drafting Canvas
* **Vector Tools**: Draw arterial roads, elevated bridge viaducts, building plots, and property boundaries.
* **Parametric Snapping**: Configurable grid snapping (`0.5m`, `1m`, `5m`, `10m`) with visual alignment guides.
* **Non-Obstructive Drafting HUD**: Dynamic drafting bar with undo point, finish shape, and cancel controls.
* **Full Undo / Redo**: Multi-level state history tracking for all drafting actions.

### 3. ✨ 3D WebGL Digital Twin Viewer
* **Daylight Architectural Atmosphere**: Physically based daylight sky (`#dbeafe`), atmospheric fog, and 1,800m engineering pad grid.
* **Dynamic FOV-Based Camera Framing**: Frustum trigonometry automatically frames civil structures and highway corridors of any length (up to 1,500m) without clipping or blank voids.
* **Interactive 3D Layers & Camera Panel**: Direct element list with smooth cinematic camera swooping and electric blue focus bounding boxes.
* **Floating 2D Site Plan HUD (Picture-in-Picture)**: Interactive bottom-right 2D mini-map with real-time camera eye indicator and click-to-aim camera redirection.
* **Collaboration & Feedback**: Place 3D feedback comment pins on any surface with author notes and timestamps.
* **Export Options**: 1-click download of `.glb` binary 3D models and high-resolution PNG canvas screenshots.

---

## Tech Stack

* **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide React
* **3D Graphics**: Three.js, OrbitControls, GLTFExporter
* **Geospatial & Mapping**: Leaflet, OpenStreetMap Overpass API, Esri World Imagery, OSM Nominatim Geocoder
* **Build Tool**: Vite 8, Oxlint

---

## Getting Started

### Prerequisites
* Node.js (v18 or higher)
* npm

### Installation
```bash
# Clone repository
git clone https://github.com/<your-username>/aura-3d-civil.git
cd aura-3d-civil

# Install dependencies
npm install

# Start local development server
npm run dev
```

The application will be running at `http://localhost:5173/`.

### Production Build
```bash
npm run build
```

---

## License
MIT License
