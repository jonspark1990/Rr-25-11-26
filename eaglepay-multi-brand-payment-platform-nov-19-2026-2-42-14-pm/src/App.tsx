import React, { useEffect, useState } from 'react';
import { api, clearAuthToken, getAuthToken, getCachedUser, setCachedUser } from './services/api.js';
import { AdminUser } from './types/index.js';
import { AdminLayout } from './components/AdminLayout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CustomersPage } from './pages/CustomersPage.js';
import { PaymentLinksPage } from './pages/PaymentLinksPage.js';
import { TransactionsPage } from './pages/TransactionsPage.js';
import { BrandsPage } from './pages/BrandsPage.js';
import { GatewayAccountsPage } from './pages/GatewayAccountsPage.js';
import { WebhooksPage } from './pages/WebhooksPage.js';
import { ReportsPage } from './pages/ReportsPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';
import { TestRunnerPage } from './pages/TestRunnerPage.js';
import { DocumentationPage } from './pages/DocumentationPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { PublicCheckoutPage } from './pages/PublicCheckoutPage.js';
import { PublicHomePage } from './pages/PublicHomePage.js';
import { RefreshCw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AdminUser | null>(() => getCachedUser());
  const [loadingAuth, setLoadingAuth] = useState(() => !getCachedUser());
  const [activeTab, setActiveTab] = useState('dashboard');
  const [previewCheckout, setPreviewCheckout] = useState<{ token: string; brandSlug?: string } | null>(null);
  const [, setLocationTick] = useState(0);

  useEffect(() => {
    const onPopState = () => setLocationTick((n) => n + 1);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/';
  const isAdminRoute = normalizedPath === '/admin/aps' || normalizedPath.startsWith('/admin/aps/');

  // Robust checkout token parser for all URL formats
  const parseCheckoutRoute = () => {
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash || '';

    // Never treat /admin/aps as a checkout link
    if (pathname === '/admin/aps' || pathname.startsWith('/admin/aps/') || pathname.startsWith('/admin/')) {
      return { isPublicCheckout: false, brandSlug: '', token: '' };
    }

    // Check query params: ?pay=PAY... or ?token=PAY... or ?link=PAY...
    const qToken = searchParams.get('pay') || searchParams.get('token') || searchParams.get('link');
    const qBrand = searchParams.get('brand') || '';
    if (qToken) {
      return { isPublicCheckout: true, token: qToken.trim(), brandSlug: qBrand.trim() };
    }

    // Check hash: #/pay/PAY... or #PAY...
    if (hash.includes('PAY')) {
      const match = hash.match(/PAY[A-Z0-9]+/i);
      if (match) {
        return { isPublicCheckout: true, token: match[0].toUpperCase(), brandSlug: '' };
      }
    }

    const pathParts = pathname.split('/').filter(Boolean);
    const reserved = ['api', 'webhooks', 'assets', 'static', 'install', 'cron', 'admin', '__sandbox_gateway_simulator'];

    // Format 1: /:brandSlug/pay/:token (e.g. /samvit/pay/PAYPVSYYM)
    if (pathParts.length === 3 && pathParts[1] === 'pay' && !reserved.includes(pathParts[0])) {
      return { isPublicCheckout: true, brandSlug: pathParts[0], token: pathParts[2] };
    }

    // Format 2: /pay/:brandSlug/:token (3 parts)
    if (pathParts.length === 3 && pathParts[0] === 'pay') {
      return { isPublicCheckout: true, brandSlug: pathParts[1], token: pathParts[2] };
    }

    // Format 3: /pay/:token (2 parts)
    if (pathParts.length === 2 && pathParts[0] === 'pay') {
      return { isPublicCheckout: true, brandSlug: '', token: pathParts[1] };
    }

    // Format 4: /:brandSlug/:token (2 parts, if first part not reserved)
    if (pathParts.length === 2 && !reserved.includes(pathParts[0])) {
      return { isPublicCheckout: true, brandSlug: pathParts[0], token: pathParts[1] };
    }

    // Format 5: /:token (1 part, e.g. /PAYPVSYYM)
    if (pathParts.length === 1 && (pathParts[0].startsWith('PAY') || /^PAY[A-Z0-9]+$/i.test(pathParts[0]))) {
      return { isPublicCheckout: true, brandSlug: '', token: pathParts[0] };
    }

    return { isPublicCheckout: false, brandSlug: '', token: '' };
  };

  const routeInfo = parseCheckoutRoute();
  const isPublicCheckout = routeInfo.isPublicCheckout || Boolean(previewCheckout);
  const activeCheckoutToken = previewCheckout?.token || routeInfo.token;
  const activeCheckoutBrand = previewCheckout?.brandSlug || routeInfo.brandSlug;

  useEffect(() => {
    // Listen for custom in-app checkout preview requests
    const handleOpenPreview = (e: any) => {
      if (e.detail?.token) {
        setPreviewCheckout({
          token: e.detail.token,
          brandSlug: e.detail.brandSlug || '',
        });
      }
    };
    window.addEventListener('open:checkout', handleOpenPreview);
    return () => window.removeEventListener('open:checkout', handleOpenPreview);
  }, []);

  useEffect(() => {
    // Only check admin session when accessing /admin/aps
    if (isAdminRoute && !isPublicCheckout) {
      const token = getAuthToken();
      if (!token) {
        setCurrentUser(null);
        setLoadingAuth(false);
        return;
      }

      api
        .getMe()
        .then((res) => {
          if (res.success && res.user) {
            setCurrentUser(res.user);
            setCachedUser(res.user);
          }
        })
        .catch((err) => {
          // If 401 Unauthorized explicitly returned
          if (err && String(err.message).includes('401')) {
            clearAuthToken();
            setCurrentUser(null);
          }
        })
        .finally(() => setLoadingAuth(false));
    } else {
      setLoadingAuth(false);
    }

    const handleExpired = () => {
      clearAuthToken();
      setCurrentUser(null);
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [isAdminRoute, isPublicCheckout]);

  // If customer is on a branded checkout link or in-app preview
  if (isPublicCheckout && activeCheckoutToken) {
    return (
      <PublicCheckoutPage
        brandSlug={activeCheckoutBrand}
        token={activeCheckoutToken}
        onBackToAdmin={
          currentUser || previewCheckout
            ? () => {
                setPreviewCheckout(null);
                if (window.location.pathname !== '/admin/aps') {
                  window.history.pushState({}, '', '/admin/aps');
                  setLocationTick((n) => n + 1);
                }
              }
            : undefined
        }
      />
    );
  }

  // Show informational loan recovery homepage for root / and any non-admin public path
  if (!isAdminRoute) {
    return <PublicHomePage />;
  }

  if (loadingAuth && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw size={28} className="animate-spin text-teal-400" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LoginPage
        onSuccess={(user) => {
          setCurrentUser(user);
          setCachedUser(user);
        }}
      />
    );
  }

  const isFullAdmin = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const perms = new Set(currentUser.permissions || []);

  const hasPerm = (requiredPerm: string) => {
    if (isFullAdmin) return true;
    return perms.has(requiredPerm);
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
      case 'customers':
        if (!hasPerm('customers:view') && !hasPerm('customers')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <CustomersPage />;
      case 'payment-links':
        if (!hasPerm('links:view') && !hasPerm('links')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <PaymentLinksPage />;
      case 'transactions':
        if (!hasPerm('links:view') && !hasPerm('links')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <TransactionsPage />;
      case 'brands':
        if (!hasPerm('templates:manage') && !hasPerm('templates')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <BrandsPage />;
      case 'gateway-accounts':
        if (!hasPerm('gateways:manage') && !hasPerm('gateways')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <GatewayAccountsPage />;
      case 'webhooks':
        if (!hasPerm('gateways:manage') && !hasPerm('gateways')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <WebhooksPage />;
      case 'reports':
        if (!hasPerm('analytics:view') && !hasPerm('analytics')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <ReportsPage />;
      case 'audit-logs':
        if (!hasPerm('audit_logs:view') && !hasPerm('audit_logs')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <AuditLogsPage />;
      case 'tests':
        if (!isFullAdmin) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return <TestRunnerPage />;
      case 'settings':
        if (!isFullAdmin && !hasPerm('system:settings')) {
          return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
        }
        return (
          <SettingsPage
            currentUser={currentUser}
            onUpdateCurrentUser={(updated) => {
              setCurrentUser(updated);
              setCachedUser(updated);
            }}
          />
        );
      case 'docs':
        return <DocumentationPage />;
      default:
        return <DashboardPage onNavigate={(tab) => setActiveTab(tab)} />;
    }
  };

  return (
    <AdminLayout
      user={currentUser}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      onLogout={() => {
        api.logout().catch(() => {});
        clearAuthToken();
        setCurrentUser(null);
      }}
    >
      {renderActiveTabContent()}
    </AdminLayout>
  );
}
