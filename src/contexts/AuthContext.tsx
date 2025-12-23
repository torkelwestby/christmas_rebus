'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

const STATS = { inflight: false, last: 0 };
const STATS_TTL = 60_000;

export type UserRole = 'admin' | 'basic';

type AuthRecord = {
  username: string;
  role: UserRole;
};

interface AuthContextType {
  isAuthenticated: boolean;
  isAdmin: boolean;
  username: string;
  userRole: UserRole | null;
  login: (payload: { username: string; role: UserRole }) => void;
  logout: () => void;
  userStats: {
    ideasSubmitted: number;
    loading: boolean;
  };
  refreshStats: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userStats, setUserStats] = useState({ ideasSubmitted: 0, loading: false });
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth');
      if (raw) {
        const parsed: AuthRecord = JSON.parse(raw);
        if (parsed?.username && parsed?.role) {
          setIsAuthenticated(true);
          setUsername(parsed.username);
          setUserRole(parsed.role);
        } else {
          localStorage.removeItem('auth');
        }
      }
    } catch {
      localStorage.removeItem('auth');
    } finally {
      setIsInitialized(true);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    if (!isAuthenticated || !username) return;
    if (STATS.inflight) return;
    if (Date.now() - STATS.last < STATS_TTL) return;

    STATS.inflight = true;
    setUserStats(prev => ({ ...prev, loading: true }));
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const response = await fetch(`${baseUrl}/api/ideas?max=200`, { cache: 'no-store' });
      if (!response.ok) {
        setUserStats(prev => ({ ...prev, loading: false }));
        return;
      }
      const data = await response.json();
      const records = data.records || [];
      const SUBMITTER_FIELD = 'fldfG5fBJ8E9iNVa1';
      const userIdeas = records.filter((r: any) => {
        const submitter = r.fields[SUBMITTER_FIELD];
        return typeof submitter === 'string' && submitter.toLowerCase() === username.toLowerCase();
      });
      setUserStats({ ideasSubmitted: userIdeas.length, loading: false });
      STATS.last = Date.now();
    } catch {
      setUserStats(prev => ({ ...prev, loading: false }));
    } finally {
      STATS.inflight = false;
    }
  }, [isAuthenticated, username]);

  useEffect(() => {
    if (isAuthenticated && username) {
      refreshStats();
    }
  }, [isAuthenticated, username, refreshStats]);

  const login = ({ username, role }: { username: string; role: UserRole }) => {
    setIsAuthenticated(true);
    setUsername(username);
    setUserRole(role);
    const record: AuthRecord = { username, role };
    localStorage.setItem('auth', JSON.stringify(record));
  };

  const logout = () => {
    setIsAuthenticated(false);
    setUsername('');
    setUserRole(null);
    setUserStats({ ideasSubmitted: 0, loading: false });
    localStorage.removeItem('auth');
  };

  const isAdmin = userRole === 'admin';

  if (!isInitialized) return null;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isAdmin,
        username,
        userRole,
        login,
        logout,
        userStats,
        refreshStats,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
