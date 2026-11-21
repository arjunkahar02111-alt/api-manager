import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api';
import { StatCard } from '../../components/StatCard';
import { Users, Activity, CheckCircle, ArrowUpRight, Database, Zap, Key, ShieldAlert } from 'lucide-react';

export const AdminOverview: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [trends, setTrends] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    const [resOverview, resTrends] = await Promise.all([
      apiRequest('/api/v1/admin/analytics', {}, 'admin'),
      apiRequest('/api/v1/admin/analytics/trends?days=7', {}, 'admin'),
    ]);

    if (resOverview.success) setStats(resOverview.data);
    if (resTrends.success) setTrends(resTrends.data || []);
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <span className="text-[#A3A3A3] font-mono text-xs uppercase tracking-widest animate-pulse">
          FETCHING SYSTEM TELEMETRY...
        </span>
      </div>
    );
  }

  return (
    <div className="p-8 lg:p-10 space-y-10 selection:bg-[#A020F0] selection:text-white">
      {/* Editorial Page Header */}
      <div className="border-b-2 border-[#1F1930] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 bg-[#A020F0] shadow-[0_0_8px_#A020F0]" />
            <span className="text-[11px] font-bold text-[#C77DFF] uppercase tracking-[0.15em] font-mono">
              KARVION COMMAND // SOC TELEMETRY
            </span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl text-white tracking-tight uppercase leading-none">
            OVERVIEW
          </h1>
          <p className="text-xs text-[#A39BAD] font-mono uppercase mt-2">
            CANONICAL DOMAIN: api.karviontechnologies.in
          </p>
        </div>

        <button
          onClick={fetchOverview}
          className="self-start md:self-auto px-4 py-2 bg-[#121212] border-2 border-white hover:bg-[#A020F0] hover:border-[#A020F0] text-white text-xs font-bold uppercase tracking-widest transition-colors font-mono"
        >
          [ REFRESH TELEMETRY ]
        </button>
      </div>

      {/* VoiceBox Bold Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          onClick={() => navigate('/admin/apis')}
          className="bg-[#121212] border-t-4 border-t-white border-x-2 border-b-2 border-[#1F1930] hover:border-white p-6 cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#08060D] border-2 border-white flex items-center justify-center text-white group-hover:border-[#A020F0] group-hover:text-[#A020F0] transition-colors shrink-0">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#C77DFF] uppercase tracking-widest font-mono">
                INSTANT PROXY
              </span>
              <h3 className="text-base font-bold text-white uppercase tracking-wider mt-0.5 group-hover:text-[#A020F0] transition-colors font-mono">
                1-Click Main API Connector
              </h3>
              <p className="text-xs text-[#A39BAD] mt-1">
                Paste any upstream API URL and deploy an instant protected gateway proxy.
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-[#525252] group-hover:text-white transition-colors shrink-0" />
        </div>

        <div
          onClick={() => navigate('/admin/customers')}
          className="bg-[#121212] border-t-4 border-t-[#A020F0] border-x-2 border-b-2 border-[#1F1930] hover:border-white p-6 cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#08060D] border-2 border-white flex items-center justify-center text-white group-hover:border-[#A020F0] group-hover:text-[#A020F0] transition-colors shrink-0">
              <Key className="w-6 h-6 text-[#A020F0]" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#C77DFF] uppercase tracking-widest font-mono">
                CLIENT ACCESS
              </span>
              <h3 className="text-base font-bold text-white uppercase tracking-wider mt-0.5 group-hover:text-[#A020F0] transition-colors font-mono">
                Generate Client Key & Quota
              </h3>
              <p className="text-xs text-[#A39BAD] mt-1">
                Create user API keys, configure custom validity & copy ready-to-use access links.
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-[#525252] group-hover:text-white transition-colors shrink-0" />
        </div>

        <div
          onClick={() => navigate('/admin/security')}
          className="bg-[#121212] border-t-4 border-t-[#7B2FFF] border-x-2 border-b-2 border-[#1F1930] hover:border-white p-6 cursor-pointer transition-all flex items-center justify-between group"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#08060D] border-2 border-white flex items-center justify-center text-white group-hover:border-[#7B2FFF] group-hover:text-[#7B2FFF] transition-colors shrink-0">
              <ShieldAlert className="w-6 h-6 text-[#C77DFF]" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#C77DFF] uppercase tracking-widest font-mono">
                ACTIVE DEFENSE
              </span>
              <h3 className="text-base font-bold text-white uppercase tracking-wider mt-0.5 group-hover:text-[#7B2FFF] transition-colors font-mono">
                Anti-Sharing & Live Telemetry
              </h3>
              <p className="text-xs text-[#A39BAD] mt-1">
                Strict single-IP key lock, auto-bans on sharing, and live real-time traffic stream.
              </p>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-[#525252] group-hover:text-white transition-colors shrink-0" />
        </div>
      </div>

      {/* VoiceBox Primary KPI StatCards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="ACTIVE CLIENTS"
          value={stats?.customers?.total ?? 0}
          subtitle={`${stats?.customers?.active ?? 0} ACTIVE / ${stats?.customers?.expired ?? 0} EXPIRED`}
          icon={Users}
        />
        <StatCard
          title="REQUESTS TODAY"
          value={(stats?.requests?.today ?? 0).toLocaleString()}
          subtitle={`${stats?.requests?.todaySuccess ?? 0} OK / ${stats?.requests?.todayFailed ?? 0} FAILED`}
          icon={Activity}
        />
        <StatCard
          title="MONTHLY VOLUME"
          value={(stats?.requests?.thisMonth ?? 0).toLocaleString()}
          subtitle={`LIFETIME: ${(stats?.requests?.lifetime ?? 0).toLocaleString()}`}
          icon={CheckCircle}
        />
        <StatCard
          title="BANDWIDTH CONSUMED"
          value={formatBytes(stats?.requests?.lifetimeBandwidthBytes ?? 0)}
          subtitle="TOTAL PAYLOAD TRANSFERRED"
          icon={Database}
        />
      </div>

      {/* Editorial 7-Day Throughput Visualizer */}
      <div className="bg-[#121212] border-2 border-[#262626] p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8 border-b-2 border-[#262626] pb-4">
          <div>
            <span className="text-[11px] font-bold text-[#EF4444] uppercase tracking-[0.14em] font-mono">
              TRAFFIC TELEMETRY
            </span>
            <h3 className="text-lg font-display text-white uppercase tracking-tight mt-0.5">
              7-Day Request Throughput
            </h3>
          </div>
          <span className="text-xs font-mono text-[#A3A3A3] uppercase">
            VOLUME BY DATE
          </span>
        </div>

        <div className="h-48 flex items-end gap-3 pt-6 pb-2 border-b-2 border-[#262626]">
          {trends.map((item, idx) => {
            const maxVal = Math.max(...trends.map((t) => t.requests), 10);
            const heightPct = Math.max(8, Math.round((item.requests / maxVal) * 100));
            const isPeak = item.requests === maxVal && item.requests > 0;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-[10px] font-mono text-[#A3A3A3] opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.requests}
                </div>
                <div
                  style={{ height: `${heightPct}%` }}
                  className={`w-full transition-all ${
                    isPeak
                      ? 'bg-[#EF4444] border-2 border-white'
                      : 'bg-white hover:bg-[#EF4444] border border-[#333333]'
                  }`}
                />
                <span className="text-[10px] text-[#A3A3A3] font-mono mt-1 uppercase">
                  {item.date.substring(5)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top APIs and Top Customers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Most-Used APIs */}
        <div className="bg-[#121212] border-2 border-[#262626] p-6 lg:p-8">
          <div className="border-b-2 border-[#262626] pb-3 mb-5 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              Top Active APIs
            </h3>
            <span className="text-[10px] text-[#A3A3A3] uppercase font-mono">THIS MONTH</span>
          </div>
          <div className="space-y-3">
            {stats?.topApis?.length ? (
              stats.topApis.map((api: any) => (
                <div
                  key={api.apiId}
                  className="flex items-center justify-between p-4 bg-[#0A0A0A] border-2 border-[#262626] hover:border-white transition-colors"
                >
                  <div>
                    <span className="text-sm font-bold text-white uppercase font-mono">
                      {api.name || 'API Endpoint'}
                    </span>
                    <p className="text-xs text-[#A3A3A3] font-mono mt-0.5">{api.gatewayPath}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-display text-white">
                      {api.requests.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-[#737373] font-mono uppercase">REQ</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#737373] font-mono text-center py-8 uppercase">
                No API traffic recorded this month yet.
              </p>
            )}
          </div>
        </div>

        {/* Top Customers */}
        <div className="bg-[#121212] border-2 border-[#262626] p-6 lg:p-8">
          <div className="border-b-2 border-[#262626] pb-3 mb-5 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
              Top Client Consumption
            </h3>
            <span className="text-[10px] text-[#A3A3A3] uppercase font-mono">QUOTA METRICS</span>
          </div>
          <div className="space-y-3">
            {stats?.topCustomers?.length ? (
              stats.topCustomers.map((cust: any) => (
                <div
                  key={cust.customerId}
                  className="flex items-center justify-between p-4 bg-[#0A0A0A] border-2 border-[#262626] hover:border-white transition-colors"
                >
                  <div>
                    <span className="text-sm font-bold text-white uppercase font-mono">
                      {cust.fullName || cust.username}
                    </span>
                    <p className="text-xs text-[#A3A3A3] font-mono mt-0.5">@{cust.username}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-display text-[#EF4444]">
                      {cust.requests.toLocaleString()}
                    </span>
                    <p className="text-[10px] text-[#737373] font-mono uppercase">REQ</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-[#737373] font-mono text-center py-8 uppercase">
                No client activity recorded yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
