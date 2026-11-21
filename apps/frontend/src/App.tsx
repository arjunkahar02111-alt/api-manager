import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CommandPalette } from './components/CommandPalette';
import { Login } from './pages/Login';
import { LoadingBrand } from './components/branding';

// Admin Pages
import { AdminOverview } from './pages/admin/Overview';
import { AdminCustomers } from './pages/admin/Customers';
import { AdminApis } from './pages/admin/Apis';
import { AdminSubscriptions } from './pages/admin/Subscriptions';
import { AdminPayments } from './pages/admin/Payments';
import { AdminAnalytics } from './pages/admin/Analytics';
import { AdminLogs } from './pages/admin/Logs';
import { AdminHealth } from './pages/admin/Health';
import { AdminTickets } from './pages/admin/Tickets';
import { AdminSystem } from './pages/admin/System';
import { AdminBackups } from './pages/admin/Backups';
import { AdminAudit } from './pages/admin/Audit';
import { AdminMaintenance } from './pages/admin/Maintenance';
import { AdminSecurityMonitor } from './pages/admin/SecurityMonitor';
import { AdminHosting } from './pages/admin/Hosting';
import { AdminAnnouncements } from './pages/admin/Announcements';
import { AdminDistribution } from './pages/admin/Distribution';
import { AdminResponseStudio } from './pages/admin/ResponseStudio';

export const App: React.FC = () => {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingBrand message="Initializing Karvion Administrator Control Center..." />;
  }

  // Unauthenticated -> Admin Clearance Login
  if (!role || role !== 'super_admin') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Administrator Control Center (Sole Platform Interface)
  return (
    <UIProvider>
      <div className="flex min-h-screen bg-[#050508] text-[#F5F3FA] selection:bg-[#A020F0] selection:text-white">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/admin/overview" element={<AdminOverview />} />
              <Route path="/admin/security" element={<AdminSecurityMonitor />} />
              <Route path="/admin/hosting" element={<AdminHosting />} />
              <Route path="/admin/customers" element={<AdminCustomers />} />
              <Route path="/admin/distribution" element={<AdminDistribution />} />
              <Route path="/admin/announcements" element={<AdminAnnouncements />} />
              <Route path="/admin/response-studio" element={<AdminResponseStudio />} />
              <Route path="/admin/apis" element={<AdminApis />} />
              <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
              <Route path="/admin/payments" element={<AdminPayments />} />
              <Route path="/admin/analytics" element={<AdminAnalytics />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/health" element={<AdminHealth />} />
              <Route path="/admin/tickets" element={<AdminTickets />} />
              <Route path="/admin/system" element={<AdminSystem />} />
              <Route path="/admin/backups" element={<AdminBackups />} />
              <Route path="/admin/audit" element={<AdminAudit />} />
              <Route path="/admin/maintenance" element={<AdminMaintenance />} />
              <Route path="*" element={<Navigate to="/admin/overview" replace />} />
            </Routes>
          </main>
        </div>
        <CommandPalette />
      </div>
    </UIProvider>
  );
};
