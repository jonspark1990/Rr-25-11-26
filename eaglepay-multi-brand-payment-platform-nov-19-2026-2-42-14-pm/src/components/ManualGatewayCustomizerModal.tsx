import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Eye,
  FileCheck2,
  ImagePlus,
  Layout,
  Palette,
  Plus,
  QrCode,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Brand, GatewayAccount, ManualGatewayConfig } from '../types/index.js';
import { compressImageToDataUrl, DEFAULT_MANUAL_GATEWAY_CONFIG } from '../utils/manualGatewayDefaults.js';
import { ManualPaymentCheckout } from './ManualPaymentCheckout.js';

interface ManualGatewayCustomizerModalProps {
  account: GatewayAccount | null; // null when creating a new Manual Gateway
  onClose: () => void;
  onSaved: () => void;
}

type TabKey = 'upi' | 'theme' | 'copy' | 'proof';

export const ManualGatewayCustomizerModal: React.FC<ManualGatewayCustomizerModalProps> = ({
  account,
  onClose,
  onSaved,
}) => {
  const isNew = !account;
  const [activeTab, setActiveTab] = useState<TabKey>('upi');
  const [name, setName] = useState(account?.name || 'Manual UPI / QR Gateway');
  const [isActive, setIsActive] = useState(account?.isActive ?? true);

  const [config, setConfig] = useState<ManualGatewayConfig>({
    ...DEFAULT_MANUAL_GATEWAY_CONFIG,
    ...(account?.extraConfig?.manualConfig || {}),
  });

  const [brands, setBrands] = useState<Brand[]>([]);
  const [previewBrandId, setPreviewBrandId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [uploadingQr, setUploadingQr] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  useEffect(() => {
    api
      .getBrands()
      .then((res) => {
        if (res.success && Array.isArray(res.brands)) {
          setBrands(res.brands);
          if (res.brands.length > 0) {
            setPreviewBrandId(res.brands[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  const updateField = <K extends keyof ManualGatewayConfig>(key: K, value: ManualGatewayConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleQrImageUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadingQr(true);
    setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, 900, 0.85);
      updateField('customQrImageUrl', dataUrl);
      if (config.qrMode === 'dynamic_upi') {
        updateField('qrMode', 'both');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process QR image.');
    } finally {
      setUploadingQr(false);
    }
  };

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Gateway account display name is required.');
      return;
    }

    const hasDestination =
      Boolean(config.upiId?.trim()) ||
      Boolean(config.customQrImageUrl?.trim()) ||
      Boolean(config.showBankDetails && config.bankAccountNumber?.trim());

    if (!hasDestination) {
      setError('Please enter a UPI ID, upload a Custom QR Image, or configure Bank Details.');
      setActiveTab('upi');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        adapter: 'manual',
        mchId: config.upiId?.trim() || 'MANUAL_UPI',
        isActive,
        extraConfig: {
          ...(account?.extraConfig || {}),
          manualConfig: {
            ...config,
            upiId: config.upiId.trim(),
          },
        },
      };

      if (isNew) {
        await api.createGatewayAccount(payload);
      } else {
        await api.updateGatewayAccount(account.id, payload);
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save manual gateway settings.');
    } finally {
      setSaving(false);
    }
  };

  const previewBrand = brands.find((b) => b.id === previewBrandId) || {
    name: 'Samvit',
    slug: 'samvit',
    logoUrl: '',
    primaryColor: '#0f766e',
    secondaryColor: '#0d9488',
    backgroundColor: '#f0fdfa',
    buttonColor: '#0f766e',
    supportEmail: 'support@samvit.com',
    supportPhone: '+91 800-444-2200',
  };

  const previewLink = {
    token: 'PAY8F72K9',
    amount: 2499,
    amountFormatted: '2499.00',
    currency: 'INR',
    merchantOrderNo: 'ORD-171800101-SAMVIT',
    loanOrderNumber: '6307137',
    repaymentDate: '25/11/2026',
    panNumber: 'ABCDE1234F',
    executiveName: 'Vikram Mehta',
    status: 'PENDING',
    expiresAt: new Date(Date.now() + 72 * 3600000).toISOString(),
  };

  const previewCustomer = {
    name: 'Rajesh Sharma',
    mobile: '9876543210',
    email: 'rajesh@example.com',
    panNumber: 'ABCDE1234F',
    executiveName: 'Vikram Mehta',
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
              <QrCode size={18} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                {isNew ? 'Create Manual UPI / QR Gateway' : `Customize: ${account.name}`}
              </h2>
              <p className="text-[11px] text-slate-500">
                100% customizable QR, UPI ID, brand data fields, colors, instructions, and proof verification
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMobilePreview(!showMobilePreview)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer"
            >
              <Eye size={14} />
              <span>{showMobilePreview ? 'Edit Settings' : 'Live Preview'}</span>
            </button>

            <button
              type="button"
              onClick={() => setConfig({ ...DEFAULT_MANUAL_GATEWAY_CONFIG })}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition cursor-pointer"
              title="Reset text & theme to recommended defaults"
            >
              <RotateCcw size={13} />
              <span>Reset Defaults</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-70"
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              <span>{saving ? 'Saving...' : isNew ? 'Create Manual Gateway' : 'Save Changes'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {error && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body: Left Editor + Right Live Preview */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12">
          {/* LEFT SETTINGS PANE */}
          <div
            className={`lg:col-span-5 border-r border-slate-200 flex flex-col min-h-0 bg-white ${
              showMobilePreview ? 'hidden lg:flex' : 'flex'
            }`}
          >
            {/* Sub-navigation Tabs */}
            <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold">
              {[
                { id: 'upi', label: 'UPI & QR', icon: QrCode },
                { id: 'theme', label: 'Brand & UI', icon: Palette },
                { id: 'copy', label: 'Text & Info', icon: Type },
                { id: 'proof', label: 'Proof & Flow', icon: FileCheck2 },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as TabKey)}
                    className={`py-2.5 px-2 flex flex-col sm:flex-row items-center justify-center gap-1.5 border-b-2 transition cursor-pointer ${
                      active
                        ? 'border-teal-600 text-teal-700 bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Icon size={13} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Form Fields */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {activeTab === 'upi' && (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-800">Gateway Display Name *</label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isActive}
                          onChange={(e) => setIsActive(e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span className="font-semibold text-slate-700">Gateway Active</span>
                      </label>
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Manual UPI / QR Gateway"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-teal-500"
                    />
                  </div>

                  {/* UPI Details */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <QrCode size={14} className="text-teal-600" />
                      <span>UPI ID &amp; QR Code Settings</span>
                    </h4>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Merchant UPI ID (VPA) *
                      </label>
                      <input
                        type="text"
                        value={config.upiId}
                        onChange={(e) => updateField('upiId', e.target.value)}
                        placeholder="e.g. yourbusiness@okaxis"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-mono text-xs focus:outline-teal-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.useBrandNameAsPayee !== false}
                          onChange={(e) => updateField('useBrandNameAsPayee', e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span className="font-semibold text-slate-700">
                          Auto-fetch Payee Name from Bound Brand (e.g. {previewBrand.name})
                        </span>
                      </label>

                      {config.useBrandNameAsPayee === false && (
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Custom Payee Display Name
                          </label>
                          <input
                            type="text"
                            value={config.upiPayeeName || ''}
                            onChange={(e) => updateField('upiPayeeName', e.target.value)}
                            placeholder="e.g. AppAssistServices"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-teal-500"
                          />
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1.5">
                        QR Code Generation Mode
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'dynamic_upi', label: 'Dynamic Amount QR' },
                          { id: 'custom_image', label: 'Uploaded QR' },
                          { id: 'both', label: 'Show Both' },
                        ].map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => updateField('qrMode', m.id as ManualGatewayConfig['qrMode'])}
                            className={`px-2.5 py-2 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                              config.qrMode === m.id
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(config.qrMode === 'custom_image' || config.qrMode === 'both') && (
                      <div className="space-y-2 pt-1">
                        <label className="block text-[11px] font-semibold text-slate-600">
                          Custom Merchant QR Image (Upload or Image URL)
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700 cursor-pointer shrink-0">
                            {uploadingQr ? <RefreshCw size={13} className="animate-spin" /> : <ImagePlus size={13} />}
                            <span>{uploadingQr ? 'Processing...' : 'Upload QR'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleQrImageUpload(e.target.files?.[0])}
                            />
                          </label>
                          <input
                            type="text"
                            value={config.customQrImageUrl || ''}
                            onChange={(e) => updateField('customQrImageUrl', e.target.value)}
                            placeholder="Or paste QR image URL..."
                            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs focus:outline-teal-500"
                          />
                          {config.customQrImageUrl && (
                            <button
                              type="button"
                              onClick={() => updateField('customQrImageUrl', '')}
                              className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 cursor-pointer"
                              title="Clear QR image"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={config.showUpiApps !== false}
                        onChange={(e) => updateField('showUpiApps', e.target.checked)}
                        className="rounded text-teal-600"
                      />
                      <span className="font-semibold text-slate-700">
                        Show Quick UPI App Launch Buttons (GPay, PhonePe, Paytm)
                      </span>
                    </label>
                  </div>

                  {/* Checkout Open Mode */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
                    <h4 className="font-bold text-slate-900">Checkout Flow Behavior</h4>
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(config.directOpen)}
                        onChange={(e) => updateField('directOpen', e.target.checked)}
                        className="rounded text-teal-600 mt-0.5"
                      />
                      <div>
                        <div className="font-semibold text-slate-800">
                          Open Manual QR &amp; Proof Page Immediately on Link Visit
                        </div>
                        <p className="text-[11px] text-slate-500">
                          When unchecked, customers see your Brand KYC Summary first and open this QR page on clicking
                          &quot;PAY NOW&quot;.
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Optional Bank Details */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Building2 size={14} className="text-teal-600" />
                        <span>Enable Bank Transfer (IMPS / NEFT)</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(config.showBankDetails)}
                        onChange={(e) => updateField('showBankDetails', e.target.checked)}
                        className="rounded text-teal-600"
                      />
                    </label>

                    {config.showBankDetails && (
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <input
                          type="text"
                          value={config.bankHolderName || ''}
                          onChange={(e) => updateField('bankHolderName', e.target.value)}
                          placeholder="Account Holder Name"
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                        />
                        <input
                          type="text"
                          value={config.bankName || ''}
                          onChange={(e) => updateField('bankName', e.target.value)}
                          placeholder="Bank Name"
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                        />
                        <input
                          type="text"
                          value={config.bankAccountNumber || ''}
                          onChange={(e) => updateField('bankAccountNumber', e.target.value)}
                          placeholder="Account Number"
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={config.bankIfsc || ''}
                          onChange={(e) => updateField('bankIfsc', e.target.value.toUpperCase())}
                          placeholder="IFSC Code"
                          className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-mono"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'theme' && (
                <>
                  {/* Layout Preset */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Layout size={14} className="text-teal-600" />
                      <span>Page Layout &amp; Theme Source</span>
                    </h4>

                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'split', label: 'Split Two-Column (Desktop)' },
                        { id: 'centered', label: 'Centered Single Card' },
                      ].map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => updateField('layoutStyle', l.id as 'split' | 'centered')}
                          className={`px-3 py-2 rounded-xl border text-xs font-bold transition cursor-pointer ${
                            config.layoutStyle === l.id
                              ? 'bg-teal-600 border-teal-600 text-white'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={config.useBrandTheme !== false}
                        onChange={(e) => updateField('useBrandTheme', e.target.checked)}
                        className="rounded text-teal-600"
                      />
                      <span className="font-semibold text-slate-800">
                        Automatically Sync Colors from Payment Link&apos;s Bound Brand
                      </span>
                    </label>

                    {config.useBrandTheme === false && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        {[
                          { key: 'customPrimaryColor', label: 'Primary Color' },
                          { key: 'customSecondaryColor', label: 'Secondary Color' },
                          { key: 'customBackgroundColor', label: 'Page Background' },
                          { key: 'customButtonColor', label: 'Button Color' },
                        ].map((c) => (
                          <div key={c.key}>
                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">{c.label}</label>
                            <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-2 py-1.5">
                              <input
                                type="color"
                                value={(config[c.key as keyof ManualGatewayConfig] as string) || '#0f766e'}
                                onChange={(e) => updateField(c.key as keyof ManualGatewayConfig, e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer border-0"
                              />
                              <span className="font-mono text-[11px] text-slate-700">
                                {(config[c.key as keyof ManualGatewayConfig] as string) || '#0f766e'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Brand & PaymentLink Data Visibility Toggles */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <div>
                      <h4 className="font-bold text-slate-900">Dynamic Brand &amp; Link Fields to Display</h4>
                      <p className="text-[11px] text-slate-500">
                        Choose which fields fetched from the Brand &amp; Payment Link appear on the manual checkout page.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      {[
                        { key: 'showBrandLogo', label: 'Brand Logo' },
                        { key: 'showBrandName', label: 'Brand Name' },
                        { key: 'showAmount', label: 'Payable Amount' },
                        { key: 'showCustomerName', label: 'Customer Name' },
                        { key: 'showCustomerMobile', label: 'Customer Mobile' },
                        { key: 'showLoanOrderNumber', label: 'Loan Order Number' },
                        { key: 'showOrderNumber', label: 'Payment Ref Order' },
                        { key: 'showRepaymentDate', label: 'Repayment / Due Date' },
                        { key: 'showPanNumber', label: 'PAN Number' },
                        { key: 'showExecutiveName', label: 'Executive Name' },
                        { key: 'showBrandSupport', label: 'Brand Support Contact' },
                      ].map((item) => (
                        <label
                          key={item.key}
                          className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={config[item.key as keyof ManualGatewayConfig] !== false}
                            onChange={(e) => updateField(item.key as keyof ManualGatewayConfig, e.target.checked)}
                            className="rounded text-teal-600"
                          />
                          <span className="text-xs font-medium text-slate-800">{item.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Countdown Settings */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="font-bold text-slate-900">Show Session Countdown Timer</span>
                      <input
                        type="checkbox"
                        checked={config.countdownEnabled !== false}
                        onChange={(e) => updateField('countdownEnabled', e.target.checked)}
                        className="rounded text-teal-600"
                      />
                    </label>
                    {config.countdownEnabled !== false && (
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] font-semibold text-slate-600">Duration (Minutes):</label>
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={config.countdownMinutes || 15}
                          onChange={(e) => updateField('countdownMinutes', Math.max(1, Number(e.target.value) || 15))}
                          className="w-24 px-3 py-1.5 rounded-xl border border-slate-200 bg-white font-mono text-xs"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === 'copy' && (
                <>
                  <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-1.5">
                    <div className="text-[11px] font-bold text-teal-900 flex items-center gap-1.5">
                      <Sparkles size={13} />
                      <span>Dynamic Variables Supported Everywhere:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                      {['{{brand.name}}', '{{amount}}', '{{customer.name}}', '{{order.no}}', '{{loan.no}}'].map(
                        (v) => (
                          <span key={v} className="bg-white border border-teal-200 text-teal-800 px-2 py-0.5 rounded-md">
                            {v}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Header Page Title</label>
                      <input
                        type="text"
                        value={config.pageTitle || ''}
                        onChange={(e) => updateField('pageTitle', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Header Subtitle</label>
                      <textarea
                        rows={2}
                        value={config.pageSubtitle || ''}
                        onChange={(e) => updateField('pageSubtitle', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">QR Section Heading</label>
                        <input
                          type="text"
                          value={config.qrSectionTitle || ''}
                          onChange={(e) => updateField('qrSectionTitle', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">UPI ID Heading</label>
                        <input
                          type="text"
                          value={config.upiSectionTitle || ''}
                          onChange={(e) => updateField('upiSectionTitle', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Optional Alert / Notice Banner (leave empty to hide)
                      </label>
                      <input
                        type="text"
                        value={config.customNoticeBanner || ''}
                        onChange={(e) => updateField('customNoticeBanner', e.target.value)}
                        placeholder="e.g. Pay exact ₹{{amount}} only. Do not pay via credit card."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>

                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="font-bold text-slate-800">Step-by-Step Instructions</label>
                        <button
                          type="button"
                          onClick={() => updateField('instructions', [...(config.instructions || []), ''])}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                        >
                          <Plus size={12} />
                          <span>Add Step</span>
                        </button>
                      </div>

                      <input
                        type="text"
                        value={config.instructionsTitle || ''}
                        onChange={(e) => updateField('instructionsTitle', e.target.value)}
                        placeholder="Instructions Section Title"
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold"
                      />

                      {(config.instructions || []).map((step, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-[11px] font-mono text-slate-400 w-4">{idx + 1}.</span>
                          <input
                            type="text"
                            value={step}
                            onChange={(e) => {
                              const next = [...(config.instructions || [])];
                              next[idx] = e.target.value;
                              updateField('instructions', next);
                            }}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const next = (config.instructions || []).filter((_, i) => i !== idx);
                              updateField('instructions', next);
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Footer Text</label>
                      <input
                        type="text"
                        value={config.footerText || ''}
                        onChange={(e) => updateField('footerText', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'proof' && (
                <>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <h4 className="font-bold text-slate-900">UTR &amp; Screenshot Form Customization</h4>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Proof Section Title
                      </label>
                      <input
                        type="text"
                        value={config.proofSectionTitle || ''}
                        onChange={(e) => updateField('proofSectionTitle', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>

                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.utrRequired !== false}
                          onChange={(e) => updateField('utrRequired', e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span className="font-semibold text-slate-800">Require UTR / Reference Number</span>
                      </label>
                      <input
                        type="text"
                        value={config.utrLabel || ''}
                        onChange={(e) => updateField('utrLabel', e.target.value)}
                        placeholder="UTR Field Label"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                      <input
                        type="text"
                        value={config.utrPlaceholder || ''}
                        onChange={(e) => updateField('utrPlaceholder', e.target.value)}
                        placeholder="UTR Input Placeholder"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>

                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.screenshotRequired !== false}
                          onChange={(e) => updateField('screenshotRequired', e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span className="font-semibold text-slate-800">Require Payment Screenshot Upload</span>
                      </label>
                      <input
                        type="text"
                        value={config.screenshotLabel || ''}
                        onChange={(e) => updateField('screenshotLabel', e.target.value)}
                        placeholder="Screenshot Upload Label"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>

                    <div className="border-t border-slate-200 pt-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.payerUpiFieldEnabled !== false}
                          onChange={(e) => updateField('payerUpiFieldEnabled', e.target.checked)}
                          className="rounded text-teal-600"
                        />
                        <span className="font-semibold text-slate-800">Show Payer UPI ID / Remarks Input</span>
                      </label>
                      {config.payerUpiFieldEnabled !== false && (
                        <input
                          type="text"
                          value={config.payerUpiLabel || ''}
                          onChange={(e) => updateField('payerUpiLabel', e.target.value)}
                          placeholder="Optional Remark Field Label"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                        />
                      )}
                    </div>

                    <div className="border-t border-slate-200 pt-3">
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">Submit Button Text</label>
                      <input
                        type="text"
                        value={config.submitButtonText || ''}
                        onChange={(e) => updateField('submitButtonText', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>
                  </div>

                  {/* Under Verification Screen Copy */}
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                    <h4 className="font-bold text-slate-900">After-Submit Review Waiting Screen</h4>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Pending Verification Heading
                      </label>
                      <input
                        type="text"
                        value={config.pendingReviewTitle || ''}
                        onChange={(e) => updateField('pendingReviewTitle', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Pending Verification Message
                      </label>
                      <textarea
                        rows={3}
                        value={config.pendingReviewMessage || ''}
                        onChange={(e) => updateField('pendingReviewMessage', e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT LIVE PREVIEW PANE */}
          <div
            className={`lg:col-span-7 bg-slate-100 flex flex-col min-h-0 ${
              showMobilePreview ? 'flex' : 'hidden lg:flex'
            }`}
          >
            <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <CheckCircle2 size={14} className="text-teal-600" />
                <span>Real-Time Customer Preview</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500">Preview with Brand:</span>
                <select
                  value={previewBrandId}
                  onChange={(e) => setPreviewBrandId(e.target.value)}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800 focus:outline-teal-500"
                >
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} (/{b.slug})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5">
              <ManualPaymentCheckout
                token="PREVIEW"
                link={previewLink}
                customer={previewCustomer}
                brand={previewBrand}
                manualConfig={config}
                previewMode
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
