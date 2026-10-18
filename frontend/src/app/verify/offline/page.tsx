"use client";

import React, { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { useLanguage } from "@/lib/i18n";
import { useFeatures } from "@/lib/features";
import {
  verifyOffline,
  syncPublicKeysOnline,
  getCachedKeys,
  DEFAULT_OFFLINE_KEYS,
  OfflineVerifyResult,
} from "@/lib/offlineVerify";

// Sample test vectors embedded for 1-click test in offline mode
const SAMPLE_VECTORS = {
  valid:
    "eyJ2IjoxLCJwYXlsb2FkX2pzb24iOiJ7XCJhcmVhX3NvbGRcIjoxNS41LFwiYnV5ZXJfaWRcIjoxMDIsXCJkZWVkX25vXCI6XCJNSVItMjAyNi0wMDAwMDFcIixcImRlZWRfdHlwZVwiOlwiS0FCQUxBXCIsXCJwbG90X2lkXCI6MSxcInJlZ2lzdGVyZWRfYXRcIjpcIjIwMjYtMTAtMDFUMTA6MDA6MDArMDA6MDBcIixcInNlbGxlcl9pZFwiOjEwMSxcInN1Yl9yZWdpc3RyeVwiOlwiTUlSXCJ9IiwiaGFzaCI6IjQ0ODEyMmVkM2Y5ZjhkYzVkNGE1NDQ2N2Y1MTU3YWU3ZTE0YzBjNWUzMDUzMjNiZmFmNWQ1MzcxY2JjNDM0MGIiLCJzaWciOiI2ODViYjZkMjFlZmExNzhmNjI4ZGU5OTNiNzIzNGMzMDU0Mzk5OWZjYWQ1OThjZDQ1Y2NiOGM0NGUzYzEwM2VkMThhYmY0ZGMyMmE4YmVlNzY5YjkxM2EzMGZlNWQ5OThmOTAyYjU0M2VjZWVjMDQ3N2YyNzQ5MjdiYzY1ZjUwNiIsImtleV9pZCI6IjgwZGI0ZGIwZWIxN2FlM2IifQ",
  tampered:
    "eyJ2IjoxLCJwYXlsb2FkX2pzb24iOiJ7XCJhcmVhX3NvbGRcIjoxNi41LFwiYnV5ZXJfaWRcIjoxMDIsXCJkZWVkX25vXCI6XCJNSVItMjAyNi0wMDAwMDFcIixcImRlZWRfdHlwZVwiOlwiS0FCQUxBXCIsXCJwbG90X2lkXCI6MSxcInJlZ2lzdGVyZWRfYXRcIjpcIjIwMjYtMTAtMDFUMTA6MDA6MDArMDA6MDBcIixcInNlbGxlcl9pZFwiOjEwMSxcInN1Yl9yZWdpc3RyeVwiOlwiTUlSXCJ9IiwiaGFzaCI6IjQ0ODEyMmVkM2Y5ZjhkYzVkNGE1NDQ2N2Y1MTU3YWU3ZTE0YzBjNWUzMDUzMjNiZmFmNWQ1MzcxY2JjNDM0MGIiLCJzaWciOiI2ODViYjZkMjFlZmExNzhmNjI4ZGU5OTNiNzIzNGMzMDU0Mzk5OWZjYWQ1OThjZDQ1Y2NiOGM0NGUzYzEwM2VkMThhYmY0ZGMyMmE4YmVlNzY5YjkxM2EzMGZlNWQ5OThmOTAyYjU0M2VjZWVjMDQ3N2YyNzQ5MjdiYzY1ZjUwNiIsImtleV9pZCI6IjgwZGI0ZGIwZWIxN2FlM2IifQ",
  unknown_key:
    "eyJ2IjoxLCJwYXlsb2FkX2pzb24iOiJ7XCJhcmVhX3NvbGRcIjoxNS41LFwiYnV5ZXJfaWRcIjoxMDIsXCJkZWVkX25vXCI6XCJNSVItMjAyNi0wMDAwMDFcIixcImRlZWRfdHlwZVwiOlwiS0FCQUxBXCIsXCJwbG90X2lkXCI6MSxcInJlZ2lzdGVyZWRfYXRcIjpcIjIwMjYtMTAtMDFUMTA6MDA6MDArMDA6MDBcIixcInNlbGxlcl9pZFwiOjEwMSxcInN1Yl9yZWdpc3RyeVwiOlwiTUlSXCJ9IiwiaGFzaCI6IjQ0ODEyMmVkM2Y5ZjhkYzVkNGE1NDQ2N2Y1MTU3YWU3ZTE0YzBjNWUzMDUzMjNiZmFmNWQ1MzcxY2JjNDM0MGIiLCJzaWciOiI2ODViYjZkMjFlZmExNzhmNjI4ZGU5OTNiNzIzNGMzMDU0Mzk5OWZjYWQ1OThjZDQ1Y2NiOGM0NGUzYzEwM2VkMThhYmY0ZGMyMmE4YmVlNzY5YjkxM2EzMGZlNWQ5OThmOTAyYjU0M2VjZWVjMDQ3N2YyNzQ5MjdiYzY1ZjUwNiIsImtleV9pZCI6ImRlYWRiZWVmMTIzNDU2NzgifQ",
};

// Dynamic client-side import for QRScanner to avoid SSR window issues
const QRScanner = dynamic(
  () => import("@/components/QRScanner").then((mod) => mod.QRScanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center py-10">
        <Spinner size="md" />
      </div>
    ),
  }
);

function OfflineVerifyContent() {
  const { lang, t } = useLanguage();
  const features = useFeatures();

  const [inputPayload, setInputPayload] = useState("");
  const [activeTab, setActiveTab] = useState<"paste" | "scanner">("paste");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<OfflineVerifyResult | null>(null);
  const [cachedKeysCount, setCachedKeysCount] = useState<number>(1);

  // Background sync public keys on online mount to ensure latest keys are cached
  useEffect(() => {
    syncPublicKeysOnline()
      .then((keys) => {
        setCachedKeysCount(Object.keys(keys).length);
      })
      .catch(() => {
        const cached = getCachedKeys() || DEFAULT_OFFLINE_KEYS;
        setCachedKeysCount(Object.keys(cached).length);
      });
  }, []);

  const handleVerify = async (payloadToTest?: string) => {
    const raw = (payloadToTest !== undefined ? payloadToTest : inputPayload).trim();
    if (!raw) return;

    setVerifying(true);
    setResult(null);

    try {
      const res = await verifyOffline(raw);
      setResult(res);
    } catch (err) {
      setResult({
        state: "NOT_AUTHENTIC",
        error: err instanceof Error ? err.message : "VERIFY_FAILED",
      });
    } finally {
      setVerifying(false);
    }
  };

  const handleQrScan = (decodedText: string) => {
    setInputPayload(decodedText);
    setScannerOpen(false);
    setActiveTab("paste");
    handleVerify(decodedText);
  };

  if (!features.FEATURE_OFFLINE_QR) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center space-y-4">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t("verify_offline.title")}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">
          {lang === "bn"
            ? "অফলাইন কিউআর যাচাই ফিচারটি বর্তমানে নিষ্ক্রিয় রয়েছে।"
            : "Offline QR verification is currently disabled by runtime feature flag."}
        </p>
        <Link
          href="/verify"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
        >
          {t("verify_offline.switch_online")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in-down">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>{t("verify_offline.badge")}</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t("verify_offline.title")}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("verify_offline.subtitle")}
        </p>

        {/* Cached keys info pill */}
        <div className="pt-1">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full dark:bg-slate-800 dark:text-slate-400">
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span>
              {t("verify_offline.keys_cached")} {cachedKeysCount}
            </span>
          </span>
        </div>
      </div>

      {/* Main Verification Input Card */}
      <Card className="p-6">
        <div className="space-y-4">
          {/* Input Mode Tabs */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab("paste");
                setScannerOpen(false);
              }}
              className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-xs font-bold transition-all ${
                activeTab === "paste"
                  ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>{t("verify_offline.tab_paste")}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("scanner");
                setScannerOpen(true);
              }}
              className={`flex items-center gap-2 border-b-2 px-5 py-2.5 text-xs font-bold transition-all ${
                activeTab === "scanner"
                  ? "border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>{t("verify_offline.tab_scan")}</span>
            </button>
          </div>

          {/* Scanner View */}
          {activeTab === "scanner" && scannerOpen && (
            <div className="py-4">
              <QRScanner
                onScanSuccess={handleQrScan}
                onClose={() => {
                  setScannerOpen(false);
                  setActiveTab("paste");
                }}
              />
            </div>
          )}

          {/* Paste View */}
          {activeTab === "paste" && (
            <div className="space-y-4">
              <textarea
                rows={3}
                value={inputPayload}
                onChange={(e) => setInputPayload(e.target.value)}
                placeholder={t("verify_offline.input_placeholder")}
                className="w-full rounded-xl border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Quick Test Vectors */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    {t("verify_offline.quick_samples")}
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      setInputPayload(SAMPLE_VECTORS.valid);
                      handleVerify(SAMPLE_VECTORS.valid);
                    }}
                    className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300"
                  >
                    {t("verify_offline.sample_valid")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInputPayload(SAMPLE_VECTORS.tampered);
                      handleVerify(SAMPLE_VECTORS.tampered);
                    }}
                    className="rounded-full bg-rose-50 border border-rose-200 px-3 py-1 text-xs font-bold text-rose-800 hover:bg-rose-100 transition dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300"
                  >
                    {t("verify_offline.sample_tampered")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setInputPayload(SAMPLE_VECTORS.unknown_key);
                      handleVerify(SAMPLE_VECTORS.unknown_key);
                    }}
                    className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100 transition dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300"
                  >
                    {t("verify_offline.sample_unknown")}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={verifying || !inputPayload.trim()}
                  onClick={() => handleVerify()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {verifying ? <Spinner size="sm" /> : <span>{t("verify_offline.verify_btn")}</span>}
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Verification Result Section */}
      {result && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Status Banner */}
          <div
            className={`rounded-2xl border p-6 sm:p-8 text-center sm:text-left flex flex-col sm:flex-row items-center gap-6 shadow-sm ${
              result.state === "AUTHENTIC"
                ? "border-emerald-300 bg-emerald-50/80 dark:border-emerald-800 dark:bg-emerald-950/40"
                : result.state === "NOT_AUTHENTIC"
                ? "border-rose-300 bg-rose-50/80 dark:border-rose-800 dark:bg-rose-950/40"
                : "border-amber-300 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/40"
            }`}
          >
            {/* Status Icon */}
            <div
              className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl shadow-md ${
                result.state === "AUTHENTIC"
                  ? "bg-emerald-600 text-white"
                  : result.state === "NOT_AUTHENTIC"
                  ? "bg-rose-600 text-white animate-pulse"
                  : "bg-amber-500 text-white"
              }`}
            >
              {result.state === "AUTHENTIC" ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : result.state === "NOT_AUTHENTIC" ? (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5 flex-1">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${
                  result.state === "AUTHENTIC"
                    ? "bg-emerald-200 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200"
                    : result.state === "NOT_AUTHENTIC"
                    ? "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200"
                    : "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                }`}
              >
                {t(`verify_offline.${result.state}`)}
              </span>

              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {t(`verify_offline.${result.state}`)}
              </h3>

              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {t(`verify_offline.${result.state}_desc`)}
              </p>
            </div>
          </div>

          {/* Deed Fields Summary if parsed */}
          {result.fields && (
            <Card title={t("verify_offline.deed_details")}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    {lang === "bn" ? "দলিল নম্বর" : "Deed No"}
                  </span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white mt-1 text-sm">
                    {result.fields.deed_no}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    {lang === "bn" ? "প্লট আইডি" : "Plot ID"}
                  </span>
                  <p className="font-mono font-bold text-slate-900 dark:text-white mt-1 text-sm">
                    #{result.fields.plot_id}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    {lang === "bn" ? "বিক্রীত জমি" : "Area Sold"}
                  </span>
                  <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400 mt-1 text-sm">
                    {result.fields.area_sold} {lang === "bn" ? "শতক" : "dec"}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 uppercase font-semibold">
                    {lang === "bn" ? "দলিলের ধরন" : "Deed Type"}
                  </span>
                  <p className="font-bold text-slate-900 dark:text-white mt-1 text-sm">
                    {result.fields.deed_type} ({result.fields.sub_registry})
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Cryptographic Technical Details */}
          <Card title={t("verify_offline.crypto_details")}>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 font-sans font-medium">
                  {t("verify_offline.key_id")}:
                </span>
                <span className="font-bold text-slate-900 dark:text-slate-200">
                  {result.key_id || "—"}
                </span>
              </div>

              {result.hash && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 font-sans font-medium">
                    {t("verify_offline.hash")}:
                  </span>
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 break-all">
                    {result.hash}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* PERMANENT NOTICE REQUIREMENT (Section 6C & Prompt Task 3) */}
          <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-center dark:border-amber-800 dark:bg-amber-950/60 shadow-sm">
            <div className="flex items-center justify-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs uppercase tracking-wider mb-1.5">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>{lang === "bn" ? "অফলাইন সত্যতা বনাম বর্তমান অবস্থা" : "Offline Authenticity vs Current Status"}</span>
            </div>
            <p className="text-xs sm:text-sm font-semibold text-amber-900 dark:text-amber-200 max-w-2xl mx-auto leading-relaxed">
              {t("verify_offline.permanent_notice")}
            </p>
            <div className="pt-3">
              <Link
                href={result.fields?.deed_no ? `/verify?deed=${result.fields.deed_no}` : "/verify"}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 underline"
              >
                <span>{t("verify_offline.switch_online")}</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OfflineVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <OfflineVerifyContent />
    </Suspense>
  );
}
