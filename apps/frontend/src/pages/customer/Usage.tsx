import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { BarChart3 } from 'lucide-react';

export const CustomerUsage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/customer/usage', {}, 'customer');
    if (res.success) setData(res.data);
    setLoading(false);
  };

  const history = data?.history || [];

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Personal Usage Analytics</h1>
        <p className="text-xs text-gray-400 mt-1">14-day history of your requests processed by KARVION API MANAGER</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-xl p-5">
          <span className="text-xs text-gray-400 font-medium uppercase">Requests Today</span>
          <div className="text-2xl font-bold font-mono text-cyan-400 mt-2">
            {data?.daily?.used?.toLocaleString() ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">Limit: {data?.daily?.limit?.toLocaleString()} reqs</p>
        </div>
        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-xl p-5">
          <span className="text-xs text-gray-400 font-medium uppercase">Requests This Month</span>
          <div className="text-2xl font-bold font-mono text-blue-400 mt-2">
            {data?.monthly?.used?.toLocaleString() ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">Limit: {data?.monthly?.limit?.toLocaleString()} reqs</p>
        </div>
        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-xl p-5">
          <span className="text-xs text-gray-400 font-medium uppercase">Lifetime Requests</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-2">
            {data?.lifetime?.used?.toLocaleString() ?? 0}
          </div>
          <p className="text-xs text-gray-500 mt-1">Limit: {data?.lifetime?.limit?.toLocaleString()} reqs</p>
        </div>
      </div>

      <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white mb-6">14-Day Activity Chart</h3>
        <div className="h-44 flex items-end gap-2 pt-6 pb-2 border-b border-[#1E2D4A]">
          {history.map((item: any, idx: number) => {
            const maxVal = Math.max(...history.map((h: any) => h.requests), 10);
            const heightPct = Math.max(8, Math.round((item.requests / maxVal) * 100));
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-[9px] font-mono text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.requests}
                </div>
                <div
                  style={{ height: `${heightPct}%` }}
                  className="w-full bg-cyan-500 rounded-t-sm transition-all group-hover:bg-cyan-300"
                />
                <span className="text-[9px] text-gray-500 font-mono mt-1">
                  {item.date.substring(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
