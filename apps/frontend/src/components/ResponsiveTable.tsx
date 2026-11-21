import React from 'react';

interface ResponsiveTableProps {
  children: React.ReactNode;
  className?: string;
  scrollHint?: boolean;
}

export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  children,
  className = '',
  scrollHint = true,
}) => {
  return (
    <div className={`relative w-full border-2 border-[#1F1930] bg-[#08060D] overflow-hidden rounded-none ${className}`}>
      {scrollHint && (
        <div className="sm:hidden px-3 py-1.5 bg-[#100D17] border-b border-[#1F1930] flex items-center justify-between text-[10px] text-[#A39BAD] font-mono">
          <span>⇄ SWIPE HORIZONTALLY TO VIEW ALL COLUMNS</span>
        </div>
      )}
      <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-[#231E30] scrollbar-track-[#050508]">
        {children}
      </div>
    </div>
  );
};
