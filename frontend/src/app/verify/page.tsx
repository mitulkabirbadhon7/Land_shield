"use client";

import React from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { StatusBadge } from "@/components/StatusBadge";
import { useLanguage } from "@/lib/i18n";

export default function VerifyPlaceholderPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Card
        title={t("nav.verify")}
        subtitle="Deed Verification & QR Scanner • Coming in Session S13"
        className="text-center py-10"
      >
        <div className="mx-auto max-w-md space-y-4">
          <div className="flex justify-center gap-2">
            <StatusBadge status="VALID" />
            <StatusBadge status="TAMPERED" />
            <StatusBadge status="SUPERSEDED" />
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            দলিল যাচাই এবং ক্যামেরা কিউআর স্ক্যানার মডিউলটি পরবর্তী সেশনে (S13) সংযুক্ত হবে।
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
