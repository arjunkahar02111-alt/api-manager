import React from 'react';
import { BRAND_ASSETS } from './brandAssets';

interface LoginBrandProps {
  subtitle?: string;
}

export const LoginBrand: React.FC<LoginBrandProps> = ({
  subtitle = 'ENTERPRISE API MANAGEMENT & GATEWAY CONTROL',
}) => {
  return (
    <div className="flex flex-col items-center text-center select-none mb-8">
      {/* Restrained Futuristic Glow Container */}
      <div className="relative mb-4 group cursor-default">
        {/* Soft purple backlight */}
        <div className="absolute -inset-2 bg-gradient-to-r from-[#A020F0]/20 to-[#7B2FFF]/20 rounded-full blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

        <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center p-2 rounded-2xl bg-[#08060D]/80 border border-[#262035] shadow-2xl backdrop-blur-md">
          <img
            src={BRAND_ASSETS.MONOGRAM}
            alt={BRAND_ASSETS.BRAND_NAME}
            className="w-full h-full object-contain filter drop-shadow-[0_0_12px_rgba(160,32,240,0.5)] transition-transform duration-300 group-hover:scale-105"
          />
        </div>
      </div>

      {/* Brand Name Typography */}
      <div className="flex items-center gap-2 mb-1.5">
        <h1 className="font-mono font-black text-2xl sm:text-3xl tracking-tight text-white uppercase">
          KARVION
        </h1>
        <span className="font-mono font-light text-2xl sm:text-3xl tracking-tight text-[#C77DFF] uppercase">
          TECHNOLOGIES
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-[#A020F0] rounded-full animate-pulse" />
        <p className="text-[11px] text-[#A39BAD] font-mono uppercase tracking-[0.18em]">
          {subtitle}
        </p>
      </div>
    </div>
  );
};
