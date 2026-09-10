import React, { useState } from 'react';
import type { Project } from '../../types';
import { Modal } from '../common/Modal';
import { Share2, Copy, Check, ExternalLink, ShieldCheck, Eye, MessageSquare } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onOpenClientView: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  project,
  onOpenClientView,
}) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = `${window.location.origin}?view=${project.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share 3D Model with Client">
      <div className="space-y-5">
        {/* Banner */}
        <div className="p-3.5 rounded-xl bg-sky-50 border border-sky-100">
          <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5 mb-1">
            <Share2 className="w-3.5 h-3.5 text-sky-600" />
            Client Sign-Off Link
          </h4>
          <p className="text-xs text-sky-900/80 leading-relaxed">
            Send this public link to project owners and clients. They can explore the 3D model, rotate and zoom, and leave spatial comment pins without needing an account.
          </p>
        </div>

        {/* Copy Input */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">
            Public Review URL
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-sky-700 focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center">
            <Eye className="w-4 h-4 text-sky-600 mb-1" />
            <span className="text-xs font-bold text-slate-800">Full 3D Orbit</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Rotate, zoom & pan</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center">
            <MessageSquare className="w-4 h-4 text-amber-500 mb-1" />
            <span className="text-xs font-bold text-slate-800">Spatial Pins</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Click-to-comment</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col items-center text-center">
            <ShieldCheck className="w-4 h-4 text-emerald-600 mb-1" />
            <span className="text-xs font-bold text-slate-800">Tamper-Proof</span>
            <span className="text-[10px] text-slate-500 mt-0.5">Read-only model</span>
          </div>
        </div>

        {/* Open Presentation Mode */}
        <div className="pt-2 border-t border-slate-200 flex justify-end">
          <button
            onClick={() => {
              onClose();
              onOpenClientView();
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open Client Presentation View</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
