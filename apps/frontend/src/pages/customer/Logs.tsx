import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Download, RefreshCw } from 'lucide-react';

export const CustomerLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/customer/logs?limit=50', {}, 'customer');
    if (res.success) setLogs(res.data || []);
    setLoading(false);
  };

  const handleExport = () => {
    window.open('/api/v1/customer/logs/export', '_blank');
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">My Request History</h1>
          <p className="text-xs text-gray-400 mt-1">Audit trail of API requests authenticated by your key</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchLogs}
            className="p-2.5 bg-[#172338] text-gray-300 hover:text-white rounded-xl border border-[#1E2D4A]"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExport}
            className="bg-[#172338] hover:bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2D4A] bg-[#0B1020]/40 text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Method & Endpoint</th>
                <th className="py-3 px-4">API Name</th>
                <th className="py-3 px-4">HTTP Status</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A] font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    Loading your request history...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500">
                    No requests recorded yet. Make a request via the playground or API.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l._id} className="hover:bg-[#172338]/50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="font-bold text-cyan-400 mr-2">{l.method}</span>
                      <span className="text-gray-200">{l.endpoint}</span>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{l.apiId?.name || 'Endpoint'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          l.statusCode < 400
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {l.statusCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-400">{l.durationMs}ms</td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(l.timestamp).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
