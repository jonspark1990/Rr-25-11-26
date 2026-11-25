import React, { useEffect, useState } from 'react';
import {
  Link as LinkIcon,
  Plus,
  Search,
  Download,
  Copy,
  Check,
  QrCode,
  Share2,
  ExternalLink,
  Power,
  RefreshCw,
  X,
  AlertCircle,
  MessageSquare,
  Trash2,
  Shield,
  Activity,
  Sparkles,
  MessageCircle,
  User,
  Calendar,
  Eye,
  Upload,
  FileJson,
  CheckCircle2,
  FileCheck2,
  Edit2,
} from 'lucide-react';
import { api, getCachedUser } from '../services/api.js';
import { Brand, Customer, GatewayAccount, PaymentLink } from '../types/index.js';
import { QRCodeModal } from '../components/QRCodeModal.js';
import { ShareNoticeModal } from '../components/ShareNoticeModal.js';
import { TrackLinkModal } from '../components/TrackLinkModal.js';
import { WhatsAppPreviewModal } from '../components/WhatsAppPreviewModal.js';
import { ManualVerificationModal } from '../components/ManualVerificationModal.js';
import { EditPaymentLinkModal } from '../components/EditPaymentLinkModal.js';

export const PaymentLinksPage: React.FC = () => {
  const currentUser = getCachedUser();
  const isFullAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const isPrivileged = isFullAdmin || currentUser?.role === 'manager';
  const perms = new Set(currentUser?.permissions || []);
  const canCreate = isFullAdmin || perms.has('links:create');
  const canEdit =
    isFullAdmin ||
    isPrivileged ||
    currentUser?.role === 'operator' ||
    currentUser?.role === 'link_creator' ||
    perms.has('links:create') ||
    perms.has('links:manage');
  const canDelete = isFullAdmin || perms.has('links:delete') || perms.has('links:manage');
  const canToggle = isFullAdmin || perms.has('links:toggle') || perms.has('links:manage');
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [gateways, setGateways] = useState<GatewayAccount[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Bulk selection
  const [selectedLinkIds, setSelectedLinkIds] = useState<Set<string>>(new Set());
  const [deletingLinks, setDeletingLinks] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    open: boolean;
    isBulk: boolean;
    targetId?: string;
    count?: number;
  }>({ open: false, isBulk: false });

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [teamMemberFilter, setTeamMemberFilter] = useState('ALL');
  const [datePresetFilter, setDatePresetFilter] = useState('all');
  const [search, setSearch] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedNoticeLink, setSelectedNoticeLink] = useState<PaymentLink | null>(null);
  const [qrModalData, setQrModalData] = useState<{ url: string; title: string; amount: string; token: string } | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [recheckingId, setRecheckingId] = useState<string | null>(null);
  const [trackingModalLink, setTrackingModalLink] = useState<PaymentLink | null>(null);
  const [whatsappPreviewLink, setWhatsappPreviewLink] = useState<PaymentLink | null>(null);
  const [manualVerifyLink, setManualVerifyLink] = useState<PaymentLink | null>(null);
  const [editingLink, setEditingLink] = useState<PaymentLink | null>(null);

  // Bulk Export / Import Migration Modals
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<'unpaid' | 'current' | 'selected' | 'all'>('unpaid');
  const [exportFormat, setExportFormat] = useState<'json' | 'csv'>('json');
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importMeta, setImportMeta] = useState<{ exportedAt?: string; sourceSiteName?: string; total: number; unpaid: number; paid: number } | null>(null);
  const [importLinksPayload, setImportLinksPayload] = useState<any[]>([]);
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'overwrite'>('skip');
  const [brandMode, setBrandMode] = useState<'match' | 'override'>('match');
  const [importBrandId, setImportBrandId] = useState('');
  const [gatewayMode, setGatewayMode] = useState<'match' | 'override'>('override');
  const [importGatewayId, setImportGatewayId] = useState('');
  const [extendExpiryHours, setExtendExpiryHours] = useState<number>(72);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  // WhatsApp open graph custom fields in create modal
  const [ogTitle, setOgTitle] = useState('');
  const [ogDescription, setOgDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [showAdvancedOg, setShowAdvancedOg] = useState(false);

  // Form states
  const [customerMode, setCustomerMode] = useState<'inline' | 'existing'>('inline');
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // KYC & Loan details (matching screenshot)
  const [loanOrderNumber, setLoanOrderNumber] = useState('');
  const [repaymentDate, setRepaymentDate] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [executiveName, setExecutiveName] = useState('');

  // Link & Gateway settings
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedGatewayId, setSelectedGatewayId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('72');
  const [formError, setFormError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [linksRes, brandsRes, custRes, gwRes, teamRes] = await Promise.all([
        api.getPaymentLinks({
          status: statusFilter,
          brandId: brandFilter,
          search,
          createdByAdminId: teamMemberFilter,
          datePreset: datePresetFilter,
        }),
        api.getBrands(),
        api.getCustomers(),
        api.getGatewayAccounts(),
        isPrivileged ? api.getTeamMembers().catch(() => ({ success: false, team: [] })) : Promise.resolve({ success: false, team: [] }),
      ]);

      if (linksRes.success) setLinks(linksRes.links);
      if (teamRes.success && teamRes.team) setTeamMembers(teamRes.team);
      if (brandsRes.success) {
        setBrands(brandsRes.brands);
        if (!selectedBrandId && brandsRes.brands.length > 0) {
          setSelectedBrandId(brandsRes.brands[0].id);
        }
        if (!importBrandId && brandsRes.brands.length > 0) {
          setImportBrandId(brandsRes.brands[0].id);
        }
      }
      if (custRes.success) {
        setCustomers(custRes.customers);
        if (!selectedCustomerId && custRes.customers.length > 0) {
          setSelectedCustomerId(custRes.customers[0].id);
        }
      }
      if (gwRes.success) {
        setGateways(gwRes.accounts);
        if (!selectedGatewayId && gwRes.accounts.length > 0) {
          setSelectedGatewayId(gwRes.accounts[0].id);
        }
        if (!importGatewayId && gwRes.accounts.length > 0) {
          const liveGw = gwRes.accounts.find((g: GatewayAccount) => g.isActive && !g.isSandbox) || gwRes.accounts[0];
          setImportGatewayId(liveGw.id);
        }
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, brandFilter, search, teamMemberFilter, datePresetFilter]);

  const toggleSelectAllLinks = () => {
    if (selectedLinkIds.size === links.length && links.length > 0) {
      setSelectedLinkIds(new Set());
    } else {
      setSelectedLinkIds(new Set(links.map((l) => l.id)));
    }
  };

  const toggleSelectLink = (id: string) => {
    const next = new Set(selectedLinkIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLinkIds(next);
  };

  const handleCopyLink = (token: string, publicUrl?: string, brandSlug?: string) => {
    const slug = brandSlug || 'pay';
    const cleanPath = publicUrl && publicUrl.includes('/pay/')
      ? publicUrl
      : `/${slug}/pay/${token}`;
    const full = window.location.origin + cleanPath;
    navigator.clipboard.writeText(full);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleShareWhatsApp = (l: PaymentLink) => {
    const slug = l.brandSlug || 'pay';
    const cleanPath = l.publicUrl && l.publicUrl.includes('/pay/')
      ? l.publicUrl
      : `/${slug}/pay/${l.token}`;
    const full = window.location.origin + cleanPath;
    const text = encodeURIComponent(
      `Hello ${l.customerName || ''}, please complete your payment of ₹${l.amountFormatted} using this secure link: ${full}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  const confirmDeleteSingleLink = (l: PaymentLink) => {
    setConfirmDeleteModal({
      open: true,
      isBulk: false,
      targetId: l.id,
    });
  };

  const confirmDeleteBulkLinks = () => {
    if (selectedLinkIds.size === 0) return;
    setConfirmDeleteModal({
      open: true,
      isBulk: true,
      count: selectedLinkIds.size,
    });
  };

  const executeDeleteLinks = async () => {
    setDeletingLinks(true);
    try {
      if (confirmDeleteModal.isBulk) {
        await api.bulkDeletePaymentLinks(Array.from(selectedLinkIds));
        setSelectedLinkIds(new Set());
      } else if (confirmDeleteModal.targetId) {
        await api.deletePaymentLink(confirmDeleteModal.targetId);
        selectedLinkIds.delete(confirmDeleteModal.targetId);
        setSelectedLinkIds(new Set(selectedLinkIds));
      }
      setConfirmDeleteModal({ open: false, isBulk: false });
      fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeletingLinks(false);
    }
  };

  const handleToggle = async (linkId: string) => {
    try {
      const res = await api.togglePaymentLink(linkId);
      if (res.success) {
        setLinks((prev) =>
          prev.map((l) => (l.id === linkId ? { ...l, isEnabled: res.isEnabled } : l))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRecheck = async (linkId: string) => {
    try {
      setRecheckingId(linkId);
      const res = await api.recheckPaymentLink(linkId);
      if (res.success) {
        setLinks((prev) =>
          prev.map((l) => (l.id === linkId ? { ...l, status: res.status } : l))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRecheckingId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setFormError(null);

    try {
      const payload: any = {
        brandId: selectedBrandId,
        gatewayAccountId: selectedGatewayId,
        amount: parseFloat(amount),
        description: description || 'Payment Link',
        externalReference,
        expiresInHours: parseInt(expiresInHours, 10),
        loanOrderNumber: loanOrderNumber.trim() || undefined,
        repaymentDate: repaymentDate.trim() || undefined,
        panNumber: panNumber.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        executiveName: executiveName.trim() || undefined,
        ogTitle: ogTitle.trim() || undefined,
        ogDescription: ogDescription.trim() || undefined,
        ogImageUrl: ogImage.trim() || undefined,
      };

      if (customerMode === 'existing' && selectedCustomerId) {
        payload.customerId = selectedCustomerId;
      } else {
        if (!customerName.trim() || !customerMobile.trim()) {
          setFormError('Customer Full Name and Mobile Number are required.');
          setCreating(false);
          return;
        }
        payload.customerName = customerName.trim();
        payload.customerMobile = customerMobile.trim();
        if (customerEmail.trim()) {
          payload.customerEmail = customerEmail.trim();
        }
      }

      const res = await api.createPaymentLink(payload);

      if (res.success) {
        setCreateModalOpen(false);
        const createdLink = res.link;
        const selectedBrand = brands.find((b) => b.id === selectedBrandId);
        setCustomerName('');
        setCustomerMobile('');
        setCustomerEmail('');
        setLoanOrderNumber('');
        setRepaymentDate('');
        setPanNumber('');
        setBankAccount('');
        setExecutiveName('');
        setAmount('');
        setDescription('');
        setExternalReference('');
        setOgTitle('');
        setOgDescription('');
        setOgImage('');
        setShowAdvancedOg(false);
        fetchData();

        if (createdLink) {
          const enriched: PaymentLink = {
            ...createdLink,
            customerName: payload.customerName || customers.find((c) => c.id === selectedCustomerId)?.fullName || 'Customer',
            customerMobile: payload.customerMobile || customers.find((c) => c.id === selectedCustomerId)?.mobile || '',
            brandName: selectedBrand?.name || 'Loan Services',
            brandSlug: selectedBrand?.slug || 'pay',
            publicUrl: `/${selectedBrand?.slug || 'pay'}/pay/${createdLink.token}`,
          };
          setSelectedNoticeLink(enriched);
        }
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Link creation failed');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Payment Links</h1>
          <p className="text-xs text-slate-500">
            Generate secure public payment tokens with branded customer checkout portals
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setExportMessage(null);
              setExportScope(selectedLinkIds.size > 0 ? 'selected' : 'unpaid');
              setExportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Download size={14} />
            <span>Export Backup</span>
          </button>

          {canCreate && (
            <button
              type="button"
              onClick={() => {
                setImportError(null);
                setImportResult(null);
                setImportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Upload size={14} />
              <span>Import Backup</span>
            </button>
          )}

          {canCreate && (
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-sm transition cursor-pointer"
            >
              <Plus size={15} />
              <span>New Payment Link</span>
            </button>
          )}
        </div>
      </div>

      {/* 90-Day Retention Notice */}
      <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <Shield size={16} />
          </div>
          <div>
            <span className="font-bold text-white">90-Day Payment Link Retention Engine Active</span>
            <p className="text-[11px] text-slate-400">
              Completed and expired payment links older than 90 days are purged automatically. Clean link URL format: /{'{brand}'}/pay/{'{token}'}.
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-teal-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto shrink-0">
          Total: {links.length} Links
        </div>
      </div>

      {/* Pending Manual Verification Queue Alert */}
      {(() => {
        const pendingReviewLinks = links.filter((l) => l.status === 'REVIEW_REQUIRED');
        if (pendingReviewLinks.length === 0) return null;
        return (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <FileCheck2 size={16} />
              </div>
              <div>
                <div className="font-bold">
                  {pendingReviewLinks.length} Manual UPI Payment Proof{pendingReviewLinks.length > 1 ? 's' : ''} Waiting for Approval
                </div>
                <p className="text-[11px] text-amber-800">
                  Customers have uploaded their UTR &amp; payment screenshots. Inspect and approve to mark Paid.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {statusFilter !== 'REVIEW_REQUIRED' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('REVIEW_REQUIRED')}
                  className="px-3 py-1.5 rounded-xl bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-bold transition cursor-pointer"
                >
                  Filter Queue ({pendingReviewLinks.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setManualVerifyLink(pendingReviewLinks[0])}
                className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition cursor-pointer"
              >
                Verify Next Proof
              </button>
            </div>
          </div>
        );
      })()}

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search token, UTR, ref, or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-teal-500 transition"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-teal-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="REVIEW_REQUIRED">REVIEW_REQUIRED (Verify Proof)</option>
            <option value="UNPAID">Unpaid / Pending Only</option>
            <option value="CREATED">CREATED</option>
            <option value="PENDING">PENDING</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILED">FAILED</option>
            <option value="EXPIRED">EXPIRED</option>
          </select>

          <select
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-teal-500"
          >
            <option value="ALL">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} (/{b.slug})
              </option>
            ))}
          </select>

          {isPrivileged ? (
            <select
              value={teamMemberFilter}
              onChange={(e) => setTeamMemberFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-teal-500 font-medium"
              title="Filter by Team Member / Creator"
            >
              <option value="ALL">All Team Members ({teamMembers.length || 'All'})</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.username} (@{m.username})
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold">
              <Shield size={13} className="text-teal-600 shrink-0" />
              <span className="truncate">My Created Links ({currentUser?.name || currentUser?.username})</span>
            </div>
          )}

          <select
            value={datePresetFilter}
            onChange={(e) => setDatePresetFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-teal-500 font-medium"
            title="Filter by Creation Date"
          >
            <option value="all">All Dates</option>
            <option value="today">Created Today</option>
            <option value="yesterday">Created Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>

          {(teamMemberFilter !== 'ALL' || datePresetFilter !== 'all' || statusFilter !== 'ALL' || brandFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setBrandFilter('ALL');
                setTeamMemberFilter('ALL');
                setDatePresetFilter('all');
                setSearch('');
              }}
              className="text-xs text-teal-600 hover:text-teal-800 font-semibold px-2 py-1 rounded-lg hover:bg-teal-50 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedLinkIds.size > 0 && canDelete && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-in fade-in duration-200">
              <span className="text-xs font-bold text-rose-800 font-mono">
                {selectedLinkIds.size} selected
              </span>
              <button
                onClick={confirmDeleteBulkLinks}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs transition"
              >
                <Trash2 size={12} />
                <span>Delete Selected</span>
              </button>
              <button
                onClick={() => setSelectedLinkIds(new Set())}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-medium px-1"
              >
                Clear
              </button>
            </div>
          )}

          <button
            onClick={fetchData}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Payment Links Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={links.length > 0 && selectedLinkIds.size === links.length}
                    onChange={toggleSelectAllLinks}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Token &amp; Order Ref</th>
                <th className="py-3.5 px-4">Brand</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Created By &amp; Time</th>
                <th className="py-3.5 px-4">Amount</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Expires</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && links.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto text-teal-500 mb-2" />
                    <span>Loading payment links...</span>
                  </td>
                </tr>
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No payment links found matching current filter.
                  </td>
                </tr>
              ) : (
                links.map((link) => {
                  const isSuccess = link.status === 'SUCCESS';
                  const isSelected = selectedLinkIds.has(link.id);
                  const cleanPublicUrl = link.publicUrl && link.publicUrl.includes('/pay/')
                    ? link.publicUrl
                    : `/${link.brandSlug || 'pay'}/pay/${link.token}`;

                  return (
                    <tr
                      key={link.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-teal-50/40' : ''
                      } ${!link.isEnabled ? 'opacity-60 bg-slate-50/40' : ''}`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLink(link.id)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                        />
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent('open:checkout', {
                                  detail: { token: link.token, brandSlug: link.brandSlug },
                                })
                              );
                            }}
                            className="font-mono font-bold text-slate-900 bg-slate-100 hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 px-2 py-0.5 rounded text-xs border border-slate-200 transition flex items-center gap-1 cursor-pointer"
                            title="Click to Test/Preview Customer Checkout"
                          >
                            <span>{link.token}</span>
                            <Eye size={11} className="text-teal-600" />
                          </button>
                          {!link.isEnabled && (
                            <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 px-1.5 py-0.5 rounded">
                              Disabled
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-1">
                          {link.merchantOrderNo}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{link.brandName}</div>
                        <div className="text-[10px] text-teal-600 font-mono">/{link.brandSlug}/pay</div>
                        {link.gatewayName && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[150px]" title={link.gatewayName}>
                            GW: <span className="font-medium text-slate-700">{link.gatewayName}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{link.customerName}</div>
                        <div className="text-slate-400 text-[11px]">{link.customerMobile}</div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User size={12} className="text-teal-600 shrink-0" />
                          <span className="truncate">{link.createdByName || 'Administrator'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <span className="text-slate-500 font-medium">@{link.createdByUsername || 'admin'}</span>
                          <span>•</span>
                          <span>{new Date(link.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        ₹{link.amountFormatted}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            link.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : link.status === 'REVIEW_REQUIRED'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : link.status === 'FAILED'
                              ? 'bg-rose-100 text-rose-800'
                              : link.status === 'EXPIRED'
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {link.status}
                        </span>
                        {link.manualSubmission?.utrNumber && (
                          <div className="text-[10px] font-mono text-slate-600 mt-1">
                            UTR: <span className="font-bold text-slate-800">{link.manualSubmission.utrNumber}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {new Date(link.expiresAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => setEditingLink(link)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                              title="Edit Link (Gateway, Amount, Brand, Customer, KYC & Expiry)"
                            >
                              <Edit2 size={12} />
                              <span>Edit</span>
                            </button>
                          )}

                          {(link.status === 'REVIEW_REQUIRED' ||
                            link.manualSubmission ||
                            (link.gatewayAdapter === 'manual' && link.status !== 'SUCCESS')) && (
                            <button
                              type="button"
                              onClick={() => setManualVerifyLink(link)}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                link.status === 'REVIEW_REQUIRED'
                                  ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-xs'
                                  : 'bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200'
                              }`}
                              title="Verify Manual UPI Proof & Approve / Reject"
                            >
                              <FileCheck2 size={12} />
                              <span>{link.status === 'REVIEW_REQUIRED' ? 'Verify Proof' : 'Manual Review'}</span>
                            </button>
                          )}
                          {/* QR Code */}
                          <button
                            onClick={() =>
                              setQrModalData({
                                url: cleanPublicUrl,
                                title: `${link.brandName} Payment`,
                                amount: link.amountFormatted,
                                token: link.token,
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                            title="Generate QR Code"
                          >
                            <QrCode size={14} />
                          </button>

                          {/* Track Link Customer Journey & Gateway Data */}
                          <button
                            onClick={() => setTrackingModalLink(link)}
                            className="p-1.5 rounded-lg text-teal-600 hover:text-teal-800 hover:bg-teal-50 transition"
                            title="Track Customer Journey, Views, & Gateway Order Data"
                          >
                            <Activity size={14} />
                          </button>

                          {/* WhatsApp & Social Media Preview Editor */}
                          <button
                            onClick={() => setWhatsappPreviewLink(link)}
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition"
                            title="Edit WhatsApp & Social Media Link Preview (OpenGraph)"
                          >
                            <MessageCircle size={14} />
                          </button>

                          {/* Copy Link */}
                          <button
                            onClick={() =>
                              handleCopyLink(
                                link.token,
                                cleanPublicUrl,
                                link.brandSlug
                              )
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 transition"
                            title="Copy Payment Link"
                          >
                            {copiedToken === link.token ? (
                              <Check size={14} className="text-emerald-600" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>

                          {/* Copy with Notice Template */}
                          <button
                            onClick={() => setSelectedNoticeLink(link)}
                            className="p-1.5 rounded-lg text-teal-600 hover:text-teal-700 hover:bg-teal-50 transition"
                            title="Copy with Recovery Notice Template (Auto-filled)"
                          >
                            <MessageSquare size={14} />
                          </button>

                          {/* WhatsApp Share */}
                          <button
                            onClick={() => handleShareWhatsApp(link)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-slate-100 transition"
                            title="Share via WhatsApp"
                          >
                            <Share2 size={14} />
                          </button>

                          {/* Recheck Gateway Status */}
                          <button
                            onClick={() => handleRecheck(link.id)}
                            disabled={recheckingId === link.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition"
                            title="Query Gateway Status"
                          >
                            <RefreshCw
                              size={14}
                              className={recheckingId === link.id ? 'animate-spin text-indigo-600' : ''}
                            />
                          </button>

                          {/* Enable / Disable Toggle */}
                          {canToggle && (
                            <button
                              onClick={() => handleToggle(link.id)}
                              className={`p-1.5 rounded-lg transition ${
                                link.isEnabled
                                  ? 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                                  : 'text-rose-500 hover:text-emerald-600 hover:bg-slate-100'
                              }`}
                              title={link.isEnabled ? 'Disable Link' : 'Enable Link'}
                            >
                              <Power size={14} />
                            </button>
                          )}

                          {/* Delete Link */}
                          {canDelete && (
                            <button
                              onClick={() => confirmDeleteSingleLink(link)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Payment Link"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}

                          {/* In-App Live Checkout Preview */}
                          <button
                            type="button"
                            onClick={() => {
                              window.dispatchEvent(
                                new CustomEvent('open:checkout', {
                                  detail: { token: link.token, brandSlug: link.brandSlug },
                                })
                              );
                            }}
                            className="p-1.5 rounded-lg text-teal-600 hover:text-teal-800 hover:bg-teal-50 transition cursor-pointer"
                            title="Live Customer Checkout Preview (In-App)"
                          >
                            <Eye size={14} />
                          </button>

                          {/* Open Public Page */}
                          <a
                            href={cleanPublicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition"
                            title="Open Customer Checkout Page in New Window"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QR Code Modal */}
      {qrModalData && (
        <QRCodeModal
          isOpen={true}
          onClose={() => setQrModalData(null)}
          url={qrModalData.url}
          title={qrModalData.title}
          amount={qrModalData.amount}
          token={qrModalData.token}
        />
      )}

      {/* Create Payment Link Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setCreateModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">Create Branded Payment Link</h3>
            <p className="text-xs text-slate-500 mb-4">
              A secure, unpredictable public token will be generated (no sequential IDs).
            </p>

            {formError && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              {/* Customer Mode Selection */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Customer Details *</span>
                  <div className="flex gap-1 bg-white p-0.5 rounded-xl border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setCustomerMode('inline')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        customerMode === 'inline' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Instant Inline
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerMode('existing')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition ${
                        customerMode === 'existing' ? 'bg-teal-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      Pick Saved
                    </button>
                  </div>
                </div>

                {customerMode === 'inline' ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Customer Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. PARVEEN"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-teal-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          Mobile Number *
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 9201234695"
                          value={customerMobile}
                          onChange={(e) => setCustomerMobile(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-teal-500 bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Email Address (Optional)
                      </label>
                      <input
                        type="email"
                        placeholder="customer@example.com"
                        value={customerEmail}
                        onChange={(e) => setCustomerEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 bg-white"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">Select Existing Customer *</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 bg-white"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} ({c.mobile}) - {c.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* KYC & Loan Details (Matching user's screenshot - all optional) */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">KYC &amp; Loan Details (Optional)</span>
                  <span className="text-[10px] text-slate-400">Shows on customer checkout</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Order / Loan Order NO
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 6307137 (auto if empty)"
                      value={loanOrderNumber}
                      onChange={(e) => setLoanOrderNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Repayment Date
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 10/10/2026"
                      value={repaymentDate}
                      onChange={(e) => setRepaymentDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      PAN Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ABCDE1234F"
                      value={panNumber}
                      onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-teal-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Bank Account / UPI
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 9201234695@ybl"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-teal-500 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Executive / Loan Officer Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar"
                    value={executiveName}
                    onChange={(e) => setExecutiveName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 bg-white"
                  />
                </div>
              </div>

              {/* Brand & Gateway Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand Theme *</label>
                  <select
                    required
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (/{b.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gateway Account *</label>
                  <select
                    required
                    value={selectedGatewayId}
                    onChange={(e) => setSelectedGatewayId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500"
                  >
                    {gateways.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} {g.isSandbox ? '[SANDBOX]' : '[LIVE]'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Payable Amount & Expiry */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Payable Amount (INR) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="500.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold font-mono focus:outline-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Validity (Hours)</label>
                  <input
                    type="number"
                    min="1"
                    max="720"
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description / Bill Memo</label>
                <input
                  type="text"
                  placeholder="e.g. Loan Repayment"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">External Invoice / Ref</label>
                <input
                  type="text"
                  placeholder="e.g. INV-2026-8801"
                  value={externalReference}
                  onChange={(e) => setExternalReference(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500"
                />
              </div>

              {/* WhatsApp & Social Media Preview Customization Section */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdvancedOg(!showAdvancedOg)}
                  className="w-full p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/70 text-emerald-800 text-xs font-bold transition flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <MessageCircle size={14} className="text-emerald-600" />
                    <span>📱 Customize WhatsApp &amp; Social Link Preview (Optional)</span>
                  </span>
                  <span className="text-[11px] text-emerald-600">
                    {showAdvancedOg ? 'Hide ▲' : 'Customize ▼'}
                  </span>
                </button>

                {showAdvancedOg && (
                  <div className="mt-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        WhatsApp Preview Title
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Samvit Loan Repayment - Invoice #991"
                        value={ogTitle}
                        onChange={(e) => setOgTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-teal-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        WhatsApp Preview Description
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Pay ₹500 securely via UPI/Card for Rajesh Sharma"
                        value={ogDescription}
                        onChange={(e) => setOgDescription(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-teal-500 font-medium"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        WhatsApp Preview Banner URL
                      </label>
                      <input
                        type="text"
                        placeholder="https://example.com/banner.png"
                        value={ogImage}
                        onChange={(e) => setOgImage(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white focus:outline-teal-500 font-mono"
                      />
                    </div>

                    {/* Live WhatsApp preview card mini */}
                    <div className="bg-[#e5ddd5] p-2.5 rounded-xl border border-slate-300">
                      <div className="bg-[#dcf8c6] rounded-xl p-2 text-[10px] space-y-1">
                        <div className="bg-white rounded-lg p-2 border border-slate-200 space-y-0.5">
                          <div className="font-bold text-slate-900 truncate">
                            {ogTitle || 'Payment Request - Official Portal'}
                          </div>
                          <div className="text-[9px] text-slate-500 truncate">
                            {ogDescription || 'Pay securely via UPI, Card, Net Banking.'}
                          </div>
                        </div>
                        <div className="text-[9px] text-teal-800 font-mono">
                          payment-link.preview...
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-sm transition"
                >
                  {creating ? 'Generating Token...' : 'Generate Secure Link'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Share with Notice Template Modal */}
      {selectedNoticeLink && (
        <ShareNoticeModal
          link={selectedNoticeLink}
          onClose={() => setSelectedNoticeLink(null)}
        />
      )}

      {/* Confirmation Modal for Delete */}
      {confirmDeleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center space-y-4 border border-slate-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {confirmDeleteModal.isBulk
                  ? `Delete ${confirmDeleteModal.count} Payment Links?`
                  : 'Delete This Payment Link?'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure? This payment link and checkout URL will be permanently removed.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal({ open: false, isBulk: false })}
                className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingLinks}
                onClick={executeDeleteLinks}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {deletingLinks ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Track Customer Journey & Gateway Order Data Modal */}
      {trackingModalLink && (
        <TrackLinkModal
          isOpen={Boolean(trackingModalLink)}
          onClose={() => setTrackingModalLink(null)}
          linkId={trackingModalLink.id}
        />
      )}

      {/* WhatsApp & Social Media Preview Editor Modal */}
      {whatsappPreviewLink && (
        <WhatsAppPreviewModal
          isOpen={Boolean(whatsappPreviewLink)}
          onClose={() => setWhatsappPreviewLink(null)}
          link={whatsappPreviewLink}
          onUpdated={fetchData}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL: FILTERED BULK EXPORT (JSON BACKUP & CSV)                */}
      {/* ============================================================== */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Download size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Export Payment Links</h3>
                  <p className="text-[11px] text-slate-500">Filter and download links for migration or reporting</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">What should be exported?</label>
                <div className="space-y-2">
                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition ${exportScope === 'unpaid' ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200'}`}>
                    <input
                      type="radio"
                      name="exportScope"
                      checked={exportScope === 'unpaid'}
                      onChange={() => setExportScope('unpaid')}
                      className="mt-0.5 text-teal-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Unpaid / Pending Links Only</span>
                      <span className="text-[11px] text-slate-500">Includes CREATED, PENDING, PROCESSING &amp; FAILED links (ideal when migrating to a new Railway server)</span>
                    </div>
                  </label>

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition ${exportScope === 'current' ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200'}`}>
                    <input
                      type="radio"
                      name="exportScope"
                      checked={exportScope === 'current'}
                      onChange={() => setExportScope('current')}
                      className="mt-0.5 text-teal-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Current Table Filters ({links.length} links)</span>
                      <span className="text-[11px] text-slate-500">Uses your active Status, Brand, Team Member, Date, and Search filters</span>
                    </div>
                  </label>

                  {selectedLinkIds.size > 0 && (
                    <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition ${exportScope === 'selected' ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200'}`}>
                      <input
                        type="radio"
                        name="exportScope"
                        checked={exportScope === 'selected'}
                        onChange={() => setExportScope('selected')}
                        className="mt-0.5 text-teal-600"
                      />
                      <div>
                        <span className="font-bold text-slate-900 block">Selected Rows Only ({selectedLinkIds.size} selected)</span>
                        <span className="text-[11px] text-slate-500">Exports only the rows currently checked in the table</span>
                      </div>
                    </label>
                  )}

                  <label className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer text-xs transition ${exportScope === 'all' ? 'border-teal-500 bg-teal-50/50' : 'border-slate-200'}`}>
                    <input
                      type="radio"
                      name="exportScope"
                      checked={exportScope === 'all'}
                      onChange={() => setExportScope('all')}
                      className="mt-0.5 text-teal-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">All Accessible Payment Links</span>
                      <span className="text-[11px] text-slate-500">Exports complete link archive regardless of filters</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Export File Format</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExportFormat('json')}
                    className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer ${exportFormat === 'json' ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-700'}`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <FileJson size={14} />
                      <span>Backup (.json)</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Re-importable on new server</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExportFormat('csv')}
                    className={`p-3 rounded-xl border text-left text-xs transition cursor-pointer ${exportFormat === 'csv' ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-200 text-slate-700'}`}
                  >
                    <div className="font-bold flex items-center gap-1.5">
                      <Download size={14} />
                      <span>Spreadsheet (.csv)</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Excel / Google Sheets view</div>
                  </button>
                </div>
              </div>
            </div>

            {exportMessage && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                {exportMessage}
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setExportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={exporting}
                onClick={async () => {
                  try {
                    setExporting(true);
                    setExportMessage(null);
                    const params: Record<string, string | undefined> = {};
                    if (exportScope === 'unpaid') {
                      params.status = 'UNPAID';
                      if (brandFilter !== 'ALL') params.brandId = brandFilter;
                      if (teamMemberFilter !== 'ALL') params.createdByAdminId = teamMemberFilter;
                    } else if (exportScope === 'current') {
                      params.status = statusFilter;
                      params.brandId = brandFilter;
                      params.createdByAdminId = teamMemberFilter;
                      params.datePreset = datePresetFilter;
                      params.search = search;
                    } else if (exportScope === 'selected') {
                      params.ids = Array.from(selectedLinkIds).join(',');
                    }
                    const res = await api.downloadPaymentLinksExport(exportFormat, params);
                    setExportMessage(`Downloaded ${res.filename} successfully.`);
                  } catch (err: any) {
                    alert(err.message || 'Export failed');
                  } finally {
                    setExporting(false);
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
                <span>{exporting ? 'Exporting...' : `Download ${exportFormat.toUpperCase()}`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: BULK IMPORT BACKUP (.JSON)                              */}
      {/* ============================================================== */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                  <Upload size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Import Payment Links Backup</h3>
                  <p className="text-[11px] text-slate-500">Restore pending links and customer KYC records from another deployment</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">1. Select Exported Backup (.json)</label>
              <input
                type="file"
                accept=".json,application/json"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  setImportError(null);
                  setImportResult(null);
                  if (!file) return;
                  setImportFileName(file.name);
                  try {
                    const text = await file.text();
                    const parsed = JSON.parse(text);
                    const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.links) ? parsed.links : null;
                    if (!arr || arr.length === 0) {
                      setImportError('No payment links found inside this JSON file.');
                      setImportLinksPayload([]);
                      setImportMeta(null);
                      return;
                    }
                    const paidCount = arr.filter((l: any) => l.status === 'SUCCESS').length;
                    setImportLinksPayload(arr);
                    setImportMeta({
                      exportedAt: parsed.exportedAt,
                      sourceSiteName: parsed.sourceSiteName,
                      total: arr.length,
                      paid: paidCount,
                      unpaid: arr.length - paidCount,
                    });
                  } catch {
                    setImportError('Invalid JSON file. Please upload a backup generated by Export Backup.');
                    setImportLinksPayload([]);
                    setImportMeta(null);
                  }
                }}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 border border-slate-200 rounded-xl p-1.5 bg-slate-50 cursor-pointer"
              />
            </div>

            {importMeta && (
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Ready to Import: {importFileName}</span>
                  <span className="text-teal-700 font-mono">{importMeta.total} Links</span>
                </div>
                <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                  <span>Unpaid/Pending: <b>{importMeta.unpaid}</b></span>
                  <span>Paid: <b>{importMeta.paid}</b></span>
                  {importMeta.exportedAt && (
                    <span>Exported: {new Date(importMeta.exportedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Duplicate Link Handling</label>
                <select
                  value={duplicateStrategy}
                  onChange={(e) => setDuplicateStrategy(e.target.value as 'skip' | 'overwrite')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                >
                  <option value="skip">Skip Existing Tokens</option>
                  <option value="overwrite">Overwrite / Update Existing</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Unpaid Link Validity</label>
                <select
                  value={extendExpiryHours}
                  onChange={(e) => setExtendExpiryHours(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50"
                >
                  <option value={0}>Keep Original Expiry Dates</option>
                  <option value={72}>Extend Unpaid Links (+72 Hours)</option>
                  <option value={168}>Extend Unpaid Links (+7 Days)</option>
                  <option value={720}>Extend Unpaid Links (+30 Days)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Brand Mapping</label>
                <select
                  value={brandMode}
                  onChange={(e) => setBrandMode(e.target.value as 'match' | 'override')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 mb-1.5"
                >
                  <option value="match">Match by Brand Slug (with fallback)</option>
                  <option value="override">Assign All to Selected Brand</option>
                </select>
                <select
                  value={importBrandId}
                  onChange={(e) => setImportBrandId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      Fallback/Target: {b.name} (/{b.slug})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Gateway Account Mapping</label>
                <select
                  value={gatewayMode}
                  onChange={(e) => setGatewayMode(e.target.value as 'match' | 'override')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 mb-1.5"
                >
                  <option value="override">Route to Selected Gateway (Recommended)</option>
                  <option value="match">Match by Gateway Name (with fallback)</option>
                </select>
                <select
                  value={importGatewayId}
                  onChange={(e) => setImportGatewayId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white"
                >
                  {gateways.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} {g.isSandbox ? '[SANDBOX]' : '[LIVE]'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {importError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {importResult && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  <span>Migration Import Completed</span>
                </div>
                <div className="text-[11px] flex flex-wrap gap-x-4 gap-y-1">
                  <span>Imported: <b>{importResult.importedCount}</b></span>
                  <span>Updated: <b>{importResult.updatedCount}</b></span>
                  <span>Skipped: <b>{importResult.skippedCount}</b></span>
                  <span>Customers Added: <b>{importResult.customersCreated}</b></span>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={importing || importLinksPayload.length === 0}
                onClick={async () => {
                  try {
                    setImporting(true);
                    setImportError(null);
                    setImportResult(null);
                    const res = await api.importPaymentLinks({
                      links: importLinksPayload,
                      duplicateStrategy,
                      brandMode,
                      targetBrandId: importBrandId || undefined,
                      gatewayMode,
                      targetGatewayAccountId: importGatewayId || undefined,
                      extendExpiryHours,
                    });
                    setImportResult(res);
                    await fetchData();
                  } catch (err: any) {
                    setImportError(err.message || 'Bulk import failed.');
                  } finally {
                    setImporting(false);
                  }
                }}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {importing ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
                <span>{importing ? 'Importing Links...' : 'Import Links & Customers'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Verification Modal */}
      {manualVerifyLink && (
        <ManualVerificationModal
          link={manualVerifyLink}
          onClose={() => setManualVerifyLink(null)}
          onVerified={fetchData}
        />
      )}

      {/* Full Edit Payment Link Modal */}
      {editingLink && (
        <EditPaymentLinkModal
          link={editingLink}
          brands={brands}
          customers={customers}
          gateways={gateways}
          onClose={() => setEditingLink(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};
