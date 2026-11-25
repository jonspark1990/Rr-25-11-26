import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Download,
  RefreshCw,
  Calendar,
  TrendingUp,
  Layers,
  CreditCard,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Award,
  ShieldCheck,
  Activity,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { api } from '../services/api.js';
import { TeamMemberDossierModal } from '../components/TeamMemberDossierModal.js';

export const ReportsPage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDossierMemberId, setSelectedDossierMemberId] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await api.getReportSummary();
      if (res.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const behavior = data?.customerBehavior;
  const teamMembers = data?.teamMemberBreakdown || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Operations &amp; Recovery Analytics</h1>
          <p className="text-xs text-slate-500">
            Granular customer behavior analysis, team member performance auditing, and daily settlement tracking
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchReports}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            title="Refresh Metrics"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          <a
            href="/api/reports/export/csv?type=payments"
            download="payments_report.csv"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-sm transition"
          >
            <Download size={14} />
            <span>Export Master CSV</span>
          </a>
        </div>
      </div>

      {/* KPI Cards: Collection & Customer Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Total Realized Collections
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
              ₹{(behavior?.totalCollected || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
              <TrendingUp size={11} />
              <span>{behavior?.overallConversionRate || 0}% overall conversion rate</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Average Ticket Size (AOV)
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
              ₹{(behavior?.avgTicketSize || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-teal-600 font-semibold mt-0.5">
              Across all settled links
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
            <Award size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Borrower Customer Base
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
              {behavior?.totalCustomers || 0}
            </div>
            <div className="text-[10px] text-indigo-600 font-semibold mt-0.5">
              {behavior?.repeatBorrowers || 0} repeat customers (&gt;1 link)
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Users size={22} />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Pending vs Settled Ratio
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono mt-1">
              {behavior?.statusDistribution?.SUCCESS || 0} : {behavior?.statusDistribution?.PENDING || 0}
            </div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
              {behavior?.statusDistribution?.EXPIRED || 0} expired • {behavior?.statusDistribution?.FAILED || 0} failed
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock size={22} />
          </div>
        </div>
      </div>

      {/* Team Member Auditing & Performance Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Team Member &amp; Agent Performance Audit</h3>
            <p className="text-xs text-slate-500">
              Direct tracking of links generated, collection amounts recovered, and efficiency per staff member
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-semibold">
            <Users size={13} />
            <span>{teamMembers.length} Active Staff</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Member Name &amp; User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Total Links</th>
                <th className="py-3 px-4">Created Today</th>
                <th className="py-3 px-4">Created Yesterday</th>
                <th className="py-3 px-4">Settled (Paid)</th>
                <th className="py-3 px-4">Total Collected</th>
                <th className="py-3 px-4">Conversion Rate</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400">
                    No team member activity recorded yet.
                  </td>
                </tr>
              ) : (
                teamMembers.map((member: any) => (
                  <tr key={member.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{member.name}</div>
                      <div className="text-[11px] font-mono text-slate-400">@{member.username}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">
                        {member.role.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                      {member.totalLinks}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-100">
                        {member.todayLinks || 0} links
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-100">
                        {member.yesterdayLinks || 0} links
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                      {member.paidLinks}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ₹{Number(member.totalCollected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${Math.min(member.conversionRate, 100)}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-slate-700 font-mono text-[11px]">
                          {member.conversionRate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedDossierMemberId(member.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold shadow-xs transition cursor-pointer"
                        title="View Full Activity & Created Links Dossier"
                      >
                        <Activity size={12} className="text-teal-400" />
                        <span>View Dossier</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Daily Collections (Last 7 Days) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Daily Collections (Last 7 Days)</h3>
            <p className="text-xs text-slate-500">Verified paid settlement volumes across all brands</p>
          </div>
          <Calendar size={16} className="text-teal-600" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
          {data?.dailyBreakdown?.map((d: any, idx: number) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col justify-between"
            >
              <span className="text-[11px] font-semibold text-slate-500">{d.date}</span>
              <div className="mt-3">
                <div className="text-base font-extrabold text-slate-900 font-mono">
                  ₹{Number(d.collected).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-teal-600 font-semibold mt-0.5">{d.count} payments</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Brand-Wise & Gateway-Wise Split */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Brand-Wise Collections */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Brand-Wise Performance</h3>
              <p className="text-xs text-slate-500">Breakdown per lending entity</p>
            </div>
            <Layers size={16} className="text-indigo-600" />
          </div>

          <div className="space-y-3">
            {data?.brandBreakdown?.map((b: any) => (
              <div key={b.brandId} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-900">{b.brandName}</span>
                  <span className="font-mono font-extrabold text-xs text-emerald-600">
                    ₹{Number(b.totalCollected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{b.paidCount} paid of {b.totalLinks} links generated</span>
                  <span className="font-bold text-slate-700">
                    {b.totalLinks > 0 ? Math.round((b.paidCount / b.totalLinks) * 100) : 0}% recovery rate
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Gateway-Wise Collections */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Gateway-Wise Distribution</h3>
              <p className="text-xs text-slate-500">Routing volume across payment providers</p>
            </div>
            <CreditCard size={16} className="text-teal-600" />
          </div>

          <div className="space-y-3">
            {data?.gatewayBreakdown?.map((g: any) => (
              <div key={g.gatewayId} className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-slate-900">{g.gatewayName}</span>
                  <span className="font-mono font-extrabold text-xs text-emerald-600">
                    ₹{Number(g.totalCollected).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{g.paidCount} completed transactions</span>
                  <span className="font-mono text-[10px] uppercase font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded">
                    Adapter: {g.adapter}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Deep-Dive Team Member Dossier Modal */}
      <TeamMemberDossierModal
        memberId={selectedDossierMemberId}
        isOpen={Boolean(selectedDossierMemberId)}
        onClose={() => setSelectedDossierMemberId(null)}
      />
    </div>
  );
};
