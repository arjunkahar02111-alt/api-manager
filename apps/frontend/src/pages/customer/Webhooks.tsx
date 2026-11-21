import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Modal } from '../../components/Modal';
import { Webhook, Plus, Trash2, ShieldAlert, Copy, Check } from 'lucide-react';

export const CustomerWebhooks: React.FC = () => {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newSecretData, setNewSecretData] = useState<{ url: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([
    'account.expiring_soon',
    'quota.daily_warning',
    'quota.daily_exceeded',
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWebhooks();
  }, []);

  const fetchWebhooks = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/customer/webhooks', {}, 'customer');
    if (res.success) setWebhooks(res.data || []);
    setLoading(false);
  };

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await apiRequest('/api/v1/customer/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url, events }),
    }, 'customer');

    if (!res.success) {
      setError(res.error?.message || 'Failed to create webhook');
      return;
    }

    setShowModal(false);
    setUrl('');
    setNewSecretData({
      url: res.data.url,
      secret: res.data.signingSecret,
    });
    fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this webhook endpoint?')) return;
    await apiRequest(`/api/v1/customer/webhooks/${id}`, { method: 'DELETE' }, 'customer');
    fetchWebhooks();
  };

  const copySecret = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Webhook Notifications</h1>
          <p className="text-xs text-gray-400 mt-1">Receive automated HMAC-signed notifications for quota thresholds and account status</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setShowModal(true);
          }}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </button>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1E2D4A] bg-[#0B1020]/40 font-mono text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Destination Endpoint</th>
                <th className="py-3 px-4">Subscribed Events</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A]">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-500 font-mono">Loading webhooks...</td>
                </tr>
              ) : webhooks.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-500 font-mono">
                    No webhooks registered. Click "Add Webhook" above.
                  </td>
                </tr>
              ) : (
                webhooks.map((w) => (
                  <tr key={w.id} className="hover:bg-[#172338]/50">
                    <td className="py-3.5 px-4 font-mono text-cyan-300 font-bold">{w.url}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {w.events?.map((ev: string) => (
                          <span key={ev} className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {ev}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="p-1.5 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-[#172338]"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE WEBHOOK MODAL */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Register Webhook Endpoint">
        <form onSubmit={handleCreateWebhook} className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 text-red-300 text-xs rounded-xl">{error}</div>}
          <div>
            <label className="block text-xs text-gray-300 mb-1">Destination URL (HTTP/HTTPS)</label>
            <input
              type="url"
              required
              placeholder="https://api.yourdomain.com/webhooks/karvion"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 bg-[#172338] text-gray-300 rounded-xl text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium"
            >
              Register Webhook
            </button>
          </div>
        </form>
      </Modal>

      {/* ONE-TIME WEBHOOK SECRET REVEAL */}
      <Modal isOpen={!!newSecretData} onClose={() => setNewSecretData(null)} title="Webhook Signing Secret">
        <div className="space-y-4">
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300 leading-relaxed">
              Copy this HMAC-SHA256 signing secret now. It is encrypted in database storage and will never be shown again. Use it to verify the <code>X-Karvion-Signature</code> header on incoming webhook deliveries.
            </div>
          </div>

          <div className="relative">
            <input
              type="text"
              readOnly
              value={newSecretData?.secret || ''}
              className="w-full bg-[#0B1020] border border-cyan-500/40 rounded-xl px-4 py-3 text-xs text-cyan-300 font-mono pr-24 select-all"
            />
            <button
              onClick={() => copySecret(newSecretData?.secret || '')}
              className="absolute right-2 top-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={() => setNewSecretData(null)}
              className="px-5 py-2 bg-[#172338] hover:bg-cyan-600/20 text-white rounded-xl text-sm"
            >
              Saved Secret
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
