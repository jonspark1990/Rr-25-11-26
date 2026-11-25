import React, { useEffect, useState } from 'react';
import {
  X,
  User,
  Shield,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  Activity,
  Search,
  ExternalLink,
  Copy,
  Check,
  TrendingUp,
  AlertCircle,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/api.js';

interface TeamMemberDossierModalProps {
  memberId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TeamMemberDossierModal: React.FC<TeamMemberDossierModalProps> = ({
  memberId,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [dossier, setDossier] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'today' | 'yesterday' | 'logs'>('today');
  const [filterQuery, setFilterQuery] = useState('');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && memberId) {
      loadDossier();
    } else {
      setDossier(null);
      setError(null);
      setActiveTab('today');
      setFilterQuery('');
    }
  }, [isOpen, memberId]);

  const loadDossier = async () => {
    if (!memberId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.getTeamMemberDossier(memberId);
      if (res.success && res.dossier) {
        setDossier(res.dossier);
      } else {
        setError(res.error || 'Failed to retrieve team member dossier.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error loading team member dossier');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, token: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  if (!isOpen) return null;

  const member = dossier?.member;
  const summary = dossier?.summary;
  const todayLinks = dossier?.todayLinks || [];
  const yesterdayLinks = dossier?.yesterdayLinks || [];
  const auditLogs = dossier?.auditLogs || [];

  const filteredToday = todayLinks.filter((l: any) =>
    l.token.toLowerCase().includes(filterQuery.toLowerCase()) ||
    l.customerName.toLowerCase().includes(filterQuery.toLowerCase()) ||
    l.amountFormatted.includes(filterQuery)
  );

  const filteredYesterday = yesterdayLinks.filter((l: any) =>
    l.token.toLowerCase().includes(filterQuery.toLowerCase()) ||
    l.customerName.toLowerCase().includes(filterQuery.toLowerCase()) ||
    l.amountFormatted.includes(filterQuery)
  );

  const filteredLogs = auditLogs.filter((a: any) =>
    a.action.toLowerCase().includes(filterQuery.toLowerCase()) ||
    a.details.toLowerCase().includes(filterQuery.toLowerCase()) ||
    (a.entityType && a.entityType.toLowerCase().includes(filterQuery.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-sm uppercase shadow-xs">
              {member?.username?.slice(0, 2) || 'TM'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">
                  {member?.name || member?.username || 'Team Member Dossier'}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 uppercase">
                  {member?.role?.replace('_', ' ') || 'OPERATOR'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono">
                @{member?.username || 'user'} • {member?.email || 'email@local'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadDossier}
              disabled={loading}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              title="Refresh Dossier"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {loading && !dossier ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <RefreshCw size={28} className="animate-spin text-teal-600" />
              <span className="text-sm font-medium">Loading team member activity &amp; links...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          ) : (
            <>
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Total Links</span>
                  <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                    {summary?.totalLinksCount || 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase block">Paid Links</span>
                  <span className="text-xl font-bold font-mono text-emerald-700 mt-1 block">
                    {summary?.paidLinksCount || 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Total Collected</span>
                  <span className="text-lg font-bold font-mono text-slate-900 mt-1 block">
                    ₹{Number(summary?.totalCollected || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase block">Conversion</span>
                  <span className="text-xl font-bold font-mono text-indigo-600 mt-1 block">
                    {summary?.conversionRate || 0}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
                  <span className="text-[10px] font-semibold text-teal-700 uppercase block">Created Today</span>
                  <span className="text-xl font-bold font-mono text-teal-800 mt-1 block">
                    {summary?.todayCount || 0}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                  <span className="text-[10px] font-semibold text-amber-700 uppercase block">Created Yesterday</span>
                  <span className="text-xl font-bold font-mono text-amber-800 mt-1 block">
                    {summary?.yesterdayCount || 0}
                  </span>
                </div>
              </div>

              {/* Tab Selector & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
                  <button
                    onClick={() => setActiveTab('today')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'today'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Calendar size={13} className="text-teal-600" />
                    <span>Created Today ({todayLinks.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('yesterday')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'yesterday'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Clock size={13} className="text-amber-600" />
                    <span>Created Yesterday ({yesterdayLinks.length})</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      activeTab === 'logs'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Activity size={13} className="text-indigo-600" />
                    <span>Activity Logs ({auditLogs.length})</span>
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter records..."
                    value={filterQuery}
                    onChange={(e) => setFilterQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-teal-500 font-medium"
                  />
                </div>
              </div>

              {/* Tab 1: Created Today */}
              {activeTab === 'today' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Token &amp; Order</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Time Created</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredToday.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              {todayLinks.length === 0
                                ? 'No payment links created today by this team member.'
                                : 'No links matching search query.'}
                            </td>
                          </tr>
                        ) : (
                          filteredToday.map((link: any) => (
                            <tr key={link.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-bold text-slate-900 block">
                                  {link.token}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px] block">
                                  {link.merchantOrderNo}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-slate-800 block">{link.customerName}</span>
                                <span className="text-[10px] font-mono text-slate-400">{link.customerMobile || '-'}</span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                ₹{link.amountFormatted}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    link.status === 'SUCCESS'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : link.status === 'FAILED'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {link.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                                {new Date(link.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => copyToClipboard(link.token, link.token)}
                                    title="Copy Token"
                                    className="p-1 rounded text-slate-400 hover:text-teal-600 transition"
                                  >
                                    {copiedToken === link.token ? <Check size={14} className="text-teal-600" /> : <Copy size={14} />}
                                  </button>
                                  <a
                                    href={`/pay/${link.token}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open Checkout Link"
                                    className="p-1 rounded text-slate-400 hover:text-teal-600 transition"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: Created Yesterday */}
              {activeTab === 'yesterday' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Token &amp; Order</th>
                          <th className="py-2.5 px-3">Customer</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Time Created</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredYesterday.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400">
                              {yesterdayLinks.length === 0
                                ? 'No payment links created yesterday by this team member.'
                                : 'No links matching search query.'}
                            </td>
                          </tr>
                        ) : (
                          filteredYesterday.map((link: any) => (
                            <tr key={link.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-bold text-slate-900 block">
                                  {link.token}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 truncate max-w-[120px] block">
                                  {link.merchantOrderNo}
                                </span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-slate-800 block">{link.customerName}</span>
                                <span className="text-[10px] font-mono text-slate-400">{link.customerMobile || '-'}</span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                                ₹{link.amountFormatted}
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    link.status === 'SUCCESS'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : link.status === 'FAILED'
                                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                                  }`}
                                >
                                  {link.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                                {new Date(link.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => copyToClipboard(link.token, link.token)}
                                    title="Copy Token"
                                    className="p-1 rounded text-slate-400 hover:text-teal-600 transition"
                                  >
                                    {copiedToken === link.token ? <Check size={14} className="text-teal-600" /> : <Copy size={14} />}
                                  </button>
                                  <a
                                    href={`/pay/${link.token}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    title="Open Checkout Link"
                                    className="p-1 rounded text-slate-400 hover:text-teal-600 transition"
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Activity & Audit Logs */}
              {activeTab === 'logs' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Action</th>
                          <th className="py-2.5 px-3">Entity</th>
                          <th className="py-2.5 px-3">Details</th>
                          <th className="py-2.5 px-3">IP Address</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLogs.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              {auditLogs.length === 0
                                ? 'No activity records recorded for this member yet.'
                                : 'No logs matching search query.'}
                            </td>
                          </tr>
                        ) : (
                          filteredLogs.map((log: any) => (
                            <tr key={log.id} className="hover:bg-slate-50/80 transition">
                              <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                                {new Date(log.createdAt).toLocaleString([], {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-mono font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded text-[11px]">
                                  {log.action}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                                {log.entityType}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 max-w-sm truncate" title={log.details}>
                                {log.details}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-slate-400 text-[10px]">
                                {log.ipAddress || '127.0.0.1'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Member ID: {memberId || 'N/A'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
