"use client";

import React from "react";

interface CardProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  interactive?: boolean;
  animate?: boolean;
  onClick?: () => void;
}

export function Card({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  className = "",
  interactive = false,
  animate = false,
  onClick,
}: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-xs transition-all duration-300 ease-out backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none ${
        animate ? "animate-fade-in-up" : ""
      } ${
        interactive
          ? "cursor-pointer hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-lg active:scale-[0.99] dark:hover:border-emerald-500/40"
          : "hover:border-slate-300/90 dark:hover:border-slate-700/80"
      } ${className}`}
    >
      {(title || subtitle || headerAction) && (
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-3 dark:border-slate-800/80">
          <div className="space-y-0.5">
            {title && (
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div>{children}</div>

      {footer && (
        <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
          {footer}
        </div>
      )}
    </div>
  );
}
