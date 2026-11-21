import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Modal } from '../../components/Modal';
import { Globe, Plus, Trash2, ShieldAlert } from 'lucide-react';

export const CustomerIpAllowlist: React.FC = () => {
  const [ips, setIps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [cidr, setCidr] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIps();
  }, []);

  const fetchIps = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/customer/ip-allowlist', {}, 'customer');
    if (res.success) setIps(res.data || []);
    setLoading(false);
  };

  const handleAddIp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = await apiRequest('/api/v1/customer/ip-allowlist', {
      method: 'POST',
      body: JSON.stringify({ cidr, label }),
    }, 'customer');

    if (!res.success) {
      setError(res.error?.message || 'Invalid IP/CIDR');
      return;
    }

    setShowModal(false);
    setCidr('');
    setLabel('');
    fetchIps();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this IP/CIDR block?')) return;
    await apiRequest(`/api/v1/customer/ip-allowlist/${id}`, { method: 'DELETE' }, 'customer');
    fetchIps();
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">IP Address Restrictions</h1>
          <p className="text-xs text-gray-400 mt-1">Restrict API key usage strictly to approved IP addresses or CIDR blocks</p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setShowModal(true);
          }}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Allowed IP
        </button>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 bg-[#0B1020]/50 border-b border-[#1E2D4A] text-xs text-gray-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>If no IP addresses are listed, requests from any IP address are permitted by default.</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-[#1E2D4A] text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">CIDR / IP</th>
                <th className="py-3 px-4">Label</th>
                <th className="py-3 px-4">Added On</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A]">
              {loading ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">Loading allowlist...</td>
                </tr>
              ) : ips.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-12 text-center text-gray-500">
                    No IP restrictions configured. All IPs currently allowed.
                  </td>
                </tr>
              ) : (
                ips.map((ip) => (
                  <tr key={ip._id} className="hover:bg-[#172338]/50">
                    <td className="py-3 px-4 text-cyan-300 font-bold">{ip.cidr}</td>
                    <td className="py-3 px-4 text-gray-300">{ip.label || 'Default Server'}</td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(ip.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(ip._id)}
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

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Allowed IP / CIDR Block">
        <form onSubmit={handleAddIp} className="space-y-4">
          {error && <div className="p-3 bg-red-500/10 text-red-300 text-xs rounded-xl">{error}</div>}
          <div>
            <label className="block text-xs text-gray-300 mb-1">IP Address or CIDR Block</label>
            <input
              type="text"
              required
              placeholder="e.g. 203.0.113.195 or 198.51.100.0/24"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-300 mb-1">Label (Optional)</label>
            <input
              type="text"
              placeholder="Production Backend Server"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
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
              Add to Allowlist
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
