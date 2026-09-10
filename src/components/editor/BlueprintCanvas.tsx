import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { BlueprintElement, EditorTool, Point2D, SnapMode } from '../../types';
import { distance, computeMiterOffsets, samplePointsAlongPolyline } from '../../engine/math2d';
import { Check, X, Undo } from 'lucide-react';

interface BlueprintCanvasProps {
  elements: BlueprintElement[];
  activeTool: EditorTool;
  snapMode: SnapMode;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onAddElement: (element: BlueprintElement) => void;
  onUpdateElement: (element: BlueprintElement) => void;
  onDeleteElement: (id: string) => void;
  onFocusElement3D: (id: string) => void;
  scale: number;
  onScaleChange: (scale: number) => void;
}

export const BlueprintCanvas: React.FC<BlueprintCanvasProps> = ({
  elements,
  activeTool,
  snapMode,
  selectedElementId,
  onSelectElement,
  onAddElement,
  onUpdateElement,
  onDeleteElement,
  onFocusElement3D,
  scale,
  onScaleChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Pan offset in screen pixels
  const [offset, setOffset] = useState<Point2D>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point2D>({ x: 0, y: 0 });

  // Currently drafting points buffer
  const [currentPoints, setCurrentPoints] = useState<Point2D[]>([]);
  // Current snapped cursor in world coordinates (meters)
  const [cursorWorld, setCursorWorld] = useState<Point2D>({ x: 0, y: 0 });
  // Dragging existing vertex
  const [draggingVertex, setDraggingVertex] = useState<{ elementId: string; vertexIdx: number } | null>(null);

  // Convert Screen coordinates to World coordinates (Meters)
  const screenToWorld = useCallback((screenX: number, screenY: number): Point2D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    const wx = (screenX - rect.left - cx - offset.x) / scale;
    const wy = (screenY - rect.top - cy - offset.y) / scale;

    return { x: wx, y: wy };
  }, [offset, scale]);

  // Convert World coordinates to Screen coordinates
  const worldToScreen = useCallback((worldX: number, worldY: number): Point2D => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    return {
      x: cx + offset.x + worldX * scale,
      y: cy + offset.y + worldY * scale,
    };
  }, [offset, scale]);

  // Apply snapping logic
  const snapCoordinate = useCallback((pt: Point2D): Point2D => {
    if (snapMode === 'none') return pt;
    const interval = snapMode === '1m' ? 1.0 : 5.0;
    return {
      x: Math.round(pt.x / interval) * interval,
      y: Math.round(pt.y / interval) * interval,
    };
  }, [snapMode]);

  // Finish current drafting sequence
  const commitCurrentDraft = useCallback(() => {
    if (currentPoints.length < 2) {
      setCurrentPoints([]);
      return;
    }

    const id = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    let newElement: BlueprintElement;

    if (activeTool === 'road') {
      newElement = {
        id,
        type: 'road',
        name: `Road Corridor ${elements.filter(e => e.type === 'road').length + 1}`,
        points: currentPoints,
        width: 12,
        elevation: 0,
        material_label: 'asphalt',
      };
    } else if (activeTool === 'bridge_deck') {
      newElement = {
        id,
        type: 'bridge_deck',
        name: `Viaduct Overpass ${elements.filter(e => e.type === 'bridge_deck').length + 1}`,
        points: currentPoints,
        width: 14,
        elevation: 10,
        height: 1.4,
        pier_spacing: 25,
        material_label: 'reinforced_concrete',
      };
    } else if (activeTool === 'building') {
      newElement = {
        id,
        type: 'building',
        name: `Building Structure ${elements.filter(e => e.type === 'building').length + 1}`,
        points: currentPoints,
        height: 18,
        elevation: 0,
        material_label: 'glass_curtain_wall',
        metadata: { color: '#0284c7' },
      };
    } else if (activeTool === 'boundary') {
      newElement = {
        id,
        type: 'boundary',
        name: `Plot Boundary ${elements.filter(e => e.type === 'boundary').length + 1}`,
        points: currentPoints,
        elevation: 0,
        material_label: 'property_line',
      };
    } else {
      setCurrentPoints([]);
      return;
    }

    onAddElement(newElement);
    setCurrentPoints([]);
    onSelectElement(newElement.id);
    onFocusElement3D(newElement.id);
  }, [activeTool, currentPoints, elements, onAddElement, onSelectElement, onFocusElement3D]);

  // Cancel/Clear in-progress drawing
  const cancelCurrentDraft = useCallback(() => {
    setCurrentPoints([]);
  }, []);

  // Undo last drafted point
  const undoLastDraftPoint = useCallback(() => {
    setCurrentPoints(prev => prev.slice(0, -1));
  }, []);

  // Double Click to complete shape
  const handleDoubleClick = () => {
    if (activeTool !== 'select') {
      commitCurrentDraft();
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelCurrentDraft();
      } else if (e.key === 'Enter') {
        commitCurrentDraft();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // If not typing in an input
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          if (currentPoints.length > 0) {
            undoLastDraftPoint();
          } else if (selectedElementId) {
            onDeleteElement(selectedElementId);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commitCurrentDraft, cancelCurrentDraft, undoLastDraftPoint, currentPoints.length, selectedElementId, onDeleteElement]);

  // Main Render Loop for HTML5 Canvas (Light Architectural Theme)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || window.innerWidth;
    const height = canvas.parentElement?.clientHeight || window.innerHeight;

    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    // 1. Clear with crisp light architectural canvas background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2 + offset.x;
    const cy = height / 2 + offset.y;

    // 2. Draw Crisp Architectural Grid
    const gridSizeMajor = 50 * scale; // 50m major grid
    const gridSizeMinor = 10 * scale; // 10m minor grid

    if (gridSizeMinor > 5) {
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      const startX = cx % gridSizeMinor;
      const startY = cy % gridSizeMinor;

      ctx.beginPath();
      for (let x = startX; x < width; x += gridSizeMinor) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = startY; y < height; y += gridSizeMinor) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    if (gridSizeMajor > 20) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.2;
      const startX = cx % gridSizeMajor;
      const startY = cy % gridSizeMajor;

      ctx.beginPath();
      for (let x = startX; x < width; x += gridSizeMajor) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = startY; y < height; y += gridSizeMajor) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    // Origin crosshair (0,0)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy);
    ctx.lineTo(cx + 15, cy);
    ctx.moveTo(cx, cy - 15);
    ctx.lineTo(cx, cy + 15);
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillText('(0, 0)', cx + 6, cy - 6);

    // 3. Render Committed Elements
    elements.forEach((elem) => {
      const isSelected = elem.id === selectedElementId;
      const pts = elem.points;
      if (!pts || pts.length === 0) return;

      const screenPts = pts.map(p => worldToScreen(p.x, p.y));

      // Draw Roads & Bridges
      if (elem.type === 'road' || elem.type === 'bridge_deck') {
        const halfWidth = (elem.width || 10) / 2;
        const { left, right } = computeMiterOffsets(pts, halfWidth);

        if (left.length >= 2) {
          ctx.beginPath();
          const sLeft0 = worldToScreen(left[0].x, left[0].y);
          ctx.moveTo(sLeft0.x, sLeft0.y);
          for (let i = 1; i < left.length; i++) {
            const sp = worldToScreen(left[i].x, left[i].y);
            ctx.lineTo(sp.x, sp.y);
          }
          for (let i = right.length - 1; i >= 0; i--) {
            const sp = worldToScreen(right[i].x, right[i].y);
            ctx.lineTo(sp.x, sp.y);
          }
          ctx.closePath();

          // High-contrast clean colors
          ctx.fillStyle = elem.type === 'road' ? '#e2e8f0' : '#e0f2fe';
          ctx.fill();

          ctx.strokeStyle = isSelected ? '#0284c7' : (elem.type === 'road' ? '#475569' : '#0284c7');
          ctx.lineWidth = isSelected ? 3 : 1.8;
          ctx.stroke();

          // Centerline
          ctx.beginPath();
          ctx.setLineDash(elem.type === 'road' ? [6, 6] : [10, 5]);
          ctx.strokeStyle = elem.type === 'road' ? '#94a3b8' : '#0284c7';
          ctx.lineWidth = 1.5;
          ctx.moveTo(screenPts[0].x, screenPts[0].y);
          for (let i = 1; i < screenPts.length; i++) {
            ctx.lineTo(screenPts[i].x, screenPts[i].y);
          }
          ctx.stroke();
          ctx.setLineDash([]);

          // Bridge Pier Markers
          if (elem.type === 'bridge_deck' && elem.pier_spacing) {
            const sampled = samplePointsAlongPolyline(pts, elem.pier_spacing, elem.pier_spacing * 0.7);
            sampled.forEach((sp) => {
              const pScr = worldToScreen(sp.point.x, sp.point.y);
              ctx.fillStyle = '#f59e0b';
              ctx.beginPath();
              ctx.arc(pScr.x, pScr.y, 4.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.stroke();
            });
          }
        }
      } else if (elem.type === 'building') {
        if (screenPts.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(screenPts[0].x, screenPts[0].y);
          for (let i = 1; i < screenPts.length; i++) {
            ctx.lineTo(screenPts[i].x, screenPts[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = elem.metadata?.color ? `${elem.metadata.color}25` : 'rgba(2, 132, 199, 0.18)';
          ctx.fill();

          ctx.strokeStyle = isSelected ? '#0284c7' : (elem.metadata?.color || '#0284c7');
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.stroke();

          const centerPt = screenPts[0];
          ctx.fillStyle = '#1e293b';
          ctx.font = 'bold 11px Inter, sans-serif';
          ctx.fillText(`🏢 ${elem.name || 'Building'} (${elem.height || 15}m)`, centerPt.x + 8, centerPt.y - 8);
        }
      } else if (elem.type === 'boundary') {
        if (screenPts.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(screenPts[0].x, screenPts[0].y);
          for (let i = 1; i < screenPts.length; i++) {
            ctx.lineTo(screenPts[i].x, screenPts[i].y);
          }
          ctx.closePath();
          ctx.fillStyle = 'rgba(14, 165, 233, 0.06)';
          ctx.fill();

          ctx.setLineDash([8, 4]);
          ctx.strokeStyle = isSelected ? '#0284c7' : '#0ea5e9';
          ctx.lineWidth = isSelected ? 3 : 1.5;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Draw vertex handles when selected
      if (isSelected) {
        screenPts.forEach((sp) => {
          ctx.fillStyle = '#0284c7';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
    });

    // 4. Render Active Drafting In-Progress Shape
    if (currentPoints.length > 0) {
      const allDraftPts = [...currentPoints, cursorWorld];
      const draftScreenPts = allDraftPts.map(p => worldToScreen(p.x, p.y));

      ctx.beginPath();
      ctx.moveTo(draftScreenPts[0].x, draftScreenPts[0].y);
      for (let i = 1; i < draftScreenPts.length; i++) {
        ctx.lineTo(draftScreenPts[i].x, draftScreenPts[i].y);
      }
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      draftScreenPts.forEach((sp, idx) => {
        ctx.fillStyle = idx === draftScreenPts.length - 1 ? '#f59e0b' : '#0284c7';
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Segment measurement callout
      if (currentPoints.length >= 1) {
        const lastPt = currentPoints[currentPoints.length - 1];
        const segDist = distance(lastPt, cursorWorld);
        const midWorld: Point2D = {
          x: (lastPt.x + cursorWorld.x) / 2,
          y: (lastPt.y + cursorWorld.y) / 2,
        };
        const midScr = worldToScreen(midWorld.x, midWorld.y);

        ctx.fillStyle = '#ffffff';
        const labelText = `${segDist.toFixed(1)} m`;
        ctx.font = 'bold 11px JetBrains Mono, monospace';
        const txtWidth = ctx.measureText(labelText).width;
        ctx.fillRect(midScr.x - txtWidth / 2 - 5, midScr.y - 12, txtWidth + 10, 20);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(midScr.x - txtWidth / 2 - 5, midScr.y - 12, txtWidth + 10, 20);

        ctx.fillStyle = '#0284c7';
        ctx.fillText(labelText, midScr.x - txtWidth / 2, midScr.y + 2);
      }
    }

    // 5. Render Snapped Cursor Reticle
    const curScr = worldToScreen(cursorWorld.x, cursorWorld.y);
    ctx.strokeStyle = 'rgba(2, 132, 199, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(curScr.x, curScr.y, 6, 0, Math.PI * 2);
    ctx.moveTo(curScr.x - 10, curScr.y);
    ctx.lineTo(curScr.x + 10, curScr.y);
    ctx.moveTo(curScr.x, curScr.y - 10);
    ctx.lineTo(curScr.x, curScr.y + 10);
    ctx.stroke();

    ctx.restore();
  }, [
    elements,
    offset,
    scale,
    selectedElementId,
    currentPoints,
    cursorWorld,
    activeTool,
    worldToScreen,
  ]);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Middle click or Space/Shift or Select tool => Pan or Select
    if (e.button === 1 || e.shiftKey || (activeTool === 'select' && e.button === 0 && !e.altKey)) {
      const wPt = screenToWorld(e.clientX, e.clientY);
      let clickedElementId: string | null = null;
      let clickedVertex: { elementId: string; vertexIdx: number } | null = null;

      elements.forEach((elem) => {
        elem.points.forEach((pt, idx) => {
          if (distance(pt, wPt) < 6 / scale) {
            clickedVertex = { elementId: elem.id, vertexIdx: idx };
            clickedElementId = elem.id;
          }
        });
        if (!clickedElementId && elem.points.length > 0) {
          for (let i = 0; i < elem.points.length - 1; i++) {
            const p1 = elem.points[i];
            const p2 = elem.points[i + 1];
            const d = distance(p1, wPt) + distance(p2, wPt) - distance(p1, p2);
            if (d < 2.5) {
              clickedElementId = elem.id;
            }
          }
        }
      });

      if (clickedVertex) {
        setDraggingVertex(clickedVertex);
        onSelectElement(clickedElementId);
        if (clickedElementId) onFocusElement3D(clickedElementId);
        return;
      }

      if (clickedElementId) {
        onSelectElement(clickedElementId);
        onFocusElement3D(clickedElementId);
        return;
      }

      // Default to canvas pan
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      return;
    }

    // Active drawing mode
    if (activeTool !== 'select' && e.button === 0) {
      const snapped = snapCoordinate(screenToWorld(e.clientX, e.clientY));
      if (currentPoints.length >= 3 && distance(currentPoints[0], snapped) < 4) {
        commitCurrentDraft();
      } else {
        setCurrentPoints([...currentPoints, snapped]);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rawWorld = screenToWorld(e.clientX, e.clientY);
    const snapped = snapCoordinate(rawWorld);
    setCursorWorld(snapped);

    if (isPanning) {
      setOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    } else if (draggingVertex) {
      const targetElem = elements.find(el => el.id === draggingVertex.elementId);
      if (targetElem) {
        const newPts = [...targetElem.points];
        newPts[draggingVertex.vertexIdx] = snapped;
        onUpdateElement({
          ...targetElem,
          points: newPts,
        });
      }
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
    setDraggingVertex(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newScale = Math.min(Math.max(scale * zoomFactor, 0.2), 10.0);
    onScaleChange(newScale);
  };

  return (
    <div className="relative w-full h-full overflow-hidden bg-white cursor-crosshair select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        className="block w-full h-full"
      />

      {/* Prominent Active Drafting Action Bar at bottom center (Guarantees zero collision!) */}
      {currentPoints.length > 0 && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 light-panel-glow px-4 py-2 rounded-2xl shadow-xl border border-sky-400 flex items-center gap-3 animate-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-800">
              Drafting {activeTool.replace('_', ' ')}: <strong className="text-sky-600 font-mono">{currentPoints.length} pts</strong>
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200" />

          {/* Finish Button */}
          <button
            onClick={commitCurrentDraft}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all"
            title="Complete drawing and generate 3D model (Enter)"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Finish Shape</span>
          </button>

          {/* Undo Point */}
          <button
            onClick={undoLastDraftPoint}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors"
            title="Undo last point (Backspace)"
          >
            <Undo className="w-3.5 h-3.5" />
            <span>Undo Pt</span>
          </button>

          {/* Cancel/Discard */}
          <button
            onClick={cancelCurrentDraft}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-medium transition-colors"
            title="Cancel and discard active drawing (Escape)"
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancel</span>
          </button>
        </div>
      )}

      {/* Bottom Coordinates & Scale Bar */}
      <div className="absolute bottom-3 left-3 z-10 light-panel px-3 py-1 rounded-lg flex items-center gap-3 text-xs font-mono text-slate-500 pointer-events-none shadow-xs">
        <div>X: <span className="text-sky-700 font-semibold">{cursorWorld.x.toFixed(1)}m</span></div>
        <div>Y: <span className="text-sky-700 font-semibold">{cursorWorld.y.toFixed(1)}m</span></div>
        <div className="h-3 w-px bg-slate-200" />
        <div>Scale: <span className="text-slate-700 font-medium">1px = {(1 / scale).toFixed(2)}m</span></div>
      </div>
    </div>
  );
};
