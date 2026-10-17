import nacl from "tweetnacl";

/**
 * Offline Deed Verification Engine (LandShield Phase 2)
 *
 * Implements client-side Ed25519 signature and SHA-256 integrity verification
 * directly within the browser without requiring network access or server calls.
 *
 * CRITICAL RULE: NEVER re-canonicalize payload_json in the browser.
 * JavaScript and Python format floating point numbers differently (e.g. 15.0 vs 15).
 * The browser SHA-256 hashes the EXACT UTF-8 bytes of payload_json AS RECEIVED.
 */

export type OfflineVerifyState = "AUTHENTIC" | "NOT_AUTHENTIC" | "KEY_UNKNOWN";

export interface OfflinePayload {
  v: number;
  payload_json: string;
  hash: string;
  sig: string;
  key_id: string;
}

export interface OfflineDeedFields {
  deed_no: string;
  plot_id: number;
  seller_id: number;
  buyer_id: number;
  area_sold: number;
  deed_type: string;
  registered_at: string;
  sub_registry: string;
  price_bdt?: number;
  [key: string]: unknown;
}

export interface OfflineVerifyResult {
  state: OfflineVerifyState;
  fields?: OfflineDeedFields;
  key_id?: string;
  hash?: string;
  error?: string;
}

const KEYS_STORAGE_KEY = "landshield_offline_keys";
const KEYS_TIMESTAMP_KEY = "landshield_offline_keys_ts";

// Default public keys embedded for offline standalone verification (fallback if cache empty)
export const DEFAULT_OFFLINE_KEYS: Record<string, string> = {
  "80db4db0eb17ae3b": "b8580cdb150e798619b950d022938644215ebb5360f0640c4680a69ba05bf084",
};

/**
 * Decode Base64URL string (RFC 4648 §5) or extract from scanned deed URL.
 */
export function decodeBase64Url(input: string): string {
  let clean = input.trim();

  // If a full verification URL was scanned or pasted, extract payload parameter
  const urlParamMatch = clean.match(/[?&](?:offline|payload)=([^&]+)/i);
  if (urlParamMatch) {
    clean = decodeURIComponent(urlParamMatch[1]);
  }

  // If already raw compact JSON string, return directly
  if (clean.startsWith("{") && clean.endsWith("}")) {
    return clean;
  }

  // Convert Base64URL characters to standard Base64
  let base64 = clean.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  if (typeof window !== "undefined" && typeof window.atob === "function") {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } else {
    // Node.js test environment
    return Buffer.from(base64, "base64").toString("utf-8");
  }
}

/**
 * Convert hexadecimal string to Uint8Array bytes.
 */
export function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array bytes to hexadecimal string.
 */
export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Compute SHA-256 hash of a string using Web Crypto API (or Node.js crypto in tests).
 */
export async function computeSha256(str: string): Promise<string> {
  const data = new TextEncoder().encode(str);
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.subtle
  ) {
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return toHex(new Uint8Array(digest));
  } else {
    // Node.js / SSR environment
    const nodeCrypto = await import("crypto");
    return nodeCrypto.createHash("sha256").update(Buffer.from(data)).digest("hex");
  }
}

/**
 * Verify an offline deed payload against stored public keys.
 *
 * Steps:
 * 1. Decode and parse compact JSON payload {v, payload_json, hash, sig, key_id}.
 * 2. Hash UTF-8 bytes of payload_json AS RECEIVED; must match hash.
 * 3. Look up key_id in keys. If missing, return KEY_UNKNOWN.
 * 4. Verify Ed25519 signature over hash bytes using tweetnacl.
 * 5. Parse deed fields from payload_json and return AUTHENTIC.
 */
export async function verifyOffline(
  payloadString: string,
  keys: Record<string, string> = {}
): Promise<OfflineVerifyResult> {
  try {
    const jsonStr = decodeBase64Url(payloadString);
    const parsed: OfflinePayload = JSON.parse(jsonStr);

    if (!parsed.payload_json || !parsed.hash || !parsed.sig || !parsed.key_id) {
      return {
        state: "NOT_AUTHENTIC",
        error: "INVALID_OFFLINE_PAYLOAD_STRUCTURE",
      };
    }

    // Step 1: Check SHA-256 digest of payload_json AS RECEIVED
    const computedHash = await computeSha256(parsed.payload_json);
    if (computedHash.toLowerCase() !== parsed.hash.trim().toLowerCase()) {
      return {
        state: "NOT_AUTHENTIC",
        key_id: parsed.key_id,
        hash: parsed.hash,
        error: "HASH_MISMATCH",
      };
    }

    // Step 2: Extract deed fields safely for display
    let fields: OfflineDeedFields | undefined;
    try {
      fields = JSON.parse(parsed.payload_json);
    } catch {
      // payload_json was not valid JSON
    }

    // Step 3: Resolve public key from provided dictionary or cache
    const effectiveKeys = { ...DEFAULT_OFFLINE_KEYS, ...(getCachedKeys() || {}), ...keys };
    const publicKeyHex = effectiveKeys[parsed.key_id];

    if (!publicKeyHex) {
      return {
        state: "KEY_UNKNOWN",
        fields,
        key_id: parsed.key_id,
        hash: parsed.hash,
        error: "KEY_UNKNOWN",
      };
    }

    // Step 4: Verify Ed25519 signature over hash bytes using tweetnacl
    const hashBytes = fromHex(parsed.hash);
    const sigBytes = fromHex(parsed.sig);
    const pubKeyBytes = fromHex(publicKeyHex);

    const isValidSig = nacl.sign.detached.verify(hashBytes, sigBytes, pubKeyBytes);

    if (!isValidSig) {
      return {
        state: "NOT_AUTHENTIC",
        fields,
        key_id: parsed.key_id,
        hash: parsed.hash,
        error: "SIGNATURE_MISMATCH",
      };
    }

    return {
      state: "AUTHENTIC",
      fields,
      key_id: parsed.key_id,
      hash: parsed.hash,
    };
  } catch (err) {
    return {
      state: "NOT_AUTHENTIC",
      error: err instanceof Error ? err.message : "DECODE_ERROR",
    };
  }
}

/**
 * LocalStorage Public Key Cache Management
 */
export function getCachedKeys(): Record<string, string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEYS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function storeKeysInCache(keys: Record<string, string>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEYS_STORAGE_KEY, JSON.stringify(keys));
    localStorage.setItem(KEYS_TIMESTAMP_KEY, new Date().toISOString());
  } catch {
    // Ignore quota errors
  }
}

/**
 * Fetch public keys online and persist to localStorage cache for offline usage.
 */
export async function syncPublicKeysOnline(): Promise<Record<string, string>> {
  const API_BASE =
    process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "") || "http://localhost:8000/api/v1";

  try {
    const res = await fetch(`${API_BASE}/keys`, { cache: "no-store" });
    if (res.ok) {
      const data: Array<{ key_id: string; public_key_hex: string; status?: string }> =
        await res.json();
      const keysMap: Record<string, string> = {};
      data.forEach((k) => {
        if (k.key_id && k.public_key_hex) {
          keysMap[k.key_id] = k.public_key_hex;
        }
      });
      storeKeysInCache(keysMap);
      return keysMap;
    }
  } catch {
    // Offline or network unreachable
  }
  return getCachedKeys() || DEFAULT_OFFLINE_KEYS;
}
