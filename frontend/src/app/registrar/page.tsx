"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ProtectedRoute, useAuth } from "@/lib/auth";
import { useLanguage, toBnDigits } from "@/lib/i18n";
import {
  createDeed,
  getDeedQrBlob,
  getMeta,
  getPlot,
  searchPersons,
  searchPlots,
  startMutation,
  ApiError,
} from "@/lib/api";
import {
  DeedRegistrationResponse,
  FraudReport,
  MetaOut,
  MutationOut,
  PersonOut,
  PlotOut,
} from "@/lib/types";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/Spinner";
import { ErrorBox } from "@/components/ErrorBox";

function RegistrarPageContent() {
  const { t, lang } = useLanguage();
  const { user } = useAuth();

  // Metadata
  const [meta, setMeta] = useState<MetaOut>({
    deed_types: ["SALE", "GIFT", "HEIR", "MORTGAGE"],
    sub_registries: [
      { code: "MIR", name: "মিরপুর (Mirpur)" },
      { code: "DHAKA", name: "ঢাকা সদর (Dhaka Sadar)" },
      { code: "SAVAR", name: "সাভার (Savar)" },
    ],
  });

  // Form inputs
  const [plotId, setPlotId] = useState<number | null>(null);
  const [selectedPlot, setSelectedPlot] = useState<PlotOut | null>(null);
  const [sellerId, setSellerId] = useState<number | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<PersonOut | null>(null);
  const [buyerId, setBuyerId] = useState<number | null>(null);
  const [selectedBuyer, setSelectedBuyer] = useState<PersonOut | null>(null);
  const [areaSold, setAreaSold] = useState<string>("");
  const [deedType, setDeedType] = useState<string>("SALE");
  const [subRegistry, setSubRegistry] = useState<string>("MIR");

  // Plot search state
  const [plotQuery, setPlotQuery] = useState("");
  const [plotSearching, setPlotSearching] = useState(false);
  const [plotResults, setPlotResults] = useState<PlotOut[]>([]);
  const [showPlotDropdown, setShowPlotDropdown] = useState(false);

  // Seller search state
  const [sellerQuery, setSellerQuery] = useState("");
  const [sellerSearching, setSellerSearching] = useState(false);
  const [sellerResults, setSellerResults] = useState<PersonOut[]>([]);
  const [showSellerDropdown, setShowSellerDropdown] = useState(false);

  // Buyer search state
  const [buyerQuery, setBuyerQuery] = useState("");
  const [buyerSearching, setBuyerSearching] = useState(false);
  const [buyerResults, setBuyerResults] = useState<PersonOut[]>([]);
  const [showBuyerDropdown, setShowBuyerDropdown] = useState(false);

  // Submission & Results state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fraudReport, setFraudReport] = useState<FraudReport | null>(null);
  const [successData, setSuccessData] = useState<DeedRegistrationResponse | null>(null);
  const [qrBlobUrl, setQrBlobUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Mutation start state
  const [mutationStarting, setMutationStarting] = useState(false);
  const [mutationSuccess, setMutationSuccess] = useState<MutationOut | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Load metadata on mount
  useEffect(() => {
    getMeta()
      .then((m) => {
        if (m) {
          setMeta(m);
          if (m.deed_types?.length) setDeedType(m.deed_types[0]);
          if (m.sub_registries?.length) setSubRegistry(m.sub_registries[0].code);
        }
      })
      .catch(() => {
        // Fallback defaults already initialized
      });
  }, []);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (qrBlobUrl) {
        URL.revokeObjectURL(qrBlobUrl);
      }
    };
  }, [qrBlobUrl]);

  // Handle Plot Search
  const handlePlotSearch = async (query: string) => {
    setPlotQuery(query);
    if (!query.trim()) {
      setPlotResults([]);
      setShowPlotDropdown(false);
      return;
    }
    setPlotSearching(true);
    setShowPlotDropdown(true);
    try {
      if (/^\d+$/.test(query.trim())) {
        try {
          const directPlot = await getPlot(parseInt(query.trim(), 10));
          if (directPlot) {
            setPlotResults([directPlot]);
            setPlotSearching(false);
            return;
          }
        } catch {
          // not found by ID, fall through
        }
      }
      const results = await searchPlots(query.trim());
      setPlotResults(results || []);
    } catch {
      setPlotResults([]);
    } finally {
      setPlotSearching(false);
    }
  };

  const handleSelectPlot = (p: PlotOut) => {
    setPlotId(p.id);
    setSelectedPlot(p);
    setPlotQuery(`Dag #${p.dag_no} - Mouza ${p.mouza} (Plot #${p.id})`);
    setShowPlotDropdown(false);
    setFormError(null);
  };

  // Handle Seller Search
  const handleSellerSearch = async (q: string) => {
    setSellerQuery(q);
    setSellerSearching(true);
    setShowSellerDropdown(true);
    try {
      const results = await searchPersons(q.trim(), 15);
      setSellerResults(results || []);
    } catch {
      setSellerResults([]);
    } finally {
      setSellerSearching(false);
    }
  };

  const handleSelectSeller = (person: PersonOut) => {
    setSellerId(person.id);
    setSelectedSeller(person);
    setSellerQuery(`${person.display_name} (#${person.id})`);
    setShowSellerDropdown(false);
    setFormError(null);
  };

  // Handle Buyer Search
  const handleBuyerSearch = async (q: string) => {
    setBuyerQuery(q);
    setBuyerSearching(true);
    setShowBuyerDropdown(true);
    try {
      const results = await searchPersons(q.trim(), 15);
      setBuyerResults(results || []);
    } catch {
      setBuyerResults([]);
    } finally {
      setBuyerSearching(false);
    }
  };

  const handleSelectBuyer = (person: PersonOut) => {
    setBuyerId(person.id);
    setSelectedBuyer(person);
    setBuyerQuery(`${person.display_name} (#${person.id})`);
    setShowBuyerDropdown(false);
    setFormError(null);
  };

  // Quick Preset Scenarios
  const handleLoadScenario = async (scenarioType: "clean" | "double" | "stranger") => {
    setFormError(null);
    setFraudReport(null);
    setSuccessData(null);
    setMutationSuccess(null);
    setMutationError(null);

    try {
      if (scenarioType === "clean") {
        // Plot 6: Clean Deal (Genuine current owner is Person 16 with 35.0 decimals)
        const p = await getPlot(6);
        handleSelectPlot(p);
        const sellerId = p.current_owner_id ?? 16;
        let s: PersonOut | undefined;
        try {
          const sellerResults = await searchPersons(String(sellerId), 5);
          s = sellerResults.find((x) => x.id === sellerId);
        } catch {
          // fallback
        }
        if (!s) {
          s = {
            id: sellerId,
            display_name: p.current_owner_name || "আনিস বিশ্বাস (Anis Biswas)",
            is_synthetic: true,
          };
        }
        handleSelectSeller(s);
        let b: PersonOut | undefined;
        try {
          const buyerResults = await searchPersons("99", 5);
          b = buyerResults.find((x) => x.id === 99);
        } catch {
          // fallback
        }
        if (!b) {
          b = {
            id: 99,
            display_name: "ওয়াহিদুল ভূঁইয়া (Wahidul Bhuiyan)",
            is_synthetic: true,
          };
        }
        handleSelectBuyer(b);
        setAreaSold("10.0");
        setDeedType("SALE");
        setSubRegistry("MIR");
      } else if (scenarioType === "double") {
        // Plot 1: Double Sale (Seller 1 already sold this plot)
        const p = await getPlot(1);
        handleSelectPlot(p);
        const persons = await searchPersons("", 50);
        const s = persons.find((x) => x.id === 1) || {
          id: 1,
          display_name: "মোহাম্মদ রহমান (Mohammad Rahman)",
          is_synthetic: true,
        };
        handleSelectSeller(s);
        const b = persons.find((x) => x.id === 99) || {
          id: 99,
          display_name: "ওয়াহিদুল ভূঁইয়া (Wahidul Bhuiyan)",
          is_synthetic: true,
        };
        handleSelectBuyer(b);
        setAreaSold("30.0");
        setDeedType("SALE");
        setSubRegistry("MIR");
      } else if (scenarioType === "stranger") {
        // Plot 2: Stranger Seller (Seller 99 does not own Plot 2)
        const p = await getPlot(2);
        handleSelectPlot(p);
        const persons = await searchPersons("", 50);
        const s = persons.find((x) => x.id === 99) || {
          id: 99,
          display_name: "ওয়াহিদুল ভূঁইয়া (Stranger Seller)",
          is_synthetic: true,
        };
        handleSelectSeller(s);
        const b = persons.find((x) => x.id === 20) || {
          id: 20,
          display_name: "রাশেদ মোল্লা (Rashed Molla)",
          is_synthetic: true,
        };
        handleSelectBuyer(b);
        setAreaSold("15.0");
        setDeedType("SALE");
        setSubRegistry("MIR");
      }
    } catch {
      // Fallback
    }
  };

  // Submit Deed Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFraudReport(null);
    setSuccessData(null);
    setMutationSuccess(null);
    setMutationError(null);

    if (!plotId) {
      setFormError(
        lang === "bn"
          ? "অনুগ্রহ করে একটি বৈধ প্লট নির্বাচন করুন।"
          : "Please select a target land plot."
      );
      return;
    }
    if (!sellerId) {
      setFormError(
        lang === "bn"
          ? "অনুগ্রহ করে একজন বিক্রেতা নির্বাচন করুন।"
          : "Please select a valid seller (vendor)."
      );
      return;
    }
    if (!buyerId) {
      setFormError(
        lang === "bn"
          ? "অনুগ্রহ করে একজন ক্রেতা নির্বাচন করুন।"
          : "Please select a valid buyer (vendee)."
      );
      return;
    }
    if (sellerId === buyerId) {
      setFormError(
        lang === "bn"
          ? "বিক্রেতা এবং ক্রেতা একই ব্যক্তি হতে পারে না।"
          : "Seller and buyer cannot be the exact same person."
      );
      return;
    }
    const parsedArea = parseFloat(areaSold);
    if (isNaN(parsedArea) || parsedArea <= 0) {
      setFormError(
        lang === "bn"
          ? "বিক্রীত জমির পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।"
          : "Area sold must be a valid positive decimal number."
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await createDeed({
        plot_id: plotId,
        seller_id: sellerId,
        buyer_id: buyerId,
        area_sold: parsedArea,
        deed_type: deedType,
        sub_registry: subRegistry,
      });

      setSuccessData(response);

      // Refresh plot data to immediately update remaining_decimal & sold_decimal
      try {
        const updatedPlot = await getPlot(plotId);
        setSelectedPlot(updatedPlot);
      } catch {
        // Non-fatal
      }

      // Fetch official QR code image with auth
      setQrLoading(true);
      try {
        const blob = await getDeedQrBlob(response.deed.deed_no);
        const url = URL.createObjectURL(blob);
        setQrBlobUrl(url);
      } catch {
        // QR fetch failure non-fatal to deed creation
      } finally {
        setQrLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409 && err.code === "FRAUD_BLOCKED") {
          setFraudReport(err.report as FraudReport);
        } else {
          setFormError(err.detail || err.message);
        }
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError(
          lang === "bn"
            ? "দলিল নিবন্ধনকালে অপ্রত্যাশিত ত্রুটি ঘটেছে।"
            : "An unexpected error occurred during deed registration."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Start Mutation
  const handleStartMutation = async () => {
    if (!successData?.deed) return;
    setMutationStarting(true);
    setMutationError(null);
    try {
      const res = await startMutation({
        deed_id: successData.deed.id,
        applicant_id: successData.deed.buyer_id,
        auto_check: true,
      });
      setMutationSuccess(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setMutationError(err.detail || err.message);
      } else if (err instanceof Error) {
        setMutationError(err.message);
      } else {
        setMutationError("Failed to start mutation workflow");
      }
    } finally {
      setMutationStarting(false);
    }
  };

  // Reset form
  const handleResetForm = () => {
    setPlotId(null);
    setSelectedPlot(null);
    setPlotQuery("");
    setSellerId(null);
    setSelectedSeller(null);
    setSellerQuery("");
    setBuyerId(null);
    setSelectedBuyer(null);
    setBuyerQuery("");
    setAreaSold("");
    setFormError(null);
    setFraudReport(null);
    setSuccessData(null);
    if (qrBlobUrl) {
      URL.revokeObjectURL(qrBlobUrl);
      setQrBlobUrl(null);
    }
    setMutationSuccess(null);
    setMutationError(null);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Portal Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200/80 pb-6 dark:border-slate-800/80 animate-fade-in-down">
        <div>
          <div className="inline-flex items-center gap-2 rounded-lg bg-emerald-100/80 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 mb-2">
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>{lang === "bn" ? "এড২৫৫১৯ ক্রিপ্টোগ্রাফিক নিবন্ধন" : "Ed25519 Cryptographic Registration"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            {t("registrar.title")}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t("registrar.subtitle")}
          </p>
        </div>

        {/* Current User Badge */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition-transform duration-200 hover:scale-105 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
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
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {user?.name || (lang === "bn" ? "সাব-রেজিস্ট্রার" : "Sub-Registrar")}
              </span>
              <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 uppercase">
                {lang === "bn"
                  ? user?.role === "registrar"
                    ? "সাব-রেজিস্ট্রার"
                    : user?.role === "officer"
                    ? "ভূমি কর্মকর্তা"
                    : user?.role === "admin"
                    ? "অ্যাডমিন"
                    : user?.role
                  : user?.role || "registrar"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === "bn"
                ? "সাব-রেজিস্ট্রি: মিরপুর (MIR) • সাইনার কী: #৮৮c৬৭a৭৩"
                : "Sub-Registry: Mirpur (MIR) • Key ID: #88c67a73"}
            </p>
          </div>
        </div>
      </div>

      {/* Benchmark Fast Test Scenarios */}
      <div className="mb-8 rounded-2xl border border-slate-200/90 bg-white/70 p-4 shadow-xs backdrop-blur-md dark:border-slate-800/90 dark:bg-slate-900/70 animate-fade-in-up stagger-1">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {t("registrar.quick_scenarios")}
            </h2>
          </div>
          <span className="text-[11px] text-slate-400">
            {lang === "bn"
              ? "হ্যাকাথন টেস্ট ডেটাসেট অনুযায়ী ফরম স্বয়ংক্রিয় পূরণ"
              : "Pre-fills form with hackathon test dataset"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => handleLoadScenario("clean")}
            className="flex items-center justify-between rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-2.5 text-left transition-all duration-200 hover:scale-[1.02] hover:border-emerald-400 hover:bg-emerald-100/50 hover:shadow-xs active:scale-98 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:hover:border-emerald-700"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-emerald-200 px-1.5 py-0.2 text-[10px] font-black text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100">
                  S6
                </span>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  {t("registrar.scenario_clean")}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                {lang === "bn"
                  ? "প্লট ৬ • প্রকৃত খতিয়ানদার • প্রত্যাশিত: বৈধ নিবন্ধন (201)"
                  : "Plot 6 • Genuine owner • Expect 201 Success"}
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              →
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleLoadScenario("double")}
            className="flex items-center justify-between rounded-xl border border-rose-200/80 bg-rose-50/50 p-2.5 text-left transition-all duration-200 hover:scale-[1.02] hover:border-rose-400 hover:bg-rose-100/50 hover:shadow-xs active:scale-98 dark:border-rose-900/40 dark:bg-rose-950/20 dark:hover:border-rose-700"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-rose-200 px-1.5 py-0.2 text-[10px] font-black text-rose-900 dark:bg-rose-800 dark:text-rose-100">
                  S1
                </span>
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  {t("registrar.scenario_double")}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-rose-700/80 dark:text-rose-300/80">
                {lang === "bn"
                  ? "প্লট ১ • দ্বৈত বিক্রয় অপচেষ্টা • প্রত্যাশিত: রুল R1 বাতিল (409)"
                  : "Plot 1 • Seller 1 reselling • Expect 409 Block (R1)"}
              </p>
            </div>
            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
              →
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleLoadScenario("stranger")}
            className="flex items-center justify-between rounded-xl border border-amber-200/80 bg-amber-50/50 p-2.5 text-left transition-all duration-200 hover:scale-[1.02] hover:border-amber-400 hover:bg-amber-100/50 hover:shadow-xs active:scale-98 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:border-amber-700"
          >
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded bg-amber-200 px-1.5 py-0.2 text-[10px] font-black text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                  S2
                </span>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {t("registrar.scenario_stranger")}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-amber-700/80 dark:text-amber-300/80">
                {lang === "bn"
                  ? "প্লট ২ • স্বত্বহীন ব্যক্তি • প্রত্যাশিত: রুল R2 বাতিল (409)"
                  : "Plot 2 • Seller 99 not owner • Expect 409 Block (R2)"}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              →
            </span>
          </button>
        </div>
      </div>

      {/* RESULT STATE A: PRE-REGISTRATION FRAUD BLOCKED (HTTP 409) */}
      {fraudReport && (
        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-rose-500 bg-rose-50/90 shadow-xl shadow-rose-500/10 dark:border-rose-600 dark:bg-rose-950/40 animate-alert-banner">
          <div className="bg-rose-600 px-6 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs text-white">
                <svg
                  className="h-6 w-6 animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">
                  {t("registrar.fraud_blocked_title")}
                </h3>
                <span className="inline-block rounded bg-rose-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-100">
                  {t("registrar.fraud_blocked_badge")}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black tracking-tight">
                {fraudReport.score} / 100
              </span>
              <p className="text-[11px] font-bold text-rose-100 uppercase">
                {fraudReport.level}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              {t("registrar.fraud_blocked_desc")}
            </p>

            <div className="rounded-xl border border-rose-200 bg-white/80 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 mb-2">
                {t("registrar.fraud_findings")}
              </h4>
              <div className="space-y-3">
                {fraudReport.findings
                  ?.filter((f) => f.severity === "CRITICAL" || f.decisive)
                  .map((finding, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 dark:border-rose-900/80 dark:bg-rose-900/20 dark:text-rose-200"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-rose-700 dark:text-rose-300">
                          [{finding.rule_id}] {finding.title || "CRITICAL RULE VIOLATION"}
                        </span>
                        <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                          CRITICAL
                        </span>
                      </div>
                      {finding.text && (
                        <p className="text-rose-800 dark:text-rose-300 font-medium mt-1">
                          {finding.text}
                        </p>
                      )}
                      {finding.reasons && finding.reasons.length > 0 && (
                        <ul className="mt-2 list-disc list-inside space-y-1 text-rose-700 dark:text-rose-300">
                          {finding.reasons.map((r, rIdx) => (
                            <li key={rIdx}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-xs text-rose-700 dark:text-rose-300 italic">
                🛡️ Zero Ledger Impact: No digital signature or sequential deed number was granted.
              </p>
              <button
                type="button"
                onClick={handleResetForm}
                className="w-full sm:w-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition dark:bg-rose-700 dark:hover:bg-rose-600"
              >
                Clear & Modify Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULT STATE B: SUCCESS (HTTP 201) */}
      {successData && (
        <div className="mb-8 overflow-hidden rounded-2xl border-2 border-emerald-500 bg-emerald-50/80 shadow-xl shadow-emerald-500/10 dark:border-emerald-600 dark:bg-emerald-950/30 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-emerald-600 px-6 py-4 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs text-white">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight">
                  {t("registrar.success_title")}
                </h3>
                <span className="inline-block rounded bg-emerald-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  {t("registrar.success_badge")}
                </span>
              </div>
            </div>
            <StatusBadge status="VALID" />
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Deed Metadata Details */}
              <div className="lg:col-span-2 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-emerald-200 bg-white/90 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      {t("registrar.deed_no_label")}
                    </span>
                    <p className="mt-1 font-mono text-xl font-extrabold text-slate-900 dark:text-white">
                      {successData.deed.deed_no}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-white/90 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      {t("registrar.registered_at")}
                    </span>
                    <p className="mt-1 font-mono text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {new Date(successData.deed.registered_at).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-white/90 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40 text-xs space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-b border-emerald-100 pb-2 dark:border-emerald-900/40">
                    <div>
                      <span className="text-slate-500">Plot ID:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        #{successData.deed.plot_id}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Area Sold:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {successData.deed.area_sold} decimals
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Deed Type:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {successData.deed.deed_type}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Sub-Registry:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {successData.deed.sub_registry}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-slate-500">Seller:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {successData.deed.seller_name || `Person #${successData.deed.seller_id}`}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">Buyer:</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {successData.deed.buyer_name || `Person #${successData.deed.buyer_id}`}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className="text-slate-500">
                      {lang === "bn" ? "দলিলের ডিজিটাল হ্যাশ (SHA-256):" : "SHA-256 Deed Hash:"}
                    </span>
                    <p className="font-mono text-[10px] break-all text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 p-2 rounded-lg mt-0.5">
                      {successData.deed.deed_hash}
                    </p>
                  </div>
                </div>

                {/* Mutation Action Section */}
                <div className="rounded-xl border border-emerald-200 bg-white/90 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/40">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        {lang === "bn" ? "পরবর্তী ধাপ: নামজারি আবেদন" : "Next Step: Mutation Workflow"}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === "bn"
                          ? "এই নিবন্ধিত দলিলের ভিত্তিতে সহকারী কমিশনার (ভূমি) এর নামজারি পরিক্রমা শুরু করুন"
                          : "Initiate AC Land officer workflow from this registered deed"}
                      </p>
                    </div>

                    {mutationSuccess ? (
                      <div className="flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200">
                        <span>✓ {lang === "bn" ? `নামজারি #${mutationSuccess.id} (${mutationSuccess.state})` : `Mutation #${mutationSuccess.id} (${mutationSuccess.state})`}</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartMutation}
                        disabled={mutationStarting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-500 transition disabled:opacity-50"
                      >
                        {mutationStarting ? (
                          <>
                            <Spinner size="sm" />
                            <span>Starting Mutation...</span>
                          </>
                        ) : (
                          <span>{t("registrar.mutation_btn")}</span>
                        )}
                      </button>
                    )}
                  </div>

                  {mutationError && (
                    <p className="mt-2 text-xs text-rose-600 font-medium">
                      {mutationError}
                    </p>
                  )}
                </div>
              </div>

              {/* QR Code Column */}
              <div className="rounded-xl border border-emerald-200 bg-white/90 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/40 flex flex-col items-center justify-center text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-200 mb-1">
                  {t("registrar.qr_title")}
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-3">
                  {t("registrar.qr_desc")}
                </p>

                <div className="relative flex h-48 w-48 items-center justify-center rounded-2xl border-2 border-dashed border-emerald-300 bg-white p-3 shadow-inner dark:border-emerald-800 dark:bg-white">
                  {qrLoading ? (
                    <Spinner size="md" />
                  ) : qrBlobUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={qrBlobUrl}
                      alt={`QR code for deed ${successData.deed.deed_no}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <p className="text-xs text-slate-400">QR code unavailable</p>
                  )}
                </div>

                <div className="mt-4 flex flex-col w-full gap-2">
                  {qrBlobUrl && (
                    <a
                      href={qrBlobUrl}
                      download={`deed-${successData.deed.deed_no}-qr.png`}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 transition dark:bg-emerald-700 dark:hover:bg-emerald-600"
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      <span>{t("registrar.download_qr")}</span>
                    </a>
                  )}

                  <Link
                    href={`/verify?deed=${encodeURIComponent(successData.deed.deed_no)}`}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    <span>{t("registrar.verify_deed_link")}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="mt-1 text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                  >
                    {t("registrar.register_another")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Registration Form */}
      <Card
        title={t("registrar.form_title")}
        subtitle="Mandatory cryptographic land deed entry per Bangladesh Registration Act"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <ErrorBox
              title={lang === "bn" ? "তথ্য যাচাই ত্রুটি" : "Validation Error"}
              message={formError}
            />
          )}

          {/* 1. PLOT SEARCH & SELECT */}
          <div className="relative">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              1. {t("registrar.plot_select_label")} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={plotQuery}
                onChange={(e) => handlePlotSearch(e.target.value)}
                onFocus={() => {
                  if (plotResults.length > 0) setShowPlotDropdown(true);
                }}
                placeholder={t("registrar.plot_search_placeholder")}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-950"
              />
              {plotSearching && (
                <div className="absolute right-3 top-3">
                  <Spinner size="sm" />
                </div>
              )}
            </div>

            {/* Plot Suggestions Dropdown */}
            {showPlotDropdown && plotResults.length > 0 && (
              <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                {plotResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectPlot(p)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        Dag #{p.dag_no} • Mouza: {p.mouza}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Upazila: {p.upazila}, District: {p.district} • {p.area_decimal} decimals
                      </p>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      Plot #{p.id}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Selected Plot Preview Pill */}
            {selectedPlot && (
              <div className="mt-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/60 p-3 text-xs dark:border-emerald-900/60 dark:bg-emerald-950/20">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-emerald-950 dark:text-emerald-100">
                      {lang === "bn"
                        ? `✓ নির্বাচিত প্লট #${toBnDigits(selectedPlot.id)}: দাগ ${toBnDigits(selectedPlot.dag_no)}, মৌজা ${selectedPlot.mouza}`
                        : `✓ Selected Plot #${selectedPlot.id}: Dag ${selectedPlot.dag_no}, Mouza ${selectedPlot.mouza}`}
                    </span>
                    <p className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
                      {lang === "bn" ? (
                        <>
                          প্লট মোট: <strong>{toBnDigits(selectedPlot.area_decimal)} শতক</strong> • অবশিষ্ট প্রাপ্য:{" "}
                          <strong className="text-emerald-700 dark:text-emerald-400 font-bold">
                            {toBnDigits(selectedPlot.remaining_decimal !== undefined ? selectedPlot.remaining_decimal : selectedPlot.area_decimal)} শতক
                          </strong>{" "}
                          {(selectedPlot.sold_decimal ?? 0) > 0 && (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              (বিক্রীত: {toBnDigits(selectedPlot.sold_decimal)} শতক)
                            </span>
                          )}{" "}
                          • রেকর্ডকৃত খতিয়ানদার: <code>{selectedPlot.current_owner_name || selectedPlot.current_owner_masked || "মূল মালিক"}</code>
                        </>
                      ) : (
                        <>
                          Plot Total: <strong>{selectedPlot.area_decimal} decimals</strong> • Available Balance:{" "}
                          <strong className="text-emerald-700 dark:text-emerald-400 font-bold">
                            {selectedPlot.remaining_decimal !== undefined ? selectedPlot.remaining_decimal : selectedPlot.area_decimal} dec
                          </strong>{" "}
                          {(selectedPlot.sold_decimal ?? 0) > 0 && (
                            <span className="text-amber-700 dark:text-amber-400 font-medium">
                              (Sold: {selectedPlot.sold_decimal} dec)
                            </span>
                          )}{" "}
                          • Recorded Owner: <code>{selectedPlot.current_owner_name || selectedPlot.current_owner_masked || "Genesis Owner"}</code>
                        </>
                      )}
                    </p>
                  </div>
                  {selectedPlot.is_khas && (
                    <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-900/60 dark:text-rose-200">
                      KHAS LAND
                    </span>
                  )}
                  {selectedPlot.is_disputed && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                      DISPUTED
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. SELLER & BUYER GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SELLER SELECT */}
            <div className="relative">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                2. {t("registrar.seller_label")} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={sellerQuery}
                  onChange={(e) => handleSellerSearch(e.target.value)}
                  onFocus={() => handleSellerSearch(sellerQuery)}
                  placeholder={t("registrar.seller_placeholder")}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-950"
                />
                {sellerSearching && (
                  <div className="absolute right-3 top-3">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>

              {/* Seller Suggestions */}
              {showSellerDropdown && sellerResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  {sellerResults.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectSeller(person)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {person.display_name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        ID #{person.id}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedSeller && (
                <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  ✓ Selected Seller: {selectedSeller.display_name} (#{selectedSeller.id})
                </p>
              )}
            </div>

            {/* BUYER SELECT */}
            <div className="relative">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                3. {t("registrar.buyer_label")} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={buyerQuery}
                  onChange={(e) => handleBuyerSearch(e.target.value)}
                  onFocus={() => handleBuyerSearch(buyerQuery)}
                  placeholder={t("registrar.buyer_placeholder")}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-950"
                />
                {buyerSearching && (
                  <div className="absolute right-3 top-3">
                    <Spinner size="sm" />
                  </div>
                )}
              </div>

              {/* Buyer Suggestions */}
              {showBuyerDropdown && buyerResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  {buyerResults.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleSelectBuyer(person)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {person.display_name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        ID #{person.id}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedBuyer && (
                <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  ✓ Selected Buyer: {selectedBuyer.display_name} (#{selectedBuyer.id})
                </p>
              )}
            </div>
          </div>

          {/* 3. AREA, DEED TYPE & SUB-REGISTRY */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Area Sold */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                4. {t("registrar.area_sold_label")} *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={areaSold}
                onChange={(e) => setAreaSold(e.target.value)}
                placeholder={t("registrar.area_sold_placeholder")}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-950"
              />
              {selectedPlot && (
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">
                    {lang === "bn" ? "প্লট মোট:" : "Plot total:"} {selectedPlot.area_decimal} dec
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {lang === "bn" ? "অবশিষ্ট প্রাপ্য:" : "Available balance:"}{" "}
                    {selectedPlot.remaining_decimal !== undefined ? selectedPlot.remaining_decimal : selectedPlot.area_decimal} dec
                  </span>
                </div>
              )}
            </div>

            {/* Deed Type */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                5. {t("registrar.deed_type_label")} *
              </label>
              <select
                value={deedType}
                onChange={(e) => setDeedType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-950"
              >
                {meta.deed_types.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-Registry */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                6. {t("registrar.sub_registry_label")} *
              </label>
              <select
                value={subRegistry}
                onChange={(e) => setSubRegistry(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition focus:border-emerald-500 focus:bg-white focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:focus:bg-slate-950"
              >
                {meta.sub_registries.map((sr) => (
                  <option key={sr.code} value={sr.code}>
                    {sr.name} ({sr.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Submit Button */}
          <div className="border-t border-slate-200/80 pt-6 dark:border-slate-800/80">
            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 active:scale-98 disabled:opacity-50 dark:bg-emerald-600 dark:shadow-emerald-950/20 dark:hover:bg-emerald-500"
            >
              {submitting ? (
                <>
                  <Spinner size="sm" />
                  <span>{t("registrar.submitting")}</span>
                </>
              ) : (
                <>
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
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                  <span>{t("registrar.submit_btn")}</span>
                </>
              )}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              {lang === "bn"
                ? "⚡ নিবন্ধন-পূর্ব যাচাই ইঞ্জিন দ্বৈত বিক্রয় ও স্বত্বহীনতা স্বয়ংক্রিয়ভাবে শনাক্ত করে দলিল জারি আটকে দেয়।"
                : "⚡ Pre-registration verification engine checks for double-selling and title conflicts before issuance."}
            </p>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function RegistrarPage() {
  return (
    <ProtectedRoute allowedRoles={["registrar", "admin"]}>
      <RegistrarPageContent />
    </ProtectedRoute>
  );
}
