import React, { useEffect, useState, useRef } from 'react';
import { apiRequest } from '../../services/api';
import {
  ShieldAlert,
  ShieldCheck,
  Radio,
  Lock,
  Unlock,
  AlertOctagon,
  RefreshCw,
  Ban,
  CheckCircle2,
  Trash2,
  Play,
  Pause,
  UserX,
} from 'lucide-react';

interface SecurityIncident {
  _id: string;
  incidentType: string;
  severity: string;
  sourceIp: string;
  customerUsername?: string;
  keyPrefix?: string;
  endpoint?: string;
  details?: any;
  actionTaken: string;
  createdAt: string;
}

interface BannedIp {
  _id: string;
  ip: string;
  reason: string;
  blockedBy: string;
  incidentCount: number;
  lastTriggeredAt: string;
  expiresAt?: string;
}

interface CustomerLock {
  _id: string;
  username: string;
  fullName: string;
  keyPrefix?: string;
  boundIp?: string;
  status: string;
  keySharingViolations: number;
}

interface TrafficLogItem {
  id: string;
  method: string;
  endpoint: string;
  sourceIp: string;
  statusCode: number;
  durationMs: number;
  customerUsername: string;
  keyPrefix: string;
  timestamp: string;
}

export const AdminSecurityMonitor: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [incidents, setIncidents] = useState<SecurityIncident[]>([]);
  const [blacklist, setBlacklist] = useState<BannedIp[]>([]);
  const [customers, setCustomers] = useState<CustomerLock[]>([]);
  const [trafficLogs, setTrafficLogs] = useState<TrafficLogItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  // New IP Ban Form
  const [newIp, setNewIp] = useState('');
  const [banReason, setBanReason] = useState('');
  const [banHours, setBanHours] = useState('24');
  const [actionMsg, setActionMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchInitialData();
    initSseStream();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    if (isStreaming && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [trafficLogs, isStreaming]);

  const fetchInitialData = async () => {
    setLoading(true);
    const [resStats, resIncidents, resBlacklist, resCustomers] = await Promise.all([
      apiRequest('/api/v1/admin/security/stats', {}, 'admin'),
      apiRequest('/api/v1/admin/security/incidents?limit=20', {}, 'admin'),
      apiRequest('/api/v1/admin/security/blacklist', {}, 'admin'),
      apiRequest('/api/v1/admin/customers?limit=50', {}, 'admin'),
    ]);

    if (resStats.success) setStats(resStats.data);
    if (resIncidents.success) setIncidents(resIncidents.data || []);
    if (resBlacklist.success) setBlacklist(resBlacklist.data || []);
    if (resCustomers.success) {
      setCustomers(
        (resCustomers.data || []).map((c: any) => ({
          _id: c._id,
          username: c.username,
          fullName: c.fullName,
          keyPrefix: c.keyPrefix,
          boundIp: c.boundIp,
          status: c.status,
          keySharingViolations: c.keySharingViolations || 0,
        }))
      );
    }
    setLoading(false);
  };

  const initSseStream = () => {
    try {
      // Connect to backend SSE live-stream
      const es = new EventSource('/api/v1/admin/monitoring/live-stream');
      eventSourceRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onerror = () => {
        setConnected(false);
      };

      es.addEventListener('traffic', (e: any) => {
        if (!isStreaming) return;
        try {
          const item = JSON.parse(e.data);
          setTrafficLogs((prev) => [
            ...prev.slice(-99),
            { ...item, id: `${item.requestId || Date.now()}-${Math.random()}` },
          ]);
        } catch {}
      });

      es.addEventListener('security_alert', (e: any) => {
        try {
          const alert = JSON.parse(e.data);
          setIncidents((prev) => [alert, ...prev.slice(0, 49)]);
          // Trigger data refresh to keep counts accurate
          fetchInitialData();
        } catch {}
      });

      es.addEventListener('ip_blacklisted', () => {
        fetchInitialData();
      });

      es.addEventListener('ip_unbanned', () => {
        fetchInitialData();
      });
    } catch (err) {
      console.warn('SSE connection failed:', err);
    }
  };

  const handleBanIp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIp.trim()) return;

    const res = await apiRequest(
      '/api/v1/admin/security/blacklist',
      {
        method: 'POST',
        body: JSON.stringify({
          ip: newIp.trim(),
          reason: banReason.trim() || 'Manual Administrative Ban',
          expiresInHours: banHours === 'permanent' ? undefined : parseInt(banHours, 10),
        }),
      },
      'admin'
    );

    if (res.success) {
      setActionMsg({ type: 'success', text: `IP ${newIp} banned successfully.` });
      setNewIp('');
      setBanReason('');
      fetchInitialData();
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to ban IP' });
    }
  };

  const handleUnbanIp = async (ip: string) => {
    const res = await apiRequest(`/api/v1/admin/security/blacklist/${encodeURIComponent(ip)}`, { method: 'DELETE' }, 'admin');
    if (res.success) {
      setActionMsg({ type: 'success', text: `IP ${ip} unbanned.` });
      fetchInitialData();
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to unban IP' });
    }
  };

  const handleResetBoundIp = async (customerId: string, username: string) => {
    if (!window.confirm(`Reset IP lock for customer '${username}'? Next incoming request will auto-bind to the customer's IP.`)) {
      return;
    }

    const res = await apiRequest(
      `/api/v1/admin/security/customers/${customerId}/reset-bound-ip`,
      { method: 'POST', body: JSON.stringify({}) },
      'admin'
    );

    if (res.success) {
      setActionMsg({ type: 'success', text: `IP lock reset for ${username}. Customer can now bind from their new location.` });
      fetchInitialData();
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to reset bound IP' });
    }
  };

  return (
    <div className="p-8 lg:p-10 space-y-10 selection:bg-[#A020F0] selection:text-white bg-[#050508] min-h-screen text-[#F5F3FA]">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#1F1930] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 ${connected ? 'bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]' : 'bg-[#A020F0]'}`} />
            <span className="text-[11px] font-bold text-[#C77DFF] uppercase tracking-[0.15em] font-mono">
              KARVION SHIELD // REAL-TIME DEFENSE ENGINE
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight uppercase leading-none">
            SECURITY & LIVE MONITOR
          </h1>
          <p className="text-xs text-[#A39BAD] font-mono uppercase mt-2">
            ANTI-KEY SHARING • SINGLE-IP LOCKS • SINGLE-SESSION ENFORCEMENT • REAL-TIME SSE TELEMETRY
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121212] border-2 border-[#333333] text-xs">
            <Radio className={`w-3.5 h-3.5 ${connected ? 'text-[#10B981] animate-pulse' : 'text-[#EF4444]'}`} />
            <span className="text-white font-bold">{connected ? 'LIVE STREAM ACTIVE' : 'STREAM DISCONNECTED'}</span>
          </div>
          <button
            onClick={fetchInitialData}
            className="p-2 bg-[#121212] border-2 border-white hover:bg-[#EF4444] hover:border-[#EF4444] text-white transition-colors"
            title="Refresh All Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {actionMsg && (
        <div
          className={`p-4 border-2 font-mono text-xs flex justify-between items-center ${
            actionMsg.type === 'success'
              ? 'bg-[#064E3B]/20 border-[#10B981] text-[#10B981]'
              : 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444]'
          }`}
        >
          <span>{actionMsg.text}</span>
          <button onClick={() => setActionMsg(null)} className="text-white hover:underline uppercase text-[10px]">
            [DISMISS]
          </button>
        </div>
      )}

      {/* Security Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono">
        <div className="bg-[#121212] border-t-4 border-t-[#10B981] border-x-2 border-b-2 border-[#262626] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3A3A3] uppercase">
            <span>SINGLE-USER LOGIN</span>
            <Lock className="w-4 h-4 text-[#10B981]" />
          </div>
          <div className="text-2xl font-bold text-white uppercase">STRICT (1 SESSION)</div>
          <p className="text-[11px] text-[#A3A3A3]">Zero duplicate logins. Instant termination on concurrent access.</p>
        </div>

        <div className="bg-[#121212] border-t-4 border-t-[#EF4444] border-x-2 border-b-2 border-[#262626] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3A3A3] uppercase">
            <span>BANNED IPS</span>
            <Ban className="w-4 h-4 text-[#EF4444]" />
          </div>
          <div className="text-2xl font-bold text-[#EF4444]">{stats?.bannedIpsCount ?? blacklist.length}</div>
          <p className="text-[11px] text-[#A3A3A3]">Permanently blocked abusive IPs & key-sharing violators.</p>
        </div>

        <div className="bg-[#121212] border-t-4 border-t-[#F59E0B] border-x-2 border-b-2 border-[#262626] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3A3A3] uppercase">
            <span>KEY SHARING VIOLATIONS</span>
            <AlertOctagon className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold text-[#F59E0B]">{stats?.criticalIncidents ?? 0}</div>
          <p className="text-[11px] text-[#A3A3A3]">Keys auto-revoked due to multi-user IP sharing attempts.</p>
        </div>

        <div className="bg-[#121212] border-t-4 border-t-white border-x-2 border-b-2 border-[#262626] p-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#A3A3A3] uppercase">
            <span>LOCKED SINGLE-IP KEYS</span>
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div className="text-2xl font-bold text-white">{stats?.lockedCustomers ?? customers.filter((c) => c.boundIp).length}</div>
          <p className="text-[11px] text-[#A3A3A3]">Client keys locked strictly to single verified IP.</p>
        </div>
      </div>

      {/* Live Gateway Traffic Terminal */}
      <div className="bg-[#0D0D0D] border-2 border-[#262626] font-mono">
        <div className="p-4 border-b-2 border-[#262626] flex items-center justify-between bg-[#141414]">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-[#EF4444]" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">
              REAL-TIME TRAFFIC & PROXY TELEMETRY STREAM
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsStreaming(!isStreaming)}
              className="px-3 py-1 bg-[#262626] hover:bg-white hover:text-black text-white text-[11px] font-bold uppercase transition-colors flex items-center gap-1.5"
            >
              {isStreaming ? (
                <>
                  <Pause className="w-3 h-3 text-[#F59E0B]" /> PAUSE STREAM
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 text-[#10B981]" /> RESUME STREAM
                </>
              )}
            </button>
            <button
              onClick={() => setTrafficLogs([])}
              className="p-1.5 bg-[#262626] hover:bg-[#EF4444] text-white transition-colors"
              title="Clear Terminal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="p-4 h-72 overflow-y-auto space-y-1.5 text-xs text-[#A3A3A3]">
          {trafficLogs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[#555555]">
              WAITING FOR INCOMING API GATEWAY TRAFFIC... (CURL REQUESTS TO :3001/v1/* WILL APPEAR LIVE HERE)
            </div>
          ) : (
            trafficLogs.map((log) => {
              const isOk = log.statusCode >= 200 && log.statusCode < 400;
              const isRate = log.statusCode === 429;
              const isBlocked = log.statusCode === 403;
              const statusColor = isOk
                ? 'text-[#10B981]'
                : isRate
                ? 'text-[#F59E0B]'
                : isBlocked
                ? 'text-[#EF4444] font-bold'
                : 'text-[#EF4444]';

              return (
                <div key={log.id} className="flex flex-wrap items-center gap-2 py-0.5 border-b border-[#1A1A1A]">
                  <span className="text-[#666666]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span className="font-bold text-white px-1.5 py-0.5 bg-[#1F1F1F] text-[10px]">{log.method}</span>
                  <span className="text-white truncate max-w-xs">{log.endpoint}</span>
                  <span className={statusColor}>[{log.statusCode}]</span>
                  <span className="text-[#888888]">IP: {log.sourceIp}</span>
                  <span className="text-[#A3A3A3]">User: {log.customerUsername}</span>
                  <span className="text-[#555555]">Key: {log.keyPrefix}</span>
                  <span className="text-[#10B981] ml-auto">{log.durationMs}ms</span>
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>
      </div>

      {/* Key Sharing & Single-IP Lock Registry */}
      <div className="space-y-4 font-mono">
        <div className="flex items-center justify-between border-b-2 border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#EF4444]" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">
              CLIENT API KEY & SINGLE-IP LOCK REGISTRY
            </h2>
          </div>
          <span className="text-xs text-[#A3A3A3] uppercase">
            STRICT POLICY: 1 IP PER KEY • AUTO-BAN ON SHARING
          </span>
        </div>

        <div className="border-2 border-[#262626] bg-[#121212] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#262626] bg-[#181818] text-[#A3A3A3] uppercase">
                <th className="p-4 font-bold">Customer Account</th>
                <th className="p-4 font-bold">API Key Prefix</th>
                <th className="p-4 font-bold">Bound Single IP</th>
                <th className="p-4 font-bold">Sharing Violations</th>
                <th className="p-4 font-bold">Account Status</th>
                <th className="p-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-white">
              {customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#A3A3A3]">
                    NO CUSTOMERS REGISTERED
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c._id} className="hover:bg-[#1A1A1A] transition-colors">
                    <td className="p-4 font-bold">{c.username}</td>
                    <td className="p-4 text-[#A3A3A3]">{c.keyPrefix || 'N/A'}</td>
                    <td className="p-4">
                      {c.boundIp ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#10B981]/10 border border-[#10B981] text-[#10B981] font-bold">
                          <Lock className="w-3 h-3" />
                          LOCKED: {c.boundIp}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#F59E0B]/10 border border-[#F59E0B] text-[#F59E0B] font-bold">
                          <Unlock className="w-3 h-3" />
                          UNBOUND (NEXT REQUEST AUTO-LOCKS)
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {c.keySharingViolations > 0 ? (
                        <span className="px-2 py-0.5 bg-[#EF4444] text-white font-bold">
                          {c.keySharingViolations} VIOLATIONS
                        </span>
                      ) : (
                        <span className="text-[#10B981]">0 CLEAN</span>
                      )}
                    </td>
                    <td className="p-4 uppercase">
                      <span
                        className={`px-2 py-0.5 text-[11px] font-bold ${
                          c.status === 'active'
                            ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]'
                            : 'bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]'
                        }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleResetBoundIp(c._id, c.username)}
                        className="px-3 py-1.5 bg-[#1F1F1F] hover:bg-white hover:text-black border border-[#333333] hover:border-white font-bold text-[11px] uppercase transition-colors"
                      >
                        [ UNLOCK / RESET IP ]
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Global IP Blacklist Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 font-mono">
        {/* Ban Form */}
        <div className="bg-[#121212] border-2 border-[#262626] p-6 space-y-4 self-start">
          <div className="flex items-center gap-2 border-b-2 border-[#262626] pb-3">
            <Ban className="w-5 h-5 text-[#EF4444]" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              MANUALLY BAN IP ADDRESS
            </h3>
          </div>

          <form onSubmit={handleBanIp} className="space-y-4">
            <div>
              <label className="block text-[11px] text-[#A3A3A3] uppercase mb-1">Target IP Address</label>
              <input
                type="text"
                value={newIp}
                onChange={(e) => setNewIp(e.target.value)}
                placeholder="e.g. 192.168.1.100"
                required
                className="w-full bg-[#181818] border-2 border-[#333333] focus:border-white px-3 py-2 text-white text-xs rounded-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#A3A3A3] uppercase mb-1">Reason for Ban</label>
              <input
                type="text"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Unauthorized key sharing attempt"
                className="w-full bg-[#181818] border-2 border-[#333333] focus:border-white px-3 py-2 text-white text-xs rounded-none"
              />
            </div>

            <div>
              <label className="block text-[11px] text-[#A3A3A3] uppercase mb-1">Duration</label>
              <select
                value={banHours}
                onChange={(e) => setBanHours(e.target.value)}
                className="w-full bg-[#181818] border-2 border-[#333333] focus:border-white px-3 py-2 text-white text-xs rounded-none"
              >
                <option value="1">1 Hour</option>
                <option value="24">24 Hours (1 Day)</option>
                <option value="168">7 Days (1 Week)</option>
                <option value="permanent">Permanent (Strict Block)</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-[#EF4444] hover:bg-white hover:text-black text-white font-bold py-2.5 text-xs uppercase tracking-widest transition-colors rounded-none"
            >
              [ ENFORCE BAN ON IP ]
            </button>
          </form>
        </div>

        {/* Blacklisted IPs Table */}
        <div className="lg:col-span-2 bg-[#121212] border-2 border-[#262626] p-6 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-[#262626] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              ACTIVE IP BLACKLIST ({blacklist.length})
            </h3>
            <span className="text-[11px] text-[#A3A3A3] uppercase">INSTANT 403 ON REJECT</span>
          </div>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#262626] bg-[#181818] text-[#A3A3A3] uppercase">
                  <th className="p-3">Banned IP</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Triggered</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626] text-white">
                {blacklist.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-[#A3A3A3]">
                      NO BLACKLISTED IPS ACTIVE
                    </td>
                  </tr>
                ) : (
                  blacklist.map((item) => (
                    <tr key={item._id} className="hover:bg-[#1A1A1A]">
                      <td className="p-3 font-bold text-[#EF4444]">{item.ip}</td>
                      <td className="p-3 text-[#A3A3A3] truncate max-w-xs">{item.reason}</td>
                      <td className="p-3 text-[#888888]">{item.incidentCount}x</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleUnbanIp(item.ip)}
                          className="px-2.5 py-1 bg-[#1F1F1F] hover:bg-[#10B981] hover:text-black text-white border border-[#333333] hover:border-[#10B981] font-bold text-[10px] uppercase transition-colors"
                        >
                          [ UNBAN ]
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Security Incidents Audit Trail */}
      <div className="space-y-4 font-mono">
        <div className="flex items-center justify-between border-b-2 border-[#262626] pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
            <h2 className="text-lg font-bold text-white uppercase tracking-wider">
              SECURITY INCIDENTS & AUTO-BAN LOGS
            </h2>
          </div>
          <span className="text-xs text-[#A3A3A3] uppercase">
            IMMUTABLE EVENT LOG
          </span>
        </div>

        <div className="border-2 border-[#262626] bg-[#121212] overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-[#262626] bg-[#181818] text-[#A3A3A3] uppercase">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Incident Type</th>
                <th className="p-4">Severity</th>
                <th className="p-4">Offending IP</th>
                <th className="p-4">Target / Key</th>
                <th className="p-4">Automated Action Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626] text-white">
              {incidents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#A3A3A3]">
                    NO SECURITY INCIDENTS RECORDED
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr key={inc._id} className="hover:bg-[#1A1A1A]">
                    <td className="p-4 text-[#888888]">{new Date(inc.createdAt).toLocaleString()}</td>
                    <td className="p-4 font-bold text-[#EF4444]">{inc.incidentType}</td>
                    <td className="p-4">
                      <span className="px-2 py-0.5 bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444] font-bold text-[10px]">
                        {inc.severity}
                      </span>
                    </td>
                    <td className="p-4 font-bold">{inc.sourceIp}</td>
                    <td className="p-4 text-[#A3A3A3]">
                      {inc.keyPrefix || inc.customerUsername || inc.endpoint || 'Gateway'}
                    </td>
                    <td className="p-4 text-[#10B981] font-bold">{inc.actionTaken}</td>
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
