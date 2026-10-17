"use client";

import React, { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { ErrorBox } from "@/components/ErrorBox";
import { RiskCard } from "@/components/RiskCard";
import { ChainTimeline } from "@/components/ChainTimeline";
import { StatusBadge } from "@/components/StatusBadge";
import { getChain, getPlot, getRisk, searchPlots, verifyDeed, normalizeBnDigits } from "@/lib/api";
import { ChainItem, PlotOut, RiskReportOut } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";

interface BenchmarkScenario {
  id: string;
  name: string;
  plot_id: number;
  expected_rule?: string;
  expected_status?: string;
  description?: string;
  target_deed_no?: string | null;
  deed_numbers?: string[];
}

const CANONICAL_SCENARIO_MAP: Record<
  number,
  { id: string; target_deed_no: string | null; deed_numbers: string[]; mouza: string; dag_no: string }
> = {
  1: { id: "S1", target_deed_no: "DHAKA-2026-000002", deed_numbers: ["DHAKA-2026-000001", "DHAKA-2026-000002"], mouza: "রূপনগর", dag_no: "101" },
  2: { id: "S2", target_deed_no: "DHAKA-2026-000003", deed_numbers: ["DHAKA-2026-000003"], mouza: "শান্তিনগর", dag_no: "101" },
  3: { id: "S3", target_deed_no: "DHAKA-2026-000004", deed_numbers: ["DHAKA-2026-000004"], mouza: "আনন্দপুর", dag_no: "101" },
  4: { id: "S4", target_deed_no: "DHAKA-2026-000008", deed_numbers: ["DHAKA-2026-000005", "DHAKA-2026-000006", "DHAKA-2026-000007", "DHAKA-2026-000008"], mouza: "সবুজবাগ", dag_no: "101" },
  5: { id: "S5", target_deed_no: null, deed_numbers: [], mouza: "পদ্মাপাড়া", dag_no: "101" },
  6: { id: "S6", target_deed_no: "DHAKA-2026-000010", deed_numbers: ["DHAKA-2026-000009", "DHAKA-2026-000010"], mouza: "নদীয়া", dag_no: "101" },
  7: { id: "S7", target_deed_no: "DHAKA-2026-000012", deed_numbers: ["DHAKA-2026-000011", "DHAKA-2026-000012"], mouza: "ধানমন্ডিপুর", dag_no: "101" },
  8: { id: "S8", target_deed_no: "DHAKA-2026-000014", deed_numbers: ["DHAKA-2026-000013", "DHAKA-2026-000014"], mouza: "সোনারগাঁওপুর", dag_no: "101" },
};

function CitizenCheckContent() {
  const { lang, t } = useLanguage();
  const { role, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Role check: Only officers, registrars, and admins see the official technical record view
  const isOfficial = Boolean(
    isAuthenticated && role && ["admin", "officer", "registrar"].includes(role)
  );

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

  // View presentation mode: 'simple' (citizen) vs 'technical' (official audit)
  const [viewMode, setViewMode] = useState<"simple" | "technical">("simple");
  // Benchmark scenarios collapsible strip
  const [showScenarios, setShowScenarios] = useState(true);

  // Benchmark scenarios loaded from /scenarios.json
  const [scenarios, setScenarios] = useState<BenchmarkScenario[]>([
    { id: "S1", name: "দ্বৈত বিক্রয় (Double Sale)", plot_id: 1, expected_status: "CRITICAL", target_deed_no: "DHAKA-2026-000002", deed_numbers: ["DHAKA-2026-000001", "DHAKA-2026-000002"] },
    { id: "S2", name: "স্বত্বহীন বিক্রি (Not Owner)", plot_id: 2, expected_status: "CRITICAL", target_deed_no: "DHAKA-2026-000003", deed_numbers: ["DHAKA-2026-000003"] },
    { id: "S3", name: "নামজারি বাকি (৯০ দিনের অধিক)", plot_id: 3, expected_status: "MEDIUM", target_deed_no: "DHAKA-2026-000004", deed_numbers: ["DHAKA-2026-000004"] },
    { id: "S4", name: "দ্রুত হস্তান্তর (Rapid)", plot_id: 4, expected_status: "HIGH", target_deed_no: "DHAKA-2026-000008", deed_numbers: ["DHAKA-2026-000005", "DHAKA-2026-000006", "DHAKA-2026-000007", "DHAKA-2026-000008"] },
    { id: "S5", name: "খাস / মামলা বিচারাধীন", plot_id: 5, expected_status: "HIGH", target_deed_no: null, deed_numbers: [] },
    { id: "S6", name: "নিরাপদ জমি (Clean Deal)", plot_id: 6, expected_status: "LOW", target_deed_no: "DHAKA-2026-000010", deed_numbers: ["DHAKA-2026-000009", "DHAKA-2026-000010"] },
    { id: "S7", name: "বৈধ পেন্ডিং পুনঃবিক্রয়", plot_id: 7, expected_status: "LOW", target_deed_no: "DHAKA-2026-000012", deed_numbers: ["DHAKA-2026-000011", "DHAKA-2026-000012"] },
    { id: "S8", name: "অংশবিশেষ বিক্রি (Partial)", plot_id: 8, expected_status: "LOW", target_deed_no: "DHAKA-2026-000014", deed_numbers: ["DHAKA-2026-000013", "DHAKA-2026-000014"] },
  ]);

  const scenarioNames: Record<string, { bn: string; en: string }> = {
    S1: { bn: "দ্বৈত বিক্রয় (Double Sale)", en: "Double Sale Attempt" },
    S2: { bn: "স্বত্বহীন বিক্রি (Not Owner)", en: "Seller Not Owner" },
    S3: { bn: "নামজারি বাকি (৯০ দিনের অধিক)", en: "Pending Mutation (Over 90 Days)" },
    S4: { bn: "দ্রুত হস্তান্তর (Rapid)", en: "Rapid Suspicious Transfers" },
    S5: { bn: "খাস / মামলা বিচারাধীন", en: "Khas / Disputed Land" },
    S6: { bn: "নিরাপদ জমি (Clean Deal)", en: "Clean Legal Deal" },
    S7: { bn: "বৈধ পেন্ডিং পুনঃবিক্রয়", en: "Legit Pending Resale" },
    S8: { bn: "অংশবিশেষ বিক্রি (Partial)", en: "Valid Partial Sale" },
  };

  // Convert digits to Bengali numerals when viewing in Bengali
  const toBnDigits = useCallback(
    (num: number | string | undefined | null): string => {
      if (num === undefined || num === null) return "—";
      const str = String(num);
      if (lang !== "bn") return str;
      const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
      return str.replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
    },
    [lang]
  );

  const formatLandType = useCallback(
    (type?: string): string => {
      if (!type) return "—";
      if (lang !== "bn") return type;
      const map: Record<string, string> = {
        residential: "আবাসিক",
        commercial: "বাণিজ্যিক",
        agricultural: "কৃষি",
        homestead: "ভিটা/বসতবাড়ি",
        waterbody: "জলাশয়/পুকুর",
        pond: "পুকুর",
        industrial: "শিল্প এলাকা",
        fallow: "পতিত জমি",
      };
      return map[type.toLowerCase()] || type;
    },
    [lang]
  );

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

  const lastLoadedPlotId = useRef<number | null>(null);

  // Resilient fallback to resolve canonical benchmark scenario plot when sequence drift occurs
  const resolveScenarioPlotId = useCallback(
    async (
      scenarioNumOrId: number | string,
      scenarioHint?: BenchmarkScenario
    ): Promise<number | null> => {
      let num = typeof scenarioNumOrId === "number" ? scenarioNumOrId : NaN;
      if (isNaN(num) && typeof scenarioNumOrId === "string") {
        const match = scenarioNumOrId.match(/^S?(\d+)$/i);
        if (match) num = parseInt(match[1], 10);
      }

      const canonical =
        !isNaN(num) && CANONICAL_SCENARIO_MAP[num]
          ? CANONICAL_SCENARIO_MAP[num]
          : scenarioHint
          ? Object.values(CANONICAL_SCENARIO_MAP).find((c) => c.id === scenarioHint.id)
          : null;

      const targetDeed =
        scenarioHint?.target_deed_no !== undefined
          ? scenarioHint.target_deed_no
          : canonical?.target_deed_no;

      // 1. Try resolving via target deed
      if (targetDeed) {
        try {
          const verifyData = await verifyDeed(targetDeed);
          if (verifyData && verifyData.plot_id) return verifyData.plot_id;
        } catch {
          // continue
        }
      }

      // 2. Try any other deed numbers for this scenario
      const deeds = scenarioHint?.deed_numbers || canonical?.deed_numbers || [];
      for (const d of deeds) {
        if (d && d !== targetDeed) {
          try {
            const verifyData = await verifyDeed(d);
            if (verifyData && verifyData.plot_id) return verifyData.plot_id;
          } catch {
            // continue
          }
        }
      }

      // 3. Try lookup by canonical mouza and dag number
      if (canonical?.mouza && canonical?.dag_no) {
        try {
          const plots = await searchPlots(canonical.mouza, canonical.dag_no);
          if (plots.length > 0) return plots[0].id;
        } catch {
          // ignore
        }
      }

      return null;
    },
    []
  );

  const loadPlotDetails = useCallback(
    async (plotId: number, scenarioHint?: BenchmarkScenario): Promise<boolean> => {
      setLoading(true);
      setError(null);
      setSelectedPlot(null);
      setRiskReport(null);
      setChain([]);
      setSearchResults([]);
      setSearched(true);

      let targetId = plotId;

      try {
        let plotData: PlotOut;
        try {
          plotData = await getPlot(targetId);
        } catch (plotErr: unknown) {
          const is404 =
            (plotErr instanceof Error &&
              (plotErr.message.includes("404") ||
                plotErr.message.toLowerCase().includes("not found"))) ||
            (typeof plotErr === "object" &&
              plotErr !== null &&
              "status" in plotErr &&
              (plotErr as { status: number }).status === 404);

          if (is404 && ((targetId >= 1 && targetId <= 8) || scenarioHint)) {
            const resolvedId = await resolveScenarioPlotId(targetId, scenarioHint);
            if (resolvedId && resolvedId !== targetId) {
              targetId = resolvedId;
              plotData = await getPlot(targetId);
              // Update scenario state to reflect resolved plot ID to avoid future 404 roundtrips
              setScenarios((prev) =>
                prev.map((s) =>
                  s.plot_id === plotId || (scenarioHint && s.id === scenarioHint.id)
                    ? { ...s, plot_id: resolvedId }
                    : s
                )
              );
            } else {
              throw plotErr;
            }
          } else {
            throw plotErr;
          }
        }

        lastLoadedPlotId.current = targetId;

        // Only update URL if plot query is not already present to avoid loop
        const currentPlot = searchParams.get("plot");
        if (currentPlot !== String(targetId)) {
          router.replace(`/check?plot=${targetId}`);
        }

        const [riskData, chainData] = await Promise.all([
          getRisk(targetId, lang),
          getChain(targetId),
        ]);

        setSelectedPlot(plotData);
        setRiskReport(riskData);
        setChain(chainData);
        return true;
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError(t("common.error"));
        }
        return false;
      } finally {
        setLoading(false);
      }
    },
    [lang, resolveScenarioPlotId, router, searchParams, t]
  );

  // Handle URL query ?plot=... on mount or change
  useEffect(() => {
    const plotParam = searchParams.get("plot");
    if (plotParam) {
      const parsedId = parseInt(plotParam, 10);
      if (!isNaN(parsedId) && lastLoadedPlotId.current !== parsedId) {
        lastLoadedPlotId.current = parsedId;
        loadPlotDetails(parsedId);
      }
    }
  }, [searchParams, loadPlotDetails]);

  // Re-fetch risk report when user toggles language so text matches
  const lastRiskLang = useRef(lang);
  useEffect(() => {
    if (selectedPlot && lastRiskLang.current !== lang) {
      lastRiskLang.current = lang;
      getRisk(selectedPlot.id, lang)
        .then((data) => setRiskReport(data))
        .catch(() => {});
    }
  }, [lang, selectedPlot]);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const cleanQuery = (customQuery !== undefined ? customQuery : query).trim();
    if (!cleanQuery) return;
    const normalizedQuery = normalizeBnDigits(cleanQuery);

    setLoading(true);
    setError(null);
    setSelectedPlot(null);
    setRiskReport(null);
    setChain([]);
    setSearchResults([]);
    setSearched(true);

    try {
      // 0. Scenario code match? (e.g. 'S1', 's8', 'scenario 8', 'দৃশ্যকল্প ৮')
      const scenarioCodeMatch = normalizedQuery.match(/^(?:s|scenario|দৃশ্যকল্প)\s*([1-8])$/i);
      if (scenarioCodeMatch) {
        const scNum = parseInt(scenarioCodeMatch[1], 10);
        const scHint = scenarios.find((s) => s.id.toUpperCase() === `S${scNum}`);
        await loadPlotDetails(scHint?.plot_id ?? scNum, scHint);
        return;
      }

      // 1. Explicit plot ID? (e.g. 'Plot 6', 'প্লট ৬', '#6')
      const explicitPlotMatch =
        normalizedQuery.match(/^(?:plot|প্লট)\s*#?\s*(\d+)$/i) || normalizedQuery.match(/^#(\d+)$/);
      if (explicitPlotMatch) {
        const numericId = parseInt(explicitPlotMatch[1], 10);
        if (!isNaN(numericId)) {
          const scHint = scenarios.find((s) => s.plot_id === numericId || s.id === `S${numericId}`);
          await loadPlotDetails(scHint?.plot_id ?? numericId, scHint);
          return;
        }
      }

      // Explicit Dag ID? (e.g. 'Dag 101', 'দাগ ১০১')
      const explicitDagMatch = normalizedQuery.match(/^(?:dag|দাগ)\s*#?\s*(\d+)$/i);
      if (explicitDagMatch) {
        const dagStr = explicitDagMatch[1];
        const dagResults = await searchPlots(undefined, dagStr);
        if (dagResults.length === 1) {
          await loadPlotDetails(dagResults[0].id);
          return;
        } else if (dagResults.length > 1) {
          setSearchResults(dagResults);
          return;
        }
      }

      // 2. Deed number? (e.g. MIR-2026-... or DHAKA-2026-...)
      const cleanDeedQuery = normalizedQuery.replace(/\s+/g, "").toUpperCase();
      if (/^[A-Z]+-\d{4}-\d+$/i.test(cleanDeedQuery)) {
        try {
          const verifyData = await verifyDeed(cleanDeedQuery);
          if (verifyData.plot_id) {
            await loadPlotDetails(verifyData.plot_id);
            return;
          }
        } catch {
          // Fallback to text search
        }
      }

      // 3. Search by Dag number or Mouza name
      const isDigits = /^\d+$/.test(normalizedQuery);
      let results: PlotOut[] = [];
      if (isDigits) {
        results = await searchPlots(undefined, normalizedQuery);
        if (results.length === 0) {
          const numId = parseInt(normalizedQuery, 10);
          const scHint = scenarios.find((s) => s.plot_id === numId || s.id === `S${numId}`);
          if ((numId >= 1 && numId <= 8) || scHint) {
            const ok = await loadPlotDetails(scHint?.plot_id ?? numId, scHint);
            if (ok) return;
          } else {
            try {
              const plotData = await getPlot(numId);
              await loadPlotDetails(plotData.id);
              return;
            } catch {
              // Not a direct plot either, fall through to setSearchResults([]) showing "No results found"
            }
          }
        }
      } else {
        results = await searchPlots(cleanQuery, undefined);
      }

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
        return "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300";
      case "HIGH":
      case "HIGH_RISK":
        return "border-orange-300 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/60 dark:text-orange-300";
      case "MEDIUM":
      case "MEDIUM_RISK":
        return "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300";
      case "LOW":
      default:
        return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300";
    }
  };

  // Resilient flags extraction
  const rawFlags = riskReport ? (riskReport.flags as unknown) : null;
  const flagsList: string[] = Array.isArray(rawFlags) ? (rawFlags as string[]) : [];
  const flagsObj =
    !Array.isArray(rawFlags) && typeof rawFlags === "object" && rawFlags !== null
      ? (rawFlags as Record<string, unknown>)
      : {};

  const findings = riskReport && Array.isArray(riskReport.findings) ? riskReport.findings : [];

  // Card 1: Critical / Fraud / Double Sale
  const hasCriticalOrFraud =
    Boolean(riskReport?.has_critical) ||
    findings.some(
      (f) =>
        f.severity === "CRITICAL" ||
        f.rule_id?.startsWith("R1") ||
        f.rule_id?.startsWith("R2") ||
        f.rule_id?.startsWith("R5")
    );

  // Card 2: Government Khas Land or Acquisition
  const isKhas = flagsList.includes("khas") || Boolean(flagsObj.is_khas);
  const isAcquisition = flagsList.includes("acquisition") || Boolean(flagsObj.is_acquisition);
  const hasKhasOrAcquisition =
    isKhas ||
    isAcquisition ||
    findings.some(
      (f) =>
        (f.rule_id === "R6" || f.sub_code === "FLAGGED_LAND") &&
        (f.text?.toLowerCase().includes("খাস") ||
          f.text?.toLowerCase().includes("khas") ||
          f.text?.toLowerCase().includes("অধিগ্রহণ") ||
          f.text?.toLowerCase().includes("acquisition"))
    );

  // Card 3: Lawsuits and Legal Disputes
  const isDisputed = flagsList.includes("disputed") || Boolean(flagsObj.is_disputed);
  const activeCases = typeof flagsObj.active_cases_count === "number" ? flagsObj.active_cases_count : 0;
  const hasActiveCase =
    isDisputed ||
    activeCases > 0 ||
    findings.some(
      (f) =>
        (f.rule_id === "R6" || f.sub_code === "FLAGGED_LAND") &&
        (f.text?.toLowerCase().includes("মামলা") ||
          f.text?.toLowerCase().includes("dispute") ||
          f.text?.toLowerCase().includes("litigation"))
    );

  // Card 4: Mutation status
  const mutationRaw = (riskReport?.mutation_summary as unknown as Record<string, number | undefined>) || {};
  const hasMissingMutation =
    findings.some((f) => f.rule_id?.startsWith("R3") || f.sub_code === "MISSING_MUTATION") ||
    (typeof mutationRaw.missing_mutations === "number" && mutationRaw.missing_mutations > 0) ||
    (typeof mutationRaw.rejected === "number" && mutationRaw.rejected > 0);

  const level = (riskReport?.level as string) || "LOW";

  const isOversold =
    (selectedPlot?.sold_decimal !== undefined &&
      selectedPlot.sold_decimal > selectedPlot.area_decimal) ||
    (selectedPlot?.remaining_decimal !== undefined && selectedPlot.remaining_decimal < 0);

  // Trigger browser print
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
      {/* ------------------------------------------------------------- */}
      {/* PAGE HEADER (Hidden on print) */}
      {/* ------------------------------------------------------------- */}
      <div className="text-center max-w-2xl mx-auto space-y-2 animate-fade-in-down print:hidden">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
          <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>{t("check.public_badge")}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {t("check.title")}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {t("check.subtitle")}
        </p>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SEARCH BAR & BENCHMARK SCENARIOS (Hidden on print) */}
      {/* ------------------------------------------------------------- */}
      <Card className="p-5 sm:p-6 shadow-sm border-slate-200/80 dark:border-slate-800 animate-fade-in-up stagger-1 print:hidden">
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
                className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-10 text-sm font-medium text-slate-900 placeholder-slate-400 shadow-2xs transition-all focus:border-emerald-500 focus:shadow-sm focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 transition-colors"
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
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition-all hover:bg-emerald-700 hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              {loading ? <Spinner size="sm" /> : <span>{t("check.search_btn")}</span>}
            </button>
          </div>

          {/* Benchmark Scenarios Collapsible Strip */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <span>🎯</span> {t("check.try_scenarios")}
              </span>
              <button
                type="button"
                onClick={() => setShowScenarios(!showScenarios)}
                className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {showScenarios ? (lang === "bn" ? "সরিয়ে ফেলুন" : "Collapse") : (lang === "bn" ? "সব দেখুন" : "Show all")}
              </button>
            </div>

            {showScenarios && (
              <div className="flex flex-wrap gap-2 pt-1 animate-fade-in">
                {scenarios.map((sc) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => {
                      setQuery(`Plot ${sc.plot_id}`);
                      loadPlotDetails(sc.plot_id, sc);
                    }}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all duration-200 hover:scale-105 active:scale-95 shadow-2xs ${getScenarioPillStyle(
                      sc.expected_status
                    )}`}
                  >
                    <span className="font-mono font-bold">{sc.id}:</span>
                    <span>
                      {scenarioNames[sc.id]
                        ? lang === "bn"
                          ? scenarioNames[sc.id].bn
                          : scenarioNames[sc.id].en
                        : sc.name}
                    </span>
                    <span className="font-mono text-[10px] opacity-75">
                      (#{sc.plot_id})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </form>
      </Card>

      {/* Error Display */}
      {error && (
        <ErrorBox
          title={t("common.error")}
          message={error}
          onRetry={() => {
            if (lastLoadedPlotId.current) {
              loadPlotDetails(lastLoadedPlotId.current);
            } else {
              handleSearch();
            }
          }}
        />
      )}

      {/* Loading State with Shimmer Skeleton */}
      {loading && (
        <div className="space-y-4 py-4 animate-fade-in print:hidden">
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
            <div className="pointer-events-none absolute inset-0 animate-shimmer" />
            <div className="flex items-center gap-4">
              <Spinner size="md" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-52 rounded-md bg-slate-200 dark:bg-slate-800" />
                <div className="h-3 w-80 rounded-md bg-slate-100 dark:bg-slate-850" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-result Plot Selection List */}
      {searchResults.length > 0 && !loading && (
        <Card
          title={
            lang === "bn"
              ? `অনুসন্ধান ফলাফল: ${toBnDigits(searchResults.length)} ${t("check.results_found")}`
              : `Search Results: ${searchResults.length} ${t("check.results_found")}`
          }
          subtitle={t("check.select_plot")}
          className="animate-fade-in-up stagger-2 print:hidden"
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {searchResults.map((p) => (
              <div
                key={p.id}
                onClick={() => loadPlotDetails(p.id)}
                className="flex items-center justify-between p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer rounded-xl transition-all duration-200 hover:translate-x-1"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {lang === "bn" ? `দাগ নং: ${toBnDigits(p.dag_no)}` : `Dag No: ${p.dag_no}`}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {lang === "bn" ? `প্লট #${toBnDigits(p.id)}` : `Plot #${p.id}`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t("check.mouza_label")} {p.mouza}, {p.upazila}, {p.district} •{" "}
                    {toBnDigits(p.area_decimal)} {t("check.decimals")} ({formatLandType(p.land_type)})
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {lang === "bn" ? "যাচাই করুন →" : "Inspect →"}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No Results Empty State */}
      {searched && !loading && !selectedPlot && searchResults.length === 0 && !error && (
        <Card className="text-center py-10 animate-fade-in print:hidden">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t("check.no_results")}
          </p>
        </Card>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SELECTED PLOT INSPECTION VIEW */}
      {/* ------------------------------------------------------------- */}
      {selectedPlot && riskReport && !loading && (
        <div className="space-y-6 animate-fade-in-up">
          {/* Top Actions Bar (Hidden on print) */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/80 dark:bg-slate-900/80 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-md print:hidden">
            <button
              type="button"
              onClick={() => {
                setSelectedPlot(null);
                setRiskReport(null);
                setChain([]);
                router.replace("/check");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
            >
              <span>←</span>
              <span>{t("common.back")}</span>
            </button>

            <div className="flex items-center gap-2.5">
              {/* Official View Switcher: ONLY SHOWN TO OFFICIALS (Officers, Registrars, Admins) */}
              {isOfficial && (
                <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    onClick={() => setViewMode("simple")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                      viewMode === "simple"
                        ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-300"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    <span>🌟</span>
                    <span>{t("check.view_mode_simple")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("technical")}
                    className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all ${
                      viewMode === "technical"
                        ? "bg-white text-emerald-700 shadow-xs dark:bg-slate-900 dark:text-emerald-300"
                        : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    <span>🔬</span>
                    <span>{t("check.view_mode_technical")}</span>
                  </button>
                </div>
              )}

              {/* Print / PDF Download Action */}
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 transition"
              >
                <span>🖨️</span>
                <span>{t("check.print_verdict")}</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 🌟 1. CITIZEN VIEW (DEFAULT & ONLY VIEW FOR MASS PEOPLE)  */}
          {/* ========================================================= */}
          {viewMode === "simple" && (
            <div className="space-y-6 animate-fade-in print:hidden">
              {/* Formal Verdict Banner (Consistent with /verify status layout) */}
              <div
                className={`rounded-2xl border p-5 sm:p-6 transition-all duration-200 shadow-xs ${
                  level === "LOW"
                    ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                    : level === "MEDIUM"
                    ? "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200"
                    : level === "HIGH"
                    ? "border-orange-300 bg-orange-50/70 dark:border-orange-800 dark:bg-orange-950/30 text-orange-900 dark:text-orange-200"
                    : "border-rose-300 bg-rose-50/70 dark:border-rose-800 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${
                        level === "LOW"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                          : level === "MEDIUM"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                          : level === "HIGH"
                          ? "bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300"
                          : "bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300"
                      }`}
                    >
                      {level === "LOW" && "🛡️"}
                      {level === "MEDIUM" && "⚠️"}
                      {level === "HIGH" && "⚖️"}
                      {level === "CRITICAL" && "❌"}
                    </div>

                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-white/70 dark:bg-slate-900/60 border border-current">
                        <span>
                          {level === "LOW" && (lang === "bn" ? "নিরাপদ জমি" : "SAFE")}
                          {level === "MEDIUM" && (lang === "bn" ? "সতর্কতা প্রয়োজন" : "CAUTION")}
                          {level === "HIGH" && (lang === "bn" ? "উচ্চ ঝুঁকিপূর্ণ" : "HIGH RISK")}
                          {level === "CRITICAL" && (lang === "bn" ? "চরম বিপদজনক" : "CRITICAL DANGER")}
                        </span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                        {level === "LOW" && t("check.verdict_safe_title")}
                        {level === "MEDIUM" && t("check.verdict_medium_title")}
                        {level === "HIGH" && t("check.verdict_high_title")}
                        {level === "CRITICAL" && t("check.verdict_critical_title")}
                      </h2>

                      <p className="text-xs sm:text-sm opacity-90 font-medium max-w-2xl leading-relaxed">
                        {level === "LOW" && t("check.verdict_safe_desc")}
                        {level === "MEDIUM" && t("check.verdict_medium_desc")}
                        {level === "HIGH" && t("check.verdict_high_desc")}
                        {level === "CRITICAL" && t("check.verdict_critical_desc")}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 text-right sm:text-left">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                      {lang === "bn" ? "যাচাই স্ট্যাটাস" : "Status"}
                    </span>
                    <span className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">
                      {lang === "bn"
                        ? level === "LOW"
                          ? "নিরাপদ"
                          : level === "MEDIUM"
                          ? "সতর্কতা"
                          : level === "HIGH"
                          ? "উচ্চ ঝুঁকি"
                          : "চরম বিপদ"
                        : level === "LOW"
                        ? "SAFE"
                        : level === "MEDIUM"
                        ? "CAUTION"
                        : level === "HIGH"
                        ? "HIGH RISK"
                        : "CRITICAL"}
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Core Safety Verification Points (Consistent box size & formal typography) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* 1. Fraud / Double Sale */}
                <div
                  className={`rounded-xl border p-4 transition-all duration-200 shadow-2xs ${
                    hasCriticalOrFraud
                      ? "border-rose-300 bg-rose-50/70 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                      : "border-slate-200/80 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{hasCriticalOrFraud ? "❌" : "🛡️"}</span>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                        {t("check.q_fraud")}
                      </span>
                      <p className="text-xs sm:text-sm font-bold mt-0.5">
                        {hasCriticalOrFraud ? t("check.q_fraud_bad") : t("check.q_fraud_ok")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. Government Khas Land */}
                <div
                  className={`rounded-xl border p-4 transition-all duration-200 shadow-2xs ${
                    hasKhasOrAcquisition
                      ? "border-rose-300 bg-rose-50/70 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200"
                      : "border-slate-200/80 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{hasKhasOrAcquisition ? "🏛️" : "✅"}</span>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                        {t("check.q_khas")}
                      </span>
                      <p className="text-xs sm:text-sm font-bold mt-0.5">
                        {hasKhasOrAcquisition ? t("check.q_khas_bad") : t("check.q_khas_ok")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Lawsuit / Court Case */}
                <div
                  className={`rounded-xl border p-4 transition-all duration-200 shadow-2xs ${
                    hasActiveCase
                      ? "border-orange-300 bg-orange-50/70 text-orange-900 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-200"
                      : "border-slate-200/80 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{hasActiveCase ? "⚖️" : "✅"}</span>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                        {t("check.q_dispute")}
                      </span>
                      <p className="text-xs sm:text-sm font-bold mt-0.5">
                        {hasActiveCase ? t("check.q_dispute_bad") : t("check.q_dispute_ok")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Mutation Status */}
                <div
                  className={`rounded-xl border p-4 transition-all duration-200 shadow-2xs ${
                    hasMissingMutation
                      ? "border-amber-300 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
                      : "border-slate-200/80 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{hasMissingMutation ? "📜" : "✅"}</span>
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block">
                        {t("check.q_mutation")}
                      </span>
                      <p className="text-xs sm:text-sm font-bold mt-0.5">
                        {hasMissingMutation ? t("check.q_mutation_pending") : t("check.q_mutation_ok")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Essential Land & Plot Details (Consistent stat cards with /verify layout) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("check.dag_no")}
                  </span>
                  <p className="mt-1 text-lg font-bold text-slate-900 dark:text-white">
                    {toBnDigits(selectedPlot.dag_no)}
                  </p>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {lang === "bn" ? `প্লট #${toBnDigits(selectedPlot.id)}` : `Plot #${selectedPlot.id}`}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("check.area")}
                  </span>
                  <p className={`mt-1 text-lg font-bold ${isOversold ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                    {toBnDigits(selectedPlot.area_decimal)}{" "}
                    <span className="text-xs font-normal text-slate-500">{t("check.decimals")}</span>
                  </p>
                  {isOversold ? (
                    <div className="mt-1 rounded-md bg-rose-50 border border-rose-200 p-1 text-[10px] font-bold text-rose-700 dark:bg-rose-950/60 dark:border-rose-900 dark:text-rose-300">
                      ⚠️ {lang === "bn"
                        ? `দ্বৈত বিক্রয় জালিয়াতি: মোট ${toBnDigits(selectedPlot.area_decimal)} শতকের বিপরীতে ইতিমধ্যে ${toBnDigits(selectedPlot.sold_decimal)} শতক বিক্রয় শনাক্ত!`
                        : `Oversold Fraud: Plot is ${selectedPlot.area_decimal} dec but ${selectedPlot.sold_decimal} dec was sold!`}
                    </div>
                  ) : selectedPlot.sold_decimal && selectedPlot.sold_decimal > 0 ? (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium block">
                      {lang === "bn"
                        ? `বিক্রীত: ${toBnDigits(selectedPlot.sold_decimal)} শতক • ${formatLandType(selectedPlot.land_type)}`
                        : `Sold: ${selectedPlot.sold_decimal} dec • ${formatLandType(selectedPlot.land_type)}`}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500">
                      {formatLandType(selectedPlot.land_type)}
                    </span>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("check.location_label")}
                  </span>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white truncate">
                    {selectedPlot.mouza}
                  </p>
                  <span className="text-[10px] text-slate-500 truncate block">
                    {selectedPlot.upazila}, {selectedPlot.district}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 col-span-2 sm:col-span-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t("check.present_owner")}
                  </span>
                  <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-400 truncate">
                    {selectedPlot.current_owner_name || selectedPlot.current_owner_masked || "—"}
                  </p>
                  <span className="text-[10px] text-slate-400">
                    {t("check.latest_mutation_badge")}
                  </span>
                </div>
              </div>

              {/* Simplified Transfer History */}
              <Card
                title={t("check.transfer_history_simple")}
                headerAction={
                  <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {toBnDigits(chain.length)} {t("check.transfer_times")}
                  </span>
                }
              >
                {chain.length === 0 ? (
                  <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    {t("check.timeline_empty")}
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {chain.map((item, index) => {
                      const isLatest = index === chain.length - 1;
                      const displayDate = item.date
                        ? new Date(item.date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : item.timestamp || "—";

                      return (
                        <div
                          key={item.seq ?? index}
                          className={`rounded-xl border p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all ${
                            isLatest
                              ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20"
                              : "border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 font-mono dark:bg-slate-800 dark:text-slate-300">
                              #{toBnDigits(item.seq ?? index + 1)}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white font-mono">
                                  {item.deed_no}
                                </span>
                                {isLatest && (
                                  <span className="rounded-full bg-emerald-200 px-2 py-0.2 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                                    {t("check.timeline_latest")}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                                {lang === "bn" ? "গ্রহীতা:" : "Buyer:"}{" "}
                                <strong>{item.buyer_masked || item.buyer || "—"}</strong> • {displayDate}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 justify-between sm:justify-end">
                            <StatusBadge status={item.verify_status || "VALID"} size="sm" />
                            <Link
                              href={`/verify?deed=${encodeURIComponent(item.deed_no)}`}
                              className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 transition"
                            >
                              {t("check.view_deed")}
                            </Link>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Actionable Guidance & Buyer Directives Card */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-5 dark:border-slate-800 dark:bg-slate-900/60 space-y-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>💡</span> {t("check.advice_title")}
                </h3>
                <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line space-y-1 font-medium">
                  {level === "LOW" && t("check.advice_safe")}
                  {level === "MEDIUM" && t("check.advice_medium")}
                  {level === "HIGH" && t("check.advice_high")}
                  {level === "CRITICAL" && t("check.advice_critical")}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 🔬 2. OFFICIAL TECHNICAL VIEW (OFFICERS & AUDITORS ONLY) */}
          {/* ========================================================= */}
          {viewMode === "technical" && isOfficial && (
            <div className="space-y-6 animate-fade-in print:hidden">
              {/* Plot Technical Overview Header */}
              <Card
                title={`${t("check.plot_info")}: ${lang === "bn" ? `দাগ #${toBnDigits(selectedPlot.dag_no)} (প্লট #${toBnDigits(selectedPlot.id)})` : `Dag #${selectedPlot.dag_no} (Plot #${selectedPlot.id})`}`}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {t("check.location_label")}
                    </span>
                    <p className="font-bold text-slate-900 dark:text-white mt-1">
                      {t("check.mouza_label")} {selectedPlot.mouza}
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
                      {isOversold ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          {toBnDigits(selectedPlot.area_decimal)} {t("check.decimals")}
                        </span>
                      ) : selectedPlot.remaining_decimal !== undefined &&
                        selectedPlot.remaining_decimal > 0 &&
                        selectedPlot.remaining_decimal !== selectedPlot.area_decimal ? (
                        <>
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {toBnDigits(selectedPlot.remaining_decimal)} {t("check.decimals")}
                          </span>{" "}
                          <span className="text-xs font-normal text-slate-500">
                            ({lang === "bn" ? `মোট: ${toBnDigits(selectedPlot.area_decimal)}` : `Total: ${selectedPlot.area_decimal}`})
                          </span>
                        </>
                      ) : (
                        <>{toBnDigits(selectedPlot.area_decimal)} {t("check.decimals")}</>
                      )}
                    </p>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {isOversold ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold block">
                          ⚠️ {lang === "bn"
                            ? `চরম জালিয়াতি: মোট ${toBnDigits(selectedPlot.area_decimal)} শতক কিন্তু ইতিমধ্যে ${toBnDigits(selectedPlot.sold_decimal)} শতক বিক্রি শনাক্ত!`
                            : `Fraud: ${selectedPlot.sold_decimal} dec sold on a ${selectedPlot.area_decimal} dec plot!`} • {formatLandType(selectedPlot.land_type)}
                        </span>
                      ) : selectedPlot.sold_decimal && selectedPlot.sold_decimal > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400 font-medium">
                          {lang === "bn"
                            ? `বিক্রীত: ${toBnDigits(selectedPlot.sold_decimal)} শতক`
                            : `Sold: ${selectedPlot.sold_decimal} dec`}{" "}
                          • {formatLandType(selectedPlot.land_type)}
                        </span>
                      ) : (
                        <>{t("check.land_type_label")} {formatLandType(selectedPlot.land_type)}</>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {t("check.current_owner")}
                    </span>
                    <p className="font-bold text-emerald-700 dark:text-emerald-400 mt-1 truncate">
                      {selectedPlot.current_owner_name || selectedPlot.current_owner_masked || "—"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t("check.latest_mutation_badge")}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {t("check.initial_owner")}
                    </span>
                    <p className="font-bold text-slate-800 dark:text-slate-200 mt-1 truncate">
                      {selectedPlot.initial_owner_name || selectedPlot.initial_owner_masked || "—"}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t("check.genesis_record_badge")}
                    </p>
                  </div>
                </div>
              </Card>

              {/* Full Risk Card with Circular Ring, Rule IDs & Findings */}
              <RiskCard report={riskReport} />

              {/* Full Ownership Ledger Chain Timeline */}
              <ChainTimeline chain={chain} />
            </div>
          )}

          {/* ========================================================= */}
          {/* 🖨️ 3. DEDICATED PDF / PRINT VIEW (ONLY VISIBLE ON PRINT)   */}
          {/* ========================================================= */}
          <div className="hidden print:block font-sans text-slate-900 space-y-6 p-2">
            {/* Report Header */}
            <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  {t("check.print_org")}
                </h1>
                <p className="text-sm font-semibold text-slate-600">
                  {t("check.print_title")}
                </p>
              </div>
              <div className="text-right text-xs space-y-0.5">
                <p>
                  <strong>{t("check.print_date")}:</strong> {new Date().toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}
                </p>
                <p className="font-mono text-[11px] text-slate-500">
                  {t("check.print_ref")}: LS-CHK-{selectedPlot.dag_no}-{selectedPlot.id}
                </p>
              </div>
            </div>

            {/* Verdict Summary Box */}
            <div
              className={`rounded-xl border-2 p-4 ${
                level === "LOW"
                  ? "border-emerald-600 bg-emerald-50/50"
                  : level === "MEDIUM"
                  ? "border-amber-600 bg-amber-50/50"
                  : level === "HIGH"
                  ? "border-orange-600 bg-orange-50/50"
                  : "border-rose-600 bg-rose-50/50"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    {t("check.print_status")}:
                  </span>
                  <h2 className="text-xl font-black mt-0.5">
                    {level === "LOW" && t("check.verdict_safe_title")}
                    {level === "MEDIUM" && t("check.verdict_medium_title")}
                    {level === "HIGH" && t("check.verdict_high_title")}
                    {level === "CRITICAL" && t("check.verdict_critical_title")}
                  </h2>
                  <p className="text-xs mt-1 text-slate-700">
                    {level === "LOW" && t("check.verdict_safe_desc")}
                    {level === "MEDIUM" && t("check.verdict_medium_desc")}
                    {level === "HIGH" && t("check.verdict_high_desc")}
                    {level === "CRITICAL" && t("check.verdict_critical_desc")}
                  </p>
                </div>
                <div className="text-right font-mono text-sm font-bold">
                  {level === "LOW" ? "SAFE" : level === "MEDIUM" ? "CAUTION" : level === "HIGH" ? "HIGH_RISK" : "CRITICAL"}
                </div>
              </div>
            </div>

            {/* Land & Plot Details Table */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
                {t("check.plot_info")}
              </h3>
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-100 w-1/4">{t("check.dag_no")}</td>
                    <td className="p-2 w-1/4">{toBnDigits(selectedPlot.dag_no)} (প্লট #{toBnDigits(selectedPlot.id)})</td>
                    <td className="p-2 font-bold bg-slate-100 w-1/4">{t("check.location_label")}</td>
                    <td className="p-2 w-1/4">{selectedPlot.mouza}, {selectedPlot.upazila}, {selectedPlot.district}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-bold bg-slate-100">{t("check.area")}</td>
                    <td className="p-2">
                      {toBnDigits(selectedPlot.area_decimal)} {t("check.decimals")}
                      {isOversold && (
                        <span className="text-rose-700 font-bold block text-[10px] mt-0.5">
                          ⚠️ দ্বৈত বিক্রয় জালিয়াতি: মোট জমির চেয়ে বেশি ({toBnDigits(selectedPlot.sold_decimal)} শতক) বিক্রিত
                        </span>
                      )}
                    </td>
                    <td className="p-2 font-bold bg-slate-100">{t("check.land_type")}</td>
                    <td className="p-2">{formatLandType(selectedPlot.land_type)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold bg-slate-100">{t("check.present_owner")}</td>
                    <td className="p-2">{selectedPlot.current_owner_name || selectedPlot.current_owner_masked || "—"}</td>
                    <td className="p-2 font-bold bg-slate-100">{t("check.initial_owner")}</td>
                    <td className="p-2">{selectedPlot.initial_owner_name || selectedPlot.initial_owner_masked || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 4-Point Safety Status */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
                {lang === "bn" ? "নিরাপত্তা ও আইনি নিরীক্ষা স্থিতি" : "Security & Legal Verification Points"}
              </h3>
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <tbody>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-semibold w-1/2">{t("check.q_fraud")}</td>
                    <td className="p-2 font-bold w-1/2">{hasCriticalOrFraud ? t("check.q_fraud_bad") : t("check.q_fraud_ok")}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-semibold">{t("check.q_khas")}</td>
                    <td className="p-2 font-bold">{hasKhasOrAcquisition ? t("check.q_khas_bad") : t("check.q_khas_ok")}</td>
                  </tr>
                  <tr className="border-b border-slate-300">
                    <td className="p-2 font-semibold">{t("check.q_dispute")}</td>
                    <td className="p-2 font-bold">{hasActiveCase ? t("check.q_dispute_bad") : t("check.q_dispute_ok")}</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold">{t("check.q_mutation")}</td>
                    <td className="p-2 font-bold">{hasMissingMutation ? t("check.q_mutation_pending") : t("check.q_mutation_ok")}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Latest Deed / Ownership Details */}
            {chain.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-2 border-b pb-1">
                  {t("check.transfer_history_simple")}
                </h3>
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-300 text-left">
                      <th className="p-2">#</th>
                      <th className="p-2">{lang === "bn" ? "দলিল নং" : "Deed No"}</th>
                      <th className="p-2">{lang === "bn" ? "গ্রহীতা" : "Buyer"}</th>
                      <th className="p-2">{lang === "bn" ? "তারিখ" : "Date"}</th>
                      <th className="p-2">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chain.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 font-mono">#{idx + 1}</td>
                        <td className="p-2 font-mono font-bold">{item.deed_no}</td>
                        <td className="p-2">{item.buyer_masked || item.buyer || "—"}</td>
                        <td className="p-2">{item.date ? new Date(item.date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US") : "—"}</td>
                        <td className="p-2 font-bold">{item.verify_status || "VALID"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Official Report Footer */}
            <div className="pt-6 border-t border-slate-400 flex justify-between items-center text-[11px] text-slate-600">
              <div>
                <p className="font-semibold">{t("check.print_official_seal")}</p>
                <p>{t("check.disclaimer")}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-xs font-bold text-slate-800">LANDSHIELD VERIFIED</p>
                <p>https://landshield.gov.bd/check</p>
              </div>
            </div>
          </div>

          {/* Prototype Disclaimer Notice (Hidden on print) */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-center text-xs font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300 print:hidden">
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
          <Spinner size="lg" />
        </div>
      }
    >
      <CitizenCheckContent />
    </Suspense>
  );
}
