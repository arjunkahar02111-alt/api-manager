import React from 'react';
import { BRAND_ASSETS } from './brandAssets';

interface BrandIconProps {
  size?: number | string;
  className?: string;
  glow?: boolean;
}

export const BrandIcon: React.FC<BrandIconProps> = ({
  size = 36,
  className = '',
  glow = false,
}) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden ${
        glow ? 'drop-shadow-[0_0_12px_rgba(160,32,240,0.6)]' : ''
      } ${className}`}
    >
      <img
        src={BRAND_ASSETS.MONOGRAM}
        alt="Karvion Monogram"
        className="w-full h-full object-contain select-none transition-transform duration-300 hover:scale-105"
        loading="eager"
      />
    </div>
  );
};
