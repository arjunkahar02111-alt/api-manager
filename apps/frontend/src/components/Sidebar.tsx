import React, { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { SidebarBrand } from './branding';
import { useUI } from '../context/UIContext';
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
  X,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const { mobileMenuOpen, closeMobileMenu } = useUI();
  const location = useLocation();

  // Automatically close mobile drawer when route changes
  useEffect(() => {
    closeMobileMenu();
  }, [location.pathname]);

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

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#050508] border-r-2 border-[#1F1930] font-mono select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b-2 border-[#1F1930] bg-[#08060D] shrink-0">
        <SidebarBrand to="/admin/overview" />
        <button
          onClick={closeMobileMenu}
          className="lg:hidden p-1.5 text-[#A39BAD] hover:text-white bg-[#100D17] border border-[#262035]"
          title="Close Navigation"
          aria-label="Close navigation"
        >
          <X className="w-4 h-4 text-[#A020F0]" />
        </button>
      </div>

      <div className="px-6 py-3.5 bg-[#08060D]/60 border-b border-[#1F1930]/50 shrink-0">
        <span className="text-[11px] font-bold text-[#A39BAD] tracking-[0.14em] uppercase font-mono">
          Administration // SOC
        </span>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#231E30] scrollbar-track-[#050508]">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={closeMobileMenu}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-none ${
                  isActive
                    ? 'bg-[#140F22] text-white border-l-4 border-[#A020F0] border-y border-r border-[#2C2344] shadow-[inset_0_0_15px_rgba(160,32,240,0.2)]'
                    : 'text-[#A39BAD] hover:bg-[#0E0A1A] hover:text-white border-l-4 border-transparent'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0 text-[#C77DFF]" />
              <span className="truncate">{link.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 bg-[#08060D] border-t-2 border-[#1F1930] text-[10px] text-[#6D657A] flex items-center justify-between shrink-0">
        <span>KARVION // V2.0</span>
        <span className="flex items-center gap-1.5 text-[#10B981]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          ONLINE
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 min-h-screen">
        {sidebarContent}
      </aside>

      {/* 2. Mobile / Tablet Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-300"
            onClick={closeMobileMenu}
          />

          {/* Drawer content */}
          <aside className="relative z-10 w-72 max-w-[85vw] h-full shadow-2xl animate-in slide-in-from-left duration-250">
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
};
