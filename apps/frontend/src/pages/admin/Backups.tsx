import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Database, Plus, RefreshCw } from 'lucide-react';

export const AdminBackups: React.FC = () => {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchBackups();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/backups', {}, 'admin');
    if (res.success) setBackups(res.data || []);
    setLoading(false);
  };

  const handleTriggerBackup = async () => {
    setCreating(true);
    const res = await apiRequest('/api/v1/admin/backups', { method: 'POST' }, 'admin');
    setCreating(false);
    if (res.success) fetchBackups();
  };

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Database Backups</h1>
          <p className="text-xs text-gray-400 mt-1">Snapshot archives, automated retention, and disaster recovery</p>
        </div>
        <button
          onClick={handleTriggerBackup}
          disabled={creating}
          className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/20 disabled:opacity-50"
        >
          <Database className="w-4 h-4" />
          {creating ? 'Backing up...' : 'Create Snapshot'}
        </button>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1E2D4A] bg-[#0B1020]/40 text-[11px] font-mono text-gray-400 uppercase tracking-wider">
                <th className="py-3 px-4">Snapshot Archive</th>
                <th className="py-3 px-4">Size</th>
                <th className="py-3 px-4">Created Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2D4A] text-sm font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-500">
                    Loading backups...
                  </td>
                </tr>
              ) : backups.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-gray-500">
                    No database backups found. Click "Create Snapshot" above.
                  </td>
                </tr>
              ) : (
                backups.map((b) => (
                  <tr key={b.id} className="hover:bg-[#172338]/50 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">{b.filename}</td>
                    <td className="py-3 px-4 text-cyan-400">{b.sizeBytes} B</td>
                    <td className="py-3 px-4 text-gray-400">
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
