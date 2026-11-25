import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  ImagePlus,
  Info,
  Lock,
  Mail,
  Phone,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from 'lucide-react';
import { ManualGatewayConfig, ManualSubmission } from '../types/index.js';
import {
  compressImageToDataUrl,
  DEFAULT_MANUAL_GATEWAY_CONFIG,
  interpolateManualText,
} from '../utils/manualGatewayDefaults.js';
import { api } from '../services/api.js';

interface ManualPaymentCheckoutProps {
  token: string;
  link: {
    token?: string;
    amount?: number;
    amountFormatted?: string;
    currency?: string;
    description?: string;
    merchantOrderNo?: string;
    loanOrderNumber?: string;
    repaymentDate?: string;
    panNumber?: string;
    executiveName?: string;
    status?: string;
    expiresAt?: string;
    manualSubmission?: Partial<ManualSubmission>;
  };
  customer: {
    name?: string;
    fullName?: string;
    mobile?: string;
    email?: string;
    panNumber?: string;
    executiveName?: string;
  };
  brand: {
    name?: string;
    slug?: string;
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    backgroundColor?: string;
    buttonColor?: string;
    supportEmail?: string;
    supportPhone?: string;
  };
  manualConfig?: Partial<ManualGatewayConfig>;
  onSubmitted?: () => Promise<void> | void;
  onCheckStatus?: () => Promise<void> | void;
  onBackToSummary?: () => void;
  previewMode?: boolean;
}

export const ManualPaymentCheckout: React.FC<ManualPaymentCheckoutProps> = ({
  token,
  link,
  customer,
  brand,
  manualConfig: incomingConfig,
  onSubmitted,
  onCheckStatus,
  onBackToSummary,
  previewMode = false,
}) => {
  const cfg: ManualGatewayConfig = useMemo(
    () => ({
      ...DEFAULT_MANUAL_GATEWAY_CONFIG,
      ...(incomingConfig || {}),
    }),
    [incomingConfig]
  );

  // Colors resolved from Brand OR Custom override
  const primaryColor = cfg.useBrandTheme !== false ? brand.primaryColor || '#0f766e' : cfg.customPrimaryColor || '#0f766e';
  const secondaryColor =
    cfg.useBrandTheme !== false ? brand.secondaryColor || '#0d9488' : cfg.customSecondaryColor || '#0d9488';
  const backgroundColor =
    cfg.useBrandTheme !== false ? brand.backgroundColor || '#f0fdfa' : cfg.customBackgroundColor || '#f0fdfa';
  const buttonColor =
    cfg.useBrandTheme !== false ? brand.buttonColor || primaryColor : cfg.customButtonColor || primaryColor;

  const brandName = brand.name || 'Merchant Portal';
  const amountFormatted =
    link.amountFormatted || (typeof link.amount === 'number' ? link.amount.toFixed(2) : '0.00');
  const orderNumber = link.merchantOrderNo || 'ORD-REF';
  const loanOrderNo = link.loanOrderNumber || orderNumber;
  const customerName = customer.name || customer.fullName || 'Valued Customer';
  const rawMobile = customer.mobile || '';
  const mobileDigits = rawMobile.replace(/[^0-9]/g, '');
  const maskedMobile =
    mobileDigits.length >= 10
      ? `${mobileDigits.slice(-10, -7)}****${mobileDigits.slice(-3)}`
      : rawMobile || 'Verified Mobile';
  const repaymentDate =
    link.repaymentDate || (link.expiresAt ? new Date(link.expiresAt).toLocaleDateString('en-GB') : 'Today');
  const panNumber = link.panNumber || customer.panNumber;
  const executiveName = link.executiveName || customer.executiveName;

  const vars = {
    brandName,
    amount: amountFormatted,
    customerName,
    orderNo: orderNumber,
    loanNo: loanOrderNo,
  };

  const t = (text?: string) => interpolateManualText(text, vars);

  const payeeName = cfg.useBrandNameAsPayee !== false ? brandName : cfg.upiPayeeName || brandName;
  const cleanUpiId = (cfg.upiId || '').trim();

  const upiUri = useMemo(() => {
    if (!cleanUpiId) return '';
    const params = new URLSearchParams({
      pa: cleanUpiId,
      pn: payeeName,
      am: amountFormatted,
      cu: 'INR',
      tn: `${loanOrderNo} ${brandName}`.slice(0, 50),
    });
    return `upi://pay?${params.toString()}`;
  }, [cleanUpiId, payeeName, amountFormatted, loanOrderNo, brandName]);

  const [dynamicQrDataUrl, setDynamicQrDataUrl] = useState<string>('');
  const [activeQrTab, setActiveQrTab] = useState<'dynamic' | 'custom'>('dynamic');

  useEffect(() => {
    if (!upiUri || (cfg.qrMode === 'custom_image' && cfg.customQrImageUrl)) {
      setDynamicQrDataUrl('');
      return;
    }
    QRCode.toDataURL(upiUri, {
      width: 300,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setDynamicQrDataUrl)
      .catch(() => setDynamicQrDataUrl(''));
  }, [upiUri, cfg.qrMode, cfg.customQrImageUrl]);

  useEffect(() => {
    if (cfg.qrMode === 'custom_image') {
      setActiveQrTab('custom');
    } else {
      setActiveQrTab('dynamic');
    }
  }, [cfg.qrMode]);

  // Countdown timer
  const initialSeconds = Math.max(1, Number(cfg.countdownMinutes || 15)) * 60;
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    setSecondsLeft(Math.max(1, Number(cfg.countdownMinutes || 15)) * 60);
  }, [cfg.countdownMinutes, cfg.countdownEnabled]);

  useEffect(() => {
    if (cfg.countdownEnabled === false || previewMode || link.status === 'REVIEW_REQUIRED') return;
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cfg.countdownEnabled, previewMode, link.status]);

  const formattedCountdown = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(
    secondsLeft % 60
  ).padStart(2, '0')}`;

  // Copy states
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyText = (val: string, label: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Proof submission form state
  const [utrNumber, setUtrNumber] = useState('');
  const [payerNote, setPayerNote] = useState('');
  const [screenshotDataUrl, setScreenshotDataUrl] = useState('');
  const [screenshotName, setScreenshotName] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSubmitError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    setSubmitError(null);
    setCompressing(true);
    try {
      const compressed = await compressImageToDataUrl(file, 1200, 0.8);
      setScreenshotDataUrl(compressed);
      setScreenshotName(file.name);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to process screenshot.');
    } finally {
      setCompressing(false);
    }
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (previewMode) return;

    setSubmitError(null);
    if (cfg.utrRequired !== false && utrNumber.trim().length < 4) {
      setSubmitError('Please enter a valid 12-digit UTR / Reference Number.');
      return;
    }
    if (cfg.screenshotRequired !== false && !screenshotDataUrl) {
      setSubmitError('Please upload your payment screenshot before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.submitManualPaymentProof(token, {
        utrNumber: utrNumber.trim(),
        screenshotDataUrl: screenshotDataUrl || undefined,
        payerNote: payerNote.trim() || undefined,
      });
      if (res.success) {
        if (onSubmitted) await onSubmitted();
      } else {
        setSubmitError(res.error || 'Could not submit payment proof.');
      }
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit payment proof.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualStatusRefresh = async () => {
    if (!onCheckStatus || previewMode) return;
    setChecking(true);
    try {
      await onCheckStatus();
    } finally {
      setChecking(false);
    }
  };

  const handleDownloadQr = () => {
    const src =
      activeQrTab === 'custom' && cfg.customQrImageUrl ? cfg.customQrImageUrl : dynamicQrDataUrl;
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = `${brandName.toLowerCase().replace(/\s+/g, '-')}-upi-qr-${amountFormatted}.png`;
    a.click();
  };

  const isUnderReview = !previewMode && link.status === 'REVIEW_REQUIRED';
  const isRejected = !previewMode && link.manualSubmission?.status === 'REJECTED' && link.status !== 'REVIEW_REQUIRED';
  const showDualQrSwitch =
    cfg.qrMode === 'both' && Boolean(dynamicQrDataUrl) && Boolean(cfg.customQrImageUrl);
  const displayedQrSrc =
    cfg.qrMode === 'custom_image'
      ? cfg.customQrImageUrl || dynamicQrDataUrl
      : cfg.qrMode === 'both'
      ? activeQrTab === 'custom'
        ? cfg.customQrImageUrl || dynamicQrDataUrl
        : dynamicQrDataUrl || cfg.customQrImageUrl
      : dynamicQrDataUrl || cfg.customQrImageUrl;

  const isSplit = cfg.layoutStyle !== 'centered';

  // Review waiting state screen
  if (isUnderReview) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-4 antialiased font-sans"
        style={{ backgroundColor }}
      >
        <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
          <div
            className="px-6 py-6 text-white text-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
          >
            {cfg.showBrandLogo !== false && brand.logoUrl && (
              <img
                src={brand.logoUrl}
                alt={brandName}
                className="w-11 h-11 rounded-xl object-contain bg-white p-1 mx-auto mb-2.5 border border-white/20"
                onError={(e: any) => (e.target.style.display = 'none')}
              />
            )}
            <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3">
              <Clock size={26} className="text-white" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">
              {t(cfg.pendingReviewTitle) || 'Payment Proof Under Review'}
            </h2>
            {cfg.showBrandName !== false && (
              <p className="text-xs text-white/85 mt-1 font-medium">{brandName}</p>
            )}
          </div>

          <div className="p-6 space-y-5">
            <p className="text-xs text-slate-600 text-center leading-relaxed">
              {t(cfg.pendingReviewMessage)}
            </p>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-xs">
              {cfg.showAmount !== false && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Declared Amount</span>
                  <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                    ₹ {amountFormatted}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Submitted UTR / Ref</span>
                <button
                  type="button"
                  onClick={() => copyText(link.manualSubmission?.utrNumber || '', 'utr')}
                  className="font-mono font-bold text-slate-900 flex items-center gap-1.5 hover:text-teal-700 cursor-pointer"
                >
                  <span>{link.manualSubmission?.utrNumber || 'Submitted'}</span>
                  {copiedField === 'utr' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                </button>
              </div>
              {cfg.showOrderNumber !== false && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Order Reference</span>
                  <span className="font-mono font-semibold text-slate-700">{orderNumber}</span>
                </div>
              )}
              {link.manualSubmission?.submittedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Submitted Time</span>
                  <span className="font-mono text-slate-600">
                    {new Date(link.manualSubmission.submittedAt).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="text-slate-500">Verification Status</span>
                <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-md">
                  Awaiting Accounts Approval
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleManualStatusRefresh}
              disabled={checking}
              className="w-full py-3 px-4 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 transition hover:opacity-95 cursor-pointer disabled:opacity-70"
              style={{ backgroundColor: buttonColor }}
            >
              <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
              <span>{checking ? 'Checking Approval Status...' : 'Check Verification Status'}</span>
            </button>

            {cfg.showBrandSupport !== false && (brand.supportEmail || brand.supportPhone) && (
              <div className="pt-2 border-t border-slate-100 text-center text-[11px] text-slate-500 space-y-1">
                <div>Need help with verification?</div>
                <div className="flex items-center justify-center gap-3 font-medium text-slate-700">
                  {brand.supportPhone && (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} />
                      {brand.supportPhone}
                    </span>
                  )}
                  {brand.supportEmail && (
                    <span className="inline-flex items-center gap-1">
                      <Mail size={11} />
                      {brand.supportEmail}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={
        previewMode
          ? 'w-full rounded-2xl p-4 sm:p-5 antialiased font-sans border border-slate-200'
          : 'min-h-screen w-full py-5 px-3 sm:px-6 antialiased font-sans'
      }
      style={{ backgroundColor }}
    >
      <div className={`${isSplit ? 'max-w-5xl' : 'max-w-xl'} mx-auto space-y-4`}>
        {/* Top Return / Header Bar */}
        {onBackToSummary && !cfg.directOpen && (
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBackToSummary}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-xs transition cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to Summary</span>
            </button>
          </div>
        )}

        {/* Main Branded Header Strip */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div
            className="px-5 py-4 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {cfg.showBrandLogo !== false && brand.logoUrl && (
                <img
                  src={brand.logoUrl}
                  alt={brandName}
                  className="w-11 h-11 rounded-xl object-contain bg-white p-1 shrink-0 border border-white/20"
                  onError={(e: any) => (e.target.style.display = 'none')}
                />
              )}
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-bold tracking-tight truncate">
                  {t(cfg.pageTitle) || `${brandName} Direct UPI Checkout`}
                </h1>
                {cfg.pageSubtitle && (
                  <p className="text-xs text-white/85 leading-snug mt-0.5 line-clamp-2">
                    {t(cfg.pageSubtitle)}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {cfg.countdownEnabled !== false && (
                <div className="bg-black/20 border border-white/15 px-3 py-1.5 rounded-xl text-right">
                  <div className="text-[10px] uppercase tracking-wider text-white/75 font-semibold">
                    Session Timer
                  </div>
                  <div className="font-mono font-bold text-sm tabular-nums">{formattedCountdown}</div>
                </div>
              )}
              {cfg.showAmount !== false && (
                <div className="bg-white text-slate-900 px-3.5 py-1.5 rounded-xl text-right shadow-xs">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                    Payable
                  </div>
                  <div
                    className="font-mono font-extrabold text-base sm:text-lg tabular-nums"
                    style={{ color: primaryColor }}
                  >
                    ₹ {amountFormatted}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Optional Custom Notice Banner */}
          {cfg.customNoticeBanner?.trim() && (
            <div className="px-5 py-2.5 bg-amber-50 border-t border-amber-200 text-amber-900 text-xs flex items-center gap-2 font-medium">
              <Info size={14} className="text-amber-600 shrink-0" />
              <span>{t(cfg.customNoticeBanner)}</span>
            </div>
          )}
        </div>

        {/* Rejected Submission Banner */}
        {isRejected && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-rose-900">
            <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-rose-950">Previous Payment Proof Needs Correction</div>
              <p className="text-rose-800 leading-relaxed">
                {link.manualSubmission?.reviewNote ||
                  'Your previous UTR or screenshot could not be matched. Please verify and submit your updated payment details below.'}
              </p>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className={isSplit ? 'grid grid-cols-1 lg:grid-cols-12 gap-4 items-start' : 'space-y-4'}>
          {/* LEFT COLUMN: QR Code, UPI ID, Apps, Bank Transfer, Instructions */}
          <div className={isSplit ? 'lg:col-span-6 space-y-4' : 'space-y-4'}>
            {/* QR & UPI Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <QrCode size={16} style={{ color: primaryColor }} />
                    <span>{t(cfg.qrSectionTitle) || `Scan & Pay ₹${amountFormatted}`}</span>
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Payee: <span className="font-semibold text-slate-800">{payeeName}</span>
                  </p>
                </div>

                {showDualQrSwitch && (
                  <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setActiveQrTab('dynamic')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                        activeQrTab === 'dynamic'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Amount QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveQrTab('custom')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition cursor-pointer ${
                        activeQrTab === 'custom'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Merchant QR
                    </button>
                  </div>
                )}
              </div>

              {/* QR Display Box */}
              {displayedQrSrc ? (
                <div className="flex flex-col items-center bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-3">
                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                    <img
                      src={displayedQrSrc}
                      alt="UPI Payment QR Code"
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {cfg.showAmount !== false && (
                      <span className="text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1 rounded-lg border border-slate-200 tabular-nums">
                        Amount: ₹{amountFormatted}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 transition cursor-pointer"
                    >
                      <Download size={13} />
                      <span>Save QR</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 text-center text-xs text-slate-500">
                  Use the UPI ID or Bank Transfer details below to complete your payment.
                </div>
              )}

              {/* Copy UPI ID Section */}
              {cleanUpiId && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {t(cfg.upiSectionTitle) || 'Or Pay Directly to UPI ID'}
                  </div>
                  <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sm text-slate-900 truncate">{cleanUpiId}</div>
                      <div className="text-[11px] text-slate-500 truncate">Merchant: {payeeName}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(cleanUpiId, 'upi')}
                      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition hover:opacity-95 cursor-pointer"
                      style={{ backgroundColor: buttonColor }}
                    >
                      {copiedField === 'upi' ? <Check size={13} /> : <Copy size={13} />}
                      <span>{copiedField === 'upi' ? 'Copied' : 'Copy UPI'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Launch UPI Apps */}
              {cfg.showUpiApps !== false && upiUri && (
                <div className="space-y-2 pt-1">
                  <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                    <Smartphone size={13} />
                    <span>Instant Pay via Installed UPI App</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'GPay', href: upiUri.replace('upi://pay', 'tez://upi/pay') },
                      { label: 'PhonePe', href: upiUri.replace('upi://pay', 'phonepe://pay') },
                      { label: 'Paytm', href: upiUri.replace('upi://pay', 'paytmmp://pay') },
                      { label: 'Any UPI', href: upiUri },
                    ].map((app) => (
                      <a
                        key={app.label}
                        href={previewMode ? undefined : app.href}
                        onClick={(e) => {
                          if (previewMode) e.preventDefault();
                        }}
                        className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 transition text-center cursor-pointer"
                      >
                        <span>{app.label}</span>
                        <ExternalLink size={11} className="text-slate-400" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Optional Bank Transfer Details */}
              {cfg.showBankDetails && cfg.bankAccountNumber && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Building2 size={14} style={{ color: primaryColor }} />
                    <span>IMPS / NEFT Bank Transfer</span>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 space-y-1.5 text-xs">
                    {cfg.bankHolderName && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Account Name</span>
                        <span className="font-semibold text-slate-900">{cfg.bankHolderName}</span>
                      </div>
                    )}
                    {cfg.bankName && (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Bank Name</span>
                        <span className="font-semibold text-slate-900">{cfg.bankName}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Account No.</span>
                      <button
                        type="button"
                        onClick={() => copyText(cfg.bankAccountNumber || '', 'bankAcc')}
                        className="font-mono font-bold text-slate-900 inline-flex items-center gap-1 hover:text-teal-700 cursor-pointer"
                      >
                        <span>{cfg.bankAccountNumber}</span>
                        {copiedField === 'bankAcc' ? (
                          <Check size={12} className="text-emerald-600" />
                        ) : (
                          <Copy size={12} className="text-slate-400" />
                        )}
                      </button>
                    </div>
                    {cfg.bankIfsc && (
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-slate-500">IFSC Code</span>
                        <button
                          type="button"
                          onClick={() => copyText(cfg.bankIfsc || '', 'ifsc')}
                          className="font-mono font-bold text-slate-900 inline-flex items-center gap-1 hover:text-teal-700 cursor-pointer"
                        >
                          <span>{cfg.bankIfsc}</span>
                          {copiedField === 'ifsc' ? (
                            <Check size={12} className="text-emerald-600" />
                          ) : (
                            <Copy size={12} className="text-slate-400" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Instructions Card */}
            {Array.isArray(cfg.instructions) && cfg.instructions.filter((i) => i.trim()).length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  {t(cfg.instructionsTitle) || 'Payment Instructions'}
                </h3>
                <ol className="space-y-2 text-xs text-slate-600">
                  {cfg.instructions
                    .filter((line) => line.trim())
                    .map((step, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
                        <span
                          className="w-5 h-5 rounded-md text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {idx + 1}
                        </span>
                        <span>{t(step)}</span>
                      </li>
                    ))}
                </ol>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Fetched Brand & Customer Details + Proof Upload Form */}
          <div className={isSplit ? 'lg:col-span-6 space-y-4' : 'space-y-4'}>
            {/* Dynamic Brand & Link Details Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <ShieldCheck size={14} style={{ color: primaryColor }} />
                  <span>Account &amp; Order Details</span>
                </h3>
                {cfg.showBrandName !== false && (
                  <span className="text-xs font-bold" style={{ color: primaryColor }}>
                    {brandName}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
                {cfg.showCustomerName !== false && (
                  <div className="flex sm:block justify-between">
                    <div className="text-[11px] text-slate-400">Customer Name</div>
                    <div className="font-bold text-slate-900 uppercase">{customerName}</div>
                  </div>
                )}
                {cfg.showCustomerMobile !== false && (
                  <div className="flex sm:block justify-between">
                    <div className="text-[11px] text-slate-400">Registered Mobile</div>
                    <div className="font-mono font-semibold text-slate-800">{maskedMobile}</div>
                  </div>
                )}
                {cfg.showLoanOrderNumber !== false && loanOrderNo && (
                  <div className="flex sm:block justify-between">
                    <div className="text-[11px] text-slate-400">Loan Order No.</div>
                    <div className="font-mono font-semibold text-slate-800">{loanOrderNo}</div>
                  </div>
                )}
                {cfg.showOrderNumber !== false && (
                  <div className="flex sm:block justify-between">
                    <div className="text-[11px] text-slate-400">Payment Ref</div>
                    <div className="font-mono font-medium text-slate-700 truncate">{orderNumber}</div>
                  </div>
                )}
                {cfg.showRepaymentDate !== false && (
                  <div className="flex sm:block justify-between">
                    <div className="text-[11px] text-slate-400">Due / Repayment Date</div>
                    <div className="font-mono font-semibold text-slate-800">{repaymentDate}</div>
                  </div>
                )}
                {cfg.showPanNumber !== false && panNumber && (
                  <div className="flex sm:block justify-between">
                    <div className="text-[11px] text-slate-400">PAN Number</div>
                    <div className="font-mono font-semibold text-slate-800">{panNumber}</div>
                  </div>
                )}
                {cfg.showExecutiveName !== false && executiveName && (
                  <div className="flex sm:block justify-between">
                    <div className="text-[11px] text-slate-400">Assigned Executive</div>
                    <div className="font-semibold text-slate-800">{executiveName}</div>
                  </div>
                )}
                {cfg.showAmount !== false && (
                  <div className="flex sm:block justify-between">
                    <div className="text-[11px] text-slate-400">Payable Amount</div>
                    <div className="font-mono font-extrabold text-sm tabular-nums" style={{ color: primaryColor }}>
                      ₹ {amountFormatted}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Proof Form Card */}
            <form
              onSubmit={handleSubmitProof}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4"
            >
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 size={16} style={{ color: primaryColor }} />
                  <span>{t(cfg.proofSectionTitle) || 'Submit Payment Proof'}</span>
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  After completing your UPI/Bank transfer, upload proof below so our team can approve immediately.
                </p>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertTriangle size={14} className="text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* UTR Input */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t(cfg.utrLabel) || 'UTR / UPI Reference Number'}
                  {cfg.utrRequired !== false && <span className="text-rose-600 ml-0.5">*</span>}
                </label>
                <input
                  type="text"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  required={cfg.utrRequired !== false && !previewMode}
                  disabled={previewMode}
                  placeholder={cfg.utrPlaceholder || 'Enter 12-digit UTR / Transaction Ref No.'}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600 bg-white"
                />
              </div>

              {/* Screenshot Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t(cfg.screenshotLabel) || 'Payment Screenshot'}
                  {cfg.screenshotRequired !== false && <span className="text-rose-600 ml-0.5">*</span>}
                </label>

                {screenshotDataUrl ? (
                  <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={screenshotDataUrl}
                        alt="Uploaded payment proof"
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200 bg-white shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {screenshotName || 'Payment_Screenshot.jpg'}
                        </div>
                        <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-0.5">
                          <CheckCircle2 size={12} />
                          <span>Ready to submit</span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setScreenshotDataUrl('');
                        setScreenshotName('');
                      }}
                      className="p-2 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Remove screenshot"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ) : (
                  <label
                    className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-5 bg-slate-50 hover:bg-slate-100/70 transition text-center ${
                      previewMode ? 'cursor-default opacity-80' : 'cursor-pointer'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                      {compressing ? <RefreshCw size={18} className="animate-spin" /> : <ImagePlus size={18} />}
                    </div>
                    <div className="text-xs font-semibold text-slate-700">
                      {compressing ? 'Optimizing image...' : 'Click to upload payment screenshot'}
                    </div>
                    <div className="text-[11px] text-slate-400">PNG, JPG or JPEG showing UTR &amp; Paid status</div>
                    {!previewMode && (
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileChange(e.target.files?.[0])}
                      />
                    )}
                  </label>
                )}
              </div>

              {/* Optional Payer UPI ID / Remarks */}
              {cfg.payerUpiFieldEnabled !== false && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    {t(cfg.payerUpiLabel) || 'Payer UPI ID / Remarks (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={payerNote}
                    onChange={(e) => setPayerNote(e.target.value)}
                    disabled={previewMode}
                    placeholder="e.g. yourname@okicici or bank reference note"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-600 bg-white"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || compressing || previewMode}
                className="w-full py-3.5 px-5 rounded-xl text-white font-bold text-sm shadow-md transition hover:opacity-95 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                style={{ backgroundColor: buttonColor }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Submitting Verification Proof...</span>
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    <span>{t(cfg.submitButtonText) || 'Submit Payment for Verification'}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Brand Support & Footer */}
        <div className="text-center pt-1 pb-4 space-y-1.5">
          {cfg.showBrandSupport !== false && (brand.supportEmail || brand.supportPhone) && (
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-600 font-medium">
              {brand.supportPhone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} />
                  <span>{brand.supportPhone}</span>
                </span>
              )}
              {brand.supportEmail && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} />
                  <span>{brand.supportEmail}</span>
                </span>
              )}
            </div>
          )}
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
            <Lock size={11} />
            <span>{t(cfg.footerText) || `Official Manual UPI Verification • ${brandName}`}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
