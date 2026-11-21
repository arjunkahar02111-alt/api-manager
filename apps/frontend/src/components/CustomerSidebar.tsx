import React from 'react';
import { NavLink } from 'react-router-dom';
import { SidebarBrand } from './branding';
import {
  LayoutDashboard,
  ShieldCheck,
  Layers,
  Terminal,
  Globe,
  BarChart3,
  History,
  LifeBuoy,
  Zap,
} from 'lucide-react';

export const CustomerSidebar: React.FC = () => {
  const links = [
    { to: '/customer/overview', label: 'Overview', icon: LayoutDashboard },
    { to: '/customer/security', label: 'Security & 2FA', icon: ShieldCheck },
    { to: '/customer/apis', label: 'API Catalog', icon: Layers },
    { to: '/customer/playground', label: 'API Playground', icon: Terminal },
    { to: '/customer/ip-allowlist', label: 'IP Allowlist', icon: Globe },
    { to: '/customer/usage', label: 'Usage & Quotas', icon: BarChart3 },
    { to: '/customer/logs', label: 'Request Logs', icon: History },
    { to: '/customer/tickets', label: 'Support Tickets', icon: LifeBuoy },
    { to: '/customer/webhooks', label: 'Webhooks', icon: Zap },
  ];

  return (
    <aside className="w-64 bg-[#050508] border-r-2 border-[#1F1930] flex flex-col shrink-0 min-h-screen">
      <div className="h-18 flex items-center px-4 border-b-2 border-[#1F1930] bg-[#08060D]">
        <SidebarBrand to="/customer/overview" />
      </div>

      <div className="px-6 py-4">
        <span className="text-[11px] font-bold text-[#A39BAD] tracking-[0.14em] uppercase font-mono">
          Developer Portal
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto pb-6 font-mono">
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
