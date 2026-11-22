import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiRequest } from '../services/api';

interface AuthContextType {
  role: 'super_admin' | 'customer' | null;
  user: any | null;
  token: string | null;
  adminLogin: (tokens: { accessToken: string; admin: any }) => void;
  customerLogin: (data: { token: string; customer: any }) => void;
  logout: () => void;
  logoutAll: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<'super_admin' | 'customer' | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Check saved sessions
      const adminToken = localStorage.getItem('arjun_admin_token');
      const adminUser = localStorage.getItem('arjun_admin_user');
      const custToken = localStorage.getItem('arjun_customer_token');
      const custUser = localStorage.getItem('arjun_customer_user');

      if (adminToken && adminUser) {
        try {
          // Check JWT expiry
          const payloadPart = adminToken.split('.')[1];
          if (payloadPart) {
            const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(
              atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
            );
            const payload = JSON.parse(jsonPayload);
            if (payload.exp && payload.exp * 1000 < Date.now()) {
              clearAdminStorage();
              setIsLoading(false);
              return;
            }
          }

          // Verify server-side session validity
          const meRes = await apiRequest('/api/v1/admin/auth/me', {}, 'admin');
          if (meRes.success && meRes.data?.admin) {
            setRole('super_admin');
            setToken(adminToken);
            setUser(meRes.data.admin);
          } else {
            // Server rejected session (e.g. revoked, expired, or logged out on server)
            clearAdminStorage();
          }
        } catch {
          clearAdminStorage();
        }
      } else if (custToken && custUser) {
        setRole('customer');
        setToken(custToken);
        setUser(JSON.parse(custUser));
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const clearAdminStorage = () => {
    localStorage.removeItem('arjun_admin_token');
    localStorage.removeItem('arjun_admin_user');
    setRole(null);
    setUser(null);
    setToken(null);
  };

  const adminLogin = (data: { accessToken: string; admin: any }) => {
    localStorage.setItem('arjun_admin_token', data.accessToken);
    localStorage.setItem('arjun_admin_user', JSON.stringify(data.admin));
    localStorage.removeItem('arjun_customer_token');
    localStorage.removeItem('arjun_customer_user');
    setToken(data.accessToken);
    setUser(data.admin);
    setRole('super_admin');
  };

  const customerLogin = (data: { token: string; customer: any }) => {
    localStorage.setItem('arjun_customer_token', data.token);
    localStorage.setItem('arjun_customer_user', JSON.stringify(data.customer));
    localStorage.removeItem('arjun_admin_token');
    localStorage.removeItem('arjun_admin_user');
    setToken(data.token);
    setUser(data.customer);
    setRole('customer');
  };

  const logout = async () => {
    try {
      if (role === 'super_admin') {
        await apiRequest('/api/v1/admin/auth/logout', { method: 'POST' }, 'admin');
      }
    } catch {
      // Ignore network errors
    } finally {
      localStorage.removeItem('arjun_admin_token');
      localStorage.removeItem('arjun_admin_user');
      localStorage.removeItem('arjun_customer_token');
      localStorage.removeItem('arjun_customer_user');
      setRole(null);
      setUser(null);
      setToken(null);
    }
  };

  const logoutAll = async () => {
    try {
      if (role === 'super_admin') {
        await apiRequest('/api/v1/admin/auth/logout-all', { method: 'POST' }, 'admin');
      }
    } catch {
      // Ignore network errors
    } finally {
      clearAdminStorage();
    }
  };

  return (
    <AuthContext.Provider value={{ role, user, token, adminLogin, customerLogin, logout, logoutAll, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
