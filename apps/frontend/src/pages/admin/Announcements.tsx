import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import {
  Megaphone,
  Plus,
  Play,
  Pause,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  Loader2,
  X,
  Users,
  Search,
  Filter,
  Eye,
  Calendar,
  Target,
  Send,
  Globe,
  Radio,
  UserCheck,
  Zap,
  Shield,
  Key,
  CreditCard,
  Sparkles,
  Clock,
  Check,
  ExternalLink,
  ChevronRight,
  User,
} from 'lucide-react';

export const AdminAnnouncements: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'direct' | 'mass' | 'history'>('direct');
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'direct' | 'mass'>('all');

  // Direct User Dispatch State
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [directForm, setDirectForm] = useState({
    title: '',
    message: '',
    type: 'general',
    severity: 'information',
    priority: 50,
    acknowledgmentRequired: false,
    recommendedAction: '',
    actionUrl: '',
  });
  const [dispatchingDirect, setDispatchingDirect] = useState(false);
  const [directSuccessBanner, setDirectSuccessBanner] = useState<string | null>(null);

  // Mass Broadcast State
  const [emergencyTitle, setEmergencyTitle] = useState('');
  const [emergencyMessage, setEmergencyMessage] = useState('');
  const [broadcastingEmergency, setBroadcastingEmergency] = useState(false);
  const [emergencySuccessBanner, setEmergencySuccessBanner] = useState<string | null>(null);

  const [massForm, setMassForm] = useState({
    title: '',
    message: '',
    type: 'maintenance',
    severity: 'warning',
    priority: 30,
    acknowledgmentRequired: false,
    recommendedAction: '',
    actionUrl: '',
    targetScope: 'global',
  });
  const [broadcastingMass, setBroadcastingMass] = useState(false);

  // Modal State for custom creation & ack telemetry
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAckAnnouncement, setSelectedAckAnnouncement] = useState<any | null>(null);

  // Form State for generic modal
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'general',
    severity: 'information',
    priority: 10,
    targetScope: 'global',
    targetApiId: '',
    targetEndpoint: '',
    targetClientId: '',
    targetApiKey: '',
    targetVersion: 'v1',
    actionUrl: '',
    docsUrl: '',
    recommendedAction: '',
    acknowledgmentRequired: false,
    status: 'published',
  });

  useEffect(() => {
    fetchAnnouncements();
    fetchCustomers();
  }, [statusFilter, typeFilter]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (statusFilter !== 'all') query.set('status', statusFilter);
      if (typeFilter !== 'all') query.set('type', typeFilter);
      if (search) query.set('search', search);

      const res = await apiRequest(`/api/v1/admin/announcements?${query.toString()}`, {}, 'admin');
      if (res.success) {
        setAnnouncements(res.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    setCustomersLoading(true);
    try {
      const res = await apiRequest('/api/v1/admin/customers?limit=100', {}, 'admin');
      if (res.success) {
        setCustomers(res.data || []);
      }
    } catch (e) {
      console.error('Failed to load customers:', e);
    } finally {
      setCustomersLoading(false);
    }
  };

  const applyDirectTemplate = (templateName: string) => {
    const username = selectedCustomer?.username || 'Client';
    switch (templateName) {
      case 'quota_warning':
        setDirectForm({
          title: `⚠️ API Quota Alert: High Usage on @${username}`,
          message: `Dear @${username}, your API key (${selectedCustomer?.keyPrefix || 'arjun_live'}••••) has utilized over 85% of its allocated daily quota. Upgrade your plan or adjust concurrency pacing to prevent request throttling.`,
          type: 'warning',
          severity: 'warning',
          priority: 80,
          acknowledgmentRequired: true,
          recommendedAction: 'Check usage in dashboard or contact admin for quota increase.',
          actionUrl: '/customer/usage',
        });
        break;
      case 'security_alert':
        setDirectForm({
          title: `🚨 Security Notice: Anomalous Access Pattern on @${username}`,
          message: `Suspicious concurrent IP activity was detected on your API key (${selectedCustomer?.keyPrefix || 'arjun_live'}••••). Please verify that your client server IP is correct and rotate your API key if compromised.`,
          type: 'security',
          severity: 'critical',
          priority: 95,
          acknowledgmentRequired: true,
          recommendedAction: 'Verify bound IP addresses and reset API key immediately.',
          actionUrl: '/customer/security',
        });
        break;
      case 'key_rotation':
        setDirectForm({
          title: `🔑 API Key Maintenance Notice for @${username}`,
          message: `Your API key (${selectedCustomer?.keyPrefix || 'arjun_live'}••••) is scheduled for routine security rotation. Please check your developer portal to retrieve the latest configuration.`,
          type: 'update',
          severity: 'information',
          priority: 50,
          acknowledgmentRequired: false,
          recommendedAction: 'Switch upstream clients to the newly issued API key within 48 hours.',
          actionUrl: '/customer/playground',
        });
        break;
      case 'plan_expiry':
        setDirectForm({
          title: `💳 Subscription Plan Expiring Soon for @${username}`,
          message: `Your API Manager account is scheduled to expire on ${selectedCustomer?.expiresAt ? new Date(selectedCustomer.expiresAt).toLocaleDateString() : 'the end of this billing period'}. Renew your tier to ensure uninterrupted access to live routes.`,
          type: 'restriction',
          severity: 'warning',
          priority: 75,
          acknowledgmentRequired: true,
          recommendedAction: 'Contact administrator to renew API validity.',
          actionUrl: '',
        });
        break;
      case 'custom_note':
        setDirectForm({
          title: `Direct Instruction for @${username}`,
          message: '',
          type: 'general',
          severity: 'information',
          priority: 50,
          acknowledgmentRequired: false,
          recommendedAction: '',
          actionUrl: '',
        });
        break;
    }
  };

  const handleDirectDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) {
      alert('Please select a target customer first.');
      return;
    }
    if (!directForm.title.trim() || !directForm.message.trim()) {
      alert('Please provide a message title and details.');
      return;
    }

    setDispatchingDirect(true);
    try {
      const res = await apiRequest(
        '/api/v1/admin/announcements/direct-user',
        {
          method: 'POST',
          body: JSON.stringify({
            customerId: selectedCustomer._id,
            customerUsername: selectedCustomer.username,
            targetApiKey: selectedCustomer.keyPrefix,
            title: directForm.title.trim(),
            message: directForm.message.trim(),
            type: directForm.type,
            severity: directForm.severity,
            priority: Number(directForm.priority) || 50,
            acknowledgmentRequired: directForm.acknowledgmentRequired,
            recommendedAction: directForm.recommendedAction.trim() || undefined,
            actionUrl: directForm.actionUrl.trim() || undefined,
          }),
        },
        'admin'
      );

      if (res.success) {
        setDirectSuccessBanner(
          `Direct message dispatched live to @${selectedCustomer.username} [${res.data?.announcementId}]!`
        );
        setDirectForm({
          title: '',
          message: '',
          type: 'general',
          severity: 'information',
          priority: 50,
          acknowledgmentRequired: false,
          recommendedAction: '',
          actionUrl: '',
        });
        fetchAnnouncements();
        setTimeout(() => setDirectSuccessBanner(null), 7000);
      } else {
        alert(res.error?.message || 'Failed to dispatch direct message.');
      }
    } catch (err: any) {
      alert(err.message || 'Error dispatching direct message.');
    } finally {
      setDispatchingDirect(false);
    }
  };

  const handleMassEmergencyBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyTitle.trim() || !emergencyMessage.trim()) {
      alert('Title and incident message are required for emergency broadcast.');
      return;
    }

    setBroadcastingEmergency(true);
    try {
      const res = await apiRequest(
        '/api/v1/admin/announcements/emergency',
        {
          method: 'POST',
          body: JSON.stringify({
            title: emergencyTitle.trim(),
            message: emergencyMessage.trim(),
          }),
        },
        'admin'
      );

      if (res.success) {
        setEmergencySuccessBanner(
          `🚨 Emergency broadcast published live across ALL API routes cluster-wide! [${res.data?.announcementId}]`
        );
        setEmergencyTitle('');
        setEmergencyMessage('');
        fetchAnnouncements();
        setTimeout(() => setEmergencySuccessBanner(null), 8000);
      } else {
        alert(res.error?.message || 'Failed to broadcast emergency announcement.');
      }
    } catch (err: any) {
      alert(err.message || 'Error broadcasting emergency.');
    } finally {
      setBroadcastingEmergency(false);
    }
  };

  const handleMassGeneralBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!massForm.title.trim() || !massForm.message.trim()) {
      alert('Title and message are required.');
      return;
    }

    setBroadcastingMass(true);
    try {
      const res = await apiRequest(
        '/api/v1/admin/announcements',
        {
          method: 'POST',
          body: JSON.stringify({
            ...massForm,
            targetScope: 'global',
            status: 'published',
          }),
        },
        'admin'
      );

      if (res.success) {
        setEmergencySuccessBanner(
          `Global platform announcement published to all clients! [${res.data?.announcementId}]`
        );
        setMassForm({
          title: '',
          message: '',
          type: 'maintenance',
          severity: 'warning',
          priority: 30,
          acknowledgmentRequired: false,
          recommendedAction: '',
          actionUrl: '',
          targetScope: 'global',
        });
        fetchAnnouncements();
        setTimeout(() => setEmergencySuccessBanner(null), 6000);
      } else {
        alert(res.error?.message || 'Failed to publish mass announcement.');
      }
    } catch (err: any) {
      alert(err.message || 'Error publishing mass announcement.');
    } finally {
      setBroadcastingMass(false);
    }
  };

  const handlePublish = async (id: string) => {
    await apiRequest(`/api/v1/admin/announcements/${id}/publish`, { method: 'POST' }, 'admin');
    fetchAnnouncements();
  };

  const handlePause = async (id: string) => {
    await apiRequest(`/api/v1/admin/announcements/${id}/pause`, { method: 'POST' }, 'admin');
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    if (confirm(`Are you sure you want to delete announcement ${id}?`)) {
      await apiRequest(`/api/v1/admin/announcements/${id}`, { method: 'DELETE' }, 'admin');
      fetchAnnouncements();
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
      case 'warning':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'success':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'published':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'paused':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/40';
    }
  };

  const filteredCustomers = customers.filter((c) => {
    if (!customerSearchQuery.trim()) return true;
    const q = customerSearchQuery.toLowerCase();
    return (
      (c.username && c.username.toLowerCase().includes(q)) ||
      (c.fullName && c.fullName.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.keyPrefix && c.keyPrefix.toLowerCase().includes(q))
    );
  });

  const activeCount = announcements.filter((a) => a.status === 'published').length;
  const directCount = announcements.filter((a) => a.targetScope === 'client').length;
  const massCount = announcements.filter((a) => a.targetScope === 'global').length;
  const totalAcks = announcements.reduce((sum, a) => sum + (a.acknowledgments?.length || 0), 0);

  const displayedAnnouncements = announcements.filter((ann) => {
    if (scopeFilter === 'direct') return ann.targetScope === 'client';
    if (scopeFilter === 'mass') return ann.targetScope === 'global';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-mono select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A1A4A] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#A020F0] rounded-none shadow-[0_0_8px_#A020F0]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#F5F3FA] tracking-tight uppercase font-['Archivo_Black',sans-serif]">
              Announcement & Direct Dispatch Center
            </h1>
          </div>
          <p className="text-xs text-[#A39BAD] mt-1">
            Send targeted direct messages to specific users or broadcast platform-wide emergency notices cluster-wide
          </p>
        </div>

        {/* Global Stats Counter */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 bg-[#100D17] border border-[#2A1A4A] text-right">
            <div className="text-[10px] text-[#A39BAD] uppercase">Live Gateway Active</div>
            <div className="text-sm font-black text-emerald-400">{activeCount} Routes Active</div>
          </div>
        </div>
      </div>

      {/* Mode Selection Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <button
          onClick={() => setActiveTab('direct')}
          className={`p-4 border-2 flex items-center justify-between transition-all ${
            activeTab === 'direct'
              ? 'bg-[#180A2E] border-[#A020F0] text-white shadow-[0_0_20px_rgba(160,32,240,0.3)]'
              : 'bg-[#100D17] border-[#2A1A4A] text-[#A39BAD] hover:text-white hover:border-[#A020F0]/50'
          }`}
        >
          <div className="flex items-center gap-3 text-left">
            <Target className={`w-5 h-5 ${activeTab === 'direct' ? 'text-[#C084FC]' : 'text-[#A39BAD]'}`} />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white">
                🎯 Direct User Dispatch
              </div>
              <div className="text-[10px] text-[#A39BAD] mt-0.5">
                Target specific user with personalized request or alert
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-[#A020F0]/20 text-[#D8B4FE] border border-[#A020F0]/40">
            {directCount} Direct
          </span>
        </button>

        <button
          onClick={() => setActiveTab('mass')}
          className={`p-4 border-2 flex items-center justify-between transition-all ${
            activeTab === 'mass'
              ? 'bg-[#2A0808] border-[#EF4444] text-white shadow-[0_0_20px_rgba(239,68,68,0.3)]'
              : 'bg-[#100D17] border-[#2A1A4A] text-[#A39BAD] hover:text-white hover:border-[#EF4444]/50'
          }`}
        >
          <div className="flex items-center gap-3 text-left">
            <Radio className={`w-5 h-5 ${activeTab === 'mass' ? 'text-[#F87171]' : 'text-[#A39BAD]'}`} />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white">
                🌐 Mass & Emergency Broadcast
              </div>
              <div className="text-[10px] text-[#A39BAD] mt-0.5">
                Platform-wide emergency alerts & global maintenance
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-[#EF4444]/20 text-[#FCA5A5] border border-[#EF4444]/40">
            {massCount} Mass
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`p-4 border-2 flex items-center justify-between transition-all ${
            activeTab === 'history'
              ? 'bg-[#0B192C] border-[#0284C7] text-white shadow-[0_0_20px_rgba(2,132,199,0.3)]'
              : 'bg-[#100D17] border-[#2A1A4A] text-[#A39BAD] hover:text-white hover:border-[#0284C7]/50'
          }`}
        >
          <div className="flex items-center gap-3 text-left">
            <Users className={`w-5 h-5 ${activeTab === 'history' ? 'text-[#38BDF8]' : 'text-[#A39BAD]'}`} />
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-white">
                📋 All Dispatches & Telemetry
              </div>
              <div className="text-[10px] text-[#A39BAD] mt-0.5">
                Live delivery counts & client acknowledgment logs
              </div>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-bold bg-[#0284C7]/20 text-[#7DD3FC] border border-[#0284C7]/40">
            {totalAcks} Acks
          </span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* MODE 1: 🎯 TARGETED INDIVIDUAL USER DIRECT DISPATCH PANEL */}
      {/* ======================================================== */}
      {activeTab === 'direct' && (
        <div className="bg-[#100D17] border-2 border-[#A020F0] p-6 space-y-6 shadow-2xl relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A1A4A] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-[#A020F0]/20 border border-[#A020F0] flex items-center justify-center text-[#D8B4FE]">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Targeted Individual User Direct Dispatch
                </h2>
                <p className="text-[11px] text-[#A39BAD]">
                  Select a user from your client list and send a dedicated, tailored message or instruction directly to their key and dashboard
                </p>
              </div>
            </div>
            {selectedCustomer && (
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-xs text-[#A39BAD] hover:text-white flex items-center gap-1 border border-[#2A1A4A] px-2.5 py-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Change Target User</span>
              </button>
            )}
          </div>

          {/* Success Banner */}
          {directSuccessBanner && (
            <div className="p-4 bg-[#052E16] border-2 border-[#16A34A] text-white flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                <span>{directSuccessBanner}</span>
              </div>
              <button
                onClick={() => setDirectSuccessBanner(null)}
                className="text-[10px] uppercase font-bold border border-current px-2 py-0.5 hover:bg-white hover:text-black"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Step 1: Select User */}
          {!selectedCustomer ? (
            <div className="space-y-4 bg-[#050508] border border-[#2A1A4A] p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <User className="w-4 h-4 text-[#A020F0]" />
                  <span>Step 1: Select Target User to Receive Message</span>
                </label>
                <span className="text-[11px] text-[#A39BAD]">
                  [{customers.length} registered customers available]
                </span>
              </div>

              {/* Search Customer Input */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-[#A39BAD]" />
                <input
                  type="text"
                  placeholder="Filter users by username, email, full name, or API key prefix..."
                  value={customerSearchQuery}
                  onChange={(e) => setCustomerSearchQuery(e.target.value)}
                  className="w-full bg-[#100D17] border border-[#2A1A4A] pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#525252] focus:outline-none focus:border-[#A020F0]"
                />
              </div>

              {/* Customer Selector Grid */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {customersLoading ? (
                  <div className="py-8 text-center text-[#A39BAD] text-xs">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#A020F0]" />
                    Loading customer accounts...
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="py-8 text-center text-[#A39BAD] text-xs">
                    No customers match your search query.
                  </div>
                ) : (
                  filteredCustomers.map((c) => (
                    <div
                      key={c._id}
                      onClick={() => {
                        setSelectedCustomer(c);
                        setDirectForm((prev) => ({
                          ...prev,
                          title: prev.title || `Direct Message to @${c.username}`,
                        }));
                      }}
                      className="p-3 bg-[#100D17] border border-[#2A1A4A] hover:border-[#A020F0] cursor-pointer flex items-center justify-between gap-3 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-none bg-[#A020F0]/20 border border-[#A020F0]/40 flex items-center justify-center text-xs font-bold text-white shrink-0 group-hover:bg-[#A020F0] transition-colors">
                          {c.username ? c.username.slice(0, 2).toUpperCase() : 'US'}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-xs truncate">
                              {c.fullName || c.username}
                            </span>
                            <span className="text-[10px] text-[#A020F0] font-bold">
                              @{c.username}
                            </span>
                          </div>
                          <div className="text-[10px] text-[#A39BAD] truncate">
                            {c.email} • Key: <span className="text-white">{c.keyPrefix || 'arjun_live'}••••</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] px-2 py-0.5 bg-[#050508] border border-[#2A1A4A] text-[#22C55E]">
                          {c.status?.toUpperCase() || 'ACTIVE'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-[#A39BAD] group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Selected User Profile Summary Card */
            <div className="p-4 bg-[#180A2E] border-2 border-[#A020F0] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 bg-[#A020F0] text-white flex items-center justify-center font-black text-sm border border-white">
                  {selectedCustomer.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">
                      {selectedCustomer.fullName || selectedCustomer.username}
                    </span>
                    <span className="text-xs text-[#D8B4FE] font-bold">
                      @{selectedCustomer.username}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                      {selectedCustomer.status || 'ACTIVE'}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#C084FC] mt-0.5">
                    Target Key Prefix:{' '}
                    <code className="text-white bg-black/40 px-1.5 py-0.5">
                      {selectedCustomer.keyPrefix || 'arjun_live'}••••••••
                    </code>{' '}
                    • Email: {selectedCustomer.email}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 text-xs">
                <span className="px-3 py-1 bg-black/50 border border-[#A020F0] text-[#E9D5FF]">
                  🎯 Direct Scope Locked
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="px-3 py-1 bg-[#2A1A4A] hover:bg-[#3D256B] text-white font-bold transition-colors"
                >
                  Change User
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Preset Fast Templates */}
          {selectedCustomer && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#A39BAD] uppercase flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Step 2: Quick Message Presets for @{selectedCustomer.username}</span>
                </span>
                <span className="text-[10px] text-[#A39BAD]">Clicking pre-fills direct form</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => applyDirectTemplate('quota_warning')}
                  className="p-2.5 bg-[#050508] border border-[#2A1A4A] hover:border-[#F59E0B] text-left transition-colors group"
                >
                  <div className="text-[11px] font-bold text-[#F59E0B] flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Quota Warning
                  </div>
                  <div className="text-[9px] text-[#A39BAD] mt-1 group-hover:text-white">
                    Approaching 90% usage
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyDirectTemplate('security_alert')}
                  className="p-2.5 bg-[#050508] border border-[#2A1A4A] hover:border-[#EF4444] text-left transition-colors group"
                >
                  <div className="text-[11px] font-bold text-[#EF4444] flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Security Alert
                  </div>
                  <div className="text-[9px] text-[#A39BAD] mt-1 group-hover:text-white">
                    Suspicious concurrent IP
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyDirectTemplate('key_rotation')}
                  className="p-2.5 bg-[#050508] border border-[#2A1A4A] hover:border-[#0284C7] text-left transition-colors group"
                >
                  <div className="text-[11px] font-bold text-[#38BDF8] flex items-center gap-1">
                    <Key className="w-3 h-3" /> Key Rotation
                  </div>
                  <div className="text-[9px] text-[#A39BAD] mt-1 group-hover:text-white">
                    Scheduled key update
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyDirectTemplate('plan_expiry')}
                  className="p-2.5 bg-[#050508] border border-[#2A1A4A] hover:border-[#EAB308] text-left transition-colors group"
                >
                  <div className="text-[11px] font-bold text-[#EAB308] flex items-center gap-1">
                    <CreditCard className="w-3 h-3" /> Plan Expiry
                  </div>
                  <div className="text-[9px] text-[#A39BAD] mt-1 group-hover:text-white">
                    Validity expiring soon
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyDirectTemplate('custom_note')}
                  className="p-2.5 bg-[#050508] border border-[#2A1A4A] hover:border-[#A020F0] text-left transition-colors group"
                >
                  <div className="text-[11px] font-bold text-[#C084FC] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Custom Note
                  </div>
                  <div className="text-[9px] text-[#A39BAD] mt-1 group-hover:text-white">
                    Personalized message
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Message Composer Form */}
          {selectedCustomer && (
            <form onSubmit={handleDirectDispatch} className="space-y-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                  Direct Subject / Title <span className="text-[#EF4444]">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Action Required: Verification for your API Key"
                  value={directForm.title}
                  onChange={(e) => setDirectForm({ ...directForm, title: e.target.value })}
                  className="w-full bg-[#050508] border border-[#2A1A4A] p-2.5 text-xs text-white focus:outline-none focus:border-[#A020F0]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                  Message / Instruction for @{selectedCustomer.username} <span className="text-[#EF4444]">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Type specific instructions, warning details, or guidance for this user..."
                  value={directForm.message}
                  onChange={(e) => setDirectForm({ ...directForm, message: e.target.value })}
                  className="w-full bg-[#050508] border border-[#2A1A4A] p-2.5 text-xs text-white focus:outline-none focus:border-[#A020F0]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">
                    Message Type
                  </label>
                  <select
                    value={directForm.type}
                    onChange={(e) => setDirectForm({ ...directForm, type: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="general">General Message</option>
                    <option value="warning">Warning Notice</option>
                    <option value="security">Security Alert</option>
                    <option value="restriction">Usage Restriction</option>
                    <option value="update">Update Request</option>
                    <option value="custom">Custom Instruction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">
                    Severity Level
                  </label>
                  <select
                    value={directForm.severity}
                    onChange={(e) => setDirectForm({ ...directForm, severity: e.target.value as any })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="information">Information (Cyan)</option>
                    <option value="warning">Warning (Amber)</option>
                    <option value="critical">Critical (Red)</option>
                    <option value="success">Success (Emerald)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">
                    Priority (1 - 100)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={directForm.priority}
                    onChange={(e) => setDirectForm({ ...directForm, priority: Number(e.target.value) })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">
                    Recommended Action (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rotate your API key within 24 hours"
                    value={directForm.recommendedAction}
                    onChange={(e) => setDirectForm({ ...directForm, recommendedAction: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">
                    Action URL / Deep Link (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. /customer/security"
                    value={directForm.actionUrl}
                    onChange={(e) => setDirectForm({ ...directForm, actionUrl: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-[#050508] border border-[#2A1A4A]">
                <input
                  type="checkbox"
                  id="directAckReq"
                  checked={directForm.acknowledgmentRequired}
                  onChange={(e) => setDirectForm({ ...directForm, acknowledgmentRequired: e.target.checked })}
                  className="w-4 h-4 accent-[#A020F0] cursor-pointer"
                />
                <label htmlFor="directAckReq" className="text-xs text-white font-bold cursor-pointer">
                  Require Client Acknowledgment Receipt{' '}
                  <span className="text-[10px] text-[#A39BAD] font-normal">
                    (User must explicitly click 'Acknowledge' in dashboard or send ACK header)
                  </span>
                </label>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="submit"
                  disabled={dispatchingDirect}
                  className="px-6 py-3 bg-[#A020F0] hover:bg-[#7B2FFF] text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 shadow-[0_0_20px_rgba(160,32,240,0.5)] transition-all disabled:opacity-50"
                >
                  {dispatchingDirect ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>DISPATCHING DIRECT MESSAGE...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>DISPATCH DIRECT TO @{selectedCustomer.username.toUpperCase()}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 2: 🌐 MASS PLATFORM & EMERGENCY BROADCAST PANEL     */}
      {/* ======================================================== */}
      {activeTab === 'mass' && (
        <div className="space-y-6">
          {/* Success Banner */}
          {emergencySuccessBanner && (
            <div className="p-4 bg-[#052E16] border-2 border-[#16A34A] text-white flex items-center justify-between animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold">
                <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                <span>{emergencySuccessBanner}</span>
              </div>
              <button
                onClick={() => setEmergencySuccessBanner(null)}
                className="text-[10px] uppercase font-bold border border-current px-2 py-0.5 hover:bg-white hover:text-black"
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Critical Emergency Broadcast Card */}
            <div className="bg-[#150505] border-2 border-[#EF4444] p-6 space-y-5 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
              <div className="flex items-center gap-3 border-b border-[#EF4444]/40 pb-4">
                <div className="w-9 h-9 bg-[#EF4444]/20 border border-[#EF4444] flex items-center justify-center text-[#EF4444] animate-pulse">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <span>Platform Emergency Broadcast</span>
                    <span className="px-1.5 py-0.5 bg-[#EF4444] text-white text-[9px]">CRITICAL 100</span>
                  </h2>
                  <p className="text-[11px] text-[#FCA5A5] mt-0.5">
                    Broadcasts immediately to all live routes, response headers, and dashboards cluster-wide
                  </p>
                </div>
              </div>

              <form onSubmit={handleMassEmergencyBroadcast} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                    Emergency Subject <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Major Upstream Cloud Incident"
                    value={emergencyTitle}
                    onChange={(e) => setEmergencyTitle(e.target.value)}
                    className="w-full bg-[#050508] border border-[#EF4444]/50 p-2.5 text-xs text-white focus:outline-none focus:border-[#EF4444]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                    Emergency Incident Details <span className="text-[#EF4444]">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="Explain the critical incident or outage. Injected directly into live API responses cluster-wide..."
                    value={emergencyMessage}
                    onChange={(e) => setEmergencyMessage(e.target.value)}
                    className="w-full bg-[#050508] border border-[#EF4444]/50 p-2.5 text-xs text-white focus:outline-none focus:border-[#EF4444]"
                  />
                </div>

                <div className="p-3 bg-black/60 border border-[#EF4444]/30 text-[11px] text-[#FCA5A5] space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-[#EF4444]" />
                    <span>Emergency Automated Behaviors:</span>
                  </div>
                  <div>• Sets Priority to maximum (100) across the cluster</div>
                  <div>• Injects 'X-Karvion-Announcement' into every API response header</div>
                  <div>• Enforces client acknowledgment requirement</div>
                </div>

                <button
                  type="submit"
                  disabled={broadcastingEmergency}
                  className="w-full py-3.5 bg-[#EF4444] hover:bg-[#DC2626] text-white font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(239,68,68,0.5)] transition-all disabled:opacity-50"
                >
                  {broadcastingEmergency ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>BROADCASTING EMERGENCY CLUSTER-WIDE...</span>
                    </>
                  ) : (
                    <>
                      <Radio className="w-4 h-4 animate-pulse" />
                      <span>INITIATE PLATFORM EMERGENCY BROADCAST</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* General Mass Broadcast Form */}
            <div className="bg-[#100D17] border-2 border-[#2A1A4A] p-6 space-y-5">
              <div className="flex items-center gap-3 border-b border-[#2A1A4A] pb-4">
                <div className="w-9 h-9 bg-[#0284C7]/20 border border-[#0284C7] flex items-center justify-center text-[#38BDF8]">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                    Global Platform Announcement
                  </h2>
                  <p className="text-[11px] text-[#A39BAD] mt-0.5">
                    Scheduled platform maintenance, feature releases, and general notices to all clients
                  </p>
                </div>
              </div>

              <form onSubmit={handleMassGeneralBroadcast} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                    Announcement Title <span className="text-[#EF4444]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Scheduled Maintenance Notice for Friday"
                    value={massForm.title}
                    onChange={(e) => setMassForm({ ...massForm, title: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2.5 text-xs text-white focus:outline-none focus:border-[#A020F0]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                    Announcement Message <span className="text-[#EF4444]">*</span>
                  </label>
                  <textarea
                    rows={4}
                    required
                    placeholder="General announcement broadcast to all users..."
                    value={massForm.message}
                    onChange={(e) => setMassForm({ ...massForm, message: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2.5 text-xs text-white focus:outline-none focus:border-[#A020F0]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">Type</label>
                    <select
                      value={massForm.type}
                      onChange={(e) => setMassForm({ ...massForm, type: e.target.value })}
                      className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none"
                    >
                      <option value="maintenance">Maintenance</option>
                      <option value="general">General</option>
                      <option value="update">Update</option>
                      <option value="deprecation">Deprecation</option>
                      <option value="warning">Warning</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">Severity</label>
                    <select
                      value={massForm.severity}
                      onChange={(e) => setMassForm({ ...massForm, severity: e.target.value as any })}
                      className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-xs text-white focus:outline-none"
                    >
                      <option value="warning">Warning</option>
                      <option value="information">Information</option>
                      <option value="critical">Critical</option>
                      <option value="success">Success</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-[#050508] border border-[#2A1A4A]">
                  <input
                    type="checkbox"
                    id="massAckReq"
                    checked={massForm.acknowledgmentRequired}
                    onChange={(e) => setMassForm({ ...massForm, acknowledgmentRequired: e.target.checked })}
                    className="w-4 h-4 accent-[#A020F0] cursor-pointer"
                  />
                  <label htmlFor="massAckReq" className="text-xs text-white font-bold cursor-pointer">
                    Require Client Acknowledgment
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={broadcastingMass}
                  className="w-full py-3 bg-[#100D17] hover:bg-[#A020F0] text-white border-2 border-[#A020F0] font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {broadcastingMass ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>PUBLISHING GLOBAL ANNOUNCEMENT...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      <span>BROADCAST TO ALL CONNECTED CLIENTS</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODE 3: 📋 ALL DISPATCHES & TELEMETRY LIST                */}
      {/* ======================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Telemetry Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#100D17] border border-[#2A1A4A] p-4">
              <div className="text-[11px] text-[#A39BAD] uppercase font-bold">Active in Gateway</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
              <div className="text-[10px] text-[#A39BAD] mt-1">Injecting on live API responses</div>
            </div>
            <div className="bg-[#100D17] border border-[#2A1A4A] p-4">
              <div className="text-[11px] text-[#A39BAD] uppercase font-bold">Direct Dispatches</div>
              <div className="text-2xl font-black text-[#C084FC] mt-1">{directCount}</div>
              <div className="text-[10px] text-[#A39BAD] mt-1">Targeted to specific users</div>
            </div>
            <div className="bg-[#100D17] border border-[#2A1A4A] p-4">
              <div className="text-[11px] text-[#A39BAD] uppercase font-bold">Mass Broadcasts</div>
              <div className="text-2xl font-black text-[#F87171] mt-1">{massCount}</div>
              <div className="text-[10px] text-[#A39BAD] mt-1">Platform-wide notices</div>
            </div>
            <div className="bg-[#100D17] border border-[#2A1A4A] p-4">
              <div className="text-[11px] text-[#A39BAD] uppercase font-bold">Total Client Acks</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{totalAcks}</div>
              <div className="text-[10px] text-[#A39BAD] mt-1">Receipts recorded</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-[#100D17] border border-[#2A1A4A] p-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#A39BAD]" />
              <input
                type="text"
                placeholder="Search announcements by title, message or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchAnnouncements()}
                className="w-full bg-[#050508] border border-[#2A1A4A] pl-9 pr-3 py-1.5 text-xs text-[#F5F3FA] focus:outline-none focus:border-[#A020F0]"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={scopeFilter}
                onChange={(e) => setScopeFilter(e.target.value as any)}
                className="bg-[#050508] border border-[#2A1A4A] px-3 py-1.5 text-xs text-[#F5F3FA] focus:outline-none"
              >
                <option value="all">Scope: All</option>
                <option value="direct">🎯 Direct User Only</option>
                <option value="mass">🌐 Mass Broadcast Only</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-[#050508] border border-[#2A1A4A] px-3 py-1.5 text-xs text-[#F5F3FA] focus:outline-none"
              >
                <option value="all">Status: All</option>
                <option value="published">Published</option>
                <option value="paused">Paused</option>
                <option value="draft">Draft</option>
              </select>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-[#050508] border border-[#2A1A4A] px-3 py-1.5 text-xs text-[#F5F3FA] focus:outline-none"
              >
                <option value="all">Type: All</option>
                <option value="emergency">Emergency</option>
                <option value="maintenance">Maintenance</option>
                <option value="warning">Warning</option>
                <option value="security">Security</option>
                <option value="update">Update</option>
              </select>
            </div>
          </div>

          {/* Telemetry List */}
          <div className="space-y-3">
            {loading ? (
              <div className="p-12 text-center text-[#A39BAD]">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#A020F0]" />
                <span>Loading dispatches & telemetry...</span>
              </div>
            ) : displayedAnnouncements.length === 0 ? (
              <div className="bg-[#100D17] border border-[#2A1A4A] p-12 text-center text-[#A39BAD]">
                <Megaphone className="w-10 h-10 mx-auto mb-3 text-[#A020F0]/40" />
                <p className="font-bold text-[#F5F3FA]">No Announcements Found</p>
                <p className="text-xs mt-1">
                  Use the 'Direct User Dispatch' or 'Mass Broadcast' tabs above to dispatch new messages.
                </p>
              </div>
            ) : (
              displayedAnnouncements.map((ann) => {
                const isDirect = ann.targetScope === 'client';
                const isEmergency = ann.type === 'emergency' || ann.severity === 'critical';

                return (
                  <div
                    key={ann.announcementId || ann._id}
                    className={`bg-[#100D17] border-2 p-5 space-y-3 transition-colors ${
                      isEmergency
                        ? 'border-[#EF4444]/60 hover:border-[#EF4444]'
                        : isDirect
                        ? 'border-[#A020F0]/60 hover:border-[#A020F0]'
                        : 'border-[#2A1A4A] hover:border-[#0284C7]'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A1A4A]/50 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-white text-sm">{ann.title}</span>
                        <span className="text-[10px] text-[#A020F0] font-bold">[{ann.announcementId}]</span>

                        {/* Distinct Scope Badges */}
                        {isDirect ? (
                          <span className="text-[10px] px-2 py-0.5 bg-[#A020F0]/20 text-[#D8B4FE] border border-[#A020F0] font-bold">
                            🎯 DIRECT: @{ann.targetCustomerUsername || ann.targetClientId}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 bg-[#0284C7]/20 text-[#38BDF8] border border-[#0284C7] font-bold">
                            🌐 MASS PLATFORM BROADCAST
                          </span>
                        )}

                        <span className={`text-[10px] px-2 py-0.5 border ${getStatusBadge(ann.status)}`}>
                          {ann.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs">
                        <span className={`text-[10px] px-2 py-0.5 border ${getSeverityBadge(ann.severity)}`}>
                          {ann.severity.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-[#A39BAD]">Priority: {ann.priority}</span>
                      </div>
                    </div>

                    <p className="text-xs text-[#F5F3FA] leading-relaxed whitespace-pre-wrap">{ann.message}</p>

                    {ann.recommendedAction && (
                      <div className="text-[11px] text-[#A020F0] bg-[#050508] p-2 border border-[#2A1A4A]">
                        <strong>Action Required:</strong> {ann.recommendedAction}
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] text-[#A39BAD]">
                      <div className="flex items-center gap-4">
                        <span>Dispatched: {new Date(ann.createdAt).toLocaleString()}</span>
                        <button
                          onClick={() => setSelectedAckAnnouncement(ann)}
                          className="flex items-center gap-1.5 text-[#A020F0] hover:text-[#7B2FFF] underline cursor-pointer"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>Acknowledgments: {ann.acknowledgments?.length || 0}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {ann.status === 'published' ? (
                          <button
                            onClick={() => handlePause(ann.announcementId)}
                            className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 text-[10px] font-bold flex items-center gap-1"
                          >
                            <Pause className="w-3 h-3" />
                            <span>Pause</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handlePublish(ann.announcementId)}
                            className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 text-[10px] font-bold flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" />
                            <span>Publish</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(ann.announcementId)}
                          className="p-1 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500"
                          title="Delete Announcement"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ACKNOWLEDGMENTS TELEMETRY MODAL                          */}
      {/* ======================================================== */}
      {selectedAckAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#100D17] border-2 border-[#2A1A4A] w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2A1A4A] pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#A020F0]" />
                <span className="font-bold text-white text-sm uppercase">
                  Client Acknowledgment Log [{selectedAckAnnouncement.announcementId}]
                </span>
              </div>
              <button
                onClick={() => setSelectedAckAnnouncement(null)}
                className="text-[#A39BAD] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-[#A39BAD]">
              Announcement: <span className="text-white font-bold">{selectedAckAnnouncement.title}</span>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {!selectedAckAnnouncement.acknowledgments ||
              selectedAckAnnouncement.acknowledgments.length === 0 ? (
                <div className="p-8 text-center text-[#A39BAD] text-xs">
                  No clients have acknowledged this notice yet.
                </div>
              ) : (
                selectedAckAnnouncement.acknowledgments.map((ack: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#050508] border border-[#2A1A4A] flex items-center justify-between text-xs font-mono"
                  >
                    <div>
                      <div className="text-white font-bold">
                        {ack.customerUsername ? `@${ack.customerUsername}` : `Client: ${ack.clientId}`}
                      </div>
                      <div className="text-[10px] text-[#A39BAD]">
                        Key Prefix: {ack.keyPrefix || 'arjun_live'}•••• | IP: {ack.clientIp || '127.0.0.1'}
                      </div>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-bold">
                      {new Date(ack.acknowledgedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedAckAnnouncement(null)}
                className="px-4 py-2 bg-[#2A1A4A] hover:bg-[#3D256B] text-white text-xs font-bold uppercase"
              >
                Close Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
