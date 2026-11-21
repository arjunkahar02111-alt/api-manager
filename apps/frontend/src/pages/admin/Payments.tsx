import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { CheckCircle2, XCircle, FileText, Plus } from 'lucide-react';

export const AdminPayments: React.FC = () => {
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [extendDays, setExtendDays] = useState(30);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/payments', {}, 'admin');
    if (res.success) setPayments(res.data || []);
    setLoading(false);
  };

  const handleVerify = async (status: 'verified' | 'rejected') => {
    if (!selectedPayment) return;
    await apiRequest(`/api/v1/admin/payments/${selectedPayment._id}/verify`, {
      method: 'POST',
      body: JSON.stringify({
        status,
        extendCustomerDays: status === 'verified' ? extendDays : 0,
      }),
    }, 'admin');
    setSelectedPayment(null);
    fetchPayments();
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Manual Payment Verification</h1>
        <p className="text-xs text-gray-400 mt-1">Review wire transfers, manual receipts, and approve customer validity</p>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2D4A] bg-[#0B1020]/40 text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Method / Reference</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Recorded At</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-mono text-xs">
                    Loading payments...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-mono text-xs">
                    No payment entries recorded yet.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p._id} className="hover:bg-[#172338]/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-white">{p.customerId?.fullName || 'Client'}</div>
                      <div className="text-xs text-gray-400 font-mono">@{p.customerId?.username}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-cyan-400">
                      ${p.amount} {p.currency}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="text-xs text-white">{p.paymentMethod}</div>
                      <div className="text-[11px] font-mono text-gray-400">Ref: {p.reference}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge status={p.status} />
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-gray-400">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {p.status === 'pending' && (
                        <button
                          onClick={() => setSelectedPayment(p)}
                          className="px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs font-medium"
                        >
                          Verify Payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VERIFICATION MODAL */}
      <Modal isOpen={!!selectedPayment} onClose={() => setSelectedPayment(null)} title="Verify Manual Payment">
        <div className="space-y-4">
          <div className="p-4 bg-[#0B1020] border border-[#1E2D4A] rounded-xl text-xs space-y-2 font-mono">
            <div>Customer: @{selectedPayment?.customerId?.username}</div>
            <div>Amount: ${selectedPayment?.amount} {selectedPayment?.currency}</div>
            <div>Reference: {selectedPayment?.reference}</div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">
              Extend Customer Validity Upon Approval (Days)
            </label>
            <input
              type="number"
              min={0}
              value={extendDays}
              onChange={(e) => setExtendDays(parseInt(e.target.value, 10))}
              className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <button
              onClick={() => handleVerify('rejected')}
              className="px-4 py-2 bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 rounded-xl text-xs font-medium"
            >
              Reject Payment
            </button>
            <button
              onClick={() => handleVerify('verified')}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-medium shadow-lg shadow-emerald-600/20"
            >
              Verify & Approve
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
