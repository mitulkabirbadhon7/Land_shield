"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/Spinner";
import { ErrorBox } from "@/components/ErrorBox";
import { QRScanner } from "@/components/QRScanner";
import { getChain, getPlot, verifyDeed } from "@/lib/api";
import { ChainItem, DeedStatus, PlotOut, VerifyOut } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

function VerifyContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [inputDeedNo, setInputDeedNo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyOut | null>(null);
  const [plot, setPlot] = useState<PlotOut | null>(null);
  const [chainItem, setChainItem] = useState<ChainItem | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [copied, setCopied] = useState(false);

  // Sample deeds for testing and demo evaluation
  const sampleDeeds = [
    { label: "বৈধ দলিল (Valid)", deedNo: "MIR-2026-000001" },
    { label: "নমুনা ২ (Plot 2)", deedNo: "MIR-2026-000002" },
    { label: "নমুনা ৩ (Plot 3)", deedNo: "MIR-2026-000003" },
  ];

  const lastVerifiedDeed = React.useRef<string | null>(null);

  const handleVerify = useCallback(
    async (deedNoToVerify: string) => {
      const cleanDeedNo = deedNoToVerify.trim();
      if (!cleanDeedNo) return;

      lastVerifiedDeed.current = cleanDeedNo;
      setLoading(true);
      setError(null);
      setResult(null);
      setPlot(null);
      setChainItem(null);

      // Only update URL search param if not already set to avoid navigation loops
      if (searchParams.get("deed") !== cleanDeedNo) {
        router.replace(`/verify?deed=${encodeURIComponent(cleanDeedNo)}`);
      }

      try {
        const verifyRes = await verifyDeed(cleanDeedNo);
        setResult(verifyRes);

        // Fetch associated plot and chain item if plot_id is present
        if (verifyRes.plot_id) {
          try {
            const plotData = await getPlot(verifyRes.plot_id);
            setPlot(plotData);

            const chainData = await getChain(verifyRes.plot_id);
            const matching = chainData.find(
              (item) => item.deed_no === verifyRes.deed_no
            );
            if (matching) {
              setChainItem(matching);
            }
          } catch {
            // Plot details are secondary; do not fail primary verify
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t("common.error"));
        }
      } finally {
        setLoading(false);
      }
    },
    [router, searchParams, t]
  );

  // Trigger verify automatically if ?deed= is present in URL
  useEffect(() => {
    const deedParam = searchParams.get("deed");
    if (deedParam && lastVerifiedDeed.current !== deedParam) {
      lastVerifiedDeed.current = deedParam;
      setInputDeedNo(deedParam);
      handleVerify(deedParam);
    }
  }, [searchParams, handleVerify]);

  const onScannerSuccess = (scannedDeed: string) => {
    setShowScanner(false);
    setInputDeedNo(scannedDeed);
    handleVerify(scannedDeed);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const status = result?.status || "UNKNOWN";
  const chainPosition = result?.chain_position ?? result?.chain_seq ?? chainItem?.seq;

  // Status banner border/background accent styles
  const statusStyles: Record<
    DeedStatus,
    { border: string; bg: string; titleColor: string }
  > = {
    VALID: {
      border: "border-emerald-300 dark:border-emerald-800",
      bg: "bg-emerald-50/70 dark:bg-emerald-950/30",
      titleColor: "text-emerald-900 dark:text-emerald-200",
    },
    TAMPERED: {
      border: "border-rose-400 dark:border-rose-800",
      bg: "bg-rose-50/80 dark:bg-rose-950/40",
      titleColor: "text-rose-900 dark:text-rose-200",
    },
    SUPERSEDED: {
      border: "border-amber-300 dark:border-amber-800",
      bg: "bg-amber-50/70 dark:bg-amber-950/30",
      titleColor: "text-amber-900 dark:text-amber-200",
    },
    CANCELLED: {
      border: "border-slate-300 dark:border-slate-700",
      bg: "bg-slate-100/70 dark:bg-slate-900/50",
      titleColor: "text-slate-800 dark:text-slate-300",
    },
    UNKNOWN: {
      border: "border-gray-300 dark:border-gray-700",
      bg: "bg-gray-50 dark:bg-gray-900/40",
      titleColor: "text-gray-800 dark:text-gray-300",
    },
  };

  const currentStyle = statusStyles[status as DeedStatus] || statusStyles.UNKNOWN;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>পাবলিক ভেরিফিকেশন সার্ভিস</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t("verify.title")}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("verify.subtitle")}
        </p>
      </div>

      {/* Verification Input & Scanner Bar */}
      <Card className="p-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleVerify(inputDeedNo);
          }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <input
                type="text"
                value={inputDeedNo}
                onChange={(e) => setInputDeedNo(e.target.value)}
                placeholder={t("verify.input_placeholder")}
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder-slate-400 shadow-2xs focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {inputDeedNo && (
                <button
                  type="button"
                  onClick={() => setInputDeedNo("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !inputDeedNo.trim()}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-teal-500/20 transition hover:bg-teal-700 active:scale-95 disabled:opacity-50 dark:bg-teal-600 dark:hover:bg-teal-500"
              >
                {loading ? <Spinner size="sm" /> : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{t("verify.btn_verify")}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:border-slate-400 active:scale-95 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-750"
              >
                <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                <span className="hidden sm:inline">{t("verify.btn_scan_qr")}</span>
              </button>
            </div>
          </div>

          {/* Quick Demo Sample Deed Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold">{t("verify.sample_deeds")}</span>
            {sampleDeeds.map((sample) => (
              <button
                key={sample.deedNo}
                type="button"
                onClick={() => {
                  setInputDeedNo(sample.deedNo);
                  handleVerify(sample.deedNo);
                }}
                className="rounded-full border border-slate-200 bg-slate-100/80 px-2.5 py-1 font-mono text-[11px] font-medium text-slate-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 transition"
              >
                {sample.deedNo}
              </button>
            ))}
          </div>
        </form>
      </Card>

      {/* Error Display */}
      {error && (
        <ErrorBox
          title={t("common.error")}
          message={error}
          onRetry={() => handleVerify(inputDeedNo)}
        />
      )}

      {/* Loading State */}
      {loading && (
        <div className="py-12 text-center space-y-3">
          <Spinner size="lg" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {t("common.loading")}
          </p>
        </div>
      )}

      {/* Verification Result View */}
      {result && !loading && (
        <div className="space-y-6">
          {/* 1. Large Status Banner */}
          <div
            className={`rounded-2xl border p-6 sm:p-8 shadow-sm transition-all backdrop-blur-xs ${currentStyle.border} ${currentStyle.bg}`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 dark:border-white/5 pb-6">
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t("verify.result_title")}
                </p>
                <h2 className="text-xl sm:text-2xl font-mono font-bold text-slate-900 dark:text-white">
                  {result.deed_no}
                </h2>
              </div>
              <div className="shrink-0">
                <StatusBadge status={status} size="lg" />
              </div>
            </div>

            {/* Plain-Language Explanation Line */}
            <div className="pt-4">
              <p className={`text-base font-semibold leading-relaxed ${currentStyle.titleColor}`}>
                {t(`status_desc.${status}`, "স্ট্যাটাস বিবরণ পাওয়া যায়নি")}
              </p>
            </div>
          </div>

          {/* 2. Deed Summary & Plot Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Deed Metadata Card */}
            <Card
              title={t("verify.deed_summary")}
              headerAction={
                chainPosition !== null && chainPosition !== undefined ? (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {t("verify.chain_seq")} {chainPosition}
                  </span>
                ) : null
              }
            >
              <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                <div className="py-2.5 flex justify-between">
                  <dt className="text-slate-500 dark:text-slate-400">
                    {t("verify.chain_position")}:
                  </dt>
                  <dd className="font-semibold text-slate-900 dark:text-slate-100 font-mono">
                    {chainPosition !== null && chainPosition !== undefined
                      ? `#${chainPosition}`
                      : "—"}
                  </dd>
                </div>

                {result.registered_at && (
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t("verify.registered_at")}:
                    </dt>
                    <dd className="font-medium text-slate-900 dark:text-slate-100 font-mono text-xs">
                      {result.registered_at}
                    </dd>
                  </div>
                )}

                {(chainItem?.buyer_masked || chainItem?.buyer) && (
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t("verify.buyer")}:
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">
                      {chainItem?.buyer_masked || chainItem?.buyer}
                    </dd>
                  </div>
                )}

                {result.plot_id && (
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t("verify.plot_id")}:
                    </dt>
                    <dd className="font-semibold text-teal-600 dark:text-teal-400">
                      #{result.plot_id}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>

            {/* Plot Information Card (If Plot Data Available) */}
            <Card
              title={t("verify.plot_details")}
              headerAction={
                plot ? (
                  <Link
                    href={`/check?plot=${plot.id}`}
                    className="text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 transition"
                  >
                    ঝুঁকি দেখুন →
                  </Link>
                ) : null
              }
            >
              {plot ? (
                <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  <div className="py-2.5 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t("verify.dag_no")}:
                    </dt>
                    <dd className="font-bold text-slate-900 dark:text-slate-100">
                      {plot.dag_no}
                    </dd>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t("verify.mouza")}:
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">
                      {plot.mouza}
                    </dd>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      {t("verify.upazila")} / {t("verify.district")}:
                    </dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-300">
                      {plot.upazila}, {plot.district}
                    </dd>
                  </div>

                  <div className="py-2.5 flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">
                      জমির পরিমাণ (Area):
                    </dt>
                    <dd className="font-semibold text-slate-900 dark:text-slate-100">
                      {plot.area_decimal} {t("verify.decimals")} ({plot.land_type})
                    </dd>
                  </div>
                </dl>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  {result.plot_id
                    ? `প্লট #${result.plot_id} এর বিস্তারিত লোড হচ্ছে...`
                    : "এই দলিলের জন্য কোনো সক্রিয় প্লট যুক্ত নেই।"}
                </div>
              )}
            </Card>
          </div>

          {/* 3. Technical Audit & Reasons List */}
          <Card title={t("verify.technical_reasons")}>
            {result.reasons && result.reasons.length > 0 ? (
              <ul className="space-y-2">
                {result.reasons.map((reason, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300"
                  >
                    <svg className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-mono">{reason}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                <svg className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <span>{t("verify.no_reasons")}</span>
              </div>
            )}
          </Card>

          {/* 4. Action Bar (Share / Plot Check) */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 transition"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              <span>{copied ? "লিঙ্ক কপি হয়েছে! ✓" : "যাচাই লিঙ্ক কপি করুন"}</span>
            </button>

            {result.plot_id && (
              <Link
                href={`/check?plot=${result.plot_id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-teal-700 transition"
              >
                <span>{t("verify.check_plot_link")}</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* QR Scanner Modal */}
      {showScanner && (
        <QRScanner
          onScanSuccess={onScannerSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Spinner size="lg" label="লোড হচ্ছে..." />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
