import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`p-10 text-center border-2 border-dashed border-[#1F1930] bg-[#08060D] flex flex-col items-center justify-center font-mono ${className}`}
    >
      <div className="w-12 h-12 bg-[#120D1F] border-2 border-[#A020F0] flex items-center justify-center mb-4 text-[#C77DFF] shadow-[0_0_15px_rgba(160,32,240,0.3)]">
        <Icon className="w-6 h-6" />
      </div>

      <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 font-display">
        {title}
      </h3>
      <p className="text-xs text-[#A39BAD] max-w-md leading-relaxed mb-6 font-mono">
        {description}
      </p>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2.5 bg-[#A020F0] text-white hover:bg-[#7B2FFF] text-xs font-bold uppercase tracking-wider transition-colors border-2 border-[#A020F0] shadow-[0_0_15px_rgba(160,32,240,0.35)] rounded-none"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
