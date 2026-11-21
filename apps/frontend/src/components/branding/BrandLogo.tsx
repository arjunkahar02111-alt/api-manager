import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_ASSETS } from './brandAssets';
import { BrandIcon } from './BrandIcon';

interface BrandLogoProps {
  variant?: 'full' | 'horizontal' | 'compact';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  clickable?: boolean;
  to?: string;
  subtitle?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  clickable = true,
  to = '/',
  subtitle = 'API MANAGER',
}) => {
  // Sizing definitions
  const iconSizes = {
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64,
  };

  const textSizes = {
    sm: { title: 'text-sm', sub: 'text-[9px]' },
    md: { title: 'text-base', sub: 'text-[10px]' },
    lg: { title: 'text-xl', sub: 'text-xs' },
    xl: { title: 'text-2xl', sub: 'text-sm' },
  };

  const currentIconSize = iconSizes[size];
  const currentTextSize = textSizes[size];

  const content = (
    <div
      className={`group inline-flex items-center gap-3 transition-all duration-300 select-none ${className}`}
    >
      {variant === 'full' ? (
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-2 transition-transform duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_0_20px_rgba(160,32,240,0.55)]">
            <img
              src={BRAND_ASSETS.LOGO}
              alt={BRAND_ASSETS.BRAND_NAME}
              className="max-h-24 sm:max-h-32 object-contain"
            />
          </div>
        </div>
      ) : (
        <>
          <div className="relative shrink-0 transition-transform duration-300 group-hover:scale-105 group-hover:drop-shadow-[0_0_15px_rgba(160,32,240,0.6)]">
            <BrandIcon size={currentIconSize} />
          </div>

          <div className="flex flex-col text-left">
            <div className="flex items-center gap-2">
              <span className={`font-mono font-black uppercase tracking-wider text-[#F5F3FA] transition-colors group-hover:text-white ${currentTextSize.title}`}>
                KARVION
              </span>
              <span className="bg-[#A020F0]/20 text-[#A020F0] border border-[#A020F0]/50 text-[9px] font-mono font-bold px-1.5 py-0.2 tracking-widest uppercase">
                PRO
              </span>
            </div>
            <span
              className={`font-mono font-bold uppercase tracking-[0.16em] text-[#A39BAD] transition-colors group-hover:text-[#C77DFF] ${currentTextSize.sub}`}
            >
              {subtitle}
            </span>
          </div>
        </>
      )}
    </div>
  );

  if (clickable) {
    return (
      <Link
        to={to}
        className="focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A020F0]"
        title={`${BRAND_ASSETS.BRAND_NAME} - ${subtitle}`}
      >
        {content}
      </Link>
    );
  }

  return content;
};
