import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Database, Wrench, Home, Award, LogOut, ChevronDown, Sparkles, ShieldCheck, Layers, Atom, GraduationCap, Check, BookOpen } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const { user, login, logout, loading, targetExam, setTargetExam } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [examDropdownOpen, setExamDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const examDropdownRef = useRef<HTMLDivElement>(null);

  const isMasterAdmin = user?.role === 'ADMIN' || ['harshsaini0912@gmail.com', 'harshsaini0912@gmail'].includes(user?.email?.toLowerCase() || '');
  const isTeacher = user?.role === 'TEACHER';
  const isTeacherOrAdmin = isMasterAdmin || isTeacher;
  const isProPassHolder = Boolean(user?.isSubscribed);
  const isPassUnlocked = isTeacherOrAdmin || isProPassHolder;

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
    ...(!isPassUnlocked
      ? [{ to: '/pricing', label: user?.targetExam === 'JEE_MAINS' ? 'JEE Pass' : user?.targetExam === 'GATE' ? 'GATE Pass' : 'Exam Pass', shortLabel: 'Pass', icon: <Sparkles className="w-4 h-4 text-amber-500" /> }]
      : []),
    { to: '/report-cards', label: 'Report Cards', shortLabel: 'Reports', icon: <Award className="w-4 h-4" /> },
  ];

  const facultyLinks = [
    { to: '/question-bank', label: 'Question Bank', shortLabel: 'Q-Bank', icon: <Database className="w-4 h-4" /> },
    { to: '/custom-builder', label: 'Custom Builder', shortLabel: 'Builder', icon: <Wrench className="w-4 h-4" /> },
  ];

  const customBuilderLink = {
    to: '/custom-builder',
    label: 'Custom Builder',
    shortLabel: 'Builder',
    icon: <Wrench className="w-4 h-4" />,
  };

  const links = isTeacherOrAdmin
    ? [baseLinks[0], baseLinks[1], ...facultyLinks, ...baseLinks.slice(2)]
    : isProPassHolder
    ? [baseLinks[0], baseLinks[1], customBuilderLink, ...baseLinks.slice(2)]
    : baseLinks;

  const isLinkActive = (to: string) => {
    if (location.pathname === to) return true;
    if (to === '/report-cards' && location.pathname === '/report') return true;
    return false;
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs w-full max-w-full overflow-visible min-w-0">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8 w-full max-w-full min-w-0">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1.5 sm:gap-4 w-full max-w-full min-w-0">
          {/* Logo & Brand */}
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 shrink">
            <Link to="/" className="flex items-center gap-1.5 sm:gap-2 text-slate-900 hover:text-teal-700 transition-colors group shrink-0">
              <img
                src="/abhiyantra-logo.png"
                alt="Abhiyantra Logo"
                className="h-6 sm:h-9 md:h-10 w-auto object-contain group-hover:scale-105 transition-transform shrink-0"
              />
              <div className="hidden sm:block border-l border-slate-200 pl-2.5">
                <span className="block text-[10px] uppercase font-bold tracking-wider text-teal-700">
                  {user?.targetExam === 'JEE_MAINS' ? 'JEE Mains Portal' : user?.targetExam === 'OTHER' ? 'School & College Portal' : user?.targetExam === 'GATE' ? 'GATE CBT Portal' : 'Examination Portal'}
                </span>
              </div>
            </Link>
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
                  className="flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 sm:pl-2 sm:pr-3 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all focus:outline-hidden focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
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
                  <div className="text-left hidden sm:block max-w-[110px] lg:max-w-[140px]">
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
                  <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
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

                    {/* Target Examination Switcher inside User Dropdown */}
                    <div className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/70">
                      <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {isTeacherOrAdmin ? 'Target Examination' : 'Enrolled Track'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                            targetExam === 'JEE_MAINS'
                              ? 'bg-cyan-100/70 border-cyan-200 text-cyan-800'
                              : targetExam === 'OTHER'
                              ? 'bg-amber-100/70 border-amber-200 text-amber-800'
                              : 'bg-indigo-100/70 border-indigo-200 text-indigo-800'
                          }`}
                        >
                          {targetExam === 'JEE_MAINS'
                            ? isTeacherOrAdmin ? 'JEE Mains Active' : 'JEE Mains (Locked)'
                            : targetExam === 'OTHER'
                            ? isTeacherOrAdmin ? 'Other Exams Active' : 'Other Exams'
                            : isTeacherOrAdmin ? 'GATE Active' : 'GATE (Locked)'}
                        </span>
                      </div>
                      {isTeacherOrAdmin ? (
                        <div className="grid grid-cols-3 gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetExam('GATE');
                            }}
                            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              targetExam === 'GATE'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <GraduationCap className="w-3 h-3" />
                            <span>GATE</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetExam('JEE_MAINS');
                            }}
                            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              targetExam === 'JEE_MAINS'
                                ? 'bg-cyan-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <Atom className="w-3 h-3" />
                            <span>JEE</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setTargetExam('OTHER');
                            }}
                            className={`flex items-center justify-center gap-1 py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              targetExam === 'OTHER'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Other</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
                          {targetExam === 'JEE_MAINS' ? (
                            <>
                              <Atom className="w-4 h-4 text-cyan-600 shrink-0" />
                              <span className="truncate">JEE Mains Track</span>
                            </>
                          ) : targetExam === 'OTHER' ? (
                            <>
                              <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                              <span className="truncate">Other Exams Track</span>
                            </>
                          ) : (
                            <>
                              <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                              <span className="truncate">GATE Track</span>
                            </>
                          )}
                        </div>
                      )}
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
                        {user?.targetExam === 'JEE_MAINS' ? 'JEE Mains Test Series' : user?.targetExam === 'GATE' ? 'GATE Test Series' : 'Official Test Series'}
                      </Link>
                      {!isPassUnlocked && (
                        <Link
                          to="/pricing"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                        >
                          <Sparkles className="w-4 h-4 text-amber-500" />
                          {user?.targetExam === 'JEE_MAINS' ? 'JEE Mains Passes' : user?.targetExam === 'GATE' ? 'GATE Test Series Passes' : 'Complete Exam Passes'}
                        </Link>
                      )}
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
              /* Signed Out: Exam Target Switcher + Google Sign In Button */
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative shrink-0" ref={examDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setExamDropdownOpen(!examDropdownOpen)}
                    className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-full border text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                      targetExam === 'JEE_MAINS'
                        ? 'bg-cyan-50 border-cyan-200 text-cyan-800 hover:bg-cyan-100/80'
                        : targetExam === 'OTHER'
                        ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100/80'
                        : 'bg-indigo-50 border-indigo-200 text-indigo-800 hover:bg-indigo-100/80'
                    }`}
                    title="Switch Target Examination"
                  >
                    {targetExam === 'JEE_MAINS' ? (
                      <>
                        <Atom className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                        <span>JEE</span>
                      </>
                    ) : targetExam === 'OTHER' ? (
                      <>
                        <BookOpen className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Other</span>
                      </>
                    ) : (
                      <>
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span>GATE</span>
                      </>
                    )}
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>

                  {examDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Target Examination
                      </div>
                      <button
                        type="button"
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
                        type="button"
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
                      <button
                        type="button"
                        onClick={() => {
                          setTargetExam('OTHER');
                          setExamDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold hover:bg-slate-50 transition cursor-pointer ${
                          targetExam === 'OTHER' ? 'text-amber-600 bg-amber-50/50 font-bold' : 'text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-amber-600" />
                          <span>Other Exams</span>
                        </div>
                        {targetExam === 'OTHER' && <Check className="w-3.5 h-3.5 text-amber-600" />}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center scale-75 sm:scale-90 origin-right shrink-0">
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
                    text="signin"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile & Small Tablet Navigation Bar */}
        <div className="flex md:hidden items-center justify-around py-1.5 border-t border-slate-100 overflow-x-auto no-scrollbar gap-0.5 px-0.5 w-full max-w-full">
          {links.map((link) => {
            const isActive = isLinkActive(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex flex-col items-center gap-0.5 text-[10px] sm:text-[11px] font-semibold py-1 px-1.5 rounded-lg transition-colors shrink-0 ${
                  isActive ? 'text-indigo-700 bg-indigo-50 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {link.icon}
                <span className="truncate max-w-[48px] sm:max-w-[55px] text-center">{link.shortLabel}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
