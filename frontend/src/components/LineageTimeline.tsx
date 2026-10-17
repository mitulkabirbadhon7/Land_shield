"use client";

import React, { useState } from "react";
import { LineageOut, KhatianNode, LineageIssue } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";
import { Card } from "./Card";
import { Spinner } from "./Spinner";

interface LineageTimelineProps {
  lineage: LineageOut | null;
  loading?: boolean;
  className?: string;
}

const SURVEY_ORDER = ["CS", "SA", "RS", "BS"] as const;

export function LineageTimeline({
  lineage,
  loading = false,
  className = "",
}: LineageTimelineProps) {
  const { lang, t } = useLanguage();
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  if (loading) {
    return (
      <Card title={t("lineage.title")} subtitle={t("lineage.subtitle")} className={className}>
        <div className="flex items-center justify-center py-12 gap-3">
          <Spinner size="md" />
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t("common.loading")}
          </span>
        </div>
      </Card>
    );
  }

  if (!lineage || lineage.lineage_available === false || !lineage.nodes || lineage.nodes.length === 0) {
    return (
      <Card title={t("lineage.title")} subtitle={t("lineage.subtitle")} className={className}>
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400">
          <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{t("lineage.no_data")}</span>
        </div>
      </Card>
    );
  }

  // Parse issues safely (handling either string[] or LineageIssue[])
  const rawIssues = lineage.issues || [];
  const normalizedIssues: LineageIssue[] = rawIssues.map((iss) => {
    if (typeof iss === "string") {
      let code = "UNKNOWN";
      if (iss.includes("AREA_GROWTH") || iss.toLowerCase().includes("growth")) code = "AREA_GROWTH";
      else if (iss.includes("MISSING_GENERATION") || iss.toLowerCase().includes("missing")) code = "MISSING_GENERATION";
      else if (iss.includes("ORPHAN") || iss.toLowerCase().includes("orphan")) code = "ORPHAN";
      else if (iss.includes("BAD_PARENT") || iss.toLowerCase().includes("parent")) code = "BAD_PARENT";
      return { code, message: iss };
    }
    return iss;
  });

  const hasIssues = normalizedIssues.length > 0;

  // Map nodes by survey_type
  const nodeMap = new Map<string, KhatianNode>();
  lineage.nodes.forEach((n) => {
    if (n.survey_type) {
      nodeMap.set(n.survey_type.toUpperCase(), n);
    }
  });

  // Determine which survey types are present
  const presentSurveys = SURVEY_ORDER.filter((s) => nodeMap.has(s));
  const earliestIndex = presentSurveys.length > 0 ? SURVEY_ORDER.indexOf(presentSurveys[0]) : -1;
  const latestIndex = presentSurveys.length > 0 ? SURVEY_ORDER.indexOf(presentSurveys[presentSurveys.length - 1]) : -1;

  // Check if a survey has specific issues
  const getIssuesForSurvey = (survey: string): LineageIssue[] => {
    return normalizedIssues.filter((iss) => {
      const msg = (iss.message || "").toUpperCase();
      const code = (iss.code || "").toUpperCase();
      const surveyKey = iss.survey_type ? iss.survey_type.toUpperCase() : null;

      if (surveyKey === survey) return true;
      if (msg.includes(survey)) return true;
      const surveyIdx = (SURVEY_ORDER as readonly string[]).indexOf(survey);
      if (
        code === "MISSING_GENERATION" &&
        !nodeMap.has(survey) &&
        earliestIndex <= surveyIdx &&
        surveyIdx <= latestIndex
      ) {
        return true;
      }
      return false;
    });
  };

  return (
    <Card
      title={t("lineage.title")}
      subtitle={t("lineage.subtitle")}
      headerAction={
        hasIssues ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
            <span>
              {normalizedIssues.length} {lang === "bn" ? "টি অসঙ্গতি" : "Discrepancies"}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span>{t("lineage.healthy")}</span>
          </span>
        )
      }
      className={className}
    >
      {/* Issues Summary Banner if present */}
      {hasIssues && (
        <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900/60 dark:bg-rose-950/40 space-y-2">
          <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs uppercase tracking-wider">
            <svg className="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{lang === "bn" ? "খতিয়ান ধারাবাহিকতা লঙ্ঘন (Rule R7)" : "Lineage Discrepancies Detected (Rule R7)"}</span>
          </div>
          <ul className="space-y-1 pl-6 list-disc text-xs text-rose-900 dark:text-rose-200">
            {normalizedIssues.map((iss, idx) => (
              <li key={idx}>
                <span className="font-mono font-bold mr-1.5">{iss.code}:</span>
                <span>
                  {t(`lineage.issue_${iss.code}`, iss.message)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Horizontal Lineage Timeline (CS -> SA -> RS -> BS) with smooth horizontal scroll */}
      <div className="overflow-x-auto pb-4 pt-2 -mx-2 px-2 scrollbar-thin">
        <div className="inline-flex items-center min-w-[700px] w-full justify-between gap-3">
          {SURVEY_ORDER.map((survey, index) => {
            const node = nodeMap.get(survey);
            const isMissingInSequence =
              !node &&
              earliestIndex !== -1 &&
              latestIndex !== -1 &&
              index > earliestIndex &&
              index < latestIndex;

            const surveyIssues = getIssuesForSurvey(survey);
            const nodeHasIssue = surveyIssues.length > 0 || isMissingInSequence;

            // Formatted owner name
            let ownerDisplay = "—";
            if (node?.owners) {
              if (Array.isArray(node.owners)) {
                ownerDisplay = node.owners
                  .map((o) => (typeof o === "string" ? o : o.name || ""))
                  .filter(Boolean)
                  .join(", ");
              } else if (typeof node.owners === "string") {
                ownerDisplay = node.owners;
              }
            }

            return (
              <React.Fragment key={survey}>
                {/* Generation Node Card */}
                <div
                  className={`relative flex-1 min-w-[155px] rounded-2xl border p-4 transition-all duration-300 ${
                    node
                      ? nodeHasIssue
                        ? "border-rose-300 bg-rose-50/70 shadow-sm dark:border-rose-800 dark:bg-rose-950/40 hover:border-rose-400"
                        : "border-slate-200 bg-white/90 shadow-2xs dark:border-slate-800 dark:bg-slate-900/70 hover:border-emerald-400 hover:shadow-sm"
                      : isMissingInSequence
                      ? "border-dashed border-rose-300 bg-rose-50/30 dark:border-rose-800/80 dark:bg-rose-950/20"
                      : "border-dashed border-slate-200 bg-slate-50/40 opacity-55 dark:border-slate-800 dark:bg-slate-900/20"
                  }`}
                >
                  {/* Generation Badge */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span
                      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-black font-mono tracking-wider ${
                        node
                          ? nodeHasIssue
                            ? "bg-rose-200 text-rose-900 dark:bg-rose-900 dark:text-rose-200"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : isMissingInSequence
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {t(`lineage.survey_${survey}`, survey)}
                    </span>

                    {/* Issue Indicator Icon with Click/Hover Tooltip */}
                    {nodeHasIssue && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveTooltip(activeTooltip === survey ? null : survey)
                          }
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-white text-[10px] font-bold shadow-xs transition-transform hover:scale-110 active:scale-95"
                          title="Click to view issue"
                        >
                          !
                        </button>
                        {activeTooltip === survey && (
                          <div className="absolute right-0 z-30 mt-1 w-52 rounded-xl border border-rose-300 bg-white p-3 text-xs text-rose-900 shadow-xl dark:border-rose-800 dark:bg-slate-900 dark:text-rose-200 animate-scale-in">
                            <p className="font-bold mb-1">
                              {surveyIssues[0]?.code || "ISSUE"}:
                            </p>
                            <p className="text-[11px] leading-relaxed">
                              {surveyIssues[0]?.message || t("lineage.missing_gen_desc")}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Node Content */}
                  {node ? (
                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                          {t("lineage.khatian_label")}
                        </span>
                        <p className="font-mono font-bold text-slate-900 dark:text-white">
                          #{node.khatian_no}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                          {t("lineage.area_label")}
                        </span>
                        <p className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {node.area_decimal} {lang === "bn" ? "শতক" : "dec"}
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold">
                          {t("lineage.owners_label")}
                        </span>
                        <p className="font-medium text-slate-700 dark:text-slate-300 truncate" title={ownerDisplay}>
                          {ownerDisplay}
                        </p>
                      </div>

                      {node.parent_id && (
                        <div className="pt-1 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
                          <span>{t("lineage.parent_label")}: #{node.parent_id}</span>
                        </div>
                      )}
                    </div>
                  ) : isMissingInSequence ? (
                    <div className="py-4 text-center space-y-1">
                      <span className="text-xs font-bold text-rose-700 dark:text-rose-400">
                        {t("lineage.missing_gen")}
                      </span>
                      <p className="text-[10px] text-rose-600/80 dark:text-rose-400/70">
                        {lang === "bn" ? "শৃঙ্খল বিচ্ছিন্ন" : "Chain broken"}
                      </p>
                    </div>
                  ) : (
                    <div className="py-4 text-center">
                      <span className="text-[11px] text-slate-400">
                        {lang === "bn" ? "রেকর্ড নেই" : "No record"}
                      </span>
                    </div>
                  )}
                </div>

                {/* Arrow Connector between survey generations */}
                {index < SURVEY_ORDER.length - 1 && (
                  <div className="flex items-center justify-center shrink-0 text-slate-300 dark:text-slate-700">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
