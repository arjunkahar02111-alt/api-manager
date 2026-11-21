import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';

export const AdminAnalytics: React.FC = () => {
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/admin/analytics/trends?days=14', {}, 'admin');
    if (res.success) setTrends(res.data || []);
    setLoading(false);
  };

  const totalRequests = trends.reduce((acc, curr) => acc + curr.requests, 0);
  const totalSuccess = trends.reduce((acc, curr) => acc + curr.successful, 0);
  const totalFailed = trends.reduce((acc, curr) => acc + curr.failed, 0);
  const successRate = totalRequests > 0 ? ((totalSuccess / totalRequests) * 100).toFixed(1) : '100';

  return (
    <div className="p-8 lg:p-10 space-y-10 selection:bg-[#EF4444] selection:text-white">
      {/* Editorial Header */}
      <div className="border-b-2 border-[#262626] pb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-[#EF4444]" />
            <span className="text-[11px] font-bold text-[#EF4444] uppercase tracking-[0.15em] font-mono">
              TRAFFIC DISTRIBUTION // ANALYTICS
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight uppercase leading-none">
            ANALYTICS
          </h1>
          <p className="text-xs text-[#A3A3A3] font-mono uppercase mt-2">
            14-DAY AGGREGATED METRICS, THROUGHPUT PATTERNS & SUCCESS RATES
          </p>
        </div>
      </div>

      {/* VoiceBox Elevated Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono">
        <div className="bg-[#121212] border-t-4 border-t-[#EF4444] border-x-2 border-b-2 border-[#262626] p-6 rounded-none">
          <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-wider">
            14-Day Request Total
          </span>
          <div className="text-3xl font-display text-white mt-2 leading-none">
            {totalRequests.toLocaleString()}
          </div>
          <p className="text-[10px] text-[#737373] mt-2 uppercase">TOTAL LOGGED EVENTS</p>
        </div>

        <div className="bg-[#121212] border-t-4 border-t-white border-x-2 border-b-2 border-[#262626] p-6 rounded-none">
          <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-wider">
            Gateway Success Rate
          </span>
          <div className="text-3xl font-display text-[#22C55E] mt-2 leading-none">
            {successRate}%
          </div>
          <p className="text-[10px] text-[#737373] mt-2 uppercase">{totalSuccess.toLocaleString()} SUCCESSFUL CALLS</p>
        </div>

        <div className="bg-[#121212] border-t-4 border-t-[#EF4444] border-x-2 border-b-2 border-[#262626] p-6 rounded-none">
          <span className="text-[11px] font-bold text-[#A3A3A3] uppercase tracking-wider">
            Rejections & Errors
          </span>
          <div className="text-3xl font-display text-[#EF4444] mt-2 leading-none">
            {totalFailed.toLocaleString()}
          </div>
          <p className="text-[10px] text-[#737373] mt-2 uppercase">RATE LIMITS / UPSTREAM FAILS</p>
        </div>
      </div>

      {/* 14-Day Throughput Bar Visualizer */}
      <div className="bg-[#121212] border-2 border-[#262626] p-6 lg:p-8 rounded-none">
        <div className="border-b-2 border-[#262626] pb-4 mb-6 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-white font-mono">
            Traffic Volume Over Time (14 Days)
          </h3>
          <span className="text-xs text-[#A3A3A3] font-mono">DAILY PROXY TRAFFIC</span>
        </div>

        <div className="h-56 flex items-end gap-2 pt-6 pb-2 border-b-2 border-[#262626]">
          {trends.map((item, idx) => {
            const maxVal = Math.max(...trends.map((t) => t.requests), 10);
            const heightPct = Math.max(6, Math.round((item.requests / maxVal) * 100));
            const isPeak = item.requests === maxVal && item.requests > 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-[9px] font-mono text-[#A3A3A3] opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.requests}
                </div>
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full transition-all rounded-none ${
                    isPeak
                      ? 'bg-[#EF4444] border border-white'
                      : 'bg-white hover:bg-[#EF4444] border border-[#333333]'
                  }`}
                />
                <span className="text-[9px] text-[#737373] font-mono mt-1 uppercase">
                  {String(item.date || '').substring(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
