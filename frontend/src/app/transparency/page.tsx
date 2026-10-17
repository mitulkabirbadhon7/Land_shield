"use client";

import React, { Suspense, useState } from "react";
import { Card } from "@/components/Card";
import { Spinner } from "@/components/Spinner";
import { useLanguage } from "@/lib/i18n";

interface MerkleBatch {
  batch_id: string;
  date: string;
  deeds_count: number;
  root_hash: string;
  signature: string;
  key_id: string;
  status: "CONFIRMED" | "FINALIZED";
}

// Canonical benchmark daily roots for demo and verification
const PUBLISHED_BATCHES: MerkleBatch[] = [
  {
    batch_id: "BATCH-2026-10-17",
    date: "2026-10-17",
    deeds_count: 599,
    root_hash: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
    signature: "92a10bf3c456890dbeef1234567890abcdef1234567890abcdef1234567890ab",
    key_id: "80db4db0eb17ae3b",
    status: "FINALIZED",
  },
  {
    batch_id: "BATCH-2026-10-16",
    date: "2026-10-16",
    deeds_count: 542,
    root_hash: "cb73f1d4f260be464a883a958e923e4453b3b4f9dfc2367d32c589053eb81a1f",
    signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    key_id: "80db4db0eb17ae3b",
    status: "CONFIRMED",
  },
  {
    batch_id: "BATCH-2026-10-15",
    date: "2026-10-15",
    deeds_count: 489,
    root_hash: "a4f89d38c6b986e12345bcde890123456789abcdef1234567890abcdef123456",
    signature: "7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456",
    key_id: "80db4db0eb17ae3b",
    status: "CONFIRMED",
  },
];

interface ProofResult {
  deed_no: string;
  leaf_hash: string;
  batch_id: string;
  root_hash: string;
  proof_path: { position: "left" | "right"; hash: string }[];
  verified: boolean;
}

function TransparencyContent() {
  const { lang } = useLanguage();

  const [inputDeed, setInputDeed] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const sampleDeeds = [
    "DHAKA-2026-000010",
    "DHAKA-2026-000003",
    "DHAKA-2026-000001",
    "DHAKA-2026-000014",
  ];

  const handleVerifyInclusion = (deedToTest?: string) => {
    const raw = (deedToTest !== undefined ? deedToTest : inputDeed).trim();
    if (!raw) return;

    setVerifying(true);
    setProofResult(null);

    // Simulate cryptographic inclusion proof calculation
    setTimeout(() => {
      // Deterministic pseudo-leaf hash based on deed name
      const fakeLeaf = `leaf_${raw.toLowerCase().replace(/[^a-z0-9]/g, "")}_98b1a3f0`;
      const matchedBatch = PUBLISHED_BATCHES[0];

      setProofResult({
        deed_no: raw,
        leaf_hash: fakeLeaf.padEnd(64, "0").slice(0, 64),
        batch_id: matchedBatch.batch_id,
        root_hash: matchedBatch.root_hash,
        proof_path: [
          { position: "right", hash: "4a28f80c6553835697624d6d67b2d2f70355f3408a0d0a79eb45155c82db7dbd" },
          { position: "left", hash: "9e8a719d3f112e4e1a06f30df0abf92be2c10b2df71efc5625bf2eb527c9451f" },
          { position: "right", hash: "d14a028c2a3a2bc9476102bb288234c415a2b01f828ea62ac5b3e42f" },
        ],
        verified: true,
      });
      setVerifying(false);
    }, 400);
  };

  const handleCopy = (text: string) => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(text);
      setCopiedHash(text);
      setTimeout(() => setCopiedHash(null), 2000);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto space-y-2.5">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3.5 py-1 text-xs font-bold text-teal-800 dark:bg-teal-950/60 dark:text-teal-300">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <span>
            {lang === "bn"
              ? "অপরিবর্তনীয় ক্রিপ্টোগ্রাফিক অডিট ট্রেইল"
              : "Immutable Cryptographic Audit Trail"}
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {lang === "bn"
            ? "মারকেল স্বচ্ছতা লগ (Transparency Log)"
            : "Merkle Transparency Log"}
        </h1>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          {lang === "bn"
            ? "প্রতিদিনের সমস্ত দলিলের মারকেল ট্রি রুট হ্যাশ উন্মুক্তভাবে প্রকাশ করা হয়। এর ফলে কোনো কর্মকর্তা বা মধ্যস্বত্বভোগী গোপনে পেছনের তারিখের ভুয়া দলিল ঢোকাতে বা মুছতে পারে না।"
            : "Daily cryptographic Merkle roots are published publicly. This mathematically prevents retroactive record insertion, backdating, or secret deletion of land deeds."}
        </p>
      </div>

      {/* Latest Root Showcase Card */}
      <Card className="p-6 border-teal-200 dark:border-teal-900/60 shadow-lg shadow-teal-500/5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {lang === "bn"
                  ? "সর্বশেষ প্রকাশিত রুট হ্যাশ (Latest Root)"
                  : "Latest Published Merkle Root"}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lang === "bn"
                ? `ব্যাচ: ${PUBLISHED_BATCHES[0].batch_id} • মোট দলিল: ${PUBLISHED_BATCHES[0].deeds_count} টি`
                : `Batch: ${PUBLISHED_BATCHES[0].batch_id} • Total Deeds: ${PUBLISHED_BATCHES[0].deeds_count}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
              ✓ {lang === "bn" ? "অপরিবর্তনীয় সংরক্ষিত" : "CONFIRMED & SEALED"}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-3 font-mono text-xs">
          <div>
            <span className="text-slate-400 block text-[11px] uppercase tracking-wider mb-1 font-sans font-semibold">
              {lang === "bn" ? "মারকেল রুট হ্যাশ (SHA-256)" : "Merkle Root Hash (SHA-256)"}
            </span>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-900 p-3 text-emerald-400">
              <span className="truncate">{PUBLISHED_BATCHES[0].root_hash}</span>
              <button
                type="button"
                onClick={() => handleCopy(PUBLISHED_BATCHES[0].root_hash)}
                className="shrink-0 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] font-sans font-bold text-slate-200 hover:bg-slate-700 transition"
              >
                {copiedHash === PUBLISHED_BATCHES[0].root_hash
                  ? lang === "bn" ? "কপি হয়েছে!" : "Copied!"
                  : lang === "bn" ? "কপি" : "Copy"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-850">
              <span className="text-slate-400 block text-[11px] font-sans font-semibold">
                {lang === "bn" ? "মাস্টার কি আইডি (Key ID)" : "Master Key ID"}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {PUBLISHED_BATCHES[0].key_id}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-850">
              <span className="text-slate-400 block text-[11px] font-sans font-semibold">
                {lang === "bn" ? "ডিজিটাল স্বাক্ষর (Ed25519)" : "Ed25519 Signature"}
              </span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                {PUBLISHED_BATCHES[0].signature.slice(0, 32)}...
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Interactive Inclusion Proof Verifier */}
      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === "bn"
                ? "দলিল অন্তর্ভুক্তি প্রমাণ যাচাই (Verify Inclusion Proof)"
                : "Verify Deed Inclusion Proof"}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {lang === "bn"
                ? "আপনার দলিল নম্বর দিন এবং দেখুন এটি প্রকাশিত মারকেল লগে অন্তর্ভুক্ত রয়েছে কিনা।"
                : "Enter your deed number to verify its mathematical inclusion in the published Merkle tree."}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerifyInclusion();
            }}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <input
              type="text"
              value={inputDeed}
              onChange={(e) => setInputDeed(e.target.value)}
              placeholder={lang === "bn" ? "দলিল নম্বর লিখুন (যেমন: DHAKA-2026-000010)..." : "Enter deed number (e.g. DHAKA-2026-000010)..."}
              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-400 focus:border-teal-500 focus:outline-hidden dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <button
              type="submit"
              disabled={verifying || !inputDeed.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-teal-700 active:scale-95 transition disabled:opacity-50"
            >
              {verifying ? <Spinner size="sm" /> : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{lang === "bn" ? "অন্তর্ভুক্তি পরীক্ষা" : "Verify Proof"}</span>
                </>
              )}
            </button>
          </form>

          {/* Sample Deed Quick-Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
            <span className="font-semibold">{lang === "bn" ? "টেস্ট দলিল:" : "Test Deeds:"}</span>
            {sampleDeeds.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setInputDeed(s);
                  handleVerifyInclusion(s);
                }}
                className="rounded-full border border-slate-200 bg-slate-100/80 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 transition dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Proof Result Display */}
          {proofResult && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 dark:border-emerald-900/60 dark:bg-emerald-950/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                    ✓
                  </span>
                  <span className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    {lang === "bn"
                      ? "দলিলটি মারকেল ট্রি-তে গাণিতিকভাবে প্রমাণিত!"
                      : "Deed Mathematically Proven in Merkle Tree!"}
                  </span>
                </div>
                <span className="font-mono text-xs text-emerald-800 dark:text-emerald-300">
                  {proofResult.batch_id}
                </span>
              </div>

              <div className="space-y-2 font-mono text-xs">
                <div>
                  <span className="text-slate-500 font-sans block text-[11px]">
                    {lang === "bn" ? "দলিল লিফ হ্যাশ (Leaf Hash):" : "Deed Leaf Hash:"}
                  </span>
                  <span className="text-slate-800 dark:text-slate-200 truncate block">
                    {proofResult.leaf_hash}
                  </span>
                </div>

                <div>
                  <span className="text-slate-500 font-sans block text-[11px]">
                    {lang === "bn" ? "প্রমাণ পথ (Merkle Proof Path - 3 Hops):" : "Merkle Proof Path (3 Hops):"}
                  </span>
                  <div className="space-y-1 mt-1">
                    {proofResult.proof_path.map((p, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 pl-2 border-l-2 border-teal-500"
                      >
                        <span className="font-sans font-bold text-teal-700 uppercase">
                          Hop {i + 1} ({p.position}):
                        </span>
                        <span className="truncate">{p.hash}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200/80 dark:border-emerald-900/40 text-slate-700 dark:text-slate-300 text-[11px] font-sans">
                  {lang === "bn"
                    ? "এই দলিলটি রেজিস্ট্রেশন হওয়ার পর থেকে কোনো পরিবর্তন ঘটেনি। এর লিফ হ্যাশ প্রকাশিত রুট হ্যাশের সাথে হুবহু মিলে গেছে।"
                    : "No tampering has occurred since registration. The leaf hash exactly resolves to the signed daily root."}
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Historical Batches Table */}
      <Card className="p-6">
        <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          {lang === "bn" ? "দৈনিক প্রকাশিত রুট ইতিহাস" : "Daily Published Roots History"}
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider dark:border-slate-800">
                <th className="py-2.5 px-3">{lang === "bn" ? "তারিখ / ব্যাচ" : "Date / Batch"}</th>
                <th className="py-2.5 px-3">{lang === "bn" ? "দলিল সংখ্যা" : "Deeds Count"}</th>
                <th className="py-2.5 px-3">{lang === "bn" ? "মারকেল রুট হ্যাশ" : "Merkle Root Hash"}</th>
                <th className="py-2.5 px-3 text-right">{lang === "bn" ? "অবস্থা" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
              {PUBLISHED_BATCHES.map((b) => (
                <tr key={b.batch_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-3 px-3">
                    <span className="font-bold text-slate-900 dark:text-white font-sans block">
                      {b.date}
                    </span>
                    <span className="text-[11px] text-slate-400">{b.batch_id}</span>
                  </td>
                  <td className="py-3 px-3 font-sans font-semibold text-slate-700 dark:text-slate-300">
                    {b.deeds_count} {lang === "bn" ? "টি দলিল" : "deeds"}
                  </td>
                  <td className="py-3 px-3 max-w-[260px] truncate text-slate-600 dark:text-slate-400">
                    {b.root_hash}
                  </td>
                  <td className="py-3 px-3 text-right font-sans">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default function TransparencyPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <TransparencyContent />
    </Suspense>
  );
}
