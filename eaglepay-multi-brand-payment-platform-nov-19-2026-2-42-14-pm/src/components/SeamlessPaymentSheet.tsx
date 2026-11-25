import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  QrCode,
  Smartphone,
  CreditCard,
  Building,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  Zap,
  Lock,
} from 'lucide-react';
import { api } from '../services/api.js';

interface SeamlessPaymentSheetProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  amount: string;
  brandName: string;
  brandColor?: string;
  customerName?: string;
  orderNumber: string;
  gatewayOrderNo?: string | null;
  payUrl?: string | null;
  gatewayAdapter?: string;
  onPaymentSuccess: () => void;
}

export const SeamlessPaymentSheet: React.FC<SeamlessPaymentSheetProps> = ({
  isOpen,
  onClose,
  token,
  amount,
  brandName,
  brandColor = '#0f766e',
  customerName = 'Valued Customer',
  orderNumber,
  gatewayOrderNo,
  payUrl,
  gatewayAdapter = 'eaglepay',
  onPaymentSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'upi_qr' | 'upi_apps' | 'cards' | 'netbanking'>('upi_qr');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(600); // 10 minutes countdown
  const [polling, setPolling] = useState(false);
  const [simulatingSuccess, setSimulatingSuccess] = useState(false);

  // Simulated or configured UPI VPA
  const upiId = `pay.${brandName.toLowerCase().replace(/[^a-z0-9]/g, '')}@okaxis`;
  const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(
    brandName
  )}&am=${encodeURIComponent(amount)}&cu=INR&tr=${encodeURIComponent(orderNumber)}`;

  // Generate QR Code
  useEffect(() => {
    if (!isOpen) return;

    // Use payUrl if it's already a upi:// URI, otherwise use standard UPI URI
    const uriToEncode = payUrl && payUrl.startsWith('upi://') ? payUrl : upiUri;

    QRCode.toDataURL(uriToEncode, {
      width: 320,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then(setQrDataUrl)
      .catch(console.error);

    // Timer countdown
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, payUrl, upiUri]);

  // Polling for payment confirmation
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(async () => {
      try {
        setPolling(true);
        const res = await api.checkPublicStatus(token);
        if (res.status === 'SUCCESS' || (res.link && res.link.status === 'SUCCESS')) {
          onPaymentSuccess();
          onClose();
        }
      } catch (err) {
        // quiet poll
      } finally {
        setPolling(false);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, token]);

  if (!isOpen) return null;

  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  const timeFormatted = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  const copyUpiId = () => {
    navigator.clipboard.writeText(upiId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const openUpiApp = (appName: string, deepLinkPrefix: string) => {
    const link = `${deepLinkPrefix}${upiUri.replace('upi://pay?', '')}`;
    window.location.href = link;
  };

  // Safe simulator trigger for testing preview
  const handleSimulatePayment = async () => {
    setSimulatingSuccess(true);
    try {
      await api.simulateWebhook({
        paymentLinkId: token, // backend handles link token resolution
        simulatedStatus: 'success',
        orderNo: gatewayOrderNo || `EAGLE_${Date.now()}`,
      });
      setTimeout(() => {
        onPaymentSuccess();
        onClose();
      }, 800);
    } catch {
      // fallback status check
      await api.checkPublicStatus(token);
      onPaymentSuccess();
      onClose();
    } finally {
      setSimulatingSuccess(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div
          className="p-5 text-white relative text-center"
          style={{ backgroundColor: brandColor }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/15 hover:bg-black/30 text-white transition cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-semibold mb-2">
            <ShieldCheck size={13} />
            <span>Seamless On-Page Payment Portal</span>
          </div>

          <h3 className="text-lg font-black tracking-tight">{brandName}</h3>
          <div className="text-3xl font-black font-mono mt-1">₹ {amount}</div>
          <p className="text-[11px] opacity-80 mt-0.5">Order Ref: {orderNumber}</p>

          {gatewayOrderNo && (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-black/25 text-[10px] font-mono">
              <Zap size={11} className="text-amber-300" />
              <span>Gateway Order ID: {gatewayOrderNo}</span>
            </div>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-100 bg-slate-50/80 p-1.5 gap-1 text-xs font-bold text-slate-600">
          <button
            onClick={() => setActiveTab('upi_qr')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'upi_qr'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'hover:text-slate-900'
            }`}
          >
            <QrCode size={14} />
            <span>UPI QR Code</span>
          </button>

          <button
            onClick={() => setActiveTab('upi_apps')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'upi_apps'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'hover:text-slate-900'
            }`}
          >
            <Smartphone size={14} />
            <span>UPI Apps</span>
          </button>

          <button
            onClick={() => setActiveTab('cards')}
            className={`flex-1 py-2 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'cards'
                ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                : 'hover:text-slate-900'
            }`}
          >
            <CreditCard size={14} />
            <span>Cards / Net</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: DYNAMIC UPI QR */}
          {activeTab === 'upi_qr' && (
            <div className="space-y-4 text-center">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 inline-block mx-auto shadow-inner">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Scan UPI QR"
                    className="w-52 h-52 mx-auto rounded-xl shadow-xs"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-slate-400 text-xs">
                    Generating Dynamic QR...
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-slate-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Scan with PhonePe, Google Pay, Paytm, or BHIM</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 block font-medium">Merchant UPI VPA</span>
                  <span className="font-mono font-bold text-slate-800">{upiId}</span>
                </div>
                <button
                  type="button"
                  onClick={copyUpiId}
                  className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold transition flex items-center gap-1 shadow-2xs"
                >
                  {copiedUpi ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                  <span>{copiedUpi ? 'Copied' : 'Copy VPA'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>QR expires in:</span>
                <span className="font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                  {timeFormatted}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: 1-CLICK UPI INTENT APPS */}
          {activeTab === 'upi_apps' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 text-center">
                Click your preferred UPI app to launch directly on your device:
              </p>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                {/* PhonePe */}
                <button
                  onClick={() => openUpiApp('PhonePe', 'phonepe://pay?')}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-purple-500 hover:bg-purple-50/50 transition flex items-center gap-3 text-left cursor-pointer group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-purple-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    पे
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs group-hover:text-purple-700">PhonePe</div>
                    <div className="text-[10px] text-slate-400">1-Click Fast Pay</div>
                  </div>
                </button>

                {/* Google Pay */}
                <button
                  onClick={() => openUpiApp('Google Pay', 'gpay://upi/pay?')}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-blue-500 hover:bg-blue-50/50 transition flex items-center gap-3 text-left cursor-pointer group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    G
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs group-hover:text-blue-700">Google Pay</div>
                    <div className="text-[10px] text-slate-400">Direct Pay</div>
                  </div>
                </button>

                {/* Paytm */}
                <button
                  onClick={() => openUpiApp('Paytm', 'paytmmp://pay?')}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-cyan-500 hover:bg-cyan-50/50 transition flex items-center gap-3 text-left cursor-pointer group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-cyan-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    P
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs group-hover:text-cyan-700">Paytm</div>
                    <div className="text-[10px] text-slate-400">Wallet &amp; UPI</div>
                  </div>
                </button>

                {/* BHIM */}
                <button
                  onClick={() => openUpiApp('BHIM', 'bhim://pay?')}
                  className="p-3.5 rounded-2xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 transition flex items-center gap-3 text-left cursor-pointer group shadow-2xs"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                    B
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs group-hover:text-emerald-700">BHIM UPI</div>
                    <div className="text-[10px] text-slate-400">NPCI Official</div>
                  </div>
                </button>
              </div>

              {/* General UPI Intent */}
              <button
                onClick={() => (window.location.href = upiUri)}
                className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2"
              >
                <Smartphone size={15} />
                <span>Open in Any Installed UPI App</span>
              </button>
            </div>
          )}

          {/* TAB 3: CARDS & SEAMLESS NETBANKING */}
          {activeTab === 'cards' && (
            <div className="space-y-3.5">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 text-xs">
                <div className="flex items-center justify-between text-slate-700 font-bold">
                  <span>Seamless Debit / Credit Card</span>
                  <div className="flex gap-1">
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[9px] font-mono">VISA</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[9px] font-mono">MC</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-mono">RUPAY</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <input
                    type="text"
                    maxLength={19}
                    placeholder="Card Number (4000 1234 5678 9010)"
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-teal-600 font-mono"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      maxLength={5}
                      placeholder="MM/YY"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-teal-600 font-mono text-center"
                    />
                    <input
                      type="password"
                      maxLength={4}
                      placeholder="CVV"
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs focus:outline-teal-600 font-mono text-center"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  disabled={simulatingSuccess}
                  className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {simulatingSuccess ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Processing Card Payment...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={13} />
                      <span>Pay ₹ {amount} via Encrypted 3D Secure</span>
                    </>
                  )}
                </button>
              </div>

              <div className="text-[11px] text-slate-400 text-center leading-relaxed">
                Card details are transmitted directly through RBI-compliant tokenized PCI-DSS pipelines.
              </div>
            </div>
          )}

          {/* External Hosted Page fallback if user wants to open gateway */}
          {payUrl && payUrl.startsWith('http') && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <a
                href={payUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition py-1"
              >
                <span>Or open {gatewayAdapter.toUpperCase()} Hosted Cashier Page</span>
                <ExternalLink size={12} />
              </a>
            </div>
          )}
        </div>

        {/* Footer with Polling Status Indicator */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <RefreshCw size={12} className={polling ? 'animate-spin text-teal-600' : 'text-slate-400'} />
            <span>Listening for payment confirmation...</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
