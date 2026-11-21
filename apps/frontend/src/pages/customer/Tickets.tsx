import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { LifeBuoy, Plus, Send } from 'lucide-react';

export const CustomerTickets: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');

  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Technical Issue');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/customer/tickets', {}, 'customer');
    if (res.success) setTickets(res.data || []);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await apiRequest('/api/v1/customer/tickets', {
      method: 'POST',
      body: JSON.stringify({ subject, category, priority, message }),
    }, 'customer');

    if (res.success) {
      setShowModal(false);
      setSubject('');
      setMessage('');
      fetchTickets();
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;

    const res = await apiRequest(`/api/v1/customer/tickets/${selectedTicket._id}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message: replyText }),
    }, 'customer');

    if (res.success) {
      setSelectedTicket(res.data);
      setReplyText('');
      fetchTickets();
    }
  };

  return (
    <div className="p-8 space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Support Tickets</h1>
          <p className="text-xs text-gray-400 mt-1">Direct support channel with platform operations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-cyan-600 hover:bg-cyan-500 text-white font-medium px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Open Support Ticket
        </button>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#1E2D4A] bg-[#0B1020]/40 font-mono text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 font-mono">Loading tickets...</td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-gray-500 font-mono">
                    No tickets found. Open one if you need assistance.
                  </td>
                </tr>
              ) : (
                tickets.map((t) => (
                  <tr key={t._id} className="hover:bg-[#172338]/50">
                    <td className="py-3.5 px-4 font-medium text-white">{t.subject}</td>
                    <td className="py-3.5 px-4 text-gray-400">{t.category}</td>
                    <td className="py-3.5 px-4">
                      <Badge status={t.status} />
                    </td>
                    <td className="py-3.5 px-4 text-gray-500 font-mono">
                      {new Date(t.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedTicket(t)}
                        className="px-3 py-1 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 border border-cyan-500/30 rounded-lg text-xs"
                      >
                        View Thread
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE TICKET MODAL */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Open Support Ticket">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-300 mb-1">Subject</label>
            <input
              type="text"
              required
              placeholder="e.g. Issue connecting to /v1/user/info"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="Technical Issue">Technical Issue</option>
                <option value="Quota Extension">Quota Extension</option>
                <option value="Billing / Payment">Billing / Payment</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-300 mb-1">Message</label>
            <textarea
              required
              rows={4}
              placeholder="Provide details about your question or issue..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-[#0B1020] border border-[#1E2D4A] rounded-xl p-3 text-sm text-white focus:outline-none focus:border-cyan-500"
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
              Submit Ticket
            </button>
          </div>
        </form>
      </Modal>

      {/* TICKET THREAD MODAL */}
      <Modal isOpen={!!selectedTicket} onClose={() => setSelectedTicket(null)} title={selectedTicket?.subject || 'Ticket'} maxWidth="2xl">
        <div className="space-y-4">
          <div className="max-h-80 overflow-y-auto space-y-3 p-4 bg-[#0B1020] border border-[#1E2D4A] rounded-xl">
            {selectedTicket?.messages?.map((m: any, idx: number) => (
              <div
                key={idx}
                className={`p-3 rounded-xl max-w-lg ${
                  m.senderRole === 'admin'
                    ? 'bg-[#172338] border border-[#1E2D4A] text-gray-200'
                    : 'ml-auto bg-cyan-600/20 border border-cyan-500/30 text-white'
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
              placeholder="Type your reply..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="flex-1 bg-[#0B1020] border border-[#1E2D4A] rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-sm font-medium flex items-center gap-1.5"
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
