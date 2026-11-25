import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Link as LinkIcon,
  Receipt,
  Palette,
  CreditCard,
  Webhook,
  BarChart3,
  ShieldAlert,
  TestTube2,
  BookOpen,
  Server,
  LogOut,
  Menu,
  X,
  ExternalLink,
  ShieldCheck,
  Activity,
  Settings,
} from 'lucide-react';
import { AdminUser } from '../types/index.js';

interface AdminLayoutProps {
  user: AdminUser;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  perm?: string;
  adminOnly?: boolean;
  highlight?: boolean;
  badge?: string;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  user,
  activeTab,
  onSelectTab,
  onLogout,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isFullAdmin = user?.role === 'super_admin' || user?.role === 'admin';
  const perms = new Set(user?.permissions || []);

  const allNavigation: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers', icon: Users, perm: 'customers:view' },
    { id: 'payment-links', label: 'Payment Links', icon: LinkIcon, perm: 'links:view' },
    { id: 'transactions', label: 'Transactions', icon: Receipt, perm: 'links:view' },
    { id: 'brands', label: 'Brands & Templates', icon: Palette, perm: 'templates:manage' },
    { id: 'gateway-accounts', label: 'Gateway Accounts', icon: CreditCard, perm: 'gateways:manage' },
    { id: 'webhooks', label: 'Webhooks & Simulator', icon: Webhook, perm: 'gateways:manage' },
    { id: 'reports', label: 'Reports & Analytics', icon: BarChart3, perm: 'analytics:view' },
    { id: 'audit-logs', label: 'Audit Logs', icon: ShieldAlert, perm: 'audit_logs:view' },
    { id: 'tests', label: 'Automated Tests', icon: TestTube2, adminOnly: true },
    { id: 'settings', label: 'Settings & Team', icon: Settings, adminOnly: true },
    { id: 'docs', label: 'Documentation & Guides', icon: BookOpen },
  ];

  const navigation = allNavigation.filter((item) => {
    if (isFullAdmin) return true;
    if (item.adminOnly && !isFullAdmin) return false;
    if (item.perm && !perms.has(item.perm) && !perms.has(item.id)) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center font-black text-slate-950 text-xs tracking-tight">
            AS
          </div>
          <span className="font-bold tracking-tight text-sm">AppAssistServices</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 rounded-md text-slate-300 hover:text-white"
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen w-64 bg-slate-950 text-slate-300 flex flex-col z-30 transition-transform md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } border-r border-slate-800/80 shadow-xl`}
      >
        {/* Brand Logo & Name */}
        <div className="p-5 border-b border-slate-800/80 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center font-black text-slate-950 text-sm shadow-sm tracking-tight">
            AS
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-tight leading-tight">
              AppAssistServices
            </div>
            <div className="text-[10px] text-teal-400 font-medium tracking-wide flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
              PAYMENT PLATFORM
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30 shadow-sm'
                    : item.highlight
                    ? 'bg-slate-900/80 text-amber-300 hover:bg-slate-800/80 border border-amber-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={17}
                    className={isActive ? 'text-teal-400' : item.highlight ? 'text-amber-400' : 'text-slate-400'}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-teal-950 text-teal-400 border border-teal-800">
                    {item.badge}
                  </span>
                )}
                {item.highlight && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-800">
                    PROD
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-900/40">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-teal-300 border border-slate-700 flex items-center justify-center font-bold text-xs uppercase">
                {user.username.slice(0, 2)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-white truncate">{user.name || user.username}</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                  {user.role.replace('_', ' ')}
                </div>
              </div>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-slate-800 capitalize">
              {navigation.find((n) => n.id === activeTab)?.label || 'Dashboard'}
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Gateway Online
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 font-medium">
              {user.name || user.username} ({user.role.replace('_', ' ')})
            </div>
          </div>
        </header>

        {/* Workspace Container */}
        <div className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</div>
      </main>
    </div>
  );
};
