import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  IndianRupee,
  Users,
  Copy,
  Check,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Loader2,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  fetchAdminPaymentsApi,
  fetchAdminUsersApi,
  updateUserRoleApi,
  syncRazorpayPaymentsApi,
} from '../utils/api';
import type { PaymentRecord, PlatformUser } from '../types';

export const AdminPaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'PAYMENTS' | 'USERS'>('PAYMENTS');

  // Payments State
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, rejected: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'VERIFIED'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Users & Roles State
  const [usersList, setUsersList] = useState<PlatformUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncRazorpay = async () => {
    setIsSyncing(true);
    try {
      const res = await syncRazorpayPaymentsApi();
      await loadPayments();
      await loadUsers();
      alert(`Razorpay Sync Complete!\n${res.syncedCount} new captured payment(s) synchronized.\nChecked ${res.totalChecked} recent Razorpay transactions.`);
    } catch (err: any) {
      alert(`Sync Error: ${err.message || 'Failed to sync with Razorpay.'}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const isMasterAdmin =
    user?.role === 'ADMIN' || ['harshsaini0912@gmail.com', 'harshsaini0912@gmail'].includes(user?.email?.toLowerCase() || '');

  const loadPayments = async () => {
    setLoading(true);
    try {
      const data = await fetchAdminPaymentsApi();
      if (data && data.payments) {
        setPayments(data.payments);
        setStats(data.stats || { total: 0, verified: 0, pending: 0, rejected: 0, revenue: 0 });
      }
    } catch (err) {
      console.error('Failed to load admin payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const data = await fetchAdminUsersApi();
      if (data && data.users) {
        setUsersList(data.users);
      }
    } catch (err) {
      console.error('Failed to load admin users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (isMasterAdmin) {
      loadPayments();
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [isMasterAdmin]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRoleChange = async (userId: string, newRole: 'STUDENT' | 'TEACHER' | 'ADMIN') => {
    const confirmMsg = `Are you sure you want to change this user's role to ${newRole}?`;
    if (!window.confirm(confirmMsg)) return;

    setUpdatingUserId(userId);
    try {
      await updateUserRoleApi(userId, newRole);
      await loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to change role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (!isMasterAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500">
            This dashboard is reserved strictly for Platform Administrators.
          </p>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl text-xs hover:bg-slate-800 transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  const filteredPayments = payments.filter((p) => {
    if (filterStatus !== 'ALL' && p.status !== filterStatus) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.utrNumber.toLowerCase().includes(term) ||
      (p.user?.name && p.user.name.toLowerCase().includes(term)) ||
      (p.user?.email && p.user.email.toLowerCase().includes(term)) ||
      p.planName.toLowerCase().includes(term)
    );
  });

  const filteredUsers = usersList.filter((u) => {
    if (!userSearchTerm) return true;
    const term = userSearchTerm.toLowerCase();
    return (
      u.name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  });

  const studentCount = usersList.filter((u) => u.role === 'STUDENT').length;
  const teacherCount = usersList.filter((u) => u.role === 'TEACHER').length;
  const adminCount = usersList.filter((u) => u.role === 'ADMIN').length;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => navigate('/report-cards')}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <span className="text-slate-300">•</span>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-black bg-purple-100 text-purple-700">
                Master Admin Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-indigo-600" />
              Abhiyantra Administration Console
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Logged in as <strong className="text-slate-800 font-mono">{user?.email || 'harshsaini0912@gmail.com'}</strong> (Platform Admin)
            </p>
          </div>

          {/* Primary Nav Switcher (Payments vs Users) */}
          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setActiveTab('PAYMENTS')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'PAYMENTS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <IndianRupee className="w-3.5 h-3.5" />
              <span>Payments ({payments.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('USERS')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'USERS'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Users & Roles ({usersList.length})</span>
            </button>
            <button
              onClick={() => {
                if (activeTab === 'PAYMENTS') loadPayments();
                else loadUsers();
              }}
              disabled={loading || loadingUsers || isSyncing}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-lg transition-all"
              title="Refresh local database records"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingUsers ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleSyncRazorpay}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-bold rounded-lg text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
              title="Pull captured transactions from Razorpay and auto-verify user accounts"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Razorpay'}</span>
            </button>
          </div>
        </div>

        {/* ═══════════ TAB 1: PAYMENTS ═══════════ */}
        {activeTab === 'PAYMENTS' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Total Revenue</span>
                  <IndianRupee className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">₹{stats.revenue.toLocaleString('en-IN')}</div>
                <div className="text-[11px] text-emerald-600 font-medium">Direct Razorpay Collections</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Verified Subscriptions</span>
                  <CheckCircle2 className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.verified}</div>
                <div className="text-[11px] text-slate-500 font-medium">{stats.total} Total Orders Logged</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Payment Gateway</span>
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">Razorpay Live</div>
                <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  100% Automated Instant Verification
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by student name, email, or payment ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:outline-none rounded-xl text-xs font-medium text-slate-800 transition-all"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {(['ALL', 'VERIFIED'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setFilterStatus(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      filterStatus === st
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All Records' : 'Verified Only'}
                  </button>
                ))}
              </div>
            </div>

            {/* Table of Transactions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {loading ? (
                <div className="text-center py-16 text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span>Loading payment records...</span>
                </div>
              ) : filteredPayments.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-2">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Search className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">No payment records found</p>
                  <p className="text-xs text-slate-500">No payments matched your current filter or search criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Student</th>
                        <th className="py-3 px-4">Plan & Amount</th>
                        <th className="py-3 px-4">Payment ID</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredPayments.map((p) => {
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Student Info */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                {p.user?.avatarUrl ? (
                                  <img src={p.user.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs">
                                    {(p.user?.name || 'S')[0].toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-slate-900">{p.user?.name || 'Student'}</p>
                                  <p className="text-[11px] text-slate-500">{p.user?.email || 'N/A'}</p>
                                </div>
                              </div>
                            </td>

                            {/* Plan & Amount */}
                            <td className="py-3.5 px-4">
                              <p className="font-bold text-slate-900">₹{p.amount.toFixed(2)}</p>
                              <p className="text-[11px] text-slate-500 truncate max-w-[150px]">{p.planName}</p>
                            </td>

                            {/* Payment ID */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md w-fit">
                                <span>{p.utrNumber}</span>
                                <button
                                  onClick={() => handleCopyId(p.utrNumber)}
                                  className="text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                  title="Copy Payment ID"
                                >
                                  {copiedId === p.utrNumber ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                              {p.adminNote && <p className="text-[10px] text-slate-400 mt-0.5">{p.adminNote}</p>}
                            </td>

                            {/* Date */}
                            <td className="py-3.5 px-4 text-slate-500">
                              {new Date(p.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>

                            {/* Status */}
                            <td className="py-3.5 px-4">
                              {p.status === 'VERIFIED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Verified
                                </span>
                              ) : p.status === 'REJECTED' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                                  <XCircle className="w-3 h-3 text-rose-600" />
                                  Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 animate-pulse">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ TAB 2: USERS & ROLES ═══════════ */}
        {activeTab === 'USERS' && (
          <div className="space-y-6 animate-in fade-in duration-150">
            {/* User Roles Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Enrolled Students</span>
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900">{studentCount}</div>
                <div className="text-[11px] text-slate-500 font-medium">Standard test-takers</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Faculty & Teachers</span>
                  <Users className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-indigo-700">{teacherCount}</div>
                <div className="text-[11px] text-slate-500 font-medium">Test builders & examiners</div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                  <span>Platform Admins</span>
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                </div>
                <div className="text-2xl sm:text-3xl font-black text-purple-700">{adminCount}</div>
                <div className="text-[11px] text-purple-600 font-medium">Full platform privileges</div>
              </div>
            </div>

            {/* User Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search user by name, email, or role..."
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:outline-none rounded-xl text-xs font-medium text-slate-800 transition-all"
                />
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {loadingUsers ? (
                <div className="text-center py-16 text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                  <span>Loading user directory...</span>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-16 px-4 space-y-2">
                  <p className="text-sm font-bold text-slate-700">No users found</p>
                  <p className="text-xs text-slate-500">No users matched your search.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Current Role</th>
                        <th className="py-3 px-4">Pass Status</th>
                        <th className="py-3 px-4">Tests Attempted</th>
                        <th className="py-3 px-4">Joined Date</th>
                        <th className="py-3 px-4 text-right">Assign Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u) => {
                        const isUpdating = updatingUserId === u.id;
                        const isPrimaryAdmin = ['harshsaini0912@gmail.com', 'harshsaini0912@gmail'].includes(u.email.toLowerCase());

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* User details */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2.5">
                                {u.avatarUrl ? (
                                  <img src={u.avatarUrl} alt="" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
                                    {u.name[0]?.toUpperCase() || 'U'}
                                  </div>
                                )}
                                <div>
                                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                                    {u.name}
                                    {isPrimaryAdmin && (
                                      <span className="text-[9px] bg-purple-100 text-purple-800 font-black px-1.5 py-0.2 rounded">
                                        MASTER
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Current Role Badge */}
                            <td className="py-3.5 px-4">
                              {u.role === 'ADMIN' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                                  <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                  ADMIN
                                </span>
                              ) : u.role === 'TEACHER' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                                  <Users className="w-3.5 h-3.5 text-blue-600" />
                                  TEACHER
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">
                                  <GraduationCap className="w-3.5 h-3.5 text-slate-500" />
                                  STUDENT
                                </span>
                              )}
                            </td>

                            {/* Subscription Status */}
                            <td className="py-3.5 px-4">
                              {u.isSubscribed ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                  <Sparkles className="w-3 h-3 text-emerald-600" />
                                  PRO ACTIVE
                                </span>
                              ) : (
                                <span className="text-slate-400 font-medium">Free Tier</span>
                              )}
                            </td>

                            {/* Tests Attempted */}
                            <td className="py-3.5 px-4 font-bold text-slate-800">
                              {u._count?.reportCards ?? 0} tests
                            </td>

                            {/* Joined Date */}
                            <td className="py-3.5 px-4 text-slate-500">
                              {new Date(u.createdAt).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>

                            {/* Assign Role Controls */}
                            <td className="py-3.5 px-4 text-right">
                              {isPrimaryAdmin ? (
                                <span className="text-[11px] text-slate-400 italic">Primary Admin</span>
                              ) : (
                                <div className="inline-flex items-center gap-1">
                                  <select
                                    value={u.role}
                                    disabled={isUpdating}
                                    onChange={(e) =>
                                      handleRoleChange(u.id, e.target.value as 'STUDENT' | 'TEACHER' | 'ADMIN')
                                    }
                                    className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 cursor-pointer"
                                  >
                                    <option value="STUDENT">Student</option>
                                    <option value="TEACHER">Teacher</option>
                                    <option value="ADMIN">Admin</option>
                                  </select>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPaymentsPage;
