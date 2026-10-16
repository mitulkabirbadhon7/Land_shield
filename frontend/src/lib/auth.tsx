"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  getCurrentUser,
  getToken,
  login as apiLogin,
  logout as apiLogout,
  StoredUser,
} from "./api";
import { LoginResponse, UserRole } from "./types";
import { Spinner } from "@/components/Spinner";

interface AuthContextType {
  user: StoredUser | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  refreshAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshAuth = () => {
    const storedUser = getCurrentUser();
    const storedToken = getToken();
    setUser(storedUser);
    setToken(storedToken);
    setLoading(false);
  };

  useEffect(() => {
    refreshAuth();
  }, []);

  const login = async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    refreshAuth();
    return res;
  };

  const logout = () => {
    apiLogout();
    setUser(null);
    setToken(null);
  };

  const role = user?.role || null;
  const isAuthenticated = !!token && !!user;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        isAuthenticated,
        loading,
        login,
        logout,
        refreshAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    const storedUser = getCurrentUser();
    const storedToken = getToken();
    return {
      user: storedUser,
      token: storedToken,
      role: storedUser?.role || null,
      isAuthenticated: !!storedToken && !!storedUser,
      loading: false,
      login: apiLogin,
      logout: apiLogout,
      refreshAuth: () => {},
    };
  }
  return context;
}

export function ProtectedRoute({
  allowedRoles,
  children,
}: {
  allowedRoles: UserRole[];
  children: ReactNode;
}) {
  const { user, role, isAuthenticated, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !loading && !isAuthenticated) {
      const nextUrl = encodeURIComponent(pathname);
      router.replace(`/login?next=${nextUrl}`);
    }
  }, [mounted, loading, isAuthenticated, pathname, router]);

  if (!mounted || loading) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
        <Spinner size="lg" />
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Verifying security credentials...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (role && !allowedRoles.includes(role)) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/60 dark:text-rose-300">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-rose-900 dark:text-rose-200">
            Access Restricted
          </h2>
          <p className="mt-2 text-sm text-rose-700 dark:text-rose-300">
            This portal is restricted to{" "}
            <strong>{allowedRoles.join(" / ")}</strong>. You are currently
            authenticated as <strong>{user?.name}</strong> with role{" "}
            <code className="rounded bg-rose-200/50 px-1 py-0.5 font-mono text-xs text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">
              {role}
            </code>
            .
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                logout();
                router.push("/login");
              }}
              className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-rose-500"
            >
              Switch Account
            </button>
            <button
              onClick={() => router.push("/")}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
