"use client";

import React from "react";

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function Spinner({ size = "md", label, className = "" }: SpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-7 h-7 border-3",
    lg: "w-10 h-10 border-4",
  }[size];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center justify-center gap-2.5 ${className}`}
    >
      <div
        className={`${sizeClasses} animate-spin rounded-full border-slate-200 border-t-emerald-600 dark:border-slate-700 dark:border-t-emerald-400`}
      />
      {label && (
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
          {label}
        </span>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  );
}
