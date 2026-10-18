"use client";

import React, { Suspense } from "react";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { useLanguage } from "@/lib/i18n";

function RolloutContent() {
  const { lang } = useLanguage();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3.5 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            {lang === "bn"
              ? "জাতীয় পর্যায়ের প্রযুক্তি বাস্তবায়ন পরিকল্পনা"
              : "National Phased Rollout & Economic Feasibility"}
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {lang === "bn"
            ? "জাতীয় রোলআউট কৌশল ও বাজেট মডেল"
            : "National Rollout Strategy & Cost Model"}
        </h1>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          {lang === "bn"
            ? "বাংলাদেশের ৬৪টি জেলা ও ৪৯৫টি উপজেলায় ভূমি-সুরক্ষা (LandShield) বাস্তবায়নের বাস্তবসম্মত রূপরেখা, আর্থিক ব্যয় ও অর্থনৈতিক সাশ্রয় বিশ্লেষণ।"
            : "Actionable roadmap and economic justification for nationwide deployment across all 64 districts and 495 upazilas of Bangladesh."}
        </p>
      </div>

      {/* ROI & Macro Benefit Banner */}
      <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold uppercase tracking-wider backdrop-blur-xs">
              {lang === "bn" ? "অর্থনৈতিক সুফল (Economic Impact)" : "Economic Impact"}
            </span>
            <h2 className="text-xl sm:text-3xl font-extrabold">
              {lang === "bn"
                ? "বছরে আনুমানিক ১২,০০০+ কোটি টাকা সাশ্রয়"
                : "Est. ৳12,000+ Crore Annual Citizen Savings"}
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 leading-relaxed">
              {lang === "bn"
                ? "বাংলাদেশে চলমান দেওয়ানি মামলার ৭৫% এর বেশি ভূমি সংক্রান্ত বিরোধ। ভূমি-সুরক্ষা প্ল্যাটফর্ম জালিয়াতি গোড়াতেই আটকে দিয়ে প্রতি বছর লাখো পরিবারকে আদালতে বছরের পর বছর মামলার খরচ ও হয়রানি থেকে রক্ষা করবে।"
                : "Over 75% of civil court litigation in Bangladesh originates from land disputes. LandShield halts fraudulent conveyances at the source, saving millions of families from decades of legal expenses."}
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 p-5 backdrop-blur-md border border-white/20 text-center shrink-0 w-full sm:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-200">
              {lang === "bn" ? "খরচ বনাম সাশ্রয় অনুপাত" : "ROI Ratio"}
            </span>
            <p className="text-4xl sm:text-5xl font-black mt-1">270:1</p>
            <span className="text-[11px] text-emerald-100 block mt-1">
              {lang === "bn" ? "প্রতি ১ টাকা ব্যয়ে ২৭০ টাকা সাশ্রয়" : "৳270 saved per ৳1 invested"}
            </span>
          </div>
        </div>
      </div>

      {/* 3-Phase National Rollout Roadmap */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-6">
          {lang === "bn" ? "৩-ধাপের জাতীয় বাস্তবায়ন পরিক্রমা" : "3-Phase National Implementation Plan"}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Phase 1 */}
          <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-5 dark:border-teal-900/60 dark:bg-teal-950/20 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-teal-600 px-3 py-1 text-xs font-bold text-white">
                {lang === "bn" ? "পর্যায় ১: পাইলট (৬ মাস)" : "Phase 1: Pilot (6 Mo)"}
              </span>
              <span className="text-xs font-mono font-bold text-teal-800 dark:text-teal-300">
                ৩ উপজেলা
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === "bn" ? "পাইলট বাস্তবায়ন" : "Controlled Pilot"}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {lang === "bn"
                ? "মিরপুর, সাভার এবং গাজীপুর সদর উপজেলায় সাব-রেজিস্ট্রি এবং এসি ল্যান্ড অফিসের ডাটা কানেক্ট করে পাইলট পরীক্ষণ।"
                : "Pilot deployment in Mirpur, Savar, and Gazipur Sadar sub-registry and AC land offices."}
            </p>

            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 pt-2 border-t border-teal-200/60 dark:border-teal-900/40">
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "১৫ জন সাব-রেজিস্ট্রার ও সহকারী প্রশিক্ষণ" : "15 Officers & Staff Trained"}</li>
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "১০০% অনলাইন ও অফলাইন QR টেস্টিং" : "100% Offline QR Testing"}</li>
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "পাইলট মূল্যায়ন রিপোর্ট পেশ" : "Pilot Feedback Integration"}</li>
            </ul>
          </div>

          {/* Phase 2 */}
          <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-5 dark:border-sky-900/60 dark:bg-sky-950/20 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-sky-600 px-3 py-1 text-xs font-bold text-white">
                {lang === "bn" ? "পর্যায় ২: বিভাগীয় (১২ মাস)" : "Phase 2: Division (12 Mo)"}
              </span>
              <span className="text-xs font-mono font-bold text-sky-800 dark:text-sky-300">
                ১৩৭ সাব-রেজিস্ট্রি
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === "bn" ? "ঢাকা ও চট্টগ্রাম বিভাগ" : "Dhaka & Chittagong Divisions"}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {lang === "bn"
                ? "দেশের সর্বাধিক অর্থনৈতিক গুরুত্বসম্পন্ন ঢাকা ও চট্টগ্রাম বিভাগের সকল উপজেলায় পূর্ণাঙ্গ লাইভ রোলআউট।"
                : "Expansion across all high-value urban and peri-urban sub-registries in Dhaka and Chittagong."}
            </p>

            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 pt-2 border-t border-sky-200/60 dark:border-sky-900/40">
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "জাতীয় ক্লাউড ডেটা সেন্টারে সার্ভার ক্লাস্টার" : "Govt Cloud (BCC) Tier-III Cluster"}</li>
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "দলিল লেখক (মুহুরী) প্রশিক্ষণ কর্মসূচি" : "Deed Writer Digital Training"}</li>
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "দৈনিক মারকেল অডিট ট্রেইল চালুকরণ" : "Daily Merkle Root Publishing"}</li>
            </ul>
          </div>

          {/* Phase 3 */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-5 dark:border-indigo-900/60 dark:bg-indigo-950/20 space-y-3 relative">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                {lang === "bn" ? "পর্যায় ৩: দেশব্যাপী (২৪ মাস)" : "Phase 3: National (24 Mo)"}
              </span>
              <span className="text-xs font-mono font-bold text-indigo-800 dark:text-indigo-300">
                ৬৪ জেলা
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === "bn" ? "৬৪ জেলায় পূর্ণাঙ্গ প্রযুক্তি" : "Full Nationwide Deployment"}
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-400">
              {lang === "bn"
                ? "দেশের ৪৯৫টি উপজেলা ও ৫০৫টি সাব-রেজিস্ট্রি অফিসে সম্পূর্ণ পেপারলেস ও ক্রিপ্টোগ্রাফিক যাচাই নিশ্চিতকরণ।"
                : "Universal deployment across all 505 Sub-Registries and 505 AC Land offices in Bangladesh."}
            </p>

            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5 pt-2 border-t border-indigo-200/60 dark:border-indigo-900/40">
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "স্মার্ট ভূমি কার্ডের সাথে ইন্টিগ্রেশন" : "Integration with Smart Land Card"}</li>
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "জাতীয় এনআইডি ও ভূমি খতিয়ান এপিআই" : "Universal NID & Khatian Link"}</li>
              <li className="flex items-center gap-1.5">✓ {lang === "bn" ? "আইনি বৈধতায় গ্যাজেট প্রজ্ঞাপন" : "Statutory Gazette Enactment"}</li>
            </ul>
          </div>
        </div>
      </Card>

      {/* Financial Cost Model Breakdown */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === "bn" ? "জাতীয় বাজেট ও আর্থিক ব্যয় কাঠামো" : "National Budget & Infrastructure Cost Model"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === "bn"
                ? "১ম বছরের প্রাথমিক বাস্তবায়ন ও সার্ভার পরিকাঠামো বাজেট (প্রাক্কলন)"
                : "Estimated Year 1 capital expenditures and operational infrastructure budget"}
            </p>
          </div>

          <span className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-mono font-bold text-emerald-400">
            {lang === "bn" ? "মোট বাজেট: ৳ ৪৫.৫ কোটি" : "Total Budget: ৳ 45.5 Crore (~$3.8M)"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider dark:border-slate-800">
                <th className="py-2.5 px-3">{lang === "bn" ? "খাত / উপখাত" : "Expense Category"}</th>
                <th className="py-2.5 px-3">{lang === "bn" ? "বিবরণ" : "Description"}</th>
                <th className="py-2.5 px-3 text-right">{lang === "bn" ? "প্রাক্কলিত বাজেট" : "Estimated Cost"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                  {lang === "bn" ? "ক্লাউড ও ডেটা সেন্টার অবকাঠামো" : "Govt Cloud Infrastructure"}
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                  {lang === "bn" ? "বাংলাদেশ কম্পিউটার কাউন্সিল (BCC) টায়ার-৩ ডেটা সেন্টারে সার্ভার, স্টোরেজ ও ডিআর সাইট" : "BCC Tier-III Cloud servers, high-availability DB cluster, and disaster recovery site"}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                  ৳ ১২.০ কোটি
                </td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                  {lang === "bn" ? "হার্ডওয়্যার সিকিউরিটি মডিউল (HSM)" : "Hardware Security Modules (HSM)"}
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                  {lang === "bn" ? "FIPS 140-2 লেভেল ৩ সনদপ্রাপ্ত সরকারি মাস্টার কি সাইনিং ডিভাইস ও কী-ম্যানেজমেন্ট" : "FIPS 140-2 Level 3 cryptographic appliance for master signing key protection"}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                  ৳ ৫.৫ কোটি
                </td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                  {lang === "bn" ? "কর্মকর্তা ও কর্মচারী প্রশিক্ষণ" : "Officer & Staff Capacity Building"}
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                  {lang === "bn" ? "৫০৫ সাব-রেজিস্ট্রার, সহকারী কমিশনার (ভূমি) এবং কানুনগোদের হ্যান্ডস-অন প্রশিক্ষণ" : "Hands-on training for 505 Sub-Registrars, AC Land officers, and surveyors"}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                  ৳ ৮.০ কোটি
                </td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                  {lang === "bn" ? "দলিল লেখক ও নাগরিক সচেতনতা" : "Deed Writer & Public Awareness"}
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                  {lang === "bn" ? "সারাদেশের দলিল লেখক সমিতির কর্মশালা এবং প্রাক-ক্রয় যাচাই প্রচার অভিযান" : "Nationwide workshops for deed writers (Mohorrir) & public TV/SMS awareness"}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                  ৳ ১০.০ কোটি
                </td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                  {lang === "bn" ? "সফটওয়্যার রক্ষণাবেক্ষণ ও নিরাপত্তা অডিট" : "Security Audits & Maintenance"}
                </td>
                <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                  {lang === "bn" ? "CERT সাইবার সিকিউরিটি অডিট, বাৎসরিক মেইনটেন্যান্স ও সার্বক্ষণিক মনিটরিং" : "National CERT penetration testing, code auditing, and 24/7 technical monitoring"}
                </td>
                <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                  ৳ ১০.০ কোটি
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Institutional Governance Framework */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-900/80 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          {lang === "bn" ? "প্রাতিষ্ঠানিক অংশীদারিত্ব ও দায়িত্ব বণ্টন" : "Inter-Ministerial Governance Framework"}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">
              {lang === "bn" ? "ভূমি মন্ত্রণালয়" : "Ministry of Land"}
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {lang === "bn"
                ? "খতিয়ান ডাটাবেজ, জরিপ রেকর্ড (CS-SA-RS-BS), এবং সহকারী কমিশনার (ভূমি) অফিসের নামজারি অনুমোদন।"
                : "Custodian of Khatian databases, survey records, and AC Land mutation approvals."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">
              {lang === "bn" ? "আইন ও সংসদ বিষয়ক মন্ত্রণালয়" : "Ministry of Law & Justice"}
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {lang === "bn"
                ? "নিবন্ধন পরিদপ্তর ও সাব-রেজিস্ট্রি অফিসের দলিল রেজিস্ট্রি কার্যক্রম ও ডিজিটাল স্বাক্ষর প্রয়োগ।"
                : "Sub-Registry offices, Directorate of Registration, and statutory deed execution."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 space-y-1">
            <span className="font-bold text-slate-900 dark:text-white block">
              {lang === "bn" ? "আইসিটি বিভাগ ও বিসিসি" : "ICT Division & BCC"}
            </span>
            <p className="text-slate-600 dark:text-slate-400">
              {lang === "bn"
                ? "ক্লাউড ডেটা সেন্টার, ক্রিপ্টোগ্রাফিক রুট সার্টিফিকেট অথরিটি এবং সাইবার সিকিউরিটি প্রটেকশন।"
                : "National Data Center, Root CA infrastructure, and national cybersecurity operations."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RolloutPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <RolloutContent />
    </Suspense>
  );
}
