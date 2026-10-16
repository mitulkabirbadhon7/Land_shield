"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { ErrorBox } from "@/components/ErrorBox";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { ApiError } from "@/lib/api";

function LoginForm() {
  const { lang } = useLanguage();
  const { user, role, isAuthenticated, login, logout } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRoleAllowed = (path: string, r: string) => {
    if (path.startsWith("/admin")) return r === "admin";
    if (path.startsWith("/officer")) return r === "officer" || r === "admin";
    if (path.startsWith("/registrar")) return r === "registrar" || r === "admin";
    return true;
  };

  const getDestination = (userRole: string) => {
    if (nextParam && nextParam.startsWith("/") && isRoleAllowed(nextParam, userRole)) {
      return nextParam;
    }
    switch (userRole) {
      case "registrar":
        return "/registrar";
      case "officer":
        return "/officer";
      case "admin":
        return "/admin";
      default:
        return "/";
    }
  };

  const handleQuickLogin = async (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
    setLoading(true);
    try {
      const res = await login(u, p);
      const dest = getDestination(res.role);
      router.push(dest);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.detail || err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError(null);
    try {
      const res = await login(username.trim(), password);
      const dest = getDestination(res.role);
      router.push(dest);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setError(
            lang === "bn"
              ? "ভুল ইউজারনেম বা পাসওয়ার্ড। পুনরায় চেষ্টা করুন।"
              : "Invalid username or password. Please verify credentials."
          );
        } else if (err.status === 429) {
          setError(
            lang === "bn"
              ? "অতিরিক্ত লগইন প্রচেষ্টা (Rate Limit)। ১ মিনিট অপেক্ষা করুন।"
              : "Rate limit exceeded. Please wait 1 minute before retrying."
          );
        } else {
          setError(err.detail || err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          lang === "bn"
            ? "সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।"
            : "Could not connect to authentication server."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="mb-6 text-center animate-fade-in-down">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-lg shadow-emerald-500/25 transition-transform duration-300 hover:scale-110 hover:rotate-3">
          <svg
            className="h-7 w-7 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
          {lang === "bn" ? "অফিসিয়াল লগইন পোর্টাল" : "Official Staff Login"}
        </h1>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {lang === "bn"
            ? "সাব-রেজিস্ট্রার ও সহকারী কমিশনার (ভূমি) সুরক্ষিত প্রবেশাধিকার"
            : "Secure role-based access for Sub-Registrars and Land Officers"}
        </p>
      </div>

      <Card className="animate-fade-in-up stagger-1">
        {isAuthenticated && user ? (
          <div className="space-y-5 text-center py-4">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <svg
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs uppercase font-bold tracking-wider text-emerald-600 dark:text-emerald-400">
                {lang === "bn" ? "বর্তমানে লগইন আছেন" : "Currently Authenticated"}
              </p>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {user.name}
              </h2>
              <span className="inline-block mt-1 rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300 capitalize">
                {user.role}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Link
                href={getDestination(role || "registrar")}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition"
              >
                {lang === "bn" ? "ড্যাশবোর্ডে প্রবেশ করুন" : "Enter Portal"}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {lang === "bn" ? "লগআউট / পরিবর্তন করুন" : "Sign Out / Switch"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <ErrorBox
                title={lang === "bn" ? "লগইন ব্যর্থ হয়েছে" : "Authentication Failed"}
                message={error}
              />
            )}

            <div>
              <label
                htmlFor="username"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {lang === "bn" ? "ইউজারনেম (Username)" : "Username"}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="registrar1"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-950"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5"
              >
                {lang === "bn" ? "পাসওয়ার্ড (Password)" : "Password"}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-950"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-md shadow-slate-900/10 transition hover:bg-slate-800 active:scale-98 disabled:opacity-50 dark:bg-emerald-600 dark:shadow-emerald-900/20 dark:hover:bg-emerald-500"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    <span>{lang === "bn" ? "যাচাই করা হচ্ছে..." : "Authenticating..."}</span>
                  </>
                ) : (
                  <span>{lang === "bn" ? "প্রবেশ করুন (Login)" : "Sign In"}</span>
                )}
              </button>
            </div>

            {/* Quick Demo Accounts Buttons */}
            <div className="mt-6 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {lang === "bn" ? "দ্রুত টেস্ট অ্যাকাউন্ট (১-ক্লিক)" : "Evaluation Demo Accounts (1-Click)"}
                </span>
                <span className="text-[10px] text-emerald-600 font-semibold dark:text-emerald-400">
                  Argon2id Hash
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickFill("registrar1", "RegistrarPass123!")}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs text-slate-700 transition-all duration-200 hover:scale-[1.01] hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-xs active:scale-98 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                      R
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      registrar1
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500">Sub-Registrar</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-medium dark:text-emerald-400">
                    Auto-fill
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill("officer1", "OfficerPass123!")}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs text-slate-700 transition-all duration-200 hover:scale-[1.01] hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-xs active:scale-98 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-teal-100 text-[10px] font-bold text-teal-700 dark:bg-teal-900/60 dark:text-teal-300">
                      O
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      officer1
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500">AC Land Officer</span>
                  </div>
                  <span className="text-[10px] text-teal-600 font-medium dark:text-teal-400">
                    Auto-fill
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickFill("admin1", "AdminPass123!")}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs text-slate-700 transition-all duration-200 hover:scale-[1.01] hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-xs active:scale-98 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/30"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-100 text-[10px] font-bold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                      A
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      admin1
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-500">System Admin</span>
                  </div>
                  <span className="text-[10px] text-indigo-600 font-medium dark:text-indigo-400">
                    Auto-fill
                  </span>
                </button>
              </div>
            </div>
          </form>
        )}
      </Card>

      <div className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
        <p>
          {lang === "bn"
            ? "নাগরিক যাচাই ও ঝুঁকি স্কোরের জন্য লগইন করার প্রয়োজন নেই।"
            : "Citizen deed verification and plot risk checks do not require login."}{" "}
          <Link
            href="/check"
            className="font-semibold text-emerald-600 underline hover:text-emerald-500 dark:text-emerald-400"
          >
            {lang === "bn" ? "এখানে যান" : "Go to Citizen Portal"}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
