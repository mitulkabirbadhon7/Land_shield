"use client";

import React from "react";

interface ErrorBoxProps {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorBox({
  title = "ত্রুটি ঘটেছে (Error)",
  message = "একটি অপ্রত্যাশিত ত্রুটি দেখা দিয়েছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।",
  code,
  onRetry,
  className = "",
}: ErrorBoxProps) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 shadow-xs dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-rose-600 dark:text-rose-400">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-200">
              {title}
            </h4>
            {code && (
              <span className="rounded bg-rose-200/70 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-rose-800 dark:bg-rose-900/80 dark:text-rose-300">
                {code}
              </span>
            )}
          </div>

          {message && (
            <p className="text-xs leading-relaxed text-rose-700 dark:text-rose-300">
              {message}
            </p>
          )}

          {onRetry && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-700 active:bg-rose-800 dark:bg-rose-700 dark:hover:bg-rose-600"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span>পুনরায় চেষ্টা করুন (Retry)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
