import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, Wrench, Home, Award, LogOut, ChevronDown, Sparkles, ShieldCheck, Layers, Atom, GraduationCap, Check } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const { user, login, logout, loading, targetExam, setTargetExam } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const examDropdownRef = useRef<HTMLDivElement>(null);

  const isMasterAdmin = user?.role === 'ADMIN' || user?.email?.toLowerCase() === 'harshsaini0912@gmail.com';
  const isTeacher = user?.role === 'TEACHER';
  const isTeacherOrAdmin = isMasterAdmin || isTeacher;
  const isProPassHolder = Boolean(user?.isSubscribed && user?.subscriptionTier !== 'gate-booster-pass');

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (examDropdownRef.current && !examDropdownRef.current.contains(event.target as Node)) {
        setExamDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const baseLinks = [
    { to: '/', label: 'Home', shortLabel: 'Home', icon: <Home className="w-4 h-4" /> },
    { to: '/test-series', label: 'Test Series', shortLabel: 'Series', icon: <Layers className="w-4 h-4" /> },
    { to: '/pricing', label: 'GATE Pass', shortLabel: 'Pass', icon: <Sparkles className="w-4 h-4 text-amber-500" /> },
    { to: '/report-cards', label: 'Report Cards', shortLabel: 'Reports', icon: <Award className="w-4 h-4" /> },
  ];

  const facultyLinks = [
    { to: '/question-bank', label: 'Question Bank', shortLabel: 'Q-Bank', icon: <Database className="w-4 h-4" /> },
    { to: '/custom-builder', label: 'Custom Builder', shortLabel: 'Builder', icon: <Wrench className="w-4 h-4" /> },
  ];

  const links = isTeacherOrAdmin
    ? [baseLinks[0], baseLinks[1], ...facultyLinks, baseLinks[2], baseLinks[3]]
    : baseLinks;

  const isLinkActive = (to: string) => {
    if (location.pathname === to) return true;
    if (to === '/report-cards' && location.pathname === '/report') return true;
    return false;
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 sm:gap-2.5 text-indigo-700 hover:text-indigo-800 transition-colors group shrink-0">
              <img
                src="/logo.avif"
                alt="Abhiyantra Logo"
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl bg-slate-50 border border-slate-200 p-1 shadow-xs group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-700 transition-colors">
                  abhiyantra
                </span>
                <span className="hidden sm:block text-[10px] uppercase font-bold tracking-wider text-indigo-600">
                  {targetExam === 'JEE_MAINS' ? 'JEE Mains Portal' : 'GATE Exam Portal'}
                </span>
              </div>
            </Link>

            {/* Exam Target Switcher Pill */}
            <div className="relative" ref={examDropdownRef}>
              <button
                type="button"
                onClick={() => setExamDropdownOpen(!examDropdownOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                  targetExam === 'JEE_MAINS'
                    ? 'bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100/80'
                    : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100/80'
                }`}
                title="Switch Target Examination"
              >
                {targetExam === 'JEE_MAINS' ? (
                  <>
                    <Atom className="w-3.5 h-3.5 text-cyan-600" />
                    <span>JEE Mains</span>
                  </>
                ) : (
                  <>
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    <span>GATE</span>
                  </>
                )}
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {examDropdownOpen && (
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Target Examination
                  </div>
                  <button
                    onClick={() => {
                      setTargetExam('GATE');
                      setExamDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer ${
                      targetExam === 'GATE' ? 'text-indigo-600 bg-indigo-50/50 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-indigo-600" />
                      <span>GATE Exam</span>
                    </div>
                    {targetExam === 'GATE' && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                  </button>
                  <button
                    onClick={() => {
                      setTargetExam('JEE_MAINS');
                      setExamDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer ${
                      targetExam === 'JEE_MAINS' ? 'text-cyan-600 bg-cyan-50/50 font-bold' : 'text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Atom className="w-4 h-4 text-cyan-600" />
                      <span>JEE Mains</span>
                    </div>
                    {targetExam === 'JEE_MAINS' && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Center Navigation Links (Tablet landscape & Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {links.map((link) => {
              const isActive = isLinkActive(link.to);
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  {link.icon}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>

          {/* Right: Auth State (Google Sign In or User Profile) */}
          <div className="flex items-center gap-2 shrink-0">
            {loading ? (
              <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
            ) : user ? (
              /* Signed In Profile Dropdown */
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1 sm:p-1.5 sm:pl-2 sm:pr-3 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="text-left hidden sm:block max-w-[120px] lg:max-w-[150px]">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                      {isMasterAdmin ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-purple-600 text-white shrink-0">
                          ADMIN
                        </span>
                      ) : isTeacher ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-blue-600 text-white shrink-0">
                          TEACHER
                        </span>
                      ) : user.isSubscribed ? (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-white shrink-0">
                          PRO
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-100 text-slate-600 shrink-0">
                          STUDENT
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-900">{user.name}</p>
                        {isMasterAdmin ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                            PLATFORM ADMIN
                          </span>
                        ) : isTeacher ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            FACULTY / TEACHER
                          </span>
                        ) : user.isSubscribed ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            PRO PASS
                          </span>
                        ) : (
                          <Link
                            to="/pricing"
                            onClick={() => setDropdownOpen(false)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800"
                          >
                            Upgrade &rarr;
                          </Link>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        <span className="text-[10px] font-semibold text-emerald-700">
                          {isMasterAdmin
                            ? 'Master Administrator'
                            : isTeacher
                            ? 'Faculty / Teacher Access'
                            : user.isSubscribed
                            ? 'Pro Student (Active Pass)'
                            : 'Registered Student'}
                        </span>
                      </div>
                    </div>

                    <div className="py-1">
                      {isMasterAdmin && (
                        <Link
                          to="/admin/payments"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50/70 hover:bg-indigo-100 transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4 text-indigo-600" />
                          Admin Console (Payments & Users)
                        </Link>
                      )}
                      <Link
                        to="/test-series"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                      >
                        <Layers className="w-4 h-4 text-indigo-600" />
                        GATE Test Series
                      </Link>
                      <Link
                        to="/pricing"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        GATE Test Series Passes
                      </Link>
                      <Link
                        to="/report-cards"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                      >
                        <Award className="w-4 h-4 text-indigo-600" />
                        My Saved Report Cards
                      </Link>
                      <Link
                        to="/report-cards?tab=personal-series"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 transition-colors"
                      >
                        <Layers className="w-4 h-4 text-indigo-600" />
                        My Personal Test Series
                      </Link>
                      {(isTeacherOrAdmin || isProPassHolder) && (
                        <Link
                          to="/custom-builder"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        >
                          <Wrench className="w-4 h-4 text-slate-500" />
                          Custom Test Builder
                        </Link>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Signed Out: Google Sign In Button */
              <div className="flex items-center scale-85 sm:scale-90 origin-right">
                <GoogleLogin
                  onSuccess={(credentialResponse) => {
                    if (credentialResponse.credential) {
                      login(credentialResponse.credential);
                    }
                  }}
                  onError={() => {
                    console.error('Google Sign In failed');
                  }}
                  shape="pill"
                  size="medium"
                  text="signin_with"
                />
              </div>
            )}
          </div>
        </div>

        {/* Mobile & Small Tablet Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-2 border-t border-slate-100">
          {links.map((link) => {
            const isActive = isLinkActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center gap-1 text-[11px] font-semibold py-1.5 px-2.5 rounded-lg transition-colors ${
                  isActive ? 'text-indigo-700 bg-indigo-50 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {link.icon}
                <span>{link.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
