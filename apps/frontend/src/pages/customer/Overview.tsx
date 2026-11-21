import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../services/api';
import { Badge } from '../../components/Badge';
import { StatCard } from '../../components/StatCard';
import { Key, Activity, Calendar, Database, ShieldCheck, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export const CustomerOverview: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    const res = await apiRequest('/api/v1/customer/dashboard', {}, 'customer');
    if (res.success) setData(res.data);
    setLoading(false);
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <span className="text-gray-400 font-mono text-sm animate-pulse">Loading developer account telemetry...</span>
      </div>
    );
  }

  const usage = data?.usage;
  const profile = data?.profile;

  const dailyPct = usage?.daily?.limit ? Math.min(100, Math.round((usage.daily.used / usage.daily.limit) * 100)) : 0;
  const monthlyPct = usage?.monthly?.limit ? Math.min(100, Math.round((usage.monthly.used / usage.monthly.limit) * 100)) : 0;

  return (
    <div className="p-8 space-y-8">
      {/* Account Header Banner */}
      <div className="bg-[#100D17] border border-[#262035] rounded-none p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight font-mono">{profile?.fullName}</h1>
            <Badge status={profile?.status || 'active'} />
          </div>
          <p className="text-xs text-[#A39BAD] font-mono mt-1">
            @{profile?.username} • Assigned Key: <span className="text-[#C77DFF] font-bold">{profile?.keyPrefix}••••••••••••</span>
          </p>
        </div>

        <Link
          to="/customer/playground"
          className="bg-[#A020F0] hover:bg-[#7B2FFF] text-white font-mono font-bold px-4 py-2.5 rounded-none text-xs uppercase tracking-wider transition-colors flex items-center gap-2 self-start md:self-auto shadow-lg shadow-[#A020F0]/20"
        >
          Open API Playground
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Daily Quota Remaining"
          value={(usage?.daily?.remaining ?? 0).toLocaleString()}
          subtitle={`${usage?.daily?.used ?? 0} / ${usage?.daily?.limit?.toLocaleString() ?? 0} used today`}
          icon={Activity}
          color="cyan"
        />
        <StatCard
          title="Monthly Requests"
          value={(usage?.monthly?.used ?? 0).toLocaleString()}
          subtitle={`Limit: ${usage?.monthly?.limit?.toLocaleString() ?? 0}`}
          icon={Database}
          color="blue"
        />
        <StatCard
          title="Accessible APIs"
          value={data?.assignedApisCount ?? 0}
          subtitle="Assigned in catalog"
          icon={Key}
          color="emerald"
        />
        <StatCard
          title="Account Expiration"
          value={profile?.expiresAt ? new Date(profile.expiresAt).toLocaleDateString() : 'N/A'}
          subtitle="Contact admin for renewal"
          icon={Calendar}
          color="amber"
        />
      </div>

      {/* Quota Progress Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-white">Today's Request Quota</span>
            <span className="font-mono text-cyan-400">{dailyPct}% consumed</span>
          </div>
          <div className="w-full bg-[#0B1020] h-3 rounded-full overflow-hidden border border-[#1E2D4A]">
            <div
              style={{ width: `${dailyPct}%` }}
              className={`h-full transition-all ${
                dailyPct > 90 ? 'bg-rose-500' : dailyPct > 70 ? 'bg-amber-500' : 'bg-cyan-500'
              }`}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 font-mono">
            <span>{usage?.daily?.used?.toLocaleString()} requests used</span>
            <span>{usage?.daily?.remaining?.toLocaleString()} remaining</span>
          </div>
        </div>

        <div className="bg-[#111A2B] border border-[#1E2D4A] rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-white">Monthly Request Quota</span>
            <span className="font-mono text-blue-400">{monthlyPct}% consumed</span>
          </div>
          <div className="w-full bg-[#0B1020] h-3 rounded-full overflow-hidden border border-[#1E2D4A]">
            <div
              style={{ width: `${monthlyPct}%` }}
              className={`h-full transition-all ${
                monthlyPct > 90 ? 'bg-rose-500' : monthlyPct > 70 ? 'bg-amber-500' : 'bg-blue-500'
              }`}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 font-mono">
            <span>{usage?.monthly?.used?.toLocaleString()} requests used</span>
            <span>{usage?.monthly?.remaining?.toLocaleString()} remaining</span>
          </div>
        </div>
      </div>
    </div>
  );
};
