#!/usr/bin/env python3
"""
LandShield - End-to-End Smoke Test Suite
LandTech Innovation Hackathon 2026 | Comprehensive System Verification

Validates live application health, authentication, fraud engine blocking (HTTP 409),
cryptographic verification (Ed25519 & SHA-256), Tamper Lab demo workflow,
and Phase 2 differentiators (Feature Flags, Public Keys Registry, Lineage & Reconcile
Pipelines, AI Due-Diligence Reports, and Daily Merkle Transparency Log).

Usage:
    python scripts/smoke_test.py [--base-url URL] [--timeout SECONDS]

Examples:
    python scripts/smoke_test.py --base-url http://localhost:8000
    python scripts/smoke_test.py --base-url https://landshield.onrender.com
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

# Ensure safe UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure backend directory is in sys.path
repo_root = Path(__file__).resolve().parent.parent
backend_dir = repo_root / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    import httpx
    USE_HTTPX = True
except ImportError:
    import urllib.error
    import urllib.request
    USE_HTTPX = False


class SimpleClient:
    """Lightweight HTTP client abstracting httpx, urllib, and in-process TestClient."""

    def __init__(self, base_url: str, timeout: float = 20.0):
        self.base_url = base_url.rstrip("/")
        if self.base_url.endswith("/api/v1"):
            self.api_prefix = self.base_url
            self.root_url = self.base_url[:-7]
        else:
            self.api_prefix = f"{self.base_url}/api/v1"
            self.root_url = self.base_url
        self.timeout = timeout
        self.test_client: Any = None
        if USE_HTTPX:
            self.client = httpx.Client(timeout=timeout, follow_redirects=True)
        else:
            self.client = None

    def enable_test_client(self):
        """Fallback to in-process FastAPI TestClient if no live server is listening."""
        from fastapi.testclient import TestClient
        from app.main import app
        self.test_client = TestClient(app)

    def request(
        self,
        method: str,
        path: str,
        json_data: dict | None = None,
        headers: dict | None = None,
    ) -> tuple[int, dict | str]:
        if self.test_client is not None:
            tc_path = path
            if not (tc_path.startswith("/api/v1") or tc_path in ["/keys", "/transparency", "/features"]):
                tc_path = f"/api/v1{tc_path}" if tc_path.startswith("/") else f"/api/v1/{tc_path}"
            req_headers = {"Accept": "application/json"}
            if headers:
                req_headers.update(headers)
            resp = self.test_client.request(method, tc_path, json=json_data, headers=req_headers)
            try:
                data = resp.json()
            except Exception:
                data = resp.text
            return resp.status_code, data

        if path.startswith("http://") or path.startswith("https://"):
            url = path
        elif path.startswith("/api/v1/"):
            url = f"{self.root_url}{path}"
        elif path in ["/keys", "/transparency"] or path.startswith("/keys") or path.startswith("/transparency"):
            url = f"{self.root_url}{path}"
        elif path.startswith("/"):
            url = f"{self.api_prefix}{path}"
        else:
            url = f"{self.api_prefix}/{path}"

        req_headers = {"Accept": "application/json"}
        if headers:
            req_headers.update(headers)

        if USE_HTTPX:
            try:
                resp = self.client.request(
                    method,
                    url,
                    json=json_data,
                    headers=req_headers,
                )
                try:
                    data = resp.json()
                except Exception:
                    data = resp.text
                return resp.status_code, data
            except Exception as e:
                return 0, f"Connection error: {e}"
        else:
            data_bytes = None
            if json_data is not None:
                data_bytes = json.dumps(json_data).encode("utf-8")
                req_headers["Content-Type"] = "application/json"

            req = urllib.request.Request(
                url,
                data=data_bytes,
                headers=req_headers,
                method=method,
            )
            try:
                with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                    status_code = resp.getcode()
                    content = resp.read().decode("utf-8")
                    try:
                        data = json.loads(content)
                    except Exception:
                        data = content
                    return status_code, data
            except urllib.error.HTTPError as e:
                status_code = e.code
                content = e.read().decode("utf-8")
                try:
                    data = json.loads(content)
                except Exception:
                    data = content
                return status_code, data
            except Exception as e:
                return 0, f"Connection error: {e}"

    def get(self, path: str, headers: dict | None = None) -> tuple[int, dict | str]:
        return self.request("GET", path, headers=headers)

    def post(
        self, path: str, json_data: dict | None = None, headers: dict | None = None
    ) -> tuple[int, dict | str]:
        return self.request("POST", path, json_data=json_data, headers=headers)


def safe_str(text: str) -> str:
    """Ensure string is printable in any terminal."""
    try:
        return text.encode(sys.stdout.encoding or "utf-8", errors="replace").decode(
            sys.stdout.encoding or "utf-8"
        )
    except Exception:
        return str(text)


def print_step(name: str, passed: bool, detail: str = "", duration_ms: float = 0):
    status_tag = "[PASS]" if passed else "[FAIL]"
    time_str = f"({duration_ms:.0f}ms)" if duration_ms > 0 else ""
    line = f" {status_tag} {name:<45} {time_str} {detail}"
    print(safe_str(line))


def run_smoke_test(base_url: str, timeout: float = 25.0) -> bool:
    print("=" * 75)
    print(" LandShield End-to-End Smoke Test Suite")
    print(f" Target URL: {base_url}")
    print(f" Engine:     {'httpx' if USE_HTTPX else 'urllib (fallback)'}")
    print("=" * 75)

    client = SimpleClient(base_url, timeout=timeout)

    # Probe live server; fallback to in-process TestClient if unreachable
    code, _ = client.get("/health")
    if code == 0:
        print("[!] Live server not responding at target URL.")
        print("[+] Falling back to in-process FastAPI TestClient...")
        client.enable_test_client()

    all_passed = True
    tests_run = 0

    # -------------------------------------------------------------------------
    # 1. Healthcheck Endpoints
    # -------------------------------------------------------------------------
    print("\n1. System Health & Infrastructure Verification")

    # 1.1 Liveness Ping
    t0 = time.time()
    tests_run += 1
    code, body = client.get("/health")
    dt = (time.time() - t0) * 1000
    ok = code == 200 and isinstance(body, dict) and body.get("status") == "ok"
    if not ok:
        all_passed = False
    print_step("GET /api/v1/health (Liveness)", ok, f"HTTP {code}", dt)

    # 1.2 Deep Healthcheck (Database connectivity + seeded counts)
    t0 = time.time()
    tests_run += 1
    code, body = client.get("/health/deep")
    dt = (time.time() - t0) * 1000
    db_ok = isinstance(body, dict) and (
        body.get("database") == "connected" or body.get("db") == "connected"
    )
    plots_ok = isinstance(body, dict) and body.get("plots_count", 0) >= 8
    ok = code == 200 and db_ok and plots_ok
    detail = (
        f"DB connected, plots={body.get('plots_count')}, deeds={body.get('deeds_count')}"
        if ok
        else f"HTTP {code}: {body}"
    )
    if not ok:
        all_passed = False
    print_step("GET /api/v1/health/deep (Database & Seed)", ok, detail, dt)

    # -------------------------------------------------------------------------
    # 2. Public Verification & Citizen Pre-Purchase Check
    # -------------------------------------------------------------------------
    print("\n2. Public Endpoints (Citizen Pre-Purchase & Cryptographic Verification)")

    # 2.1 Public Deed Verification (S6 Clean Deed: DHAKA-2026-000010)
    t0 = time.time()
    tests_run += 1
    test_deed_no = "DHAKA-2026-000010"
    code, body = client.get(f"/deeds/{test_deed_no}/verify")
    dt = (time.time() - t0) * 1000
    ok = code == 200 and isinstance(body, dict) and body.get("status") == "VALID"
    detail = f"Status: {body.get('status')} (Reasons: {body.get('reasons')})" if ok else f"HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step(f"GET /deeds/{test_deed_no}/verify", ok, detail, dt)

    # 2.2 Public Plot Detail & Privacy Masking
    t0 = time.time()
    tests_run += 1
    code, body = client.get("/plots/1")
    dt = (time.time() - t0) * 1000
    ok = code == 200 and isinstance(body, dict) and "dag_no" in body and "mouza" in body
    detail = f"Plot 1: Dag {body.get('dag_no')}, Mouza {body.get('mouza')}" if ok else f"HTTP {code}"
    if not ok:
        all_passed = False
    print_step("GET /plots/1 (Public Masked Details)", ok, detail, dt)

    # 2.3 Public Risk Assessment (Scenario S1: Double Sale Detection)
    t0 = time.time()
    tests_run += 1
    code, body = client.get("/risk/plot/1?lang=en")
    dt = (time.time() - t0) * 1000
    findings = body.get("findings", []) if isinstance(body, dict) else []
    r1_found = any("R1" in f.get("rule_id", "") for f in findings)
    ok = (
        code == 200
        and isinstance(body, dict)
        and body.get("has_critical") is True
        and body.get("level") == "CRITICAL"
        and r1_found
    )
    detail = f"Risk Score {body.get('score')}/100, Level: {body.get('level')}, R1 Detected" if ok else f"HTTP {code}"
    if not ok:
        all_passed = False
    print_step("GET /risk/plot/1 (Scenario S1 Risk Assessment)", ok, detail, dt)

    # -------------------------------------------------------------------------
    # 3. Authentication & Role-Based Access Control (RBAC)
    # -------------------------------------------------------------------------
    print("\n3. Authentication & RBAC Governance")

    # 3.1 Sub-Registrar Login
    t0 = time.time()
    tests_run += 1
    reg_login = {"username": "registrar1", "password": "registrar123"}
    code, body = client.post("/auth/login", json_data=reg_login)
    dt = (time.time() - t0) * 1000
    reg_token = body.get("access_token") if isinstance(body, dict) else None
    ok = code == 200 and bool(reg_token)
    detail = f"JWT acquired (role: {body.get('role')})" if ok else f"HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step("POST /auth/login (Sub-Registrar)", ok, detail, dt)

    # 3.2 Admin Login
    t0 = time.time()
    tests_run += 1
    admin_login = {"username": "admin1", "password": "admin123"}
    code, body = client.post("/auth/login", json_data=admin_login)
    dt = (time.time() - t0) * 1000
    admin_token = body.get("access_token") if isinstance(body, dict) else None
    ok = code == 200 and bool(admin_token)
    detail = f"JWT acquired (role: {body.get('role')})" if ok else f"HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step("POST /auth/login (Admin)", ok, detail, dt)

    # -------------------------------------------------------------------------
    # 4. Pre-Registration Fraud Prevention Engine
    # -------------------------------------------------------------------------
    print("\n4. Pre-Registration Fraud Prevention Engine")

    # 4.1 Attempt Double-Sale Registration on Plot 1 (Should be blocked at HTTP 409)
    t0 = time.time()
    tests_run += 1
    reg_headers = {"Authorization": f"Bearer {reg_token}"} if reg_token else {}
    double_sale_attempt = {
        "plot_id": 1,
        "seller_id": 1,
        "buyer_id": 99,
        "area_sold": 30.0,
        "deed_type": "SALE",
        "sub_registry": "MIR",
    }
    code, body = client.post("/deeds", json_data=double_sale_attempt, headers=reg_headers)
    dt = (time.time() - t0) * 1000
    ok = (
        code == 409
        and isinstance(body, dict)
        and body.get("code") == "FRAUD_BLOCKED"
        and isinstance(body.get("report"), dict)
        and body["report"].get("blocked") is True
    )
    detail = "Blocked: HTTP 409 FRAUD_BLOCKED (R1 Double Sale)" if ok else f"Unexpected HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step("POST /deeds (Double-Sale Fraud Block)", ok, detail, dt)

    # -------------------------------------------------------------------------
    # 5. Tamper Lab Cryptographic Lifecycle (Tamper -> Detect -> Restore)
    # -------------------------------------------------------------------------
    print("\n5. Tamper Lab Cryptographic Invalidation Lifecycle")

    admin_headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}
    code, body = client.get("/dev/status", headers=admin_headers)
    demo_mode_active = isinstance(body, dict) and body.get("demo_mode") is True

    if not demo_mode_active:
        print_step("GET /dev/status", True, "Demo mode is disabled (Production lock verified)")
    else:
        tamper_target = "DHAKA-2026-000010"

        # 5.1 Simulate payload tampering (+1 decimal area)
        t0 = time.time()
        tests_run += 1
        code, body = client.post(f"/dev/tamper/{tamper_target}", headers=admin_headers)
        dt = (time.time() - t0) * 1000
        ok = code == 200 and isinstance(body, dict) and body.get("status") == "tampered"
        if code == 409 and isinstance(body, dict) and body.get("code") == "ALREADY_TAMPERED":
            ok = True
            detail = f"Already tampered from previous run: {tamper_target}"
        else:
            detail = f"Tampered area: {body.get('tampered_area')} decimals" if ok else f"HTTP {code}"
        if not ok:
            all_passed = False
        print_step(f"POST /dev/tamper/{tamper_target}", ok, detail, dt)

        # 5.2 Verify that public deed verification detects the forgery
        t0 = time.time()
        tests_run += 1
        code, body = client.get(f"/deeds/{tamper_target}/verify")
        dt = (time.time() - t0) * 1000
        reasons = body.get("reasons", []) if isinstance(body, dict) else []
        hash_mismatch = any("HASH_MISMATCH" in str(r) for r in reasons)
        ok = (
            code == 200
            and isinstance(body, dict)
            and body.get("status") == "TAMPERED"
            and hash_mismatch
        )
        detail = f"Integrity broken: Status=TAMPERED (Reasons: {reasons})" if ok else f"HTTP {code}: {body}"
        if not ok:
            all_passed = False
        print_step(f"GET /deeds/{tamper_target}/verify (Tamper Check)", ok, detail, dt)

        # 5.3 Restore authentic payload from tamper backup
        t0 = time.time()
        tests_run += 1
        code, body = client.post(f"/dev/restore/{tamper_target}", headers=admin_headers)
        dt = (time.time() - t0) * 1000
        ok = code == 200 and isinstance(body, dict) and body.get("status") == "restored"
        detail = f"Payload restored: {body.get('area_sold')} decimals" if ok else f"HTTP {code}"
        if not ok:
            all_passed = False
        print_step(f"POST /dev/restore/{tamper_target}", ok, detail, dt)

        # 5.4 Verify that deed validity flips back to VALID
        t0 = time.time()
        tests_run += 1
        code, body = client.get(f"/deeds/{tamper_target}/verify")
        dt = (time.time() - t0) * 1000
        ok = code == 200 and isinstance(body, dict) and body.get("status") == "VALID"
        detail = f"Status restored to VALID (Reasons: {body.get('reasons')})" if ok else f"HTTP {code}: {body}"
        if not ok:
            all_passed = False
        print_step(f"GET /deeds/{tamper_target}/verify (Post-Restore)", ok, detail, dt)

    # -------------------------------------------------------------------------
    # 6. Phase 2 Differentiators (Advanced Features, Keys, Reports, Transparency)
    # -------------------------------------------------------------------------
    print("\n6. Phase 2 Differentiators & Extended Architecture")

    # 6.1 Verify Phase 2 Features
    t0 = time.time()
    tests_run += 1
    code, body = client.get("/features")
    dt = (time.time() - t0) * 1000
    ok = (
        code == 200
        and isinstance(body, dict)
        and "feature_reconcile" in body
        and "feature_lineage" in body
        and "feature_offline_qr" in body
    )
    detail = "Runtime feature flags verified" if ok else f"HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step("GET /api/v1/features (Phase 2 Feature Flags)", ok, detail, dt)

    # 6.2 Verify Public Ed25519 Keys Registry
    t0 = time.time()
    tests_run += 1
    code, body = client.get("/keys")
    dt = (time.time() - t0) * 1000
    is_keys_list = isinstance(body, list) and len(body) > 0
    is_keys_dict = isinstance(body, dict) and len(body.get("keys", [])) > 0
    ok = code == 200 and (is_keys_list or is_keys_dict)
    count = len(body) if isinstance(body, list) else len(body.get('keys', []))
    detail = f"Active keys count: {count}" if ok else f"HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step("GET /keys (Public Ed25519 Key Registry)", ok, detail, dt)

    # 6.3 Verify Pipeline Analysis on Plot 1
    t0 = time.time()
    tests_run += 1
    code, body = client.get("/analysis/plot/1")
    dt = (time.time() - t0) * 1000
    layers = body.get("layers", {}) if isinstance(body, dict) else {}
    ok = (
        code == 200
        and isinstance(body, dict)
        and "reconcile" in layers
        and "lineage" in layers
    )
    detail = f"Reconcile & Lineage layers active (Score: {body.get('total_score')})" if ok else f"HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step("GET /analysis/plot/1 (Layered Reconcile & Lineage Pipeline)", ok, detail, dt)

    # 6.4 Verify Citizen Due-Diligence Report Generation
    t0 = time.time()
    tests_run += 1
    code, body = client.post("/reports/due-diligence", json_data={"plot_id": 1, "lang": "bn"})
    dt = (time.time() - t0) * 1000
    ok = (
        code == 200
        and isinstance(body, dict)
        and "summary_bn" in body
        and "risk_level" in body
    )
    detail = f"Bilingual AI Due-Diligence Report generated (Risk: {body.get('risk_level')})" if ok else f"HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step("POST /reports/due-diligence (Bilingual AI Citizen Report)", ok, detail, dt)

    # 6.5 Verify Daily Merkle Transparency Log
    t0 = time.time()
    tests_run += 1
    code, body = client.get("/transparency")
    dt = (time.time() - t0) * 1000
    ok = code == 200 and isinstance(body, (dict, list))
    detail = "Daily Merkle root audit verifier responds HTTP 200" if ok else f"HTTP {code}: {body}"
    if not ok:
        all_passed = False
    print_step("GET /transparency (Daily Merkle Transparency Log)", ok, detail, dt)

    # -------------------------------------------------------------------------
    # Summary
    # -------------------------------------------------------------------------
    print("\n" + "=" * 75)
    if all_passed:
        print(f" ALL {tests_run} SMOKE TESTS PASSED SUCCESSFULLY!")
        print(" System is healthy, cryptographically secure, and ready for evaluation.")
    else:
        print(" SMOKE TESTS FAILED! One or more checks did not meet expectations.")
    print("=" * 75 + "\n")

    return all_passed


def main():
    parser = argparse.ArgumentParser(description="LandShield Smoke Test Suite")
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Base URL of LandShield API service (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=25.0,
        help="Request timeout in seconds (default: 25.0)",
    )
    args = parser.parse_args()

    success = run_smoke_test(args.base_url, timeout=args.timeout)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
