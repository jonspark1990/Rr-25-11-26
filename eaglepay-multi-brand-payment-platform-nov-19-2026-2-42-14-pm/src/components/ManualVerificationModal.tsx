import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../services/api.js';
import { PaymentLink } from '../types/index.js';

interface ManualVerificationModalProps {
  link: PaymentLink;
  onClose: () => void;
  onVerified: () => void;
}

export const ManualVerificationModal: React.FC<ManualVerificationModalProps> = ({
  link,
  onClose,
  onVerified,
}) => {
  const submission = link.manualSubmission;
  const [utrNumber, setUtrNumber] = useState(submission?.utrNumber || link.gatewayOrderNo || '');
  const [reviewNote, setReviewNote] = useState('');
  const [processing, setProcessing] = useState<'approve' | 'reject' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiedUtr, setCopiedUtr] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  const handleCopyUtr = () => {
    if (!utrNumber) return;
    navigator.clipboard.writeText(utrNumber);
    setCopiedUtr(true);
    setTimeout(() => setCopiedUtr(false), 1800);
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    setError(null);
    if (action === 'reject' && !reviewNote.trim()) {
      setError('Please provide a brief rejection reason so the customer knows what to fix.');
      return;
    }

    setProcessing(action);
    try {
      const res = await api.verifyManualPayment(link.id, {
        action,
        note: reviewNote.trim() || undefined,
        utrNumber: utrNumber.trim() || undefined,
      });
      if (res.success) {
        onVerified();
        onClose();
      } else {
        setError(res.error || 'Verification update failed.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to process manual verification.');
    } finally {
      setProcessing(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Verify Manual UPI Payment Proof
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Token: {link.token} • Order: {link.merchantOrderNo}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertTriangle size={15} className="text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
          {/* Left: Expected vs Submitted Audit */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Expected Payment Details
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Payable Amount</span>
                <span className="font-mono font-extrabold text-lg text-teal-700 tabular-nums">
                  ₹{link.amountFormatted}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Brand</span>
                <span className="font-bold text-slate-900">{link.brandName || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer</span>
                <span className="font-semibold text-slate-900">
                  {link.customerName} ({link.customerMobile})
                </span>
              </div>
              {link.loanOrderNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Loan Order No.</span>
                  <span className="font-mono font-semibold text-slate-800">{link.loanOrderNumber}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Current Link Status</span>
                <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  {link.status}
                </span>
              </div>
            </div>

            {/* Customer Submitted UTR & Remarks */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Customer Submission
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Submitted UTR / Reference Number (Editable before Approve)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={utrNumber}
                    onChange={(e) => setUtrNumber(e.target.value)}
                    placeholder="Enter or confirm UTR..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono text-xs font-bold text-slate-900 focus:outline-teal-500"
                  />
                  <button
                    type="button"
                    onClick={handleCopyUtr}
                    className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    {copiedUtr ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                    <span>{copiedUtr ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {submission?.payerNote && (
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Payer UPI / Remarks:</span>
                  <span className="font-medium text-slate-800">{submission.payerNote}</span>
                </div>
              )}

              {submission?.submittedAt && (
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Proof Submitted At</span>
                  <span className="font-mono">{new Date(submission.submittedAt).toLocaleString('en-IN')}</span>
                </div>
              )}
            </div>

            {/* Admin Note / Decision */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-slate-700">
                Admin Verification Note (Required if Rejecting)
              </label>
              <textarea
                rows={2}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Optional note on approval, or clear reason why customer must resubmit..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-teal-500"
              />
            </div>

            {link.status !== 'SUCCESS' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleAction('approve')}
                  disabled={processing !== null}
                  className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-70"
                >
                  {processing === 'approve' ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  <span>Approve &amp; Mark Paid</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleAction('reject')}
                  disabled={processing !== null}
                  className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer disabled:opacity-70"
                >
                  {processing === 'reject' ? <RefreshCw size={14} className="animate-spin" /> : <XCircle size={15} />}
                  <span>Reject &amp; Resubmit</span>
                </button>
              </div>
            )}
          </div>

          {/* Right: Payment Screenshot Viewer */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <ImageIcon size={13} />
                <span>Payment Screenshot Proof</span>
              </span>
              {submission?.screenshotDataUrl && (
                <button
                  type="button"
                  onClick={() => setZoomed(!zoomed)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline cursor-pointer"
                >
                  {zoomed ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                  <span>{zoomed ? 'Fit to Box' : 'Full Size'}</span>
                </button>
              )}
            </div>

            <div className="flex-1 min-h-[280px] bg-slate-100 rounded-xl border border-slate-200 flex items-center justify-center p-3 overflow-auto">
              {submission?.screenshotDataUrl ? (
                <img
                  src={submission.screenshotDataUrl}
                  alt="Customer payment proof screenshot"
                  className={
                    zoomed
                      ? 'max-w-none rounded-lg shadow-sm border border-slate-200'
                      : 'max-h-[380px] w-auto object-contain rounded-lg shadow-sm border border-slate-200'
                  }
                />
              ) : (
                <div className="text-center text-slate-400 space-y-2 p-6">
                  <ImageIcon size={32} className="mx-auto opacity-60" />
                  <p className="text-xs font-medium text-slate-500">
                    No screenshot uploaded with this submission.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
