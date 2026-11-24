import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Check,
  Zap,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  Clock,
  ArrowRight,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchPricingPlansApi } from '../utils/api';
import { PaymentModal } from '../components/PaymentModal';
import type { PricingPlan } from '../types';

export const PricingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchPricingPlansApi()
      .then((data) => {
        if (mounted) {
          setPlans(data.plans || []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSelectPlan = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      {/* Top Hero Section */}
      <div className="max-w-4xl mx-auto text-center space-y-4 mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
          <Zap className="w-3.5 h-3.5 text-indigo-600" />
          <span>0% Transaction Fee · Direct UPI Payment · Instant Access</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tight">
          Supercharge Your GATE Preparation
        </h1>

        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
          Practice authentic 65-question GATE CBT mock papers, master weak concepts with the Mistake Notebook, and track your all-India percentile.
        </p>

        {/* User Active Subscription Banner */}
        {user?.isSubscribed && (
          <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl max-w-xl mx-auto text-left flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-950">Your GATE Pass is Currently Active!</p>
                <p className="text-xs text-emerald-800">
                  {user.subscriptionUntil ? (
                    <>Valid until {new Date(user.subscriptionUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  ) : (
                    'Unlimited active access'
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/report-cards')}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
            >
              View Tests &rarr;
            </button>
          </div>
        )}
      </div>

      {/* Pricing Cards Grid */}
      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mb-16">
        {loading ? (
          <div className="col-span-2 text-center py-16 text-slate-400">Loading plans...</div>
        ) : (
          plans.map((p) => {
            const isPopular = p.popular;
            return (
              <div
                key={p.id}
                className={`relative rounded-3xl bg-white p-7 sm:p-9 shadow-lg transition-all flex flex-col justify-between ${
                  isPopular
                    ? 'border-2 border-indigo-600 shadow-indigo-100 ring-4 ring-indigo-50 md:-translate-y-2'
                    : 'border border-slate-200 hover:border-slate-300'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-full shadow-md">
                    Most Popular Choice
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg">
                      {p.discountBadge}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {p.durationDays} Days Access
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{p.name}</h3>

                  <div className="mt-5 mb-6 flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-slate-900">₹{p.price}</span>
                    <span className="text-base text-slate-400 line-through">₹{p.originalPrice}</span>
                    <span className="text-xs font-bold text-emerald-600 ml-1">Save 75%</span>
                  </div>

                  <div className="border-t border-slate-100 pt-6 space-y-3.5 mb-8">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">What's Included:</p>
                    {p.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-sm text-slate-700">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                        <span>{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectPlan(p)}
                  className={`w-full py-4 px-6 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                    isPopular
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-indigo-500/25'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-slate-900/10'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>Get Pass Now (₹{p.price})</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Trust & Direct UPI Details Card */}
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-indigo-900 via-slate-900 to-indigo-950 rounded-3xl p-8 sm:p-10 text-white shadow-xl mb-16 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-base">Instant Auto-Activation</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Pay via UPI, Cards, NetBanking, or Cred. Your subscription activates automatically within seconds.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-blue-400">
              <Clock className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-base">Zero Manual Verification</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Automated cryptographic signature verification ensures immediate access without entering any reference numbers.
            </p>
          </div>

          <div className="space-y-2">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-base">All-India Authentic Tests</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Built strictly to the official GATE pattern with Section wise General Aptitude + Technical marks distribution.
            </p>
          </div>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Frequently Asked Questions</h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Everything you need to know about the pass and activation</p>
        </div>

        <div className="space-y-3">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              What payment methods are supported?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              We support all major payment modes through Razorpay Standard Checkout: UPI (Google Pay, PhonePe, Paytm, BHIM, CRED), all Debit & Credit cards (Visa, Mastercard, RuPay), NetBanking (50+ banks), and Wallets.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              How fast will my subscription be activated?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Immediately! As soon as your payment completes on Razorpay, our backend server automatically verifies the payment signature and activates your Pro Pass in real time. No manual verification or approval is required.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              How many times can I re-attempt mock tests?
            </h3>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              Unlimited times! Every mock test can be attempted as many times as you like. You can also retest only your incorrect questions directly from your Mistake Notebook.
            </p>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedPlan={selectedPlan}
        onSuccess={() => {
          // Success callback
        }}
      />
    </div>
  );
};

export default PricingPage;
