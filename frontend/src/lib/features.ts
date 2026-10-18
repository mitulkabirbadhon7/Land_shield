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
  // Lowercase aliases matching backend schema
  feature_reconcile?: boolean;
  feature_lineage?: boolean;
  feature_offline_qr?: boolean;
  feature_agent?: boolean;
  feature_transparency?: boolean;
  feature_ml?: boolean;
  feature_ocr?: boolean;
}

/** Safe defaults — all phase-2 features enabled by default during dev/demo so UI is not locked out */
const DEFAULT_FEATURES: Features = {
  FEATURE_RECONCILE: true,
  FEATURE_LINEAGE: true,
  FEATURE_OFFLINE_QR: true,
  FEATURE_AGENT: true,
  FEATURE_TRANSPARENCY: true,
  FEATURE_ML: true,
  FEATURE_OCR: true,
  feature_reconcile: true,
  feature_lineage: true,
  feature_offline_qr: true,
  feature_agent: true,
  feature_transparency: true,
  feature_ml: true,
  feature_ocr: true,
};

let cache: Features | null = null;
let fetchPromise: Promise<Features> | null = null;

function normalizeFeatures(data: Record<string, any>): Features {
  const getFlag = (upper: string, lower: string, def = true): boolean => {
    if (data[upper] !== undefined) return Boolean(data[upper]);
    if (data[lower] !== undefined) return Boolean(data[lower]);
    return def;
  };

  const reconcile = getFlag("FEATURE_RECONCILE", "feature_reconcile", true);
  const lineage = getFlag("FEATURE_LINEAGE", "feature_lineage", true);
  const offlineQr = getFlag("FEATURE_OFFLINE_QR", "feature_offline_qr", true);
  const agent = getFlag("FEATURE_AGENT", "feature_agent", true);
  const transparency = getFlag("FEATURE_TRANSPARENCY", "feature_transparency", true);
  const ml = getFlag("FEATURE_ML", "feature_ml", true);
  const ocr = getFlag("FEATURE_OCR", "feature_ocr", true);

  return {
    FEATURE_RECONCILE: reconcile,
    FEATURE_LINEAGE: lineage,
    FEATURE_OFFLINE_QR: offlineQr,
    FEATURE_AGENT: agent,
    FEATURE_TRANSPARENCY: transparency,
    FEATURE_ML: ml,
    FEATURE_OCR: ocr,
    feature_reconcile: reconcile,
    feature_lineage: lineage,
    feature_offline_qr: offlineQr,
    feature_agent: agent,
    feature_transparency: transparency,
    feature_ml: ml,
    feature_ocr: ocr,
  };
}

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
        const data = await res.json();
        cache = normalizeFeatures(data);
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
