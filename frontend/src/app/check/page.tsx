"use client";

import React, { Suspense, useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { ErrorBox } from "@/components/ErrorBox";
import { RiskCard } from "@/components/RiskCard";
import { ChainTimeline } from "@/components/ChainTimeline";
import { getChain, getPlot, getRisk, searchPlots, verifyDeed } from "@/lib/api";
import { ChainItem, PlotOut, RiskReportOut } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

interface BenchmarkScenario {
  id: string;
  name: string;
  plot_id: number;
  expected_rule?: string;
  expected_status?: string;
  description?: string;
}

function CitizenCheckContent() {
  const { lang, t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected plot details
  const [selectedPlot, setSelectedPlot] = useState<PlotOut | null>(null);
  const [riskReport, setRiskReport] = useState<RiskReportOut | null>(null);
  const [chain, setChain] = useState<ChainItem[]>([]);

  // Search results list (if query matches multiple plots)
  const [searchResults, setSearchResults] = useState<PlotOut[]>([]);
  const [searched, setSearched] = useState(false);

  // Benchmark scenarios loaded from /scenarios.json
  const [scenarios, setScenarios] = useState<BenchmarkScenario[]>([
    { id: "S1", name: "দ্বৈত বিক্রয় (Double Sale)", plot_id: 1, expected_status: "CRITICAL" },
    { id: "S2", name: "স্বত্বহীন বিক্রি (Not Owner)", plot_id: 2, expected_status: "CRITICAL" },
    { id: "S3", name: "নামজারি বাকি >৯০ দিন", plot_id: 3, expected_status: "MEDIUM" },
    { id: "S4", name: "দ্রুত হস্তান্তর (Rapid)", plot_id: 4, expected_status: "HIGH" },
    { id: "S5", name: "খাস / মামলা বিচারাধীন", plot_id: 5, expected_status: "HIGH" },
    { id: "S6", name: "নিরাপদ জমি (Clean Deal)", plot_id: 6, expected_status: "LOW" },
    { id: "S7", name: "বৈধ পেন্ডিং পুনঃবিক্রয়", plot_id: 7, expected_status: "LOW" },
    { id: "S8", name: "অংশবিশেষ বিক্রি (Partial)", plot_id: 8, expected_status: "LOW" },
  ]);

  // Load scenarios from public/scenarios.json if available
  useEffect(() => {
    fetch("/scenarios.json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.scenarios) {
          const loaded: BenchmarkScenario[] = Object.values(data.scenarios);
          if (loaded.length > 0) {
            setScenarios(loaded);
          }
        }
      })
      .catch(() => {
        // Fallback default benchmark list already set
      });
  }, []);

  const loadPlotDetails = useCallback(
    async (plotId: number) => {
      setLoading(true);
      setError(null);
      setSearchResults([]);
      setSearched(true);

      // Update URL search query
      router.replace(`/check?plot=${plotId}`);

      try {
        const [plotData, riskData, chainData] = await Promise.all([
          getPlot(plotId),
          getRisk(plotId, lang),
          getChain(plotId),
        ]);

        setSelectedPlot(plotData);
        setRiskReport(riskData);
        setChain(chainData);
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
    [lang, router, t]
  );

  // Handle URL query ?plot=... on mount or change
  useEffect(() => {
    const plotParam = searchParams.get("plot");
    if (plotParam) {
      const parsedId = parseInt(plotParam, 10);
      if (!isNaN(parsedId)) {
        loadPlotDetails(parsedId);
      }
    }
  }, [searchParams, loadPlotDetails]);

  // Re-fetch risk report when user toggles language so text matches
  useEffect(() => {
    if (selectedPlot) {
      getRisk(selectedPlot.id, lang)
        .then((data) => setRiskReport(data))
        .catch(() => {});
    }
  }, [lang, selectedPlot]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) return;

    setLoading(true);
    setError(null);
    setSelectedPlot(null);
    setRiskReport(null);
    setChain([]);
    setSearchResults([]);
    setSearched(true);

    try {
      // 1. Is query a pure number (plot ID)?
      const numericId = parseInt(cleanQuery, 10);
      if (/^\d+$/.test(cleanQuery) && !isNaN(numericId)) {
        try {
          const plotData = await getPlot(numericId);
          await loadPlotDetails(plotData.id);
          return;
        } catch {
          // If pure ID not found, fallback to search by dag/mouza
        }
      }

      // 2. Is query a deed number? (e.g. MIR-2026-... or DHAKA-2026-...)
      if (/^[A-Z]+-\d{4}-\d+$/i.test(cleanQuery)) {
        try {
          const verifyData = await verifyDeed(cleanQuery);
          if (verifyData.plot_id) {
            await loadPlotDetails(verifyData.plot_id);
            return;
          }
        } catch {
          // Fallback to text search
        }
      }

      // 3. Search by Mouza or Dag number
      const results = await searchPlots(cleanQuery, cleanQuery);
      if (results.length === 1) {
        await loadPlotDetails(results[0].id);
      } else {
        setSearchResults(results);
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
  };

  const getScenarioPillStyle = (status?: string) => {
    switch (status) {
      case "CRITICAL":
      case "BLOCKED":
        return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300";
      case "HIGH":
      case "HIGH_RISK":
        return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300";
      case "MEDIUM":
      case "MEDIUM_RISK":
        return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
      case "LOW":
      default:
        return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Page Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>নাগরিক প্রি-পারচেজ ভেরিফিকেশন</span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t("check.title")}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("check.subtitle")}
        </p>
      </div>

      {/* Search Bar & Benchmark Scenarios */}
      <Card className="p-6">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("check.search_placeholder")}
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm font-medium text-slate-900 placeholder-slate-400 shadow-2xs focus:border-emerald-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-500/20 transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {loading ? <Spinner size="sm" /> : <span>{t("check.search_btn")}</span>}
            </button>
          </div>

          {/* Benchmark Scenarios Strip */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
              {t("check.try_scenarios")}
            </p>
            <div className="flex flex-wrap gap-2">
              {scenarios.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => {
                    setQuery(`Plot ${sc.plot_id}`);
                    loadPlotDetails(sc.plot_id);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition hover:scale-105 ${getScenarioPillStyle(
                    sc.expected_status
                  )}`}
                >
                  <span className="font-mono font-bold">{sc.id}:</span>
                  <span>{sc.name}</span>
                  <span className="font-mono text-[10px] opacity-75">
                    (#{sc.plot_id})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </form>
      </Card>

      {/* Error Display */}
      {error && (
        <ErrorBox
          title={t("common.error")}
          message={error}
          onRetry={() => handleSearch()}
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

      {/* Multi-result Plot Selection List */}
      {searchResults.length > 0 && !loading && (
        <Card
          title={`অনুসন্ধান ফলাফল: ${searchResults.length} ${t("check.results_found")}`}
          subtitle={t("check.select_plot")}
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {searchResults.map((p) => (
              <div
                key={p.id}
                onClick={() => loadPlotDetails(p.id)}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-lg transition"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      দাগ নং: {p.dag_no}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      প্লট #{p.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    মৌজা: {p.mouza}, {p.upazila}, {p.district} • {p.area_decimal}{" "}
                    {t("check.decimals")} ({p.land_type})
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  যাচাই করুন →
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No Results Empty State */}
      {searched && !loading && !selectedPlot && searchResults.length === 0 && !error && (
        <Card className="text-center py-10">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("check.no_results")}
          </p>
        </Card>
      )}

      {/* Selected Plot Full Detail View */}
      {selectedPlot && riskReport && !loading && (
        <div className="space-y-6">
          {/* 1. Plot Overview Header Card */}
          <Card
            title={`${t("check.plot_info")}: দাগ #${selectedPlot.dag_no} (প্লট #${selectedPlot.id})`}
            headerAction={
              <button
                type="button"
                onClick={() => {
                  setSelectedPlot(null);
                  setRiskReport(null);
                  setChain([]);
                  router.replace("/check");
                }}
                className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {t("common.back")}
              </button>
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  অবস্থান (Location)
                </span>
                <p className="font-bold text-slate-900 dark:text-white mt-1">
                  মৌজা: {selectedPlot.mouza}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedPlot.upazila}, {selectedPlot.district}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("check.area")}
                </span>
                <p className="font-bold text-slate-900 dark:text-white mt-1">
                  {selectedPlot.area_decimal} {t("check.decimals")}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  ধরন: {selectedPlot.land_type}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("check.current_owner")}
                </span>
                <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-1 truncate">
                  {selectedPlot.current_owner_masked}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  সর্বশেষ নামজারি অনুযায়ী
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {t("check.initial_owner")}
                </span>
                <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                  {selectedPlot.initial_owner_masked}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  জেনেসিস রেকর্ড
                </p>
              </div>
            </div>
          </Card>

          {/* 2. Risk Card (Circular Ring Gauge, Level, Flags, Findings) */}
          <RiskCard report={riskReport} />

          {/* 3. Ownership Ledger Chain Timeline */}
          <ChainTimeline chain={chain} />

          {/* 4. Prototype Disclaimer Notice */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-center text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            <span>{t("check.disclaimer")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CitizenCheckPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Spinner size="lg" label="লোড হচ্ছে..." />
        </div>
      }
    >
      <CitizenCheckContent />
    </Suspense>
  );
}
