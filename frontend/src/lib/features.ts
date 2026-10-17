/**
 * LandShield Phase 2 — Feature Flags
 *
 * Fetches feature flags once from GET /api/v1/features at runtime,
 * caches in memory so the frontend never needs to rebuild for flag changes.
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "http://localhost:8000/api/v1";

export interface Features {
  FEATURE_RECONCILE: boolean;
  FEATURE_LINEAGE: boolean;
  FEATURE_OFFLINE_QR: boolean;
  FEATURE_AGENT: boolean;
  FEATURE_TRANSPARENCY: boolean;
  FEATURE_ML: boolean;
  FEATURE_OCR: boolean;
}

/** Safe defaults — all phase-2 features off until the backend confirms them. */
const DEFAULT_FEATURES: Features = {
  FEATURE_RECONCILE: false,
  FEATURE_LINEAGE: false,
  FEATURE_OFFLINE_QR: false,
  FEATURE_AGENT: false,
  FEATURE_TRANSPARENCY: false,
  FEATURE_ML: false,
  FEATURE_OCR: false,
};

let cache: Features | null = null;
let fetchPromise: Promise<Features> | null = null;

/**
 * Load feature flags from the backend.
 * Result is cached in-process for the lifetime of the page.
 * Falls back to DEFAULT_FEATURES on any network or parse error.
 */
export async function loadFeatures(): Promise<Features> {
  if (cache) return cache;

  // Deduplicate concurrent callers — one in-flight request only.
  if (!fetchPromise) {
    fetchPromise = (async () => {
      try {
        const res = await fetch(`${API_BASE}/features`, {
          // Don't store in HTTP cache; we cache ourselves in-process.
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Partial<Features> = await res.json();
        cache = { ...DEFAULT_FEATURES, ...data };
      } catch {
        // Backend not available or flag endpoint not deployed yet — use defaults.
        cache = { ...DEFAULT_FEATURES };
      }
      fetchPromise = null;
      return cache!;
    })();
  }

  return fetchPromise;
}

/**
 * React hook — returns the cached Features object.
 * On first mount it fetches; re-renders once the flags arrive.
 *
 * Usage:
 *   const features = useFeatures();
 *   if (features.FEATURE_LINEAGE) { ... }
 */
import { useEffect, useState } from "react";

export function useFeatures(): Features {
  const [features, setFeatures] = useState<Features>(
    cache ?? DEFAULT_FEATURES
  );

  useEffect(() => {
    let mounted = true;
    loadFeatures().then((f) => {
      if (mounted) setFeatures(f);
    });
    return () => {
      mounted = false;
    };
  }, []);

  return features;
}
