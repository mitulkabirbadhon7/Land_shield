"use client";

import React from "react";
import Link from "next/link";
import { ChainItem } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { Card } from "./Card";
import { useLanguage } from "@/lib/i18n";

interface ChainTimelineProps {
  chain: ChainItem[];
  className?: string;
}

export function ChainTimeline({ chain, className = "" }: ChainTimelineProps) {
  const { lang, t } = useLanguage();

  if (!chain || chain.length === 0) {
    return (
      <Card title={t("check.ownership_chain")} className={className}>
        <p className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
          {t("check.timeline_empty")}
        </p>
      </Card>
    );
  }

  return (
    <Card
      title={t("check.ownership_chain")}
      headerAction={
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold font-mono text-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {chain.length} {t("check.timeline_count")}
        </span>
      }
      className={className}
    >
      <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-teal-500 before:via-emerald-400 before:to-slate-200 dark:before:to-slate-800">
        {chain.map((item, index) => {
          const isLatest = index === chain.length - 1;
          const buyerName = item.buyer_masked || item.buyer || "—";
          const displayDate = item.date
            ? new Date(item.date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : item.timestamp || "—";

          return (
            <div key={item.seq ?? index} className={`relative group animate-fade-in-up stagger-${Math.min(5, (index % 5) + 1)}`}>
              {/* Timeline marker icon/dot */}
              <div
                className={`absolute -left-6 sm:-left-8 top-1.5 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full border-2 transition-all duration-200 group-hover:scale-110 ${
                  isLatest
                    ? "border-teal-500 bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400 ring-4 ring-teal-100 dark:ring-teal-950/60 animate-pulse-glow"
                    : "border-slate-300 bg-white text-slate-500 group-hover:border-teal-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
                }`}
              >
                <span className="text-[10px] sm:text-xs font-bold font-mono">
                  {item.seq ?? index + 1}
                </span>
              </div>

              {/* Transfer Detail Card */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-400/60 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                      {item.deed_no}
                    </span>
                    {isLatest && (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300 animate-pulse">
                        {t("check.timeline_latest")}
                      </span>
                    )}
                  </div>

                  {/* Status Badge */}
                  <StatusBadge
                    status={item.verify_status || "VALID"}
                    size="sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t("check.timeline_buyer")}{" "}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {buyerName}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-500 dark:text-slate-400">
                      {t("check.timeline_date")}{" "}
                    </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {displayDate}
                    </span>
                  </div>
                </div>

                {/* Hash fingerprint, area or status & verification link */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                    {item.entry_hash ? (
                      <>
                        <span>{t("check.timeline_hash")}</span>
                        <span className="truncate max-w-[140px] sm:max-w-[200px]" title={item.entry_hash}>
                          {item.entry_hash.slice(0, 16)}...
                        </span>
                      </>
                    ) : typeof item.area_sold === "number" ? (
                      <span className="text-slate-600 dark:text-slate-300">
                        {t("check.timeline_area")} <strong className="font-bold">{item.area_sold}</strong> {t("check.decimals")}
                      </span>
                    ) : (
                      <span>{t("check.timeline_status")} {item.deed_status || "ACTIVE"}</span>
                    )}
                  </div>

                  <Link
                    href={`/verify?deed=${encodeURIComponent(item.deed_no)}`}
                    className="group/btn inline-flex items-center gap-1 text-xs font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 transition"
                  >
                    <span>{t("check.view_deed")}</span>
                    <svg
                      className="w-3.5 h-3.5 transition-transform duration-200 group-hover/btn:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
