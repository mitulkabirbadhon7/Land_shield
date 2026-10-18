"use client";

import React, { useState } from "react";

export interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
  badge?: string;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenId?: string;
  allowMultiple?: boolean;
  className?: string;
}

export function Accordion({
  items,
  defaultOpenId,
  allowMultiple = false,
  className = "",
}: AccordionProps) {
  const [openIds, setOpenIds] = useState<string[]>(
    defaultOpenId ? [defaultOpenId] : []
  );

  const toggleItem = (id: string) => {
    if (allowMultiple) {
      setOpenIds((prev) =>
        prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
      );
    } else {
      setOpenIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);

        return (
          <div
            key={item.id}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-2xs transition-all duration-200 hover:border-emerald-400/50 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/80"
          >
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
              id={`accordion-btn-${item.id}`}
              className="flex w-full items-center justify-between p-4 sm:p-5 text-left transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/50 focus:outline-hidden"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {item.title}
                </span>
                {item.badge && (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {item.badge}
                  </span>
                )}
              </div>

              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-transform duration-300 dark:bg-slate-800 dark:text-slate-400 ${
                  isOpen ? "rotate-180 bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : ""
                }`}
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
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </div>
            </button>

            {/* Zero-Layout-Shift Grid Transition */}
            <div
              id={`accordion-panel-${item.id}`}
              role="region"
              aria-labelledby={`accordion-btn-${item.id}`}
              data-expanded={isOpen ? "true" : "false"}
              className="accordion-grid"
            >
              <div className="accordion-inner">
                <div className="border-t border-slate-100 p-4 sm:p-5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  {item.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
