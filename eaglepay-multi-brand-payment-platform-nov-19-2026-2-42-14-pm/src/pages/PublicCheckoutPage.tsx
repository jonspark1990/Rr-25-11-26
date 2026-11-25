import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Lock,
  XCircle,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../services/api.js';
import { ManualPaymentCheckout } from '../components/ManualPaymentCheckout.js';

interface PublicCheckoutProps {
  token: string;
  brandSlug?: string;
  onBackToAdmin?: () => void;
}

export const PublicCheckoutPage: React.FC<PublicCheckoutProps> = ({
  token,
  brandSlug,
  onBackToAdmin,
}) => {
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [manualStarted, setManualStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPublicCheckout(token);
      if (res.success && res.data) {
        setData(res.data);
        if (res.data.brand?.name) {
          document.title = `${res.data.brand.name} - Official Payment Portal`;
        }
      } else {
        setError(res.error || 'Payment link not found or expired.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to load payment details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDetails();
    }
  }, [token]);

  // Expose global callback for templates embedding custom {{payment.button}}
  useEffect(() => {
    (window as any).__initiatePay = () => {
      handlePayNow();
    };
    return () => {
      delete (window as any).__initiatePay;
    };
  });

  // Auto-poll status continuously when waiting for payment confirmation
  useEffect(() => {
    if (!data?.link || data.link.status === 'SUCCESS' || data.link.status === 'EXPIRED') return;

    // Check status every 3.5 seconds
    const interval = setInterval(() => {
      api
        .checkPublicStatus(token)
        .then((res) => {
          if (
            res.status === 'SUCCESS' ||
            (res.link && res.link.status === 'SUCCESS') ||
            (res.status && res.status !== data.link.status)
          ) {
            fetchDetails();
          }
        })
        .catch(() => {});
    }, 3500);

    return () => clearInterval(interval);
  }, [token, data]);

  const handlePayNow = async () => {
    setPaying(true);
    setError(null);
    try {
      const res = await api.initiatePublicPay(token);
      if (res.success && (res.mode === 'manual' || data?.link?.gatewayAdapter === 'manual')) {
        setManualStarted(true);
        await fetchDetails();
        return;
      }

      if (res.success && res.payUrl) {
        // Direct redirect to the configured payment gateway (Eagle Pay or bound gateway)
        window.location.href = res.payUrl;
        return;
      }

      if (res.success) {
        // Refresh status if gateway already updated
        await fetchDetails();
      } else {
        setError(res.error || 'Payment initialization failed. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Checkout initiation failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      await api.checkPublicStatus(token);
      await fetchDetails();
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="flex flex-col items-center gap-3 bg-white p-8 rounded-3xl shadow-xl border border-slate-100">
          <RefreshCw className="animate-spin text-teal-600" size={32} />
          <p className="text-xs font-semibold text-slate-600">Loading secure checkout...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl text-center space-y-4 border border-slate-200">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Payment Link Unavailable</h2>
          <p className="text-xs text-slate-500 leading-relaxed">{error}</p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={fetchDetails}
              className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
            {onBackToAdmin && (
              <button
                onClick={onBackToAdmin}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition flex items-center gap-1.5"
              >
                <ArrowLeft size={13} />
                <span>Return to Admin</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const link = data?.link || {};
  const customer = data?.customer || {};
  const brand = data?.brand || {};
  const manualConfig = data?.manualConfig;

  const isPaid = link.status === 'SUCCESS';
  const isExpired = link.status === 'EXPIRED';
  const isFailed = link.status === 'FAILED';
  const isDisabled = link.isEnabled === false;
  const isManualGateway = link.gatewayAdapter === 'manual';
  const shouldRenderManualCheckout =
    isManualGateway &&
    !isPaid &&
    !isExpired &&
    !isFailed &&
    !isDisabled &&
    (Boolean(manualConfig?.directOpen) ||
      manualStarted ||
      link.status === 'REVIEW_REQUIRED' ||
      link.manualSubmission?.status === 'REJECTED');

  if (shouldRenderManualCheckout) {
    return (
      <ManualPaymentCheckout
        token={token}
        link={link}
        customer={customer}
        brand={brand}
        manualConfig={manualConfig}
        onSubmitted={fetchDetails}
        onCheckStatus={handleCheckStatus}
        onBackToSummary={manualConfig?.directOpen ? undefined : () => setManualStarted(false)}
      />
    );
  }

  const brandName = brand.name || 'Official Payment Portal';
  const brandSlugName = brand.slug || brandSlug || 'pay';
  const primaryColor = brand.primaryColor || '#0f766e';
  const secondaryColor = brand.secondaryColor || '#0d9488';
  const buttonColor = brand.buttonColor || primaryColor;
  const buttonText = brand.buttonText || 'PAY NOW';

  // Format amount
  const amountFormatted = link.amountFormatted || (typeof link.amount === 'number' ? link.amount.toFixed(2) : '0.00');

  // Format order number
  const orderNumber = link.loanOrderNumber || link.merchantOrderNo || 'N/A';

  // Customer display details
  const customerName = customer.name || customer.fullName || link.customerName || 'Customer';
  const rawMobile = customer.mobile || link.customerMobile || '';
  const digits = rawMobile.replace(/[^0-9]/g, '');
  const maskedMobile = digits.length >= 10 ? `${digits.slice(-10, -7)}****${digits.slice(-3)}` : rawMobile || 'Verified Mobile';

  const repaymentDate = link.repaymentDate || (link.expiresAt ? new Date(link.expiresAt).toLocaleDateString('en-GB') : 'Today');
  const panNumber = link.panNumber || customer.panNumber;
  const bankAccount = link.bankAccount || customer.bankAccount;
  const executiveName = link.executiveName || customer.executiveName;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between p-3 sm:p-4 antialiased font-sans"
      style={{ backgroundColor: brand.backgroundColor || '#f0fdfa' }}
    >
      {/* Top Banner if in Preview/Admin Testing Mode */}
      {onBackToAdmin && (
        <div className="w-full max-w-md mb-2 bg-slate-900 text-white px-4 py-2 rounded-2xl flex items-center justify-between text-xs shadow-md border border-slate-800">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Customer Checkout View</span>
          </div>
          <button
            onClick={onBackToAdmin}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white/10 hover:bg-white/20 text-teal-300 font-semibold transition"
          >
            <ArrowLeft size={13} />
            <span>Return to Admin</span>
          </button>
        </div>
      )}

      <div className="max-w-md w-full my-auto space-y-3">
        {/* ========================================================================= */}
        {/* 1. SUCCESS STATE                                                          */}
        {/* ========================================================================= */}
        {isPaid ? (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div
              className="p-8 text-white text-center"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
            >
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-xs">
                <CheckCircle2 size={38} className="text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">{brand.successTitle || 'Payment Successful'}</h2>
              <p className="text-xs text-white/90 mt-1.5 max-w-xs mx-auto leading-relaxed">
                {brand.successMessage || 'Your payment has been received and verified successfully.'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 text-xs space-y-2.5 border border-slate-100">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Amount Paid:</span>
                  <span className="font-extrabold font-mono text-base" style={{ color: primaryColor }}>
                    ₹ {amountFormatted}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Reference Order:</span>
                  <span className="font-mono font-bold text-slate-800">{orderNumber}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Customer Name:</span>
                  <span className="font-bold text-slate-900 uppercase">{customerName}</span>
                </div>
                {link.paidAt && (
                  <div className="flex justify-between items-center text-slate-600">
                    <span>Payment Time:</span>
                    <span className="font-mono text-slate-700">{new Date(link.paidAt).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-200/70">
                  <span>Status:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    <span>Verified &amp; Settled</span>
                  </span>
                </div>
              </div>

              <div className="text-center text-xs text-slate-400 py-1">
                Thank you for choosing {brandName}. Your account records have been updated.
              </div>
            </div>
          </div>
        ) : isFailed ? (
          /* ========================================================================= */
          /* 2. FAILED STATE                                                           */
          /* ========================================================================= */
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
            <div className="p-8 bg-rose-600 text-white text-center">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
                <XCircle size={36} className="text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">{brand.failedTitle || 'Payment Unsuccessful'}</h2>
              <p className="text-xs text-white/90 mt-1 max-w-xs mx-auto leading-relaxed">
                {brand.failedMessage || 'Transaction could not be completed. Please try again.'}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-rose-50 rounded-2xl p-4 text-xs space-y-2 border border-rose-100">
                <div className="flex justify-between text-slate-600">
                  <span>Amount:</span>
                  <span className="font-bold font-mono text-slate-900">₹ {amountFormatted}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Order Ref:</span>
                  <span className="font-mono text-slate-800">{orderNumber}</span>
                </div>
              </div>

              <button
                onClick={handlePayNow}
                disabled={paying}
                className="flex items-center justify-center gap-2 w-full py-4 px-4 rounded-2xl text-white font-extrabold text-sm shadow-lg transition active:scale-98 cursor-pointer"
                style={{ backgroundColor: buttonColor }}
              >
                <span>{paying ? 'Connecting...' : 'Try Again'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : isExpired ? (
          /* ========================================================================= */
          /* 3. EXPIRED STATE                                                          */
          /* ========================================================================= */
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <Clock size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Payment Link Expired</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              This payment link has expired past its validity window. Please contact {brandName} to receive an updated link.
            </p>
          </div>
        ) : isDisabled ? (
          /* ========================================================================= */
          /* 4. DISABLED STATE                                                         */
          /* ========================================================================= */
          <div className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-xl font-bold text-slate-900">Link Inactive</h2>
            <p className="text-xs text-slate-500">This payment link has been temporarily deactivated.</p>
          </div>
        ) : (
          /* ========================================================================= */
          /* 5. ACTIVE PAYMENT CHECKOUT CARD (Clean, Professional, Whitelabel)          */
          /* ========================================================================= */
          <div className="space-y-3">
            {error && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle size={15} />
                <span>{error}</span>
              </div>
            )}

            {/* Top Card: Brand Gradient Header with Amounts & Due Date */}
            <div className="rounded-3xl shadow-lg overflow-hidden border border-slate-100 bg-white">
              <div
                className="px-6 py-5 text-white text-center rounded-t-3xl relative"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})` }}
              >
                <div className="inline-flex items-center justify-center gap-2 mb-1 bg-white/10 px-3.5 py-1 rounded-2xl backdrop-blur-xs">
                  {brand.logoUrl && (
                    <img
                      src={brand.logoUrl}
                      alt={brandName}
                      className="w-6 h-6 rounded-md object-contain bg-white p-0.5"
                      onError={(e: any) => (e.target.style.display = 'none')}
                    />
                  )}
                  <span className="text-xl font-bold tracking-tight text-white">{brandName}</span>
                </div>
                <div className="text-xs text-white/90 font-medium">
                  Mobile Number: <span className="font-mono">{maskedMobile}</span>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-2 gap-4 pb-4">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400">Total Payable Amount</span>
                    <div className="text-2xl font-extrabold font-mono mt-1" style={{ color: primaryColor }}>
                      ₹ {amountFormatted}
                    </div>
                  </div>
                  <div className="border-l border-slate-100 pl-4">
                    <span className="text-[11px] font-semibold text-slate-400">Repayment Date</span>
                    <div className="text-xl font-bold font-mono text-slate-800 mt-1">
                      {repaymentDate}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-dashed border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Order NO. <span className="font-mono font-medium text-slate-700 ml-1">{orderNumber}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                    Link Pending
                  </span>
                </div>
              </div>
            </div>

            {/* Second Card: KYC & Loan Details */}
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 p-5 space-y-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 pb-1 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-teal-600" />
                <span>KYC &amp; Loan Details</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Customer Name</span>
                  <span className="font-bold text-slate-900 uppercase">{customerName}</span>
                </div>

                {panNumber && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">PAN Number</span>
                    <span className="font-mono font-bold text-slate-900">{panNumber}</span>
                  </div>
                )}

                {bankAccount && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-medium">Bank Account / UPI</span>
                    <span className="font-medium text-slate-900 font-mono text-right text-[11px]">{bankAccount}</span>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-dashed border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-700">
                  <span className="font-medium">{brandName} ({orderNumber})</span>
                  <span className="font-mono font-bold">₹ {amountFormatted}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">Total Payable</span>
                  <span className="text-sm font-extrabold font-mono" style={{ color: primaryColor }}>
                    ₹ {amountFormatted}
                  </span>
                </div>

                {executiveName && (
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Executive Name</span>
                    <span className="font-medium text-slate-800">{executiveName}</span>
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-400 text-center pt-2 leading-relaxed">
                I have read and agreed to {brandName}'s <span className="underline cursor-pointer" style={{ color: primaryColor }}>Sanction Letter</span> and <span className="underline cursor-pointer" style={{ color: primaryColor }}>Loan Service Contract</span>.
              </p>
            </div>

            {/* Bottom Pay Action Button (PAY NOW / PROCEED TO PAY) */}
            <div className="pt-2">
              <button
                onClick={handlePayNow}
                disabled={paying}
                className="w-full py-4 px-6 rounded-2xl text-white font-extrabold text-sm shadow-xl transition transform active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                style={{ backgroundColor: buttonColor }}
              >
                {paying ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Connecting to Payment Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>{buttonText}</span>
                    <span>•</span>
                    <span className="font-mono">₹ {amountFormatted}</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Brand Support & Encrypted Footer */}
        <div className="text-center pt-3 pb-6">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
            <Lock size={12} className="text-slate-500" />
            <span>256-bit Encrypted Official Checkout • {brandName}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
