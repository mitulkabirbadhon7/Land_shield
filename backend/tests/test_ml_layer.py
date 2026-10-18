from datetime import datetime, timezone
from pathlib import Path
import pytest
from sqlalchemy.orm import Session

from app.models.person import Person
from app.models.plot import Plot
from app.services.fraud.ml_layer import MLLayer
from app.services.pipeline.base import AnalysisContext, DealSubject, Finding
from app.services.pipeline.engine import apply_ml_bump, assess


def test_ml_layer_missing_model_graceful_bypass(db_session):
    layer = MLLayer(model_path="nonexistent/path/model.joblib")
    assert layer.model_loaded is False

    plot = Plot(
        mouza="Mirpur",
        upazila="Mirpur",
        district="Dhaka",
        dag_no="DAG_999",
        area_decimal=10.0,
        initial_owner_id=1,
        current_owner_id=1,
    )
    db_session.add(plot)
    db_session.commit()

    ctx = AnalysisContext(db=db_session, plot=plot)
    findings = layer.analyze(ctx)
    assert findings == []


def test_ml_advisory_score_bump_rules():
    dummy_findings = [
        Finding(layer="ml", rule_id="ML1", severity="INFO", weight=0, decisive=False)
    ]

    # LOW bumped to MEDIUM at >= 0.85
    assert apply_ml_bump("LOW", dummy_findings, 0.85) == "MEDIUM"
    assert apply_ml_bump("LOW", dummy_findings, 0.95) == "MEDIUM"

    # MEDIUM bumped to HIGH at >= 0.85
    assert apply_ml_bump("MEDIUM", dummy_findings, 0.88) == "HIGH"

    # HIGH can NEVER bump to CRITICAL
    assert apply_ml_bump("HIGH", dummy_findings, 0.99) == "HIGH"

    # CRITICAL remains CRITICAL
    assert apply_ml_bump("CRITICAL", dummy_findings, 0.99) == "CRITICAL"

    # Below 0.85 does NOT bump
    assert apply_ml_bump("LOW", dummy_findings, 0.84) == "LOW"
    assert apply_ml_bump("MEDIUM", dummy_findings, 0.60) == "MEDIUM"

    # ML CANNOT lower a score
    assert apply_ml_bump("HIGH", dummy_findings, 0.05) == "HIGH"
    assert apply_ml_bump("CRITICAL", dummy_findings, 0.01) == "CRITICAL"


def test_ml_never_overrides_deterministic_integrity_failures(db_session):
    plot = Plot(
        mouza="Mirpur",
        upazila="Mirpur",
        district="Dhaka",
        dag_no="DAG_100",
        area_decimal=10.0,
        initial_owner_id=1,
        current_owner_id=1,
    )
    db_session.add(plot)
    db_session.commit()

    ctx = AnalysisContext(
        db=db_session,
        plot=plot,
        proposed=DealSubject(seller_id=1, buyer_id=2, area_sold=5.0, at=datetime.now(timezone.utc)),
    )

    class MockIntegrityFailureLayer:
        name = "integrity"
        def is_enabled(self): return True
        def analyze(self, c):
            return [
                Finding(
                    layer="integrity",
                    rule_id="R5",
                    severity="CRITICAL",
                    weight=100,
                    decisive=True,
                    reasons=["Ledger chain broken"],
                )
            ]

    # Even if ML returns 0.0 probability
    class MockLowMLLayer:
        name = "ml"
        def is_enabled(self): return True
        def analyze(self, c):
            c.ml_result = {"probability": 0.01, "top_reasons": []}
            return [
                Finding(layer="ml", rule_id="ML1", severity="INFO", weight=0, decisive=False)
            ]

    report = assess(ctx, [MockIntegrityFailureLayer(), MockLowMLLayer()])
    assert report["score"] == 100
    assert report["level"] == "CRITICAL"
    assert report["blocked"] is True
    assert report["ml"]["probability"] == 0.01


def test_ml_layer_real_inference_and_report_payload(db_session):
    seller = Person(display_name="Seller A", is_synthetic=True)
    buyer = Person(display_name="Buyer B", is_synthetic=True)
    db_session.add_all([seller, buyer])
    db_session.commit()

    plot = Plot(
        mouza="Mirpur",
        upazila="Mirpur",
        district="Dhaka",
        dag_no="DAG_ML_TEST",
        area_decimal=15.0,
        initial_owner_id=seller.id,
        current_owner_id=seller.id,
    )
    db_session.add(plot)
    db_session.commit()

    from app.config import settings
    orig_ml_flag = settings.feature_ml
    settings.feature_ml = True
    try:
        layer = MLLayer()
        if not layer.model_loaded:
            pytest.skip("model.joblib not present in test environment")

        ctx = AnalysisContext(
            db=db_session,
            plot=plot,
            proposed=DealSubject(
                seller_id=seller.id,
                buyer_id=buyer.id,
                area_sold=10.0,
                at=datetime(2026, 3, 1, 14, 0, tzinfo=timezone.utc),
            ),
        )

        report = assess(ctx, [layer])

        assert "ml" in report
        assert report["ml"] is not None
        assert "probability" in report["ml"]
        assert 0.0 <= report["ml"]["probability"] <= 1.0
        assert "top_reasons" in report["ml"]
        assert len(report["ml"]["top_reasons"]) <= 3
    finally:
        settings.feature_ml = orig_ml_flag
