import React, { useEffect, useState } from 'react';
import { ShieldAlert, Search, RefreshCw, Filter, User, Calendar, Clock } from 'lucide-react';
import { api } from '../services/api.js';
import { AuditLog } from '../types/index.js';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adminIdFilter, setAdminIdFilter] = useState('ALL');
  const [datePresetFilter, setDatePresetFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const [logsRes, teamRes] = await Promise.all([
        api.getAuditLogs({
          search,
          adminId: adminIdFilter,
          datePreset: datePresetFilter,
          action: actionFilter,
        }),
        api.getTeamMembers().catch(() => ({ success: false, team: [] })),
      ]);

      if (logsRes.success) {
        setLogs(logsRes.logs);
      }
      if (teamRes.success && teamRes.team) {
        setTeamMembers(teamRes.team);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(fetchLogs, 250);
    return () => clearTimeout(timer);
  }, [search, adminIdFilter, datePresetFilter, actionFilter]);

  const uniqueActions = Array.from(
    new Set([
      'PAYMENT_LINK_CREATED',
      'PAYMENT_LINK_UPDATED',
      'PAYMENT_LINK_DELETED',
      'CUSTOMER_CREATED',
      'CUSTOMER_UPDATED',
      'LOGIN_SUCCESS',
      'GATEWAY_TESTED',
      'NOTICE_TEMPLATE_CREATED',
    ])
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Security &amp; Operational Audit Logs</h1>
          <p className="text-xs text-slate-500">
            Immutable administrative records, team member action histories, authentication events, and payment link lifecycle changes
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition w-fit"
          title="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
          {/* Search Input */}
          <div className="relative max-w-xs w-full">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search details, actor or IP..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-teal-500 transition font-medium"
            />
          </div>

          {/* Team Member Filter */}
          <select
            value={adminIdFilter}
            onChange={(e) => setAdminIdFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-teal-500 font-medium"
            title="Filter by Team Member Actor"
          >
            <option value="ALL">All Team Members ({teamMembers.length || 'All'})</option>
            {teamMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name || m.username} (@{m.username})
              </option>
            ))}
          </select>

          {/* Date Filter */}
          <select
            value={datePresetFilter}
            onChange={(e) => setDatePresetFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-teal-500 font-medium"
            title="Filter by Activity Date"
          >
            <option value="all">All Dates</option>
            <option value="today">Actions Today</option>
            <option value="yesterday">Actions Yesterday</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:bg-white focus:outline-teal-500 font-medium"
            title="Filter by Action Type"
          >
            <option value="ALL">All Action Types</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>

          {/* Reset Filters */}
          {(adminIdFilter !== 'ALL' || datePresetFilter !== 'all' || actionFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setAdminIdFilter('ALL');
                setDatePresetFilter('all');
                setActionFilter('ALL');
                setSearch('');
              }}
              className="text-xs text-teal-600 hover:text-teal-800 font-semibold px-2 py-1 rounded-lg hover:bg-teal-50 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing {logs.length} Log Records
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Admin / Team Member</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Details</th>
                <th className="py-3 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto text-teal-500 mb-2" />
                    <span>Loading audit records...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No audit records matching query.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(l.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5">
                        <User size={12} className="text-teal-600 shrink-0" />
                        <span>@{l.adminUsername}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-semibold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded text-[11px]">
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] text-slate-700">
                        {l.entityType}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-sm truncate" title={l.details}>
                      {l.details}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{l.ipAddress || '127.0.0.1'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
