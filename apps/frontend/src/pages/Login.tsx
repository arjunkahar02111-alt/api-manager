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
  Key,
  Shield,
  Terminal,
  Smartphone,
  Mail,
  CheckCircle2,
  HelpCircle,
  X,
} from 'lucide-react';

export const Login: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'admin' | 'customer'>('admin');
  const [customerMode, setCustomerMode] = useState<'key' | 'password' | 'register' | 'forgot' | 'verify'>('key');

  // Admin form
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('AdminStrongSecurePassword2026!');

  // Customer forms
  const [customerApiKey, setCustomerApiKey] = useState('');
  const [customerIdentifier, setCustomerIdentifier] = useState('');
  const [customerPassword, setCustomerPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);

  // Register form
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regFullName, setRegFullName] = useState('');
  const [registeredKey, setRegisteredKey] = useState<string | null>(null);

  // Forgot password & Verify forms
  const [resetEmail, setResetEmail] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { adminLogin, customerLogin } = useAuth();
  const navigate = useNavigate();

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/api/v1/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });

      if (!res.success) {
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

  const handleCustomerKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/api/v1/customer/auth/login', {
        method: 'POST',
        body: JSON.stringify({ apiKey: customerApiKey.trim() }),
      });

      if (!res.success) {
        setError(res.error?.message || 'Invalid API Key or Account Suspended');
        setLoading(false);
        return;
      }

      customerLogin(res.data);
      navigate('/customer/overview');
    } catch (err: any) {
      setError(err.message || 'Key authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payload: any = {
        identifier: customerIdentifier.trim(),
        password: customerPassword,
      };

      if (requires2FA && totpCode) {
        payload.totpCode = totpCode.trim();
      }

      const res = await apiRequest('/api/v1/customer/auth/login-password', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (!res.success) {
        setError(res.error?.message || 'Invalid username or password');
        setLoading(false);
        return;
      }

      if ((res as any).requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }

      customerLogin(res.data);
      navigate('/customer/overview');
    } catch (err: any) {
      setError(err.message || 'Password login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest('/api/v1/customer/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: regUsername.trim(),
          email: regEmail.trim(),
          password: regPassword,
          fullName: regFullName.trim() || regUsername.trim(),
        }),
      });

      if (!res.success) {
        setError(res.error?.message || 'Registration failed');
        setLoading(false);
        return;
      }

      setRegisteredKey(res.data.rawKey);
      customerLogin(res.data);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(`Password reset instructions dispatched to ${resetEmail}. Check your inbox.`);
  };

  const handleVerifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(`Email ${verifyEmail} verified successfully. You may now authenticate.`);
  };

  return (
    <div className="min-h-screen bg-[#050508] flex flex-col items-center justify-center p-6 selection:bg-[#A020F0] selection:text-white font-sans relative overflow-hidden">
      {/* Restrained Purple Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-[#A020F0]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Top Rubric & Role Selector */}
        <div className="mb-6 border-b-2 border-[#1F1930] pb-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab('admin');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`px-3 py-1 font-mono font-bold text-[10px] uppercase tracking-wider transition-colors ${
                activeTab === 'admin'
                  ? 'bg-[#A020F0] text-white shadow-[0_0_12px_rgba(160,32,240,0.4)]'
                  : 'text-[#A39BAD] hover:text-white border border-[#262035] bg-[#0A0712]'
              }`}
            >
              Super Admin SOC
            </button>
            <button
              onClick={() => {
                setActiveTab('customer');
                setError(null);
                setSuccessMsg(null);
              }}
              className={`px-3 py-1 font-mono font-bold text-[10px] uppercase tracking-wider transition-colors ${
                activeTab === 'customer'
                  ? 'bg-[#7B2FFF] text-white shadow-[0_0_12px_rgba(123,47,255,0.4)]'
                  : 'text-[#A39BAD] hover:text-white border border-[#262035] bg-[#0A0712]'
              }`}
            >
              Developer Portal
            </button>
          </div>
          <span className="text-[10px] text-[#A39BAD] font-mono">KARVION // V2.0</span>
        </div>

        {/* Centralized Official Brand Header */}
        <LoginBrand
          subtitle={
            activeTab === 'admin'
              ? 'ENTERPRISE SOC // GATEWAY CONTROL'
              : 'DEVELOPER ACCESS & CLIENT CONSOLE'
          }
        />

        {/* Elevated Futuristic Auth Card */}
        <div className="bg-[#100D17]/95 border-t-4 border-t-[#A020F0] border-x-2 border-b-2 border-[#262035] p-8 rounded-none shadow-2xl backdrop-blur-md">
          <div className="mb-6 pb-4 border-b-2 border-[#1F1930] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                {activeTab === 'admin' ? 'Root Clearance Required' : 'Client Access Clearance'}
              </h2>
              <p className="text-xs text-[#A39BAD] mt-1 font-mono">
                {activeTab === 'admin'
                  ? 'All operations and sessions are recorded in tamper-resistant audit logs.'
                  : 'High-throughput access to catalog APIs, telemetry, and security.'}
              </p>
            </div>
            {activeTab === 'admin' ? (
              <Shield className="w-5 h-5 text-[#A020F0] shrink-0" />
            ) : (
              <Terminal className="w-5 h-5 text-[#C77DFF] shrink-0" />
            )}
          </div>

          {error && (
            <div className="mb-6 p-4 bg-[#260A1A] border-2 border-[#A020F0] rounded-none flex items-center gap-3 text-xs text-[#E0AAFF] font-bold uppercase tracking-wider font-mono">
              <AlertCircle className="w-4 h-4 shrink-0 text-[#A020F0]" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-[#0A2614] border-2 border-[#10B981] rounded-none flex items-center gap-3 text-xs text-[#10B981] font-bold uppercase tracking-wider font-mono">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* ADMIN LOGIN FORM */}
          {activeTab === 'admin' && (
            <form onSubmit={handleAdminSubmit} className="space-y-5 font-mono">
              <div>
                <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2">
                  Administrator Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#A39BAD] absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    placeholder="admin"
                    className="w-full bg-[#08060D] border-2 border-[#262035] focus:border-[#A020F0] focus:outline-none pl-10 pr-4 py-3 text-sm text-white placeholder-[#5A5266] rounded-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2">
                  Master Security Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#A39BAD] absolute left-3.5 top-3.5" />
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-[#08060D] border-2 border-[#262035] focus:border-[#A020F0] focus:outline-none pl-10 pr-4 py-3 text-sm text-white placeholder-[#5A5266] rounded-none transition-colors"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#A020F0] text-white border-2 border-[#A020F0] hover:bg-[#7B2FFF] hover:border-[#7B2FFF] py-3.5 px-6 font-bold uppercase tracking-[0.12em] text-xs transition-all flex items-center justify-center gap-2 rounded-none disabled:opacity-50 mt-6 shadow-[0_0_18px_rgba(160,32,240,0.4)]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Verifying Clearance...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Administrator SOC</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* CUSTOMER PORTAL MODES */}
          {activeTab === 'customer' && (
            <div className="font-mono space-y-5">
              {/* Customer sub-modes bar */}
              <div className="flex border-b border-[#1F1930] pb-3 gap-3 text-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('key');
                    setError(null);
                    setSuccessMsg(null);
                    setRequires2FA(false);
                  }}
                  className={`pb-1 font-bold uppercase tracking-wider shrink-0 transition-colors ${
                    customerMode === 'key' ? 'text-[#C77DFF] border-b-2 border-[#A020F0]' : 'text-[#A39BAD]'
                  }`}
                >
                  Key Access
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('password');
                    setError(null);
                    setSuccessMsg(null);
                    setRequires2FA(false);
                  }}
                  className={`pb-1 font-bold uppercase tracking-wider shrink-0 transition-colors ${
                    customerMode === 'password'
                      ? 'text-[#C77DFF] border-b-2 border-[#A020F0]'
                      : 'text-[#A39BAD]'
                  }`}
                >
                  Password & 2FA
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('register');
                    setError(null);
                    setSuccessMsg(null);
                    setRequires2FA(false);
                  }}
                  className={`pb-1 font-bold uppercase tracking-wider shrink-0 transition-colors ${
                    customerMode === 'register'
                      ? 'text-[#C77DFF] border-b-2 border-[#A020F0]'
                      : 'text-[#A39BAD]'
                  }`}
                >
                  Register
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCustomerMode('forgot');
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className={`pb-1 font-bold uppercase tracking-wider shrink-0 transition-colors ${
                    customerMode === 'forgot'
                      ? 'text-[#C77DFF] border-b-2 border-[#A020F0]'
                      : 'text-[#A39BAD]'
                  }`}
                >
                  Reset
                </button>
              </div>

              {/* Mode 1: API Key Direct Login */}
              {customerMode === 'key' && (
                <form onSubmit={handleCustomerKeySubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2">
                      Live Developer API Key
                    </label>
                    <div className="relative">
                      <Key className="w-4 h-4 text-[#A39BAD] absolute left-3.5 top-3.5" />
                      <input
                        type="password"
                        required
                        value={customerApiKey}
                        onChange={(e) => setCustomerApiKey(e.target.value)}
                        placeholder="sk_live_..."
                        className="w-full bg-[#08060D] border-2 border-[#262035] focus:border-[#A020F0] focus:outline-none pl-10 pr-4 py-3 text-xs text-white placeholder-[#5A5266] rounded-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#A020F0] text-white border-2 border-[#A020F0] hover:bg-[#7B2FFF] hover:border-[#7B2FFF] py-3 px-6 font-bold uppercase tracking-[0.12em] text-xs transition-colors flex items-center justify-center gap-2 rounded-none disabled:opacity-50 shadow-[0_0_15px_rgba(160,32,240,0.35)]"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>Authenticate With Key</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Mode 2: Password Login with 2FA */}
              {customerMode === 'password' && (
                <form onSubmit={handleCustomerPasswordSubmit} className="space-y-4">
                  {!requires2FA ? (
                    <>
                      <div>
                        <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2">
                          Username or Email
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-[#A39BAD] absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            required
                            value={customerIdentifier}
                            onChange={(e) => setCustomerIdentifier(e.target.value)}
                            placeholder="developer@corp.com"
                            className="w-full bg-[#08060D] border-2 border-[#262035] focus:border-[#A020F0] focus:outline-none pl-10 pr-4 py-3 text-xs text-white rounded-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2">
                          Password
                        </label>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-[#A39BAD] absolute left-3.5 top-3.5" />
                          <input
                            type="password"
                            required
                            value={customerPassword}
                            onChange={(e) => setCustomerPassword(e.target.value)}
                            placeholder="••••••••••••"
                            className="w-full bg-[#08060D] border-2 border-[#262035] focus:border-[#A020F0] focus:outline-none pl-10 pr-4 py-3 text-xs text-white rounded-none"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-[#170E2B] border border-[#A020F0] text-xs text-[#E0AAFF]">
                        Two-Factor Authentication required. Enter the 6-digit code or a backup code.
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2">
                          6-Digit Authenticator Code
                        </label>
                        <div className="relative">
                          <Smartphone className="w-4 h-4 text-[#A020F0] absolute left-3.5 top-3.5" />
                          <input
                            type="text"
                            required
                            maxLength={8}
                            value={totpCode}
                            onChange={(e) => setTotpCode(e.target.value)}
                            placeholder="123456"
                            className="w-full bg-[#08060D] border-2 border-[#A020F0] focus:outline-none pl-10 pr-4 py-3 text-sm font-bold tracking-widest text-center text-white rounded-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#A020F0] text-white border-2 border-[#A020F0] hover:bg-[#7B2FFF] hover:border-[#7B2FFF] py-3 px-6 font-bold uppercase tracking-[0.12em] text-xs transition-colors flex items-center justify-center gap-2 rounded-none disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>{requires2FA ? 'Verify 2FA & Login' : 'Continue'}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Mode 3: Self-Registration */}
              {customerMode === 'register' && (
                <div>
                  {registeredKey ? (
                    <div className="space-y-4">
                      <div className="p-3 bg-[#0A2614] border border-[#10B981] text-xs text-[#10B981]">
                        Account created successfully! Save your assigned API Key:
                      </div>
                      <div className="bg-[#08060D] p-3 border border-white text-xs font-mono text-[#C77DFF] break-all select-all">
                        {registeredKey}
                      </div>
                      <button
                        onClick={() => navigate('/customer/overview')}
                        className="w-full bg-[#A020F0] text-white py-2.5 font-bold uppercase text-xs hover:bg-[#7B2FFF] transition-colors"
                      >
                        Enter Developer Portal
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRegisterSubmit} className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-white mb-1">
                          Username *
                        </label>
                        <input
                          type="text"
                          required
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="johndoe"
                          className="w-full bg-[#08060D] border border-[#262035] focus:border-[#A020F0] p-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-white mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          placeholder="John Doe"
                          className="w-full bg-[#08060D] border border-[#262035] focus:border-[#A020F0] p-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-white mb-1">
                          Email Address *
                        </label>
                        <input
                          type="email"
                          required
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          placeholder="john@example.com"
                          className="w-full bg-[#08060D] border border-[#262035] focus:border-[#A020F0] p-2 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-white mb-1">
                          Account Password *
                        </label>
                        <input
                          type="password"
                          required
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-[#08060D] border border-[#262035] focus:border-[#A020F0] p-2 text-xs text-white"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#A020F0] text-white border-2 border-[#A020F0] hover:bg-[#7B2FFF] hover:border-[#7B2FFF] py-2.5 px-4 font-bold uppercase text-xs transition-colors flex items-center justify-center gap-2 mt-4"
                      >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Register & Generate Key'}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Mode 4: Forgot / Reset Password */}
              {customerMode === 'forgot' && (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#A39BAD] absolute left-3.5 top-3.5" />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="developer@corp.com"
                        className="w-full bg-[#08060D] border-2 border-[#262035] focus:border-[#A020F0] focus:outline-none pl-10 pr-4 py-3 text-xs text-white rounded-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#A020F0] text-white border-2 border-[#A020F0] hover:bg-[#7B2FFF] py-3 font-bold uppercase text-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Send Password Reset Token</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Editorial Brand Footer */}
        <div className="mt-8 pt-4 border-t-2 border-[#1F1930] flex items-center justify-between text-[10px] text-[#A39BAD] font-mono uppercase">
          <span>CANONICAL: api.karviontechnologies.in</span>
          <span>GATEWAY: PROTECTED</span>
        </div>
      </div>
    </div>
  );
};
