import React from 'react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './branding';
import { LogOut, Shield, Terminal, Activity } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, role, logout } = useAuth();
  const dashboardLink = role === 'super_admin' ? '/admin/overview' : '/customer/overview';

  return (
    <header className="h-16 bg-[#08060D] border-b-2 border-[#1F1930] px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30 select-none">
      {/* Left: Brand Identity / Gateway Status */}
      <div className="flex items-center gap-5">
        <div className="hidden lg:block">
          <BrandLogo
            variant="horizontal"
            size="sm"
            to={dashboardLink}
            subtitle={role === 'super_admin' ? 'ENTERPRISE SOC' : 'DEVELOPER CONSOLE'}
          />
        </div>

        <div className="flex items-center gap-3">
          <span className="flex h-2 w-2 rounded-full bg-[#A020F0] animate-pulse shadow-[0_0_8px_#A020F0]" />
          <span className="text-[11px] font-bold text-white tracking-[0.14em] uppercase font-mono">
            GATEWAY // ONLINE
          </span>
          <span className="text-[10px] text-[#A39BAD] font-mono border-l border-[#262035] pl-3 hidden sm:inline">
            api.karviontechnologies.in
          </span>
        </div>
      </div>

      {/* Right: User Clearance & Action */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5 bg-[#100D17] px-3.5 py-1.5 border-2 border-[#262035] shadow-sm">
          {role === 'super_admin' ? (
            <Shield className="w-4 h-4 text-[#A020F0]" />
          ) : (
            <Terminal className="w-4 h-4 text-[#C77DFF]" />
          )}
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
              {user?.username || (role === 'super_admin' ? 'Super Admin' : 'Customer')}
            </span>
            <span className="text-[9px] text-[#A39BAD] uppercase font-mono tracking-widest">
              {role === 'super_admin' ? 'ROOT CLEARANCE' : user?.keyPrefix || 'CLIENT KEY'}
            </span>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 text-[#A39BAD] hover:text-white bg-[#100D17] hover:bg-[#1A1328] border-2 border-[#262035] hover:border-[#A020F0] transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
