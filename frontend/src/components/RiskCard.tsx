"use client";

import React from "react";
import { RiskReportOut, RiskLevel, FindingSeverity } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { Card } from "./Card";

interface RiskCardProps {
  report: RiskReportOut | null;
  className?: string;
}

export function RiskCard({ report, className = "" }: RiskCardProps) {
  const { lang, t } = useLanguage();

  if (!report) return null;

  const score = Math.max(0, Math.min(100, Math.round(report.score ?? 0)));
  const level: RiskLevel = (report.level as RiskLevel) || "LOW";

  // Level visual themes
  const levelTheme: Record<
    RiskLevel,
    {
      stroke: string;
      text: string;
      bg: string;
      border: string;
      pillBg: string;
    }
  > = {
    LOW: {
      stroke: "#10b981", // emerald-500
      text: "text-emerald-700 dark:text-emerald-300",
      bg: "bg-emerald-50/70 dark:bg-emerald-950/30",
      border: "border-emerald-200 dark:border-emerald-800",
      pillBg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    },
    MEDIUM: {
      stroke: "#f59e0b", // amber-500
      text: "text-amber-700 dark:text-amber-300",
      bg: "bg-amber-50/70 dark:bg-amber-950/30",
      border: "border-amber-200 dark:border-amber-800",
      pillBg: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    },
    HIGH: {
      stroke: "#f97316", // orange-500
      text: "text-orange-700 dark:text-orange-300",
      bg: "bg-orange-50/70 dark:bg-orange-950/30",
      border: "border-orange-200 dark:border-orange-800",
      pillBg: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
    },
    CRITICAL: {
      stroke: "#f43f5e", // rose-500
      text: "text-rose-700 dark:text-rose-300",
      bg: "bg-rose-50/80 dark:bg-rose-950/40",
      border: "border-rose-300 dark:border-rose-800",
      pillBg: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
    },
  };

  const theme = levelTheme[level] || levelTheme.LOW;

  // SVG circular gauge calculations
  // radius 45 -> circumference = 2 * pi * 45 = 282.74
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const severityPill = (sev: FindingSeverity) => {
    switch (sev) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300";
      case "HIGH":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300 border-orange-300";
      case "MEDIUM":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300";
    }
  };

  // Resilient flags handling across list[str] and dictionary shapes
  const rawFlags = report.flags as unknown;
  const flagsList: string[] = Array.isArray(rawFlags) ? (rawFlags as string[]) : [];
  const flagsObj =
    !Array.isArray(rawFlags) && typeof rawFlags === "object" && rawFlags !== null
      ? (rawFlags as Record<string, unknown>)
      : {};

  const isKhas = flagsList.includes("khas") || Boolean(flagsObj.is_khas);
  const isAcquisition = flagsList.includes("acquisition") || Boolean(flagsObj.is_acquisition);
  const isDisputed = flagsList.includes("disputed") || Boolean(flagsObj.is_disputed);
  const activeCases = typeof flagsObj.active_cases_count === "number" ? flagsObj.active_cases_count : 0;
  const hasFlags = isKhas || isAcquisition || isDisputed || activeCases > 0;

  // Resilient mutation summary
  const mutation = (report.mutation_summary as unknown as Record<string, number | undefined>) || {};
  const totalMutations = mutation.total ?? mutation.total_deeds ?? 0;
  const completedMutations = mutation.completed ?? mutation.mutated_deeds ?? 0;
  const pendingMutations = mutation.pending ?? mutation.pending_mutations ?? 0;
  const rejectedMutations = mutation.rejected ?? mutation.missing_mutations ?? 0;

  const toBnDigits = (num: number | string | undefined | null): string => {
    if (num === undefined || num === null) return "—";
    const str = String(num);
    if (lang !== "bn") return str;
    const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
    return str.replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
  };

  const findings = Array.isArray(report.findings) ? report.findings : [];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. Primary Risk Card with Circular Ring */}
      <div
        className={`rounded-2xl border p-6 sm:p-8 shadow-sm transition-all duration-300 backdrop-blur-md animate-fade-in-up ${theme.border} ${theme.bg}`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Circular SVG Gauge */}
          <div className="relative flex items-center justify-center shrink-0">
            <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 110 110">
              {/* Background track circle */}
              <circle
                cx="55"
                cy="55"
                r={radius}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="9"
                fill="transparent"
              />
              {/* Dynamic animated progress circle */}
              <circle
                cx="55"
                cy="55"
                r={radius}
                stroke={theme.stroke}
                strokeWidth="9"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="transparent"
                style={{ filter: `drop-shadow(0 0 6px ${theme.stroke}55)` }}
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Score in center of ring */}
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className={`text-3xl font-black tracking-tight font-mono ${theme.text}`}>
                {toBnDigits(score)}
              </span>
              <span className="text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
                / {toBnDigits(100)}
              </span>
            </div>
          </div>

          {/* Level Info & Plain Language Summary */}
          <div className="flex-1 text-center sm:text-left space-y-2">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${theme.pillBg}`}
              >
                {t(`risk_level.${level}`, level)}
              </span>

              {/* Chain OK Badge */}
              {report.chain_ok ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t("check.chain_ok")}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-800 dark:bg-rose-950 dark:text-rose-300 animate-pulse">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>{t("check.chain_broken")}</span>
                </span>
              )}
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              {score === 0
                ? (lang === "bn"
                    ? "জমিতে কোনো জালিয়াতি বা বিরোধের প্রমাণ নেই"
                    : "No fraud or legal disputes detected on this plot")
                : lang === "bn"
                ? `${t("check.risk_score")}: ${toBnDigits(score)}/${toBnDigits(100)} (${t(`risk_level.${level}`, level)})`
                : `${t("check.risk_score")}: ${score}/100 (${level})`}
            </h3>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {level === "LOW" &&
                (lang === "bn"
                  ? "এই প্লটের রেকর্ড ও মালিকানা স্বাভাবিক। কোনো ক্রিপ্টোগ্রাফিক বা দ্বৈত বিক্রয়ের ঝুঁকি নেই।"
                  : "The records and ownership chain on this plot are clean and intact. No double-sale or tampering risks detected.")}
              {level === "MEDIUM" &&
                (lang === "bn"
                  ? "সতর্কতা: জমিতে দলিলের বিপরীতে সময়মতো নামজারি সম্পন্ন না হওয়ার মতো ঝুঁকি রয়েছে।"
                  : "Caution: Moderate risk detected, such as pending mutation beyond the standard time window.")}
              {level === "HIGH" &&
                (lang === "bn"
                  ? "এই জমিতে দ্রুত মালিকানা পরিবর্তন অথবা আদালতের মামলা সংক্রান্ত ঝুঁকি রয়েছে। যাচাই করে সিদ্ধান্ত নিন।"
                  : "Elevated risk: Plot has rapid successive transfers or active court disputes. Further review is recommended.")}
              {level === "CRITICAL" &&
                (lang === "bn"
                  ? "সতর্কতা! এই জমিতে দ্বৈত বিক্রয় (Double Sale), স্বত্বহীন বিক্রি অথবা দলিলের তথ্যে গরমিল শনাক্ত হয়েছে।"
                  : "Critical alert! Serious violations detected such as a double-sale attempt, unowned seller, or broken deed integrity.")}
            </p>
          </div>
        </div>
      </div>

      {/* 2. Government Restrictions & Flags Strip */}
      <Card title={t("check.flags_title")}>
        <div className="flex flex-wrap gap-2.5">
          {!hasFlags ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-all hover:scale-105 cursor-default dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              <span>{t("check.flag_clean")}</span>
            </div>
          ) : (
            <>
              {isKhas && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-800 transition-transform duration-200 hover:scale-105 cursor-default dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{t("check.flag_khas")}</span>
                </span>
              )}

              {isAcquisition && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-100 border border-orange-300 px-3 py-1.5 text-xs font-bold text-orange-800 transition-transform duration-200 hover:scale-105 cursor-default dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{t("check.flag_acquisition")}</span>
                </span>
              )}

              {isDisputed && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-100 border border-rose-300 px-3 py-1.5 text-xs font-bold text-rose-800 transition-transform duration-200 hover:scale-105 cursor-default dark:bg-rose-950 dark:border-rose-800 dark:text-rose-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                  </svg>
                  <span>
                    {t("check.flag_disputed")}
                    {activeCases > 0 ? ` (${activeCases} ${t("check.cases_count")})` : ""}
                  </span>
                </span>
              )}
            </>
          )}
        </div>
      </Card>

      {/* 3. Layered Findings Detailed List */}
      <Card
        title={t("layers.title")}
        subtitle={t("layers.subtitle")}
        headerAction={
          findings.length > 0 ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {toBnDigits(findings.length)} {t("check.findings_count")}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {t("check.no_findings")}
            </span>
          )
        }
      >
        <div className="space-y-6">
          {(() => {
            const LAYER_ORDER = ["integrity", "rules", "reconcile", "lineage", "ml"] as const;
            const normalizedLayersRun = report.layers_run && report.layers_run.length > 0
              ? report.layers_run.map((k) => (k === "rule" ? "rules" : k.toLowerCase()))
              : null;

            // Only display layers that are in layers_run (if provided)
            // If layers_run is not provided (Round 1 backend), show layers that have findings, or the core integrity/rules
            const visibleLayers = LAYER_ORDER.filter((layerKey) => {
              if (normalizedLayersRun) {
                return normalizedLayersRun.includes(layerKey);
              }
              const layerFindings = findings.filter((f) => {
                const fl = (f.layer || "").toLowerCase();
                if (layerKey === "rules") return fl === "rules" || fl === "rule";
                return fl === layerKey;
              });
              // Always show integrity and rules; show others if they have findings or if lineage_available is explicitly stated
              if (layerKey === "integrity" || layerKey === "rules") return true;
              if (layerKey === "lineage" && report.lineage_available !== undefined && report.lineage_available !== null) return true;
              return layerFindings.length > 0;
            });

            return visibleLayers.map((layerKey) => {
              const layerFindings = findings.filter((f) => {
                const fl = (f.layer || "").toLowerCase();
                if (layerKey === "rules") return fl === "rules" || fl === "rule";
                return fl === layerKey;
              });

              const isLineageLayer = layerKey === "lineage";
              const showLineageUnavailable = isLineageLayer && report.lineage_available === false;

              return (
                <div
                  key={layerKey}
                  className="rounded-xl border border-slate-200/90 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-900/50 space-y-3 shadow-2xs"
                >
                  {/* Layer Heading */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span>{t(`layers.${layerKey}`)}</span>
                        {layerFindings.length > 0 ? (
                          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                            {layerFindings.length}
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            ✓ OK
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {t(`layers.${layerKey}_desc`)}
                      </p>
                    </div>
                  </div>

                  {/* Findings under this layer */}
                  {layerFindings.length > 0 ? (
                    <div className="space-y-2.5 pt-1">
                      {layerFindings.map((finding, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 transition-all dark:border-slate-800 dark:bg-slate-900/70 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white dark:bg-slate-700">
                                {finding.rule_id}
                              </span>
                              {finding.sub_code && (
                                <span className="rounded-md bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                  {finding.sub_code}
                                </span>
                              )}
                              <span
                                className={`rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase ${severityPill(
                                  finding.severity
                                )}`}
                              >
                                {finding.severity}
                              </span>
                              {typeof finding.weight === "number" && finding.weight > 0 && (
                                <span className="text-[11px] font-semibold text-slate-500 font-mono">
                                  +{finding.weight} pts
                                </span>
                              )}
                            </div>

                            {finding.deed_no && (
                              <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                                {finding.deed_no}
                              </span>
                            )}
                          </div>

                          <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                            {finding.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : showLineageUnavailable ? (
                    <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
                      <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{t("layers.lineage_not_available")}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5 text-xs font-medium text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300">
                      <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{t("layers.no_layer_findings")}</span>
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </Card>

      {/* 4. Mutation Status Summary */}
      <Card title={t("check.mutation_summary")}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
            <span className="text-xl font-bold text-slate-900 dark:text-white font-mono">
              {totalMutations}
            </span>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t("check.total_mutations")}
            </p>
          </div>

          <div className="rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
            <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {completedMutations}
            </span>
            <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-1">
              {t("check.completed_mutations")}
            </p>
          </div>

          <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
            <span className="text-xl font-bold text-amber-600 dark:text-amber-400 font-mono">
              {pendingMutations}
            </span>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              {t("check.pending_mutations")}
            </p>
          </div>

          <div className="rounded-xl bg-rose-50 p-3 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs">
            <span className="text-xl font-bold text-rose-600 dark:text-rose-400 font-mono">
              {rejectedMutations}
            </span>
            <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
              {t("check.rejected_mutations")}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
