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
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs">
              LS
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                LandShield
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
