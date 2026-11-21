import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUI } from '../context/UIContext';
import { useRealtime } from '../context/RealtimeContext';
import { BrandLogo } from './branding';
import { NotificationCenter } from './NotificationCenter';
import {
  LogOut,
  Shield,
  Terminal,
  Menu,
  X,
  Search,
  Bell,
  Wifi,
  WifiOff,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const { mobileMenuOpen, toggleMobileMenu, toggleCommandPalette, unreadCount, isOnline } = useUI();
  const { isConnected: isRealtimeConnected } = useRealtime();
  const [showNotifications, setShowNotifications] = useState(false);

  const dashboardLink = role === 'super_admin' ? '/admin/overview' : '/customer/overview';

  return (
    <header className="h-16 bg-[#08060D] border-b-2 border-[#1F1930] px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 select-none font-mono">
      {/* Left: Mobile Hamburger & Brand Identity */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Mobile menu toggle (visible on < lg) */}
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden p-2 text-[#A39BAD] hover:text-white bg-[#100D17] border border-[#262035] hover:border-[#A020F0] transition-colors rounded-none"
          title={mobileMenuOpen ? 'Close Navigation' : 'Open Navigation'}
          aria-label="Toggle navigation drawer"
        >
          {mobileMenuOpen ? <X className="w-4 h-4 text-[#A020F0]" /> : <Menu className="w-4 h-4 text-[#F5F3FA]" />}
        </button>

        <div className="hidden sm:block lg:hidden">
          <BrandLogo
            variant="compact"
            size="sm"
            to={dashboardLink}
          />
        </div>

        <div className="hidden lg:block">
          <BrandLogo
            variant="horizontal"
            size="sm"
            to={dashboardLink}
            subtitle={role === 'super_admin' ? 'ENTERPRISE SOC' : 'DEVELOPER CONSOLE'}
          />
        </div>

        {/* Live Network & Gateway Indicator */}
        <div className="flex items-center gap-2.5">
          <span className="flex h-2 w-2 rounded-full bg-[#A020F0] animate-pulse shadow-[0_0_8px_#A020F0]" />
          <span className="text-[11px] font-bold text-white tracking-[0.14em] uppercase font-mono hidden xs:inline">
            GATEWAY // ONLINE
          </span>

          {/* Real-time socket sync pill */}
          <span
            className={`hidden md:inline-flex items-center gap-1.5 text-[9px] px-2 py-0.5 border ${
              isRealtimeConnected
                ? 'bg-[#0A2614] border-[#10B981] text-[#10B981]'
                : 'bg-[#261E0A] border-[#D97706] text-[#F59E0B]'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${isRealtimeConnected ? 'bg-[#10B981] animate-pulse' : 'bg-[#F59E0B]'}`} />
            {isRealtimeConnected ? 'REAL-TIME LIVE' : 'SYNCING'}
          </span>
        </div>
      </div>

      {/* Center: Command Palette Trigger Button (Ctrl+K) */}
      <div className="hidden md:flex items-center">
        <button
          onClick={toggleCommandPalette}
          className="flex items-center gap-2.5 bg-[#100D17] hover:bg-[#161022] text-[#A39BAD] hover:text-white px-3.5 py-1.5 border border-[#262035] hover:border-[#A020F0] text-xs transition-colors rounded-none shadow-sm"
          title="Search pages, commands, APIs (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-[#A020F0]" />
          <span className="text-[11px]">Command Palette...</span>
          <kbd className="text-[9px] bg-[#1F1930] px-1.5 py-0.5 border border-[#2C2344] text-[#A39BAD]">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Notifications, User Clearance & Sign Out */}
      <div className="flex items-center gap-2 sm:gap-3.5 relative">
        {/* Mobile Search Button */}
        <button
          onClick={toggleCommandPalette}
          className="md:hidden p-2 text-[#A39BAD] hover:text-white bg-[#100D17] border border-[#262035] transition-colors rounded-none"
          title="Search"
          aria-label="Open command palette"
        >
          <Search className="w-4 h-4 text-[#A020F0]" />
        </button>

        {/* Notification Bell Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications((prev) => !prev)}
            className="p-2 text-[#A39BAD] hover:text-white bg-[#100D17] hover:bg-[#1A1328] border border-[#262035] hover:border-[#A020F0] transition-colors rounded-none relative"
            title="System Alerts"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#A020F0] text-white text-[9px] font-bold flex items-center justify-center rounded-none shadow-[0_0_8px_#A020F0]">
                {unreadCount}
              </span>
            )}
          </button>

          <NotificationCenter
            isOpen={showNotifications}
            onClose={() => setShowNotifications(false)}
          />
        </div>

        {/* User Identity Chip */}
        <div className="flex items-center gap-2.5 bg-[#100D17] px-2.5 sm:px-3.5 py-1.5 border-2 border-[#262035] shadow-sm">
          {role === 'super_admin' ? (
            <Shield className="w-4 h-4 text-[#A020F0] shrink-0" />
          ) : (
            <Terminal className="w-4 h-4 text-[#C77DFF] shrink-0" />
          )}
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono truncate max-w-[90px] sm:max-w-[130px]">
              {user?.username || (role === 'super_admin' ? 'Super Admin' : 'Customer')}
            </span>
            <span className="text-[8px] sm:text-[9px] text-[#A39BAD] uppercase font-mono tracking-widest hidden xs:inline">
              {role === 'super_admin' ? 'ROOT CLEARANCE' : user?.keyPrefix || 'CLIENT KEY'}
            </span>
          </div>
        </div>

        {/* Sign Out Button */}
        <button
          onClick={logout}
          className="p-2 text-[#A39BAD] hover:text-white bg-[#100D17] hover:bg-[#1A1328] border-2 border-[#262035] hover:border-[#A020F0] transition-colors rounded-none"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
