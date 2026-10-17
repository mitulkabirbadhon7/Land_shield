import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.services.pipeline.base import AnalysisContext, Finding, Layer
from app.services.pipeline.engine import assess


@pytest.fixture
def client():
    return TestClient(app)


def test_features_endpoint(client):
    """GET /api/v1/features returns the expected runtime feature flags."""
    resp = client.get("/api/v1/features")
    assert resp.status_code == 200
    data = resp.json()
    assert "feature_reconcile" in data
    assert "feature_lineage" in data
    assert "feature_offline_qr" in data
    assert "feature_agent" in data
    assert "feature_transparency" in data
    assert "feature_ml" in data
    assert "feature_ocr" in data
    assert data["feature_reconcile"] is True
    assert data["feature_lineage"] is True
    assert data["feature_offline_qr"] is True
    assert data["feature_agent"] is True
    assert data["feature_transparency"] is True
    assert data["feature_ml"] is False
    assert data["feature_ocr"] is False


def test_layer_is_enabled_respects_settings(monkeypatch):
    """Layer.is_enabled() correctly reflects the configured settings flag."""
    class DummyLayer(Layer):
        name = "test_layer"
        enabled_flag = "feature_ml"

        def analyze(self, ctx):
            return [
                Finding(
                    layer="test_layer",
                    rule_id="T1",
                    severity="LOW",
                    weight=10,
                    decisive=True,
                )
            ]

    layer = DummyLayer()
    monkeypatch.setattr(settings, "feature_ml", False)
    assert layer.is_enabled() is False

    monkeypatch.setattr(settings, "feature_ml", True)
    assert layer.is_enabled() is True


def test_assess_tracks_layers_run_and_bypasses_disabled(monkeypatch):
    """Pipeline engine assess() tracks layers_run and skips disabled layers."""
    class ActiveLayer(Layer):
        name = "active_layer"
        enabled_flag = ""

        def analyze(self, ctx):
            return [
                Finding(
                    layer="active_layer",
                    rule_id="ACT1",
                    severity="LOW",
                    weight=5,
                    decisive=True,
                )
            ]

    class DisabledLayer(Layer):
        name = "disabled_layer"
        enabled_flag = "feature_ml"

        def analyze(self, ctx):
            return [
                Finding(
                    layer="disabled_layer",
                    rule_id="DIS1",
                    severity="CRITICAL",
                    weight=90,
                    decisive=True,
                )
            ]

    monkeypatch.setattr(settings, "feature_ml", False)

    class DummyContext:
        mode = "PLOT"
        lineage_available = False

    report = assess(DummyContext(), [ActiveLayer(), DisabledLayer()])
    assert report["layers_run"] == ["active_layer"]
    assert "active_layer" in report["layers"]
    assert "disabled_layer" not in report["layers"]
    assert report["score"] == 5


def test_analysis_plot_extended_fields(client, db_session):
    """GET /analysis/plot/{id} includes extended Phase 2 fields while /risk/plot/{id} preserves Round 1 shape."""
    from app.models.plot import Plot
    from app.models.person import Person

    person = Person(display_name="Test Owner", masked_nid_hash="hash1", is_synthetic=True)
    db_session.add(person)
    db_session.flush()

    plot = Plot(
        dag_no="1234",
        mouza="Tejgaon",
        upazila="Dhaka",
        district="Dhaka",
        area_decimal=10.0,
        land_type="NAL",
        initial_owner_id=person.id,
        current_owner_id=person.id,
    )
    db_session.add(plot)
    db_session.commit()

    # Public risk endpoint maintains Round 1 response
    risk_resp = client.get(f"/api/v1/risk/plot/{plot.id}")
    assert risk_resp.status_code == 200
    risk_data = risk_resp.json()
    assert "score" in risk_data
    assert "level" in risk_data
    assert "has_critical" in risk_data
    assert "findings" in risk_data
    assert "mutation_summary" in risk_data
    # Round 1 risk report does NOT leak extra keys in its schema
    assert "layers_run" not in risk_data

    # Extended analysis endpoint includes extended Phase 2 fields
    analysis_resp = client.get(f"/api/v1/analysis/plot/{plot.id}")
    assert analysis_resp.status_code == 200
    analysis_data = analysis_resp.json()
    assert "score" in analysis_data
    assert "level" in analysis_data
    assert "layers" in analysis_data
    assert "layers_run" in analysis_data
    assert "lineage_available" in analysis_data
    assert isinstance(analysis_data["layers_run"], list)
    assert isinstance(analysis_data["layers"], dict)
