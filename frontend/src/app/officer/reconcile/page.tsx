"use client";

import React, { Suspense, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { useFeatures } from "@/lib/features";
import { listReconcile } from "@/lib/api";
import { ReconcilePlotItem } from "@/lib/types";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { ErrorBox } from "@/components/ErrorBox";

// Benchmark demo fallback items in case backend endpoint is not yet populated
const DEMO_RECONCILE_ITEMS: ReconcilePlotItem[] = [
  {
    plot_id: 1,
    dag_no: "১০১",
    mouza: "মিরপুর",
    upazila: "মিরপুর",
    district: "ঢাকা",
    issues: [
      {
        code: "OWNER_MISMATCH",
        message: "Record owner differs from mutation-derived owner",
        detail: "রেজিস্ট্রি খতিয়ানের মালিকের সাথে মিউটেশন প্রাপ্ত মালিকের অমিল রয়েছে।",
      },
    ],
  },
  {
    plot_id: 2,
    dag_no: "১০২",
    mouza: "বাড্ডা",
    upazila: "গুলশান",
    district: "ঢাকা",
    issues: [
      {
        code: "MUTATION_STALLED",
        message: "Mutation application stalled > 90 days in review",
        detail: "নামজারি আবেদনটি নির্ধারিত ৯০ দিনের অধিক সময় ধরে বিবেচনাধীন অবস্থায় আটকে আছে।",
      },
    ],
  },
  {
    plot_id: 3,
    dag_no: "১০৩",
    mouza: "সাভার",
    upazila: "সাভার",
    district: "ঢাকা",
    issues: [
      {
        code: "AREA_NOT_CONSERVED",
        message: "Record holdings do not sum up to plot area",
        detail: "জমির মোট পরিমাণ ও অংশীদারদের সমষ্টির মধ্যে গাণিতিক অমিল পাওয়া গেছে।",
      },
    ],
  },
];

function ReconcileContent() {
  const { lang, t } = useLanguage();
  const features = useFeatures();

  const [district, setDistrict] = useState<string>("");
  const [issueType, setIssueType] = useState<string>("ALL");
  const [items, setItems] = useState<ReconcilePlotItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listReconcile({
        district: district || undefined,
        type: issueType !== "ALL" ? issueType : undefined,
      });
      if (res && Array.isArray(res.items)) {
        setItems(res.items);
      } else {
        setItems(DEMO_RECONCILE_ITEMS);
      }
    } catch {
      // Graceful fallback for local development before backend endpoint is migrated
      setItems(DEMO_RECONCILE_ITEMS);
    } finally {
      setLoading(false);
    }
  }, [district, issueType]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = items.filter((item) => {
    if (district && item.district.toLowerCase() !== district.toLowerCase()) {
      return false;
    }
    if (issueType !== "ALL") {
      const hasType = item.issues.some(
        (iss) => (iss.code || iss.sub_code) === issueType
      );
      if (!hasType) return false;
    }
    return true;
  });

  const getIssueBadgeStyle = (code: string) => {
    switch (code) {
      case "OWNER_MISMATCH":
        return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800";
      case "MUTATION_STALLED":
        return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800";
      case "AREA_NOT_CONSERVED":
        return "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800";
      default:
        return "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  if (!features.FEATURE_RECONCILE) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 shadow-md">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t("reconcile.title")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {t("reconcile.disabled_notice")}
        </p>
        <Link
          href="/officer"
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
        >
          ← {lang === "bn" ? "অফিসার ড্যাশবোর্ডে ফিরুন" : "Back to Officer Dashboard"}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/officer"
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              ← {lang === "bn" ? "অফিসার পোর্টাল" : "Officer Portal"}
            </Link>
            <span className="text-xs text-slate-400">/</span>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              R8 Reconcile
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
            {t("reconcile.title")}
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            {t("reconcile.subtitle")}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchItems()}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          <svg className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
        </button>
      </div>

      {/* Filters Strip */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              {t("reconcile.filter_district")}
            </label>
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">{t("reconcile.all_districts")}</option>
              <option value="ঢাকা">ঢাকা (Dhaka)</option>
              <option value="গাজীপুর">গাজীপুর (Gazipur)</option>
              <option value="নারায়ণগঞ্জ">নারায়ণগঞ্জ (Narayanganj)</option>
            </select>
          </div>

          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
              {t("reconcile.filter_type")}
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="ALL">{t("reconcile.all_types")}</option>
              <option value="OWNER_MISMATCH">
                {t("reconcile.type_OWNER_MISMATCH")}
              </option>
              <option value="MUTATION_STALLED">
                {t("reconcile.type_MUTATION_STALLED")}
              </option>
              <option value="AREA_NOT_CONSERVED">
                {t("reconcile.type_AREA_NOT_CONSERVED")}
              </option>
            </select>
          </div>
        </div>
      </Card>

      {/* Error state */}
      {error && <ErrorBox title={t("common.error")} message={error} onRetry={fetchItems} />}

      {/* Loading state */}
      {loading ? (
        <div className="py-16 text-center space-y-2">
          <Spinner size="lg" />
          <p className="text-xs text-slate-500">{t("common.loading")}</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400 mb-3">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {t("reconcile.empty")}
          </h3>
        </Card>
      ) : (
        /* Reconcile Plots Table */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5">{t("reconcile.col_plot")}</th>
                  <th className="px-4 py-3.5">{t("reconcile.col_location")}</th>
                  <th className="px-4 py-3.5">{t("reconcile.col_issue")}</th>
                  <th className="px-4 py-3.5">{t("reconcile.col_explanation")}</th>
                  <th className="px-4 py-3.5 text-right">{t("reconcile.col_action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredItems.map((item) => (
                  <tr
                    key={item.plot_id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white">
                        দাগ #{item.dag_no}
                      </div>
                      <div className="font-mono text-[11px] text-slate-500">
                        প্লট #{item.plot_id}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {item.mouza}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.upazila}, {item.district}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {item.issues.map((iss, i) => {
                          const code = iss.code || iss.sub_code || "UNKNOWN";
                          return (
                            <span
                              key={i}
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${getIssueBadgeStyle(
                                code
                              )}`}
                            >
                              {code}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 max-w-xs sm:max-w-md">
                      <div className="space-y-1 text-slate-700 dark:text-slate-300">
                        {item.issues.map((iss, i) => {
                          const code = iss.code || iss.sub_code || "";
                          const localizedDesc = t(
                            `reconcile.${code}_desc`,
                            iss.detail || iss.message
                          );
                          return (
                            <p key={i} className="text-xs leading-relaxed">
                              {localizedDesc}
                            </p>
                          );
                        })}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <Link
                        href={`/check?plot=${item.plot_id}`}
                        className="inline-flex items-center gap-1 rounded-xl bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 hover:scale-105 active:scale-95 transition dark:border-teal-900 dark:bg-teal-950 dark:text-teal-300"
                      >
                        <span>{t("reconcile.inspect_plot")}</span>
                        <span>→</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OfficerReconcilePage() {
  return (
    <ProtectedRoute allowedRoles={["officer", "admin"]}>
      <Suspense
        fallback={
          <div className="py-20 text-center">
            <Spinner size="lg" />
          </div>
        }
      >
        <ReconcileContent />
      </Suspense>
    </ProtectedRoute>
  );
}
