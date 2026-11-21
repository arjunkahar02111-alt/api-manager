import React, { useRef, useEffect } from 'react';
import { useUI } from '../context/UIContext';
import { Bell, CheckCheck, X, Shield, Activity, Server, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAllNotificationsAsRead, dismissNotification } = useUI();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'security':
        return <Shield className="w-3.5 h-3.5 text-[#A020F0]" />;
      case 'gateway':
        return <Activity className="w-3.5 h-3.5 text-[#10B981]" />;
      case 'deploy':
        return <Server className="w-3.5 h-3.5 text-[#38BDF8]" />;
      default:
        return <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />;
    }
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#08060D] border-2 border-[#A020F0] shadow-[0_0_30px_rgba(160,32,240,0.3)] z-50 font-mono text-xs rounded-none overflow-hidden animate-in fade-in duration-150"
    >
      {/* Header */}
      <div className="p-3.5 bg-[#100D17] border-b-2 border-[#1F1930] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#A020F0]" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Security & System Alerts
          </span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.2 bg-[#A020F0] text-white text-[9px] font-bold">
              {unreadCount} NEW
            </span>
          )}
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllNotificationsAsRead}
            className="text-[10px] text-[#C77DFF] hover:text-white flex items-center gap-1 uppercase transition-colors"
          >
            <CheckCheck className="w-3 h-3" />
            Mark read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-[#1F1930]">
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-[#A39BAD] text-[11px] uppercase tracking-wider">
            All system channels clear. No alerts.
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.link) {
                  navigate(n.link);
                  onClose();
                }
              }}
              className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                n.read ? 'bg-[#08060D] opacity-75 hover:opacity-100 hover:bg-[#100D17]' : 'bg-[#120D1F] hover:bg-[#161026]'
              }`}
            >
              <div className="mt-0.5 shrink-0 p-1 bg-[#1A1428] border border-[#2F2644]">
                {getCategoryIcon(n.category)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={`font-bold tracking-wide text-[11px] truncate ${n.read ? 'text-[#F5F3FA]' : 'text-white'}`}>
                    {n.title}
                  </span>
                  <span className="text-[9px] text-[#A39BAD] shrink-0">{n.timestamp}</span>
                </div>
                <p className="text-[11px] text-[#A39BAD] leading-relaxed line-clamp-2">{n.message}</p>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification(n.id);
                }}
                className="p-1 text-[#6D657A] hover:text-white transition-colors"
                title="Dismiss"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2 bg-[#050508] border-t border-[#1F1930] text-center">
        <span className="text-[10px] text-[#6D657A] uppercase tracking-wider">
          LIVE SOC STREAM // KARVION ENGINE
        </span>
      </div>
    </div>
  );
};
