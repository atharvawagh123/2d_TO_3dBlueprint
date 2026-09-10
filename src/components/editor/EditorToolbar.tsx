import React from 'react';
import type { EditorTool, SnapMode } from '../../types';
import { 
  MousePointer, 
  Milestone, 
  Building2, 
  MapPin, 
  Grid3X3, 
  Undo2, 
  Redo2, 
  Trash2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw
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
}) => {
  const tools: { id: EditorTool; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: 'Select & Move', icon: <MousePointer className="w-3.5 h-3.5" /> },
    { id: 'road', label: 'Draw Road', icon: <Milestone className="w-3.5 h-3.5" /> },
    { id: 'bridge_deck', label: 'Bridge Viaduct', icon: <span className="text-xs">🌉</span> },
    { id: 'building', label: 'Building', icon: <Building2 className="w-3.5 h-3.5" /> },
    { id: 'boundary', label: 'Boundary', icon: <MapPin className="w-3.5 h-3.5" /> },
  ];

  const snapOptions: SnapMode[] = ['none', '1m', '5m'];

  return (
    <div className="absolute top-3 left-3 z-20 flex items-center gap-2 pointer-events-auto">
      {/* Primary Drafting Tools Panel */}
      <div className="light-panel p-1 rounded-xl flex items-center gap-1 shadow-sm">
        {tools.map((t) => {
          const isActive = activeTool === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTool(t.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-sky-600 text-white shadow-sm font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title={t.label}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          );
        })}

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
      </div>
    </div>
  );
};
