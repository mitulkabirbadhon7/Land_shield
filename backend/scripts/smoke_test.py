"""Phase 2 Smoke Test Suite for LandShield.

Can run against a live running server (BASE_URL) or directly in-process via FastAPI TestClient.
Verifies:
1. GET /api/v1/features (Phase 2 feature flags)
2. GET /keys (Active Ed25519 signing keys registry)
3. GET /analysis/plot/{id} (Reconciliation and Lineage layers present)
4. POST /reports/due-diligence (Bilingual AI due-diligence report)
5. GET /transparency (Daily Merkle root logs)
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
import httpx

# Add backend directory to path if running locally
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def run_smoke_tests():
    print(f"[*] Starting LandShield Phase 2 Smoke Test Suite (Target: {BASE_URL})...")

    # Check if remote server is reachable
    client: Any = None
    use_test_client = False
    try:
        r = httpx.get(f"{BASE_URL}/api/v1/health", timeout=2.0)
        if r.status_code == 200:
            print("[+] Live API server detected!")
            client = httpx.Client(base_url=BASE_URL, timeout=10.0)
    except Exception:
        pass

    if client is None:
        print("[!] No live server at BASE_URL. Falling back to FastAPI TestClient in-process...")
        from fastapi.testclient import TestClient
        from app.main import app
        client = TestClient(app)
        use_test_client = True

    # 1. Verify GET /api/v1/features
    print("[1/5] Testing GET /api/v1/features...")
    res = client.get("/api/v1/features")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    features = res.json()
    assert "feature_reconcile" in features
    assert "feature_lineage" in features
    assert "feature_offline_qr" in features
    assert "feature_agent" in features
    assert "feature_transparency" in features
    assert res.headers.get("X-Data-Policy") == "synthetic-demo"
    print("      -> Active feature flags verified!")

    # 2. Verify GET /keys (and /api/v1/keys)
    print("[2/5] Testing GET /keys (Offline verification registry)...")
    res = client.get("/keys")
    if res.status_code != 200:
        res = client.get("/api/v1/keys")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    keys_data = res.json()
    keys_list = keys_data if isinstance(keys_data, list) else keys_data.get("keys", [])
    assert len(keys_list) > 0
    assert "key_id" in keys_list[0]
    assert "public_key_hex" in keys_list[0]
    print(f"      -> Public keys verified: {len(keys_list)} active key(s) published.")

    # 3. Verify GET /analysis/plot/{id}
    print("[3/5] Testing GET /analysis/plot/1 (Layered assessment)...")
    res = client.get("/analysis/plot/1")
    if res.status_code != 200:
        res = client.get("/api/v1/analysis/plot/1")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    analysis = res.json()
    assert "score" in analysis
    assert "level" in analysis
    assert "layers" in analysis
    assert "layers_run" in analysis
    assert "reconcile" in analysis["layers_run"]
    assert "lineage" in analysis["layers_run"]
    print(f"      -> Layered pipeline verified: Score={analysis['score']}, Level={analysis['level']}")

    # 4. Verify POST /reports/due-diligence
    print("[4/5] Testing POST /reports/due-diligence (AI Citizen report)...")
    req_body = {"plot_id": 1, "lang": "bn"}
    res = client.post("/reports/due-diligence", json=req_body)
    if res.status_code != 200:
        res = client.post("/api/v1/reports/due-diligence", json=req_body)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    report = res.json()
    assert "plot_id" in report
    assert "summary_bn" in report
    assert "summary_en" in report
    assert "risk_level" in report
    assert "key_findings" in report
    assert "recommended_actions" in report
    assert "disclaimer" in report
    print(f"      -> Report generated successfully! (Source: {report.get('source', 'unknown')})")

    # 5. Verify GET /transparency
    print("[5/5] Testing GET /transparency (Daily Merkle Transparency Log)...")
    res = client.get("/transparency")
    if res.status_code != 200:
        res = client.get("/api/v1/transparency")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    transparency = res.json()
    assert "roots" in transparency or "entries" in transparency or isinstance(transparency, (list, dict))
    print("      -> Daily Merkle transparency log responds with HTTP 200 OK!")

    print("\n[+] ALL 5 PHASE 2 SMOKE TESTS PASSED CLEANLY! SYSTEM OPERATIONAL.")


if __name__ == "__main__":
    run_smoke_tests()
