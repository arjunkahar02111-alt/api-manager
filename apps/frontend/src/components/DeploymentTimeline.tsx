import React from 'react';
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';

export type DeploymentStep = 'upload' | 'extract' | 'deps' | 'build' | 'start' | 'health';

interface DeploymentTimelineProps {
  status: 'deploying' | 'running' | 'stopped' | 'failed' | 'deleted';
  currentStep?: DeploymentStep;
  error?: string;
  uptimeSeconds?: number;
}

const STEPS: { key: DeploymentStep; label: string }[] = [
  { key: 'upload', label: 'Uploaded' },
  { key: 'extract', label: 'Extracted' },
  { key: 'deps', label: 'Dependencies' },
  { key: 'build', label: 'Built' },
  { key: 'start', label: 'Started' },
  { key: 'health', label: 'Health Verified' },
];

export const DeploymentTimeline: React.FC<DeploymentTimelineProps> = ({
  status,
  error,
  uptimeSeconds = 0,
}) => {
  // Compute step completion based on deployment status
  const getStepState = (stepIndex: number): 'completed' | 'active' | 'failed' | 'pending' => {
    if (status === 'running') return 'completed';
    if (status === 'failed') {
      if (stepIndex === 4 || stepIndex === 5) return 'failed';
      return 'completed';
    }
    if (status === 'stopped') {
      if (stepIndex < 4) return 'completed';
      return 'pending';
    }
    if (status === 'deploying') {
      if (stepIndex < 2) return 'completed';
      if (stepIndex === 2 || stepIndex === 3) return 'active';
      return 'pending';
    }
    return 'pending';
  };

  return (
    <div className="w-full bg-[#08060D] border-2 border-[#1F1930] p-4 font-mono select-none">
      <div className="flex items-center justify-between mb-3 text-[11px] font-bold uppercase tracking-wider text-[#A39BAD]">
        <span>Deployment Lifecycle Pipeline</span>
        <span className={status === 'running' ? 'text-[#10B981]' : status === 'failed' ? 'text-[#EF4444]' : 'text-[#A020F0]'}>
          {status === 'running' ? `● OPERATIONAL (${Math.floor(uptimeSeconds / 60)}m)` : `● ${status.toUpperCase()}`}
        </span>
      </div>

      {/* Pipeline Steps Tracker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STEPS.map((step, idx) => {
          const state = getStepState(idx);

          return (
            <div
              key={step.key}
              className={`p-2.5 border flex items-center gap-2 transition-all rounded-none ${
                state === 'completed'
                  ? 'bg-[#0A1F13] border-[#10B981] text-[#10B981]'
                  : state === 'active'
                  ? 'bg-[#1B112D] border-[#A020F0] text-white animate-pulse'
                  : state === 'failed'
                  ? 'bg-[#290B0B] border-[#EF4444] text-[#EF4444]'
                  : 'bg-[#0D0A14] border-[#1F1930] text-[#6D657A]'
              }`}
            >
              <div className="shrink-0">
                {state === 'completed' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {state === 'active' && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#A020F0]" />}
                {state === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-[#EF4444]" />}
                {state === 'pending' && <Clock className="w-3.5 h-3.5 opacity-50" />}
              </div>

              <div className="truncate">
                <div className="text-[9px] uppercase tracking-wider font-bold">Step {idx + 1}</div>
                <div className="text-[11px] font-bold truncate">{step.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Failure Diagnostic Callout */}
      {status === 'failed' && error && (
        <div className="mt-3 p-3 bg-[#260A1A] border-l-4 border-[#EF4444] text-xs text-[#EF4444] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold uppercase tracking-wider block mb-1">Process Failure Detected</span>
            <span className="text-[#F5F3FA] font-mono text-[11px] break-all">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
};
