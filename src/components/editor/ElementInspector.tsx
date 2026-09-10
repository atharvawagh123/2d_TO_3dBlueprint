import React from 'react';
import type { BlueprintElement } from '../../types';
import { polylineLength, polygonArea } from '../../engine/math2d';
import { Sliders, Layers, Ruler, ArrowUpFromLine, Trash2, X, Eye } from 'lucide-react';

interface ElementInspectorProps {
  element: BlueprintElement | null;
  onUpdateElement: (updated: BlueprintElement) => void;
  onDeleteElement: (id: string) => void;
  onFocusElement3D?: (id: string) => void;
  onClose: () => void;
}

export const ElementInspector: React.FC<ElementInspectorProps> = ({
  element,
  onUpdateElement,
  onDeleteElement,
  onFocusElement3D,
  onClose,
}) => {
  if (!element) return null;

  const isRoadOrBridge = element.type === 'road' || element.type === 'bridge_deck';
  const isBridge = element.type === 'bridge_deck';
  const isBuilding = element.type === 'building';

  const handleChange = (field: keyof BlueprintElement, value: string | number) => {
    onUpdateElement({
      ...element,
      [field]: value,
    });
  };

  const handleMetadataColorChange = (color: string) => {
    onUpdateElement({
      ...element,
      metadata: {
        ...element.metadata,
        color,
      },
    });
  };

  const materialSuggestions = [
    'asphalt',
    'reinforced_concrete',
    'structural_steel',
    'glass_curtain_wall',
    'masonry',
    'precast_concrete',
    'gravel_subbase',
  ];

  // Calculated dimension metric
  let metricSummary = '';
  if (isRoadOrBridge) {
    const len = Math.round(polylineLength(element.points));
    const area = Math.round(len * (element.width || 10));
    metricSummary = `${len}m length • ${area}m² pavement surface`;
  } else if (isBuilding) {
    const area = Math.round(Math.abs(polygonArea(element.points)));
    const vol = Math.round(area * (element.height || 15));
    metricSummary = `${area}m² footprint • ${vol}m³ volume`;
  }

  return (
    <aside className="w-80 h-full bg-white border-l border-slate-200 flex flex-col z-20 shadow-lg select-none animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-sky-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Element Properties
          </span>
        </div>
        <div className="flex items-center gap-1">
          {onFocusElement3D && (
            <button
              onClick={() => onFocusElement3D(element.id)}
              className="p-1 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-slate-100 transition-colors"
              title="Zoom to element in 3D"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close Inspector"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Form Fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Metric Overview Callout */}
        {metricSummary && (
          <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-100 text-sky-800 font-mono text-[11px] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
            <span>{metricSummary}</span>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-slate-500 font-medium mb-1">
            Element Identifier
          </label>
          <input
            type="text"
            value={element.name || ''}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="e.g. North Ramp Overpass"
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 transition-all font-medium"
          />
        </div>

        {/* Type Badge */}
        <div className="flex items-center justify-between py-1 border-y border-slate-100">
          <span className="text-slate-500">Geometry Type</span>
          <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase font-semibold text-[10px]">
            {element.type.replace('_', ' ')}
          </span>
        </div>

        {/* Width (Meters) */}
        {isRoadOrBridge && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 font-medium flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 text-sky-600" />
                Cross-Section Width
              </label>
              <span className="font-mono text-sky-600 font-bold">
                {element.width ?? 10} m
              </span>
            </div>
            <input
              type="number"
              min={2}
              max={60}
              step={0.5}
              value={element.width ?? 10}
              onChange={(e) => handleChange('width', parseFloat(e.target.value) || 2)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 font-mono transition-all"
            />
          </div>
        )}

        {/* Height (Meters) */}
        {(isBuilding || isBridge) && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 font-medium flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-amber-500" />
                {isBridge ? 'Deck Slab Thickness' : 'Building Height'}
              </label>
              <span className="font-mono text-amber-600 font-bold">
                {element.height ?? (isBridge ? 1.4 : 15)} m
              </span>
            </div>
            <input
              type="number"
              min={0.5}
              max={250}
              step={isBridge ? 0.2 : 1}
              value={element.height ?? (isBridge ? 1.4 : 15)}
              onChange={(e) => handleChange('height', parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 font-mono transition-all"
            />
          </div>
        )}

        {/* Base Elevation Clearance */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-slate-600 font-medium flex items-center gap-1">
              <ArrowUpFromLine className="w-3.5 h-3.5 text-emerald-600" />
              Base Elevation (Clearance)
            </label>
            <span className="font-mono text-emerald-600 font-bold">
              {element.elevation ?? 0} m
            </span>
          </div>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={element.elevation ?? 0}
            onChange={(e) => handleChange('elevation', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 font-mono transition-all"
          />
        </div>

        {/* Pier Spacing (Bridge Only) */}
        {isBridge && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-600 font-medium">
                Support Pier Interval
              </label>
              <span className="font-mono text-indigo-600 font-bold">
                {element.pier_spacing ?? 25} m
              </span>
            </div>
            <input
              type="number"
              min={5}
              max={100}
              step={1}
              value={element.pier_spacing ?? 25}
              onChange={(e) => handleChange('pier_spacing', parseFloat(e.target.value) || 20)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 font-mono transition-all"
            />
          </div>
        )}

        {/* Material Classification */}
        <div>
          <label className="block text-slate-600 font-medium mb-1">
            Material Specification (BIM / Cost Label)
          </label>
          <input
            type="text"
            list="materials-list"
            value={element.material_label || ''}
            onChange={(e) => handleChange('material_label', e.target.value)}
            placeholder="Select or enter material..."
            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-sky-500 transition-all font-medium"
          />
          <datalist id="materials-list">
            {materialSuggestions.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        {/* Facade Color */}
        {isBuilding && (
          <div>
            <label className="block text-slate-600 font-medium mb-1.5">
              Facade Glass/Wall Color
            </label>
            <div className="flex items-center gap-2">
              {['#0284c7', '#475569', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'].map((col) => (
                <button
                  key={col}
                  onClick={() => handleMetadataColorChange(col)}
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    element.metadata?.color === col ? 'border-slate-800 scale-110 shadow' : 'border-white'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Delete Element Button */}
      <div className="p-3 border-t border-slate-200 bg-slate-50">
        <button
          onClick={() => onDeleteElement(element.id)}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 hover:border-red-600 transition-all shadow-xs"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Delete Element
        </button>
      </div>
    </aside>
  );
};
