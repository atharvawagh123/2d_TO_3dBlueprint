import React, { useState } from 'react';
import type { Project, BlueprintVersion, Comment, Vector3D } from '../../types';
import { ThreeCanvas } from '../viewer3d/ThreeCanvas';
import { 
  MapPin, 
  MessageSquare, 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight, 
  ChevronLeft
} from 'lucide-react';

interface ClientViewProps {
  project: Project;
  version: BlueprintVersion;
  comments: Comment[];
  onAddComment: (pos: Vector3D, text: string, author: string) => void;
  onExitClientMode: () => void;
}

export const ClientView: React.FC<ClientViewProps> = ({
  project,
  version,
  comments,
  onAddComment,
  onExitClientMode,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="w-full h-full flex flex-col bg-slate-100 overflow-hidden select-none">
      {/* Client Review Top Navigation Bar */}
      <header className="h-13 border-b border-slate-200 bg-white px-4 flex items-center justify-between z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onExitClientMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Engineer Studio</span>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold text-slate-900">{project.name}</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200 uppercase font-semibold">
                {project.type}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                v{version.version_no}.0
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>{project.location}</span>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Client Review Portal · Verified Model</span>
          </div>

          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              sidebarOpen
                ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Feedback ({comments.length})</span>
            {sidebarOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        </div>
      </header>

      {/* Main 3D Stage + Slide-out Feedback Sidebar */}
      <div className="flex-1 relative flex overflow-hidden">
        <div className="flex-1 h-full relative">
          <ThreeCanvas
            elements={version.elements}
            comments={comments}
            bbox={version.bbox}
            satelliteUrl={version.satelliteUrl}
            onAddComment={onAddComment}
            readOnly={true}
          />
        </div>

        {/* Collapsible Feedback Sidebar */}
        {sidebarOpen && (
          <aside className="w-80 h-full border-l border-slate-200 bg-white flex flex-col z-20 shadow-md animate-in slide-in-from-right-4 duration-200">
            <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-sky-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Spatial Review Feedback
                </span>
              </div>
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {comments.length}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {comments.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                  <MessageSquare className="w-8 h-8 mb-2 text-sky-400 opacity-60" />
                  <p className="text-xs font-semibold text-slate-700">No comments placed yet</p>
                  <p className="text-[11px] mt-1 leading-relaxed text-slate-500">
                    Click <strong>"Add Comment Pin"</strong> at the top, then tap anywhere on the 3D model to leave notes for the engineer.
                  </p>
                </div>
              ) : (
                comments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-sky-300 transition-colors shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${c.status === 'resolved' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="text-xs font-bold text-slate-900">{c.author_name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed font-medium">
                      "{c.text}"
                    </p>

                    <div className="mt-2 pt-1.5 border-t border-slate-200 flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>Coords: ({c.position.x}, {c.position.y}, {c.position.z})</span>
                      {c.status === 'resolved' && (
                        <span className="text-emerald-700 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="w-3 h-3" /> Resolved
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 border-t border-slate-200 bg-slate-50 text-center text-[10px] text-slate-500">
              💡 Click any surface on the 3D model to attach a note directly to geometry.
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
