import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Copy,
  ExternalLink,
  HelpCircle,
  Sparkles,
  Zap,
  ArrowRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { createPaymentIntentApi, submitUtrPaymentApi } from '../utils/api';
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

  const [loadingIntent, setLoadingIntent] = useState(false);
  const [upiUri, setUpiUri] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [payeeId, setPayeeId] = useState('harshsaini0912@okhdfcbank');
  const [orderId, setOrderId] = useState('');
  const [copiedUpi, setCopiedUpi] = useState(false);

  // UTR submission states
  const [utrInput, setUtrInput] = useState('');
  const [submittingUtr, setSubmittingUtr] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showUtrHelp, setShowUtrHelp] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setUtrInput('');
      setErrorMessage('');
      setIsSuccess(false);
      return;
    }

    let isMounted = true;
    setLoadingIntent(true);
    setErrorMessage('');

    createPaymentIntentApi(plan.id)
      .then(async (data) => {
        if (!isMounted) return;
        setUpiUri(data.upiUri || '');
        setPayeeId(data.payeeId || 'harshsaini0912@okhdfcbank');
        setOrderId(data.orderId || '');

        if (data.upiUri) {
          try {
            const qrUrl = await QRCode.toDataURL(data.upiUri, {
              width: 320,
              margin: 1.5,
              errorCorrectionLevel: 'H',
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            if (isMounted) setQrDataUrl(qrUrl);
          } catch (qrErr) {
            console.error('QR code generation error:', qrErr);
          }
        }
        setLoadingIntent(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error('Payment intent error:', err);
        setLoadingIntent(false);
        // Fallback default intent
        const fallbackOrderId = `ABH_${Date.now().toString().slice(-6)}`;
        const fallbackUri = `upi://pay?pa=harshsaini0912@okhdfcbank&pn=Abhiyantra%20Test%20Series&am=${plan.price.toFixed(2)}&cu=INR&tn=Abhiyantra%20GATE%20Pass&tr=${fallbackOrderId}`;
        setUpiUri(fallbackUri);
        setOrderId(fallbackOrderId);
        setPayeeId('harshsaini0912@okhdfcbank');
        QRCode.toDataURL(fallbackUri, { width: 320, margin: 1.5, errorCorrectionLevel: 'H' })
          .then((url) => {
            if (isMounted) setQrDataUrl(url);
          })
          .catch(() => {});
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, plan.id, plan.price]);

  if (!isOpen) return null;

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(payeeId);
    setCopiedUpi(true);
    setTimeout(() => setCopiedUpi(false), 2000);
  };

  const handleUtrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only accept numeric digits, up to 12
    const clean = e.target.value.replace(/\D/g, '').slice(0, 12);
    setUtrInput(clean);
    if (errorMessage) setErrorMessage('');
  };

  const handleSubmitUtr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setErrorMessage('Please sign in with Google first before submitting payment.');
      return;
    }

    if (utrInput.length !== 12) {
      setErrorMessage('Please enter the full 12-digit UTR / Reference number from your payment receipt.');
      return;
    }

    setSubmittingUtr(true);
    setErrorMessage('');

    try {
      await submitUtrPaymentApi(plan.id, utrInput, orderId);
      await refreshUser();
      setIsSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed. Please check the UTR number and retry.');
    } finally {
      setSubmittingUtr(false);
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
              0% Platform Fee · Direct UPI
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/10 text-white border border-white/20">
              Instant Activation
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
            Unlock Abhiyantra GATE Pass
          </h2>
          <p className="text-xs sm:text-sm text-indigo-100 mt-1">
            Pay directly via Google Pay, PhonePe, Paytm, or CRED with zero extra charges.
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
                  Your 12-digit UTR has been registered. You have instant, full access to all 65-question authentic mock tests, solution reviews, and mistake retests!
                </p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs text-emerald-900 space-y-1">
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-800">Plan:</span>
                  <span>{plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-800">Validity:</span>
                  <span>365 Days (Full Year)</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-emerald-800">UTR Recorded:</span>
                  <span className="font-mono">{utrInput}</span>
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

              {/* Step 1: Pay using UPI */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">1</span>
                    Scan QR or Pay with UPI App
                  </span>
                  <span className="text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Zero Fee
                  </span>
                </div>

                {/* Mobile Direct UPI Intent Button */}
                <div className="sm:hidden mb-3">
                  <a
                    href={upiUri}
                    className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition-all"
                  >
                    <Zap className="w-4 h-4 text-emerald-200" />
                    <span>Pay ₹{plan.price} via GPay / PhonePe / Paytm</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </a>
                </div>

                {/* QR Code Container with Direct Pre-filled ₹59 Amount */}
                <div className="bg-white border-2 border-indigo-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-xs">
                  <div className="relative w-44 h-44 bg-white rounded-2xl flex items-center justify-center p-2 border-2 border-indigo-100 shadow-sm shrink-0">
                    {loadingIntent && !qrDataUrl ? (
                      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    ) : (
                      <div className="relative w-full h-full flex items-center justify-center">
                        <img
                          src={qrDataUrl || `/payment-qr-${plan.price}.png` || '/payment-qr-59.png'}
                          alt={`Official UPI Payment QR with prefilled ₹${plan.price}`}
                          className="w-full h-full object-contain rounded-xl"
                        />
                        <div className="absolute inset-0 m-auto w-8 h-8 bg-white rounded-full shadow-md flex items-center justify-center border border-slate-200 p-0.5 pointer-events-none">
                          <img src="/logo.avif" alt="Abhiyantra" className="w-6 h-6 object-contain rounded-full" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-xs flex-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>Direct ₹{plan.price}.00 Pre-filled in UPI App</span>
                    </div>

                    <p className="font-semibold text-slate-800">
                      Scan with Google Pay, PhonePe, Paytm, or CRED. The ₹{plan.price} amount will automatically appear pre-filled on your screen.
                    </p>
                    
                    {/* Copy UPI ID */}
                    <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                      <span className="text-slate-500 text-[11px]">UPI ID:</span>
                      <span className="font-mono font-bold text-slate-900 select-all">{payeeId}</span>
                      <button
                        type="button"
                        onClick={handleCopyUpi}
                        className="ml-auto p-1 text-slate-500 hover:text-indigo-600 transition-colors"
                        title="Copy UPI ID"
                      >
                        {copiedUpi ? (
                          <span className="text-[10px] font-bold text-emerald-600">Copied!</span>
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <p className="text-[11px] text-slate-500">
                      Exact Amount: <span className="font-bold text-slate-900 font-mono">₹{plan.price}.00</span> (Zero manual typing needed)
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2: Submit UTR */}
              <form onSubmit={handleSubmitUtr} className="space-y-3 pt-1 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-bold">2</span>
                    Enter 12-Digit UPI UTR / Ref Number
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowUtrHelp(!showUtrHelp)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1"
                  >
                    <HelpCircle className="w-3.5 h-3.5" />
                    Where to find UTR?
                  </button>
                </div>

                {showUtrHelp && (
                  <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-xs text-indigo-950 space-y-1.5 animate-in fade-in duration-200">
                    <p className="font-bold text-indigo-900">How to find the 12-digit UTR:</p>
                    <ul className="list-disc list-inside space-y-1 text-indigo-800 pl-1 text-[11px]">
                      <li><strong>PhonePe:</strong> Open the payment receipt &rarr; look for <strong>UTR: XXXXXXXXXXXX</strong>.</li>
                      <li><strong>Google Pay:</strong> Tap the paid transaction &rarr; look for <strong>UPI Transaction ID: XXXXXXXXXXXX</strong>.</li>
                      <li><strong>Paytm:</strong> Check payment details &rarr; look for <strong>UPI Ref No: XXXXXXXXXXXX</strong>.</li>
                    </ul>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={12}
                      placeholder="e.g. 432819284712"
                      value={utrInput}
                      onChange={handleUtrChange}
                      className="w-full px-3.5 py-3 bg-slate-50 border-2 border-slate-200 focus:border-indigo-600 focus:bg-white focus:outline-none rounded-xl font-mono text-base font-bold text-slate-900 tracking-wider placeholder:text-slate-400 placeholder:font-normal placeholder:tracking-normal transition-all"
                      required
                    />
                    <div className="absolute right-3.5 top-3.5 text-xs font-medium text-slate-400 font-mono">
                      {utrInput.length}/12
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Instant provisional access is granted immediately upon submitting your 12-digit reference number.
                  </p>
                </div>

                {errorMessage && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submittingUtr || utrInput.length !== 12}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/20 text-sm flex items-center justify-center gap-2 transition-all"
                >
                  {submittingUtr ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying & Unlocking Access...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                      <span>Submit UTR & Unlock Instant Access</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-100 px-6 py-3 text-center text-[11px] text-slate-500 flex items-center justify-center gap-4">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            100% Secure Direct UPI
          </span>
          <span>•</span>
          <span>Verified by Abhiyantra Team</span>
          <span>•</span>
          <span>Contact: support@abhiyantra.in</span>
        </div>
      </div>
    </div>
  );
};
