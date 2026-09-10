import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { BlueprintElement, Comment, Vector3D } from '../../types';
import { blueprintTo3D, type ConvertedScene3D } from '../../engine/blueprintTo3D';
import { exportToGLB, captureCanvasScreenshot } from '../../services/exportService';
import { 
  Camera, 
  Download, 
  Layers, 
  MessageSquarePlus, 
  Focus,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Compass
} from 'lucide-react';

interface ThreeCanvasProps {
  elements: BlueprintElement[];
  comments: Comment[];
  selectedElementId?: string | null;
  onSelectElement?: (id: string | null) => void;
  onAddComment: (pos: Vector3D, text: string, author: string) => void;
  onSwitchTo2D?: () => void;
  readOnly?: boolean;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  elements,
  comments,
  selectedElementId,
  onSelectElement,
  onAddComment,
  onSwitchTo2D,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Three.js instances refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const pinsGroupRef = useRef<THREE.Group | null>(null);
  const highlightHelperRef = useRef<THREE.BoxHelper | null>(null);

  // Smooth Camera Animation Target
  const cameraAnimRef = useRef<{
    active: boolean;
    startPos: THREE.Vector3;
    endPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
    progress: number;
  }>({
    active: false,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
    startTarget: new THREE.Vector3(),
    endTarget: new THREE.Vector3(),
    progress: 1,
  });

  // UI State
  const [commentMode, setCommentMode] = useState(false);
  const [activePinPrompt, setActivePinPrompt] = useState<Vector3D | null>(null);
  const [commentText, setCommentText] = useState('');
  const [authorName, setAuthorName] = useState(readOnly ? 'Client Reviewer' : 'Lead Engineer');
  const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isLayersDrawerOpen, setIsLayersDrawerOpen] = useState(true);
  const [showMiniHud, setShowMiniHud] = useState(true);
  const miniCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Converted 3D scene data
  const [convertedData, setConvertedData] = useState<ConvertedScene3D | null>(null);

  // Initialize Three.js scene (Bright Daylight Architectural Scene)
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene with daylight gradient sky
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbeafe);
    scene.fog = new THREE.Fog(0xdbeafe, 450, 2600);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 4000);
    camera.position.set(120, 90, 140);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    rendererRef.current = renderer;

    // 4. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.maxPolarAngle = Math.PI / 2 - 0.01;
    controls.minDistance = 3;
    controls.maxDistance = 2500;
    controls.target.set(0, 5, 0);
    controlsRef.current = controls;

    // 5. Daylight Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xcfd8dc, 0.85);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffdf5, 1.8);
    sunLight.position.set(220, 300, 160);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 1200;
    const d = 350;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0002;
    scene.add(sunLight);

    const skyFill = new THREE.DirectionalLight(0xe0f2fe, 0.6);
    skyFill.position.set(-160, 100, -140);
    scene.add(skyFill);

    // 6. Ground Terrain Plane (Light Architectural Engineering Pad)
    const groundGeom = new THREE.PlaneGeometry(3000, 3000);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.95,
      metalness: 0.02,
    });
    const ground = new THREE.Mesh(groundGeom, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.1;
    scene.add(ground);

    const grid = new THREE.GridHelper(1800, 90, 0x0284c7, 0xcbd5e1);
    grid.position.y = 0;
    scene.add(grid);

    // Groups
    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    const pinsGroup = new THREE.Group();
    scene.add(pinsGroup);
    pinsGroupRef.current = pinsGroup;

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Camera Smooth Interpolation
      if (cameraAnimRef.current.active) {
        const anim = cameraAnimRef.current;
        anim.progress += 0.05;
        const t = Math.min(anim.progress, 1);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        camera.position.lerpVectors(anim.startPos, anim.endPos, ease);
        controls.target.lerpVectors(anim.startTarget, anim.endTarget, ease);

        if (t >= 1) {
          anim.active = false;
        }
      }

      controls.update();

      // Comment Pins Float Animation
      pinsGroup.children.forEach((child, i) => {
        child.position.y = child.userData.baseY + Math.sin(Date.now() * 0.003 + i) * 0.35;
      });

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // Update 3D Geometry when elements change & Auto-frame initial scene!
  useEffect(() => {
    if (!modelGroupRef.current || !sceneRef.current) return;

    while (modelGroupRef.current.children.length > 0) {
      const obj = modelGroupRef.current.children[0];
      modelGroupRef.current.remove(obj);
    }

    const converted = blueprintTo3D(elements);
    setConvertedData(converted);

    converted.elements.forEach((ce) => {
      const elemGroup = new THREE.Group();
      elemGroup.name = ce.name;
      elemGroup.userData = { elementId: ce.id, name: ce.name, type: ce.type };

      ce.meshes.forEach((m) => {
        const mesh = new THREE.Mesh(m.geometry, m.material);
        if (m.position) mesh.position.copy(m.position);
        if (m.rotation) mesh.rotation.copy(m.rotation);
        mesh.castShadow = m.castShadow ?? true;
        mesh.receiveShadow = m.receiveShadow ?? true;
        mesh.userData = { elementId: ce.id, name: ce.name, type: ce.type };
        elemGroup.add(mesh);
      });

      modelGroupRef.current?.add(elemGroup);
    });

    // On initial load or scene overhaul (when no element is specifically selected), frame entire project!
    if (!selectedElementId && controlsRef.current && cameraRef.current && converted.bounds) {
      const { center, size } = converted.bounds;
      const maxDim = Math.max(size.x, size.z, 40);
      controlsRef.current.target.copy(center);
      cameraRef.current.position.set(
        center.x + maxDim * 0.85,
        center.y + maxDim * 0.65 + 10,
        center.z + maxDim * 0.85
      );
      controlsRef.current.update();
    }
  }, [elements]);

  // Smooth Zoom-on-Element in 3D whenever selectedElementId changes!
  useEffect(() => {
    if (!selectedElementId || !convertedData || !cameraRef.current || !controlsRef.current) {
      // Clear bounding box helper if deselected
      if (highlightHelperRef.current && sceneRef.current) {
        sceneRef.current.remove(highlightHelperRef.current);
        highlightHelperRef.current = null;
      }
      return;
    }

    const targetElem = convertedData.elements.find(e => e.id === selectedElementId);
    if (!targetElem) return;

    const center = targetElem.center;
    const size = targetElem.bounds.size;
    const dim = Math.max(size.x, size.z, size.y, 8);
    const radius = targetElem.bounds.radius || (dim / 2);

    // Dynamic FOV-based camera distance so the entire element comfortably fills ~65% of viewport
    const fovRad = (cameraRef.current.fov * Math.PI) / 180;
    const distance = Math.max((radius / Math.sin(fovRad / 2)) * 1.15, 30);

    const elevation = distance * 0.55;
    const horizontalDist = distance * 0.82;

    const endTarget = new THREE.Vector3(center.x, center.y, center.z);
    const endPos = new THREE.Vector3(
      center.x + horizontalDist * 0.707,
      center.y + elevation,
      center.z + horizontalDist * 0.707
    );

    cameraAnimRef.current = {
      active: true,
      startPos: cameraRef.current.position.clone(),
      endPos,
      startTarget: controlsRef.current.target.clone(),
      endTarget,
      progress: 0,
    };

    // Update Highlight Box in 3D
    if (sceneRef.current && modelGroupRef.current) {
      if (highlightHelperRef.current) {
        sceneRef.current.remove(highlightHelperRef.current);
        highlightHelperRef.current = null;
      }

      const targetGroup = modelGroupRef.current.children.find(
        c => c.userData.elementId === selectedElementId
      );
      if (targetGroup) {
        const helper = new THREE.BoxHelper(targetGroup, 0x0284c7);
        helper.material.linewidth = 2;
        sceneRef.current.add(helper);
        highlightHelperRef.current = helper;
      }
    }
  }, [selectedElementId, convertedData]);

  // Update Comment Pins
  useEffect(() => {
    if (!pinsGroupRef.current) return;

    while (pinsGroupRef.current.children.length > 0) {
      pinsGroupRef.current.remove(pinsGroupRef.current.children[0]);
    }

    comments.forEach((c) => {
      const pinContainer = new THREE.Group();
      pinContainer.position.set(c.position.x, c.position.y + 1.8, c.position.z);
      pinContainer.userData = { commentId: c.id, baseY: c.position.y + 1.8 };

      const pinHeadGeom = new THREE.OctahedronGeometry(1.2, 0);
      const isResolved = c.status === 'resolved';
      const pinHeadMat = new THREE.MeshStandardMaterial({
        color: isResolved ? 0x10b981 : 0xf59e0b,
        emissive: isResolved ? 0x059669 : 0xd97706,
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.6,
      });
      const pinHead = new THREE.Mesh(pinHeadGeom, pinHeadMat);
      pinContainer.add(pinHead);

      const needleGeom = new THREE.CylinderGeometry(0.1, 0.02, 1.8);
      const needleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
      const needle = new THREE.Mesh(needleGeom, needleMat);
      needle.position.y = -0.9;
      pinContainer.add(needle);

      pinsGroupRef.current?.add(pinContainer);
    });
  }, [comments]);

  // Canvas Click: Handle Element Selection or Comment Drop
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // 1. Comment Pin click
    if (pinsGroupRef.current) {
      const pinHits = raycaster.intersectObjects(pinsGroupRef.current.children, true);
      if (pinHits.length > 0) {
        let rootGroup: THREE.Object3D | null = pinHits[0].object;
        while (rootGroup && !rootGroup.userData.commentId && rootGroup.parent) {
          rootGroup = rootGroup.parent;
        }
        if (rootGroup && rootGroup.userData.commentId) {
          const hitComment = comments.find(c => c.id === rootGroup?.userData.commentId);
          if (hitComment) {
            setSelectedComment(hitComment);
            return;
          }
        }
      }
    }

    // 2. In Comment Placement Mode
    if (commentMode && modelGroupRef.current) {
      const hits = raycaster.intersectObjects(modelGroupRef.current.children, true);
      if (hits.length > 0) {
        const hitPoint = hits[0].point;
        setActivePinPrompt({
          x: Math.round(hitPoint.x * 10) / 10,
          y: Math.round(hitPoint.y * 10) / 10,
          z: Math.round(hitPoint.z * 10) / 10,
        });
        setCommentMode(false);
        return;
      }
    }

    // 3. Click on 3D Element => Focus and zoom directly to it!
    if (!commentMode && modelGroupRef.current && onSelectElement) {
      const hits = raycaster.intersectObjects(modelGroupRef.current.children, true);
      if (hits.length > 0) {
        let hitObj: THREE.Object3D | null = hits[0].object;
        while (hitObj && !hitObj.userData.elementId && hitObj.parent) {
          hitObj = hitObj.parent;
        }
        if (hitObj && hitObj.userData.elementId) {
          onSelectElement(hitObj.userData.elementId);
        }
      }
    }
  };

  // Preset Views
  const setCameraView = (view: 'iso' | 'top' | 'drone' | 'eye' | 'all') => {
    if (!cameraRef.current || !controlsRef.current || !convertedData?.bounds) return;
    const { center, size } = convertedData.bounds;
    const maxDim = Math.max(size.x, size.z, 40);
    const fovRad = (cameraRef.current.fov * Math.PI) / 180;
    const dist = Math.max(((maxDim * 0.75) / Math.sin(fovRad / 2)), 50);

    const endTarget = center.clone();
    let endPos = cameraRef.current.position.clone();

    if (view === 'iso' || view === 'all') {
      endPos = new THREE.Vector3(center.x + dist * 0.7, center.y + dist * 0.55, center.z + dist * 0.7);
    } else if (view === 'top') {
      endPos = new THREE.Vector3(center.x, center.y + dist * 1.35, center.z + 0.1);
    } else if (view === 'drone') {
      endPos = new THREE.Vector3(center.x + dist * 0.35, center.y + dist * 0.9, center.z + dist * 0.35);
    } else if (view === 'eye') {
      endPos = new THREE.Vector3(center.x - maxDim * 0.35, center.y + 2.5, center.z - maxDim * 0.35);
      endTarget.set(center.x, center.y + 3.5, center.z);
    }

    cameraAnimRef.current = {
      active: true,
      startPos: cameraRef.current.position.clone(),
      endPos,
      startTarget: controlsRef.current.target.clone(),
      endTarget,
      progress: 0,
    };
  };

  // Render 2D Mini-Plan HUD (Picture-in-Picture)
  useEffect(() => {
    if (!showMiniHud || !miniCanvasRef.current || !convertedData) return;
    const cvs = miniCanvasRef.current;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const w = cvs.width = 240;
    const h = cvs.height = 150;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Subtle Grid
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const bounds = convertedData.bounds;
    const maxDim = Math.max(bounds.size.x, bounds.size.z, 20);
    const scale = Math.min(w, h) / (maxDim * 1.35);
    const cx = w / 2;
    const cy = h / 2;

    // Draw 2D elements
    elements.forEach((el) => {
      if (el.points.length < 2) return;
      ctx.beginPath();
      el.points.forEach((p, i) => {
        const sx = cx + (p.x - bounds.center.x) * scale;
        const sy = cy - (p.y - (-bounds.center.z)) * scale;
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      });

      if (el.type === 'building' || el.type === 'boundary') {
        ctx.closePath();
        ctx.fillStyle = el.type === 'building' ? 'rgba(2, 132, 199, 0.35)' : 'rgba(16, 185, 129, 0.15)';
        ctx.fill();
        ctx.strokeStyle = el.type === 'building' ? '#0284c7' : '#10b981';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.strokeStyle = el.type === 'bridge_deck' ? '#0284c7' : '#475569';
        ctx.lineWidth = Math.max((el.width || 10) * scale * 0.8, 2.5);
        ctx.stroke();
      }
    });

    // Draw camera target pin
    if (controlsRef.current) {
      const tx = cx + (controlsRef.current.target.x - bounds.center.x) * scale;
      const ty = cy - (-controlsRef.current.target.z - (-bounds.center.z)) * scale;
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }, [elements, convertedData, showMiniHud]);

  const handleMiniHudClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!miniCanvasRef.current || !convertedData || !cameraRef.current || !controlsRef.current) return;
    const rect = miniCanvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const w = miniCanvasRef.current.width;
    const h = miniCanvasRef.current.height;
    const bounds = convertedData.bounds;
    const maxDim = Math.max(bounds.size.x, bounds.size.z, 20);
    const scale = Math.min(w, h) / (maxDim * 1.35);

    const worldX = (clickX - w / 2) / scale + bounds.center.x;
    const worldZ = -((clickY - h / 2) / scale - (-bounds.center.z));

    const currentPos = cameraRef.current.position;
    const offset = currentPos.clone().sub(controlsRef.current.target);

    const endTarget = new THREE.Vector3(worldX, 0, worldZ);
    const endPos = endTarget.clone().add(offset);

    cameraAnimRef.current = {
      active: true,
      startPos: currentPos.clone(),
      endPos,
      startTarget: controlsRef.current.target.clone(),
      endTarget,
      progress: 0,
    };
  };

  const handleGLTFDownload = async () => {
    if (!modelGroupRef.current) return;
    setIsExporting(true);
    try {
      await exportToGLB(modelGroupRef.current, 'civil-construction-model.glb');
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleScreenshot = () => {
    if (!canvasRef.current) return;
    captureCanvasScreenshot(canvasRef.current, 'civil-3d-model.png');
  };

  const handleSaveComment = () => {
    if (!activePinPrompt || !commentText.trim()) return;
    onAddComment(activePinPrompt, commentText.trim(), authorName.trim() || 'Reviewer');
    setActivePinPrompt(null);
    setCommentText('');
  };

  const focusedElement = convertedData?.elements.find(e => e.id === selectedElementId);

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden bg-slate-100 select-none">
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className={`w-full h-full block ${commentMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      />

      {/* Sleek Floating Layers & Camera Angle Panel in 3D View (Directly solves user's request!) */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2">
        <div className="light-panel rounded-xl shadow-md border border-slate-200 overflow-hidden w-64">
          <div 
            onClick={() => setIsLayersDrawerOpen(!isLayersDrawerOpen)}
            className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>3D Layers & Camera ({elements.length})</span>
            </div>
            {isLayersDrawerOpen ? <ChevronLeft className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
          </div>

          {isLayersDrawerOpen && (
            <div className="p-1.5 max-h-60 overflow-y-auto space-y-1 text-xs">
              <button
                onClick={() => {
                  onSelectElement?.(null);
                  setCameraView('all');
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors ${
                  !selectedElementId ? 'bg-sky-50 text-sky-700 font-bold border border-sky-200' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <Maximize2 className="w-3 h-3 text-sky-600" />
                  <span>Overview (Frame All)</span>
                </span>
              </button>

              {elements.map((elem) => {
                const isSelected = elem.id === selectedElementId;
                const iconMap = {
                  road: '🛣️',
                  bridge_deck: '🌉',
                  building: '🏢',
                  boundary: '📍',
                };
                return (
                  <button
                    key={elem.id}
                    onClick={() => onSelectElement?.(elem.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-all ${
                      isSelected
                        ? 'bg-sky-600 text-white font-bold shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-1">
                      <span className="text-sm shrink-0">{iconMap[elem.type] || '📐'}</span>
                      <span className="truncate">{elem.name}</span>
                    </div>
                    <Focus className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Controls (Add Pin, Preset Views) */}
        <div className="light-panel p-1 rounded-xl flex items-center gap-1 shadow-sm w-fit">
          <button
            onClick={() => {
              setCommentMode(!commentMode);
              setSelectedComment(null);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              commentMode
                ? 'bg-amber-500 text-white animate-pulse'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>{commentMode ? 'Click 3D Surface' : 'Add Pin'}</span>
          </button>

          <div className="h-3.5 w-px bg-slate-200" />

          <button
            onClick={() => setCameraView('iso')}
            className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1"
            title="Isometric 45°"
          >
            <span>Iso 45°</span>
          </button>
          <button
            onClick={() => setCameraView('drone')}
            className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1"
            title="Aerial Drone 65°"
          >
            <span>Drone</span>
          </button>
          <button
            onClick={() => setCameraView('top')}
            className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1"
            title="Top Plan View"
          >
            <span>Top</span>
          </button>
          <button
            onClick={() => setCameraView('eye')}
            className="px-2 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1"
            title="Street Eye-Level"
          >
            <span>Walk</span>
          </button>
        </div>
      </div>

      {/* Top Right: Export Actions */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <button
          onClick={handleScreenshot}
          className="light-panel px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-sm"
          title="Capture PNG Screenshot"
        >
          <Camera className="w-3.5 h-3.5 text-emerald-600" />
          <span>Screenshot</span>
        </button>

        <button
          onClick={handleGLTFDownload}
          disabled={isExporting}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5 transition-all shadow-sm"
          title="Download .glb 3D Model"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isExporting ? 'Exporting...' : 'Export (.glb)'}</span>
        </button>
      </div>

      {/* Focused Element Header Pill */}
      {focusedElement && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 light-panel-glow px-3.5 py-1 rounded-full text-xs font-semibold text-slate-800 flex items-center gap-2 shadow-sm animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-sky-500" />
          <span>{focusedElement.name}</span>
          <span className="text-[10px] font-mono text-slate-400 uppercase">
            ({focusedElement.type} • {focusedElement.elevation}m elev)
          </span>
        </div>
      )}

      {/* Selected Comment Card Detail */}
      {selectedComment && (
        <div className="absolute bottom-5 left-5 z-20 w-80 light-panel-glow p-4 rounded-2xl shadow-xl border border-amber-300 animate-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${selectedComment.status === 'resolved' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-xs font-bold text-slate-800">{selectedComment.author_name}</span>
            </div>
            <button
              onClick={() => setSelectedComment(null)}
              className="text-xs text-slate-400 hover:text-slate-700 p-1"
            >
              ✕
            </button>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed mb-2 font-medium">
            "{selectedComment.text}"
          </p>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-t border-slate-100 pt-1.5">
            <span>Pos: ({selectedComment.position.x}, {selectedComment.position.y}, {selectedComment.position.z})</span>
            <span>{new Date(selectedComment.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      )}

      {/* Active Pin Placement Dialog Modal */}
      {activePinPrompt && (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-sm light-panel p-5 rounded-2xl shadow-2xl border border-sky-300">
            <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              Place 3D Feedback Pin
            </h4>

            <div className="space-y-3 mb-4 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Your Name / Title</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Feedback / Request Note</label>
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="e.g. Verify viaduct drainage slope at pier 4..."
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-sky-500 resize-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setActivePinPrompt(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveComment}
                disabled={!commentText.trim()}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Save Pin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating 2D Site Plan HUD (Picture-in-Picture) */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col items-end gap-2 pointer-events-auto">
        {showMiniHud && (
          <div className="w-64 light-panel-glow p-3 rounded-2xl shadow-xl border border-sky-300 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Compass className="w-3.5 h-3.5 text-sky-600" />
                <span>2D Site Plan HUD</span>
              </div>
              {onSwitchTo2D && (
                <button
                  onClick={onSwitchTo2D}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 hover:bg-sky-100 font-semibold border border-sky-200 transition-colors"
                >
                  Full 2D CAD ↗
                </button>
              )}
            </div>
            <div className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
              <canvas
                ref={miniCanvasRef}
                onClick={handleMiniHudClick}
                className="w-full h-36 block cursor-crosshair"
                title="Click any spot on 2D plan to fly 3D camera there"
              />
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>● Red: Camera Eye</span>
              <span>Click map to re-aim</span>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMiniHud(!showMiniHud)}
            className="light-panel px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 shadow-sm flex items-center gap-1.5 transition-all"
          >
            <Compass className="w-3.5 h-3.5 text-sky-600" />
            <span>{showMiniHud ? 'Hide 2D Plan' : '🗺️ 2D Plan HUD'}</span>
          </button>
          {onSwitchTo2D && (
            <button
              onClick={onSwitchTo2D}
              className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 shadow-sm flex items-center gap-1.5 transition-all"
            >
              <span>📐 2D CAD Canvas</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-3 left-3 z-10 light-panel px-2.5 py-1 rounded-lg text-[10px] font-mono text-slate-400 pointer-events-none flex items-center gap-3 shadow-xs">
        <span>Click layer to zoom · Left drag: Orbit · Right drag: Pan</span>
      </div>
    </div>
  );
};
