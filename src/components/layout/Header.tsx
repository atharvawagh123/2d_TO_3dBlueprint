import React from 'react';
import type { Project, BlueprintVersion } from '../../types';
import { 
  Box, 
  GitBranch, 
  Share2, 
  FolderKanban, 
  Compass, 
  CheckCircle2, 
  Sparkles,
  ChevronDown,
  Globe
} from 'lucide-react';

export type AppViewMode = 'map' | 'editor2d' | 'viewer3d';

interface HeaderProps {
  currentProject: Project;
  currentVersion: BlueprintVersion;
  viewMode: AppViewMode;
  onChangeViewMode: (mode: AppViewMode) => void;
  onOpenProjectModal: () => void;
  onOpenVersionModal: () => void;
  onOpenShareModal: () => void;
  onCommitNewVersion: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentProject,
  currentVersion,
  viewMode,
  onChangeViewMode,
  onOpenProjectModal,
  onOpenVersionModal,
  onOpenShareModal,
  onCommitNewVersion,
}) => {
  return (
    <header className="h-13 border-b border-slate-200 bg-white px-4 flex items-center justify-between z-30 select-none shadow-xs">
      {/* Brand & Project Switcher */}
      <div className="flex items-center gap-3">
        {/* Brand Icon & Name */}
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
          <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center shadow-xs">
            <Box className="w-4 h-4 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-wider uppercase text-slate-900 flex items-center gap-1.5">
              <span>AURA 3D</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200">
                CIVIL
              </span>
            </div>
          </div>
        </div>

        {/* Current Project Selector Pill */}
        <button
          onClick={onOpenProjectModal}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all"
        >
          <FolderKanban className="w-3.5 h-3.5 text-sky-600 shrink-0" />
          <div className="flex flex-col">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-slate-800 max-w-[180px] truncate">
                {currentProject.name}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
            <span className="text-[10px] text-slate-500 font-mono capitalize">
              {currentProject.type} · {currentProject.location}
            </span>
          </div>
        </button>

        {/* Blueprint Version Pill */}
        <div className="flex items-center gap-1">
          <button
            onClick={onOpenVersionModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-sky-400 text-xs font-mono text-slate-700 hover:text-slate-900 transition-all"
            title="Browse or compare blueprint versions"
          >
            <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
            <span className="font-semibold">v{currentVersion.version_no}.0</span>
            <span className="text-[10px] text-slate-400">({currentVersion.elements.length} items)</span>
          </button>

          <button
            onClick={onCommitNewVersion}
            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-sky-400 text-slate-500 hover:text-sky-600 transition-colors"
            title="Commit current blueprint as a new revision"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Central View Mode Switcher */}
      <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-xs">
        <button
          onClick={() => onChangeViewMode('map')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewMode === 'map'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Globe className="w-3.5 h-3.5 text-emerald-600" />
          <span>GIS Site Map</span>
        </button>

        <button
          onClick={() => onChangeViewMode('editor2d')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewMode === 'editor2d'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Compass className="w-3.5 h-3.5 text-sky-600" />
          <span>2D CAD Blueprint</span>
        </button>

        <button
          onClick={() => onChangeViewMode('viewer3d')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            viewMode === 'viewer3d'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>3D Digital Twin</span>
        </button>
      </div>

      {/* Right Controls: Share Link & User Role */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenShareModal}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-xs transition-all active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Share Client Link</span>
        </button>

        <div className="flex items-center gap-2 pl-3 border-l border-slate-200">
          <div className="w-7 h-7 rounded-full bg-sky-50 border border-sky-200 flex items-center justify-center text-xs font-bold text-sky-700">
            LE
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold text-slate-800 leading-tight">Lead Engineer</div>
            <div className="text-[10px] text-emerald-600 font-medium">Civil CAD Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
};
