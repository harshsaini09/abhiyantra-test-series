import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { UserProfile, TestResults } from '../types';
import { fetchCurrentUser, loginWithGoogleApi, logoutUserApi, saveReportCardApi, updateTargetExamApi } from '../utils/api';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  targetExam: 'GATE' | 'JEE_MAINS' | 'OTHER';
  setTargetExam: (exam: 'GATE' | 'JEE_MAINS' | 'OTHER') => Promise<void>;
  login: (credential: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<UserProfile | null>;
  pendingResults: TestResults | null;
  stagePendingResults: (results: TestResults) => void;
  clearPendingResults: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_RESULTS_KEY = 'abhiyantra_pending_test_results';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const raw = localStorage.getItem('abhiyantra_user_profile');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [pendingResults, setPendingResults] = useState<TestResults | null>(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_RESULTS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [targetExam, setTargetExamState] = useState<'GATE' | 'JEE_MAINS' | 'OTHER'>(() => {
    try {
      const saved = localStorage.getItem('abhiyantra_active_exam');
      if (saved === 'JEE_MAINS' || saved === 'GATE' || saved === 'OTHER') return saved;
    } catch {}
    return 'GATE';
  });

  // Keep targetExam in sync with user profile
  useEffect(() => {
    if (user?.targetExam) {
      setTargetExamState(user.targetExam);
      try {
        localStorage.setItem('abhiyantra_active_exam', user.targetExam);
      } catch {}
    }
  }, [user?.targetExam]);

  const setTargetExam = async (exam: 'GATE' | 'JEE_MAINS' | 'OTHER') => {
    // Prevent switching once a student has already selected an exam track
    if (user && user.role === 'STUDENT' && user.targetExam && user.targetExam !== exam) {
      console.warn(`Target exam is locked to ${user.targetExam} for student accounts.`);
      return;
    }
    setTargetExamState(exam);
    try {
      localStorage.setItem('abhiyantra_active_exam', exam);
    } catch {}
    if (user) {
      setUser((prev) => (prev ? { ...prev, targetExam: exam } : null));
      try {
        await updateTargetExamApi(exam);
      } catch (err) {
        console.warn('Failed to persist target exam to DB:', err);
      }
    }
  };

  // Load user session on mount
  useEffect(() => {
    let mounted = true;
    fetchCurrentUser()
      .then((u) => {
        if (mounted) {
          setUser(u);
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

  // Whenever user becomes authenticated, if there is a pending report card from a guest attempt, auto-save it!
  useEffect(() => {
    if (user && pendingResults) {
      saveReportCardApi(pendingResults)
        .then(() => {
          sessionStorage.removeItem(PENDING_RESULTS_KEY);
          setPendingResults(null);
        })
        .catch((err) => {
          console.error('Failed to auto-save pending report card:', err);
        });
    }
  }, [user, pendingResults]);

  const stagePendingResults = (results: TestResults) => {
    setPendingResults(results);
    try {
      sessionStorage.setItem(PENDING_RESULTS_KEY, JSON.stringify(results));
    } catch {
      // ignore
    }
  };

  const clearPendingResults = () => {
    setPendingResults(null);
    try {
      sessionStorage.removeItem(PENDING_RESULTS_KEY);
    } catch {
      // ignore
    }
  };

  const login = async (credential: string): Promise<boolean> => {
    const loggedInUser = await loginWithGoogleApi(credential);
    if (loggedInUser) {
      setUser(loggedInUser);
      // Auto-save pending test if present
      if (pendingResults) {
        try {
          await saveReportCardApi(pendingResults);
          clearPendingResults();
        } catch (e) {
          console.error('Auto-save error during login:', e);
        }
      }
      return true;
    }
    return false;
  };

  const refreshUser = async (): Promise<UserProfile | null> => {
    try {
      const u = await fetchCurrentUser();
      setUser(u);
      return u;
    } catch {
      return user;
    }
  };

  const logout = async () => {
    await logoutUserApi();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        targetExam,
        setTargetExam,
        login,
        logout,
        refreshUser,
        pendingResults,
        stagePendingResults,
        clearPendingResults,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
