import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import {
  X,
  Mail,
  Send,
  Globe,
  Instagram,
  Youtube,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Settings,
  Terminal,
  Code2,
  Sparkles,
  Loader2,
  Save,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface DeveloperProfileData {
  _id?: string;
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
  avatarUrl?: string;
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

interface DeveloperProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated?: (updated: DeveloperProfileData) => void;
}

export const DeveloperProfileModal: React.FC<DeveloperProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdated,
}) => {
  const { role: userRole } = useAuth();
  const isAdmin = userRole === 'super_admin';

  const [profile, setProfile] = useState<DeveloperProfileData>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<DeveloperProfileData>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch active profile on open
  useEffect(() => {
    if (isOpen) {
      fetchProfile();
      setCopiedEmail(false);
      setIsEditing(false);
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [isOpen]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/v1/developer-profile', {}, 'none');
      if (res.success && res.data) {
        setProfile(res.data);
        setEditForm(res.data);
      }
    } catch {
      // Fallback to default constants
      setProfile(DEFAULT_PROFILE);
      setEditForm(DEFAULT_PROFILE);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(profile.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await apiRequest(
        '/api/v1/admin/developer-profile',
        {
          method: 'PUT',
          body: JSON.stringify(editForm),
        },
        'admin'
      );

      if (!res.success) {
        setSaveError(res.error?.message || 'Failed to update developer profile.');
        setSaving(false);
        return;
      }

      setProfile(res.data);
      setSaveSuccess(true);
      if (onProfileUpdated) onProfileUpdated(res.data);
      setTimeout(() => {
        setIsEditing(false);
        setSaveSuccess(false);
      }, 1500);
    } catch (err: any) {
      setSaveError(err.message || 'Error updating developer profile');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm select-none font-mono animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dev-profile-title"
    >
      <div
        className="relative w-full max-w-2xl bg-[#08060D] border-2 border-[#1F1930] rounded-none shadow-[0_0_50px_rgba(160,32,240,0.15)] overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0D0914] border-b-2 border-[#1F1930] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-[#A020F0] shadow-[0_0_8px_#A020F0]" />
            <span
              id="dev-profile-title"
              className="text-xs font-bold text-white uppercase tracking-[0.16em]"
            >
              {isEditing ? 'DEVELOPER PROFILE // CONFIGURATION' : 'OFFICIAL DEVELOPER PROFILE'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#C77DFF] hover:text-white bg-[#150F22] hover:bg-[#A020F0] border border-[#2D2147] hover:border-[#A020F0] transition-colors rounded-none flex items-center gap-1.5"
                title="Configure profile details (Admin)"
              >
                <Settings className="w-3 h-3" />
                <span>EDIT</span>
              </button>
            )}
            {isAdmin && isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#A39BAD] hover:text-white bg-[#100D17] border border-[#262035] transition-colors rounded-none"
              >
                CANCEL
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-[#A39BAD] hover:text-white bg-[#100D17] hover:bg-[#1A1426] border border-[#262035] transition-colors rounded-none"
              aria-label="Close dialog"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 scrollbar-thin scrollbar-thumb-[#231E30] scrollbar-track-[#050508]">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-[#A39BAD]">
              <Loader2 className="w-6 h-6 animate-spin text-[#A020F0]" />
              <span className="text-xs tracking-widest uppercase">Loading Developer Profile...</span>
            </div>
          ) : isEditing ? (
            /* ============================================================== */
            /* ADMIN INLINE EDIT MODE                                         */
            /* ============================================================== */
            <form onSubmit={handleSaveProfile} className="space-y-5">
              {saveSuccess && (
                <div className="p-3 bg-[#0A2614] border-2 border-[#10B981] flex items-center gap-2.5 text-xs text-[#10B981] font-bold uppercase tracking-wider">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>Developer profile updated & synced successfully.</span>
                </div>
              )}

              {saveError && (
                <div className="p-3 bg-[#260A0A] border-2 border-[#EF4444] flex items-center gap-2.5 text-xs text-[#EF4444] font-bold uppercase tracking-wider">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    Developer Name <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    Professional Role <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                  Product Identity
                </label>
                <input
                  type="text"
                  required
                  value={editForm.product}
                  onChange={(e) => setEditForm({ ...editForm, product: e.target.value })}
                  className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                  Short Description <span className="text-[#EF4444]">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    Public Contact Email <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    Telegram Handle <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.telegram}
                    onChange={(e) => setEditForm({ ...editForm, telegram: e.target.value })}
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    Telegram URL <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={editForm.telegramUrl}
                    onChange={(e) => setEditForm({ ...editForm, telegramUrl: e.target.value })}
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    Portfolio URL <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="url"
                    required
                    value={editForm.portfolioUrl}
                    onChange={(e) => setEditForm({ ...editForm, portfolioUrl: e.target.value })}
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    Instagram Handle & URL
                  </label>
                  <input
                    type="text"
                    value={editForm.instagram}
                    onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })}
                    placeholder="@handle"
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none mb-1.5"
                  />
                  <input
                    type="url"
                    value={editForm.instagramUrl}
                    onChange={(e) => setEditForm({ ...editForm, instagramUrl: e.target.value })}
                    placeholder="https://instagram.com/..."
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    X (Twitter) Handle & URL
                  </label>
                  <input
                    type="text"
                    value={editForm.twitter}
                    onChange={(e) => setEditForm({ ...editForm, twitter: e.target.value })}
                    placeholder="@handle"
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none mb-1.5"
                  />
                  <input
                    type="url"
                    value={editForm.twitterUrl}
                    onChange={(e) => setEditForm({ ...editForm, twitterUrl: e.target.value })}
                    placeholder="https://x.com/..."
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    YouTube Channel Name & URL
                  </label>
                  <input
                    type="text"
                    value={editForm.youtubeName}
                    onChange={(e) => setEditForm({ ...editForm, youtubeName: e.target.value })}
                    placeholder="Channel Name"
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none mb-1.5"
                  />
                  <input
                    type="url"
                    value={editForm.youtubeUrl}
                    onChange={(e) => setEditForm({ ...editForm, youtubeUrl: e.target.value })}
                    placeholder="https://youtube.com/..."
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-1">
                    Footer Credit Text
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.footerCreditText}
                    onChange={(e) => setEditForm({ ...editForm, footerCreditText: e.target.value })}
                    className="w-full bg-[#050508] border-2 border-[#1F1930] focus:border-[#A020F0] p-2.5 text-xs text-white focus:outline-none rounded-none"
                  />
                </div>
              </div>

              {/* Social Links Enable/Disable Toggles */}
              <div>
                <label className="block text-[10px] font-bold text-[#A39BAD] uppercase tracking-wider mb-2">
                  Visible Social & Contact Badges
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {Object.keys(editForm.socialLinks).map((key) => {
                    const active = (editForm.socialLinks as any)[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          setEditForm({
                            ...editForm,
                            socialLinks: {
                              ...editForm.socialLinks,
                              [key]: !active,
                            },
                          })
                        }
                        className={`p-2 border text-left flex items-center justify-between uppercase font-mono rounded-none transition-colors ${
                          active
                            ? 'bg-[#150F22] border-[#A020F0] text-white'
                            : 'bg-[#050508] border-[#1F1930] text-[#6D657A]'
                        }`}
                      >
                        <span className="text-[11px]">{key}</span>
                        <span className={`text-[9px] font-bold ${active ? 'text-[#10B981]' : 'text-[#6D657A]'}`}>
                          {active ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-[#1F1930]">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-[#100D17] hover:bg-[#1A1426] border border-[#262035] text-xs font-bold uppercase tracking-wider text-[#A39BAD] transition-colors rounded-none"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#A020F0] hover:bg-[#8B1AD6] text-white text-xs font-bold uppercase tracking-wider transition-colors rounded-none flex items-center gap-2 shadow-[0_0_15px_rgba(160,32,240,0.3)] disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>SAVING...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>[ SAVE SETTINGS ]</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* ============================================================== */
            /* PUBLIC DISPLAY MODE (REFINED, BRUTALIST & MODERN)              */
            /* ============================================================== */
            <>
              {/* Profile Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-5 bg-[#0D0914] border-2 border-[#1F1930]">
                {/* Initials Badge Avatar */}
                <div className="w-16 h-16 shrink-0 bg-[#150F24] border-2 border-[#A020F0] flex items-center justify-center shadow-[0_0_20px_rgba(160,32,240,0.25)] relative">
                  <span className="text-xl font-bold font-mono text-white tracking-widest">
                    {profile.name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </span>
                  <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#10B981] border-2 border-[#08060D]" />
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight uppercase">
                      {profile.name}
                    </h2>
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-[#A020F0]/15 text-[#C77DFF] border border-[#A020F0]/40 uppercase tracking-widest">
                      FOUNDER
                    </span>
                  </div>

                  <p className="text-xs text-[#A39BAD] font-bold uppercase tracking-wider">
                    {profile.role} &bull; <span className="text-[#C77DFF]">{profile.product}</span>
                  </p>

                  <div className="flex items-center gap-2 pt-1 text-[10px] text-[#10B981] font-mono">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    <span className="tracking-widest uppercase">Verified System Architect</span>
                  </div>
                </div>
              </div>

              {/* Mission Statement */}
              <div className="p-4 bg-[#0B0812] border-l-4 border-[#A020F0] border-y border-r border-[#1F1930]">
                <p className="text-xs text-[#E1DDEC] leading-relaxed italic">
                  &ldquo;{profile.description}&rdquo;
                </p>
              </div>

              {/* Direct Contact Cards */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#A39BAD] uppercase tracking-[0.14em]">
                  Direct Inquiries & Official Channels
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Email Box with One-Click Copy */}
                  {profile.socialLinks?.email !== false && (
                    <div className="p-3 bg-[#0D0914] border border-[#1F1930] hover:border-[#A020F0] transition-colors flex items-center justify-between group">
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Mail className="w-4 h-4 text-[#A020F0] shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-[9px] text-[#A39BAD] uppercase tracking-wider">Email</span>
                          <a
                            href={`mailto:${profile.email}`}
                            className="text-xs text-white hover:text-[#C77DFF] transition-colors truncate block font-bold"
                            title="Send email"
                          >
                            {profile.email}
                          </a>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCopyEmail}
                        className="px-2 py-1 text-[10px] font-bold uppercase bg-[#150F22] hover:bg-[#A020F0] text-[#C77DFF] hover:text-white border border-[#2D2147] hover:border-[#A020F0] transition-colors rounded-none shrink-0 flex items-center gap-1"
                        title="Copy email address"
                      >
                        {copiedEmail ? (
                          <>
                            <Check className="w-3 h-3 text-[#10B981]" />
                            <span className="text-[#10B981]">COPIED</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>COPY</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Telegram Box */}
                  {profile.socialLinks?.telegram !== false && (
                    <div className="p-3 bg-[#0D0914] border border-[#1F1930] hover:border-[#A020F0] transition-colors flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <Send className="w-4 h-4 text-[#38BDF8] shrink-0" />
                        <div className="min-w-0">
                          <span className="block text-[9px] text-[#A39BAD] uppercase tracking-wider">Telegram</span>
                          <span className="text-xs text-white font-bold truncate block">{profile.telegram}</span>
                        </div>
                      </div>

                      <a
                        href={profile.telegramUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 text-[10px] font-bold uppercase bg-[#150F22] hover:bg-[#38BDF8] text-[#38BDF8] hover:text-[#08060D] border border-[#2D2147] hover:border-[#38BDF8] transition-colors rounded-none shrink-0 flex items-center gap-1"
                      >
                        <span>CHAT</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Official Social Media Grid */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-[#A39BAD] uppercase tracking-[0.14em]">
                  Verified Digital Presence
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {/* Portfolio */}
                  {profile.socialLinks?.portfolio !== false && (
                    <a
                      href={profile.portfolioUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-[#0D0914] border border-[#1F1930] hover:border-[#A020F0] hover:bg-[#150F24] transition-all flex items-center gap-2.5 text-xs text-[#E1DDEC] hover:text-white group"
                      aria-label="Visit Portfolio Website"
                    >
                      <Globe className="w-4 h-4 text-[#A020F0] shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                        <span className="block text-[9px] text-[#A39BAD] uppercase">Portfolio</span>
                        <span className="text-[11px] font-bold truncate block">arjunkahar...in</span>
                      </div>
                    </a>
                  )}

                  {/* Instagram */}
                  {profile.socialLinks?.instagram !== false && (
                    <a
                      href={profile.instagramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-[#0D0914] border border-[#1F1930] hover:border-[#E1306C] hover:bg-[#180B15] transition-all flex items-center gap-2.5 text-xs text-[#E1DDEC] hover:text-white group"
                      aria-label="Visit Instagram Profile"
                    >
                      <Instagram className="w-4 h-4 text-[#E1306C] shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                        <span className="block text-[9px] text-[#A39BAD] uppercase">Instagram</span>
                        <span className="text-[11px] font-bold truncate block">{profile.instagram}</span>
                      </div>
                    </a>
                  )}

                  {/* X (Twitter) */}
                  {profile.socialLinks?.twitter !== false && (
                    <a
                      href={profile.twitterUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-[#0D0914] border border-[#1F1930] hover:border-white hover:bg-[#121216] transition-all flex items-center gap-2.5 text-xs text-[#E1DDEC] hover:text-white group"
                      aria-label="Visit X (Twitter) Profile"
                    >
                      <span className="w-4 h-4 flex items-center justify-center font-bold text-sm text-white shrink-0 group-hover:scale-110 transition-transform">
                        𝕏
                      </span>
                      <div className="min-w-0">
                        <span className="block text-[9px] text-[#A39BAD] uppercase">X (Twitter)</span>
                        <span className="text-[11px] font-bold truncate block">{profile.twitter}</span>
                      </div>
                    </a>
                  )}

                  {/* YouTube */}
                  {profile.socialLinks?.youtube !== false && (
                    <a
                      href={profile.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-[#0D0914] border border-[#1F1930] hover:border-[#EF4444] hover:bg-[#1C0A0A] transition-all flex items-center gap-2.5 text-xs text-[#E1DDEC] hover:text-white group"
                      aria-label="Visit YouTube Channel"
                    >
                      <Youtube className="w-4 h-4 text-[#EF4444] shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                        <span className="block text-[9px] text-[#A39BAD] uppercase">YouTube</span>
                        <span className="text-[11px] font-bold truncate block">{profile.youtubeName}</span>
                      </div>
                    </a>
                  )}

                  {/* Telegram Channel / Contact */}
                  {profile.socialLinks?.telegram !== false && (
                    <a
                      href={profile.telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-[#0D0914] border border-[#1F1930] hover:border-[#38BDF8] hover:bg-[#0A1624] transition-all flex items-center gap-2.5 text-xs text-[#E1DDEC] hover:text-white group"
                      aria-label="Open Telegram Profile"
                    >
                      <Send className="w-4 h-4 text-[#38BDF8] shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="min-w-0">
                        <span className="block text-[9px] text-[#A39BAD] uppercase">Telegram</span>
                        <span className="text-[11px] font-bold truncate block">{profile.telegram}</span>
                      </div>
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Credit & Close */}
        <div className="p-4 bg-[#0A0711] border-t-2 border-[#1F1930] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#A39BAD] shrink-0">
          <div className="flex items-center gap-2 text-[11px]">
            <Code2 className="w-3.5 h-3.5 text-[#A020F0]" />
            <span>{profile.footerCreditText}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-1.5 bg-[#100D17] hover:bg-[#A020F0] text-[#A39BAD] hover:text-white border border-[#262035] hover:border-[#A020F0] text-xs font-bold uppercase tracking-wider transition-colors rounded-none"
            >
              [ CLOSE ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
