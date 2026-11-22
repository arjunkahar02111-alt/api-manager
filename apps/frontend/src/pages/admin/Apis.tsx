import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { UniversalApiImporterModal } from '../../components/UniversalApiImporterModal';
import { ClientPackageModal } from '../../components/ClientPackageModal';
import {
  Zap,
  Copy,
  Check,
  Plus,
  Activity,
  Power,
  PowerOff,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Key,
  Sparkles,
  Package,
  RotateCw,
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

export const AdminApis: React.FC = () => {
  const [apis, setApis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImporterModal, setShowImporterModal] = useState(false);
  const [selectedPackageApiId, setSelectedPackageApiId] = useState<string | null>(null);
  const [purgingId, setPurgingId] = useState<string | null>(null);
  const [purgeNotification, setPurgeNotification] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Quick Auto-Connect State
  const [quickUrl, setQuickUrl] = useState('');
  const [quickName, setQuickName] = useState('');
  const [quickCategory, setQuickCategory] = useState('Main APIs');
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickSuccess, setQuickSuccess] = useState<any | null>(null);
  const [quickError, setQuickError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const navigate = useNavigate();

  // Advanced Manual Modal State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    category: 'General',
    version: 'v1',
    gatewayPath: '/my-service',
    upstreamBaseUrl: 'https://httpbin.org',
    upstreamPath: '/get',
    allowedMethods: ['GET'],
    timeoutMs: 30000,
    maxRequestBytes: 10485760,
    maxResponseBytes: 10485760,
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchApis();
  }, []);

  const fetchApis = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/apis', {}, 'admin');
    if (res.success) setApis(res.data || []);
    setLoading(false);
  };

  const handleQuickAutoConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;

    setQuickLoading(true);
    setQuickError(null);
    setQuickSuccess(null);

    try {
      const res = await apiRequest('/api/v1/admin/apis/auto-connect', {
        method: 'POST',
        body: JSON.stringify({
          targetUrl: quickUrl.trim(),
          name: quickName.trim() || undefined,
          category: quickCategory || 'Main APIs',
        }),
      }, 'admin');

      if (!res.success) {
        setQuickError(res.error?.message || 'Failed to auto-connect API');
        setQuickLoading(false);
        return;
      }

      setQuickSuccess(res.data);
      setQuickUrl('');
      setQuickName('');
      fetchApis();
    } catch (err: any) {
      setQuickError(err.message || 'Auto-connect failed');
    } finally {
      setQuickLoading(false);
    }
  };

  const handleCreateApiManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const res = await apiRequest('/api/v1/admin/apis', {
      method: 'POST',
      body: JSON.stringify(formData),
    }, 'admin');

    if (!res.success) {
      setFormError(res.error?.message || 'Failed to create API');
      return;
    }

    setShowAddModal(false);
    fetchApis();
  };

  const handleTestConnectivity = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    const res = await apiRequest(`/api/v1/admin/apis/${id}/test`, { method: 'POST' }, 'admin');
    setTestingId(null);
    setTestResult(res.data || { success: false, error: res.error?.message });
    fetchApis();
  };

  const handleToggle = async (id: string, currentStatus: string) => {
    const action = currentStatus === 'active' ? 'disable' : 'enable';
    await apiRequest(`/api/v1/admin/apis/${id}/${action}`, { method: 'POST' }, 'admin');
    fetchApis();
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete API endpoint '${name}' from catalog?`)) return;
    await apiRequest(`/api/v1/admin/apis/${id}`, { method: 'DELETE' }, 'admin');
    fetchApis();
  };

  const handlePurgeCache = async (id: string, name: string) => {
    setPurgingId(id);
    const res = await apiRequest(`/api/v1/admin/apis/${id}/cache/purge`, { method: 'POST' }, 'admin');
    setPurgingId(null);
    if (res.success) {
      setPurgeNotification(`Cache purged for '${name}' (${res.data?.purgedCount || 0} entries removed)`);
      setTimeout(() => setPurgeNotification(null), 3000);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(id);
    setTimeout(() => setCopiedUrl(null), 2500);
  };

  return (
    <div className="p-8 lg:p-10 space-y-10 selection:bg-[#EF4444] selection:text-white">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#262626] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-[#EF4444]" />
            <span className="text-[11px] font-bold text-[#EF4444] uppercase tracking-[0.15em] font-mono">
              DYNAMIC PROXY // ROUTING ENGINE
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight uppercase leading-none">
            MAIN APIS
          </h1>
          <p className="text-xs text-[#A3A3A3] font-mono uppercase mt-2">
            INGEST UPSTREAM APIS, SECURE SECRETS & DEPLOY PROTECTED PROXIES
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowImporterModal(true)}
            className="px-4 py-2 bg-[#EF4444] border-2 border-[#EF4444] hover:bg-[#DC2626] text-white text-xs font-bold uppercase tracking-widest transition-colors font-mono flex items-center gap-2 rounded-none"
          >
            <Sparkles className="w-3.5 h-3.5" />
            [ ⚡ AUTOMATED IMPORTER & MAPPER ]
          </button>
          <button
            onClick={() => {
              setShowAddModal(true);
              setFormError(null);
            }}
            className="px-4 py-2 bg-[#121212] border-2 border-white hover:bg-white hover:text-black text-white text-xs font-bold uppercase tracking-widest transition-colors font-mono flex items-center gap-2 rounded-none"
          >
            <Plus className="w-3.5 h-3.5" />
            [ MANUAL CONFIG ]
          </button>
        </div>
      </div>

      {/* 1-CLICK INSTANT AUTO-CONNECTOR (VOICEBOX ELEVATED CARD) */}
      <div className="bg-[#121212] border-t-4 border-t-[#EF4444] border-x-2 border-b-2 border-white p-6 lg:p-8 rounded-none shadow-none">
        <div className="border-b-2 border-[#262626] pb-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-[#EF4444]" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">
              1-Click Instant API Connector
            </h2>
          </div>
          <span className="text-[10px] font-bold text-[#EF4444] border border-[#EF4444] px-2 py-0.5 uppercase font-mono tracking-widest">
            ZERO CONFIG
          </span>
        </div>

        <p className="text-xs text-[#A3A3A3] mb-6 font-mono leading-relaxed">
          Paste any upstream API URL below. The gateway automatically encapsulates destination hosts, path parameters, and secret keys, and deploys an instant protected proxy.
        </p>

        {quickError && (
          <div className="mb-6 p-4 bg-[#260A0A] border-2 border-[#EF4444] rounded-none flex items-center gap-3 text-xs text-[#EF4444] font-bold uppercase tracking-wider font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{quickError}</span>
          </div>
        )}

        {quickSuccess && (
          <div className="mb-6 p-5 bg-[#052E16] border-2 border-[#16A34A] rounded-none space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#22C55E] font-mono">
              <CheckCircle className="w-4 h-4" />
              <span>PROXY SUCCESSFULLY DEPLOYED TO GATEWAY</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0A0A0A] p-4 border-2 border-[#16A34A]">
              <div className="font-mono text-xs text-white truncate">
                {`${getPublicGatewayBaseUrl()}${formatGatewayPath(quickSuccess.gatewayPath)}`}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() =>
                    copyToClipboard(
                      `${getPublicGatewayBaseUrl()}${formatGatewayPath(quickSuccess.gatewayPath)}`,
                      'quick_success'
                    )
                  }
                  className="px-3.5 py-2 bg-white text-black hover:bg-[#EF4444] hover:text-white text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 transition-colors rounded-none"
                >
                  {copiedUrl === 'quick_success' ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      COPIED
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      COPY PROXY URL
                    </>
                  )}
                </button>
                <button
                  onClick={() => navigate('/admin/customers')}
                  className="px-3.5 py-2 bg-[#EF4444] text-white hover:bg-[#DC2626] text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5 transition-colors rounded-none"
                >
                  <Key className="w-3.5 h-3.5" />
                  ISSUE CLIENT KEY
                </button>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleQuickAutoConnect} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-8">
              <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2 font-mono">
                Main Upstream API URL <span className="text-[#EF4444]">*</span>
              </label>
              <input
                type="url"
                required
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
                placeholder="https://rootx-osint.in/?type=v_num&key=Axn_personal&query="
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none px-4 py-3 text-xs font-mono text-white placeholder-[#525252] rounded-none transition-colors"
              />
            </div>
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold text-white uppercase tracking-[0.1em] mb-2 font-mono">
                API Name (Optional)
              </label>
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="RootX Vehicle OSINT"
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white focus:outline-none px-4 py-3 text-xs text-white placeholder-[#525252] rounded-none transition-colors"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={quickLoading || !quickUrl.trim()}
              className="py-3 px-6 bg-white text-[#0A0A0A] border-2 border-white hover:bg-[#EF4444] hover:border-[#EF4444] hover:text-white text-xs font-bold uppercase tracking-[0.12em] transition-colors flex items-center gap-2 rounded-none disabled:opacity-40 font-mono"
            >
              {quickLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ANALYZING & DEPLOYING...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>[ DEPLOY GATEWAY PROXY ]</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Purge Notification */}
      {purgeNotification && (
        <div className="p-4 bg-[#052E16] border-2 border-[#16A34A] text-white font-mono text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#22C55E]" />
            <span className="font-bold">{purgeNotification}</span>
          </div>
          <button
            onClick={() => setPurgeNotification(null)}
            className="text-xs uppercase font-bold border border-current px-2 py-0.5 hover:bg-white hover:text-black transition-colors"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* Connectivity Test Alert */}
      {testResult && (
        <div
          className={`p-5 rounded-none border-2 flex items-start justify-between gap-4 font-mono ${
            testResult.success
              ? 'bg-[#052E16] border-[#16A34A] text-white'
              : 'bg-[#260A0A] border-[#EF4444] text-[#EF4444]'
          }`}
        >
          <div className="flex items-start gap-3 text-xs">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 shrink-0 text-[#22C55E] mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-[#EF4444] mt-0.5" />
            )}
            <div>
              <p className="font-bold uppercase tracking-wider">
                {testResult.success ? 'UPSTREAM CONNECTION HEALTHY' : 'CONNECTIVITY TEST FAILED'}
              </p>
              <p className="text-[11px] opacity-90 mt-1">
                Target: {testResult.targetUrl} | Latency: {testResult.latencyMs}ms{' '}
                {testResult.statusCode && `| HTTP ${testResult.statusCode}`}
                {testResult.error && `| Error: ${testResult.error}`}
              </p>
            </div>
          </div>
          <button
            onClick={() => setTestResult(null)}
            className="text-xs uppercase font-bold border border-current px-2 py-1 hover:bg-white hover:text-black transition-colors"
          >
            DISMISS
          </button>
        </div>
      )}

      {/* DEPLOYED APIS TABLE */}
      <div className="bg-[#121212] border-2 border-[#262626] rounded-none overflow-hidden">
        <div className="px-6 py-4 border-b-2 border-[#262626] flex items-center justify-between bg-[#0A0A0A]">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white font-mono">
            Active Catalog Endpoints
          </h3>
          <span className="text-xs text-[#A3A3A3] font-mono font-bold">
            [{apis.length} ACTIVE ROUTES]
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-[#0A0A0A] text-[#A3A3A3] border-b-2 border-[#262626] uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-6 py-4 font-bold">API Name</th>
                <th className="px-6 py-4 font-bold">Gateway Endpoint</th>
                <th className="px-6 py-4 font-bold">Upstream Target</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262626]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-[#A3A3A3] font-mono uppercase tracking-widest">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-white" />
                    Querying API catalog...
                  </td>
                </tr>
              ) : apis.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-[#737373] uppercase tracking-wider font-mono">
                    No APIs connected yet. Use the 1-Click Connector above to connect your main API.
                  </td>
                </tr>
              ) : (
                apis.map((api) => {
                  const fullGatewayUrl = `${getPublicGatewayBaseUrl()}${formatGatewayPath(api.gatewayPath)}`;
                  const isCopied = copiedUrl === api._id;

                  return (
                    <tr key={api._id} className="hover:bg-[#181818] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm uppercase">{api.name}</div>
                        <div className="text-[11px] text-[#A3A3A3] mt-0.5">
                          slug: {api.slug} • {api.category}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="text-xs bg-[#0A0A0A] text-white px-2.5 py-1 border border-[#333333] font-bold">
                            /v1{api.gatewayPath}
                          </code>
                          <button
                            onClick={() => copyToClipboard(fullGatewayUrl, api._id)}
                            title="Copy full gateway URL"
                            className="p-1 border border-[#333333] hover:border-white text-[#A3A3A3] hover:text-white transition-colors"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-[#A3A3A3] text-xs truncate max-w-xs">
                          {api.upstreamBaseUrl}
                          {api.upstreamPath}
                        </div>
                        <div className="text-[10px] text-[#737373] mt-0.5 uppercase">
                          Methods: {api.allowedMethods?.join(', ')} • Timeout: {api.timeoutMs}ms
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge
                          variant={
                            api.status === 'active'
                              ? 'success'
                              : api.status === 'maintenance'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {api.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedPackageApiId(api._id)}
                            title="View Client Distribution Package"
                            className="px-2.5 py-1 bg-[#121212] border border-white hover:bg-white hover:text-black text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors rounded-none"
                          >
                            <Package className="w-3 h-3 text-cyan-400" />
                            Package
                          </button>
                          {api.cachePolicy?.enabled && (
                            <button
                              onClick={() => handlePurgeCache(api._id, api.name)}
                              disabled={purgingId === api._id}
                              title="Purge Response Cache"
                              className="p-1.5 border border-[#333333] hover:border-amber-400 text-amber-400 transition-colors disabled:opacity-40"
                            >
                              <RotateCw className={`w-3.5 h-3.5 ${purgingId === api._id ? 'animate-spin' : ''}`} />
                            </button>
                          )}
                          <button
                            onClick={() => navigate('/admin/customers')}
                            className="px-3 py-1 bg-white text-black hover:bg-[#EF4444] hover:text-white text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors rounded-none"
                          >
                            <Key className="w-3 h-3" />
                            Issue Key
                          </button>
                          <button
                            onClick={() => handleTestConnectivity(api._id)}
                            disabled={testingId === api._id}
                            title="Test upstream connection"
                            className="p-1.5 border border-[#333333] hover:border-white text-white transition-colors disabled:opacity-40"
                          >
                            {testingId === api._id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-white" />
                            ) : (
                              <Activity className="w-4 h-4 text-[#22C55E]" />
                            )}
                          </button>
                          <button
                            onClick={() => handleToggle(api._id, api.status)}
                            title={api.status === 'active' ? 'Disable API' : 'Enable API'}
                            className="p-1.5 border border-[#333333] hover:border-white text-white transition-colors"
                          >
                            {api.status === 'active' ? (
                              <Power className="w-4 h-4 text-amber-400" />
                            ) : (
                              <PowerOff className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                          <button
                            onClick={() => handleDelete(api._id, api.name)}
                            title="Delete API"
                            className="p-1.5 border border-[#333333] hover:border-[#EF4444] text-[#A3A3A3] hover:text-[#EF4444] transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* ADVANCED MANUAL MODAL */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Manual API Endpoint Configuration"
      >
        <form onSubmit={handleCreateApiManual} className="space-y-5">
          {formError && (
            <div className="p-3 bg-[#260A0A] border-2 border-[#EF4444] text-xs text-[#EF4444] font-bold font-mono">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1 font-mono">
                API Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1 font-mono">
                Slug
              </label>
              <input
                type="text"
                required
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white rounded-none font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1 font-mono">
              Gateway Path
            </label>
            <input
              type="text"
              required
              value={formData.gatewayPath}
              onChange={(e) => setFormData({ ...formData, gatewayPath: e.target.value })}
              className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white font-mono rounded-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1 font-mono">
              Upstream Base URL
            </label>
            <input
              type="url"
              required
              value={formData.upstreamBaseUrl}
              onChange={(e) => setFormData({ ...formData, upstreamBaseUrl: e.target.value })}
              className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white font-mono rounded-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-white uppercase tracking-wider mb-1 font-mono">
              Upstream Path & Query Secrets
            </label>
            <input
              type="text"
              value={formData.upstreamPath}
              onChange={(e) => setFormData({ ...formData, upstreamPath: e.target.value })}
              className="w-full bg-[#0A0A0A] border-2 border-[#333333] focus:border-white px-3 py-2 text-xs text-white font-mono rounded-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t-2 border-[#262626]">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 border-2 border-transparent hover:border-[#333333] text-xs font-bold uppercase tracking-wider text-[#A3A3A3] hover:text-white rounded-none"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-white text-black hover:bg-[#EF4444] hover:text-white border-2 border-white hover:border-[#EF4444] text-xs font-bold uppercase tracking-widest rounded-none transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </form>
      </Modal>

      {/* Universal Automated API Importer Modal */}
      <UniversalApiImporterModal
        isOpen={showImporterModal}
        onClose={() => setShowImporterModal(false)}
        onSuccess={() => fetchApis()}
      />

      {/* Client Distribution Package Modal */}
      <ClientPackageModal
        apiId={selectedPackageApiId}
        isOpen={Boolean(selectedPackageApiId)}
        onClose={() => setSelectedPackageApiId(null)}
      />
    </div>
  );
};
