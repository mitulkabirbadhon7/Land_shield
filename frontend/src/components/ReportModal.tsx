"use client";

import React, { useEffect } from "react";
import { DueDiligenceReportOut } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";

interface ReportModalProps {
  report: DueDiligenceReportOut | null;
  loading: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportModal({
  report,
  loading,
  isOpen,
  onClose,
}: ReportModalProps) {
  const { lang, t } = useLanguage();

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "auto";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto bg-slate-900/70 backdrop-blur-sm print:p-0 print:bg-white print:static">
      {/* Modal Dialog Card */}
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 dark:bg-slate-900 dark:ring-slate-800 print:max-h-none print:shadow-none print:ring-0 print:rounded-none">
        {/* Sticky Action Toolbar (Hidden in Print) */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 print:hidden">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white font-bold text-sm shadow-xs">
              AI
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {lang === "bn"
                  ? "ভূমি-সুরক্ষা কৃত্রিম বুদ্ধিমত্তা ডিউ-ডিলিজেন্স রিপোর্ট"
                  : "LandShield AI Due-Diligence Report"}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {report?.report_id || "GENERATING..."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handlePrint}
              disabled={loading || !report}
              className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                />
              </svg>
              <span>{lang === "bn" ? "প্রিন্ট / PDF সংরক্ষণ" : "Print / Save PDF"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:border-slate-800 dark:hover:bg-slate-800 transition"
              aria-label="Close"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Printable Report Body */}
        <div id="printable-due-diligence-report" className="p-6 sm:p-10 space-y-8 print:p-0 print:space-y-6">
          {loading || !report ? (
            <div className="py-20 text-center space-y-4">
              <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-teal-600 border-t-transparent" />
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
                {lang === "bn"
                  ? "এআই বিশ্লেষণের মাধ্যমে ডিউ-ডিলিজেন্স রিপোর্ট সংকলন করা হচ্ছে..."
                  : "Synthesizing AI due-diligence report..."}
              </p>
            </div>
          ) : (
            <>
              {/* Institutional Header Banner */}
              <div className="border-b-2 border-slate-900 pb-6 dark:border-slate-100 print:border-black">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-emerald-800 px-2.5 py-0.5 text-xs font-bold text-white uppercase tracking-wider print:border print:border-black">
                        LANDSHIELD
                      </span>
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                        {lang === "bn"
                          ? "ভূমি রেকর্ড নিরাপত্তা ও সত্যতা যাচাই"
                          : "Land Title Security & Verification"}
                      </span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white print:text-black">
                      {lang === "bn"
                        ? "নাগরিক প্রাক-ক্রয় ডিউ-ডিলিজেন্স রিপোর্ট"
                        : "Citizen Pre-Purchase Due-Diligence Report"}
                    </h1>
                  </div>

                  <div className="text-right text-xs space-y-1 font-mono text-slate-600 dark:text-slate-400 print:text-black">
                    <div>
                      <span className="font-semibold text-slate-400 mr-1.5">REF:</span>
                      <span className="font-bold text-slate-900 dark:text-white print:text-black">
                        {report.report_id}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-400 mr-1.5">DATE:</span>
                      <span>
                        {new Date(report.generated_at).toLocaleDateString(
                          lang === "bn" ? "bn-BD" : "en-US",
                          { dateStyle: "long" }
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plot Identification Summary Grid */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/80 print:border-slate-300 print:bg-white">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {lang === "bn" ? "জমির পরিচিতি বিবরণী" : "Plot Identity Details"}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-medium block">{t("plot.dag_no", lang === "bn" ? "দাগ নম্বর" : "Dag No")}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 print:text-black text-sm">
                      {report.plot_summary.dag_no}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-medium block">{t("plot.mouza", lang === "bn" ? "মৌজা" : "Mouza")}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                      {report.plot_summary.mouza}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-medium block">{t("plot.upazila", lang === "bn" ? "উপজেলা" : "Upazila")}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                      {report.plot_summary.upazila}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-medium block">{t("plot.district", lang === "bn" ? "জেলা" : "District")}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                      {report.plot_summary.district}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-medium block">{t("plot.area", lang === "bn" ? "জমির পরিমাণ" : "Area")}</span>
                    <span className="font-bold text-teal-700 dark:text-teal-400 print:text-black">
                      {report.plot_summary.area_decimal} {lang === "bn" ? "শতাংশ" : "dec"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 dark:text-slate-400 font-medium block">{t("plot.owner", lang === "bn" ? "বর্তমান মালিক" : "Owner")}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 print:text-black truncate block">
                      {report.plot_summary.current_owner || "—"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Overall Assessment Score & Executive Summary */}
              <div
                className={`rounded-xl border p-6 flex flex-col sm:flex-row items-center gap-6 ${
                  report.risk_score >= 60 || report.risk_level === "HIGH"
                    ? "border-rose-200 bg-rose-50/70 dark:border-rose-900/50 dark:bg-rose-950/20 print:border-rose-400"
                    : report.risk_score >= 25 || report.risk_level === "MEDIUM"
                    ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20 print:border-amber-400"
                    : "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20 print:border-emerald-400"
                }`}
              >
                {/* Visual Gauge Number */}
                <div className="flex flex-col items-center justify-center shrink-0">
                  <div
                    className={`flex h-20 w-20 items-center justify-center rounded-full border-4 font-extrabold text-2xl shadow-inner ${
                      report.risk_score >= 60 || report.risk_level === "HIGH"
                        ? "border-rose-500 text-rose-700 bg-rose-100/80"
                        : report.risk_score >= 25 || report.risk_level === "MEDIUM"
                        ? "border-amber-500 text-amber-700 bg-amber-100/80"
                        : "border-emerald-500 text-emerald-700 bg-emerald-100/80"
                    }`}
                  >
                    {report.risk_score}
                  </div>
                  <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    {lang === "bn" ? "ঝুঁকি স্কোর" : "Risk Score"}
                  </span>
                </div>

                {/* Executive Assessment Text */}
                <div className="space-y-2 flex-1 text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <StatusBadge
                      status={
                        report.risk_score >= 60 || report.risk_level === "HIGH"
                          ? "CANCELLED"
                          : report.risk_score >= 25 || report.risk_level === "MEDIUM"
                          ? "SUPERSEDED"
                          : "VALID"
                      }
                      customLabel={
                        report.risk_score >= 60 || report.risk_level === "HIGH"
                          ? lang === "bn"
                            ? "উচ্চ ঝুঁকি (HIGH RISK)"
                            : "HIGH RISK"
                          : report.risk_score >= 25 || report.risk_level === "MEDIUM"
                          ? lang === "bn"
                            ? "মাঝারি ঝুঁকি (MEDIUM RISK)"
                            : "MEDIUM RISK"
                          : lang === "bn"
                          ? "কম ঝুঁকি (LOW RISK / CLEAN)"
                          : "LOW RISK (CLEAN)"
                      }
                    />
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 print:text-black leading-relaxed">
                    {report.executive_summary}
                  </p>
                </div>
              </div>

              {/* Layer-by-Layer Findings Breakdown */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {lang === "bn"
                    ? "নিরাপত্তা স্তরভিত্তিক মূল্যায়ন বিবরণী"
                    : "Multi-Layer Defense Assessment"}
                </h3>

                <div className="space-y-2.5">
                  {report.layer_breakdown.map((layer) => (
                    <div
                      key={layer.layer}
                      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 print:border-slate-300"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 print:text-black">
                          {layer.title}
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                            layer.status === "FAIL"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : layer.status === "WARN"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {layer.status === "FAIL"
                            ? lang === "bn"
                              ? "ব্যর্থ / ত্রুটিযুক্ত"
                              : "FAIL"
                            : layer.status === "WARN"
                            ? lang === "bn"
                              ? "সতর্কতা"
                              : "WARN"
                            : lang === "bn"
                            ? "উত্তীর্ণ"
                            : "PASS"}
                        </span>
                      </div>

                      {layer.findings.length > 0 ? (
                        <ul className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400 print:text-slate-800 pl-4 list-disc">
                          {layer.findings.map((finding, idx) => (
                            <li key={idx}>{finding}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          {lang === "bn"
                            ? "কোনো অসঙ্গতি বা জালিয়াতির ঝুঁকি পাওয়া যায়নি।"
                            : "No discrepancies or fraudulent flags detected."}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actionable Buyer Checklist */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/60 print:border-slate-300 print:bg-white">
                <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 print:text-black uppercase tracking-wider mb-2.5">
                  {lang === "bn"
                    ? "ক্রেতার জন্য করণীয় নির্দেশিকা (Action Checklist)"
                    : "Buyer Action Checklist"}
                </h3>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300 print:text-black">
                  {report.actionable_checklist.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-600 text-[10px] font-bold text-white mt-0.5 print:border print:border-black print:text-black">
                        ✓
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Official Legal Disclaimer */}
              <div className="rounded-lg border border-slate-200/80 bg-slate-100/60 p-3.5 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400 print:border-slate-300 print:text-slate-600 print:bg-white leading-relaxed">
                <strong className="text-slate-700 dark:text-slate-300 print:text-black mr-1">
                  {lang === "bn" ? "আইনগত সতর্কবার্তা:" : "Legal Disclaimer:"}
                </strong>
                {report.legal_disclaimer}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
