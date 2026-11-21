import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import {
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  Key,
  RotateCw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Lock,
  Unlock,
  Sliders,
  Trash2,
  QrCode,
  Bell,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';

export const CustomerSecurity: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Security score & 2FA
  const [securityScore, setSecurityScore] = useState<number>(70);
  const [is2FaEnabled, setIs2FaEnabled] = useState<boolean>(false);
  const [boundIp, setBoundIp] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  // 2FA Setup state
  const [is2FaModalOpen, setIs2FaModalOpen] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string>('');
  const [setupUri, setSetupUri] = useState<string>('');
  const [totpToken, setTotpToken] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verifying2Fa, setVerifying2Fa] = useState(false);

  // Key Rotation state
  const [isRotateModalOpen, setIsRotateModalOpen] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [newGeneratedKey, setNewGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Devices & Sessions
  const [devices, setDevices] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // Daily Limit
  const [dailyLimit, setDailyLimit] = useState<number>(1000);
  const [savingLimit, setSavingLimit] = useState(false);

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [scoreRes, devicesRes, notifsRes, dashRes] = await Promise.all([
        apiRequest('/api/v1/customer/security/security-score', {}, 'customer'),
        apiRequest('/api/v1/customer/security/devices', {}, 'customer'),
        apiRequest('/api/v1/customer/security/notifications', {}, 'customer'),
        apiRequest('/api/v1/customer/dashboard', {}, 'customer'),
      ]);

      if (scoreRes.success && scoreRes.data) {
        setSecurityScore(scoreRes.data.score || 70);
        setIs2FaEnabled(Boolean(scoreRes.data.is2FaEnabled));
        setBoundIp(scoreRes.data.boundIp || null);
        setRecommendations(scoreRes.data.recommendations || []);
      }

      if (devicesRes.success && Array.isArray(devicesRes.data)) {
        setDevices(devicesRes.data);
      }

      if (notifsRes.success && Array.isArray(notifsRes.data)) {
        setNotifications(notifsRes.data);
      }

      if (dashRes.success && dashRes.data?.usage?.daily?.limit) {
        setDailyLimit(dashRes.data.usage.daily.limit);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStart2FaSetup = async () => {
    setError(null);
    try {
      const res = await apiRequest('/api/v1/customer/security/2fa/setup', { method: 'POST' }, 'customer');
      if (res.success && res.data) {
        setSetupSecret(res.data.secret);
        setSetupUri(res.data.otpauthUri);
        setIs2FaModalOpen(true);
        setTotpToken('');
        setBackupCodes([]);
      } else {
        setError(res.error?.message || 'Failed to initialize 2FA setup');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleVerify2Fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying2Fa(true);
    setError(null);

    try {
      const res = await apiRequest(
        '/api/v1/customer/security/2fa/enable',
        {
          method: 'POST',
          body: JSON.stringify({ token: totpToken.trim() }),
        },
        'customer'
      );

      if (res.success && res.data) {
        setIs2FaEnabled(true);
        setBackupCodes(res.data.backupCodes || []);
        setSuccessMsg('Two-Factor Authentication enabled! Store your backup recovery codes.');
        fetchSecurityData();
      } else {
        setError(res.error?.message || 'Invalid 6-digit verification code');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setVerifying2Fa(false);
    }
  };

  const handleDisable2Fa = async () => {
    if (!confirm('Are you sure you want to disable Two-Factor Authentication? Your account security score will decrease.'))
      return;
    setError(null);

    try {
      const res = await apiRequest('/api/v1/customer/security/2fa/disable', { method: 'POST' }, 'customer');
      if (res.success) {
        setIs2FaEnabled(false);
        setSuccessMsg('2FA disabled');
        fetchSecurityData();
      } else {
        setError(res.error?.message || 'Failed to disable 2FA');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRotateKey = async () => {
    setRotatingKey(true);
    setError(null);

    try {
      const res = await apiRequest('/api/v1/customer/security/rotate-key', { method: 'POST' }, 'customer');
      if (res.success && res.data) {
        setNewGeneratedKey(res.data.rawKey);
        setSuccessMsg('API Key successfully rotated. Update your production configuration.');
        fetchSecurityData();
      } else {
        setError(res.error?.message || 'Failed to rotate key');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRotatingKey(false);
    }
  };

  const handleSaveDailyLimit = async () => {
    setSavingLimit(true);
    setError(null);

    try {
      const res = await apiRequest(
        '/api/v1/customer/security/limits',
        {
          method: 'POST',
          body: JSON.stringify({ dailyRequestLimit: Number(dailyLimit) }),
        },
        'customer'
      );

      if (res.success) {
        setSuccessMsg(`Personal daily limit updated to ${dailyLimit} requests`);
        fetchSecurityData();
      } else {
        setError(res.error?.message || 'Failed to update daily limit');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingLimit(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Revoke access for this device session?')) return;
    try {
      const res = await apiRequest(`/api/v1/customer/security/devices/${deviceId}`, { method: 'DELETE' }, 'customer');
      if (res.success) {
        setSuccessMsg('Device session revoked');
        fetchSecurityData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm('This will immediately terminate all active sessions across all devices. Proceed?')) return;
    try {
      const res = await apiRequest('/api/v1/customer/security/logout-all', { method: 'POST' }, 'customer');
      if (res.success) {
        alert('All sessions invalidated. Please log back in.');
        window.location.href = '/login';
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleTrust = async (deviceId: string, currentTrust: boolean) => {
    try {
      await apiRequest(
        `/api/v1/customer/security/devices/${deviceId}/trust`,
        {
          method: 'POST',
          body: JSON.stringify({ isTrusted: !currentTrust }),
        },
        'customer'
      );
      fetchSecurityData();
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 space-y-8 bg-[#050508] min-h-screen text-[#F5F3FA] font-sans selection:bg-[#A020F0] selection:text-white">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#1F1930] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#C77DFF] uppercase tracking-[0.16em] mb-1">
            <span className="w-2 h-2 bg-[#A020F0] shadow-[0_0_8px_#A020F0]" />
            Security & Identity // Access Control
          </div>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white font-mono">
            Account Security & Device Binding
          </h1>
          <p className="text-xs text-[#A39BAD] mt-1 font-mono uppercase tracking-wider">
            Manage two-factor authentication, key rotation, device sessions, and anti-sharing locks
          </p>
        </div>

        <button
          onClick={handleLogoutAll}
          className="border-2 border-[#EF4444] text-[#EF4444] hover:bg-[#EF4444] hover:text-white px-4 py-2.5 font-mono font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-colors self-start md:self-auto"
        >
          <LogOut className="w-4 h-4" />
          Logout All Devices
        </button>
      </div>

      {/* Alert Notices */}
      {error && (
        <div className="p-4 bg-[#260A0A] border-2 border-[#EF4444] flex items-center justify-between text-xs font-mono text-[#EF4444]">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="font-bold uppercase tracking-wider">{error}</span>
          </div>
          <button onClick={() => setError(null)} className="hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-[#0A2614] border-2 border-[#10B981] flex items-center justify-between text-xs font-mono text-[#10B981]">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-bold uppercase tracking-wider">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Grid: Security Score & 2FA Control */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Security Score Card */}
        <div className="bg-[#121212] border-2 border-[#262626] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A3A3A3]">
              Account Security Rating
            </span>
            <ShieldCheck
              className={`w-5 h-5 ${
                securityScore >= 80
                  ? 'text-emerald-400'
                  : securityScore >= 60
                  ? 'text-amber-400'
                  : 'text-rose-500'
              }`}
            />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-black font-mono text-white tracking-tight">
              {securityScore}
            </span>
            <span className="text-sm font-mono text-[#737373]">/ 100 PTS</span>
          </div>

          <div className="w-full bg-[#1F1F1F] h-2.5 rounded-none overflow-hidden">
            <div
              style={{ width: `${securityScore}%` }}
              className={`h-full transition-all duration-500 ${
                securityScore >= 80 ? 'bg-emerald-400' : securityScore >= 60 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
            />
          </div>

          {recommendations.length > 0 && (
            <div className="pt-2 space-y-1.5 border-t border-[#262626]">
              <span className="text-[10px] font-mono text-[#737373] uppercase block font-bold">
                Recommendations:
              </span>
              {recommendations.map((rec, i) => (
                <div key={i} className="text-xs text-[#A3A3A3] flex items-start gap-2">
                  <span className="text-cyan-400 font-mono font-bold">•</span>
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2FA Status & Action */}
        <div className="bg-[#121212] border-2 border-[#262626] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A3A3A3]">
              Two-Factor Authentication (TOTP)
            </span>
            <Smartphone className="w-5 h-5 text-cyan-400" />
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                is2FaEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="font-mono font-bold text-lg text-white uppercase">
              {is2FaEnabled ? 'ACTIVE & PROTECTED' : 'DISABLED'}
            </span>
          </div>

          <p className="text-xs text-[#A3A3A3]">
            Protect your API keys with RFC 6238 time-based one-time passcodes from Google Authenticator,
            Authy, or 1Password.
          </p>

          <div className="pt-2">
            {is2FaEnabled ? (
              <button
                onClick={handleDisable2Fa}
                className="w-full border-2 border-[#333333] hover:border-[#EF4444] text-xs font-mono font-bold uppercase py-2.5 text-[#A3A3A3] hover:text-[#EF4444] transition-colors"
              >
                Disable 2FA Protection
              </button>
            ) : (
              <button
                onClick={handleStart2FaSetup}
                className="w-full bg-cyan-400 text-black border-2 border-cyan-400 hover:bg-white hover:border-white text-xs font-mono font-bold uppercase py-2.5 transition-colors"
              >
                Enable Two-Factor Authentication
              </button>
            )}
          </div>
        </div>

        {/* Anti-Sharing Single-IP Lock Status */}
        <div className="bg-[#121212] border-2 border-[#262626] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#A3A3A3]">
              Anti-Sharing IP Lock
            </span>
            {boundIp ? <Lock className="w-5 h-5 text-emerald-400" /> : <Unlock className="w-5 h-5 text-amber-400" />}
          </div>

          <div>
            <span className="text-[10px] font-mono text-[#737373] uppercase block">Current Bound IP</span>
            <span className="font-mono font-bold text-lg text-white">
              {boundIp ? boundIp : 'AUTO-BINDING ON FIRST CALL'}
            </span>
          </div>

          <p className="text-xs text-[#A3A3A3]">
            Strict 1-User-1-Key binding architecture prevents unauthorized key sharing across external
            servers. Calling from an unknown IP triggers auto-suspension.
          </p>

          <div className="pt-2">
            <button
              onClick={() => setIsRotateModalOpen(true)}
              className="w-full bg-white text-black hover:bg-[#EF4444] hover:text-white border-2 border-white hover:border-[#EF4444] text-xs font-mono font-bold uppercase py-2.5 transition-colors flex items-center justify-center gap-2"
            >
              <RotateCw className="w-4 h-4" />
              Rotate API Key
            </button>
          </div>
        </div>
      </div>

      {/* Middle Section: Personal Quota Self-Configuration */}
      <div className="bg-[#121212] border-2 border-[#262626] p-6 font-mono space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Personal Daily Quota Safety Throttle
            </h2>
          </div>
          <span className="text-[10px] text-[#737373] uppercase">
            Prevent Accidental Burst Overconsumption
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-[11px] text-[#A3A3A3] uppercase mb-1">
              Maximum Daily Requests Threshold
            </label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(Number(e.target.value))}
              min={10}
              className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none p-2.5 text-xs text-white"
            />
          </div>

          <button
            onClick={handleSaveDailyLimit}
            disabled={savingLimit}
            className="w-full sm:w-auto bg-cyan-400 text-black hover:bg-white border-2 border-cyan-400 hover:border-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {savingLimit ? 'Saving...' : 'Update Quota Throttle'}
          </button>
        </div>
      </div>

      {/* Device Management Table */}
      <div className="bg-[#121212] border-2 border-[#262626]">
        <div className="p-4 border-b-2 border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Recognized Client Devices & Active Sessions
            </h2>
          </div>
          <span className="text-[10px] font-mono text-[#737373] uppercase">
            {devices.length} Registered Devices
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-[#0A0A0A] border-b-2 border-[#262626] text-[#737373] uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4">Device / Client</th>
                <th className="p-4">OS & Browser</th>
                <th className="p-4">Source IP</th>
                <th className="p-4">First Login</th>
                <th className="p-4">Last Active</th>
                <th className="p-4">Trust Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {devices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-[#737373]">
                    No registered devices detected.
                  </td>
                </tr>
              ) : (
                devices.map((dev) => (
                  <tr key={dev._id} className="hover:bg-[#161616] transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white uppercase">{dev.deviceName || 'Web Browser'}</div>
                      <div className="text-[10px] text-[#737373] truncate max-w-[180px]">
                        ID: {dev.deviceId.substring(0, 16)}...
                      </div>
                    </td>
                    <td className="p-4 text-[#A3A3A3]">
                      <div>{dev.os || 'Unknown OS'}</div>
                      <div className="text-[10px] text-[#737373]">{dev.browser || 'Browser'}</div>
                    </td>
                    <td className="p-4 font-bold text-cyan-400">{dev.lastIp}</td>
                    <td className="p-4 text-[#737373]">
                      {new Date(dev.firstLoginAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-[#A3A3A3]">
                      {new Date(dev.lastLoginAt).toLocaleTimeString()}
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => handleToggleTrust(dev.deviceId, dev.isTrusted)}
                        className={`px-2 py-0.5 text-[10px] uppercase font-bold border transition-colors ${
                          dev.isTrusted
                            ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/20'
                            : 'border-[#525252] text-[#737373] hover:text-white'
                        }`}
                      >
                        {dev.isTrusted ? 'TRUSTED' : 'UNTRUSTED'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleRevokeDevice(dev.deviceId)}
                        className="text-[#EF4444] hover:text-white text-xs uppercase font-bold p-1 transition-colors"
                      >
                        Revoke
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2FA Setup Wizard Modal */}
      {is2FaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border-2 border-white w-full max-w-lg p-6 font-mono text-[#E5E7EB]">
            <div className="flex items-center justify-between border-b-2 border-[#262626] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-cyan-400" />
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                  Two-Factor Authentication Setup
                </h3>
              </div>
              <button onClick={() => setIs2FaModalOpen(false)} className="text-[#737373] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {backupCodes.length > 0 ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#0A2614] border border-[#10B981] text-xs text-[#10B981]">
                  Two-factor authentication is now enabled on your account! Store these single-use recovery codes
                  safely.
                </div>

                <div className="bg-[#0A0A0A] p-4 border border-[#262626] grid grid-cols-2 gap-2 text-center text-xs font-bold text-cyan-400">
                  {backupCodes.map((code, idx) => (
                    <div key={idx} className="p-1.5 bg-[#141414] border border-[#333333]">
                      {code}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(backupCodes.join('\n'));
                    alert('Backup codes copied to clipboard');
                    setIs2FaModalOpen(false);
                  }}
                  className="w-full bg-white text-black py-2.5 font-bold uppercase text-xs hover:bg-cyan-400 transition-colors"
                >
                  Copy All Backup Codes & Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerify2Fa} className="space-y-4 text-xs">
                <p className="text-[#A3A3A3]">
                  1. Scan this key into your Authenticator app, or manually enter the Base32 secret below:
                </p>

                <div className="bg-[#0A0A0A] p-3 border-2 border-[#262626] font-bold text-cyan-400 text-center tracking-widest text-sm select-all">
                  {setupSecret}
                </div>

                <p className="text-[#A3A3A3]">
                  2. Enter the 6-digit confirmation code generated by your app:
                </p>

                <input
                  type="text"
                  maxLength={6}
                  required
                  placeholder="000000"
                  value={totpToken}
                  onChange={(e) => setTotpToken(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-cyan-400 p-3 text-center text-xl font-bold tracking-[0.3em] text-white focus:outline-none"
                />

                <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#262626]">
                  <button
                    type="button"
                    onClick={() => setIs2FaModalOpen(false)}
                    className="px-4 py-2 border border-[#333333] hover:border-white uppercase font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={verifying2Fa || totpToken.length !== 6}
                    className="bg-cyan-400 text-black px-6 py-2 uppercase font-bold hover:bg-white transition-colors disabled:opacity-50"
                  >
                    {verifying2Fa ? 'Verifying...' : 'Verify & Enable'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Rotate Key Confirmation / Success Modal */}
      {isRotateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#121212] border-2 border-[#EF4444] w-full max-w-lg p-6 font-mono text-[#E5E7EB]">
            <div className="flex items-center justify-between border-b-2 border-[#262626] pb-4 mb-4">
              <div className="flex items-center gap-2">
                <RotateCw className="w-5 h-5 text-[#EF4444]" />
                <h3 className="font-bold text-sm text-white uppercase tracking-wider">
                  Rotate API Security Key
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsRotateModalOpen(false);
                  setNewGeneratedKey(null);
                }}
                className="text-[#737373] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {newGeneratedKey ? (
              <div className="space-y-4">
                <div className="p-4 bg-[#260A0A] border-2 border-[#EF4444] text-xs text-[#EF4444] font-bold uppercase tracking-wider">
                  ⚠️ Critical: Copy this API key now! It will never be displayed again.
                </div>

                <div className="bg-[#0A0A0A] p-3 border-2 border-white flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-emerald-400 break-all select-all">
                    {newGeneratedKey}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(newGeneratedKey);
                      setCopiedKey(true);
                      setTimeout(() => setCopiedKey(false), 2500);
                    }}
                    className="p-2 bg-white text-black hover:bg-emerald-400 shrink-0 font-bold text-xs uppercase flex items-center gap-1"
                  >
                    {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedKey ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    setIsRotateModalOpen(false);
                    setNewGeneratedKey(null);
                  }}
                  className="w-full bg-white text-black py-2.5 font-bold uppercase text-xs hover:bg-emerald-400 transition-colors"
                >
                  I Have Safely Saved My Key
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-[#A3A3A3]">
                  Rotating your API key will immediately invalidate your existing key in production. Any
                  systems, backend workers, or scripts using the old key will receive{' '}
                  <span className="text-[#EF4444] font-bold">401 Unauthorized</span> until updated.
                </p>

                <p className="text-[#A3A3A3]">
                  The new key will automatically bind to your IP upon the first request.
                </p>

                <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#262626]">
                  <button
                    type="button"
                    onClick={() => setIsRotateModalOpen(false)}
                    className="px-4 py-2 border border-[#333333] hover:border-white uppercase font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={rotatingKey}
                    onClick={handleRotateKey}
                    className="bg-[#EF4444] text-white px-6 py-2 uppercase font-bold hover:bg-white hover:text-black transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {rotatingKey ? (
                      <>
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                        Rotating Key...
                      </>
                    ) : (
                      'Confirm & Rotate Key'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
