import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Activity } from 'lucide-react';

export const AdminAudit: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAudit();
  }, []);

  const fetchAudit = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/audit?limit=100', {}, 'admin');
    if (res.success) setLogs(res.data || []);
    setLoading(false);
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Security & Admin Audit Logs</h1>
        <p className="text-xs text-gray-400 mt-1">Immutable record of all privileged administrative events and modifications</p>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2D4A] bg-[#0B1020]/40 text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Admin</th>
                <th className="py-3 px-4">Target Resource</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A] text-sm font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-mono text-xs">
                    Loading audit trail...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-mono text-xs">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-[#172338]/50 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">{log.action}</td>
                    <td className="py-3.5 px-4 text-cyan-400">@{log.administratorUsername}</td>
                    <td className="py-3.5 px-4 text-gray-300">
                      {log.resourceType}: {log.resourceId}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.result === 'success'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {log.result}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">{log.sourceIp}</td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
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
