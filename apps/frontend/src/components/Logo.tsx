import React from 'react';
import { BrandLogo } from './branding';

export const Logo: React.FC<{ className?: string; size?: number }> = ({ className = '', size = 32 }) => {
  return (
    <BrandLogo
      variant="horizontal"
      size={size > 40 ? 'lg' : size < 28 ? 'sm' : 'md'}
      className={className}
      clickable={false}
      subtitle="API MANAGER"
    />
  );
};
