import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Cpu, HardDrive, RefreshCw, Server } from 'lucide-react';

export const AdminSystem: React.FC = () => {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    const res = await apiRequest('/api/v1/admin/system/metrics', {}, 'admin');
    if (res.success) setMetrics(res.data);
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">System & Server Telemetry</h1>
          <p className="text-xs text-gray-400 mt-1">Live VPS infrastructure resource utilization and database health</p>
        </div>
        <button
          onClick={fetchMetrics}
          className="p-2.5 bg-[#172338] text-gray-300 hover:text-white rounded-xl border border-[#1E2D4A]"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-xl p-5">
          <span className="text-xs font-medium text-gray-400 uppercase">CPU Cores & Load</span>
          <div className="text-xl font-bold font-mono text-white mt-2">
            {metrics?.cpu?.cores || 0} Cores
          </div>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Load: {metrics?.cpu?.loadAvg?.map((l: number) => l.toFixed(2)).join(', ') || 'N/A'}
          </p>
        </div>

        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-xl p-5">
          <span className="text-xs font-medium text-gray-400 uppercase">RAM Utilization</span>
          <div className="text-xl font-bold font-mono text-cyan-400 mt-2">
            {metrics?.memory?.usagePercentage || 0}%
          </div>
          <p className="text-xs text-gray-400 font-mono mt-1">
            {formatBytes(metrics?.memory?.usedBytes || 0)} / {formatBytes(metrics?.memory?.totalBytes || 0)}
          </p>
        </div>

        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-xl p-5">
          <span className="text-xs font-medium text-gray-400 uppercase">MongoDB Status</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-2">
            {metrics?.services?.mongodb?.status?.toUpperCase() || 'UNKNOWN'}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-1">Ready state: {metrics?.services?.mongodb?.readyState}</p>
        </div>

        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-xl p-5">
          <span className="text-xs font-medium text-gray-400 uppercase">Redis Health & Ping</span>
          <div className="text-xl font-bold font-mono text-emerald-400 mt-2">
            {metrics?.services?.redis?.status?.toUpperCase() || 'UNKNOWN'}
          </div>
          <p className="text-xs text-gray-400 font-mono mt-1">
            Latency: {metrics?.services?.redis?.latencyMs || 0} ms
          </p>
        </div>
      </div>
    </div>
  );
};
