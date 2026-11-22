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
  Key,
  Laptop,
  Smartphone,
  Globe,
  Clock,
  LogOut,
  AlertCircle,
  QrCode,
  Copy,
  Check,
  Loader2,
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

interface AdminSessionItem {
  id: string;
  sessionId: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  createdAt: string;
  lastActivityAt: string;
  isCurrent: boolean;
}

export const AdminSecurityMonitor: React.FC = () => {
  type SecurityTab = 'telemetry' | 'waf' | 'sessions' | 'access';
  const [activeTab, setActiveTab] = useState<SecurityTab>('telemetry');

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

  // Sessions state
  const [sessions, setSessions] = useState<AdminSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Passphrase Change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // MFA state
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [enrollingMfa, setEnrollingMfa] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [disablingMfa, setDisablingMfa] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchInitialData();
    initSseStream();
    fetchAdminMe();

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
      apiRequest('/api/v1/admin/security/incidents?limit=50', {}, 'admin'),
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

  const fetchSessions = async () => {
    setLoadingSessions(true);
    const res = await apiRequest('/api/v1/admin/auth/sessions', {}, 'admin');
    if (res.success) {
      setSessions(res.data || []);
    }
    setLoadingSessions(false);
  };

  const fetchAdminMe = async () => {
    const res = await apiRequest('/api/v1/admin/auth/me', {}, 'admin');
    if (res.success && res.data?.admin) {
      setAdminProfile(res.data.admin);
    }
  };

  const initSseStream = () => {
    try {
      const es = new EventSource('/api/v1/admin/monitoring/live-stream');
      eventSourceRef.current = es;

      es.onopen = () => setConnected(true);
      es.onerror = () => setConnected(false);

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
          fetchInitialData();
        } catch {}
      });

      es.addEventListener('ip_blacklisted', () => fetchInitialData());
      es.addEventListener('ip_unbanned', () => fetchInitialData());
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

  const handleRevokeSession = async (sessionId: string) => {
    if (!window.confirm('Revoke this administrator session immediately?')) return;
    const res = await apiRequest(`/api/v1/admin/auth/sessions/${sessionId}`, { method: 'DELETE' }, 'admin');
    if (res.success) {
      setActionMsg({ type: 'success', text: 'Administrator session revoked successfully.' });
      fetchSessions();
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to revoke session' });
    }
  };

  const handleLogoutAllOtherSessions = async () => {
    if (!window.confirm('Logout all other devices? All other active sessions will be terminated immediately.')) return;
    const res = await apiRequest('/api/v1/admin/auth/logout-all', { method: 'POST' }, 'admin');
    if (res.success) {
      setActionMsg({ type: 'success', text: 'All other administrator sessions have been revoked.' });
      fetchSessions();
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to revoke sessions' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setActionMsg({ type: 'error', text: 'New passphrase and confirmation do not match.' });
      return;
    }

    setChangingPassword(true);
    setActionMsg(null);

    const res = await apiRequest(
      '/api/v1/admin/auth/change-password',
      {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      'admin'
    );

    if (res.success) {
      setActionMsg({
        type: 'success',
        text: 'Passphrase changed successfully! All sessions have been revoked. Please re-authenticate.',
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to change passphrase' });
    }
    setChangingPassword(false);
  };

  const handleStartMfaSetup = async () => {
    const res = await apiRequest('/api/v1/admin/auth/mfa/setup', {}, 'admin');
    if (res.success && res.data) {
      setMfaSetupData(res.data);
      setMfaCode('');
      setBackupCodes([]);
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to generate MFA setup' });
    }
  };

  const handleEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaSetupData || !mfaCode.trim()) return;

    setEnrollingMfa(true);
    const res = await apiRequest(
      '/api/v1/admin/auth/mfa/enable',
      {
        method: 'POST',
        body: JSON.stringify({ secret: mfaSetupData.secret, code: mfaCode.trim() }),
      },
      'admin'
    );

    if (res.success && res.data) {
      setActionMsg({ type: 'success', text: 'Multi-Factor Authentication enabled successfully!' });
      setBackupCodes(res.data.backupCodes || []);
      setMfaSetupData(null);
      fetchAdminMe();
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Invalid verification code.' });
    }
    setEnrollingMfa(false);
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disablePassword || !disableCode) return;

    setDisablingMfa(true);
    const res = await apiRequest(
      '/api/v1/admin/auth/mfa/disable',
      {
        method: 'POST',
        body: JSON.stringify({ password: disablePassword, code: disableCode }),
      },
      'admin'
    );

    if (res.success) {
      setActionMsg({ type: 'success', text: 'Multi-Factor Authentication disabled.' });
      setDisablePassword('');
      setDisableCode('');
      fetchAdminMe();
    } else {
      setActionMsg({ type: 'error', text: res.error?.message || 'Failed to disable MFA.' });
    }
    setDisablingMfa(false);
  };

  // Filter WAF incidents
  const wafIncidents = incidents.filter(
    (inc) =>
      inc.incidentType === 'WAF_RULE_TRIGGERED' ||
      inc.actionTaken === 'BLOCKED_BY_WAF' ||
      inc.incidentType.includes('SQLI') ||
      inc.incidentType.includes('XSS') ||
      inc.incidentType.includes('TRAVERSAL') ||
      inc.incidentType.includes('RCE')
  );

  return (
    <div className="p-6 lg:p-10 space-y-8 selection:bg-[#A020F0] selection:text-white bg-[#050508] min-h-screen text-[#F5F3FA]">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#1F1930] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2.5 h-2.5 ${connected ? 'bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]' : 'bg-[#A020F0]'}`} />
            <span className="text-[11px] font-bold text-[#C77DFF] uppercase tracking-[0.15em] font-mono">
              KARVION SHIELD // ENTERPRISE DEFENSE ENGINE
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-white tracking-tight uppercase leading-none">
            SECURITY & LIVE MONITOR
          </h1>
          <p className="text-xs text-[#A39BAD] font-mono uppercase mt-2">
            WAF THREAT ENGINE • MULTI-DEVICE SESSIONS • MANDATORY CLEARANCE • REAL-TIME SSE TELEMETRY
          </p>
        </div>

        <div className="flex items-center gap-3 font-mono">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121212] border-2 border-[#333333] text-xs">
            <Radio className={`w-3.5 h-3.5 ${connected ? 'text-[#10B981] animate-pulse' : 'text-[#EF4444]'}`} />
            <span className="text-white font-bold">{connected ? 'LIVE STREAM ACTIVE' : 'STREAM DISCONNECTED'}</span>
          </div>
          <button
            onClick={() => {
              fetchInitialData();
              if (activeTab === 'sessions') fetchSessions();
              if (activeTab === 'access') fetchAdminMe();
            }}
            className="p-2 bg-[#121212] border-2 border-white hover:bg-[#A020F0] hover:border-[#A020F0] text-white transition-colors"
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

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b-2 border-[#1F1930] gap-2 font-mono text-xs overflow-x-auto pb-px">
        <button
          onClick={() => setActiveTab('telemetry')}
          className={`px-4 py-2.5 font-bold uppercase transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-0.5 ${
            activeTab === 'telemetry'
              ? 'border-[#A020F0] text-white bg-[#140F22]'
              : 'border-transparent text-[#A39BAD] hover:text-white hover:bg-[#0E0A1A]'
          }`}
        >
          <Radio className="w-4 h-4 text-[#C77DFF]" />
          <span>Threat Telemetry &amp; Gateway</span>
        </button>

        <button
          onClick={() => setActiveTab('waf')}
          className={`px-4 py-2.5 font-bold uppercase transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-0.5 ${
            activeTab === 'waf'
              ? 'border-[#A020F0] text-white bg-[#140F22]'
              : 'border-transparent text-[#A39BAD] hover:text-white hover:bg-[#0E0A1A]'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
          <span>Web App Firewall (WAF)</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('sessions');
            fetchSessions();
          }}
          className={`px-4 py-2.5 font-bold uppercase transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-0.5 ${
            activeTab === 'sessions'
              ? 'border-[#A020F0] text-white bg-[#140F22]'
              : 'border-transparent text-[#A39BAD] hover:text-white hover:bg-[#0E0A1A]'
          }`}
        >
          <Lock className="w-4 h-4 text-[#10B981]" />
          <span>Active Admin Sessions</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('access');
            fetchAdminMe();
          }}
          className={`px-4 py-2.5 font-bold uppercase transition-all flex items-center gap-2 cursor-pointer border-b-2 -mb-0.5 ${
            activeTab === 'access'
              ? 'border-[#A020F0] text-white bg-[#140F22]'
              : 'border-transparent text-[#A39BAD] hover:text-white hover:bg-[#0E0A1A]'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-[#C77DFF]" />
          <span>Operator Passphrase &amp; MFA</span>
        </button>
      </div>

      {/* TAB 1: THREAT TELEMETRY & GATEWAY (PRESERVED) */}
      {activeTab === 'telemetry' && (
        <div className="space-y-8">
          {/* Security Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 font-mono">
            <div className="bg-[#121212] border-t-4 border-t-[#10B981] border-x-2 border-b-2 border-[#262626] p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#A3A3A3] uppercase">
                <span>CLEARANCE LOGIN</span>
                <Lock className="w-4 h-4 text-[#10B981]" />
              </div>
              <div className="text-2xl font-bold text-white uppercase">MANDATORY</div>
              <p className="text-[11px] text-[#A3A3A3]">Zero auto-fill. Strict operator authentication required.</p>
            </div>

            <div className="bg-[#121212] border-t-4 border-t-[#EF4444] border-x-2 border-b-2 border-[#262626] p-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-[#A3A3A3] uppercase">
                <span>BANNED IPS</span>
                <Ban className="w-4 h-4 text-[#EF4444]" />
              </div>
              <div className="text-2xl font-bold text-[#EF4444]">{stats?.bannedIpsCount ?? blacklist.length}</div>
              <p className="text-[11px] text-[#A3A3A3]">Permanently blocked abusive IPs &amp; key-sharing violators.</p>
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
              <div className="text-2xl font-bold text-white">
                {stats?.lockedCustomers ?? customers.filter((c) => c.boundIp).length}
              </div>
              <p className="text-[11px] text-[#A3A3A3]">Client keys locked strictly to single verified IP.</p>
            </div>
          </div>

          {/* Live Gateway Traffic Terminal */}
          <div className="bg-[#0D0D0D] border-2 border-[#262626] font-mono">
            <div className="p-4 border-b-2 border-[#262626] flex items-center justify-between bg-[#141414]">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-[#10B981] animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  LIVE GATEWAY TRAFFIC STREAM
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsStreaming(!isStreaming)}
                  className="px-3 py-1 bg-[#222222] border border-[#444444] text-[10px] text-white hover:bg-white hover:text-black font-bold uppercase transition-colors"
                >
                  {isStreaming ? '[ PAUSE STREAM ]' : '[ RESUME STREAM ]'}
                </button>
                <button
                  onClick={() => setTrafficLogs([])}
                  className="px-3 py-1 bg-[#222222] border border-[#444444] text-[10px] text-white hover:bg-[#EF4444] hover:border-[#EF4444] font-bold uppercase transition-colors"
                >
                  [ CLEAR ]
                </button>
              </div>
            </div>

            <div className="h-64 overflow-y-auto p-4 space-y-1.5 text-xs text-[#E5E5E5]">
              {trafficLogs.length === 0 ? (
                <div className="text-center text-[#666666] py-12">
                  WAITING FOR INCOMING API TRAFFIC STREAM...
                </div>
              ) : (
                trafficLogs.map((log) => (
                  <div key={log.id} className="flex items-center gap-3 hover:bg-[#1A1A1A] px-2 py-0.5 rounded">
                    <span className="text-[#888888]">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className={`font-bold ${log.statusCode < 400 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                      {log.statusCode}
                    </span>
                    <span className="px-1.5 py-0.2 bg-[#222] text-[#C77DFF] font-bold text-[10px]">
                      {log.method}
                    </span>
                    <span className="text-white font-mono">{log.endpoint}</span>
                    <span className="text-[#888888]">IP: {log.sourceIp}</span>
                    <span className="text-[#A39BAD]">Client: {log.customerUsername || 'Public'}</span>
                    <span className="text-[#A020F0] text-[10px] ml-auto">{log.durationMs}ms</span>
                  </div>
                ))
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Customer Single-IP Binding Management Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 font-mono">
            {/* Customer IP Lock Status */}
            <div className="bg-[#121212] border-2 border-[#262626] p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#262626] pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#10B981]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Client Single-IP Locks
                  </h3>
                </div>
                <span className="text-[10px] text-[#A3A3A3] uppercase">
                  ANTI-KEY SHARING ENFORCER
                </span>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#262626] text-[#A3A3A3] uppercase text-[10px]">
                      <th className="p-2.5">Client</th>
                      <th className="p-2.5">Locked IP</th>
                      <th className="p-2.5">Violations</th>
                      <th className="p-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626] text-white">
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-[#A3A3A3]">
                          NO CLIENT ACCOUNTS REGISTERED
                        </td>
                      </tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c._id} className="hover:bg-[#1A1A1A]">
                          <td className="p-2.5 font-bold">
                            <div>{c.username}</div>
                            <div className="text-[10px] text-[#888888]">{c.keyPrefix}</div>
                          </td>
                          <td className="p-2.5 font-mono">
                            {c.boundIp ? (
                              <span className="text-[#10B981] font-bold">{c.boundIp}</span>
                            ) : (
                              <span className="text-[#F59E0B] italic text-[11px]">Unbound (Next Req Auto-Binds)</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <span className={c.keySharingViolations > 0 ? 'text-[#EF4444] font-bold' : 'text-[#888888]'}>
                              {c.keySharingViolations}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {c.boundIp && (
                              <button
                                onClick={() => handleResetBoundIp(c._id, c.username)}
                                className="px-2 py-1 bg-[#1F1F1F] hover:bg-[#EF4444] text-white border border-[#333333] hover:border-[#EF4444] font-bold text-[10px] uppercase transition-colors"
                              >
                                [ UNLOCK IP ]
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Banned IP Management */}
            <div className="bg-[#121212] border-2 border-[#262626] p-6 space-y-4">
              <div className="flex items-center justify-between border-b-2 border-[#262626] pb-3">
                <div className="flex items-center gap-2">
                  <Ban className="w-4 h-4 text-[#EF4444]" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Active IP Blacklist &amp; Auto-Bans
                  </h3>
                </div>
                <span className="text-[10px] text-[#A3A3A3] uppercase">FIREWALL SYNC</span>
              </div>

              <form onSubmit={handleBanIp} className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1">
                <input
                  type="text"
                  placeholder="IP to Ban (e.g. 192.168.1.1)"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  className="sm:col-span-2 bg-[#050508] border border-[#2A1A4A] px-3 py-1.5 text-xs text-white font-mono focus:border-[#EF4444] focus:outline-none"
                  required
                />
                <select
                  value={banHours}
                  onChange={(e) => setBanHours(e.target.value)}
                  className="bg-[#050508] border border-[#2A1A4A] px-2 py-1.5 text-xs text-white font-mono focus:outline-none"
                >
                  <option value="1">1 Hour</option>
                  <option value="24">24 Hours</option>
                  <option value="168">7 Days</option>
                  <option value="permanent">Permanent</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Ban IP
                </button>
              </form>

              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#262626] text-[#A3A3A3] uppercase text-[10px]">
                      <th className="p-2.5">Banned IP</th>
                      <th className="p-2.5">Reason</th>
                      <th className="p-2.5">Incidents</th>
                      <th className="p-2.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262626] text-white">
                    {blacklist.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-[#A3A3A3]">
                          NO BLACKLISTED IPS ACTIVE
                        </td>
                      </tr>
                    ) : (
                      blacklist.map((b) => (
                        <tr key={b._id} className="hover:bg-[#1A1A1A]">
                          <td className="p-2.5 font-bold text-[#EF4444]">{b.ip}</td>
                          <td className="p-2.5 text-[#A3A3A3] truncate max-w-xs">{b.reason}</td>
                          <td className="p-2.5 text-[#888888]">{b.incidentCount}x</td>
                          <td className="p-2.5">
                            <button
                              onClick={() => handleUnbanIp(b.ip)}
                              className="px-2 py-1 bg-[#1F1F1F] hover:bg-[#10B981] hover:text-black text-white border border-[#333333] hover:border-[#10B981] font-bold text-[10px] uppercase transition-colors"
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
                  SECURITY INCIDENTS &amp; AUTO-BAN LOGS
                </h2>
              </div>
              <span className="text-xs text-[#A3A3A3] uppercase">IMMUTABLE EVENT LOG</span>
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
      )}

      {/* TAB 2: WEB APPLICATION FIREWALL (WAF) */}
      {activeTab === 'waf' && (
        <div className="space-y-8 font-mono">
          <div className="bg-[#100D17] border-2 border-[#1F1930] p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1F1930] gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                    Web Application Firewall Status &amp; Threat Rules
                  </h2>
                  <span className="text-[10px] bg-emerald-950/40 text-emerald-400 px-2.5 py-0.5 border border-emerald-500/40 font-mono uppercase">
                    ACTIVE FILTERING
                  </span>
                </div>
                <p className="text-xs text-[#A39BAD] mt-1">
                  Multi-layered request inspection for SQLi, XSS, Path Traversal, RCE, and reconnaissance probes.
                </p>
              </div>
            </div>

            {/* Active WAF Inspection Rules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-[#08060D] border border-[#1F1930] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">SQL Injection Guard</span>
                  <span className="text-[10px] text-emerald-400 font-bold">ARMED</span>
                </div>
                <p className="text-[11px] text-[#A39BAD]">
                  Inspects URLs, query strings, and request bodies for UNION SELECT, DROP, tautologies, and sleep benchmarks.
                </p>
              </div>

              <div className="p-4 bg-[#08060D] border border-[#1F1930] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Cross-Site Scripting (XSS)</span>
                  <span className="text-[10px] text-emerald-400 font-bold">ARMED</span>
                </div>
                <p className="text-[11px] text-[#A39BAD]">
                  Filters script tags, inline event handlers (onerror/onload), javascript pseudo-URIs, and malicious svg/iframe injections.
                </p>
              </div>

              <div className="p-4 bg-[#08060D] border border-[#1F1930] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Directory Traversal Filter</span>
                  <span className="text-[10px] text-emerald-400 font-bold">ARMED</span>
                </div>
                <p className="text-[11px] text-[#A39BAD]">
                  Traps dot-dot-slash patterns (../, %2e%2e, %2f), etc/passwd probes, and Windows/Linux system file leaks.
                </p>
              </div>

              <div className="p-4 bg-[#08060D] border border-[#1F1930] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">RCE &amp; Command Chaining</span>
                  <span className="text-[10px] text-emerald-400 font-bold">ARMED</span>
                </div>
                <p className="text-[11px] text-[#A39BAD]">
                  Blocks shell operators (;, |, $, `) chained with whoami, cat, curl, wget, powershell, and eval functions.
                </p>
              </div>

              <div className="p-4 bg-[#08060D] border border-[#1F1930] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Scanner &amp; Bot Rejection</span>
                  <span className="text-[10px] text-emerald-400 font-bold">ARMED</span>
                </div>
                <p className="text-[11px] text-[#A39BAD]">
                  Detects and immediately drops automated vulnerability tools: sqlmap, nikto, acunetix, wpscan, masscan, nmap.
                </p>
              </div>

              <div className="p-4 bg-[#08060D] border border-[#1F1930] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Origin Shielding</span>
                  <span className="text-[10px] text-cyan-400 font-bold">CLOUDFLARE</span>
                </div>
                <p className="text-[11px] text-[#A39BAD]">
                  Strict TLS 1.3 encryption, HSTS preload, no-sniff, deny frame ancestors, and rate-limiting zones.
                </p>
              </div>
            </div>
          </div>

          {/* WAF Blocked Threats Table */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#262626] pb-3">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
                <h3 className="text-lg font-bold text-white uppercase tracking-wider">
                  WAF BLOCKED THREAT LOG
                </h3>
              </div>
              <span className="text-xs text-[#A3A3A3] uppercase">
                {wafIncidents.length} THREATS INTERCEPTED
              </span>
            </div>

            <div className="border-2 border-[#262626] bg-[#121212] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-[#262626] bg-[#181818] text-[#A3A3A3] uppercase">
                    <th className="p-4">Timestamp</th>
                    <th className="p-4">Threat Type</th>
                    <th className="p-4">Source IP</th>
                    <th className="p-4">Endpoint</th>
                    <th className="p-4">Trigger Details</th>
                    <th className="p-4">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262626] text-white">
                  {wafIncidents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-[#A3A3A3]">
                        NO WAF THREATS INTERCEPTED RECENTLY. ENGINE RUNNING CLEANLY.
                      </td>
                    </tr>
                  ) : (
                    wafIncidents.map((inc) => (
                      <tr key={inc._id} className="hover:bg-[#1A1A1A]">
                        <td className="p-4 text-[#888888]">{new Date(inc.createdAt).toLocaleString()}</td>
                        <td className="p-4 font-bold text-[#EF4444]">
                          {inc.details?.threatType || inc.incidentType}
                        </td>
                        <td className="p-4 font-mono font-bold">{inc.sourceIp}</td>
                        <td className="p-4 font-mono text-[#A39BAD]">{inc.endpoint || '/'}</td>
                        <td className="p-4 text-xs font-mono text-[#E5E5E5] max-w-xs truncate">
                          {inc.details?.ruleName || inc.details?.snippet || 'Payload Matched Threat Pattern'}
                        </td>
                        <td className="p-4 text-[#10B981] font-bold">BLOCKED (403)</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ACTIVE ADMIN SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="space-y-6 font-mono">
          <div className="bg-[#100D17] border-2 border-[#1F1930] p-6 lg:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1F1930] gap-4">
              <div>
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                  Active Administrator Sessions
                </h2>
                <p className="text-xs text-[#A39BAD] mt-1">
                  Real-time device tracking with idle timeout (2 hours) and absolute lifetime (24 hours).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchSessions}
                  disabled={loadingSessions}
                  className="px-3 py-1.5 bg-[#1B1429] hover:bg-[#251B38] text-white border border-[#3D2D5C] text-xs font-bold uppercase transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 inline mr-1.5 ${loadingSessions ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={handleLogoutAllOtherSessions}
                  className="px-4 py-1.5 bg-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold uppercase tracking-wider transition-colors shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                >
                  Terminate All Other Devices
                </button>
              </div>
            </div>

            {loadingSessions ? (
              <div className="flex items-center justify-center py-12 gap-3 text-xs text-[#A39BAD]">
                <Loader2 className="w-5 h-5 animate-spin text-[#A020F0]" />
                <span>Loading active sessions...</span>
              </div>
            ) : (
              <div className="border border-[#1F1930] overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#1F1930] bg-[#0A0710] text-[#A39BAD] uppercase">
                      <th className="p-3.5">Device / Client</th>
                      <th className="p-3.5">IP Address</th>
                      <th className="p-3.5">Established</th>
                      <th className="p-3.5">Last Activity</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1F1930] text-white">
                    {sessions.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-[#A39BAD]">
                          NO ACTIVE SESSIONS FOUND
                        </td>
                      </tr>
                    ) : (
                      sessions.map((sess) => (
                        <tr key={sess.sessionId} className="hover:bg-[#150F24]">
                          <td className="p-3.5">
                            <div className="flex items-center gap-2.5">
                              {sess.os === 'iOS' || sess.os === 'Android' ? (
                                <Smartphone className="w-4 h-4 text-[#C77DFF]" />
                              ) : (
                                <Laptop className="w-4 h-4 text-[#C77DFF]" />
                              )}
                              <div>
                                <div className="font-bold">{sess.device}</div>
                                <div className="text-[10px] text-[#A39BAD] truncate max-w-xs">{sess.userAgent}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-[#C77DFF]">{sess.ipAddress}</td>
                          <td className="p-3.5 text-[#888888]">{new Date(sess.createdAt).toLocaleString()}</td>
                          <td className="p-3.5 text-[#A39BAD]">{new Date(sess.lastActivityAt).toLocaleTimeString()}</td>
                          <td className="p-3.5">
                            {sess.isCurrent ? (
                              <span className="px-2 py-0.5 bg-[#10B981]/20 border border-[#10B981] text-[#10B981] font-bold text-[10px]">
                                CURRENT SESSION
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-blue-950/40 border border-blue-500/40 text-blue-400 font-bold text-[10px]">
                                ACTIVE
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {!sess.isCurrent && (
                              <button
                                onClick={() => handleRevokeSession(sess.sessionId)}
                                className="px-2.5 py-1 bg-[#EF4444]/20 hover:bg-[#EF4444] text-[#EF4444] hover:text-white border border-[#EF4444]/40 font-bold text-[10px] uppercase transition-colors"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: OPERATOR ACCESS & MFA */}
      {activeTab === 'access' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 font-mono">
          {/* Change Passphrase Form */}
          <div className="bg-[#100D17] border-2 border-[#1F1930] p-6 lg:p-8 space-y-6">
            <div className="border-b border-[#1F1930] pb-4">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-[#C77DFF]" />
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                  Update Administrator Passphrase
                </h2>
              </div>
              <p className="text-xs text-[#A39BAD] mt-1">
                Enforces high-entropy scrypt hashing. Changing passphrase invalidates all existing sessions.
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                  Current Passphrase
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current passphrase"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3.5 py-2.5 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                  New High-Entropy Passphrase
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 10 chars (Uppercase, Lowercase, Number, Symbol)"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3.5 py-2.5 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                  Confirm New Passphrase
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type new passphrase"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3.5 py-2.5 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="w-full py-3 bg-[#A020F0] hover:bg-[#7B2FFF] text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(160,32,240,0.3)] disabled:opacity-50 cursor-pointer"
              >
                {changingPassword ? 'Updating Passphrase & Revoking Sessions...' : 'Commit New Passphrase'}
              </button>
            </form>
          </div>

          {/* Multi-Factor Authentication (TOTP) Enrollment */}
          <div className="bg-[#100D17] border-2 border-[#1F1930] p-6 lg:p-8 space-y-6">
            <div className="border-b border-[#1F1930] pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#10B981]" />
                  <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                    Two-Factor Authentication (TOTP)
                  </h2>
                </div>
                <span
                  className={`text-[10px] px-2.5 py-0.5 border font-mono uppercase ${
                    adminProfile?.totpEnabled
                      ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/40'
                      : 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]'
                  }`}
                >
                  {adminProfile?.totpEnabled ? 'MFA ACTIVE' : 'MFA DISABLED'}
                </span>
              </div>
              <p className="text-xs text-[#A39BAD] mt-1">
                RFC 6238 time-based authenticator (Google Authenticator, Authy, 1Password) + 8 backup codes.
              </p>
            </div>

            {backupCodes.length > 0 && (
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/40 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>EMERGENCY BACKUP RECOVERY CODES</span>
                </div>
                <p className="text-[11px] text-[#A39BAD]">
                  Store these 8 single-use codes safely. If you lose your authenticator app, each code grants access once:
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-xs text-white bg-black/40 p-3 border border-[#1F1930]">
                  {backupCodes.map((c, i) => (
                    <div key={i} className="text-emerald-300 font-bold">{c}</div>
                  ))}
                </div>
              </div>
            )}

            {!adminProfile?.totpEnabled && !mfaSetupData && (
              <div className="space-y-4">
                <p className="text-xs text-[#A39BAD] leading-relaxed">
                  Protect your administrator account against password theft by requiring a 6-digit dynamic code upon login.
                </p>
                <button
                  type="button"
                  onClick={handleStartMfaSetup}
                  className="px-6 py-2.5 bg-[#10B981] hover:bg-[#059669] text-black font-bold text-xs uppercase tracking-wider transition-colors"
                >
                  Configure Authenticator App
                </button>
              </div>
            )}

            {mfaSetupData && !adminProfile?.totpEnabled && (
              <form onSubmit={handleEnableMfa} className="space-y-4">
                <div className="p-3 bg-[#08060D] border border-[#1F1930] space-y-2">
                  <span className="text-[11px] text-[#A39BAD] uppercase font-bold">1. Manual Secret Key</span>
                  <div className="flex items-center justify-between bg-[#150F24] p-2 border border-[#2C2344]">
                    <span className="text-xs font-mono text-white select-all">{mfaSetupData.secret}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(mfaSetupData.secret);
                        setCopiedSecret(true);
                        setTimeout(() => setCopiedSecret(false), 2000);
                      }}
                      className="text-[10px] text-[#C77DFF] hover:underline"
                    >
                      {copiedSecret ? 'COPIED' : 'COPY'}
                    </button>
                  </div>
                  <p className="text-[10px] text-[#A39BAD]">
                    Or enter this URI in your authenticator app: <span className="text-white select-all break-all">{mfaSetupData.otpauthUri}</span>
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                    2. Enter 6-Digit Authenticator Code to Confirm
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3.5 py-2.5 text-xs text-white font-mono tracking-widest focus:border-[#10B981] focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    disabled={enrollingMfa}
                    className="px-6 py-2.5 bg-[#10B981] hover:bg-[#059669] text-black font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
                  >
                    {enrollingMfa ? 'Verifying...' : 'Verify & Enable MFA'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMfaSetupData(null)}
                    className="text-xs text-[#A39BAD] hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {adminProfile?.totpEnabled && (
              <form onSubmit={handleDisableMfa} className="space-y-4 pt-2">
                <p className="text-xs text-rose-400">
                  To disable MFA, verify your operator passphrase and current 6-digit authenticator code:
                </p>
                <div>
                  <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                    Passphrase
                  </label>
                  <input
                    type="password"
                    required
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Enter passphrase"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                    Current 6-Digit Code or Recovery Backup Code
                  </label>
                  <input
                    type="text"
                    required
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value)}
                    placeholder="123456 or XXXX-XXXX-XXXX"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3.5 py-2 text-xs text-white font-mono focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={disablingMfa}
                  className="px-4 py-2 bg-[#EF4444]/20 hover:bg-[#EF4444] text-[#EF4444] hover:text-white border border-[#EF4444] text-xs font-bold uppercase transition-colors"
                >
                  {disablingMfa ? 'Disabling...' : 'Disable Two-Factor Authentication'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
