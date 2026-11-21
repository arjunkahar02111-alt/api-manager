import React from 'react';
import { NavLink } from 'react-router-dom';
import { SidebarBrand } from './branding';
import {
  LayoutDashboard,
  Key,
  Layers,
  Activity,
  CreditCard,
  BarChart3,
  FileText,
  HeartPulse,
  LifeBuoy,
  Cpu,
  Database,
  History,
  AlertTriangle,
  ShieldAlert,
  Server,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const links = [
    { to: '/admin/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/admin/security', label: 'Security & Live Monitor', icon: ShieldAlert },
    { to: '/admin/hosting', label: 'App Hosting & Deploy', icon: Server },
    { to: '/admin/apis', label: 'Main APIs & Connector', icon: Layers },
    { to: '/admin/customers', label: 'Client Keys & Quotas', icon: Key },
    { to: '/admin/logs', label: 'Gateway Logs', icon: History },
    { to: '/admin/health', label: 'Health Telemetry', icon: HeartPulse },
    { to: '/admin/system', label: 'System Monitor', icon: Cpu },
    { to: '/admin/analytics', label: 'Traffic Analytics', icon: BarChart3 },
    { to: '/admin/subscriptions', label: 'Plans & Pricing', icon: CreditCard },
    { to: '/admin/payments', label: 'Manual Payments', icon: FileText },
    { to: '/admin/tickets', label: 'Support Tickets', icon: LifeBuoy },
    { to: '/admin/backups', label: 'Database Backups', icon: Database },
    { to: '/admin/audit', label: 'Audit Trail', icon: Activity },
    { to: '/admin/maintenance', label: 'Maintenance Mode', icon: AlertTriangle },
  ];

  return (
    <aside className="w-64 bg-[#050508] border-r-2 border-[#1F1930] flex flex-col shrink-0 min-h-screen">
      <div className="h-18 flex items-center px-4 border-b-2 border-[#1F1930] bg-[#08060D]">
        <SidebarBrand to="/admin/overview" />
      </div>

      <div className="px-6 py-4">
        <span className="text-[11px] font-bold text-[#A39BAD] tracking-[0.14em] uppercase font-mono">
          Administration // SOC
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-6">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-none ${
                  isActive
                    ? 'bg-[#140F22] text-white border-l-4 border-[#A020F0] border-y border-r border-[#2C2344]'
                    : 'text-[#A39BAD] hover:bg-[#0E0A1A] hover:text-white border-l-4 border-transparent'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0 text-[#C77DFF]" />
              <span>{link.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};
