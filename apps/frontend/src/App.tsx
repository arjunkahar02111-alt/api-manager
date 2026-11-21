import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { CustomerSidebar } from './components/CustomerSidebar';
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

// Customer Pages
import { CustomerOverview } from './pages/customer/Overview';
import { CustomerSecurity } from './pages/customer/Security';
import { CustomerApis } from './pages/customer/Apis';
import { CustomerPlayground } from './pages/customer/Playground';
import { CustomerIpAllowlist } from './pages/customer/IpAllowlist';
import { CustomerUsage } from './pages/customer/Usage';
import { CustomerLogs } from './pages/customer/Logs';
import { CustomerTickets } from './pages/customer/Tickets';
import { CustomerWebhooks } from './pages/customer/Webhooks';

export const App: React.FC = () => {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingBrand message="Initializing Karvion API Manager..." />;
  }

  // Unauthenticated -> Login
  if (!role) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Customer Portal
  if (role === 'customer') {
    return (
      <div className="flex min-h-screen bg-[#050508] text-[#F5F3FA]">
        <CustomerSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/customer/overview" element={<CustomerOverview />} />
              <Route path="/customer/security" element={<CustomerSecurity />} />
              <Route path="/customer/apis" element={<CustomerApis />} />
              <Route path="/customer/playground" element={<CustomerPlayground />} />
              <Route path="/customer/ip-allowlist" element={<CustomerIpAllowlist />} />
              <Route path="/customer/usage" element={<CustomerUsage />} />
              <Route path="/customer/logs" element={<CustomerLogs />} />
              <Route path="/customer/tickets" element={<CustomerTickets />} />
              <Route path="/customer/webhooks" element={<CustomerWebhooks />} />
              <Route path="*" element={<Navigate to="/customer/overview" replace />} />
            </Routes>
          </main>
        </div>
      </div>
    );
  }

  // Super Admin Portal
  return (
    <div className="flex min-h-screen bg-[#050508] text-[#F5F3FA]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/admin/overview" element={<AdminOverview />} />
            <Route path="/admin/security" element={<AdminSecurityMonitor />} />
            <Route path="/admin/hosting" element={<AdminHosting />} />
            <Route path="/admin/customers" element={<AdminCustomers />} />
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
    </div>
  );
};
