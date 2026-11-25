import React, { useState, useEffect } from 'react';
import {
  X,
  Eye,
  MousePointerClick,
  Clock,
  Smartphone,
  Globe,
  Share2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  ChevronDown,
  ChevronRight,
  Shield,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { api } from '../services/api.js';

interface TrackLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  linkId: string;
}

export const TrackLinkModal: React.FC<TrackLinkModalProps> = ({ isOpen, onClose, linkId }) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);
  const [expandedAttempt, setExpandedAttempt] = useState<string | null>(null);

  const fetchTracking = async () => {
    try {
      setLoading(true);
      const res = await api.getPaymentLinkTracking(linkId);
      if (res.success) {
        setData(res.tracking);
      }
    } catch (err) {
      console.error('Tracking fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && linkId) {
      fetchTracking();
    }
  }, [isOpen, linkId]);

  if (!isOpen) return null;

  const tracking = data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse"></span>
              <h3 className="text-base font-extrabold text-slate-900">
                Live Link Tracking &amp; Customer Journey
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time audit log of customer opens, clicks, and gateway order initiations
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchTracking}
              disabled={loading}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition cursor-pointer"
              title="Refresh tracking data"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {loading && !tracking ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <RefreshCw size={24} className="animate-spin text-teal-600" />
              <p className="text-xs font-semibold">Retrieving tracking records...</p>
            </div>
          ) : !tracking ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              Unable to load tracking details.
            </div>
          ) : (
            <>
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Eye size={12} className="text-teal-600" />
                    <span>Total Views</span>
                  </span>
                  <div className="text-2xl font-black text-slate-900">{tracking.viewCount || 0}</div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {tracking.lastViewedAt ? `Last: ${new Date(tracking.lastViewedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No views yet'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <MousePointerClick size={12} className="text-indigo-600" />
                    <span>Pay Clicks</span>
                  </span>
                  <div className="text-2xl font-black text-slate-900">{tracking.clickCount || 0}</div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {tracking.lastClickedAt ? `Last: ${new Date(tracking.lastClickedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No clicks yet'}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Zap size={12} className="text-amber-500" />
                    <span>Order Initiated</span>
                  </span>
                  <div className="text-sm font-black font-mono text-slate-900 truncate">
                    {tracking.gatewayOrderNo || 'Pending Click'}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">
                    Via {tracking.gatewayAdapter?.toUpperCase()}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-600" />
                    <span>Status</span>
                  </span>
                  <div className="pt-0.5">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-black ${
                        tracking.status === 'SUCCESS'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tracking.status === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tracking.status}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate font-mono">
                    ₹{tracking.amountFormatted}
                  </span>
                </div>
              </div>

              {/* Gateway Order Initiation Card (Requested by user) */}
              <div className="p-4 rounded-2xl bg-teal-950/20 border border-teal-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-800 flex items-center gap-1.5">
                    <Zap size={14} className="text-teal-600" />
                    <span>Gateway Pay-Now Order Initiation Data</span>
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold uppercase">
                    {tracking.gatewayAdapter}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-teal-900/10 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">Gateway Order ID (Returned on Pay Now Click):</span>
                    <span className="font-mono font-bold text-teal-900 select-all">
                      {tracking.gatewayOrderNo || 'Customer has not clicked Pay Now yet'}
                    </span>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-teal-900/10 space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">Merchant Reference Sent:</span>
                    <span className="font-mono font-bold text-slate-800 select-all">
                      {tracking.currentGatewayMchOrderNo || tracking.merchantOrderNo}
                    </span>
                  </div>
                </div>
              </div>

              {/* Order Initiation Attempts Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-slate-500" />
                  <span>Gateway Order Initiation History ({tracking.orderAttempts?.length || 0})</span>
                </h4>

                {(!tracking.orderAttempts || tracking.orderAttempts.length === 0) ? (
                  <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 text-xs text-center border border-slate-100">
                    No checkout attempts initiated yet. Gateway order will register immediately when the customer clicks "Pay Now".
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tracking.orderAttempts.map((att: any, idx: number) => {
                      const isExpanded = expandedAttempt === att.id;
                      return (
                        <div
                          key={att.id || idx}
                          className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden text-xs shadow-2xs"
                        >
                          <div
                            onClick={() => setExpandedAttempt(isExpanded ? null : att.id)}
                            className="p-3 bg-slate-50 hover:bg-slate-100/80 cursor-pointer flex items-center justify-between transition"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span className="font-mono font-bold text-slate-800">
                                Attempt #{att.attemptNumber || idx + 1}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 text-[10px] font-mono">
                                {att.gateway || tracking.gatewayAdapter}
                              </span>
                              {att.gatewayOrderNo && (
                                <span className="font-mono text-teal-700 font-bold text-[11px]">
                                  ID: {att.gatewayOrderNo}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">
                                {att.initiatedAt ? new Date(att.initiatedAt).toLocaleTimeString() : ''}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  att.status === 'SUCCESS'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {att.status}
                              </span>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3 bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto space-y-1">
                              <div>Merchant Order No: {att.mchOrderNo}</div>
                              <div>Gateway Order ID: {att.gatewayOrderNo || 'N/A'}</div>
                              {att.payUrl && <div className="truncate">Pay URL: {att.payUrl}</div>}
                              <div className="pt-1 text-[10px] text-slate-400">Raw Gateway Response:</div>
                              <pre className="text-[10px] text-teal-300 overflow-x-auto p-2 bg-slate-950 rounded-lg">
                                {JSON.stringify(att.rawGatewayResponse || {}, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Customer Visitor Journey Log */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Smartphone size={13} className="text-slate-500" />
                  <span>Customer Activity &amp; Click Log</span>
                </h4>

                {(!tracking.visitorEvents || tracking.visitorEvents.length === 0) ? (
                  <div className="p-4 rounded-2xl bg-slate-50 text-slate-400 text-xs text-center border border-slate-100">
                    No customer interaction events recorded yet.
                  </div>
                ) : (
                  <div className="relative pl-6 space-y-3 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {tracking.visitorEvents.map((evt: any, idx: number) => (
                      <div key={evt.id || idx} className="relative text-xs">
                        <span
                          className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 border-white ${
                            evt.eventType === 'PAYMENT_INITIATED'
                              ? 'bg-amber-500'
                              : evt.eventType === 'PAY_NOW_CLICKED'
                              ? 'bg-indigo-500'
                              : 'bg-teal-500'
                          }`}
                        ></span>

                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">
                              {evt.eventType === 'LINK_VIEWED'
                                ? '👁️ Customer Opened Link'
                                : evt.eventType === 'PAY_NOW_CLICKED'
                                ? '👆 Customer Clicked "Pay Now"'
                                : evt.eventType === 'PAYMENT_INITIATED'
                                ? '⚡ Gateway Order Dispatched'
                                : evt.eventType}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(evt.timestamp).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-500">
                            {evt.deviceType && (
                              <span className="flex items-center gap-1">
                                <Smartphone size={11} />
                                <span>{evt.deviceType}</span>
                              </span>
                            )}
                            {evt.referrer && (
                              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                                <Share2 size={11} />
                                <span>{evt.referrer}</span>
                              </span>
                            )}
                            {evt.ipAddress && (
                              <span className="font-mono text-[10px] text-slate-400">
                                IP: {evt.ipAddress}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
