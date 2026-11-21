import React, { createContext, useContext, useState, useEffect } from 'react';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'security' | 'gateway' | 'deploy' | 'system';
  timestamp: string;
  read: boolean;
  link?: string;
}

interface UIContextType {
  // Mobile Navigation Drawer
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  toggleMobileMenu: () => void;
  closeMobileMenu: () => void;

  // Global Command Palette (Ctrl+K / Cmd+K)
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;

  // Real-time Notifications
  notifications: NotificationItem[];
  unreadCount: number;
  markAllNotificationsAsRead: () => void;
  dismissNotification: (id: string) => void;
  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => void;

  // Network Connectivity
  isOnline: boolean;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Gateway Active',
    message: 'Universal Gateway proxy engine is running with TLS 1.3 encryption.',
    category: 'gateway',
    timestamp: 'Just now',
    read: false,
    link: '/admin/overview',
  },
  {
    id: 'notif-2',
    title: 'Anti-Key Sharing Armed',
    message: 'Multi-IP auto-locking and single-user session protocols are active.',
    category: 'security',
    timestamp: '10m ago',
    read: false,
    link: '/admin/security',
  },
  {
    id: 'notif-3',
    title: 'Vehicle Intelligence (vehicle2-n) Online',
    message: 'RootX Vehicle OSINT & Vehicle2-N endpoints verified in catalog.',
    category: 'system',
    timestamp: '25m ago',
    read: true,
    link: '/admin/apis',
  },
];

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Keyboard shortcut listener: Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette on Ctrl+K / Cmd+K
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }

      // Close overlays on Escape
      if (e.key === 'Escape') {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, mobileMenuOpen]);

  // Online / Offline network status listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const toggleCommandPalette = () => setCommandPaletteOpen((prev) => !prev);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const addNotification = (notif: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => {
    const newEntry: NotificationItem = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: 'Just now',
      read: false,
    };
    setNotifications((prev) => [newEntry, ...prev]);
  };

  return (
    <UIContext.Provider
      value={{
        mobileMenuOpen,
        setMobileMenuOpen,
        toggleMobileMenu,
        closeMobileMenu,
        commandPaletteOpen,
        setCommandPaletteOpen,
        toggleCommandPalette,
        notifications,
        unreadCount,
        markAllNotificationsAsRead,
        dismissNotification,
        addNotification,
        isOnline,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
