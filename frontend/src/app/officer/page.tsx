"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ProtectedRoute, useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import {
  getAlerts,
  getMutation,
  listMutations,
  transitionMutation,
  updateAlertStatus,
  ApiError,
} from "@/lib/api";
import { AlertOut, MutationOut } from "@/lib/types";
import { Spinner } from "@/components/Spinner";
import { ErrorBox } from "@/components/ErrorBox";
import { useFeatures } from "@/lib/features";

const WORKFLOW_STEPS = [
  "SUBMITTED",
  "AUTO_CHECKED",
  "UNDER_REVIEW",
  "APPROVED",
  "KHATIAN_UPDATED",
];

function StatusStepper({ currentState }: { currentState: string }) {
  const isRejected = currentState === "REJECTED";
  const currentIndex = WORKFLOW_STEPS.indexOf(currentState);

  return (
    <div className="py-4">
      <div className="flex items-center justify-between">
        {WORKFLOW_STEPS.map((step, idx) => {
          const isDone = !isRejected && currentIndex >= idx;
          const isCurrent = !isRejected && currentIndex === idx;

          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center group">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                    isCurrent
                      ? "bg-emerald-600 text-white ring-4 ring-emerald-100 dark:ring-emerald-950/80 animate-pulse-glow scale-110 shadow-md shadow-emerald-600/30"
                      : isDone
                      ? "bg-emerald-500 text-white hover:scale-105 shadow-2xs"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {isDone ? (
                    <svg className="w-4 h-4 animate-scale-in" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span
                  className={`mt-2 text-[10px] font-bold uppercase tracking-tight text-center max-w-[70px] transition-colors duration-200 ${
                    isCurrent
                      ? "text-emerald-700 dark:text-emerald-400 font-extrabold"
                      : isDone
                      ? "text-slate-800 dark:text-slate-200"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {step.replace("_", " ")}
                </span>
              </div>
              {idx < WORKFLOW_STEPS.length - 1 && (
                <div className="flex-1 h-1 mx-2 -mt-5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800">
                  <div
                    className={`h-full transition-all duration-500 ease-out ${
                      !isRejected && currentIndex > idx
                        ? "w-full bg-emerald-500"
                        : "w-0 bg-transparent"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {isRejected && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs font-bold text-rose-800 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-200 animate-shake">
          <span>❌ Application Terminated: REJECTED</span>
        </div>
      )}
    </div>
  );
}

function OfficerPageContent() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const features = useFeatures();

  // Active Tab: "mutations" | "alerts"
  const [activeTab, setActiveTab] = useState<"mutations" | "alerts">("mutations");

  // Mutations state
  const [mutations, setMutations] = useState<MutationOut[]>([]);
  const [mutationFilter, setMutationFilter] = useState<string>("ALL");
  const [mutationsLoading, setMutationsLoading] = useState(false);
  const [selectedMutation, setSelectedMutation] = useState<MutationOut | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionNote, setActionNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Alerts state
  const [alerts, setAlerts] = useState<AlertOut[]>([]);
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>("ALL");
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<string>("ALL");
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertActionLoading, setAlertActionLoading] = useState<number | null>(null);

  // Fetch Mutations
  const fetchMutations = useCallback(async () => {
    setMutationsLoading(true);
    try {
      const data = await listMutations(mutationFilter);
      setMutations(data || []);
    } catch {
      setMutations([]);
    } finally {
      setMutationsLoading(false);
    }
  }, [mutationFilter]);

  // Fetch Alerts
  const fetchAlerts = useCallback(async () => {
    setAlertsLoading(true);
    try {
      const data = await getAlerts(alertStatusFilter, alertSeverityFilter);
      setAlerts(data || []);
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }, [alertStatusFilter, alertSeverityFilter]);

  useEffect(() => {
    if (activeTab === "mutations") {
      fetchMutations();
    } else {
      fetchAlerts();
    }
  }, [activeTab, fetchMutations, fetchAlerts]);

  // Open Mutation Detail Drawer
  const handleOpenMutation = async (m: MutationOut) => {
    setActionError(null);
    setActionSuccess(null);
    setActionNote("");
    try {
      const full = await getMutation(m.id);
      setSelectedMutation(full);
    } catch {
      setSelectedMutation(m);
    }
    setDrawerOpen(true);
  };

  // Legal transitions map
  const getNextTransitions = (state: string): string[] => {
    switch (state) {
      case "SUBMITTED":
        return ["AUTO_CHECKED", "REJECTED"];
      case "AUTO_CHECKED":
        return ["UNDER_REVIEW", "REJECTED"];
      case "UNDER_REVIEW":
        return ["APPROVED", "REJECTED"];
      case "APPROVED":
        return ["KHATIAN_UPDATED"];
      default:
        return [];
    }
  };

  // Handle Transition
  const handleTransition = async (toState: string) => {
    if (!selectedMutation) return;
    setActionError(null);
    setActionSuccess(null);

    // Enforce note validation
    const needsNote =
      toState === "REJECTED" ||
      (selectedMutation.requires_override && toState !== "REJECTED");
    if (needsNote && !actionNote.trim()) {
      setActionError(
        lang === "bn"
          ? "এই পদক্ষেপের জন্য কর্মকর্তার আদেশ বা ব্যাখ্যা নোট প্রদান বাধ্যতামূলক।"
          : "An official decision/justification note is mandatory for this transition."
      );
      return;
    }

    setActionLoading(true);
    try {
      const updated = await transitionMutation(selectedMutation.id, {
        to_state: toState,
        note: actionNote.trim() || undefined,
      });
      setSelectedMutation(updated);
      setActionSuccess(`${t("officer.transition_success")} ${toState}`);
      setActionNote("");
      fetchMutations();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionError(err.detail || err.message);
      } else if (err instanceof Error) {
        setActionError(err.message);
      } else {
        setActionError("Failed to transition mutation workflow");
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Alert Status Update
  const handleUpdateAlert = async (alertId: number, status: string) => {
    setAlertActionLoading(alertId);
    try {
      await updateAlertStatus(alertId, status);
      fetchAlerts();
    } catch {
      // ignore
    } finally {
      setAlertActionLoading(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Officer Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800/80 animate-fade-in-down">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-teal-100/80 px-2.5 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950/80 dark:text-teal-300 mb-2">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>AC Land Officer Workspace</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {t("officer.title")}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t("officer.subtitle")}
          </p>
        </div>

        {/* User Identity */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition-all duration-300 hover:shadow-md hover:border-teal-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700/60">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600 dark:bg-teal-500/20 dark:text-teal-400">
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {user?.name || "Land Officer"}
              </span>
              <span className="rounded bg-teal-100 px-1.5 py-0.2 text-[10px] font-bold text-teal-800 dark:bg-teal-950 dark:text-teal-300 uppercase">
                {user?.role || "officer"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Upazila Land Office • Dhaka Division
            </p>
          </div>
        </div>
      </div>

      {/* Primary Workspace Navigation Tabs */}
      <div className="mb-6 flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("mutations")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition-all duration-200 ${
            activeTab === "mutations"
              ? "border-teal-600 text-teal-600 dark:border-teal-400 dark:text-teal-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>{t("officer.tab_mutations")}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {mutations.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("alerts")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition-all duration-200 ${
            activeTab === "alerts"
              ? "border-rose-600 text-rose-600 dark:border-rose-400 dark:text-rose-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{t("officer.tab_alerts")}</span>
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold">
            {alerts.filter((a) => a.status === "OPEN").length} open
          </span>
        </button>

        {features.FEATURE_RECONCILE && (
          <Link
            href="/officer/reconcile"
            className="flex items-center gap-2 border-b-2 border-transparent px-6 py-3 text-sm font-bold text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-all duration-200"
          >
            <svg className="h-4 w-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span>{t("reconcile.title")}</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
              R8
            </span>
          </Link>
        )}
      </div>

      {/* TAB 1: MUTATIONS (NAMJARI) */}
      {activeTab === "mutations" && (
        <div className="space-y-6 animate-fade-in-up stagger-1">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                State:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  "ALL",
                  "SUBMITTED",
                  "AUTO_CHECKED",
                  "UNDER_REVIEW",
                  "APPROVED",
                  "KHATIAN_UPDATED",
                  "REJECTED",
                ].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setMutationFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                      mutationFilter === st
                        ? "bg-slate-900 text-white dark:bg-teal-600 shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {st === "ALL" ? t("officer.filter_all") : st.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={fetchMutations}
              className="text-xs font-bold text-teal-600 hover:underline dark:text-teal-400 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {/* Mutations Table / Cards */}
          {mutationsLoading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : mutations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900 animate-fade-in">
              <p className="text-sm font-semibold text-slate-500">
                {t("officer.no_mutations")}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-shadow duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">{t("officer.mutation_id")}</th>
                    <th className="px-4 py-3.5">{t("officer.deed_no")}</th>
                    <th className="px-4 py-3.5">{t("officer.plot_dag")}</th>
                    <th className="px-4 py-3.5">{t("officer.applicant")}</th>
                    <th className="px-4 py-3.5">{t("officer.state")}</th>
                    <th className="px-4 py-3.5">{t("officer.created_at")}</th>
                    <th className="px-4 py-3.5 text-right">{t("officer.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
                  {mutations.map((m) => (
                    <tr
                      key={m.id}
                      className="hover:bg-teal-50/40 transition-colors duration-150 dark:hover:bg-slate-800/50 group"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-teal-700 dark:text-teal-400">
                        #{m.id}
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <Link
                          href={`/verify?deed=${encodeURIComponent(m.deed_no || m.deed_id)}`}
                          className="hover:underline text-slate-600 dark:text-slate-300"
                        >
                          {m.deed_no || `Deed #${m.deed_id}`}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <Link
                          href={`/check?plot=${m.plot_id}`}
                          className="hover:underline text-emerald-700 dark:text-emerald-400"
                        >
                          Plot #{m.plot_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {m.applicant_name || `Person #${m.applicant_id}`}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                              m.state === "KHATIAN_UPDATED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : m.state === "REJECTED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : m.state === "APPROVED"
                                ? "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {m.state.replace("_", " ")}
                          </span>
                          {m.requires_override && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.2 text-[9px] font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300 animate-pulse-alert">
                              ⚠️ OVERRIDE
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenMutation(m)}
                          className="btn-interactive rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-700 hover:bg-teal-100 transition-all duration-200 dark:bg-teal-950/60 dark:text-teal-300 shadow-2xs"
                        >
                          {t("officer.review_btn")} →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ALERTS */}
      {activeTab === "alerts" && (
        <div className="space-y-6 animate-fade-in-up stagger-1">
          {/* Alert Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Status:
                </span>
                {["ALL", "OPEN", "ACK", "RESOLVED", "DISMISSED"].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setAlertStatusFilter(st)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                      alertStatusFilter === st
                        ? "bg-slate-900 text-white dark:bg-teal-600 shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Severity:
                </span>
                {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => setAlertSeverityFilter(sev)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all duration-150 ${
                      alertSeverityFilter === sev
                        ? "bg-slate-900 text-white dark:bg-teal-600 shadow-2xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={fetchAlerts}
              className="text-xs font-bold text-teal-600 hover:underline dark:text-teal-400 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {/* Alerts Table */}
          {alertsLoading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : alerts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900 animate-fade-in">
              <p className="text-sm font-semibold text-slate-500">
                {t("officer.no_alerts")}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs transition-shadow duration-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">ID</th>
                    <th className="px-4 py-3.5">{t("officer.alert_rule")}</th>
                    <th className="px-4 py-3.5">{t("officer.alert_plot")}</th>
                    <th className="px-4 py-3.5">{t("officer.alert_severity")}</th>
                    <th className="px-4 py-3.5">{t("officer.alert_reasons")}</th>
                    <th className="px-4 py-3.5">{t("officer.alert_status")}</th>
                    <th className="px-4 py-3.5 text-right">{t("officer.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
                  {alerts.map((a) => (
                    <tr
                      key={a.id}
                      className="hover:bg-rose-50/30 transition-colors duration-150 dark:hover:bg-slate-800/50"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-600 dark:text-slate-400">
                        #{a.id}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-900 dark:text-white">
                        [{a.rule_id}]
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/check?plot=${a.plot_id}`}
                          className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
                        >
                          Plot #{a.plot_id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            a.severity === "CRITICAL"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : a.severity === "HIGH"
                              ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                              : a.severity === "MEDIUM"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          }`}
                        >
                          {a.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-[11px] text-slate-600 dark:text-slate-300">
                        {a.reasons && a.reasons.length > 0
                          ? a.reasons.join(" • ")
                          : "Violation logged by fraud engine"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            a.status === "OPEN"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : a.status === "ACK"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {a.status === "OPEN" && (
                            <button
                              type="button"
                              disabled={alertActionLoading === a.id}
                              onClick={() => handleUpdateAlert(a.id, "ACK")}
                              className="btn-interactive rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 hover:bg-amber-100 transition-all duration-150 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
                            >
                              {t("officer.ack_btn")}
                            </button>
                          )}
                          {a.status !== "RESOLVED" && (
                            <button
                              type="button"
                              disabled={alertActionLoading === a.id}
                              onClick={() => handleUpdateAlert(a.id, "RESOLVED")}
                              className="btn-interactive rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-100 transition-all duration-150 dark:border-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300"
                            >
                              {t("officer.resolve_btn")}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* DETAIL MODAL / DRAWER FOR MUTATION REVIEW */}
      {drawerOpen && selectedMutation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 sm:p-6 overflow-y-auto animate-fade-in">
          <div className="relative w-full max-w-3xl rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8 overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 font-mono text-sm font-bold text-white shadow-md shadow-teal-600/20">
                  #{selectedMutation.id}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t("officer.drawer_title")} #{selectedMutation.id}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedMutation.deed_no || `Deed #${selectedMutation.deed_id}`} • Plot #{selectedMutation.plot_id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 hover:rotate-90 transition-all duration-200 dark:hover:bg-slate-800 dark:hover:text-slate-200 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Status Stepper */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-4 dark:border-slate-800/80 dark:bg-slate-950/40">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  {t("officer.stepper_title")}
                </h4>
                <StatusStepper currentState={selectedMutation.state} />
              </div>

              {/* Applicant & Target Info */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Applicant
                  </span>
                  <p className="mt-1 font-bold text-slate-900 dark:text-white">
                    {selectedMutation.applicant_name || `ID #${selectedMutation.applicant_id}`}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Target Deed
                  </span>
                  <p className="mt-1 font-bold">
                    <Link
                      href={`/verify?deed=${encodeURIComponent(selectedMutation.deed_no || selectedMutation.deed_id)}`}
                      target="_blank"
                      className="text-teal-600 hover:underline dark:text-teal-400"
                    >
                      {selectedMutation.deed_no || `Deed #${selectedMutation.deed_id}`} ↗
                    </Link>
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    Target Plot
                  </span>
                  <p className="mt-1 font-bold">
                    <Link
                      href={`/check?plot=${selectedMutation.plot_id}`}
                      target="_blank"
                      className="text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      Plot #{selectedMutation.plot_id} ↗
                    </Link>
                  </p>
                </div>
              </div>

              {/* Auto-Check Risk Analysis */}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    {t("officer.autocheck_title")}
                  </h4>
                  {selectedMutation.requires_override && (
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      ⚠️ OVERRIDE MANDATORY
                    </span>
                  )}
                </div>

                {selectedMutation.auto_check_json ? (
                  <div className="space-y-3">
                    {selectedMutation.auto_check_json.has_critical && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
                        {t("officer.autocheck_blocked")}
                      </div>
                    )}
                    {selectedMutation.auto_check_json.findings &&
                    selectedMutation.auto_check_json.findings.length > 0 ? (
                      <div className="space-y-2">
                        {selectedMutation.auto_check_json.findings.map((f, i) => (
                          <div
                            key={i}
                            className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs dark:border-slate-800 dark:bg-slate-950/50"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-mono font-bold text-slate-900 dark:text-white">
                                [{f.rule_id}] {f.title || "RULE FLAGGED"}
                              </span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[10px] font-bold ${
                                  f.severity === "CRITICAL"
                                    ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                }`}
                              >
                                {f.severity}
                              </span>
                            </div>
                            {f.text && <p className="mt-1 text-slate-600 dark:text-slate-300">{f.text}</p>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        ✓ {t("officer.autocheck_clean")}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Auto-check results pending initial transition.
                  </p>
                )}
              </div>

              {/* History Events Timeline */}
              <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-3">
                  {t("officer.events_title")}
                </h4>
                {selectedMutation.events && selectedMutation.events.length > 0 ? (
                  <div className="space-y-3">
                    {selectedMutation.events.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-start gap-3 text-xs border-l-2 border-teal-500 pl-3 py-0.5"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {ev.from_state} → {ev.to_state}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(ev.at).toLocaleString()}
                            </span>
                          </div>
                          {ev.note && (
                            <p className="mt-1 rounded bg-slate-50 p-2 text-slate-700 italic dark:bg-slate-950/60 dark:text-slate-300">
                              &ldquo;{ev.note}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">{t("officer.no_events")}</p>
                )}
              </div>

              {/* Action Decision & Transition Box */}
              <div className="rounded-2xl border-2 border-teal-500/50 bg-teal-50/40 p-5 dark:border-teal-700/50 dark:bg-teal-950/20 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-950 dark:text-teal-200">
                  {t("officer.action_box_title")}
                </h4>

                {actionError && (
                  <ErrorBox title="Transition Error" message={actionError} />
                )}
                {actionSuccess && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 animate-fade-in-down">
                    ✓ {actionSuccess}
                  </div>
                )}

                {/* Decision Note Input */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                    {t("officer.note_label")}{" "}
                    {selectedMutation.requires_override && (
                      <span className="text-rose-600">*</span>
                    )}
                  </label>
                  <textarea
                    rows={3}
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    placeholder={t("officer.note_placeholder")}
                    className="w-full rounded-xl border border-slate-300 bg-white p-3 text-xs text-slate-900 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white transition-all duration-200"
                  />
                  {selectedMutation.requires_override && (
                    <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300 animate-fade-in">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
                      <span>{t("officer.note_required_warning")}</span>
                    </div>
                  )}
                </div>

                {/* Next Legal Actions Buttons */}
                <div>
                  <span className="block text-[11px] font-bold text-slate-500 uppercase mb-2">
                    {t("officer.legal_transitions")}
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {getNextTransitions(selectedMutation.state).map((target) => {
                      const isReject = target === "REJECTED";
                      return (
                        <button
                          key={target}
                          type="button"
                          disabled={actionLoading}
                          onClick={() => handleTransition(target)}
                          className={`btn-interactive rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-200 shadow-xs disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98] ${
                            isReject
                              ? "bg-rose-600 text-white hover:bg-rose-700 shadow-rose-600/20"
                              : "bg-teal-600 text-white hover:bg-teal-700 shadow-teal-600/20"
                          }`}
                        >
                          {actionLoading ? (
                            <Spinner size="sm" />
                          ) : (
                            <span>
                              {isReject ? "Reject Application" : `Move to ${target.replace("_", " ")}`}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {getNextTransitions(selectedMutation.state).length === 0 && (
                      <span className="text-xs text-slate-500 italic">
                        Workflow reached terminal state ({selectedMutation.state}). No further transitions available.
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OfficerPage() {
  return (
    <ProtectedRoute allowedRoles={["officer", "admin"]}>
      <OfficerPageContent />
    </ProtectedRoute>
  );
}
