"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useLanguage } from "@/lib/i18n";

export default function CheckPlaceholderPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Card
        title={t("nav.check")}
        subtitle="Citizen Pre-Purchase Risk Check • Coming in Session S14"
        className="text-center py-10"
      >
        <div className="mx-auto max-w-md space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            দাগ ও মৌজা ভিত্তিক নাগরিক প্লট অনুসন্ধান এবং ঝুঁকি প্রতিবেদন মডিউলটি সেশন S14-এ সংযুক্ত হবে।
          </p>
          <div className="pt-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
            >
              ← নীড়পাতায় ফিরে যান
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
