import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import {
  Key,
  Plus,
  Search,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Share2,
  Clock,
  RotateCcw,
  Loader2,
  CheckCircle,
  Settings,
  Shield,
  Lock,
} from 'lucide-react';

const getPublicGatewayBaseUrl = () => {
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'https:' || (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')) {
      return window.location.origin;
    }
  }
  return 'https://api.karviontechnologies.in';
};

const formatGatewayPath = (path: string) => {
  const clean = path.startsWith('/') ? path : `/${path}`;
  return clean.startsWith('/v1/') || clean === '/v1' ? clean : `/v1${clean}`;
};

export const AdminCustomers: React.FC = () => {
  const [customers, setCustomers] = useState<any[]>([]);
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [createdKeyPacket, setCreatedKeyPacket] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedDirectUrl, setCopiedDirectUrl] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  // Form inputs for generating client key (100% Customizable!)
  const [formData, setFormData] = useState({
    username: '',
    targetApiId: '*',
    developerTag: 'arjunkahar',
    validityDays: 30,
    dailyRequestLimit: 5000,
    monthlyRequestLimit: 50000,
    lifetimeRequestLimit: 500000,
    price: 0,
    currency: 'USD',
    notes: '',
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    customerId: '',
    fullName: '',
    developerTag: 'arjunkahar',
    dailyRequestLimit: 5000,
    monthlyRequestLimit: 50000,
    lifetimeRequestLimit: 500000,
    price: 0,
    currency: 'USD',
    additionalDays: 0,
    notes: '',
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
    fetchApis();
  }, [search, statusFilter]);

  const fetchCustomers = async () => {
    setLoading(true);
    let url = `/api/v1/admin/customers?page=1&limit=50`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (statusFilter) url += `&status=${statusFilter}`;

    const res = await apiRequest(url, {}, 'admin');
    if (res.success) setCustomers(res.data || []);
    setLoading(false);
  };

  const fetchApis = async () => {
    const res = await apiRequest('/api/v1/admin/apis', {}, 'admin');
    if (res.success) setApis(res.data || []);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionLoading(true);

    try {
      const cleanUsername = formData.username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      if (!cleanUsername) {
        setFormError('Please enter a client name or identifier');
        setActionLoading(false);
        return;
      }

      const selectedApi = apis.find((a) => a._id === formData.targetApiId);
      const apiName = selectedApi ? selectedApi.name : 'Vehicle Intelligence (vehicle2-n)';
      const gatewayPath = selectedApi ? formatGatewayPath(selectedApi.gatewayPath) : '/v1/vehicle2-n';
      const fullGatewayUrl = `${getPublicGatewayBaseUrl()}${gatewayPath}`;

      const res = await apiRequest(
        '/api/v1/admin/customers',
        {
          method: 'POST',
          body: JSON.stringify({
            username: cleanUsername,
            fullName: formData.username.trim(),
            validityDays: Number(formData.validityDays) || 30,
            dailyRequestLimit: Number(formData.dailyRequestLimit) || 0,
            monthlyRequestLimit: Number(formData.monthlyRequestLimit) || 0,
            lifetimeRequestLimit: Number(formData.lifetimeRequestLimit) || 0,
            price: Number(formData.price) || 0,
            currency: formData.currency || 'USD',
            developerTag: formData.developerTag.trim() || 'arjunkahar',
            notes: formData.notes.trim() || undefined,
            allowedApis: formData.targetApiId === '*' ? ['*'] : [formData.targetApiId],
          }),
        },
        'admin'
      );

      if (!res.success) {
        setFormError(res.error?.message || 'Failed to generate key');
        setActionLoading(false);
        return;
      }

      const rawKey = res.data.apiKey.rawKey;
      const expiryDate = new Date(Date.now() + Number(formData.validityDays) * 24 * 3600 * 1000).toDateString();
      const quotaDisplay = Number(formData.dailyRequestLimit) > 0 ? `${Number(formData.dailyRequestLimit).toLocaleString()} requests/day` : 'Unlimited requests';
      const priceDisplay = Number(formData.price) > 0 ? `${formData.currency} ${formData.price}` : 'Free / Custom';

      const shareText = [
        `🔑 API Access Credentials:`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `Client:       ${formData.username.trim()}`,
        `Service:      ${apiName}`,
        `Gateway URL:  ${fullGatewayUrl}`,
        `API Key:      ${rawKey}`,
        `Daily Quota:  ${quotaDisplay}`,
        `Price / Fee:  ${priceDisplay}`,
        `Valid Until:  ${expiryDate}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👉 Direct URL (Key in URL):`,
        `${fullGatewayUrl}?key=${rawKey}&query=YOUR_SEARCH`,
        ``,
        `👉 cURL Example:`,
        `curl "${fullGatewayUrl}?key=${rawKey}&query=YOUR_SEARCH"`,
        ``,
        `👉 Header Alternative:`,
        `curl -H "X-API-Key: ${rawKey}" "${fullGatewayUrl}?query=YOUR_SEARCH"`,
      ].join('\n');

      setShowCreateModal(false);
      setCreatedKeyPacket({
        rawKey,
        keyPrefix: res.data.apiKey.keyPrefix,
        username: res.data.customer.username,
        gatewayUrl: fullGatewayUrl,
        apiName,
        priceDisplay,
        quotaDisplay,
        expiryDate,
        shareText,
      });

      // Reset form
      setFormData({
        username: '',
        targetApiId: '*',
        developerTag: 'arjunkahar',
        validityDays: 30,
        dailyRequestLimit: 1000,
        monthlyRequestLimit: 30000,
        lifetimeRequestLimit: 100000,
        price: 0,
        currency: 'USD',
        notes: '',
      });

      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Key creation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetBoundIp = async (customerId: string, username: string) => {
    if (!window.confirm(`Reset Single-IP lock for '${username}'? Next request will auto-bind to the user's IP.`)) return;
    const res = await apiRequest(`/api/v1/admin/security/customers/${customerId}/reset-bound-ip`, { method: 'POST', body: JSON.stringify({}) }, 'admin');
    if (res.success) {
      alert(`IP lock reset for ${username}. Key is now unlocked for next valid client request.`);
      fetchCustomers();
    } else {
      alert(res.error?.message || 'Failed to reset IP lock');
    }
  };

  const openEditModal = (c: any) => {
    setEditFormData({
      customerId: c._id,
      fullName: c.fullName || c.username,
      developerTag: c.developerTag || 'arjunkahar',
      dailyRequestLimit: c.dailyRequestLimit ?? 5000,
      monthlyRequestLimit: c.monthlyRequestLimit ?? 50000,
      lifetimeRequestLimit: c.lifetimeRequestLimit ?? 500000,
      price: c.price ?? 0,
      currency: c.currency || 'USD',
      additionalDays: 0,
      notes: c.notes || '',
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setActionLoading(true);

    try {
      const res = await apiRequest(
        `/api/v1/admin/customers/${editFormData.customerId}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            fullName: editFormData.fullName,
            developerTag: editFormData.developerTag.trim() || 'arjunkahar',
            dailyRequestLimit: Number(editFormData.dailyRequestLimit),
            monthlyRequestLimit: Number(editFormData.monthlyRequestLimit),
            lifetimeRequestLimit: Number(editFormData.lifetimeRequestLimit),
            price: Number(editFormData.price),
            currency: editFormData.currency,
            notes: editFormData.notes,
          }),
        },
        'admin'
      );

      if (!res.success) {
        setFormError(res.error?.message || 'Failed to update key settings');
        setActionLoading(false);
        return;
      }

      if (editFormData.additionalDays > 0) {
        await apiRequest(
          `/api/v1/admin/customers/${editFormData.customerId}/renew`,
          {
            method: 'POST',
            body: JSON.stringify({ additionalDays: Number(editFormData.additionalDays) }),
          },
          'admin'
        );
      }

      setShowEditModal(false);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err.message || 'Failed to update customer');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetUsage = async (id: string, scope: 'daily' | 'monthly') => {
    if (!confirm(`Reset ${scope} usage counter to zero for this client?`)) return;
    await apiRequest(`/api/v1/admin/customers/${id}/reset-usage`, {
      method: 'POST',
      body: JSON.stringify({ scope }),
    }, 'admin');
    fetchCustomers();
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'suspend' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this client key?`)) return;
    await apiRequest(`/api/v1/admin/customers/${id}/${action}`, { method: 'POST' }, 'admin');
    fetchCustomers();
  };

  const handleRegenerateKey = async (id: string) => {
    if (!confirm('Regenerating will IMMEDIATELY revoke the old key. Continue?')) return;
    const res = await apiRequest(`/api/v1/admin/customers/${id}/regenerate-key`, { method: 'POST' }, 'admin');
    if (res.success && res.data.rawKey) {
      alert(`New API Key generated successfully:\n\n${res.data.rawKey}\n\nMake sure to copy and send it to your user.`);
    }
    fetchCustomers();
  };

  const handleDeleteCustomer = async (id: string, username: string) => {
    if (!confirm(`Permanently remove client '${username}' and revoke their access?`)) return;
    await apiRequest(`/api/v1/admin/customers/${id}`, { method: 'DELETE' }, 'admin');
    fetchCustomers();
  };

  const copyText = (text: string, type: 'key' | 'url' | 'directUrl' | 'message') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === 'directUrl') {
      setCopiedDirectUrl(true);
      setTimeout(() => setCopiedDirectUrl(false), 2000);
    } else {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2000);
    }
  };

  return (
    <div className="p-8 lg:p-10 space-y-10 selection:bg-[#EF4444] selection:text-white">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#262626] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-[#EF4444]" />
            <span className="text-[11px] font-bold text-[#EF4444] uppercase tracking-[0.15em] font-mono">
              QUOTA ENFORCEMENT // ACCESS KEYS
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight uppercase leading-none">
            CLIENT KEYS
          </h1>
          <p className="text-xs text-[#A3A3A3] font-mono uppercase mt-2">
            ISSUE KEYS WITH CUSTOM VALIDITY DAYS, CUSTOM LIMITS & READY-TO-SEND ACCESS PACKETS
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setFormError(null);
          }}
          className="self-start sm:self-auto bg-white text-black border-2 border-white hover:bg-[#EF4444] hover:border-[#EF4444] hover:text-white font-mono font-bold px-5 py-2.5 text-xs uppercase tracking-widest transition-colors flex items-center gap-2 rounded-none"
        >
          <Plus className="w-4 h-4" />
          <span>[ + GENERATE NEW CLIENT KEY ]</span>
        </button>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#121212] p-4 border-2 border-[#262626] rounded-none">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-[#737373] absolute left-3.5 top-3.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="SEARCH BY CLIENT NAME OR PREFIX..."
            className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none pl-10 pr-4 py-2.5 text-xs text-white placeholder-[#525252] rounded-none font-mono"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto font-mono">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none px-4 py-2.5 text-xs text-white uppercase rounded-none"
          >
            <option value="">ALL STATUSES</option>
            <option value="active">ACTIVE</option>
            <option value="suspended">PAUSED</option>
            <option value="expired">EXPIRED</option>
          </select>
        </div>
      </div>

      {/* CLIENT KEYS TABLE */}
      <div className="bg-[#121212] border-2 border-[#262626] rounded-none overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-[#262626] flex items-center justify-between bg-[#0A0A0A]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white font-mono">
            Issued Client Access Keys
          </h3>
          <span className="text-xs text-[#A3A3A3] font-mono font-bold">
            [{customers.length} KEYS CONFIGURED]
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0A0A0A] text-[#A3A3A3] border-b-2 border-[#262626] uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold">Client Name</th>
                <th className="px-6 py-4 font-bold">Key Prefix</th>
                <th className="px-6 py-4 font-bold">Custom Limits</th>
                <th className="px-6 py-4 font-bold">Price / Fee</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold">Expires On</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#A3A3A3] font-mono uppercase tracking-widest">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-white" />
                    Loading client keys...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[#737373] uppercase tracking-wider font-mono">
                    No client keys created yet. Click "+ GENERATE NEW CLIENT KEY" to issue your first customizable key!
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isSuspended = c.status === 'suspended';
                  const isExpired = c.status === 'expired' || new Date(c.expiresAt).getTime() < Date.now();

                  return (
                    <tr key={c._id} className="hover:bg-[#181818] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm uppercase">{c.fullName || c.username}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] text-[#A3A3A3]">@{c.username}</span>
                          <span className="text-[9px] bg-[#1A1A1A] text-[#EF4444] px-1 py-0.2 border border-[#333333] font-mono">
                            dev:{c.developerTag || 'arjunkahar'}
                          </span>
                        </div>
                        {c.notes && (
                          <div className="text-[10px] text-[#EF4444] mt-0.5 uppercase tracking-wide">
                            NOTE: {c.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <code className="text-xs bg-[#0A0A0A] text-white px-2.5 py-1 border border-[#333333] font-bold">
                          {c.keyPrefix || 'arjun_live_'}••••
                        </code>
                        <div className="mt-1">
                          {c.boundIp ? (
                            <span className="text-[10px] text-[#10B981] font-bold border border-[#10B981]/50 bg-[#10B981]/10 px-1.5 py-0.5 inline-flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              IP: {c.boundIp}
                            </span>
                          ) : (
                            <span className="text-[10px] text-[#F59E0B] border border-[#F59E0B]/50 bg-[#F59E0B]/10 px-1.5 py-0.5">
                              🔓 AUTO-BIND IP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-white font-bold">
                          {c.dailyRequestLimit > 0 ? `${c.dailyRequestLimit.toLocaleString()} REQ/DAY` : 'UNLIMITED'}
                        </div>
                        <div className="text-[10px] text-[#737373] mt-0.5 uppercase">
                          MONTH: {c.monthlyRequestLimit > 0 ? c.monthlyRequestLimit.toLocaleString() : '∞'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-white text-xs">
                          {c.price > 0 ? `${c.currency || 'USD'} ${c.price}` : 'FREE'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={isExpired ? 'danger' : isSuspended ? 'warning' : 'success'}>
                          {isExpired ? 'expired' : c.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-[#A3A3A3]">
                        {new Date(c.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditModal(c)}
                            title="Edit Limits & Extend"
                            className="p-1.5 border border-[#333333] hover:border-white text-white transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleResetBoundIp(c._id, c.username)}
                            title="Reset / Unlock Single-IP Lock"
                            className="p-1.5 border border-[#333333] hover:border-[#10B981] hover:text-[#10B981] text-white transition-colors"
                          >
                            <Shield className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleResetUsage(c._id, 'daily')}
                            title="Reset Daily Quota"
                            className="p-1.5 border border-[#333333] hover:border-white text-white transition-colors"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(c._id, c.status)}
                            title={c.status === 'active' ? 'Pause Key' : 'Activate Key'}
                            className="p-1.5 border border-[#333333] hover:border-white text-white transition-colors"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleRegenerateKey(c._id)}
                            title="Regenerate Key"
                            className="p-1.5 border border-[#333333] hover:border-white text-white transition-colors"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(c._id, c.username)}
                            title="Delete Client"
                            className="p-1.5 border border-[#333333] hover:border-[#EF4444] text-[#A3A3A3] hover:text-[#EF4444] transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FULLY CUSTOMIZABLE GENERATE KEY MODAL */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Generate Customized Client Key"
      >
        <form onSubmit={handleGenerateKey} className="space-y-5 font-mono">
          {formError && (
            <div className="p-3 bg-[#260A0A] border-2 border-[#EF4444] text-xs text-[#EF4444] font-bold">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                Client / User Name <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="e.g. Aman, VIP User 1, Client X"
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                Target API Service
              </label>
              <select
                value={formData.targetApiId}
                onChange={(e) => setFormData({ ...formData, targetApiId: e.target.value })}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none uppercase"
              >
                <option value="*">ALL CONNECTED APIS (UNIVERSAL)</option>
                {apis.map((api) => (
                  <option key={api._id} value={api._id}>
                    {api.name} (/v1{api.gatewayPath})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* CUSTOM VALIDITY & PRICE */}
          <div className="grid grid-cols-3 gap-3 bg-[#0A0A0A] p-4 border-2 border-[#262626]">
            <div>
              <label className="block text-[10px] font-bold text-[#EF4444] uppercase tracking-wider mb-1">
                Validity (Days)
              </label>
              <input
                type="number"
                min="1"
                max="36500"
                required
                value={formData.validityDays}
                onChange={(e) => setFormData({ ...formData, validityDays: Number(e.target.value) })}
                className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
              <span className="text-[9px] text-[#737373] mt-1 block">e.g. 7, 30, 90, 365</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                Custom Price
              </label>
              <input
                type="number"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
              <span className="text-[9px] text-[#737373] mt-1 block">Amount charged</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
          </div>

          {/* CUSTOM REQUEST QUOTAS */}
          <div className="grid grid-cols-3 gap-3 bg-[#0A0A0A] p-4 border-2 border-[#262626]">
            <div>
              <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                Daily Limit
              </label>
              <input
                type="number"
                min="0"
                value={formData.dailyRequestLimit}
                onChange={(e) => setFormData({ ...formData, dailyRequestLimit: Number(e.target.value) })}
                className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
              <span className="text-[9px] text-[#737373] mt-1 block">0 = Unlimited</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                Monthly Limit
              </label>
              <input
                type="number"
                min="0"
                value={formData.monthlyRequestLimit}
                onChange={(e) => setFormData({ ...formData, monthlyRequestLimit: Number(e.target.value) })}
                className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
              <span className="text-[9px] text-[#737373] mt-1 block">0 = Unlimited</span>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                Lifetime Limit
              </label>
              <input
                type="number"
                min="0"
                value={formData.lifetimeRequestLimit}
                onChange={(e) => setFormData({ ...formData, lifetimeRequestLimit: Number(e.target.value) })}
                className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
              <span className="text-[9px] text-[#737373] mt-1 block">0 = Unlimited</span>
            </div>
          </div>

          {/* BRANDING / DEVELOPER TAG */}
          <div className="bg-[#0A0A0A] p-3 border-2 border-[#262626]">
            <label className="block text-[10px] font-bold text-[#EF4444] uppercase tracking-wider mb-1">
              Developer Brand Tag (Injected in Responses)
            </label>
            <input
              type="text"
              required
              value={formData.developerTag}
              onChange={(e) => setFormData({ ...formData, developerTag: e.target.value })}
              placeholder="e.g. arjunkahar"
              className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
            />
            <span className="text-[9px] text-[#737373] mt-1 block">
              Replaces upstream developer credit with "{formData.developerTag || 'arjunkahar'}" in all client API responses.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
              Admin Notes / Sale Info
            </label>
            <input
              type="text"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="e.g. Paid via UPI, Telegram @aman, VIP subscriber"
              className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#262626]">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="px-4 py-2 border-2 border-transparent hover:border-[#333333] text-xs font-bold uppercase tracking-wider text-[#A3A3A3] hover:text-white rounded-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-3 bg-white text-black hover:bg-[#EF4444] hover:text-white border-2 border-white hover:border-[#EF4444] text-xs font-bold uppercase tracking-widest rounded-none transition-colors flex items-center gap-2 disabled:opacity-40"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
              <span>Generate Customized Key</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* EDIT & CUSTOMIZE MODAL */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Customize Client Key & Limits"
      >
        <form onSubmit={handleUpdateCustomer} className="space-y-5 font-mono">
          {formError && (
            <div className="p-3 bg-[#260A0A] border-2 border-[#EF4444] text-xs text-[#EF4444] font-bold">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
              Client Full Name
            </label>
            <input
              type="text"
              required
              value={editFormData.fullName}
              onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
              className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-[#EF4444] uppercase tracking-wider mb-1">
                Extend Validity (+Days)
              </label>
              <input
                type="number"
                min="0"
                value={editFormData.additionalDays}
                onChange={(e) => setEditFormData({ ...editFormData, additionalDays: Number(e.target.value) })}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
              <span className="text-[9px] text-[#737373] mt-1 block">e.g. 30 to add 30 more days</span>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
                Price Charged
              </label>
              <input
                type="number"
                min="0"
                value={editFormData.price}
                onChange={(e) => setEditFormData({ ...editFormData, price: Number(e.target.value) })}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                Daily Limit
              </label>
              <input
                type="number"
                min="0"
                value={editFormData.dailyRequestLimit}
                onChange={(e) => setEditFormData({ ...editFormData, dailyRequestLimit: Number(e.target.value) })}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                Monthly Limit
              </label>
              <input
                type="number"
                min="0"
                value={editFormData.monthlyRequestLimit}
                onChange={(e) => setEditFormData({ ...editFormData, monthlyRequestLimit: Number(e.target.value) })}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white uppercase tracking-wider mb-1">
                Lifetime Limit
              </label>
              <input
                type="number"
                min="0"
                value={editFormData.lifetimeRequestLimit}
                onChange={(e) => setEditFormData({ ...editFormData, lifetimeRequestLimit: Number(e.target.value) })}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
              />
            </div>
          </div>

          <div className="bg-[#0A0A0A] p-3 border-2 border-[#262626]">
            <label className="block text-[10px] font-bold text-[#EF4444] uppercase tracking-wider mb-1">
              Developer Brand Tag (Injected in Responses)
            </label>
            <input
              type="text"
              required
              value={editFormData.developerTag}
              onChange={(e) => setEditFormData({ ...editFormData, developerTag: e.target.value })}
              placeholder="e.g. arjunkahar"
              className="w-full bg-[#121212] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
            />
            <span className="text-[9px] text-[#737373] mt-1 block">
              Injected as "developer": "{editFormData.developerTag || 'arjunkahar'}" in this client's API responses.
            </span>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1">
              Admin Notes
            </label>
            <input
              type="text"
              value={editFormData.notes}
              onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
              className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#262626]">
            <button
              type="button"
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 border-2 border-transparent hover:border-[#333333] text-xs font-bold uppercase tracking-wider text-[#A3A3A3] hover:text-white rounded-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionLoading}
              className="px-6 py-2.5 bg-white text-black hover:bg-[#EF4444] hover:text-white border-2 border-white hover:border-[#EF4444] text-xs font-bold uppercase tracking-widest rounded-none transition-colors"
            >
              Save Custom Settings
            </button>
          </div>
        </form>
      </Modal>

      {/* CLIENT ACCESS PACKET MODAL (ONE-CLICK READY-TO-SEND TO USER) */}
      <Modal
        isOpen={!!createdKeyPacket}
        onClose={() => setCreatedKeyPacket(null)}
        title="Client Access Package Ready"
      >
        {createdKeyPacket && (
          <div className="space-y-6 font-mono">
            <div className="p-4 bg-[#052E16] border-2 border-[#16A34A] flex items-center gap-3 text-xs text-[#22C55E] uppercase font-bold tracking-wider">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>
                Key generated! Copy and send these credentials directly to <strong>{createdKeyPacket.username}</strong>.
              </span>
            </div>

            {/* DIRECT URL (KEY IN URL) - HIGHLIGHTED */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-[#EF4444] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-[#EF4444]" />
                  Direct Request URL (Key In URL)
                </label>
                <span className="text-[10px] text-[#A3A3A3] uppercase">BROWSER / CURL READY</span>
              </div>
              <div className="flex items-center gap-2 bg-[#0A0A0A] p-3 border-2 border-white">
                <code className="text-xs text-white truncate flex-1 select-all font-bold">
                  {`${createdKeyPacket.gatewayUrl}?key=${createdKeyPacket.rawKey}&query=YOUR_SEARCH`}
                </code>
                <button
                  onClick={() =>
                    copyText(
                      `${createdKeyPacket.gatewayUrl}?key=${createdKeyPacket.rawKey}&query=YOUR_SEARCH`,
                      'directUrl'
                    )
                  }
                  className="px-4 py-2 bg-[#EF4444] text-white hover:bg-[#DC2626] font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors shrink-0 rounded-none border border-[#EF4444]"
                >
                  {copiedDirectUrl ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedDirectUrl ? 'COPIED' : 'COPY DIRECT URL'}
                </button>
              </div>
            </div>

            {/* RAW KEY BOX */}
            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-2">
                Client API Key
              </label>
              <div className="flex items-center gap-2 bg-[#0A0A0A] p-3 border-2 border-[#333333]">
                <code className="text-xs text-white truncate flex-1 select-all font-bold">
                  {createdKeyPacket.rawKey}
                </code>
                <button
                  onClick={() => copyText(createdKeyPacket.rawKey, 'key')}
                  className="px-3 py-1.5 bg-white text-black hover:bg-white/80 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 transition-colors shrink-0 rounded-none"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey ? 'COPIED' : 'COPY KEY'}
                </button>
              </div>
            </div>

            {/* GATEWAY URL BOX */}
            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-2">
                Gateway Base Endpoint
              </label>
              <div className="flex items-center gap-2 bg-[#0A0A0A] p-3 border-2 border-[#333333]">
                <code className="text-xs text-[#A3A3A3] truncate flex-1 select-all">
                  {createdKeyPacket.gatewayUrl}
                </code>
                <button
                  onClick={() => copyText(createdKeyPacket.gatewayUrl, 'url')}
                  className="px-3 py-1.5 bg-[#1A1A1A] text-white hover:bg-[#262626] border border-[#333333] text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors shrink-0 rounded-none"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedUrl ? 'COPIED' : 'COPY URL'}
                </button>
              </div>
            </div>

            {/* FULL SHARE MESSAGE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Complete Message for User
                </label>
                <span className="text-[10px] text-[#A3A3A3] uppercase">READY FOR WHATSAPP / TELEGRAM</span>
              </div>
              <textarea
                readOnly
                rows={8}
                value={createdKeyPacket.shareText}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] p-4 text-xs font-mono text-white focus:outline-none select-all rounded-none"
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t-2 border-[#262626]">
              <button
                type="button"
                onClick={() => setCreatedKeyPacket(null)}
                className="text-xs font-bold uppercase tracking-wider text-[#A3A3A3] hover:text-white"
              >
                Close Window
              </button>
              <button
                type="button"
                onClick={() => copyText(createdKeyPacket.shareText, 'message')}
                className="py-3 px-6 bg-white text-black hover:bg-[#EF4444] hover:text-white border-2 border-white hover:border-[#EF4444] text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-colors rounded-none"
              >
                {copiedMessage ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copiedMessage ? 'FULL MESSAGE COPIED!' : '📋 COPY FULL MESSAGE FOR USER'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
