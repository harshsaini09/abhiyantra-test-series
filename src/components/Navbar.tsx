import { Link, useLocation } from 'react-router-dom';
import { Database, Wrench, Home } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  const links = [
    { to: '/', label: 'Home / Import', icon: <Home className="w-4 h-4" /> },
    { to: '/question-bank', label: 'Question Bank', icon: <Database className="w-4 h-4" /> },
    { to: '/custom-builder', label: 'Custom Test Builder', icon: <Wrench className="w-4 h-4" /> },
  ];

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 text-indigo-700 hover:text-indigo-800 transition-colors group">
            <img
              src="/logo.avif"
              alt="Abhiyantra Logo"
              className="w-10 h-10 object-contain rounded-xl bg-slate-50 border border-slate-200 p-1 shadow-xs group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900 group-hover:text-indigo-700 transition-colors">
                abhiyantra
              </span>
              <span className="block text-[10px] uppercase font-bold tracking-wider text-indigo-600">
                GATE Examination Platform
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1 sm:gap-2">
            {links.map((link) => {
              const isActive = location.pathname === link.to;
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
        </div>
      </div>
    </nav>
  );
}
