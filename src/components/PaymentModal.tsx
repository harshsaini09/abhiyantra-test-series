import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Zap,
  ArrowRight,
  AlertCircle,
  Loader2,
  Lock,
  CreditCard,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  createRazorpayOrderApi,
  verifyRazorpayPaymentApi,
} from '../utils/api';
import type { PricingPlan } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan?: PricingPlan | null;
  onSuccess?: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  selectedPlan,
  onSuccess,
}) => {
  const { user, refreshUser } = useAuth();

  const plan: PricingPlan = selectedPlan || {
    id: 'gate-complete-pass',
    name: 'GATE Complete Mock Test Series (2026/2027)',
    price: 59,
    originalPrice: 499,
    discountBadge: '88% OFF - Limited Special',
    durationDays: 365,
    popular: true,
    features: [
      'Full 65-Question Authentic GATE CBT Mock Tests',
      'GATE Authentic Marking Scheme (+1, -1/3 & +2, -2/3)',
      'Mistake Revision Notebook & 1-Click Retest',
      'AI Weak Topic Diagnosis & Ranking Insights',
    ],
  };

  const [loadingRazorpay, setLoadingRazorpay] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [verifiedPaymentId, setVerifiedPaymentId] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setErrorMessage('');
      setIsSuccess(false);
      setVerifiedPaymentId('');
      setLoadingRazorpay(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRazorpayCheckout = async () => {
    if (!user) {
      setErrorMessage('Please sign in with Google first before completing checkout.');
      return;
    }

    setLoadingRazorpay(true);
    setErrorMessage('');

    try {
      // 1. Minimum amount validation (100 paise = ₹1)
      const amountInPaise = Math.round(plan.price * 100);
      if (amountInPaise < 100) {
        throw new Error('Minimum order amount must be at least 100 paise.');
      }

      // 2. Call backend order creation endpoint
      const orderData = await createRazorpayOrderApi(amountInPaise, `rcpt_${Date.now()}`, {
        planId: plan.id,
        planName: plan.name,
        userEmail: user.email,
      });

      const keyId =
        orderData.key_id ||
        (import.meta as any).env?.VITE_RAZORPAY_KEY_ID ||
        'rzp_live_U3v62oDNcKSdvL';

      // 3. Open Razorpay Standard Checkout modal
      const options = {
        key: keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Abhiyantra Examination Platform',
        description: plan.name,
        image: '/logo.avif',
        order_id: orderData.order_id,
        prefill: {
          name: user.name,
          email: user.email,
        },
        theme: {
          color: '#4f46e5',
        },
        modal: {
          ondismiss: () => {
            setLoadingRazorpay(false);
          },
        },
        handler: async (response: any) => {
          try {
            // 4. Verify payment signature on backend
            const verifyRes = await verifyRazorpayPaymentApi({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan.id,
              planName: plan.name,
              amount: plan.price,
            });

            setVerifiedPaymentId(response.razorpay_payment_id || verifyRes.payment_id || '');
            await refreshUser();
            setIsSuccess(true);
            if (onSuccess) onSuccess();
          } catch (verifyErr: any) {
            setErrorMessage(verifyErr.message || 'Payment signature verification failed.');
          } finally {
            setLoadingRazorpay(false);
          }
        },
      };

      if (!(window as any).Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please verify your network connection.');
      }

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (failRes: any) => {
        setLoadingRazorpay(false);
        const desc = failRes?.error?.description || 'Payment failed or was cancelled.';
        setErrorMessage(desc);
      });

      rzp.open();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to initiate Razorpay checkout.');
      setLoadingRazorpay(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-indigo-800 text-white p-5 sm:p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
              <Zap className="w-3.5 h-3.5 text-emerald-300" />
              Instant Auto-Activation
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-200" />
              Razorpay Secured
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            Unlock Abhiyantra GATE Pass
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100 mt-1">
            Instant, automated access to all authentic GATE CBT mock tests and mistake revision.
          </p>
        </div>

        {/* Modal Body */}
        <div className="overflow-y-auto p-5 sm:p-6 space-y-5 flex-1">
          {isSuccess ? (
            /* Success State */
            <div className="text-center py-6 px-3 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner ring-8 ring-emerald-50">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-2xl font-bold text-slate-900">Pass Activated Successfully!</h3>
                <p className="text-sm text-slate-600 mt-1.5 max-w-sm mx-auto">
                  Your payment has been verified by Razorpay. You now have full, unrestricted access to all 65-question authentic mock tests, solution reviews, and mistake retests!
                </p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs text-emerald-900 space-y-1.5">
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-800">Plan:</span>
                  <span className="font-medium">{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-800">Validity:</span>
                  <span className="font-medium">365 Days (Full Year)</span>
                </div>
                {verifiedPaymentId && (
                  <div className="flex justify-between">
                    <span className="font-semibold text-emerald-800">Payment ID:</span>
                    <span className="font-mono text-[11px]">{verifiedPaymentId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-800">Status:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Auto-Verified & Active
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/25 transition-all text-sm flex items-center justify-center gap-2"
              >
                <span>Go to Test Series & Start Practicing</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Selected Plan Summary Card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">{plan.name}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                      {plan.discountBadge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Valid for {plan.durationDays} days · All mock tests unlocked</p>
                </div>
                <div className="text-right">
                  <div className="text-xl font-extrabold text-slate-900">₹{plan.price}</div>
                  <div className="text-xs text-slate-400 line-through">₹{plan.originalPrice}</div>
                </div>
              </div>

              {/* What is Included Checklist */}
              <div className="bg-indigo-50/50 border border-indigo-100/70 rounded-xl p-3.5 space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Included in this pass
                </span>
                <div className="grid grid-cols-1 gap-1.5 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>65-Question Authentic GATE CBT Mock Tests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Official Marking Scheme (+1, -1/3 & +2, -2/3) + Virtual Calculator</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Mistake Notebook & 1-Click Retest Engine</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>Subject Mastery Breakdown & All-India Percentile</span>
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Primary Razorpay Action Button */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleRazorpayCheckout}
                  disabled={loadingRazorpay}
                  className="w-full py-4 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 text-sm transition-all cursor-pointer active:scale-[0.99] disabled:opacity-75 disabled:cursor-wait"
                >
                  {loadingRazorpay ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Opening Secure Checkout...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5 text-emerald-300" />
                      <span>Pay ₹{plan.price} & Unlock Instant Pro Access</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex flex-col items-center gap-1.5 text-center">
                  <p className="text-[11px] text-slate-600 font-medium flex items-center justify-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    <span>Supports <strong>UPI</strong> (GPay, PhonePe, Paytm), <strong>Cards</strong>, <strong>NetBanking</strong> & <strong>Cred</strong></span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Your payment is processed through Razorpay's PCI-DSS compliant secure checkout.
                  </p>
                </div>
              </div>

              {/* Security & Guarantee Trust Card */}
              <div className="border border-slate-200/80 rounded-xl p-3 bg-slate-50/70 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
                <div className="text-[11px] text-slate-600 leading-tight">
                  <span className="font-bold text-slate-800 block mb-0.5">Automated Signature Verification</span>
                  Zero manual UTR entry needed. Subscription is activated within seconds of successful payment.
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-500 flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            256-Bit SSL Encrypted
          </span>
          <span>•</span>
          <span>Powered by Razorpay Standard Checkout</span>
          <span>•</span>
          <span>Instant Activation</span>
        </div>
      </div>
    </div>
  );
};
