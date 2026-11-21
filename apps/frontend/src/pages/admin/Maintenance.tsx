import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { AlertTriangle, Power } from 'lucide-react';

export const AdminMaintenance: React.FC = () => {
  const [status, setStatus] = useState<any>({
    global: false,
    gateway: false,
    customerDashboard: false,
    message: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMaintenance();
  }, []);

  const fetchMaintenance = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/maintenance', {}, 'admin');
    if (res.success) setStatus(res.data);
    setLoading(false);
  };

  const handleToggle = async (key: string) => {
    const updated = { ...status, [key]: !status[key] };
    setStatus(updated);
    setSaving(true);
    await apiRequest('/api/v1/admin/maintenance', {
      method: 'POST',
      body: JSON.stringify(updated),
    }, 'admin');
    setSaving(false);
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Emergency Maintenance Controls</h1>
        <p className="text-xs text-gray-400 mt-1">Safely halt public traffic or developer dashboard during outages</p>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between p-4 bg-[#0B1020] border border-[#1E2D4A] rounded-xl">
          <div>
            <h3 className="text-sm font-semibold text-white">Global Maintenance Mode</h3>
            <p className="text-xs text-gray-400 mt-0.5">Halts all customer API requests and dashboard logins</p>
          </div>
          <button
            onClick={() => handleToggle('global')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-colors ${
              status.global
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                : 'bg-[#172338] text-gray-300 hover:text-white'
            }`}
          >
            {status.global ? 'ENABLED (ACTIVE)' : 'DISABLED'}
          </button>
        </div>

        <div className="flex items-center justify-between p-4 bg-[#0B1020] border border-[#1E2D4A] rounded-xl">
          <div>
            <h3 className="text-sm font-semibold text-white">API Gateway Proxy Switch</h3>
            <p className="text-xs text-gray-400 mt-0.5">Blocks /v1/* proxy routes with HTTP 503 Maintenance</p>
          </div>
          <button
            onClick={() => handleToggle('gateway')}
            className={`px-4 py-2 rounded-xl text-xs font-bold font-mono transition-colors ${
              status.gateway
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                : 'bg-[#172338] text-gray-300 hover:text-white'
            }`}
          >
            {status.gateway ? 'ENABLED (ACTIVE)' : 'DISABLED'}
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-300 mb-2">Public Maintenance Notice Message</label>
          <textarea
            rows={3}
            value={status.message || ''}
            onChange={(e) => setStatus({ ...status, message: e.target.value })}
            className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
