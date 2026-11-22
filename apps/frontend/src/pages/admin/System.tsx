import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { useUI } from '../../context/UIContext';
import {
  Cpu,
  RefreshCw,
  UserCheck,
  Mail,
  Send,
  Instagram,
  Youtube,
  Globe,
  Sparkles,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Sliders,
} from 'lucide-react';

interface DeveloperProfileData {
  name: string;
  role: string;
  product: string;
  description: string;
  email: string;
  telegram: string;
  telegramUrl: string;
  instagram: string;
  instagramUrl: string;
  twitter: string;
  twitterUrl: string;
  portfolioUrl: string;
  youtubeName: string;
  youtubeUrl: string;
  avatarUrl: string;
  footerCreditText: string;
  enabled: boolean;
  socialLinks: {
    email: boolean;
    telegram: boolean;
    instagram: boolean;
    twitter: boolean;
    portfolio: boolean;
    youtube: boolean;
  };
}

const DEFAULT_PROFILE: DeveloperProfileData = {
  name: 'DEV ARJUN',
  role: 'Developer & Founder',
  product: 'KARVION API MANAGER',
  description:
    'Building technology, automation systems and API solutions with a focus on performance, reliability and practical innovation.',
  email: 'kahararjun537@gmail.com',
  telegram: '@ArjunXploit',
  telegramUrl: 'https://t.me/ArjunXploit',
  instagram: '@arjunnn021',
  instagramUrl: 'https://www.instagram.com/arjunnn021/',
  twitter: '@ArjunKahar021',
  twitterUrl: 'https://x.com/ArjunKahar021',
  portfolioUrl: 'https://www.arjunkaharofficial.in/',
  youtubeName: 'Gaming Arjun',
  youtubeUrl: 'https://www.youtube.com/@GamingArjun',
  avatarUrl: '',
  footerCreditText: 'Developed & Maintained by DEV ARJUN',
  enabled: true,
  socialLinks: {
    email: true,
    telegram: true,
    instagram: true,
    twitter: true,
    portfolio: true,
    youtube: true,
  },
};

export const AdminSystem: React.FC = () => {
  const { openDeveloperModal } = useUI();
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  // Developer Profile State
  const [profile, setProfile] = useState<DeveloperProfileData>(DEFAULT_PROFILE);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchMetrics();
    fetchDeveloperProfile();
    const interval = setInterval(fetchMetrics, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, []);

  const fetchMetrics = async () => {
    const res = await apiRequest('/api/v1/admin/system/metrics', {}, 'admin');
    if (res.success) setMetrics(res.data);
    setLoadingMetrics(false);
  };

  const fetchDeveloperProfile = async () => {
    try {
      const res = await apiRequest('/api/v1/admin/developer-profile', {}, 'admin');
      if (res.success && res.data) {
        setProfile({
          ...DEFAULT_PROFILE,
          ...res.data,
          socialLinks: {
            ...DEFAULT_PROFILE.socialLinks,
            ...(res.data.socialLinks || {}),
          },
        });
      }
    } catch {
      // Fallback to default values
    } finally {
      setProfileLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const res = await apiRequest(
        '/api/v1/admin/developer-profile',
        {
          method: 'PUT',
          body: JSON.stringify(profile),
        },
        'admin'
      );

      if (res.success) {
        setProfileMessage({ type: 'success', text: 'Developer profile & credits updated successfully across platform and cached in Redis!' });
      } else {
        setProfileMessage({ type: 'error', text: res.error?.message || 'Failed to update developer profile.' });
      }
    } catch (err: any) {
      setProfileMessage({ type: 'error', text: err.message || 'Network error updating developer profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset all developer profile fields to official DEV ARJUN defaults?')) {
      setProfile(DEFAULT_PROFILE);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* 1. Infrastructure Metrics Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">System & Server Telemetry</h1>
            <p className="text-xs text-gray-400 mt-1">Live VPS infrastructure resource utilization and database health</p>
          </div>
          <button
            type="button"
            onClick={fetchMetrics}
            disabled={loadingMetrics}
            className="p-2.5 bg-[#172338] hover:bg-[#1f304f] text-gray-300 hover:text-white rounded-xl border border-[#1E2D4A] transition-colors"
            title="Refresh System Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${loadingMetrics ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* 2. Developer Profile & Platform Brand Credits Management */}
      <div className="bg-[#100D17] border-2 border-[#1F1930] p-6 lg:p-8 rounded-none space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#1F1930] gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#A020F0]/10 border border-[#A020F0]/40 flex items-center justify-center text-[#C77DFF]">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white uppercase tracking-wider">
                  Developer Profile &amp; Credits Configuration
                </h2>
                <span className="text-[10px] bg-[#A020F0]/20 text-[#C77DFF] px-2 py-0.5 border border-[#A020F0]/30 font-mono uppercase">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-[#A39BAD] mt-0.5">
                Official founder identity, direct contact links, and persistent footer brand credits.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={openDeveloperModal}
              className="px-3.5 py-2 bg-[#1B1429] hover:bg-[#251B38] text-white border border-[#3D2D5C] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#C77DFF]" />
              <span>Preview Live Profile</span>
            </button>
          </div>
        </div>

        {profileMessage && (
          <div
            className={`p-3.5 border text-xs flex items-center gap-2.5 ${
              profileMessage.type === 'success'
                ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-400'
                : 'bg-rose-950/20 border-rose-500/40 text-rose-400'
            }`}
          >
            {profileMessage.type === 'success' ? (
              <CheckCircle className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{profileMessage.text}</span>
          </div>
        )}

        {profileLoading ? (
          <div className="flex items-center justify-center py-12 gap-3 text-xs text-[#A39BAD]">
            <Loader2 className="w-5 h-5 animate-spin text-[#A020F0]" />
            <span>Loading developer profile settings...</span>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* Identity & Role Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                  Developer Name
                </label>
                <input
                  type="text"
                  required
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  placeholder="DEV ARJUN"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                  Professional Role
                </label>
                <input
                  type="text"
                  required
                  value={profile.role}
                  onChange={(e) => setProfile({ ...profile, role: e.target.value })}
                  placeholder="Developer & Founder"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                  Product / Platform Name
                </label>
                <input
                  type="text"
                  required
                  value={profile.product}
                  onChange={(e) => setProfile({ ...profile, product: e.target.value })}
                  placeholder="KARVION API MANAGER"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
              </div>
            </div>

            {/* Description / Bio */}
            <div>
              <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                Developer Description / Philosophy
              </label>
              <textarea
                rows={2}
                required
                value={profile.description}
                onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                placeholder="Building technology, automation systems and API solutions..."
                className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none leading-relaxed"
              />
            </div>

            {/* Contact & Social Links Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2 border-t border-[#1F1930]">
              {/* Email */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#C77DFF]" />
                    <span>Public Contact Email</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-[#A39BAD] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.socialLinks.email}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          socialLinks: { ...profile.socialLinks, email: e.target.checked },
                        })
                      }
                      className="accent-[#A020F0]"
                    />
                    <span>Show</span>
                  </label>
                </div>
                <input
                  type="email"
                  required
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="kahararjun537@gmail.com"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
              </div>

              {/* Telegram */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-sky-400" />
                    <span>Telegram Handle &amp; URL</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-[#A39BAD] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.socialLinks.telegram}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          socialLinks: { ...profile.socialLinks, telegram: e.target.checked },
                        })
                      }
                      className="accent-[#A020F0]"
                    />
                    <span>Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={profile.telegram}
                    onChange={(e) => setProfile({ ...profile, telegram: e.target.value })}
                    placeholder="@ArjunXploit"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                  />
                  <input
                    type="url"
                    required
                    value={profile.telegramUrl}
                    onChange={(e) => setProfile({ ...profile, telegramUrl: e.target.value })}
                    placeholder="https://t.me/ArjunXploit"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                  />
                </div>
              </div>

              {/* Instagram */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider flex items-center gap-1.5">
                    <Instagram className="w-3.5 h-3.5 text-pink-400" />
                    <span>Instagram Handle &amp; URL</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-[#A39BAD] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.socialLinks.instagram}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          socialLinks: { ...profile.socialLinks, instagram: e.target.checked },
                        })
                      }
                      className="accent-[#A020F0]"
                    />
                    <span>Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={profile.instagram}
                    onChange={(e) => setProfile({ ...profile, instagram: e.target.value })}
                    placeholder="@arjunnn021"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                  />
                  <input
                    type="url"
                    required
                    value={profile.instagramUrl}
                    onChange={(e) => setProfile({ ...profile, instagramUrl: e.target.value })}
                    placeholder="https://www.instagram.com/arjunnn021/"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                  />
                </div>
              </div>

              {/* X / Twitter */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider flex items-center gap-1.5">
                    <span className="text-white font-bold text-xs">X</span>
                    <span>X (Twitter) Handle &amp; URL</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-[#A39BAD] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.socialLinks.twitter}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          socialLinks: { ...profile.socialLinks, twitter: e.target.checked },
                        })
                      }
                      className="accent-[#A020F0]"
                    />
                    <span>Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={profile.twitter}
                    onChange={(e) => setProfile({ ...profile, twitter: e.target.value })}
                    placeholder="@ArjunKahar021"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                  />
                  <input
                    type="url"
                    required
                    value={profile.twitterUrl}
                    onChange={(e) => setProfile({ ...profile, twitterUrl: e.target.value })}
                    placeholder="https://x.com/ArjunKahar021"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                  />
                </div>
              </div>

              {/* YouTube */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider flex items-center gap-1.5">
                    <Youtube className="w-3.5 h-3.5 text-rose-500" />
                    <span>YouTube Channel &amp; URL</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-[#A39BAD] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.socialLinks.youtube}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          socialLinks: { ...profile.socialLinks, youtube: e.target.checked },
                        })
                      }
                      className="accent-[#A020F0]"
                    />
                    <span>Show</span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={profile.youtubeName}
                    onChange={(e) => setProfile({ ...profile, youtubeName: e.target.value })}
                    placeholder="Gaming Arjun"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                  />
                  <input
                    type="url"
                    required
                    value={profile.youtubeUrl}
                    onChange={(e) => setProfile({ ...profile, youtubeUrl: e.target.value })}
                    placeholder="https://www.youtube.com/@GamingArjun"
                    className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                  />
                </div>
              </div>

              {/* Portfolio */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Portfolio Website URL</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-[10px] text-[#A39BAD] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={profile.socialLinks.portfolio}
                      onChange={(e) =>
                        setProfile({
                          ...profile,
                          socialLinks: { ...profile.socialLinks, portfolio: e.target.checked },
                        })
                      }
                      className="accent-[#A020F0]"
                    />
                    <span>Show</span>
                  </label>
                </div>
                <input
                  type="url"
                  required
                  value={profile.portfolioUrl}
                  onChange={(e) => setProfile({ ...profile, portfolioUrl: e.target.value })}
                  placeholder="https://www.arjunkaharofficial.in/"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
              </div>
            </div>

            {/* Footer Credit & Master Toggle */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-[#1F1930]">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                  Footer Credit Text
                </label>
                <input
                  type="text"
                  required
                  value={profile.footerCreditText}
                  onChange={(e) => setProfile({ ...profile, footerCreditText: e.target.value })}
                  placeholder="Developed & Maintained by DEV ARJUN"
                  className="w-full bg-[#050508] border border-[#1F1930] px-3 py-2 text-xs text-white font-mono focus:border-[#A020F0] focus:outline-none"
                />
                <p className="text-[10px] text-[#A39BAD] mt-1 font-mono">
                  Rendered in the persistent footer, login clearance screen, and sidebar navigation.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1.5">
                  Platform Visibility
                </label>
                <button
                  type="button"
                  onClick={() => setProfile({ ...profile, enabled: !profile.enabled })}
                  className={`w-full py-2 px-3 text-xs font-bold font-mono uppercase tracking-wider border transition-colors flex items-center justify-center gap-2 ${
                    profile.enabled
                      ? 'bg-emerald-950/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-950/40'
                      : 'bg-rose-950/20 text-rose-400 border-rose-500/40 hover:bg-rose-950/40'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${profile.enabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                  <span>{profile.enabled ? 'Developer Credits Active' : 'Credits Hidden'}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-[#1F1930] gap-3">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="text-xs text-[#A39BAD] hover:text-white font-mono underline transition-colors cursor-pointer"
              >
                Reset to DEV ARJUN Defaults
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="w-full sm:w-auto px-6 py-2.5 bg-[#A020F0] hover:bg-[#7B2FFF] text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(160,32,240,0.3)] disabled:opacity-50 cursor-pointer"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving Profile...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save Profile Settings</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
