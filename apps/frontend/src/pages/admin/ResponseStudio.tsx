import React, { useState } from 'react';
import {
  Sliders,
  Play,
  Copy,
  Check,
  Code2,
  Terminal,
  ShieldCheck,
  Eye,
  RefreshCw,
  Server,
  AlertTriangle,
} from 'lucide-react';

export const AdminResponseStudio: React.FC = () => {
  const [developerTag, setDeveloperTag] = useState('arjunkahar');
  const [includeAnnouncement, setIncludeAnnouncement] = useState(true);
  const [announcementType, setAnnouncementType] = useState('maintenance');
  const [responseMode, setResponseMode] = useState<'success' | 'maintenance' | 'quota_exceeded' | 'invalid_key'>('success');
  const [copied, setCopied] = useState(false);

  const getSimulatedResponse = () => {
    const timestamp = new Date().toISOString();
    const requestId = 'req_' + Math.random().toString(36).substring(2, 12);

    if (responseMode === 'maintenance') {
      return {
        success: false,
        status: 'maintenance',
        error: {
          code: 'API_MAINTENANCE',
          message: 'This API is temporarily unavailable due to scheduled platform maintenance.',
        },
        announcement: includeAnnouncement
          ? {
              id: 'ANN-1002',
              active: true,
              type: 'maintenance',
              severity: 'warning',
              title: 'Scheduled Platform Maintenance',
              message: 'Maintenance in progress. Service will restore in approximately 15 minutes.',
              published_at: timestamp,
              acknowledgment_required: false,
            }
          : undefined,
        meta: {
          retry_after: 900,
          request_id: requestId,
          timestamp,
        },
      };
    }

    if (responseMode === 'quota_exceeded') {
      return {
        success: false,
        status: 'error',
        error: {
          code: 'QUOTA_EXCEEDED',
          message: 'Daily request limit exceeded. Upgrade your plan or contact your account administrator.',
        },
        announcement: includeAnnouncement
          ? {
              id: 'ANN-1003',
              active: true,
              type: 'warning',
              severity: 'warning',
              title: 'Usage Limit Threshold Reached',
              message: 'Your quota has reached 100%. Please contact support.',
              acknowledgment_required: false,
            }
          : undefined,
        usage: {
          daily_used: 5000,
          daily_limit: 5000,
          remaining: 0,
        },
        meta: {
          request_id: requestId,
          timestamp,
        },
      };
    }

    if (responseMode === 'invalid_key') {
      return {
        success: false,
        status: 'error',
        error: {
          code: 'INVALID_API_KEY',
          message: 'API Key provided is invalid, revoked or unauthorized for this endpoint.',
        },
        meta: {
          request_id: requestId,
          timestamp,
        },
      };
    }

    // Default Success Envelope
    const response: any = {
      success: true,
      developer: developerTag,
      req_left: 4982,
      req_total: 5000,
      expiry: '31-12-2099',
      response_time: '12ms',
      response_time_seconds: 0.01,
    };

    if (includeAnnouncement) {
      response.announcement = {
        id: 'ANN-1001',
        active: true,
        type: announcementType,
        severity: announcementType === 'critical' ? 'critical' : 'information',
        title: 'Platform Infrastructure Notice',
        message: 'All endpoints operating nominally with sub-millisecond route resolution.',
        published_at: timestamp,
        acknowledgment_required: false,
      };
    }

    response.data = {
      rc_number: 'DL01AB1234',
      vehicle_class: 'Motor Car (LMV)',
      fuel_type: 'PETROL',
      registration_date: '2022-04-15',
      status: 'ACTIVE',
    };

    return response;
  };

  const simulatedResponseJson = JSON.stringify(getSimulatedResponse(), null, 2);

  const copyResponse = () => {
    navigator.clipboard.writeText(simulatedResponseJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-mono select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A1A4A] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#A020F0] rounded-none shadow-[0_0_8px_#A020F0]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#F5F3FA] tracking-tight uppercase font-['Archivo_Black',sans-serif]">
              API Response Studio
            </h1>
          </div>
          <p className="text-xs text-[#A39BAD] mt-1">
            Configure, inspect and simulate production JSON response envelopes and announcement injections
          </p>
        </div>

        <button
          onClick={copyResponse}
          className="px-4 py-2.5 bg-[#100D17] border border-[#2A1A4A] hover:border-[#A020F0] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied' : 'Copy Sample Response'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Response Controls */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#100D17] border border-[#2A1A4A] p-5 space-y-5 shadow-xl">
            <span className="text-xs font-bold text-white uppercase tracking-wider block border-b border-[#2A1A4A] pb-2">
              Envelope Parameters
            </span>

            <div>
              <label className="block text-[11px] font-bold text-[#A39BAD] uppercase mb-1.5">
                Response Mode Simulation
              </label>
              <select
                value={responseMode}
                onChange={(e) => setResponseMode(e.target.value as any)}
                className="w-full bg-[#050508] border border-[#2A1A4A] p-2.5 text-xs text-white focus:outline-none focus:border-[#A020F0]"
              >
                <option value="success">HTTP 200 OK — Standard Success with Data</option>
                <option value="maintenance">HTTP 503 — Platform / API Maintenance Mode</option>
                <option value="quota_exceeded">HTTP 429 — Daily Quota Exceeded</option>
                <option value="invalid_key">HTTP 401 — Unauthorized / Invalid API Key</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#A39BAD] uppercase mb-1.5">
                Developer Branding Tag
              </label>
              <input
                type="text"
                value={developerTag}
                onChange={(e) => setDeveloperTag(e.target.value)}
                className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none focus:border-[#A020F0]"
                placeholder="arjunkahar"
              />
              <span className="text-[10px] text-[#A39BAD] mt-1 block">
                Injected into every response as <code className="text-[#A020F0]">&quot;developer&quot;: &quot;{developerTag}&quot;</code>
              </span>
            </div>

            <div className="pt-2 border-t border-[#2A1A4A] space-y-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={includeAnnouncement}
                  onChange={(e) => setIncludeAnnouncement(e.target.checked)}
                  className="accent-[#A020F0] w-4 h-4 cursor-pointer"
                />
                <span className="text-xs text-white font-bold">Inject Active Announcement Object</span>
              </label>

              {includeAnnouncement && (
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">
                    Simulated Announcement Severity
                  </label>
                  <select
                    value={announcementType}
                    onChange={(e) => setAnnouncementType(e.target.value)}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="information">Information</option>
                    <option value="warning">Warning</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              )}
            </div>

            <div className="bg-[#050508] border border-[#2A1A4A] p-3 text-[11px] text-[#A39BAD] space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Non-Breaking Invariant</span>
              </div>
              <p>
                All announcement injections occur safely in the JSON envelope without mutating original upstream vendor data payloads.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Live Envelope Inspector */}
        <div className="lg:col-span-7 bg-[#100D17] border border-[#2A1A4A] p-5 flex flex-col shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#2A1A4A] pb-3">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Code2 className="w-4 h-4 text-[#A020F0]" />
              <span>Live JSON Envelope Preview</span>
            </span>
            <span className="text-[10px] text-[#A020F0] font-bold">JSON Schema v2.0</span>
          </div>

          <pre className="flex-1 bg-[#050508] border border-[#2A1A4A] p-4 text-xs font-mono text-purple-200 overflow-x-auto min-h-[420px] max-h-[600px] leading-relaxed">
            {simulatedResponseJson}
          </pre>

          <div className="flex items-center justify-between text-[11px] text-[#A39BAD] border-t border-[#2A1A4A] pt-3">
            <span>Size: {new TextEncoder().encode(simulatedResponseJson).length} bytes</span>
            <span>Content-Type: application/json; charset=utf-8</span>
          </div>
        </div>
      </div>
    </div>
  );
};
