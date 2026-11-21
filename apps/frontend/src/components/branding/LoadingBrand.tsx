import React from 'react';
import { BrandIcon } from './BrandIcon';
import { BRAND_ASSETS } from './brandAssets';

interface LoadingBrandProps {
  message?: string;
}

export const LoadingBrand: React.FC<LoadingBrandProps> = ({
  message = 'Initializing Karvion API Manager...',
}) => {
  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 text-[#F5F3FA]">
      <div className="relative mb-6">
        {/* Soft neon purple aura */}
        <div className="absolute -inset-4 bg-[#A020F0]/25 rounded-full blur-2xl animate-pulse" />
        <div className="relative animate-bounce">
          <BrandIcon size={72} glow />
        </div>
      </div>

      <div className="text-center space-y-2">
        <h2 className="font-mono font-black text-xl text-white tracking-widest uppercase">
          {BRAND_ASSETS.PRODUCT_NAME}
        </h2>
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-[#A020F0] rounded-full animate-ping" />
          <span className="text-xs text-[#A39BAD] font-mono tracking-wider">
            {message}
          </span>
        </div>
      </div>
    </div>
  );
};
