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
  normalizeBnDigits,
  searchPersons,
  searchPlots,
  startMutation,
  verifyDeed,
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
function getRuleTitle(ruleId?: string, subCode?: string, lang: string = "bn"): string {
  if (lang !== "bn") return "CRITICAL RULE VIOLATION";
  const r = (ruleId || "").toUpperCase();
  const sc = (subCode || "").toUpperCase();
  if (r.includes("R1") || sc.includes("DOUBLE_SALE") || sc.includes("OVERSOLD")) {
    return sc.includes("OVERSOLD")
      ? "জমির পরিমাণ সীমার অতিরিক্ত (নিয়ম ১ লঙ্ঘন)"
      : "দ্বৈত বিক্রয় বা প্রতারণা প্রতিরোধ (নিয়ম ১ লঙ্ঘন)";
  }
  if (r.includes("R2") || sc.includes("NOT_OWNER") || sc.includes("STRANGER")) {
    return "স্বত্বহীন বিক্রেতা প্রতিরোধ (নিয়ম ২ লঙ্ঘন)";
  }
  if (r.includes("R3") || sc.includes("MISSING_MUTATION")) {
    return "বকেয়া নামজারিজনিত জটিলতা (নিয়ম ৩ লঙ্ঘন)";
  }
  if (r.includes("R4") || sc.includes("RAPID_TRANSFERS")) {
    return "অস্বাভাবিক দ্রুত হস্তান্তর (নিয়ম ৪ লঙ্ঘন)";
  }
  if (r.includes("R5") || sc.includes("INTEGRITY")) {
    return "ক্রিপ্টোগ্রাফিক সুরক্ষা বা চেইন ত্রুটি (নিয়ম ৫ লঙ্ঘন)";
  }
  if (r.includes("R6") || sc.includes("FLAGGED_LAND")) {
    return "সংরক্ষিত বা বিরোধপূর্ণ জমি (নিয়ম ৬ লঙ্ঘন)";
  }
  return "সংকটপূর্ণ নীতি লঙ্ঘন";
}

function translateReason(reason: string, lang: string = "bn"): string {
  if (!reason) return "";
  if (lang !== "bn") return reason;

  const r = reason.toUpperCase();
  if (r.includes("R1_DOUBLE_SALE") || (r.includes("DOUBLE") && r.includes("SALE"))) {
    return "দ্বৈত বিক্রয়ের আশঙ্কা: বিক্রেতা আগেই অন্য দলিলে এই জমি বিক্রি করেছেন (পূর্বে অনিষ্পন্ন নামজারি বিদ্যমান)। হস্তান্তরের জন্য পর্যাপ্ত অবশিষ্ট লেজার স্বত্ব নেই।";
  }
  if (r.includes("R1_OVERSOLD") || r.includes("OVERSOLD")) {
    return "অতিরিক্ত বিক্রয়ের আশঙ্কা: হস্তান্তরিত জমির পরিমাণ দাগের মোট জমি বা বিক্রেতার প্রাপ্য অংশের চেয়ে বেশি।";
  }
  if (r.includes("R2_SELLER_NOT_OWNER") || (r.includes("NOT") && r.includes("OWNER")) || r.includes("STRANGER")) {
    return "স্বত্বহীন বিক্রেতা: বিক্রেতা এই দাগের রেকর্ডকৃত মালিক নন এবং লেজারেও তার কোনো জমির স্বত্ব নেই।";
  }
  if (r.includes("R3_MISSING_MUTATION") || r.includes("MUTATION")) {
    return "বকেয়া নামজারি: ৯০ দিনের বেশি সময় পূর্বে রেজিস্ট্রি হওয়া দলিলে এখনও নামজারি সম্পন্ন হয়নি।";
  }
  if (r.includes("R4_RAPID_TRANSFERS") || r.includes("RAPID")) {
    return "অস্বাভাবিক দ্রুত হস্তান্তর: ৩০ দিনের মধ্যে এই দাগে অস্বাভাবিক সংখ্যক মালিকানা হস্তান্তর ঘটেছে।";
  }
  if (r.includes("R5") || r.includes("HASH_MISMATCH") || r.includes("SIGNATURE") || r.includes("INTEGRITY")) {
    return "ক্রিপ্টোগ্রাফিক সুরক্ষা ত্রুটি: দলিলে পরিবর্তন, ভুয়া ডিজিটাল স্বাক্ষর অথবা লেজার চেইনে অসঙ্গতি সনাক্ত হয়েছে।";
  }
  if (r.includes("R6") || r.includes("FLAGGED") || r.includes("KHAS") || r.includes("DISPUTED")) {
    return "সংরক্ষিত জমি: দাগটি সরকারি খাস/অধিগ্রহণকৃত অথবা আদালতে সক্রিয় মামলা রয়েছে।";
  }

  return toBnDigits(reason);
}

function translateFindingText(text: string, ruleId?: string, subCode?: string, lang: string = "bn"): string {
  if (!text) return "";
  if (lang !== "bn") return text;

  const r = (ruleId || "").toUpperCase();
  const sc = (subCode || "").toUpperCase();
  if (r.includes("R1") || sc.includes("DOUBLE_SALE") || sc.includes("OVERSOLD")) {
    return "দ্বৈত বিক্রয় বা প্রতারণার আশঙ্কা। বিক্রেতা আগেই অন্য দলিলে এই জমি বিক্রি করেছেন।";
  }
  if (r.includes("R2") || sc.includes("NOT_OWNER") || sc.includes("STRANGER")) {
    return "বিক্রেতা খতিয়ানভুক্ত মালিক নন এবং দলিল লেজারেও তার কোনো জমির রেকর্ড নেই।";
  }
  if (r.includes("R3") || sc.includes("MISSING_MUTATION")) {
    return "৯০ দিনের বেশি সময় পূর্বে রেজিস্ট্রি হওয়া দলিলে এখনও নামজারি (খতিয়ান সংশোধন) সম্পন্ন হয়নি।";
  }
  if (r.includes("R4") || sc.includes("RAPID_TRANSFERS")) {
    return "অস্বাভাবিক দ্রুত হস্তান্তর। এই দাগে ৩০ দিনের মধ্যে ৩টি বা ততোধিক দলিলের মাধ্যমে মালিকানা বদল হয়েছে।";
  }
  if (r.includes("R5") || sc.includes("INTEGRITY")) {
    return "ক্রিপ্টোগ্রাফিক সুরক্ষা ত্রুটি। দলিলে পরিবর্তন, ভুয়া ডিজিটাল স্বাক্ষর অথবা লেজার চেইনে অসঙ্গতি সনাক্ত হয়েছে।";
  }
  if (r.includes("R6") || sc.includes("FLAGGED_LAND")) {
    return "বিরোধপূর্ণ বা সংরক্ষিত জমি। দাগটি সরকারি খাস/অধিগ্রহণকৃত অথবা আদালতে সক্রিয় মামলা রয়েছে।";
  }
  return toBnDigits(text);
}

function translateRiskLevel(level: string, lang: string = "bn"): string {
  if (lang !== "bn") return level;
  switch (level?.toUpperCase()) {
    case "CRITICAL":
      return "সংকটপূর্ণ";
    case "HIGH":
      return "উচ্চ ঝুঁকি";
    case "MEDIUM":
      return "মাঝারি ঝুঁকি";
    case "LOW":
      return "নিম্ন ঝুঁকি";
    default:
      return level;
  }
}

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
  const [fraudModalOpen, setFraudModalOpen] = useState(false);
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".plot-search-container")) {
        setShowPlotDropdown(false);
      }
      if (!target.closest(".seller-search-container")) {
        setShowSellerDropdown(false);
      }
      if (!target.closest(".buyer-search-container")) {
        setShowBuyerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Canonical scenario configuration for registrar benchmark testing
  const REGISTRAR_SCENARIOS = {
    clean: {
      id: "S6",
      fallbackPlotId: 6,
      canonicalDeed: "DHAKA-2026-000011",
      mouza: "নদীয়া",
      dagNo: "101",
      sellerId: 16,
      sellerName: "আনিস বিশ্বাস (Anis Biswas)",
      buyerId: 99,
      buyerName: "ওয়াহিদুল ভূঁইয়া (Wahidul Bhuiyan)",
      area: "10.0",
      deedType: "SALE",
      subRegistry: "MIR",
    },
    double: {
      id: "S1",
      fallbackPlotId: 1,
      canonicalDeed: "DHAKA-2026-000002",
      mouza: "রূপনগর",
      dagNo: "101",
      sellerId: 1,
      sellerName: "মোহাম্মদ রহমান (Mohammad Rahman)",
      buyerId: 99,
      buyerName: "ওয়াহিদুল ভূঁইয়া (Wahidul Bhuiyan)",
      area: "30.0",
      deedType: "SALE",
      subRegistry: "MIR",
    },
    stranger: {
      id: "S2",
      fallbackPlotId: 2,
      canonicalDeed: "DHAKA-2026-000003",
      mouza: "শান্তিনগর",
      dagNo: "101",
      sellerId: 99,
      sellerName: "ওয়াহিদুল ভূঁইয়া (Stranger Seller)",
      buyerId: 20,
      buyerName: "রাশেদ মোল্লা (Rashed Molla)",
      area: "15.0",
      deedType: "SALE",
      subRegistry: "MIR",
    },
  };

  // Resilient plot resolver against DB sequence drift
  const resolveRegistrarPlot = async (
    cfg: (typeof REGISTRAR_SCENARIOS)[keyof typeof REGISTRAR_SCENARIOS]
  ): Promise<PlotOut> => {
    // 1. Try direct ID
    try {
      const p = await getPlot(cfg.fallbackPlotId);
      if (p) return p;
    } catch {
      // Sequence drift on Render / live server
    }

    // 2. Try canonical deed lookup (returns true live plot_id)
    if (cfg.canonicalDeed) {
      try {
        const v = await verifyDeed(cfg.canonicalDeed);
        if (v && v.plot_id) {
          const p = await getPlot(v.plot_id);
          if (p) return p;
        }
      } catch {
        // continue
      }
    }

    // 3. Try mouza + dag lookup
    if (cfg.mouza && cfg.dagNo) {
      try {
        const plots = await searchPlots(cfg.mouza, cfg.dagNo);
        if (plots && plots.length > 0) return plots[0];
      } catch {
        // continue
      }
    }

    // 4. Safe fallback object
    return {
      id: cfg.fallbackPlotId,
      dag_no: cfg.dagNo,
      mouza: cfg.mouza,
      upazila: "মেঘনা",
      district: "ঢাকা",
      area_decimal: parseFloat(cfg.area) * 2,
      remaining_decimal: parseFloat(cfg.area),
      sold_decimal: 0,
      land_type: "residential",
      flags: [],
      initial_owner_id: cfg.sellerId,
      current_owner_id: cfg.sellerId,
      initial_owner_name: cfg.sellerName,
      current_owner_name: cfg.sellerName,
    };
  };

  // Handle Plot Search
  const handlePlotSearch = async (rawQuery: string) => {
    setPlotQuery(rawQuery);
    setPlotSearching(true);
    setShowPlotDropdown(true);

    const trimmed = rawQuery.trim();
    const norm = normalizeBnDigits(trimmed);

    try {
      if (!trimmed) {
        // Empty query: load available plots on focus/click so user can select immediately
        const results = await searchPlots();
        setPlotResults(results.slice(0, 15));
        return;
      }

      // 1. Check if numeric: Dag number or Plot ID
      if (/^\d+$/.test(norm)) {
        const num = parseInt(norm, 10);

        // Search by Dag number first
        const dagResults = await searchPlots(undefined, norm);
        if (dagResults && dagResults.length > 0) {
          setPlotResults(dagResults.slice(0, 15));
          return;
        }

        // Direct plot ID lookup
        try {
          const directPlot = await getPlot(num);
          if (directPlot) {
            setPlotResults([directPlot]);
            return;
          }
        } catch {
          // fall through
        }

        // Check benchmark scenario plot
        const matchedCfg = Object.values(REGISTRAR_SCENARIOS).find(
          (c) => c.fallbackPlotId === num
        );
        if (matchedCfg) {
          try {
            const resolved = await resolveRegistrarPlot(matchedCfg);
            if (resolved) {
              setPlotResults([resolved]);
              return;
            }
          } catch {
            // fall through
          }
        }
      }

      // 2. Query like "Plot 6", "Dag 101", "প্লট ৬", "দাগ ১০১"
      const matchPlotOrDag = norm.match(/(?:plot|dag|প্লট|দাগ)\s*#?\s*(\d+)/i);
      if (matchPlotOrDag) {
        const n = matchPlotOrDag[1];
        const dagResults = await searchPlots(undefined, n);
        if (dagResults && dagResults.length > 0) {
          setPlotResults(dagResults.slice(0, 15));
          return;
        }
        try {
          const p = await getPlot(parseInt(n, 10));
          if (p) {
            setPlotResults([p]);
            return;
          }
        } catch {
          // fall through
        }
      }

      // 3. Otherwise search by mouza
      const results = await searchPlots(trimmed);
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
    setPlotQuery(
      lang === "bn"
        ? `দাগ #${toBnDigits(p.dag_no)} - মৌজা ${p.mouza} (প্লট #${toBnDigits(p.id)})`
        : `Dag #${p.dag_no} - Mouza ${p.mouza} (Plot #${p.id})`
    );
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
    setSellerQuery(
      lang === "bn"
        ? `${person.display_name} (আইডি #${toBnDigits(person.id)})`
        : `${person.display_name} (#${person.id})`
    );
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
    setBuyerQuery(
      lang === "bn"
        ? `${person.display_name} (আইডি #${toBnDigits(person.id)})`
        : `${person.display_name} (#${person.id})`
    );
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

    const cfg = REGISTRAR_SCENARIOS[scenarioType];
    if (!cfg) return;

    try {
      const p = await resolveRegistrarPlot(cfg);
      handleSelectPlot(p);

      // Determine seller
      let sellerPerson: PersonOut | null = null;
      const actualSellerId =
        scenarioType === "clean" ? p.current_owner_id ?? cfg.sellerId : cfg.sellerId;
      const sellerDisplayName =
        scenarioType === "clean" && (p.current_owner_name || p.current_owner_masked)
          ? p.current_owner_name || p.current_owner_masked || cfg.sellerName
          : cfg.sellerName;

      try {
        const persons = await searchPersons(String(actualSellerId), 5);
        sellerPerson = persons.find((x) => x.id === actualSellerId) || null;
      } catch {
        // fallback
      }

      if (!sellerPerson) {
        sellerPerson = {
          id: actualSellerId,
          display_name: sellerDisplayName,
          is_synthetic: true,
        };
      }
      handleSelectSeller(sellerPerson);

      // Determine buyer
      let buyerPerson: PersonOut | null = null;
      try {
        const buyers = await searchPersons(String(cfg.buyerId), 5);
        buyerPerson = buyers.find((x) => x.id === cfg.buyerId) || null;
      } catch {
        // fallback
      }

      if (!buyerPerson) {
        buyerPerson = {
          id: cfg.buyerId,
          display_name: cfg.buyerName,
          is_synthetic: true,
        };
      }
      handleSelectBuyer(buyerPerson);

      setAreaSold(cfg.area);
      setDeedType(cfg.deedType);
      setSubRegistry(cfg.subRegistry);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError(t("common.error"));
      }
    }
  };

  // Submit Deed Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFraudReport(null);
    setFraudModalOpen(false);
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
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }

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
          setFraudModalOpen(true);
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
    setFraudModalOpen(false);
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
                  {lang === "bn" ? "দৃশ্যকল্প ৬" : "S6"}
                </span>
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                  {t("registrar.scenario_clean")}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
                {lang === "bn"
                  ? "প্লট ৬ • প্রকৃত খতিয়ানদার • প্রত্যাশিত: বৈধ নিবন্ধন (২০১)"
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
                  {lang === "bn" ? "দৃশ্যকল্প ১" : "S1"}
                </span>
                <span className="text-xs font-bold text-rose-900 dark:text-rose-200">
                  {t("registrar.scenario_double")}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-rose-700/80 dark:text-rose-300/80">
                {lang === "bn"
                  ? "প্লট ১ • দ্বৈত বিক্রয় অপচেষ্টা • প্রত্যাশিত: নিয়ম ১ বাতিল (৪০৯)"
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
                  {lang === "bn" ? "দৃশ্যকল্প ২" : "S2"}
                </span>
                <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                  {t("registrar.scenario_stranger")}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] text-amber-700/80 dark:text-amber-300/80">
                {lang === "bn"
                  ? "প্লট ২ • স্বত্বহীন ব্যক্তি • প্রত্যাশিত: নিয়ম ২ বাতিল (৪০৯)"
                  : "Plot 2 • Seller 99 not owner • Expect 409 Block (R2)"}
              </p>
            </div>
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
              →
            </span>
          </button>
        </div>
      </div>

      {/* POP-UP MODAL: PRE-REGISTRATION FRAUD BLOCKED (HTTP 409) */}
      {fraudReport && fraudModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setFraudModalOpen(false);
            }
          }}
        >
          <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border-2 border-rose-500 bg-white shadow-2xl shadow-rose-950/40 dark:border-rose-600 dark:bg-slate-900 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-rose-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs text-white">
                  <svg
                    className="h-7 w-7 animate-pulse"
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
                    {lang === "bn"
                      ? "নিবন্ধন বাতিল: সম্ভাব্য ভূমি জালিয়াতি শনাক্ত!"
                      : t("registrar.fraud_blocked_title")}
                  </h3>
                  <span className="inline-block rounded bg-rose-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-100">
                    {lang === "bn"
                      ? "জালিয়াতি প্রতিরোধ (বাতিলকৃত)"
                      : t("registrar.fraud_blocked_badge")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-2xl font-black tracking-tight">
                    {lang === "bn"
                      ? `${toBnDigits(fraudReport.score)} / ${toBnDigits(100)}`
                      : `${fraudReport.score} / 100`}
                  </span>
                  <p className="text-[11px] font-bold text-rose-100 uppercase">
                    {translateRiskLevel(fraudReport.level, lang)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFraudModalOpen(false)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/25 text-white font-bold transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
                {lang === "bn"
                  ? "স্বয়ংক্রিয় জালিয়াতি শনাক্তকরণ ব্যবস্থা এই দলিলটি নিবন্ধন আটকে দিয়েছে। ডাটাবেজ বা লেজারে কোনো রেকর্ড বা দলিল নম্বর তৈরি হয়নি।"
                  : t("registrar.fraud_blocked_desc")}
              </p>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 mb-2">
                  {lang === "bn" ? "শনাক্তকৃত নিয়ম লঙ্ঘনসমূহ:" : t("registrar.fraud_findings")}
                </h4>
                <div className="space-y-3">
                  {fraudReport.findings
                    ?.filter((f) => f.severity === "CRITICAL" || f.decisive)
                    .map((finding, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-rose-200 bg-white p-3 text-xs text-rose-900 dark:border-rose-900/80 dark:bg-rose-900/20 dark:text-rose-200 shadow-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-rose-700 dark:text-rose-300">
                            {lang === "bn"
                              ? `[নিয়ম ${toBnDigits(finding.rule_id?.replace(/^R/i, "")) || finding.rule_id}] ${getRuleTitle(finding.rule_id, finding.sub_code, lang)}`
                              : `[${finding.rule_id}] ${finding.title || "CRITICAL RULE VIOLATION"}`}
                          </span>
                          <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {translateRiskLevel(finding.severity || "CRITICAL", lang)}
                          </span>
                        </div>
                        {finding.text && (
                          <p className="text-rose-800 dark:text-rose-300 font-medium mt-1">
                            {translateFindingText(finding.text, finding.rule_id, finding.sub_code, lang)}
                          </p>
                        )}
                        {finding.reasons && finding.reasons.length > 0 && (
                          <ul className="mt-2 list-disc list-inside space-y-1 text-rose-700 dark:text-rose-300">
                            {finding.reasons.map((r, rIdx) => (
                              <li key={rIdx}>{translateReason(r, lang)}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                </div>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                <p className="font-medium">
                  {lang === "bn"
                    ? "🛡️ লেজারে কোনো প্রভাব নেই: কোনো ডিজিটাল স্বাক্ষর বা ক্রমিক দলিল নম্বর জারি করা হয়নি। ভূমি রেকর্ড শতভাগ অপরিবর্তনীয় ও সুরক্ষিত রয়েছে।"
                    : "🛡️ Zero Ledger Impact: No digital signature or sequential deed number was granted. The ledger remains intact."}
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 px-6 py-3 flex flex-col sm:flex-row items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setFraudModalOpen(false)}
                className="w-full sm:w-auto rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {lang === "bn" ? "পপ-আপ বন্ধ করুন" : "Close Pop-up"}
              </button>
              <button
                type="button"
                onClick={() => {
                  handleResetForm();
                  setFraudModalOpen(false);
                }}
                className="w-full sm:w-auto rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition shadow-xs"
              >
                {lang === "bn" ? "আবেদন সংশোধন ও নতুন করে শুরু" : "Clear & Modify Application"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INLINE ALERT CARD: PRE-REGISTRATION FRAUD BLOCKED (HTTP 409) */}
      {fraudReport && !fraudModalOpen && (
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
                  {lang === "bn"
                    ? "নিবন্ধন বাতিল: সম্ভাব্য ভূমি জালিয়াতি শনাক্ত!"
                    : t("registrar.fraud_blocked_title")}
                </h3>
                <span className="inline-block rounded bg-rose-800/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-100">
                  {lang === "bn"
                    ? "জালিয়াতি প্রতিরোধ (বাতিলকৃত)"
                    : t("registrar.fraud_blocked_badge")}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black tracking-tight">
                {lang === "bn"
                  ? `${toBnDigits(fraudReport.score)} / ${toBnDigits(100)}`
                  : `${fraudReport.score} / 100`}
              </span>
              <p className="text-[11px] font-bold text-rose-100 uppercase">
                {translateRiskLevel(fraudReport.level, lang)}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              {lang === "bn"
                ? "স্বয়ংক্রিয় জালিয়াতি শনাক্তকরণ ব্যবস্থা এই দলিলটি নিবন্ধন আটকে দিয়েছে। ডাটাবেজ বা লেজারে কোনো রেকর্ড বা দলিল নম্বর তৈরি হয়নি।"
                : t("registrar.fraud_blocked_desc")}
            </p>

            <div className="rounded-xl border border-rose-200 bg-white/80 p-4 dark:border-rose-900/60 dark:bg-rose-950/30">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 dark:text-rose-300 mb-2">
                {lang === "bn" ? "শনাক্তকৃত নিয়ম লঙ্ঘনসমূহ:" : t("registrar.fraud_findings")}
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
                        <span className="font-bold text-rose-700 dark:text-rose-300">
                          {lang === "bn"
                            ? `[নিয়ম ${toBnDigits(finding.rule_id?.replace(/^R/i, "")) || finding.rule_id}] ${getRuleTitle(finding.rule_id, finding.sub_code, lang)}`
                            : `[${finding.rule_id}] ${finding.title || "CRITICAL RULE VIOLATION"}`}
                        </span>
                        <span className="rounded bg-rose-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                          {translateRiskLevel(finding.severity || "CRITICAL", lang)}
                        </span>
                      </div>
                      {finding.text && (
                        <p className="text-rose-800 dark:text-rose-300 font-medium mt-1">
                          {translateFindingText(finding.text, finding.rule_id, finding.sub_code, lang)}
                        </p>
                      )}
                      {finding.reasons && finding.reasons.length > 0 && (
                        <ul className="mt-2 list-disc list-inside space-y-1 text-rose-700 dark:text-rose-300">
                          {finding.reasons.map((r, rIdx) => (
                            <li key={rIdx}>{translateReason(r, lang)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-xs text-rose-700 dark:text-rose-300 italic">
                {lang === "bn"
                  ? "🛡️ লেজারে কোনো প্রভাব নেই: কোনো ডিজিটাল স্বাক্ষর বা ক্রমিক দলিল নম্বর জারি করা হয়নি।"
                  : "🛡️ Zero Ledger Impact: No digital signature or sequential deed number was granted."}
              </p>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setFraudModalOpen(true)}
                  className="w-full sm:w-auto rounded-xl border border-rose-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 transition dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200 shadow-2xs"
                >
                  {lang === "bn" ? "পপ-আপে দেখুন" : "View as Pop-up"}
                </button>
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="w-full sm:w-auto rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 transition dark:bg-rose-700 dark:hover:bg-rose-600 shadow-2xs"
                >
                  {lang === "bn" ? "আবেদন সংশোধন ও রিসেট করুন" : "Clear & Modify Application"}
                </button>
              </div>
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
                      <span className="text-slate-500">{lang === "bn" ? "প্লট আইডি:" : "Plot ID:"}</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        #{lang === "bn" ? toBnDigits(successData.deed.plot_id) : successData.deed.plot_id}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">{lang === "bn" ? "বিক্রীত জমি:" : "Area Sold:"}</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {lang === "bn" ? `${toBnDigits(successData.deed.area_sold)} শতক` : `${successData.deed.area_sold} decimals`}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">{lang === "bn" ? "দলিলের ধরন:" : "Deed Type:"}</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {successData.deed.deed_type}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">{lang === "bn" ? "সাব-রেজিস্ট্রি:" : "Sub-Registry:"}</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {successData.deed.sub_registry}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-slate-500">{lang === "bn" ? "বিক্রেতা:" : "Seller:"}</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        {successData.deed.seller_name || `Person #${successData.deed.seller_id}`}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500">{lang === "bn" ? "গ্রহীতা:" : "Buyer:"}</span>
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
                        <span>
                          ✓ {lang === "bn"
                            ? `নামজারি #${toBnDigits(mutationSuccess.id)} (${mutationSuccess.state === "SUBMITTED" ? "দাখিলকৃত" : mutationSuccess.state})`
                            : `Mutation #${mutationSuccess.id} (${mutationSuccess.state})`}
                        </span>
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
                            <span>{lang === "bn" ? "নামজারি শুরু হচ্ছে..." : "Starting Mutation..."}</span>
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
                    <p className="text-xs text-slate-400">
                      {lang === "bn" ? "কিউআর কোড প্রস্তুত নয়" : "QR code unavailable"}
                    </p>
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
        subtitle={
          lang === "bn"
            ? "বাংলাদেশ রেজিস্ট্রেশন আইন অনুযায়ী বাধ্যতামূলক ক্রিপ্টোগ্রাফিক দলিল নিবন্ধন"
            : "Mandatory cryptographic land deed entry per Bangladesh Registration Act"
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {formError && (
            <ErrorBox
              title={lang === "bn" ? "তথ্য যাচাই ত্রুটি" : "Validation Error"}
              message={formError}
            />
          )}

          {/* 1. PLOT SEARCH & SELECT */}
          <div className="relative plot-search-container">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
              1. {t("registrar.plot_select_label")} *
            </label>
            <div className="relative">
              <input
                type="text"
                value={plotQuery}
                onChange={(e) => handlePlotSearch(e.target.value)}
                onFocus={() => {
                  setShowPlotDropdown(true);
                  if (plotResults.length === 0) {
                    handlePlotSearch(plotQuery);
                  }
                }}
                onClick={() => {
                  setShowPlotDropdown(true);
                  if (plotResults.length === 0) {
                    handlePlotSearch(plotQuery);
                  }
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelectPlot(p);
                    }}
                    onClick={() => handleSelectPlot(p)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {lang === "bn"
                          ? `দাগ #${toBnDigits(p.dag_no)} • মৌজা: ${p.mouza}`
                          : `Dag #${p.dag_no} • Mouza: ${p.mouza}`}
                      </span>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === "bn"
                          ? `উপজেলা: ${p.upazila}, জেলা: ${p.district} • ${toBnDigits(p.area_decimal)} শতক`
                          : `Upazila: ${p.upazila}, District: ${p.district} • ${p.area_decimal} decimals`}
                      </p>
                    </div>
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {lang === "bn" ? `প্লট #${toBnDigits(p.id)}` : `Plot #${p.id}`}
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
                      {lang === "bn" ? "খাস জমি" : "KHAS LAND"}
                    </span>
                  )}
                  {selectedPlot.is_disputed && (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
                      {lang === "bn" ? "বিরোধপূর্ণ জমি" : "DISPUTED"}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 2. SELLER & BUYER GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SELLER SELECT */}
            <div className="relative seller-search-container">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                2. {t("registrar.seller_label")} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={sellerQuery}
                  onChange={(e) => handleSellerSearch(e.target.value)}
                  onFocus={() => handleSellerSearch(sellerQuery)}
                  onClick={() => handleSellerSearch(sellerQuery)}
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectSeller(person);
                      }}
                      onClick={() => handleSelectSeller(person)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {person.display_name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {lang === "bn" ? `আইডি #${toBnDigits(person.id)}` : `ID #${person.id}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedSeller && (
                <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  {lang === "bn"
                    ? `✓ নির্বাচিত বিক্রেতা: ${selectedSeller.display_name} (#${toBnDigits(selectedSeller.id)})`
                    : `✓ Selected Seller: ${selectedSeller.display_name} (#${selectedSeller.id})`}
                </p>
              )}
            </div>

            {/* BUYER SELECT */}
            <div className="relative buyer-search-container">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1.5">
                3. {t("registrar.buyer_label")} *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={buyerQuery}
                  onChange={(e) => handleBuyerSearch(e.target.value)}
                  onFocus={() => handleBuyerSearch(buyerQuery)}
                  onClick={() => handleBuyerSearch(buyerQuery)}
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
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleSelectBuyer(person);
                      }}
                      onClick={() => handleSelectBuyer(person)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {person.display_name}
                      </span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {lang === "bn" ? `আইডি #${toBnDigits(person.id)}` : `ID #${person.id}`}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {selectedBuyer && (
                <p className="mt-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  {lang === "bn"
                    ? `✓ নির্বাচিত গ্রহীতা: ${selectedBuyer.display_name} (#${toBnDigits(selectedBuyer.id)})`
                    : `✓ Selected Buyer: ${selectedBuyer.display_name} (#${selectedBuyer.id})`}
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
                    {lang === "bn"
                      ? `প্লট মোট: ${toBnDigits(selectedPlot.area_decimal)} শতক`
                      : `Plot total: ${selectedPlot.area_decimal} dec`}
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {lang === "bn"
                      ? `অবশিষ্ট প্রাপ্য: ${toBnDigits(selectedPlot.remaining_decimal !== undefined ? selectedPlot.remaining_decimal : selectedPlot.area_decimal)} শতক`
                      : `Available balance: ${selectedPlot.remaining_decimal !== undefined ? selectedPlot.remaining_decimal : selectedPlot.area_decimal} dec`}
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
                    {lang === "bn"
                      ? dt === "SALE"
                        ? "বিক্রয় (কাবলা)"
                        : dt === "GIFT"
                        ? "হেবা / দানপত্র"
                        : dt === "HEIR"
                        ? "ওয়ারিশান / বণ্টননামা"
                        : dt === "MORTGAGE"
                        ? "বন্ধক"
                        : dt
                      : dt}
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
                    {lang === "bn"
                      ? sr.code === "MIR"
                        ? "মিরপুর সাব-রেজিস্ট্রি অফিস"
                        : sr.code === "DHAKA"
                        ? "ঢাকা সদর সাব-রেজিস্ট্রি অফিস"
                        : sr.code === "SAVAR"
                        ? "সাভার সাব-রেজিস্ট্রি অফিস"
                        : sr.name
                      : `${sr.name} (${sr.code})`}
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
