import json
import time
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from scripts.attack_suite import run_attack_suite, verify_safety_in_memory_only
from scripts.evaluate import evaluate_benchmarks


def test_attack_suite_safety_invariant():
    # In-memory URLs should pass without exception
    verify_safety_in_memory_only("sqlite:///:memory:")
    verify_safety_in_memory_only("sqlite://?mode=memory&cache=shared")

    # Non-local / persistent URLs must raise RuntimeError
    with pytest.raises(RuntimeError) as exc_info:
        verify_safety_in_memory_only("postgresql://user:pass@production-host:5432/landshield")
    assert "SAFETY ABORT" in str(exc_info.value)

    with pytest.raises(RuntimeError) as exc_info_sqlite:
        verify_safety_in_memory_only("sqlite:///production_land.db")
    assert "SAFETY ABORT" in str(exc_info_sqlite.value)


def test_attack_suite_execution_and_speed():
    start = time.time()
    # Execute 5 iterations per vector for fast unit test verification
    results = run_attack_suite(iterations_per_vector=5)
    duration = time.time() - start

    assert duration < 60.0, f"Attack suite took too long: {duration}s"
    assert results["overall_detection_rate_pct"] == 100.0
    assert results["total_attacks"] == 45  # 9 vectors * 5 iterations
    assert results["total_detected"] == 45
    assert len(results["vectors"]) == 9

    for code in ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8", "A9"]:
        assert code in results["vectors"]
        assert results["vectors"][code]["detection_rate_pct"] == 100.0


def test_evaluate_script_output_and_metrics(tmp_path: Path):
    tmp_metrics = tmp_path / "metrics.json"
    data = evaluate_benchmarks(export_json_path=str(tmp_metrics))

    assert tmp_metrics.exists()
    assert data["benchmark_dataset"]["total_plots"] == 300
    assert data["benchmark_dataset"]["clean_plots"] == 210
    assert data["benchmark_dataset"]["anomalous_plots"] == 90

    # Assert rigorous empirical accuracy
    med = data["medium_threshold"]
    assert med["precision"] >= 0.90
    assert med["recall"] >= 0.95
    assert med["fpr"] <= 0.05
    assert med["f1_score"] >= 0.90


def test_public_metrics_endpoint(client: TestClient):
    # Ensure file exists
    evaluate_benchmarks()

    resp = client.get("/api/v1/metrics")
    assert resp.status_code == 200
    data = resp.json()
    assert data["benchmark_dataset"]["total_plots"] == 300
    assert "medium_threshold" in data
    assert "high_threshold" in data
    assert "category_detection_rates" in data
