import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Download,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Check,
  AlertCircle,
  Shield,
  CreditCard,
  Building,
  UserCheck,
  User,
} from 'lucide-react';
import { api, getCachedUser } from '../services/api.js';
import { Customer } from '../types/index.js';

export const CustomersPage: React.FC = () => {
  const currentUser = getCachedUser();
  const isFullAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin';
  const isPrivileged = isFullAdmin || currentUser?.role === 'manager';
  const perms = new Set(currentUser?.permissions || []);
  const canCreate = isFullAdmin || perms.has('customers:create') || perms.has('customers:manage');
  const canDelete = isFullAdmin || perms.has('customers:delete') || perms.has('customers:manage');

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [teamMemberFilter, setTeamMemberFilter] = useState('ALL');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    open: boolean;
    isBulk: boolean;
    targetId?: string;
    targetName?: string;
    count?: number;
  }>({ open: false, isBulk: false });

  // Form states
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [executiveName, setExecutiveName] = useState('');
  const [externalReference, setExternalReference] = useState('');
  const [businessReference, setBusinessReference] = useState('');
  const [notes, setNotes] = useState('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const [custRes, teamRes] = await Promise.all([
        api.getCustomers({ search, createdByAdminId: teamMemberFilter }),
        isPrivileged
          ? api.getTeamMembers().catch(() => ({ success: false, team: [] }))
          : Promise.resolve({ success: false, team: [] }),
      ]);

      if (custRes.success) {
        setCustomers(custRes.customers);
      }
      if (teamRes.success && teamRes.team) {
        setTeamMembers(teamRes.team);
      }
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 250);
    return () => clearTimeout(timer);
  }, [search, teamMemberFilter]);

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === customers.length && customers.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(customers.map((c) => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFullName('');
    setMobile('');
    setEmail('');
    setPanNumber('');
    setBankAccount('');
    setExecutiveName('');
    setExternalReference('');
    setBusinessReference('');
    setNotes('');
    setError(null);
    setModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFullName(c.fullName);
    setMobile(c.mobile);
    setEmail(c.email);
    setPanNumber(c.panNumber || '');
    setBankAccount(c.bankAccount || '');
    setExecutiveName(c.executiveName || '');
    setExternalReference(c.externalReference || '');
    setBusinessReference(c.businessReference || '');
    setNotes(c.notes || '');
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim(),
        panNumber: panNumber.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        executiveName: executiveName.trim() || undefined,
        externalReference: externalReference.trim() || undefined,
        businessReference: businessReference.trim() || undefined,
        notes: notes.trim() || undefined,
      };

      if (editingCustomer) {
        await api.updateCustomer(editingCustomer.id, payload);
      } else {
        await api.createCustomer(payload);
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // Delete handlers
  const confirmDeleteSingle = (c: Customer) => {
    setConfirmDeleteModal({
      open: true,
      isBulk: false,
      targetId: c.id,
      targetName: c.fullName,
    });
  };

  const confirmDeleteBulk = () => {
    if (selectedIds.size === 0) return;
    setConfirmDeleteModal({
      open: true,
      isBulk: true,
      count: selectedIds.size,
    });
  };

  const executeDelete = async () => {
    setBulkDeleting(true);
    try {
      if (confirmDeleteModal.isBulk) {
        await api.bulkDeleteCustomers(Array.from(selectedIds));
        setSelectedIds(new Set());
      } else if (confirmDeleteModal.targetId) {
        await api.deleteCustomer(confirmDeleteModal.targetId);
        selectedIds.delete(confirmDeleteModal.targetId);
        setSelectedIds(new Set(selectedIds));
      }
      setConfirmDeleteModal({ open: false, isBulk: false });
      fetchCustomers();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Customer Directory</h1>
          <p className="text-xs text-slate-500">
            Manage customers, borrower accounts, pan &amp; bank details for branded payment links
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/api/customers/export/csv"
            download="customers.csv"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </a>

          {canCreate && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-sm transition"
            >
              <Plus size={15} />
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Retention Notice Pill */}
      <div className="p-3.5 rounded-2xl bg-slate-900 text-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
            <Shield size={16} />
          </div>
          <div>
            <span className="font-bold text-white">60-Day Customer &amp; Log Retention Engine Active</span>
            <p className="text-[11px] text-slate-400">
              Customer records without active links and logs older than 60 days are purged automatically. Edit or bulk delete anytime.
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono text-teal-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 self-start sm:self-auto shrink-0">
          Total: {customers.length} Profiles
        </div>
      </div>

      {/* Filter, Search & Bulk Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative max-w-xs w-full">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, mobile, email, PAN or ref..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-teal-500 transition font-medium"
            />
          </div>

          {/* Role-Based Team Member Scope Filter */}
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
              <span className="truncate">My Assigned Customers ({currentUser?.name || currentUser?.username})</span>
            </div>
          )}

          {(teamMemberFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setTeamMemberFilter('ALL');
                setSearch('');
              }}
              className="text-xs text-teal-600 hover:text-teal-800 font-semibold px-2 py-1 rounded-lg hover:bg-teal-50 transition cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Bulk Action Controls */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          {selectedIds.size > 0 && canDelete && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-xl animate-in fade-in duration-200">
              <span className="text-xs font-bold text-rose-800 font-mono">
                {selectedIds.size} selected
              </span>
              <button
                onClick={confirmDeleteBulk}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold shadow-xs transition"
              >
                <Trash2 size={12} />
                <span>Delete Selected</span>
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[11px] text-slate-500 hover:text-slate-800 font-medium px-1"
              >
                Clear
              </button>
            </div>
          )}

          <button
            onClick={fetchCustomers}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            title="Refresh"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Customer Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={customers.length > 0 && selectedIds.size === customers.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 px-4">Customer Details</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">PAN / Bank Info</th>
                <th className="py-3.5 px-4">Executive / Ref</th>
                <th className="py-3.5 px-4">Created / Assigned To</th>
                <th className="py-3.5 px-4">Payment Links</th>
                <th className="py-3.5 px-4">Total Paid</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="animate-spin mx-auto text-teal-500 mb-2" />
                    <span>Loading customers...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No customers found. Click "Add Customer" to create one.
                  </td>
                </tr>
              ) : (
                customers.map((c) => {
                  const isSelected = selectedIds.has(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-50/80 transition ${
                        isSelected ? 'bg-teal-50/40' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(c.id)}
                          className="w-4 h-4 rounded text-teal-600 focus:ring-teal-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{c.fullName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">ID: {c.id}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 font-medium font-mono">{c.mobile}</div>
                        <div className="text-slate-400 text-[11px] truncate max-w-[160px]">{c.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {c.panNumber ? (
                          <div className="text-[11px] font-mono font-semibold text-slate-700">
                            PAN: {c.panNumber}
                          </div>
                        ) : null}
                        {c.bankAccount ? (
                          <div className="text-[10px] font-mono text-slate-500">
                            A/C: {c.bankAccount}
                          </div>
                        ) : null}
                        {!c.panNumber && !c.bankAccount && (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {c.executiveName && (
                          <div className="text-slate-700 font-medium text-[11px] mb-0.5">
                            Exec: {c.executiveName}
                          </div>
                        )}
                        {c.externalReference && (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] font-medium mr-1">
                            {c.externalReference}
                          </span>
                        )}
                        {!c.executiveName && !c.externalReference && (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <User size={12} className="text-teal-600 shrink-0" />
                          <span className="truncate">{c.createdByName || 'Administrator'}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                          <span className="text-slate-500 font-medium">@{c.createdByUsername || 'admin'}</span>
                          <span>•</span>
                          <span>{new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-700">{c.totalLinks || 0} links</span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-emerald-600">
                        ₹{(c.totalPaidAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {canCreate && (
                            <button
                              onClick={() => openEditModal(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 transition"
                              title="Edit Customer"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => confirmDeleteSingle(c)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              title="Delete Customer"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
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

      {/* Modal Create / Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 relative border border-slate-100 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={18} />
            </button>

            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {editingCustomer ? 'Edit Customer Details' : 'Add New Customer Profile'}
            </h3>
            {editingCustomer && (
              <div className="mb-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-medium">
                  <User size={13} className="text-teal-600" />
                  <span>Created by: <strong className="text-slate-800">{editingCustomer.createdByName || 'Administrator'}</strong> (@{editingCustomer.createdByUsername || 'admin'})</span>
                </div>
                <span className="font-mono text-slate-400 text-[10px]">
                  {new Date(editingCustomer.createdAt).toLocaleString()}
                </span>
              </div>
            )}

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="rahul@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">PAN Card Number</label>
                  <input
                    type="text"
                    placeholder="e.g. ABCDE1234F"
                    value={panNumber}
                    onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono uppercase focus:outline-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Account Number</label>
                  <input
                    type="text"
                    placeholder="e.g. 501004928371"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono focus:outline-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Executive</label>
                  <input
                    type="text"
                    placeholder="e.g. Vikram Malhotra"
                    value={executiveName}
                    onChange={(e) => setExecutiveName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">External Loan Reference</label>
                  <input
                    type="text"
                    placeholder="e.g. LN-9821-X"
                    value={externalReference}
                    onChange={(e) => setExternalReference(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-teal-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  placeholder="Optional internal remarks..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs focus:outline-teal-500"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
                  ? `Delete ${confirmDeleteModal.count} Customers?`
                  : `Delete ${confirmDeleteModal.targetName}?`}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure? This customer record will be permanently deleted from the database.
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
                disabled={bulkDeleting}
                onClick={executeDelete}
                className="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {bulkDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
