import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { LoginBrand } from '../components/branding';
import {
  AlertCircle,
  Loader2,
  Lock,
  User,
  ArrowRight,
  Shield,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
} from 'lucide-react';

export const Login: React.FC = () => {
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('AdminStrongSecurePassword2026!');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = { username: adminUsername, password: adminPassword };
      if (requires2FA && totpCode.trim()) {
        payload.totpCode = totpCode.trim();
      }

      const res = await apiRequest('/api/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        if (res.error?.code === 'MFA_REQUIRED' || res.error?.code === '2FA_REQUIRED') {
          setRequires2FA(true);
          setError('Two-Factor Authentication Code Required');
          setLoading(false);
          return;
        }
        setError(res.error?.message || 'Invalid administrator clearance credentials');
        setLoading(false);
        return;
      }

      adminLogin(res.data);
      navigate('/admin/overview');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050508] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-mono relative overflow-hidden select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(160,32,240,0.12),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(123,47,255,0.08),transparent_50%)] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-block">
            <LoginBrand />
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#100D17] border border-[#2A1A4A] text-[11px] text-[#A020F0] uppercase tracking-widest font-bold">
            <Shield className="w-3.5 h-3.5" />
            <span>Administrator Control Center</span>
          </div>
          <p className="text-xs text-[#A39BAD] max-w-xs mx-auto">
            Authorized operator clearance required. Client services operate directly via API endpoints.
          </p>
        </div>

        {/* Clearance Card */}
        <div className="bg-[#100D17] border-2 border-[#2A1A4A] p-6 sm:p-8 shadow-[0_0_30px_rgba(160,32,240,0.15)] space-y-6">
          <div className="flex items-center justify-between border-b border-[#2A1A4A] pb-4">
            <span className="text-xs font-bold text-[#F5F3FA] uppercase tracking-wider">
              Operator Clearance
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              SYSTEM ONLINE
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/40 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAdminSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                Operator Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A39BAD]">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-[#050508] border border-[#2A1A4A] pl-9 pr-3 py-2.5 text-xs text-[#F5F3FA] font-mono focus:outline-none focus:border-[#A020F0] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                Passphrase
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A39BAD]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-[#050508] border border-[#2A1A4A] pl-9 pr-10 py-2.5 text-xs text-[#F5F3FA] font-mono focus:outline-none focus:border-[#A020F0] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#A39BAD] hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {requires2FA && (
              <div>
                <label className="block text-[11px] font-bold text-[#A020F0] uppercase tracking-wider mb-1.5">
                  2FA Authenticator Code (6-Digit)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#A020F0]">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full bg-[#050508] border border-[#A020F0] pl-9 pr-3 py-2.5 text-xs text-[#F5F3FA] font-mono tracking-widest focus:outline-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#A020F0] hover:bg-[#7B2FFF] text-white font-bold py-3 text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(160,32,240,0.3)] disabled:opacity-50 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Clearance...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Operator</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-[#2A1A4A] text-[10px] text-[#A39BAD] flex items-center justify-between">
            <span>TLS 1.3 Strict Invariant</span>
            <span>All sessions audited</span>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-[11px] text-center text-[#A39BAD]/60">
          Karvion Technologies &bull; Enterprise API Platform &bull; Domain: api.karviontechnologies.in
        </p>
      </div>
    </div>
  );
};
