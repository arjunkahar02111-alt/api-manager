import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'red';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
}) => {
  return (
    <div className="bg-[#121212] border-t-4 border-t-[#EF4444] border-x-2 border-b-2 border-[#262626] p-6 hover:border-[#404040] transition-colors relative group">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-[0.12em]">
          {title}
        </span>
        <div className="w-8 h-8 bg-[#1A1A1A] border-2 border-[#262626] flex items-center justify-center text-white group-hover:border-[#EF4444] group-hover:text-[#EF4444] transition-colors">
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="text-3xl lg:text-4xl font-display text-white tracking-tight leading-none">
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-[#737373] mt-2 font-mono">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
};
