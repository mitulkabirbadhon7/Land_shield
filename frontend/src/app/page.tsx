"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n";

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <div className="relative overflow-hidden py-12 sm:py-20">
      {/* Background radial gradient accent with gentle ambient drift */}
      <div className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
        <div className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36.125rem] bg-gradient-to-tr from-emerald-500 to-teal-300 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem] animate-float-slow" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Hero Header */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50/90 px-3.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs animate-fade-in-down dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{t("hero.badge")}</span>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl dark:text-white leading-tight animate-fade-in-up stagger-1">
            {t("hero.title")}
          </h1>

          <p className="text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300 animate-fade-in-up stagger-2">
            {t("hero.subtitle")}
          </p>
        </div>

        {/* Three Core Interactive Action Cards */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Action 1: Check a Plot */}
          <Link
            href="/check"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-7 shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:border-emerald-500/70 hover:shadow-2xl active:scale-[0.98] animate-fade-in-up stagger-1 dark:border-slate-800 dark:bg-slate-900/90"
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-emerald-500/10 transition-all duration-500 ease-out group-hover:scale-175 group-hover:bg-emerald-500/20" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-md shadow-emerald-500/25 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 transition-transform duration-200 group-hover:scale-105 dark:bg-emerald-950/80 dark:text-emerald-300">
                  {t("hero.citizen_check_badge")}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {t("hero.cta_check")}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t("hero.cta_check_desc")}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <span>{t("hero.start_check")}</span>
              <svg className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </Link>

          {/* Action 2: Verify a Deed */}
          <Link
            href="/verify"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-7 shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:border-teal-500/70 hover:shadow-2xl active:scale-[0.98] animate-fade-in-up stagger-2 dark:border-slate-800 dark:bg-slate-900/90"
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-teal-500/10 transition-all duration-500 ease-out group-hover:scale-175 group-hover:bg-teal-500/20" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 text-white shadow-md shadow-teal-500/25 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-bold text-teal-800 transition-transform duration-200 group-hover:scale-105 dark:bg-teal-950/80 dark:text-teal-300">
                  {t("hero.qr_scan_badge")}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                  {t("hero.cta_verify")}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t("hero.cta_verify_desc")}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-teal-600 dark:text-teal-400">
              <span>{t("hero.verify_deed_action")}</span>
              <svg className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </Link>

          {/* Action 3: Officer Portal */}
          <Link
            href="/login"
            className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-7 shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:border-slate-500/70 hover:shadow-2xl active:scale-[0.98] animate-fade-in-up stagger-3 dark:border-slate-800 dark:bg-slate-900/90"
          >
            <div className="absolute top-0 right-0 -mr-6 -mt-6 h-24 w-24 rounded-full bg-slate-500/10 transition-all duration-500 ease-out group-hover:scale-175 group-hover:bg-slate-500/20" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-tr from-slate-900 to-slate-700 text-white shadow-md shadow-slate-900/20 transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 dark:from-slate-700 dark:to-slate-600">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-800 transition-transform duration-200 group-hover:scale-105 dark:bg-slate-800 dark:text-slate-300">
                  {t("hero.officer_portal_badge")}
                </span>
              </div>

              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors">
                  {t("hero.cta_login")}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {t("hero.cta_login_desc")}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-300">
              <span>{t("hero.login_action")}</span>
              <svg className="h-4 w-4 transition-transform duration-300 ease-out group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
