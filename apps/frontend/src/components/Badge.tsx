import React from 'react';

interface BadgeProps {
  status?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | string;
  children?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, variant, children, className = '' }) => {
  const text = children || status || '';
  const key = (variant || (typeof text === 'string' ? text : status || '')).toLowerCase();

  let styles = 'bg-[#181818] text-[#A3A3A3] border-[#333333]';

  if (key === 'active' || key === 'healthy' || key === 'verified' || key === 'delivered' || key === 'success') {
    styles = 'bg-[#052E16] text-[#22C55E] border-[#16A34A]';
  } else if (key === 'suspended' || key === 'warning' || key === 'waiting_for_customer') {
    styles = 'bg-[#422006] text-[#FBBF24] border-[#CA8A04]';
  } else if (key === 'expired' || key === 'unhealthy' || key === 'rejected' || key === 'failed' || key === 'disabled' || key === 'danger') {
    styles = 'bg-[#450A0A] text-[#F87171] border-[#EF4444]';
  } else if (key === 'pending' || key === 'in_progress' || key === 'maintenance' || key === 'info') {
    styles = 'bg-[#172554] text-[#60A5FA] border-[#3B82F6]';
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-none text-[11px] font-bold border-2 uppercase tracking-[0.08em] ${styles} ${className}`}
    >
      {text}
    </span>
  );
};
