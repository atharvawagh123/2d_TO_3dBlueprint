import React, { useState, useEffect, useCallback } from 'react';
import type { 
  Project, 
  BlueprintVersion, 
  BlueprintElement, 
  Comment, 
  EditorTool, 
  SnapMode, 
  ProjectType, 
  Vector3D 
} from './types';
import { repository } from './services/repository';
import { Header, type AppViewMode } from './components/layout/Header';
import { EditorToolbar } from './components/editor/EditorToolbar';
import { ElementInspector } from './components/editor/ElementInspector';
import { BlueprintCanvas } from './components/editor/BlueprintCanvas';
import { ConstructionTakeoffSidebar } from './components/editor/ConstructionTakeoffSidebar';
import { ThreeCanvas } from './components/viewer3d/ThreeCanvas';
import { ClientView } from './components/client/ClientView';
import { ProjectSelectorModal } from './components/layout/ProjectSelectorModal';
import { VersionModal } from './components/layout/VersionModal';
import { ShareModal } from './components/layout/ShareModal';
import { SiteMapAOI } from './components/map/SiteMapAOI';
import { getSatelliteTextureUrl, type BoundingBoxGPS } from './engine/gisProjection';

export const App: React.FC = () => {
  // Load initial projects from repository
  const [projects, setProjects] = useState<Project[]>(() => repository.getProjects());
  const [currentProjectId, setCurrentProjectId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const viewId = params.get('view');
    if (viewId && repository.getProject(viewId)) return viewId;
    return projects[0]?.id || 'proj_bridge_interchange';
  });

  // Client Public Presentation Mode Route Check
  const [isClientMode, setIsClientMode] = useState<boolean>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('view');
  });

  // Active Project & Versions
  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];
  const [versions, setVersions] = useState<BlueprintVersion[]>(() => 
    repository.getVersions(currentProjectId)
  );
  const [currentVersionId, setCurrentVersionId] = useState<string>(() => {
    const vers = repository.getVersions(currentProjectId);
    return vers[vers.length - 1]?.id || '';
  });

  const currentVersion = versions.find(v => v.id === currentVersionId) || versions[0];

  // Active Drawing Elements Buffer
  const [elements, setElements] = useState<BlueprintElement[]>(() => 
    currentVersion?.elements ? JSON.parse(JSON.stringify(currentVersion.elements)) : []
  );

  // Undo / Redo History Stack
  const [history, setHistory] = useState<BlueprintElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Comments for active version
  const [comments, setComments] = useState<Comment[]>(() => 
    repository.getComments(currentProjectId, currentVersionId)
  );

  // Editor Interaction State
  const [activeTool, setActiveTool] = useState<EditorTool>('select');
  const [snapMode, setSnapMode] = useState<SnapMode>('1m');
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [scale, setScale] = useState<number>(2.5);

  // Sidebar Toggles
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);

  // Layout View Mode (GIS Map | 2D Canvas | 3D Digital Twin)
  const [viewMode, setViewMode] = useState<AppViewMode>('map');

  // Modals
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Synchronize when project changes
  useEffect(() => {
    const vers = repository.getVersions(currentProjectId);
    setVersions(vers);
    const latest = vers[vers.length - 1];
    if (latest) {
      setCurrentVersionId(latest.id);
      const cloned = JSON.parse(JSON.stringify(latest.elements));
      setElements(cloned);
      setHistory([cloned]);
      setHistoryIndex(0);
      setComments(repository.getComments(currentProjectId, latest.id));
    }
    setSelectedElementId(null);
  }, [currentProjectId]);

  // Synchronize elements when version changes
  useEffect(() => {
    const ver = versions.find(v => v.id === currentVersionId);
    if (ver) {
      const cloned = JSON.parse(JSON.stringify(ver.elements));
      setElements(cloned);
      setHistory([cloned]);
      setHistoryIndex(0);
      setComments(repository.getComments(currentProjectId, currentVersionId));
      setSelectedElementId(null);
    }
  }, [currentVersionId, versions, currentProjectId]);

  // Push state to Undo History
  const pushHistory = useCallback((newElements: BlueprintElement[]) => {
    setHistory(prev => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, JSON.parse(JSON.stringify(newElements))];
    });
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  // Add new element from 2D Canvas
  const handleAddElement = (newElement: BlueprintElement) => {
    const updated = [...elements, newElement];
    setElements(updated);
    pushHistory(updated);
  };

  // Update existing element
  const handleUpdateElement = (updatedElement: BlueprintElement) => {
    const updated = elements.map(el => el.id === updatedElement.id ? updatedElement : el);
    setElements(updated);
    pushHistory(updated);
  };

  // Delete element (works from Sidebar trash icon, Inspector button, or canvas)
  const handleDeleteElement = (id: string) => {
    const updated = elements.filter(el => el.id !== id);
    setElements(updated);
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
    pushHistory(updated);
  };

  // Focus and Zoom in 3D - only highlights, doesn't force switch view mode
  const handleFocusElement3D = (id: string) => {
    setSelectedElementId(id);
    setIsInspectorOpen(true);
    // Only switch to 3D if already in split or 3D view
    if (viewMode === 'viewer3d' || viewMode === 'split') {
      setViewMode('viewer3d');
    }
  };

  // Undo / Redo
  const handleUndo = () => {
    if (historyIndex > 0) {
      const nextIdx = historyIndex - 1;
      setHistoryIndex(nextIdx);
      setElements(JSON.parse(JSON.stringify(history[nextIdx])));
      setSelectedElementId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setElements(JSON.parse(JSON.stringify(history[nextIdx])));
      setSelectedElementId(null);
    }
  };

  // Save current working elements as new BlueprintVersion
  const handleCommitNewVersion = (notes: string) => {
    const newVersionNo = versions.length + 1;
    const newVersion: BlueprintVersion = {
      id: `ver_${currentProjectId}_0${newVersionNo}_${Date.now().toString(36)}`,
      project_id: currentProjectId,
      version_no: newVersionNo,
      created_at: new Date().toISOString(),
      created_by: 'lead_engineer_01',
      notes,
      elements: JSON.parse(JSON.stringify(elements)),
    };

    repository.saveVersion(newVersion);
    const updatedVersions = repository.getVersions(currentProjectId);
    setVersions(updatedVersions);
    setCurrentVersionId(newVersion.id);
  };

  // Import Live GIS AOI elements to project blueprint
  const handleImportFromMap = (importedElements: BlueprintElement[], notes: string, bbox?: BoundingBoxGPS) => {
    setElements(importedElements);
    pushHistory(importedElements);

    const newVersionNo = versions.length + 1;
    const satelliteUrl = bbox ? getSatelliteTextureUrl(bbox) : undefined;
    const newVersion: BlueprintVersion = {
      id: `ver_${currentProjectId}_0${newVersionNo}_${Date.now().toString(36)}`,
      project_id: currentProjectId,
      version_no: newVersionNo,
      created_at: new Date().toISOString(),
      created_by: 'gis_surveyor',
      notes: notes || 'GIS Live AOI Infrastructure Import',
      bbox,
      satelliteUrl,
      elements: JSON.parse(JSON.stringify(importedElements)),
    };

    repository.saveVersion(newVersion);
    const updatedVersions = repository.getVersions(currentProjectId);
    setVersions(updatedVersions);
    setCurrentVersionId(newVersion.id);

    // Switch view mode to 3D Digital Twin so the user can inspect the generated 3D model
    setViewMode('viewer3d');
    if (importedElements.length > 0) {
      setSelectedElementId(importedElements[0].id);
    }
  };

  // Create brand new civil project directly from GIS AOI
  const handleCreateProjectFromAOI = (
    projectName: string, 
    location: string, 
    importedElements: BlueprintElement[], 
    notes: string,
    bbox?: BoundingBoxGPS
  ) => {
    const newProj: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: projectName,
      type: 'site',
      location,
      description: notes,
      created_by: 'gis_surveyor',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const satelliteUrl = bbox ? getSatelliteTextureUrl(bbox) : undefined;
    const initialVersion: BlueprintVersion = {
      id: `ver_${newProj.id}_01`,
      project_id: newProj.id,
      version_no: 1,
      created_at: new Date().toISOString(),
      created_by: 'gis_surveyor',
      notes: notes || 'Geospatial AOI Survey Blueprint',
      bbox,
      satelliteUrl,
      elements: JSON.parse(JSON.stringify(importedElements)),
    };

    repository.saveProject(newProj);
    repository.saveVersion(initialVersion);

    setProjects(repository.getProjects());
    setCurrentProjectId(newProj.id);
    setVersions([initialVersion]);
    setCurrentVersionId(initialVersion.id);
    setElements(JSON.parse(JSON.stringify(importedElements)));
    setHistory([JSON.parse(JSON.stringify(importedElements))]);
    setHistoryIndex(0);

    // Switch view mode to full 3D Digital Twin
    setViewMode('viewer3d');
    if (importedElements.length > 0) {
      setSelectedElementId(importedElements[0].id);
    }
  };

  // Create new civil project
  const handleCreateProject = (name: string, type: ProjectType, location: string, description: string) => {
    const newProj: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      type,
      location,
      description,
      created_by: 'lead_engineer_01',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const initialVersion: BlueprintVersion = {
      id: `ver_${newProj.id}_01`,
      project_id: newProj.id,
      version_no: 1,
      created_at: new Date().toISOString(),
      created_by: 'lead_engineer_01',
      notes: 'Initial blueprint canvas',
      elements: [],
    };

    repository.saveProject(newProj);
    repository.saveVersion(initialVersion);

    setProjects(repository.getProjects());
    setCurrentProjectId(newProj.id);
  };

  // Add 3D Comment
  const handleAddComment = (pos: Vector3D, text: string, author: string) => {
    const newComment: Comment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      project_id: currentProjectId,
      blueprint_version_id: currentVersionId,
      position: pos,
      text,
      author_name: author,
      created_by: isClientMode ? 'client_visitor' : 'lead_engineer',
      created_at: new Date().toISOString(),
      status: 'open',
    };

    repository.addComment(newComment);
    setComments(repository.getComments(currentProjectId, currentVersionId));
  };

  const selectedElement = elements.find(el => el.id === selectedElementId) || null;

  // Render Public Client Review Mode if active
  if (isClientMode && currentProject && currentVersion) {
    return (
      <ClientView
        project={currentProject}
        version={{ ...currentVersion, elements }}
        comments={comments}
        onAddComment={handleAddComment}
        onExitClientMode={() => {
          setIsClientMode(false);
          const url = new URL(window.location.href);
          url.searchParams.delete('view');
          window.history.pushState({}, '', url.pathname);
        }}
      />
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 overflow-hidden select-none">
      {/* Top Application Header */}
      {currentProject && currentVersion && (
        <Header
          currentProject={currentProject}
          currentVersion={currentVersion}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          onOpenProjectModal={() => setIsProjectModalOpen(true)}
          onOpenVersionModal={() => setIsVersionModalOpen(true)}
          onOpenShareModal={() => setIsShareModalOpen(true)}
          onCommitNewVersion={() => setIsVersionModalOpen(true)}
        />
      )}

      {/* Main Workspace Stage */}
      <main className="flex-1 relative flex overflow-hidden">
        {viewMode === 'map' ? (
          <SiteMapAOI 
            onImportToBlueprint={handleImportFromMap} 
            onCreateProjectFromAOI={handleCreateProjectFromAOI}
          />
        ) : (
          <>
            {/* Left Construction Takeoffs & Layer Sidebar */}
            {viewMode !== 'viewer3d' && (
              <ConstructionTakeoffSidebar
                elements={elements}
                selectedElementId={selectedElementId}
                onSelectElement={(id) => {
                  setSelectedElementId(id);
                  if (id) setIsInspectorOpen(true);
                }}
                onDeleteElement={handleDeleteElement}
                onFocusElement3D={handleFocusElement3D}
                isOpen={isSidebarOpen}
                onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
              />
            )}

            {/* 2D Blueprint Canvas Panel */}
            <div
              className={`h-full relative transition-all duration-300 ${
                viewMode === 'editor2d'
                  ? 'flex-1'
                  : viewMode === 'viewer3d'
                  ? 'hidden'
                  : 'flex-1 border-r border-slate-200'
              }`}
            >
              {/* Top Drafting Toolbar */}
              <EditorToolbar
                activeTool={activeTool}
                onSelectTool={setActiveTool}
                snapMode={snapMode}
                onToggleSnap={setSnapMode}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
                onDeleteSelected={() => selectedElementId && handleDeleteElement(selectedElementId)}
                hasSelection={Boolean(selectedElementId)}
                onZoomIn={() => setScale(s => Math.min(s * 1.25, 10))}
                onZoomOut={() => setScale(s => Math.max(s * 0.8, 0.2))}
                onResetZoom={() => setScale(2.5)}
                currentScale={scale / 2.5}
              />

              {/* 2D Canvas */}
              <BlueprintCanvas
                elements={elements}
                activeTool={activeTool}
                snapMode={snapMode}
                selectedElementId={selectedElementId}
                onSelectElement={(id) => {
                  setSelectedElementId(id);
                  if (id) setIsInspectorOpen(true);
                }}
                onAddElement={handleAddElement}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onFocusElement3D={handleFocusElement3D}
                scale={scale}
                onScaleChange={setScale}
              />
            </div>

            {/* Element Properties Inspector Drawer (Docked right, non-obstructive!) */}
            {selectedElement && isInspectorOpen && viewMode !== 'viewer3d' && (
              <ElementInspector
                element={selectedElement}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onFocusElement3D={handleFocusElement3D}
                onClose={() => setIsInspectorOpen(false)}
              />
            )}

            {/* 3D WebGL Model Viewer Panel */}
            <div
              className={`h-full relative transition-all duration-300 ${
                viewMode === 'viewer3d'
                  ? 'w-full'
                  : viewMode === 'editor2d'
                  ? 'hidden'
                  : 'flex-1'
              }`}
            >
              <ThreeCanvas
                elements={elements}
                comments={comments}
                selectedElementId={selectedElementId}
                bbox={currentVersion?.bbox}
                satelliteUrl={currentVersion?.satelliteUrl}
                onSelectElement={(id) => {
                  setSelectedElementId(id);
                  if (id) setIsInspectorOpen(true);
                }}
                onAddComment={handleAddComment}
                onSwitchTo2D={() => setViewMode('editor2d')}
              />
            </div>
          </>
        )}
      </main>

      {/* Modals */}
      {currentProject && (
        <>
          <ProjectSelectorModal
            isOpen={isProjectModalOpen}
            onClose={() => setIsProjectModalOpen(false)}
            projects={projects}
            currentProjectId={currentProjectId}
            onSelectProject={setCurrentProjectId}
            onCreateProject={handleCreateProject}
          />

          <VersionModal
            isOpen={isVersionModalOpen}
            onClose={() => setIsVersionModalOpen(false)}
            versions={versions}
            currentVersionId={currentVersionId}
            onSelectVersion={setCurrentVersionId}
            onCommitNewVersion={handleCommitNewVersion}
          />

          <ShareModal
            isOpen={isShareModalOpen}
            onClose={() => setIsShareModalOpen(false)}
            project={currentProject}
            onOpenClientView={() => setIsClientMode(true)}
          />
        </>
      )}
    </div>
  );
};

export default App;
