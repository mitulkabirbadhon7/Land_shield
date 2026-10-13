"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/lib/i18n";
import { Spinner } from "./Spinner";

interface QRScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export function parseDeedFromQR(qrText: string): string {
  const trimmed = qrText.trim();

  // 1. Check if contains ?deed= URL parameter
  if (trimmed.includes("deed=")) {
    try {
      const url = new URL(
        trimmed.startsWith("http") ? trimmed : `https://example.com/${trimmed}`
      );
      const param = url.searchParams.get("deed");
      if (param) return param.trim();
    } catch {
      const match = trimmed.match(/[?&]deed=([^&]+)/);
      if (match && match[1]) return decodeURIComponent(match[1]).trim();
    }
  }

  // 2. Check if JSON payload (e.g. Phase 2 offline QR)
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const obj = JSON.parse(trimmed);
      if (obj.deed_no) return String(obj.deed_no).trim();
      if (obj.deed) return String(obj.deed).trim();
    } catch {
      // Ignore JSON parse errors
    }
  }

  // 3. Fallback: return raw trimmed text (e.g. direct deed number)
  return trimmed;
}

export function QRScanner({ onScanSuccess, onClose }: QRScannerProps) {
  const { t } = useLanguage();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<unknown>(null);
  const hasScannedRef = useRef(false);
  const elementId = "html5qr-code-full-region";

  useEffect(() => {
    let isMounted = true;

    async function startScanner() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        if (!isMounted) return;

        const scanner = new Html5Qrcode(elementId);
        scannerRef.current = scanner;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText: string) => {
            if (hasScannedRef.current) return;
            hasScannedRef.current = true;

            const parsedDeed = parseDeedFromQR(decodedText);
            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                onScanSuccess(parsedDeed);
              });
          },
          () => {
            // Frame scan without QR detected - normal loop
          }
        );

        if (isMounted) {
          setIsInitializing(false);
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        setIsInitializing(false);

        const errorStr = String(err);
        if (
          errorStr.includes("NotAllowedError") ||
          errorStr.includes("Permission") ||
          errorStr.includes("denied")
        ) {
          setErrorMessage(t("verify.camera_permission_error"));
        } else if (
          errorStr.includes("NotFoundError") ||
          errorStr.includes("DevicesNotFoundError")
        ) {
          setErrorMessage(t("verify.camera_not_found"));
        } else {
          setErrorMessage(
            `${t("verify.camera_permission_error")} (${errorStr})`
          );
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        const s = scannerRef.current as {
          isScanning?: boolean;
          stop: () => Promise<void>;
          clear: () => void;
        };
        try {
          if (s.isScanning) {
            s.stop().catch(() => {});
          }
          s.clear();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, [onScanSuccess, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-600 dark:bg-teal-950 dark:text-teal-400">
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
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {t("verify.scanner_title")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label="Close scanner"
          >
            <svg
              className="h-5 w-5"
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
          </button>
        </div>

        {/* Camera Viewport Area */}
        <div className="p-4">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400 text-center">
            {t("verify.scanner_instruction")}
          </p>

          <div className="relative min-h-[280px] w-full overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center">
            {isInitializing && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-slate-950/80 text-white">
                <Spinner size="md" />
                <span className="text-xs text-slate-300">
                  ক্যামেরা চালু হচ্ছে...
                </span>
              </div>
            )}

            {errorMessage ? (
              <div className="p-6 text-center text-rose-300 space-y-3">
                <svg
                  className="mx-auto h-10 w-10 text-rose-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-xs leading-relaxed">{errorMessage}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-600"
                >
                  {t("common.close")}
                </button>
              </div>
            ) : (
              <div id={elementId} className="w-full" />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {t("verify.btn_stop_scan")}
          </button>
        </div>
      </div>
    </div>
  );
}
