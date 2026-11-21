import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { UserProfile, TestResults } from '../types';
import { fetchCurrentUser, loginWithGoogleApi, logoutUserApi, saveReportCardApi } from '../utils/api';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (credential: string) => Promise<boolean>;
  logout: () => Promise<void>;
  pendingResults: TestResults | null;
  stagePendingResults: (results: TestResults) => void;
  clearPendingResults: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PENDING_RESULTS_KEY = 'abhiyantra_pending_test_results';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingResults, setPendingResults] = useState<TestResults | null>(() => {
    try {
      const saved = sessionStorage.getItem(PENDING_RESULTS_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

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

  const logout = async () => {
    await logoutUserApi();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
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
