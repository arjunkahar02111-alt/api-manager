import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Modal } from '../../components/Modal';
import { Download, RefreshCw, Loader2, Search, Eye, X } from 'lucide-react';

export const AdminLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusCode, setStatusCode] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [statusCode, search]);

  const fetchLogs = async () => {
    setLoading(true);
    let url = `/api/v1/admin/logs?page=1&limit=50`;
    if (statusCode) url += `&statusCode=${statusCode}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    const res = await apiRequest(url, {}, 'admin');
    if (res.success) setLogs(res.data || []);
    setLoading(false);
  };

  const handleExportCsv = async () => {
    const adminToken = localStorage.getItem('arjun_admin_token');
    const res = await fetch('/api/v1/admin/logs/export', {
      headers: {
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gateway-logs-${new Date().toISOString().substring(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCustomerIdentifier = (customerId: any, keyPrefix?: string) => {
    if (keyPrefix) return keyPrefix;
    if (!customerId) return 'ANONYMOUS';
    if (typeof customerId === 'object') {
      return customerId.username || (customerId._id ? `ID: ${String(customerId._id).substring(0, 8)}` : 'CLIENT');
    }
    return `ID: ${String(customerId).substring(0, 8)}`;
  };

  return (
    <div className="p-8 lg:p-10 space-y-10 selection:bg-[#EF4444] selection:text-white">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#262626] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-[#EF4444]" />
            <span className="text-[11px] font-bold text-[#EF4444] uppercase tracking-[0.15em] font-mono">
              TRAFFIC AUDIT // REAL-TIME LOGS
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight uppercase leading-none">
            GATEWAY LOGS
          </h1>
          <p className="text-xs text-[#A3A3A3] font-mono uppercase mt-2">
            LIVE INSPECTION OF INCOMING PROXY REQUESTS, HTTP RESPONSES & LATENCY
          </p>
        </div>

        <div className="flex gap-2 self-start sm:self-auto font-mono">
          <button
            onClick={fetchLogs}
            className="p-2.5 bg-[#121212] border-2 border-white text-white hover:bg-[#EF4444] hover:border-[#EF4444] transition-colors rounded-none"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCsv}
            className="bg-white text-black hover:bg-[#EF4444] hover:text-white border-2 border-white hover:border-[#EF4444] px-4 py-2.5 text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors rounded-none"
          >
            <Download className="w-4 h-4" />
            [ EXPORT CSV ]
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 font-mono">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-[#737373]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH BY REQUEST ID, IP ADDRESS, OR ENDPOINT PATH..."
            className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white text-xs text-white placeholder-[#737373] uppercase pl-10 pr-4 py-2.5 rounded-none"
          />
        </div>

        <select
          value={statusCode}
          onChange={(e) => setStatusCode(e.target.value)}
          className="bg-[#121212] border-2 border-[#333333] focus:border-white text-xs text-white uppercase px-4 py-2.5 rounded-none"
        >
          <option value="">ALL STATUS CODES</option>
          <option value="200">200 OK</option>
          <option value="400">400 BAD REQUEST</option>
          <option value="401">401 UNAUTHORIZED</option>
          <option value="403">403 FORBIDDEN</option>
          <option value="404">404 NOT FOUND</option>
          <option value="429">429 RATE LIMITED</option>
          <option value="502">502 UPSTREAM ERROR</option>
        </select>
      </div>

      {/* Monospace Editorial Logs Table */}
      <div className="bg-[#121212] border-2 border-[#262626] rounded-none overflow-hidden font-mono">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-[#262626] bg-[#0A0A0A] text-[11px] text-[#A3A3A3] uppercase tracking-wider">
                <th className="py-4 px-6 font-bold">Method & Route</th>
                <th className="py-4 px-6 font-bold">Client Prefix</th>
                <th className="py-4 px-6 font-bold">Status</th>
                <th className="py-4 px-6 font-bold">Latency</th>
                <th className="py-4 px-6 font-bold">Bytes</th>
                <th className="py-4 px-6 font-bold">IP Address</th>
                <th className="py-4 px-6 font-bold">Timestamp</th>
                <th className="py-4 px-6 font-bold text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#A3A3A3] font-mono text-xs uppercase tracking-widest">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-white" />
                    STREAMING LIVE LOGS...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[#737373] uppercase tracking-wider">
                    NO REQUEST LOGS RECORDED YET.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l._id} className="hover:bg-[#181818] transition-colors">
                    <td className="py-3.5 px-6 font-bold">
                      <span className="text-[#EF4444] mr-2">[{l.method}]</span>
                      <span className="text-white">{l.routePath || l.endpoint || l.path}</span>
                    </td>
                    <td className="py-3.5 px-6 text-[#A3A3A3]">
                      {formatCustomerIdentifier(l.customerId, l.keyPrefix)}
                    </td>
                    <td className="py-3.5 px-6">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase border ${
                          l.statusCode < 300
                            ? 'bg-[#052E16] text-[#22C55E] border-[#16A34A]'
                            : l.statusCode === 429
                            ? 'bg-[#422006] text-[#FBBF24] border-[#CA8A04]'
                            : 'bg-[#450A0A] text-[#F87171] border-[#EF4444]'
                        }`}
                      >
                        {l.statusCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-white font-bold">{l.durationMs}ms</td>
                    <td className="py-3.5 px-6 text-[#A3A3A3]">
                      {l.responseBytes ? `${(l.responseBytes / 1024).toFixed(1)} KB` : '0 B'}
                    </td>
                    <td className="py-3.5 px-6 text-[#A3A3A3]">{l.ipAddress || l.sourceIp || '127.0.0.1'}</td>
                    <td className="py-3.5 px-6 text-[#737373]">
                      {new Date(l.createdAt || l.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        onClick={() => setSelectedLog(l)}
                        className="p-1 text-[#A3A3A3] hover:text-white border border-[#333333] hover:border-white transition-colors"
                        title="Deep Inspect Request"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Deep Request Investigation Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title="DEEP REQUEST INVESTIGATION"
        >
          <div className="space-y-4 font-mono text-xs">
            <div className="p-4 bg-[#0A0A0A] border-2 border-[#262626] space-y-2">
              <div className="flex justify-between items-center text-[#737373]">
                <span>REQUEST ID:</span>
                <span className="text-white font-bold">{selectedLog.requestId || selectedLog._id}</span>
              </div>
              <div className="flex justify-between items-center text-[#737373]">
                <span>ROUTE & METHOD:</span>
                <span className="text-[#EF4444] font-bold">[{selectedLog.method}] {selectedLog.routePath || selectedLog.endpoint || selectedLog.path}</span>
              </div>
              <div className="flex justify-between items-center text-[#737373]">
                <span>HTTP STATUS:</span>
                <span className={`font-bold ${selectedLog.statusCode < 300 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>{selectedLog.statusCode}</span>
              </div>
              <div className="flex justify-between items-center text-[#737373]">
                <span>TOTAL LATENCY:</span>
                <span className="text-white font-bold">{selectedLog.durationMs}ms</span>
              </div>
              <div className="flex justify-between items-center text-[#737373]">
                <span>SOURCE IP:</span>
                <span className="text-[#A3A3A3] font-bold">{selectedLog.ipAddress || selectedLog.sourceIp || '127.0.0.1'}</span>
              </div>
              <div className="flex justify-between items-center text-[#737373]">
                <span>CLIENT / KEY PREFIX:</span>
                <span className="text-white font-bold">{formatCustomerIdentifier(selectedLog.customerId, selectedLog.keyPrefix)}</span>
              </div>
              <div className="flex justify-between items-center text-[#737373]">
                <span>TIMESTAMP:</span>
                <span className="text-[#A3A3A3]">{new Date(selectedLog.createdAt || selectedLog.timestamp).toISOString()}</span>
              </div>
              {selectedLog.userAgent && (
                <div className="pt-2 border-t border-[#262626] text-[#737373]">
                  <span className="block mb-1">USER AGENT:</span>
                  <span className="text-[11px] text-[#A3A3A3] break-all">{selectedLog.userAgent}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedLog(null)}
              className="w-full bg-white text-black hover:bg-[#EF4444] hover:text-white border-2 border-white font-mono font-bold py-2.5 text-xs uppercase tracking-widest transition-colors rounded-none"
            >
              CLOSE INVESTIGATION
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
