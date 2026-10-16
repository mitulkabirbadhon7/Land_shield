"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="w-full border-t border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-950/80 mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Brand + Tagline */}
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 p-1.5 text-white shadow-xs">
              <svg viewBox="0 0 32 32" fill="none" className="h-full w-full">
                <path
                  d="M16 3.5L25.5 8V16C25.5 22 21.4 27.4 16 29C10.6 27.4 6.5 22 6.5 16V8L16 3.5Z"
                  stroke="#A7F3D0"
                  strokeWidth="2.2"
                  fill="rgba(255,255,255,0.15)"
                />
                <path d="M16 10L21 13L16 16L11 13L16 10Z" fill="#FFFFFF" />
                <circle cx="16" cy="16" r="2" fill="#34D399" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {t("nav.title")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("common.rights_reserved")}
              </p>
            </div>
          </div>

          {/* Prototype synthetic data banner (Required by S12) */}
          <div className="rounded-full border border-amber-200 bg-amber-50/80 px-3.5 py-1 text-center text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            <span className="font-bold mr-1.5 uppercase">
              {t("common.prototype_badge")}:
            </span>
            <span>{t("common.prototype_notice")}</span>
          </div>

          {/* Quick links */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <Link href="/check" className="hover:text-emerald-600 transition">
              {t("nav.check")}
            </Link>
            <Link href="/verify" className="hover:text-emerald-600 transition">
              {t("nav.verify")}
            </Link>
            <Link href="/login" className="hover:text-emerald-600 transition">
              {t("nav.login")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
