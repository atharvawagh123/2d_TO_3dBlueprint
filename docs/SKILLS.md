# Blueprint-to-3D Model Tool — Technical Capabilities & Skills Inventory

**Document Version:** 1.0.0  
**Status:** Active Reference  

This document catalogs the core mathematical, graphics, and architectural capabilities engineered into this repository. Future development sessions can reference these solved patterns.

---

## 1. Canvas-Based Polyline & Polygon Drafting with Snapping (`react-konva`)

### Problem
Engineers need to draw arbitrary roads, bridge alignments, and plot/building boundaries with precise dimensional control on an interactive canvas, without manual visual estimation.

### Solved Technical Pattern
- **Coordinate Conversion & World Scaling:**
  Canvas screen coordinates are normalized to real-world meters ($1\text{ unit} = 1\text{ meter}$). Pan and zoom transformations (scale factor $s$, offset $dx, dy$) map mouse events accurately:
  $$X_{\text{world}} = \frac{X_{\text{screen}} - dx}{s}, \quad Y_{\text{world}} = \frac{Y_{\text{screen}} - dy}{s}$$
- **Grid Snapping Engine:**
  Configurable snap intervals (e.g., $1.0\text{m}$, $5.0\text{m}$):
  $$X_{\text{snapped}} = \text{round}\left(\frac{X_{\text{world}}}{\Delta}\right) \times \Delta$$
- **Segment Length & Angle Overlays:**
  Between active node $P_i$ and cursor $P_{i+1}$, the system computes real-time Euclidean distance:
  $$L = \sqrt{(x_{i+1} - x_i)^2 + (y_{i+1} - y_i)^2}$$
  and displays dynamic dimension callouts with metric tags.
- **Closed Polygon Auto-Detection:**
  When drafting buildings or site boundaries, clicking within snap tolerance of the first vertex automatically closes the polygon ring.

---

## 2. 2D Path Extrusion into 3D Ribbon Geometry (`blueprintTo3D.ts`)

### Problem
Roads and bridge decks are defined by an open polyline centerline path and a transversal width $W$. Three.js standard ExtrudeGeometry extrudes a 2D cross-section along a line, but handling non-coplanar twists, variable road widths, and continuous mitering requires custom ribbon triangulation.

### Solved Technical Pattern
- **Polyline Normal Offset Calculation:**
  For each path segment vector $\vec{v}_k = P_{k+1} - P_k$, the 2D perpendicular normal unit vector is:
  $$\hat{n}_k = \left(-\frac{v_{k,y}}{\|\vec{v}_k\|}, \frac{v_{k,x}}{\|\vec{v}_k\|}\right)$$
- **Miter Joint Computation at Intermediate Vertices:**
  At interior vertex $P_k$ between incoming unit tangent $\hat{t}_{k-1}$ and outgoing unit tangent $\hat{t}_k$, the average miter normal $\hat{m}_k$ and miter length scale are calculated:
  $$\hat{m}_k = \frac{\hat{n}_{k-1} + \hat{n}_k}{\|\hat{n}_{k-1} + \hat{n}_k\|}, \quad \text{scale} = \frac{1}{\hat{m}_k \cdot \hat{n}_k}$$
  Vertices are offset to left and right ribbons:
  $$V_{\text{left}, k} = P_k + \left(\frac{W}{2} \cdot \text{scale}\right) \hat{m}_k, \quad V_{\text{right}, k} = P_k - \left(\frac{W}{2} \cdot \text{scale}\right) \hat{m}_k$$
- **Index Triangulation:**
  Adjacent quadrilateral strips $[V_{L,k}, V_{R,k}, V_{R,k+1}, V_{L,k+1}]$ are mapped to Two CCW triangles with upward surface normals $\hat{Y} = (0, 1, 0)$ and continuous UV coordinates for asphalt striping.
- **Elevation Offset:**
  Elevations $Z_{\text{base}}$ are mapped directly to Three.js Y-axis world coordinates, producing raised ramps and overpasses.

---

## 3. Parametric Bridge Pier Auto-Placement Along Alignment

### Problem
Civil bridges span ravines, waterways, and ground terrain. A civil engineer specifies a centerline path, deck clearance elevation, and `pier_spacing` (e.g., every 25m). Piers must be automatically placed perpendicular to alignment tangents and anchored securely into the terrain grade.

### Solved Technical Pattern
- **Cumulative Arc-Length Parameterization:**
  Given polyline points $P_0, P_1, \dots, P_n$, the total centerline length $S$ is calculated:
  $$S = \sum_{i=0}^{n-1} \|P_{i+1} - P_i\|$$
- **Pier Count & Uniform Interval Distribution:**
  Number of piers $N = \lfloor \frac{S}{\text{pier\_spacing}} \rfloor$.
  Sample target distances: $d_j = j \times \text{pier\_spacing}$ (with start and end pier offsets avoiding edge clipping).
- **Interpolation & Tangent Extraction:**
  For each distance $d_j$, locate the containing segment $k$:
  $$P(d_j) = P_k + \alpha (P_{k+1} - P_k), \quad \alpha = \frac{d_j - s_k}{s_{k+1} - s_k}$$
- **Vertical Cylinder / Box Pier Meshing:**
  - Deck height $Y_{\text{deck}} = \text{elevation}$.
  - Pier height $H_{\text{pier}} = Y_{\text{deck}} - Y_{\text{ground}}$ (spanning down to $Y = 0$).
  - Structural crosshead beam placed directly beneath deck; dual cylindrical support columns descend into footing pads.

---

## 4. Upward Prism Extrusion for Site Boundaries and Structures

### Problem
Polygonal site plots and building footprints must be converted into 3D solid volumes with flat planar roofs, vertical facade walls, and accurate world heights.

### Solved Technical Pattern
- **Three.js `Shape` Generation:**
  2D boundary points are converted into a closed `THREE.Shape` via `.moveTo()` and `.lineTo()`.
- **Extrusion Pipeline:**
  Invokes `THREE.ExtrudeGeometry` with:
  ```typescript
  {
    depth: element.height || 10,
    bevelEnabled: false,
    steps: 1
  }
  ```
- **Orientation Normalization:**
  Because Three.js `ShapeGeometry` extrudes along the Z-axis, the mesh transform is rotated $-90^\circ$ around the X-axis (`rotation.x = -Math.PI / 2`) and translated upward by base elevation $Y = \text{elevation}$, perfectly matching 2D plan coordinates to $(X, Z)$ ground coordinates and $Y$ elevation.

---

## 5. Client-Side 3D File Export (.glb) & Canvas Snapshot (.png)

### Problem
Users need to download 3D models for local BIM/CAD review (Rhino, Blender, Revit) and export presentations without incurring backend compute or cloud storage costs.

### Solved Technical Pattern
- **Binary GLTF (.glb) Export:**
  Uses Three.js `GLTFExporter` in binary format (`binary: true`), capturing complete scene geometries, materials, colors, and hierarchical node transforms into an `ArrayBuffer`.
  The buffer is packed into a `Blob([buffer], { type: 'model/gltf-binary' })` and triggered via programmatic `<a>` download anchor.
- **High-DPI WebGL Snapshot:**
  Renderer canvas is preserved using `preserveDrawingBuffer: true` or manual `gl.render(scene, camera)` snapshot, serialized to data URI via `canvas.toDataURL('image/png')`, and saved locally.

---

## 6. Public Read-Only Sharing Without Authentication

### Problem
Construction clients must be able to view 3D models instantly from an email or messaging link without creating accounts or entering passwords.

### Solved Technical Pattern
- **Dedicated Route:** `/view/:projectId`
- **Security Rule Decoupling:**
  Firestore security rules permit unauthenticated reads on `/projects/{projectId}` and `/projects/{projectId}/versions/{versionId}`.
- **Interactive Comment Injection:**
  Clients retain permission to create documents in `/projects/{projectId}/comments/`, providing interactive spatial feedback while safeguarding project and blueprint geometry from tampering.
