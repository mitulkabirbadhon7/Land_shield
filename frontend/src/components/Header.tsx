"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

export function Header() {
  const { lang, toggleLang, t } = useLanguage();
  const { user, role, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const navLinks = [
    { href: "/", label: t("nav.home") },
    { href: "/check", label: t("nav.check") },
    { href: "/verify", label: t("nav.verify") },
    ...(user && (role === "registrar" || role === "admin")
      ? [{ href: "/registrar", label: t("nav.registrar") }]
      : []),
    ...(user && (role === "officer" || role === "admin")
      ? [{ href: "/officer", label: t("nav.officer") }]
      : []),
    ...(user && role === "admin"
      ? [{ href: "/admin", label: t("nav.admin") }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link
          href="/"
          className="group flex items-center gap-3 transition focus:outline-hidden"
        >
          {/* Creative BhumiPrahari Emblem (Land Parcel Facets + Sentinel Crest) */}
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-cyan-600 p-2 shadow-md shadow-emerald-500/25 ring-1 ring-white/20 transition-all duration-300 group-hover:scale-105 group-hover:rotate-1 group-hover:shadow-emerald-500/40">
            <svg
              className="h-full w-full text-white drop-shadow-xs"
              viewBox="0 0 32 32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="bpShieldGrad" x1="16" y1="3" x2="16" y2="29" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#A7F3D0" />
                  <stop offset="1" stopColor="#34D399" />
                </linearGradient>
                <linearGradient id="bpFacetGrad" x1="10" y1="9" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#FFFFFF" stopOpacity="0.95" />
                  <stop offset="1" stopColor="#E0F2FE" stopOpacity="0.75" />
                </linearGradient>
              </defs>
              {/* Outer Sentinel Shield */}
              <path
                d="M16 3.5L25.5 8V16C25.5 22 21.4 27.4 16 29C10.6 27.4 6.5 22 6.5 16V8L16 3.5Z"
                stroke="url(#bpShieldGrad)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="rgba(16, 185, 129, 0.18)"
              />
              {/* 3D Isometric Land Plots (জমির দাগ ও খতিয়ান নকশা) */}
              <path
                d="M16 9.5L21.5 12.8L16 16L10.5 12.8L16 9.5Z"
                fill="url(#bpFacetGrad)"
                opacity="0.95"
              />
              <path
                d="M10.5 12.8V18L16 21.2V16L10.5 12.8Z"
                fill="url(#bpFacetGrad)"
                opacity="0.45"
              />
              <path
                d="M21.5 12.8V18L16 21.2V16L21.5 12.8Z"
                fill="url(#bpFacetGrad)"
                opacity="0.75"
              />
              {/* Watchful Cryptographic Core (প্রহরী দৃষ্টি ও কেন্দ্রীয় সত্যতা স্তম্ভ) */}
              <circle cx="16" cy="15.5" r="1.8" fill="#FFFFFF" />
              <path
                d="M16 21.2V25"
                stroke="#A7F3D0"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-slate-900 text-lg dark:text-white transition-colors group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                {t("nav.title")}
              </span>
              <span
                title="LandTech Innovation Hackathon 2026"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200/90 px-2 py-0.5 text-[10px] font-bold text-emerald-800 transition-all duration-200 group-hover:bg-emerald-100 group-hover:border-emerald-300 dark:border-emerald-800/80 dark:bg-emerald-950/80 dark:text-emerald-300 shadow-2xs"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>LTIH &apos;26</span>
              </span>
            </div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t("nav.tagline")}
            </p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                  isActive
                    ? "bg-emerald-50 text-emerald-700 shadow-2xs dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right side controls: Language toggle, User role/Login */}
        <div className="flex items-center gap-2.5">
          {/* Segmented Language Toggle Pill */}
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 dark:border-slate-800 dark:bg-slate-900"
            title="Toggle Language (বাংলা / English)"
            aria-label="Toggle language"
          >
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all duration-200 ${
                lang === "bn"
                  ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              বাং
            </span>
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all duration-200 ${
                lang === "en"
                  ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-800 dark:text-emerald-300"
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              }`}
            >
              EN
            </span>
          </button>

          {/* User Auth Portal Button */}
          {user ? (
            <div className="hidden sm:flex items-center gap-2">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {user.name} ({user.role})
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition-all hover:bg-slate-100 active:scale-95 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-all duration-200 hover:bg-slate-800 hover:-translate-y-0.5 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <span>{t("nav.login")}</span>
            </Link>
          )}

          {/* Mobile hamburger menu button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg p-1.5 text-slate-600 transition-all hover:bg-slate-100 active:scale-95 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Open navigation menu"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {mobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-200 bg-white/95 px-4 pt-2 pb-4 dark:border-slate-800 dark:bg-slate-950/95 space-y-1 animate-fade-in-down">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
                pathname === link.href
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {user && (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full text-left rounded-lg px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              {t("nav.logout")} ({user.name})
            </button>
          )}
        </div>
      )}
    </header>
  );
}
