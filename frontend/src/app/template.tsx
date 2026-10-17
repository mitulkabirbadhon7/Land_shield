"use client";

import React from "react";

/**
 * Root Template for smooth route transitions across the portal.
 * Remounts on each navigation to provide a clean, jitter-free fade-in transition.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-fade-in w-full">{children}</div>;
}
