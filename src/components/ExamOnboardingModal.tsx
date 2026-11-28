import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  Atom,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Calculator,
  Ban,
  Loader2,
  BookOpen,
} from 'lucide-react';

export const ExamOnboardingModal: React.FC = () => {
  const { user, setTargetExam } = useAuth();
  const [savingExam, setSavingExam] = useState<'GATE' | 'JEE_MAINS' | 'OTHER' | null>(null);

  // Show modal ONLY if user is logged in and has not set their target exam yet
  const shouldShow = Boolean(user && (user.targetExam === null || user.targetExam === undefined));

  if (!shouldShow) return null;

  const handleSelect = async (exam: 'GATE' | 'JEE_MAINS' | 'OTHER') => {
    try {
      setSavingExam(exam);
      await setTargetExam(exam);
    } catch (err) {
      console.error('Failed to set target exam:', err);
    } finally {
      setSavingExam(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-10 shadow-2xl border border-slate-200 text-center space-y-6 relative overflow-hidden">
        {/* Background glow decorative */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="space-y-3 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Welcome to Abhiyantra</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Which Exam Are You Preparing For?
          </h2>

          <p className="text-xs sm:text-sm text-slate-500 max-w-lg mx-auto leading-relaxed">
            Select your target examination below <strong className="text-slate-800 font-bold">(one-time selection)</strong>. Your student account will be locked to this track to personalize your mock test series, CBT papers, and passes.
          </p>
        </div>

        {/* Exam Cards Selection Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 pt-2 text-left relative z-10">
          {/* Card 1: GATE Examination */}
          <div
            onClick={() => !savingExam && handleSelect('GATE')}
            className="group rounded-3xl p-6 border-2 border-slate-200 hover:border-indigo-600 bg-slate-50/50 hover:bg-indigo-50/20 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between space-y-4 relative"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-800">
                  IIT Pattern
                </span>
              </div>

              <div>
                <h3 className="font-black text-lg text-slate-900 group-hover:text-indigo-700 transition-colors">
                  GATE Examination
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Graduate Aptitude Test in Engineering for M.Tech admissions and PSU recruitment.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Computer Science, IT & Engineering Math</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>65 Questions · 100 Marks · 180 Minutes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Calculator className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Virtual Scientific Calculator Available</span>
                </div>
              </div>
            </div>

            <button
              disabled={savingExam !== null}
              className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingExam === 'GATE' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Setting Up GATE...</span>
                </>
              ) : (
                <>
                  <span>Select GATE Exam</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Card 2: JEE Mains Examination */}
          <div
            onClick={() => !savingExam && handleSelect('JEE_MAINS')}
            className="group rounded-3xl p-6 border-2 border-slate-200 hover:border-cyan-600 bg-slate-50/50 hover:bg-cyan-50/20 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between space-y-4 relative"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <Atom className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-100 text-cyan-800">
                  NTA Pattern
                </span>
              </div>

              <div>
                <h3 className="font-black text-lg text-slate-900 group-hover:text-cyan-700 transition-colors">
                  JEE Mains Examination
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Joint Entrance Examination for admissions into prestigious NITs, IIITs, and CFTIs.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                  <span>Physics, Chemistry & Mathematics</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                  <span>75 Questions · 300 Marks (+4 / -1 Marking)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ban className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span>Strict NTA Standard (No Calculator)</span>
                </div>
              </div>
            </div>

            <button
              disabled={savingExam !== null}
              className="w-full py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-700 active:bg-cyan-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingExam === 'JEE_MAINS' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Setting Up JEE Mains...</span>
                </>
              ) : (
                <>
                  <span>Select JEE Mains Exam</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Card 3: Other / School & College Exams */}
          <div
            onClick={() => !savingExam && handleSelect('OTHER')}
            className="group rounded-3xl p-6 border-2 border-slate-200 hover:border-amber-600 bg-slate-50/50 hover:bg-amber-50/20 shadow-xs hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between space-y-4 relative"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                  <BookOpen className="w-6 h-6" />
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800">
                  Dynamic
                </span>
              </div>

              <div>
                <h3 className="font-black text-lg text-slate-900 group-hover:text-amber-700 transition-colors">
                  Other Examinations
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Class 8th to 12th Board mock tests, B.Tech semester papers, and custom mock exams.
                </p>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Class 8–12 & University Subjects</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Flexible Marks (1m, 2m, 3m, 5m, 10m)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Multiple Sections & Zero Negatives</span>
                </div>
              </div>
            </div>

            <button
              disabled={savingExam !== null}
              className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-600/20 transition-all cursor-pointer disabled:opacity-50"
            >
              {savingExam === 'OTHER' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Setting Up Other Track...</span>
                </>
              ) : (
                <>
                  <span>Select Other Exams</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bottom Note */}
        <p className="text-[11px] text-slate-400">
          You can also switch or explore either exam category anytime using the exam switcher in the top navigation bar.
        </p>
      </div>
    </div>
  );
};

export default ExamOnboardingModal;
