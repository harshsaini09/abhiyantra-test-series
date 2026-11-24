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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchAdminPaymentsApi, verifyAdminPaymentApi } from '../utils/api';
import type { PaymentRecord } from '../types';

export const AdminPaymentsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState({ total: 0, verified: 0, pending: 0, rejected: 0, revenue: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>('ALL');
  const [copiedUtr, setCopiedUtr] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isMasterAdmin = user?.email?.toLowerCase() === 'harshsaini0912@gmail.com';

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

  useEffect(() => {
    if (isMasterAdmin) {
      loadPayments();
    } else {
      setLoading(false);
    }
  }, [isMasterAdmin]);

  const handleCopyUtr = (utr: string) => {
    navigator.clipboard.writeText(utr);
    setCopiedUtr(utr);
    setTimeout(() => setCopiedUtr(null), 2000);
  };

  const handleUpdateStatus = async (paymentId: string, status: 'VERIFIED' | 'REJECTED') => {
    const confirmMsg =
      status === 'VERIFIED'
        ? 'Are you sure you want to approve this UTR and mark it VERIFIED?'
        : 'Are you sure you want to REJECT this transaction and revoke the student\'s active subscription?';
    if (!window.confirm(confirmMsg)) return;

    setProcessingId(paymentId);
    try {
      await verifyAdminPaymentApi(paymentId, status);
      await loadPayments();
    } catch (err: any) {
      alert(err.message || 'Failed to update payment status');
    } finally {
      setProcessingId(null);
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
            This dashboard is reserved strictly for Master Admin (<span className="font-mono text-slate-700">harshsaini0912@gmail.com</span>).
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
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-700">
                Master Admin Portal
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-indigo-600" />
              UPI Payments & Subscriptions
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Verify student bank UTR submissions, monitor 0% fee collections, and manage subscription access.
            </p>
          </div>

          <button
            onClick={loadPayments}
            disabled={loading}
            className="self-start sm:self-auto px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Revenue</span>
              <IndianRupee className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">₹{stats.revenue.toLocaleString('en-IN')}</div>
            <div className="text-[11px] text-emerald-600 font-medium">0% Gateway Cuts</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Total Transactions</span>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900">{stats.total}</div>
            <div className="text-[11px] text-slate-500 font-medium">{stats.verified} Verified</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Pending Review</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-600">{stats.pending}</div>
            <div className="text-[11px] text-slate-500 font-medium">Awaiting manual check</div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-1">
            <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
              <span>Rejected</span>
              <XCircle className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-rose-600">{stats.rejected}</div>
            <div className="text-[11px] text-slate-500 font-medium">Access revoked</div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by 12-digit UTR, student name, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 focus:outline-none rounded-xl text-xs font-medium text-slate-800 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(['ALL', 'PENDING', 'VERIFIED', 'REJECTED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st === 'ALL' ? 'All Records' : st.charAt(0) + st.slice(1).toLowerCase()}
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
                    <th className="py-3 px-4">12-Digit UTR</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPayments.map((p) => {
                    const isProcessing = processingId === p.id;
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

                        {/* 12-Digit UTR */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded-md w-fit">
                            <span>{p.utrNumber}</span>
                            <button
                              onClick={() => handleCopyUtr(p.utrNumber)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Copy UTR"
                            >
                              {copiedUtr === p.utrNumber ? (
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

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {p.status !== 'VERIFIED' && (
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'VERIFIED')}
                                disabled={isProcessing}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] shadow-sm transition-all"
                              >
                                Approve
                              </button>
                            )}
                            {p.status !== 'REJECTED' && (
                              <button
                                onClick={() => handleUpdateStatus(p.id, 'REJECTED')}
                                disabled={isProcessing}
                                className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-lg text-[11px] transition-all"
                              >
                                Reject
                              </button>
                            )}
                          </div>
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
    </div>
  );
};

export default AdminPaymentsPage;
