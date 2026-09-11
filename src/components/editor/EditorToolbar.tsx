import React, { useState } from 'react';
import type { EditorTool, SnapMode } from '../../types';
import { 
  MousePointer, 
  Grid3X3, 
  Undo2, 
  Redo2, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw,
  ChevronDown
} from 'lucide-react';

interface EditorToolbarProps {
  activeTool: EditorTool;
  onSelectTool: (tool: EditorTool) => void;
  snapMode: SnapMode;
  onToggleSnap: (mode: SnapMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onDeleteSelected: () => void;
  hasSelection: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  currentScale: number;
  showStreetMap?: boolean;
  onToggleStreetMap?: () => void;
  streetMapAvailable?: boolean;
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  activeTool,
  onSelectTool,
  snapMode,
  onToggleSnap,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onDeleteSelected,
  hasSelection,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  currentScale,
  showStreetMap = true,
  onToggleStreetMap,
  streetMapAvailable = false,
}) => {
  const [isToolDropdownOpen, setIsToolDropdownOpen] = useState(false);

  const drawTools: { id: EditorTool; label: string; icon: string; category: string; desc: string }[] = [
    { id: 'road', label: 'Road Corridor', icon: '🛣️', category: 'Infrastructure', desc: 'Polyline corridor with lanes' },
    { id: 'bridge_deck', label: 'Bridge Viaduct', icon: '🌉', category: 'Infrastructure', desc: 'Elevated spans & piers' },
    { id: 'electric_pole', label: 'Electric Utility Pole', icon: '⚡', category: 'Infrastructure', desc: 'Power poles & wires' },
    { id: 'building', label: 'Building Block', icon: '🏢', category: 'Structures', desc: 'Extruded building footprint' },
    { id: 'stadium', label: 'Stadium Arena', icon: '🏟️', category: 'Structures', desc: 'Grandstands, pitch & roof' },
    { id: 'crane', label: 'Tower Crane', icon: '🏗️', category: 'Logistics', desc: 'Lattice mast, jib & hoist' },
    { id: 'water_pool', label: 'Water Pool / Basin', icon: '💧', category: 'Environment', desc: 'Aquatic basin & fountain' },
    { id: 'boundary', label: 'Site Boundary', icon: '📍', category: 'Site', desc: 'Survey boundary polygon' },
  ];

  const activeDrawTool = drawTools.find(t => t.id === activeTool);
  const snapOptions: SnapMode[] = ['none', '1m', '5m'];

  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-auto">
      {/* Primary Drafting Tools Panel with Dropdown */}
      <div className="light-panel p-1 rounded-xl flex items-center gap-1 shadow-sm">
        {/* Quick Select & Move */}
        <button
          onClick={() => {
            onSelectTool('select');
            setIsToolDropdownOpen(false);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeTool === 'select'
              ? 'bg-sky-600 text-white shadow-sm font-semibold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          title="Select & Move elements"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span>Select</span>
        </button>

        {/* Add Element Tool Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsToolDropdownOpen(!isToolDropdownOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTool !== 'select'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
            title="Choose drawing element tool"
          >
            <span>{activeDrawTool ? activeDrawTool.icon : '✏️'}</span>
            <span>{activeDrawTool ? activeDrawTool.label : 'Add Element'}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isToolDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {isToolDropdownOpen && (
            <div className="absolute top-full mt-1.5 left-0 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Draft 2D & 3D Element
              </div>
              <div className="max-h-72 overflow-y-auto space-y-0.5 mt-1">
                {drawTools.map((tool) => {
                  const isCur = activeTool === tool.id;
                  return (
                    <button
                      key={tool.id}
                      onClick={() => {
                        onSelectTool(tool.id);
                        setIsToolDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-colors ${
                        isCur
                          ? 'bg-sky-50 text-sky-800 font-bold border border-sky-200'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-base shrink-0">{tool.icon}</span>
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold">{tool.label}</span>
                        <span className="text-[10px] text-slate-400 truncate">{tool.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        {/* Snapping Control */}
        <div className="flex items-center bg-slate-50 rounded-lg p-0.5 border border-slate-200">
          <span className="text-[10px] text-slate-500 pl-1.5 pr-1 flex items-center gap-1 font-mono font-medium">
            <Grid3X3 className="w-3 h-3 text-sky-600" />
            Snap:
          </span>
          {snapOptions.map((s) => (
            <button
              key={s}
              onClick={() => onToggleSnap(s)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                snapMode === s
                  ? 'bg-sky-600 text-white font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Auxiliary Actions (Undo, Redo, Delete, Zoom) */}
      <div className="light-panel p-1 rounded-xl flex items-center gap-0.5 shadow-sm">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

        <button
          onClick={onDeleteSelected}
          disabled={!hasSelection}
          className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
          title="Delete selected element (Delete/Backspace)"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

        <button
          onClick={onZoomOut}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono text-slate-500 min-w-[36px] text-center">
          {Math.round(currentScale * 100)}%
        </span>
        <button
          onClick={onZoomIn}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onResetZoom}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Reset Zoom"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {streetMapAvailable && (
          <>
            <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
            <button
              onClick={onToggleStreetMap}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                showStreetMap
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Toggle Reference Street Map Underlay (Streets, Intersections & Buildings)"
            >
              <span>{showStreetMap ? '🗺️ Street Map ON' : '🗺️ Street Map OFF'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
