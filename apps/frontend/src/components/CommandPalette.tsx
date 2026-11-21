import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import {
  Search,
  X,
  LayoutDashboard,
  ShieldAlert,
  Server,
  Layers,
  Key,
  History,
  HeartPulse,
  Cpu,
  BarChart3,
  CreditCard,
  FileText,
  LifeBuoy,
  Database,
  Activity,
  AlertTriangle,
  ShieldCheck,
  Terminal,
  Globe,
  Zap,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'APIs';
  path?: string;
  action?: () => void;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}

export const CommandPalette: React.FC = () => {
  const { role } = useAuth();
  const { commandPaletteOpen, setCommandPaletteOpen } = useUI();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const adminCommands: CommandItem[] = [
    { id: 'a-overview', title: 'System Overview & SOC', category: 'Navigation', path: '/admin/overview', icon: LayoutDashboard },
    { id: 'a-security', title: 'Security Monitor & Live Traffic', category: 'Navigation', path: '/admin/security', icon: ShieldAlert, hint: 'SSE Stream' },
    { id: 'a-hosting', title: 'Application Hosting & Deployments', category: 'Navigation', path: '/admin/hosting', icon: Server, hint: 'Node / Python / PHP' },
    { id: 'a-apis', title: 'API Catalog & 1-Click Connector', category: 'Navigation', path: '/admin/apis', icon: Layers, hint: 'Proxy' },
    { id: 'a-customers', title: 'Client Accounts & API Keys', category: 'Navigation', path: '/admin/customers', icon: Key, hint: 'Quotas' },
    { id: 'a-logs', title: 'Universal Gateway Logs', category: 'Navigation', path: '/admin/logs', icon: History },
    { id: 'a-health', title: 'Health Telemetry & Probes', category: 'Navigation', path: '/admin/health', icon: HeartPulse },
    { id: 'a-system', title: 'System Resources & Metrics', category: 'Navigation', path: '/admin/system', icon: Cpu, hint: 'CPU/RAM' },
    { id: 'a-analytics', title: 'Traffic Analytics & Aggregates', category: 'Navigation', path: '/admin/analytics', icon: BarChart3 },
    { id: 'a-subscriptions', title: 'Subscription Plans & Tiers', category: 'Navigation', path: '/admin/subscriptions', icon: CreditCard },
    { id: 'a-payments', title: 'Manual Payments & Invoicing', category: 'Navigation', path: '/admin/payments', icon: FileText },
    { id: 'a-tickets', title: 'Customer Support Tickets', category: 'Navigation', path: '/admin/tickets', icon: LifeBuoy },
    { id: 'a-backups', title: 'Database Backups & Restore', category: 'Navigation', path: '/admin/backups', icon: Database },
    { id: 'a-audit', title: 'Tamper-Resistant Audit Trail', category: 'Navigation', path: '/admin/audit', icon: Activity },
    { id: 'a-maintenance', title: 'Maintenance Mode Controller', category: 'Navigation', path: '/admin/maintenance', icon: AlertTriangle },
  ];

  const customerCommands: CommandItem[] = [
    { id: 'c-overview', title: 'Developer Overview', category: 'Navigation', path: '/customer/overview', icon: LayoutDashboard },
    { id: 'c-security', title: 'Security Center & 2FA', category: 'Navigation', path: '/customer/security', icon: ShieldCheck, hint: 'TOTP' },
    { id: 'c-apis', title: 'API Documentation & Endpoints', category: 'Navigation', path: '/customer/apis', icon: Layers },
    { id: 'c-playground', title: 'Interactive API Testing Playground', category: 'Navigation', path: '/customer/playground', icon: Terminal, hint: 'cURL / JS' },
    { id: 'c-ip', title: 'IP Allowlist Registry', category: 'Navigation', path: '/customer/ip-allowlist', icon: Globe },
    { id: 'c-usage', title: 'Usage Metrics & Quota Tracking', category: 'Navigation', path: '/customer/usage', icon: BarChart3 },
    { id: 'c-logs', title: 'Personal Request History Logs', category: 'Navigation', path: '/customer/logs', icon: History },
    { id: 'c-tickets', title: 'Developer Support Tickets', category: 'Navigation', path: '/customer/tickets', icon: LifeBuoy },
    { id: 'c-webhooks', title: 'Webhook Subscriptions & Delivery', category: 'Navigation', path: '/customer/webhooks', icon: Zap },
  ];

  const allCommands = role === 'super_admin' ? adminCommands : customerCommands;

  const filtered = allCommands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return cmd.title.toLowerCase().includes(q) || cmd.category.toLowerCase().includes(q) || (cmd.hint && cmd.hint.toLowerCase().includes(q));
  });

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [commandPaletteOpen]);

  // Keyboard navigation inside list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        executeCommand(filtered[selectedIndex]);
      }
    }
  };

  const executeCommand = (cmd: CommandItem) => {
    setCommandPaletteOpen(false);
    if (cmd.path) {
      navigate(cmd.path);
    } else if (cmd.action) {
      cmd.action();
    }
  };

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#08060D] border-2 border-[#A020F0] shadow-[0_0_40px_rgba(160,32,240,0.35)] rounded-none overflow-hidden flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="p-4 bg-[#100D17] border-b-2 border-[#1F1930] flex items-center gap-3">
          <Search className="w-5 h-5 text-[#A020F0] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search commands, pages, APIs, tools... (or use ↑ ↓ to navigate)"
            className="flex-1 bg-transparent text-sm text-[#F5F3FA] placeholder-[#A39BAD] focus:outline-none tracking-wide"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-[#A39BAD] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] bg-[#1F1930] text-[#A39BAD] border border-[#2C2344]">
            ESC to close
          </span>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-[#1F1930]/60">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#A39BAD] uppercase tracking-wider">
              No matching commands or routes found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => executeCommand(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 cursor-pointer text-xs transition-colors rounded-none ${
                    isSelected
                      ? 'bg-[#140F22] text-white border-l-4 border-[#A020F0]'
                      : 'text-[#A39BAD] hover:bg-[#0E0A1A] hover:text-white border-l-4 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-[#A020F0]' : 'text-[#7B2FFF]'}`} />
                    <span className="font-bold tracking-wide">{item.title}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.hint && (
                      <span className="text-[10px] bg-[#1F1930] text-[#C77DFF] px-2 py-0.5 border border-[#2C2344] uppercase">
                        {item.hint}
                      </span>
                    )}
                    <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isSelected ? 'translate-x-1 text-[#A020F0]' : 'opacity-0'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info rubric */}
        <div className="p-2.5 bg-[#050508] border-t border-[#1F1930] flex items-center justify-between text-[10px] text-[#A39BAD]">
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A020F0] shadow-[0_0_6px_#A020F0]" />
            KARVION ENTERPRISE COMMAND PALETTE
          </span>
          <span className="hidden sm:inline">Press ENTER to select • TAB to cycle</span>
        </div>
      </div>
    </div>
  );
};
