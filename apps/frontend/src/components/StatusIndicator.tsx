import React from 'react';

interface StatusIndicatorProps {
  status: 'active' | 'healthy' | 'online' | 'running' | 'suspended' | 'warning' | 'deploying' | 'stopped' | 'failed' | 'disabled' | 'maintenance';
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  className = '',
  size = 'md',
}) => {
  const norm = status.toLowerCase();

  const configs: Record<string, { bg: string; text: string; border: string; dot: string; pulse: boolean; defaultLabel: string }> = {
    active: { bg: 'bg-[#0A2614]', text: 'text-[#10B981]', border: 'border-[#10B981]', dot: 'bg-[#10B981]', pulse: false, defaultLabel: 'ACTIVE' },
    healthy: { bg: 'bg-[#0A2614]', text: 'text-[#10B981]', border: 'border-[#10B981]', dot: 'bg-[#10B981]', pulse: false, defaultLabel: 'HEALTHY' },
    online: { bg: 'bg-[#0A2614]', text: 'text-[#10B981]', border: 'border-[#10B981]', dot: 'bg-[#10B981]', pulse: true, defaultLabel: 'ONLINE' },
    running: { bg: 'bg-[#0A2614]', text: 'text-[#10B981]', border: 'border-[#10B981]', dot: 'bg-[#10B981]', pulse: true, defaultLabel: 'RUNNING' },
    deploying: { bg: 'bg-[#1C1230]', text: 'text-[#C77DFF]', border: 'border-[#A020F0]', dot: 'bg-[#A020F0]', pulse: true, defaultLabel: 'DEPLOYING' },
    warning: { bg: 'bg-[#291A06]', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]', dot: 'bg-[#F59E0B]', pulse: true, defaultLabel: 'WARNING' },
    suspended: { bg: 'bg-[#260A0A]', text: 'text-[#EF4444]', border: 'border-[#EF4444]', dot: 'bg-[#EF4444]', pulse: false, defaultLabel: 'SUSPENDED' },
    failed: { bg: 'bg-[#260A0A]', text: 'text-[#EF4444]', border: 'border-[#EF4444]', dot: 'bg-[#EF4444]', pulse: false, defaultLabel: 'FAILED' },
    stopped: { bg: 'bg-[#141219]', text: 'text-[#A39BAD]', border: 'border-[#2F2644]', dot: 'bg-[#6D657A]', pulse: false, defaultLabel: 'STOPPED' },
    disabled: { bg: 'bg-[#141219]', text: 'text-[#A39BAD]', border: 'border-[#2F2644]', dot: 'bg-[#6D657A]', pulse: false, defaultLabel: 'DISABLED' },
    maintenance: { bg: 'bg-[#241A0A]', text: 'text-[#F59E0B]', border: 'border-[#F59E0B]', dot: 'bg-[#F59E0B]', pulse: true, defaultLabel: 'MAINTENANCE' },
  };

  const conf = configs[norm] || configs.active;
  const displayLabel = label || conf.defaultLabel;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 border font-mono font-bold uppercase tracking-wider rounded-none ${
        size === 'sm' ? 'text-[10px]' : 'text-xs'
      } ${conf.bg} ${conf.text} ${conf.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${conf.dot} ${conf.pulse ? 'animate-pulse' : ''}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
