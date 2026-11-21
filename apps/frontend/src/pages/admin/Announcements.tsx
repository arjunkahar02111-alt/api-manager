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
} from 'lucide-react';

export const AdminAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAckAnnouncement, setSelectedAckAnnouncement] = useState<any | null>(null);

  // Form State
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiRequest(
        '/api/v1/admin/announcements',
        {
          method: 'POST',
          body: JSON.stringify(formData),
        },
        'admin'
      );

      if (res.success) {
        setModalOpen(false);
        resetForm();
        fetchAnnouncements();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
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

  const resetForm = () => {
    setFormData({
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

  const activeCount = announcements.filter((a) => a.status === 'published').length;
  const ackRequiredCount = announcements.filter((a) => a.acknowledgmentRequired).length;

  const handleEmergencyBroadcastPrompt = async () => {
    const title = prompt('Enter EMERGENCY Announcement Title (will broadcast to all routes immediately):');
    if (!title) return;
    const message = prompt('Enter emergency message details:');
    if (!message) return;

    const res = await apiRequest(
      '/api/v1/admin/announcements/emergency',
      {
        method: 'POST',
        body: JSON.stringify({ title, message }),
      },
      'admin'
    );

    if (res.success) {
      alert('Emergency announcement published live across all API gateway routes.');
      fetchAnnouncements();
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 font-mono select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2A1A4A] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#A020F0] rounded-none shadow-[0_0_8px_#A020F0]" />
            <h1 className="text-xl sm:text-2xl font-black text-[#F5F3FA] tracking-tight uppercase font-['Archivo_Black',sans-serif]">
              Dynamic API Announcements
            </h1>
          </div>
          <p className="text-xs text-[#A39BAD] mt-1">
            Real-time announcement injection into live client API responses with targeting and acknowledgment tracking
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleEmergencyBroadcastPrompt}
            className="px-3.5 py-2.5 bg-[#450A0A] hover:bg-[#EF4444] text-[#F87171] hover:text-white border border-[#EF4444] text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all"
            title="One-click critical broadcast to all live routes"
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Emergency Broadcast</span>
          </button>
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="px-4 py-2.5 bg-[#A020F0] hover:bg-[#7B2FFF] text-white text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_15px_rgba(160,32,240,0.3)] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Announcement</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#100D17] border border-[#2A1A4A] p-4">
          <div className="text-[11px] text-[#A39BAD] uppercase font-bold">Active in Gateway</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{activeCount}</div>
          <div className="text-[10px] text-[#A39BAD] mt-1">Injecting on live API responses</div>
        </div>
        <div className="bg-[#100D17] border border-[#2A1A4A] p-4">
          <div className="text-[11px] text-[#A39BAD] uppercase font-bold">Total Announcements</div>
          <div className="text-2xl font-black text-[#F5F3FA] mt-1">{announcements.length}</div>
          <div className="text-[10px] text-[#A39BAD] mt-1">Drafts, active & archived</div>
        </div>
        <div className="bg-[#100D17] border border-[#2A1A4A] p-4">
          <div className="text-[11px] text-[#A39BAD] uppercase font-bold">Ack Required</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{ackRequiredCount}</div>
          <div className="text-[10px] text-[#A39BAD] mt-1">Requiring client receipt</div>
        </div>
        <div className="bg-[#100D17] border border-[#2A1A4A] p-4">
          <div className="text-[11px] text-[#A39BAD] uppercase font-bold">Propagation Speed</div>
          <div className="text-2xl font-black text-[#A020F0] mt-1">&lt; 1 ms</div>
          <div className="text-[10px] text-[#A39BAD] mt-1">Redis PubSub synchronized</div>
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
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by Status"
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
            aria-label="Filter by Type"
            className="bg-[#050508] border border-[#2A1A4A] px-3 py-1.5 text-xs text-[#F5F3FA] focus:outline-none"
          >
            <option value="all">Type: All</option>
            <option value="maintenance">Maintenance</option>
            <option value="warning">Warning</option>
            <option value="update">Update</option>
            <option value="deprecation">Deprecation</option>
            <option value="security">Security</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      <div className="space-y-3">
        {loading ? (
          <div className="p-12 text-center text-[#A39BAD]">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#A020F0]" />
            <span>Loading active announcements...</span>
          </div>
        ) : announcements.length === 0 ? (
          <div className="bg-[#100D17] border border-[#2A1A4A] p-12 text-center text-[#A39BAD]">
            <Megaphone className="w-10 h-10 mx-auto mb-3 text-[#A020F0]/40" />
            <p className="font-bold text-[#F5F3FA]">No Announcements Found</p>
            <p className="text-xs mt-1">Create an announcement to broadcast notices directly inside client API responses.</p>
          </div>
        ) : (
          announcements.map((ann) => (
            <div
              key={ann.announcementId || ann._id}
              className="bg-[#100D17] border border-[#2A1A4A] p-5 space-y-3 transition-colors hover:border-[#A020F0]/50"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2A1A4A]/50 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">{ann.title}</span>
                  <span className="text-[10px] text-[#A020F0] font-bold">[{ann.announcementId}]</span>
                  <span className={`text-[10px] px-2 py-0.5 border ${getStatusBadge(ann.status)}`}>
                    {ann.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`text-[10px] px-2 py-0.5 border ${getSeverityBadge(ann.severity)}`}>
                    {ann.severity.toUpperCase()}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 bg-[#050508] border border-[#2A1A4A] text-[#A39BAD]">
                    Scope: {ann.targetScope}
                  </span>
                  <span className="text-[10px] text-[#A39BAD]">Priority: {ann.priority}</span>
                </div>
              </div>

              <p className="text-xs text-[#F5F3FA] leading-relaxed">{ann.message}</p>

              {ann.recommendedAction && (
                <div className="text-[11px] text-[#A020F0] bg-[#050508] p-2 border border-[#2A1A4A]">
                  <strong>Action Required:</strong> {ann.recommendedAction}
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-[11px] text-[#A39BAD]">
                <div className="flex items-center gap-4">
                  <span>Created: {new Date(ann.createdAt).toLocaleDateString()}</span>
                  <button
                    onClick={() => setSelectedAckAnnouncement(ann)}
                    className="flex items-center gap-1.5 text-[#A020F0] hover:text-[#7B2FFF] underline cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Acknowledgments: {ann.acknowledgments?.length || 0}</span>
                  </button>
                  {ann.acknowledgmentRequired && (
                    <span className="text-amber-400 font-bold">&bull; Receipt Required</span>
                  )}
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
          ))
        )}
      </div>

      {/* New Announcement Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#100D17] border-2 border-[#2A1A4A] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2A1A4A] pb-3">
              <span className="font-bold text-white text-sm uppercase">Create API Announcement</span>
              <button onClick={() => setModalOpen(false)} className="text-[#A39BAD] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase mb-1">
                  Title / Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scheduled Upstream Maintenance"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none focus:border-[#A020F0]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#A39BAD] uppercase mb-1">
                  Announcement Message
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Details of the announcement injected directly into API response..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none focus:border-[#A020F0]"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none"
                  >
                    <option value="general">General</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="warning">Warning</option>
                    <option value="update">Update</option>
                    <option value="deprecation">Deprecation</option>
                    <option value="security">Security</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">Severity</label>
                  <select
                    value={formData.severity}
                    onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none"
                  >
                    <option value="information">Information</option>
                    <option value="success">Success</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">Priority (1-100)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">Target Scope</label>
                  <select
                    value={formData.targetScope}
                    onChange={(e) => setFormData({ ...formData, targetScope: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none"
                  >
                    <option value="global">Global (All APIs & Clients)</option>
                    <option value="api">Specific API ID / Slug</option>
                    <option value="endpoint">Specific Endpoint Path</option>
                    <option value="client">Specific Client / Customer</option>
                    <option value="apiKey">Specific API Key Prefix</option>
                    <option value="version">Specific Version</option>
                  </select>
                </div>

                {formData.targetScope !== 'global' && (
                  <div>
                    <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">
                      Target Identifier Value
                    </label>
                    <input
                      type="text"
                      placeholder={
                        formData.targetScope === 'endpoint'
                          ? '/v1/vehicle2-n'
                          : formData.targetScope === 'version'
                          ? 'v1'
                          : 'Target ID / Slug'
                      }
                      value={
                        formData.targetScope === 'api'
                          ? formData.targetApiId
                          : formData.targetScope === 'endpoint'
                          ? formData.targetEndpoint
                          : formData.targetScope === 'client'
                          ? formData.targetClientId
                          : formData.targetApiKey
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (formData.targetScope === 'api') setFormData({ ...formData, targetApiId: val });
                        else if (formData.targetScope === 'endpoint') setFormData({ ...formData, targetEndpoint: val });
                        else if (formData.targetScope === 'client') setFormData({ ...formData, targetClientId: val });
                        else if (formData.targetScope === 'apiKey') setFormData({ ...formData, targetApiKey: val });
                        else if (formData.targetScope === 'version') setFormData({ ...formData, targetVersion: val });
                      }}
                      className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">Action URL (Optional)</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={formData.actionUrl}
                    onChange={(e) => setFormData({ ...formData, actionUrl: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#A39BAD] uppercase mb-1">Recommended Action</label>
                  <input
                    type="text"
                    placeholder="e.g. Please update your client timeout to 30s"
                    value={formData.recommendedAction}
                    onChange={(e) => setFormData({ ...formData, recommendedAction: e.target.value })}
                    className="w-full bg-[#050508] border border-[#2A1A4A] p-2 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="ackReq"
                  checked={formData.acknowledgmentRequired}
                  onChange={(e) => setFormData({ ...formData, acknowledgmentRequired: e.target.checked })}
                  className="accent-[#A020F0] w-4 h-4 cursor-pointer"
                />
                <label htmlFor="ackReq" className="text-xs text-[#F5F3FA] cursor-pointer">
                  Require Client Acknowledgment via <code className="text-[#A020F0]">POST /api/v1/announcements/:id/acknowledge</code>
                </label>
              </div>

              <div className="pt-4 border-t border-[#2A1A4A] flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-[#2A1A4A] text-[#A39BAD] hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#A020F0] hover:bg-[#7B2FFF] text-white font-bold"
                >
                  {submitting ? 'Creating...' : 'Create & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Acknowledgments Tracking Modal */}
      {selectedAckAnnouncement && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#100D17] border-2 border-[#2A1A4A] w-full max-w-xl max-h-[80vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2A1A4A] pb-3">
              <div>
                <span className="font-bold text-white text-sm uppercase">Acknowledgment Audit</span>
                <p className="text-[11px] text-[#A39BAD]">{selectedAckAnnouncement.title} ({selectedAckAnnouncement.announcementId})</p>
              </div>
              <button onClick={() => setSelectedAckAnnouncement(null)} className="text-[#A39BAD] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {(!selectedAckAnnouncement.acknowledgments || selectedAckAnnouncement.acknowledgments.length === 0) ? (
                <div className="p-8 text-center text-[#A39BAD] text-xs">
                  No clients have acknowledged this announcement yet.
                </div>
              ) : (
                selectedAckAnnouncement.acknowledgments.map((ack: any, idx: number) => (
                  <div key={idx} className="bg-[#050508] border border-[#2A1A4A] p-3 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-[#F5F3FA]">{ack.customerUsername || 'Client'}</div>
                      <div className="text-[10px] text-[#A39BAD]">Client ID: {ack.clientId} &bull; Key: {ack.keyPrefix}...</div>
                    </div>
                    <div className="text-right text-[10px] text-[#A39BAD]">
                      <div className="text-emerald-400 font-bold">Acknowledged</div>
                      <div>{new Date(ack.acknowledgedAt).toLocaleString()}</div>
                      <div>IP: {ack.clientIp || 'unknown'}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
