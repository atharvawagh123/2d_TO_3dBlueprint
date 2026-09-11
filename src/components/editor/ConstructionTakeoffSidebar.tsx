import React from 'react';
import type { BlueprintElement } from '../../types';
import { polylineLength, polygonArea } from '../../engine/math2d';
import { 
  Building2, 
  Trash2, 
  Eye, 
  Layers, 
  Ruler, 
  HardHat, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp
} from 'lucide-react';

interface ConstructionTakeoffSidebarProps {
  elements: BlueprintElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onDeleteElement: (id: string) => void;
  onFocusElement3D: (id: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const ConstructionTakeoffSidebar: React.FC<ConstructionTakeoffSidebarProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onDeleteElement,
  onFocusElement3D,
  isOpen,
  onToggleOpen,
}) => {
  // Compute real-world contractor quantity takeoffs
  let totalRoadLength = 0;
  let totalRoadArea = 0;
  let totalBridgeLength = 0;
  let totalBridgeArea = 0;
  let totalPierCount = 0;
  let totalBuildingFootprint = 0;
  let totalBuildingVolume = 0;

  elements.forEach((elem) => {
    if (elem.type === 'road') {
      const len = polylineLength(elem.points);
      totalRoadLength += len;
      totalRoadArea += len * (elem.width || 10);
    } else if (elem.type === 'bridge_deck') {
      const len = polylineLength(elem.points);
      totalBridgeLength += len;
      totalBridgeArea += len * (elem.width || 12);
      const spacing = elem.pier_spacing || 25;
      if (spacing > 0 && len > spacing) {
        // 2 columns per pier location
        totalPierCount += Math.floor(len / spacing) * 2;
      }
    } else if (elem.type === 'building') {
      const area = Math.abs(polygonArea(elem.points));
      totalBuildingFootprint += area;
      totalBuildingVolume += area * (elem.height || 15);
    }
  });

  const [showQuantities, setShowQuantities] = React.useState(true);

  if (!isOpen) {
    return (
      <button
        onClick={onToggleOpen}
        className="absolute top-16 left-3 z-20 p-2.5 bg-white border border-slate-200 rounded-xl shadow-md hover:bg-slate-50 text-slate-600 hover:text-sky-600 transition-all flex items-center gap-1.5 text-xs font-semibold"
        title="Open Construction Takeoffs & Elements Manager"
      >
        <HardHat className="w-4 h-4 text-sky-600" />
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    );
  }

  return (
    <aside className="w-72 h-full bg-white border-r border-slate-200 flex flex-col z-20 select-none shadow-sm animate-in slide-in-from-left-4 duration-200">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-sky-50 rounded-lg text-sky-600 border border-sky-100">
            <HardHat className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Civil Takeoffs
            </h3>
            <span className="text-[10px] text-slate-400 font-medium">Quantities & Elements</span>
          </div>
        </div>
        <button
          onClick={onToggleOpen}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
          title="Collapse Panel"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Contractor Quantities Summary Card */}
      <div className="border-b border-slate-100 bg-gradient-to-b from-sky-50/40 to-transparent">
        <div 
          onClick={() => setShowQuantities(!showQuantities)}
          className="p-3 flex items-center justify-between cursor-pointer hover:bg-sky-50/60 transition-colors text-[11px] font-bold text-slate-700"
        >
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-sky-600" />
            <span>Material Quantities</span>
          </div>
          <span className="text-[10px] text-slate-400 font-normal">
            {showQuantities ? 'Hide ▲' : 'Show ▼'}
          </span>
        </div>

        {showQuantities && (
          <div className="px-3 pb-3 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
            <div className="text-[10px] text-slate-400 font-medium">Road Pavement</div>
            <div className="text-xs font-bold font-mono text-slate-800 mt-0.5">
              {Math.round(totalRoadArea).toLocaleString()} m²
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {Math.round(totalRoadLength)}m linear
            </div>
          </div>

          <div className="p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs">
            <div className="text-[10px] text-slate-400 font-medium">Bridge Deck</div>
            <div className="text-xs font-bold font-mono text-sky-700 mt-0.5">
              {Math.round(totalBridgeArea).toLocaleString()} m²
            </div>
            <div className="text-[10px] text-slate-500 font-mono">
              {totalPierCount} pier columns
            </div>
          </div>

          <div className="col-span-2 p-2 rounded-lg bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-medium">Building Footprint / Volume</div>
              <div className="text-xs font-bold font-mono text-slate-800 mt-0.5">
                {Math.round(totalBuildingFootprint).toLocaleString()} m² · {Math.round(totalBuildingVolume).toLocaleString()} m³
              </div>
            </div>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
        </div>
      )}
    </div>

      {/* Layer Elements List with Instant Delete */}
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        <div className="flex items-center justify-between px-1 mb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" />
            Drawn Elements ({elements.length})
          </span>
        </div>

        {elements.length === 0 ? (
          <div className="py-8 px-4 text-center text-slate-400 text-xs">
            <p className="font-medium">No elements drawn yet</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Select Road, Bridge, or Building from the top toolbar to start drafting.
            </p>
          </div>
        ) : (
          elements.map((elem) => {
            const isSelected = elem.id === selectedElementId;
            let dimensionLabel = '';
            if (elem.type === 'road' || elem.type === 'bridge_deck') {
              dimensionLabel = `${Math.round(polylineLength(elem.points))}m • ${elem.width || 10}m W`;
            } else if (elem.type === 'building') {
              dimensionLabel = `${elem.height || 15}m H • ${Math.round(Math.abs(polygonArea(elem.points)))}m²`;
            } else {
              dimensionLabel = `${Math.round(Math.abs(polygonArea(elem.points)))}m² plot`;
            }

            const groundIcon = elem.metadata?.groundType === 'water' ? '💧' : (elem.metadata?.groundType === 'parking' ? '🅿️' : (elem.metadata?.groundType === 'plaza' ? '🏛️' : '🌳'));
            const iconMap: Record<string, string> = {
              road: '🛣️',
              bridge_deck: '🌉',
              building: '🏢',
              boundary: '📍',
              ground: groundIcon,
            };

            return (
              <div
                key={elem.id}
                onClick={() => {
                  onSelectElement(elem.id);
                  onFocusElement3D(elem.id);
                }}
                className={`group p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                  isSelected
                    ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-300 shadow-xs'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 pr-1">
                  <span className="text-base shrink-0">{iconMap[elem.type] || '📐'}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {elem.name || 'Unnamed Element'}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                      <Ruler className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span className="truncate">{dimensionLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Focus in 3D */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectElement(elem.id);
                      onFocusElement3D(elem.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-100/60 transition-colors"
                    title="Zoom to this element in 3D"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Instant Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteElement(elem.id);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete this element"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Hint */}
      <div className="p-2.5 border-t border-slate-200 bg-slate-50 text-center text-[10px] text-slate-400">
        Click any element to highlight & zoom in 3D.
      </div>
    </aside>
  );
};
