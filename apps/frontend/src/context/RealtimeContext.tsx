import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

export interface RealtimeEvent {
  type: string;
  payload: any;
  timestamp: number;
}

interface RealtimeContextType {
  socket: Socket | null;
  isConnected: boolean;
  lastEvent: RealtimeEvent | null;
}

const RealtimeContext = createContext<RealtimeContextType>({
  socket: null,
  isConnected: false,
  lastEvent: null,
});

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Only connect when user is authenticated as super_admin
    if (role !== 'super_admin') {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    const host = typeof window !== 'undefined' ? window.location.origin : '';
    const socket = io(host, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('subscribe:admin');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    const handleIncoming = (type: string) => (payload: any) => {
      setLastEvent({
        type,
        payload,
        timestamp: Date.now(),
      });
    };

    // Client Lifecycle Events
    socket.on('client:created', handleIncoming('client:created'));
    socket.on('client:updated', handleIncoming('client:updated'));
    socket.on('client:deleted', handleIncoming('client:deleted'));

    // Platform & Announcement Events
    socket.on('announcement:changed', handleIncoming('announcement:changed'));
    socket.on('api:changed', handleIncoming('api:changed'));
    socket.on('system:metrics', handleIncoming('system:metrics'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [role]);

  return (
    <RealtimeContext.Provider value={{ socket: socketRef.current, isConnected, lastEvent }}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);
