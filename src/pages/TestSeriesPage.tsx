import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import {
  Layers,
  Sparkles,
  BookOpen,
  ArrowRight,
  Clock,
  ShieldCheck,
  Award,
} from 'lucide-react';

export const TestSeriesPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />

      {/* Hero Header */}
      <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-12 px-4 sm:px-6 lg:px-8 border-b border-indigo-900/50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent_60%)] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Official GATE 2026 / 2027 Portal
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            GATE Test Series
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            All-India Computer Based Test (CBT) mock tests modeled strictly after the latest official IIT GATE syllabus, marking scheme, and virtual calculator.
          </p>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        {/* Placeholder / Empty State Card */}
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-14 text-center shadow-xs space-y-6">
          <div className="w-20 h-20 rounded-3xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100 shadow-inner">
            <Layers className="w-10 h-10" />
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
              Test Series Under Preparation
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Curated sectional test series, subject packs, and All-India national level mock schedules are currently being organized here.
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 max-w-2xl mx-auto text-left">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900">Subject-Wise Packs</h3>
              <p className="text-[11px] text-slate-500 leading-normal">
                Topic-focused practice papers to master high-weightage engineering modules.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900">Full 65-Q Mock Tests</h3>
              <p className="text-[11px] text-slate-500 leading-normal">
                Full-length 3-hour authentic simulations with national rank & percentile analysis.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-xs text-slate-900">AI Mistake Analytics</h3>
              <p className="text-[11px] text-slate-500 leading-normal">
                Detailed solution walkthroughs and 1-click revision retests from your Mistake Notebook.
              </p>
            </div>
          </div>

          {/* Quick Action Button */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Practice Available Mock Tests</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => navigate('/pricing')}
              className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>View GATE Pass Details</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default TestSeriesPage;
