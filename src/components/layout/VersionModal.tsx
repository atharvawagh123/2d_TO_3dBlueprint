import React, { useState } from 'react';
import type { BlueprintVersion } from '../../types';
import { Modal } from '../common/Modal';
import { GitBranch, Plus, Check, Clock, FileText } from 'lucide-react';

interface VersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  versions: BlueprintVersion[];
  currentVersionId: string;
  onSelectVersion: (versionId: string) => void;
  onCommitNewVersion: (notes: string) => void;
}

export const VersionModal: React.FC<VersionModalProps> = ({
  isOpen,
  onClose,
  versions,
  currentVersionId,
  onSelectVersion,
  onCommitNewVersion,
}) => {
  const [newVersionNotes, setNewVersionNotes] = useState('');
  const [showCommitForm, setShowCommitForm] = useState(false);

  const handleCommit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionNotes.trim()) return;
    onCommitNewVersion(newVersionNotes.trim());
    setNewVersionNotes('');
    setShowCommitForm(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Blueprint Version History">
      <div className="space-y-4">
        {/* Version List */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Revisions & History
          </div>
          {versions.map((ver) => {
            const isCurrent = ver.id === currentVersionId;
            return (
              <div
                key={ver.id}
                onClick={() => onSelectVersion(ver.id)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between ${
                  isCurrent
                    ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-300 shadow-xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${isCurrent ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 font-mono">
                        Version {ver.version_no}.0
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-semibold border border-sky-200">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {ver.notes || 'Routine revision checkpoint'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] font-mono text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(ver.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {ver.elements.length} civil elements
                      </span>
                    </div>
                  </div>
                </div>

                {isCurrent && (
                  <div className="w-5 h-5 rounded-full bg-sky-600 flex items-center justify-center text-white">
                    <Check className="w-3 h-3 stroke-[3]" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Commit New Version Section */}
        {!showCommitForm ? (
          <button
            onClick={() => setShowCommitForm(true)}
            className="w-full py-2.5 px-4 rounded-xl border border-dashed border-slate-300 hover:border-sky-500 text-slate-600 hover:text-sky-700 flex items-center justify-center gap-2 text-xs font-semibold hover:bg-sky-50/50 transition-all"
          >
            <Plus className="w-4 h-4 text-sky-600" />
            Commit Current Blueprint as New Revision (v{versions.length + 1}.0)
          </button>
        ) : (
          <form onSubmit={handleCommit} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in text-xs">
            <label className="block text-slate-700 font-medium">
              Revision Notes / Change Summary
            </label>
            <input
              type="text"
              value={newVersionNotes}
              onChange={(e) => setNewVersionNotes(e.target.value)}
              placeholder="e.g. Added approach ramp curvature and increased pier spacing"
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-sky-500"
              autoFocus
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowCommitForm(false)}
                className="px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newVersionNotes.trim()}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg font-semibold shadow-xs"
              >
                Save Revision Snapshot
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
