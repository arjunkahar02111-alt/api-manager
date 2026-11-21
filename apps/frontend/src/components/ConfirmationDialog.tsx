import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
      <div className="w-full max-w-md bg-[#08060D] border-2 border-[#A020F0] shadow-[0_0_40px_rgba(160,32,240,0.35)] rounded-none overflow-hidden">
        {/* Header */}
        <div className="p-4 bg-[#100D17] border-b-2 border-[#1F1930] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className={`w-4 h-4 ${isDestructive ? 'text-[#EF4444]' : 'text-[#A020F0]'}`} />
            <h3 className="font-bold text-white text-xs uppercase tracking-wider">{title}</h3>
          </div>
          <button onClick={onCancel} className="text-[#A39BAD] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-xs text-[#F5F3FA] leading-relaxed">
          <p>{message}</p>
        </div>

        {/* Actions */}
        <div className="p-4 bg-[#050508] border-t-2 border-[#1F1930] flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-[#120E1C] border border-[#2B233F] hover:bg-[#1A1428] text-[#A39BAD] hover:text-white text-xs font-bold uppercase tracking-wider transition-colors rounded-none"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-5 py-2 font-bold uppercase tracking-wider text-xs transition-colors rounded-none border ${
              isDestructive
                ? 'bg-[#EF4444] hover:bg-[#DC2626] border-[#EF4444] text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                : 'bg-[#A020F0] hover:bg-[#7B2FFF] border-[#A020F0] text-white shadow-[0_0_15px_rgba(160,32,240,0.4)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
