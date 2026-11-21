import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { LifeBuoy, Send } from 'lucide-react';

export const AdminTickets: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/tickets', {}, 'admin');
    if (res.success) setTickets(res.data || []);
    setLoading(false);
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyMessage.trim()) return;

    const res = await apiRequest(`/api/v1/admin/tickets/${selectedTicket._id}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message: replyMessage }),
    }, 'admin');

    if (res.success) {
      setSelectedTicket(res.data);
      setReplyMessage('');
      fetchTickets();
    }
  };

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Support Tickets Desk</h1>
        <p className="text-xs text-gray-400 mt-1">Customer inquiries, API issues, and billing requests</p>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2D4A] bg-[#0B1020]/40 text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A] text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-mono text-xs">
                    Loading tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500 font-mono text-xs">
                    No support tickets open.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t._id} className="hover:bg-[#172338]/50 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-white">{t.subject}</td>
                    <td className="py-3.5 px-4 text-cyan-400 font-mono text-xs">@{t.customerUsername}</td>
                    <td className="py-3.5 px-4 text-gray-400 text-xs">{t.category}</td>
                    <td className="py-3.5 px-4 font-mono text-xs uppercase text-amber-400">{t.priority}</td>
                    <td className="py-3.5 px-4">
                      <Badge status={t.status} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs"
                      >
                        Open Ticket
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TICKET THREAD MODAL */}
      <Modal isOpen={!!selectedTicket} onClose={() => setSelectedTicket(null)} title={selectedTicket?.subject || 'Ticket'} maxWidth="2xl">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge status={selectedTicket?.status || ''} />
            <span className="text-xs text-gray-400 font-mono">From: @{selectedTicket?.customerUsername}</span>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-3 p-4 bg-[#0B1020] border border-[#1E2D4A] rounded-xl">
            {selectedTicket?.messages?.map((m: any, idx: number) => (
              <div
                key={idx}
                className={`p-3 rounded-xl max-w-lg ${
                  m.senderRole === 'admin'
                    ? 'ml-auto bg-blue-600/20 border border-blue-500/30 text-white'
                    : 'bg-[#172338] border border-[#1E2D4A] text-gray-200'
                }`}
              >
                <div className="text-[10px] text-gray-400 font-mono mb-1">
                  {m.senderName} ({m.senderRole}) • {new Date(m.createdAt).toLocaleTimeString()}
                </div>
                <p className="text-xs whitespace-pre-wrap">{m.message}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleReply} className="flex gap-2">
            <input
              type="text"
              required
              placeholder="Type your reply to customer..."
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              className="flex-1 bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              Reply
            </button>
          </form>
        </div>
      </Modal>
    </div>
  );
};
