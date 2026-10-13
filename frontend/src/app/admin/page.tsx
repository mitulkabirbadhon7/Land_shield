"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ProtectedRoute, useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import {
  getAuditLogs,
  getDevStatus,
  restoreDeed,
  tamperDeed,
  verifyDeed,
  ApiError,
} from "@/lib/api";
import { AuditLogOut, TamperResult, VerifyOut } from "@/lib/types";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/Spinner";
import { ErrorBox } from "@/components/ErrorBox";

function AdminPageContent() {
  const { t } = useLanguage();
  const { user } = useAuth();

  // Active Tab: "tamper" | "audit"
  const [activeTab, setActiveTab] = useState<"tamper" | "audit">("tamper");

  // Dev mode status
  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [devStatusLoading, setDevStatusLoading] = useState(true);

  // Tamper Lab State
  const [targetDeedNo, setTargetDeedNo] = useState("MIR-2026-000001");
  const [tamperLoading, setTamperLoading] = useState(false);
  const [tamperResult, setTamperResult] = useState<TamperResult | null>(null);
  const [tamperError, setTamperError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyOut | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Confirmation dialog modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "tamper" | "restore";
  }>({ open: false, type: "tamper" });

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogOut[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize] = useState(25);
  const [auditLoading, setAuditLoading] = useState(false);

  // Fetch Dev Status
  useEffect(() => {
    getDevStatus()
      .then((res) => {
        setDemoMode(res.demo_mode);
      })
      .catch(() => {
        setDemoMode(false);
      })
      .finally(() => {
        setDevStatusLoading(false);
      });
  }, []);

  // Fetch Audit Logs
  const fetchAuditLogs = useCallback(async (page: number) => {
    setAuditLoading(true);
    try {
      const logs = await getAuditLogs(page, auditPageSize);
      setAuditLogs(logs || []);
    } catch {
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [auditPageSize]);

  useEffect(() => {
    if (activeTab === "audit") {
      fetchAuditLogs(auditPage);
    }
  }, [activeTab, auditPage, fetchAuditLogs]);

  // Run Inline Verify
  const handleInspectDeed = async (deedNo: string) => {
    if (!deedNo.trim()) return;
    setVerifyLoading(true);
    try {
      const res = await verifyDeed(deedNo.trim());
      setVerifyResult(res);
    } catch {
      setVerifyResult(null);
    } finally {
      setVerifyLoading(false);
    }
  };

  // Run Tamper Action
  const executeTamper = async () => {
    setConfirmModal({ open: false, type: "tamper" });
    if (!targetDeedNo.trim()) return;

    setTamperLoading(true);
    setTamperError(null);
    setTamperResult(null);
    try {
      const res = await tamperDeed(targetDeedNo.trim());
      setTamperResult(res);
      // Automatically refresh inline verify to immediately show tampered state
      handleInspectDeed(targetDeedNo.trim());
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setTamperError(err.detail || err.code);
      } else if (err instanceof Error) {
        setTamperError(err.message);
      } else {
        setTamperError("Tamper simulation failed");
      }
    } finally {
      setTamperLoading(false);
    }
  };

  // Run Restore Action
  const executeRestore = async () => {
    setConfirmModal({ open: false, type: "restore" });
    if (!targetDeedNo.trim()) return;

    setTamperLoading(true);
    setTamperError(null);
    setTamperResult(null);
    try {
      const res = await restoreDeed(targetDeedNo.trim());
      setTamperResult(res);
      // Automatically refresh inline verify to immediately show restored valid state
      handleInspectDeed(targetDeedNo.trim());
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setTamperError(err.detail || err.code);
      } else if (err instanceof Error) {
        setTamperError(err.message);
      } else {
        setTamperError("Restore failed");
      }
    } finally {
      setTamperLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Admin Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800/80">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-100/80 px-2.5 py-1 text-xs font-bold text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 mb-2">
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Root Administrator Security Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {t("admin.title")}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t("admin.subtitle")}
          </p>
        </div>

        {/* User Identity */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {user?.name || "System Admin"}
              </span>
              <span className="rounded bg-indigo-100 px-1.5 py-0.2 text-[10px] font-bold text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 uppercase">
                {user?.role || "admin"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Full Administrative Privileges
            </p>
          </div>
        </div>
      </div>

      {/* Primary Tabs */}
      <div className="mb-6 flex border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab("tamper")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition ${
            activeTab === "tamper"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
          </svg>
          <span>{t("admin.tab_tamper")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 border-b-2 px-6 py-3 text-sm font-bold transition ${
            activeTab === "audit"
              ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
          <span>{t("admin.tab_audit")}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Trail
          </span>
        </button>
      </div>

      {/* TAB 1: TAMPER LAB */}
      {activeTab === "tamper" && (
        <div className="space-y-6">
          {devStatusLoading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : !demoMode ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900/60 dark:bg-rose-950/40">
              <p className="text-sm font-bold text-rose-800 dark:text-rose-200">
                {t("admin.demo_disabled_msg")}
              </p>
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                Tamper Lab endpoints are strictly blocked when DEMO_MODE is false to protect production databases.
              </p>
            </div>
          ) : (
            <>
              {/* Tamper Lab Intro Card */}
              <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 p-6 shadow-xs dark:border-indigo-900/50 dark:from-indigo-950/20 dark:to-purple-950/20">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-200">
                    {t("admin.tamper_title")}
                  </h2>
                  <span className="rounded-md bg-indigo-200 px-2 py-0.5 text-[10px] font-black text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100">
                    {t("admin.demo_mode_badge")}
                  </span>
                </div>
                <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 leading-relaxed">
                  {t("admin.tamper_desc")}
                </p>
              </div>

              {/* Tamper Control Panel */}
              <Card title="Simulate Database Payload Tampering">
                <div className="space-y-5">
                  {/* Deed input and presets */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                      {t("admin.deed_input_label")}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={targetDeedNo}
                        onChange={(e) => setTargetDeedNo(e.target.value)}
                        placeholder={t("admin.deed_input_placeholder")}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-mono text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleInspectDeed(targetDeedNo)}
                        disabled={verifyLoading}
                        className="rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {verifyLoading ? <Spinner size="sm" /> : t("admin.verify_inline_btn")}
                      </button>
                    </div>

                    {/* Quick test pills */}
                    <div className="mt-2.5 flex items-center gap-2">
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {t("admin.quick_deeds")}
                      </span>
                      {["MIR-2026-000001", "MIR-2026-000002", "MIR-2026-000003"].map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => {
                            setTargetDeedNo(d);
                            handleInspectDeed(d);
                          }}
                          className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
                    <button
                      type="button"
                      disabled={tamperLoading}
                      onClick={() => setConfirmModal({ open: true, type: "tamper" })}
                      className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-500 transition disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>{t("admin.tamper_btn")}</span>
                    </button>

                    <button
                      type="button"
                      disabled={tamperLoading}
                      onClick={() => setConfirmModal({ open: true, type: "restore" })}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500 transition disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      <span>{t("admin.restore_btn")}</span>
                    </button>
                  </div>

                  {/* Operation Results / Errors */}
                  {tamperError && (
                    <ErrorBox title="Operation Failed" message={tamperError} />
                  )}

                  {tamperResult && (
                    <div
                      className={`rounded-xl border p-4 text-xs font-semibold ${
                        tamperResult.status === "tampered"
                          ? "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200"
                          : "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                      }`}
                    >
                      <p className="font-bold">
                        {tamperResult.status === "tampered"
                          ? t("admin.tamper_success")
                          : t("admin.restore_success")}
                      </p>
                      {tamperResult.original_area !== undefined && (
                        <p className="mt-1 font-mono text-[11px]">
                          Original Area: {tamperResult.original_area} decimals → Tampered Area:{" "}
                          {tamperResult.tampered_area} decimals (+1.0)
                        </p>
                      )}
                    </div>
                  )}

                  {/* Inline Live Verification Inspection Result */}
                  {verifyResult && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5 dark:border-slate-800 dark:bg-slate-950/50">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                          {t("admin.inline_status")}
                        </span>
                        <StatusBadge status={verifyResult.status} />
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400">Deed No:</span>
                          <span className="font-mono font-bold text-slate-900 dark:text-white">
                            {verifyResult.deed_no}
                          </span>
                        </div>

                        {verifyResult.reasons && verifyResult.reasons.length > 0 && (
                          <div>
                            <span className="text-slate-400">Cryptographic Observations:</span>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {verifyResult.reasons.map((r, i) => (
                                <span
                                  key={i}
                                  className="rounded bg-rose-100 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="pt-2">
                          <Link
                            href={`/verify?deed=${encodeURIComponent(verifyResult.deed_no)}`}
                            target="_blank"
                            className="text-indigo-600 hover:underline dark:text-indigo-400 font-bold"
                          >
                            Open in Citizen Public Verify Page ↗
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT LOG TRAIL */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t("admin.audit_title")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("admin.audit_desc")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchAuditLogs(auditPage)}
              className="text-xs font-bold text-indigo-600 hover:underline dark:text-indigo-400"
            >
              ↻ Refresh Logs
            </button>
          </div>

          {auditLoading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-semibold text-slate-500">
                {t("admin.no_logs")}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                <thead className="bg-slate-50 font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3.5">ID</th>
                    <th className="px-4 py-3.5">{t("admin.audit_timestamp")}</th>
                    <th className="px-4 py-3.5">{t("admin.audit_action")}</th>
                    <th className="px-4 py-3.5">{t("admin.audit_entity")}</th>
                    <th className="px-4 py-3.5">{t("admin.audit_actor")}</th>
                    <th className="px-4 py-3.5">{t("admin.audit_details")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
                  {auditLogs.map((log) => (
                    <tr
                      key={log.id}
                      className="hover:bg-slate-50/80 transition dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3 font-mono font-bold text-slate-500">
                        #{log.id}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500">
                        {new Date(log.at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                            log.action.includes("TAMPER")
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              : log.action.includes("RESTORE")
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : log.action.includes("LOGIN")
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px]">
                        {log.entity} {log.entity_id ? `(#${log.entity_id})` : ""}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                        {log.actor_id ? `User #${log.actor_id}` : "System"}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600 dark:text-slate-300 max-w-sm truncate">
                        {log.detail || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination controls */}
              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                <span className="text-xs text-slate-500">
                  {t("admin.page")} {auditPage}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={auditPage <= 1}
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {t("admin.prev_page")}
                  </button>
                  <button
                    type="button"
                    disabled={auditLogs.length < auditPageSize}
                    onClick={() => setAuditPage((p) => p + 1)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {t("admin.next_page")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {confirmModal.type === "tamper" ? "Confirm Tamper Simulation" : "Confirm Deed Restore"}
            </h3>
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmModal.type === "tamper"
                ? t("admin.tamper_confirm")
                : t("admin.restore_confirm")}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmModal({ open: false, type: "tamper" })}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmModal.type === "tamper" ? executeTamper : executeRestore}
                className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-xs ${
                  confirmModal.type === "tamper"
                    ? "bg-rose-600 hover:bg-rose-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminPageContent />
    </ProtectedRoute>
  );
}
