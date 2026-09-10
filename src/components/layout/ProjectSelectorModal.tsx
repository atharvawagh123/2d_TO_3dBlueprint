import React, { useState } from 'react';
import type { Project, ProjectType } from '../../types';
import { Modal } from '../common/Modal';
import { FolderKanban, Plus, MapPin, Check, Briefcase } from 'lucide-react';

interface ProjectSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: Project[];
  currentProjectId: string;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (name: string, type: ProjectType, location: string, description: string) => void;
}

export const ProjectSelectorModal: React.FC<ProjectSelectorModalProps> = ({
  isOpen,
  onClose,
  projects,
  currentProjectId,
  onSelectProject,
  onCreateProject,
}) => {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ProjectType>('bridge');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateProject(name.trim(), type, location.trim(), description.trim());
    setName('');
    setLocation('');
    setDescription('');
    setShowCreate(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select or Create Civil Project">
      <div className="space-y-4">
        {/* Project List */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Active Projects
          </div>
          {projects.map((proj) => {
            const isSelected = proj.id === currentProjectId;
            return (
              <div
                key={proj.id}
                onClick={() => {
                  onSelectProject(proj.id);
                  onClose();
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                  isSelected
                    ? 'bg-sky-50 border-sky-400 shadow-xs ring-1 ring-sky-300'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <FolderKanban className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">
                        {proj.name}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase font-semibold">
                        {proj.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {proj.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-400">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{proj.location}</span>
                    </div>
                  </div>
                </div>

                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-sky-600 flex items-center justify-center text-white">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Create Project Button */}
        {!showCreate ? (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-sky-500 text-slate-600 hover:text-sky-700 flex items-center justify-center gap-2 text-xs font-semibold hover:bg-sky-50/50 transition-all"
          >
            <Plus className="w-4 h-4 text-sky-600" />
            Create New Project
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in text-xs">
            <div className="font-bold text-slate-800 flex items-center gap-1.5 mb-1">
              <Briefcase className="w-3.5 h-3.5 text-sky-600" />
              New Civil Construction Project
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Project Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Interstate 80 Bypass Viaduct"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-600 font-medium mb-1">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ProjectType)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-sky-500"
                >
                  <option value="bridge">Bridge Viaduct</option>
                  <option value="road">Roadway / Highway</option>
                  <option value="site">Site Plot</option>
                  <option value="building">Commercial Structure</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 font-medium mb-1">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Valley Corridor Station"
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-600 font-medium mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 4-lane viaduct with approach ramps"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-lg shadow-xs"
              >
                Create Project
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
