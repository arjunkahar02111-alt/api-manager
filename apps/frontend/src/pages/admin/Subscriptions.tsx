import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Modal } from '../../components/Modal';
import { CreditCard, Plus } from 'lucide-react';

export const AdminSubscriptions: React.FC = () => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    durationDays: 30,
    dailyLimit: 1000,
    monthlyLimit: 30000,
    lifetimeLimit: 100000,
    bandwidthLimitBytes: 10737418240, // 10 GB
    concurrencyLimit: 10,
    price: 99,
    currency: 'USD',
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/subscriptions/plans', {}, 'admin');
    if (res.success) setPlans(res.data || []);
    setLoading(false);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/api/v1/admin/subscriptions/plans', {
      method: 'POST',
      body: JSON.stringify(formData),
    }, 'admin');
    if (res.success) {
      setShowModal(false);
      fetchPlans();
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Subscription Plans</h1>
          <p className="text-xs text-gray-400 mt-1">Configure tiered quotas, rate limits, and pricing</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-gray-500 text-xs font-mono py-8 col-span-3 text-center">Loading plans...</p>
        ) : plans.length === 0 ? (
          <p className="text-gray-500 text-xs font-mono py-8 col-span-3 text-center">No subscription plans created yet.</p>
        ) : (
          plans.map((p) => (
            <div key={p._id} className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl p-6 space-y-4 hover:border-blue-500/40 transition-colors">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-white">{p.name}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{p.description || 'Standard Tier'}</p>
                </div>
                <span className="text-xl font-bold font-mono text-cyan-400">
                  ${p.price} <span className="text-xs text-gray-400 font-sans">/{p.durationDays}d</span>
                </span>
              </div>

              <div className="space-y-2 pt-2 border-t border-[#1E2D4A] text-xs font-mono text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-500">Daily Quota:</span>
                  <span>{p.dailyLimit.toLocaleString()} reqs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Monthly Quota:</span>
                  <span>{p.monthlyLimit.toLocaleString()} reqs</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Concurrency:</span>
                  <span>{p.concurrencyLimit} simultaneous</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bandwidth:</span>
                  <span>{(p.bandwidthLimitBytes / (1024 * 1024 * 1024)).toFixed(0)} GB</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CREATE PLAN MODAL */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Subscription Plan">
        <form onSubmit={handleCreatePlan} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1">Plan Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enterprise Tier"
              className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Price ($)</label>
              <input
                type="number"
                min={0}
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Duration (Days)</label>
              <input
                type="number"
                min={1}
                required
                value={formData.durationDays}
                onChange={(e) => setFormData({ ...formData, durationDays: parseInt(e.target.value, 10) })}
                className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Daily Limit</label>
              <input
                type="number"
                min={0}
                required
                value={formData.dailyLimit}
                onChange={(e) => setFormData({ ...formData, dailyLimit: parseInt(e.target.value, 10) })}
                className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Monthly Limit</label>
              <input
                type="number"
                min={0}
                required
                value={formData.monthlyLimit}
                onChange={(e) => setFormData({ ...formData, monthlyLimit: parseInt(e.target.value, 10) })}
                className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm"
            >
              Save Plan
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
