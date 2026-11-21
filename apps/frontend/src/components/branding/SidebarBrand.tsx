import React from 'react';
import { Link } from 'react-router-dom';
import { BrandIcon } from './BrandIcon';
import { BRAND_ASSETS } from './brandAssets';

interface SidebarBrandProps {
  collapsed?: boolean;
  to?: string;
}

export const SidebarBrand: React.FC<SidebarBrandProps> = ({
  collapsed = false,
  to = '/admin/overview',
}) => {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3.5 px-3 py-3 w-full transition-all duration-300 focus:outline-none"
      title={`${BRAND_ASSETS.BRAND_NAME} — ${BRAND_ASSETS.PRODUCT_NAME}`}
    >
      <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_0_15px_rgba(160,32,240,0.65)]">
        <BrandIcon size={collapsed ? 36 : 38} glow />
      </div>

      {!collapsed && (
        <div className="flex flex-col text-left overflow-hidden min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-black text-sm tracking-wider uppercase text-white truncate group-hover:text-[#F5F3FA]">
              KARVION
            </span>
            <span className="bg-[#A020F0]/25 text-[#C77DFF] border border-[#A020F0]/50 text-[9px] font-mono font-bold px-1 py-0.2 tracking-widest uppercase">
              V2.0
            </span>
          </div>
          <span className="text-[10px] text-[#A39BAD] font-mono uppercase tracking-[0.14em] truncate group-hover:text-white transition-colors">
            API MANAGER
          </span>
        </div>
      )}
    </Link>
  );
};
