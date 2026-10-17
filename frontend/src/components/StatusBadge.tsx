"use client";

import React from "react";
import { DeedStatus } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

interface StatusBadgeProps {
  status: DeedStatus | string;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
  customLabel?: string;
}

export function StatusBadge({
  status,
  size = "md",
  showIcon = true,
  className = "",
  customLabel,
}: StatusBadgeProps) {
  const { t } = useLanguage();
  const normalizedStatus = (status?.toUpperCase() || "UNKNOWN") as DeedStatus;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs font-semibold gap-1",
    md: "px-3 py-1 text-sm font-semibold gap-1.5",
    lg: "px-4 py-1.5 text-base font-bold gap-2",
  }[size];

  const iconSizes = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  }[size];

  const label =
    customLabel ||
    t(`status.${normalizedStatus}`, normalizedStatus);

  switch (normalizedStatus) {
    case "VALID":
      return (
        <span
          className={`group/badge inline-flex items-center rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-700 shadow-sm animate-pulse-glow transition-transform duration-200 hover:scale-105 cursor-default ${sizeClasses} ${className}`}
          data-testid="status-badge-valid"
        >
          {showIcon && (
            <svg
              className={`${iconSizes} text-emerald-600 dark:text-emerald-400 shrink-0 transition-transform duration-200 group-hover/badge:scale-110`}
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
          )}
          <span>{label}</span>
        </span>
      );

    case "TAMPERED":
      return (
        <span
          className={`group/badge inline-flex items-center rounded-full bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-950/80 dark:text-rose-100 dark:border-rose-700 shadow-sm animate-pulse-alert transition-transform duration-200 hover:scale-105 cursor-default ${sizeClasses} ${className}`}
          data-testid="status-badge-tampered"
        >
          {showIcon && (
            <svg
              className={`${iconSizes} text-rose-600 dark:text-rose-400 shrink-0 transition-transform duration-200 group-hover/badge:scale-110`}
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
          )}
          <span>{label}</span>
        </span>
      );

    case "SUPERSEDED":
      return (
        <span
          className={`group/badge inline-flex items-center rounded-full bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-700 shadow-sm transition-transform duration-200 hover:scale-105 cursor-default ${sizeClasses} ${className}`}
          data-testid="status-badge-superseded"
        >
          {showIcon && (
            <svg
              className={`${iconSizes} text-amber-600 dark:text-amber-400 shrink-0 transition-transform duration-300 group-hover/badge:rotate-45`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          <span>{label}</span>
        </span>
      );

    case "CANCELLED":
      return (
        <span
          className={`group/badge inline-flex items-center rounded-full bg-slate-100 text-slate-500 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700 shadow-sm line-through transition-transform duration-200 hover:scale-105 cursor-default ${sizeClasses} ${className}`}
          data-testid="status-badge-cancelled"
        >
          {showIcon && (
            <svg
              className={`${iconSizes} text-slate-400 dark:text-slate-500 shrink-0 no-underline transition-transform duration-200 group-hover/badge:scale-110`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
          <span className="line-through">{label}</span>
        </span>
      );

    case "UNKNOWN":
    default:
      return (
        <span
          className={`group/badge inline-flex items-center rounded-full bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 shadow-sm transition-transform duration-200 hover:scale-105 cursor-default ${sizeClasses} ${className}`}
          data-testid="status-badge-unknown"
        >
          {showIcon && (
            <svg
              className={`${iconSizes} text-gray-500 dark:text-gray-400 shrink-0 transition-transform duration-200 group-hover/badge:scale-110`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          )}
          <span>{label}</span>
        </span>
      );
  }
}
