import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Badge } from '../../components/Badge';
import { RefreshCw, Loader2 } from 'lucide-react';

export const AdminHealth: React.FC = () => {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHealth();
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/apis', {}, 'admin');
    if (res.success) setApis(res.data || []);
    setLoading(false);
  };

  return (
    <div className="p-8 lg:p-10 space-y-10 selection:bg-[#EF4444] selection:text-white">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#262626] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-[#EF4444]" />
            <span className="text-[11px] font-bold text-[#EF4444] uppercase tracking-[0.15em] font-mono">
              UPSTREAM TELEMETRY // HEALTH PROBES
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight uppercase leading-none">
            HEALTH TELEMETRY
          </h1>
          <p className="text-xs text-[#A3A3A3] font-mono uppercase mt-2">
            REAL-TIME LATENCY PROBES, FAILOVER TRACKING & UPSTREAM AVAILABILITY
          </p>
        </div>

        <button
          onClick={fetchHealth}
          className="self-start sm:self-auto p-2.5 bg-[#121212] border-2 border-white text-white hover:bg-[#EF4444] hover:border-[#EF4444] transition-colors rounded-none"
          title="Refresh health telemetry"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 font-mono">
        {loading ? (
          <div className="col-span-3 py-16 text-center text-[#A3A3A3] uppercase tracking-widest text-xs flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-white" />
            POLLING HEALTH PROBES...
          </div>
        ) : apis.length === 0 ? (
          <div className="col-span-3 py-16 text-center text-[#737373] uppercase tracking-wider text-xs border-2 border-[#262626]">
            NO UPSTREAM APIS CURRENTLY CONFIGURED.
          </div>
        ) : (
          apis.map((api) => (
            <div
              key={api._id}
              className="bg-[#121212] border-t-4 border-t-[#EF4444] border-x-2 border-b-2 border-[#262626] hover:border-white p-6 space-y-5 rounded-none transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                    {api.name}
                  </h3>
                  <p className="text-xs text-[#A3A3A3] mt-1 font-mono">/v1{api.gatewayPath}</p>
                </div>
                <Badge status={api.healthCheck?.lastStatus || 'active'} />
              </div>

              <div className="pt-4 border-t-2 border-[#262626] space-y-2.5 text-xs text-[#A3A3A3]">
                <div className="flex justify-between">
                  <span className="uppercase text-[#737373]">Probe Latency:</span>
                  <span className="text-white font-bold">{api.healthCheck?.lastLatencyMs ?? 0} MS</span>
                </div>
                <div className="flex justify-between">
                  <span className="uppercase text-[#737373]">Failures:</span>
                  <span className={api.healthCheck?.failureCount > 0 ? 'text-[#EF4444] font-bold' : 'text-[#22C55E] font-bold'}>
                    {api.healthCheck?.failureCount ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="uppercase text-[#737373]">Last Check:</span>
                  <span className="text-[#A3A3A3]">
                    {api.healthCheck?.lastCheckedAt ? new Date(api.healthCheck.lastCheckedAt).toLocaleTimeString() : 'READY'}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
