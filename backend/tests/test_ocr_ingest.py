import io
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.deed import Deed
from app.models.ingest_draft import IngestDraft
from app.models.khatian import Khatian
from app.models.plot import Plot
from app.models.user import User
from app.security import create_access_token


@pytest.fixture
def auth_headers(db_session: Session):
    reg_user = User(name="Registrar OCR User", username="reg_ocr_user", role="registrar", password_hash="dummy_hash")
    db_session.add(reg_user)
    db_session.commit()

    token = create_access_token("reg_ocr_user", role="registrar")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def enable_ocr():
    orig_ocr = settings.feature_ocr
    settings.feature_ocr = True
    yield
    settings.feature_ocr = orig_ocr


def test_ingest_gated_by_feature_flag(client: TestClient, auth_headers: dict):
    orig_ocr = settings.feature_ocr
    settings.feature_ocr = False
    try:
        res = client.get("/api/v1/ingest/1", headers=auth_headers)
        assert res.status_code == 403
        assert "disabled" in res.json()["detail"].lower()
    finally:
        settings.feature_ocr = orig_ocr


def test_ingest_requires_registrar_role(client: TestClient, db_session: Session, enable_ocr):
    # Anonymous request
    res_anon = client.get("/api/v1/ingest/1")
    assert res_anon.status_code == 401

    # Unauthorized role
    off_user = User(name="Officer User", username="officer_user", role="officer", password_hash="dummy_hash")
    db_session.add(off_user)
    db_session.commit()

    officer_token = create_access_token("officer_user", role="officer")
    res_officer = client.get("/api/v1/ingest/1", headers={"Authorization": f"Bearer {officer_token}"})
    assert res_officer.status_code == 403


def test_upload_validations(client: TestClient, enable_ocr, auth_headers: dict):
    # 1. Invalid document type
    dummy_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    res_bad_type = client.post(
        "/api/v1/ingest/scan",
        headers=auth_headers,
        data={"document_type": "invalid_type"},
        files={"file": ("test.png", dummy_png, "image/png")},
    )
    assert res_bad_type.status_code == 400
    assert "invalid document_type" in res_bad_type.json()["detail"].lower()

    # 2. Invalid magic bytes (e.g. text file disguised as png)
    fake_png = b"THIS IS NOT A REAL PNG IMAGE HEADER"
    res_bad_magic = client.post(
        "/api/v1/ingest/scan",
        headers=auth_headers,
        data={"document_type": "khatian"},
        files={"file": ("fake.png", fake_png, "image/png")},
    )
    assert res_bad_magic.status_code == 400
    assert "invalid image format" in res_bad_magic.json()["detail"].lower()

    # 3. File size exceeds 3MB
    huge_payload = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (3 * 1024 * 1024 + 10))
    res_huge = client.post(
        "/api/v1/ingest/scan",
        headers=auth_headers,
        data={"document_type": "khatian"},
        files={"file": ("huge.png", huge_payload, "image/png")},
    )
    assert res_huge.status_code == 400
    assert "exceeds 3mb" in res_huge.json()["detail"].lower()


def test_scan_and_approve_khatian_draft(client: TestClient, db_session: Session, enable_ocr, auth_headers: dict):
    # Create test plot
    plot = Plot(
        mouza="Mirpur",
        upazila="Mirpur",
        district="Dhaka",
        dag_no="1201",
        area_decimal=12.50,
        initial_owner_id=1,
        current_owner_id=1,
    )
    db_session.add(plot)
    db_session.commit()

    sample_doc_path = Path("data/dummy_docs/khatian_rs_102.png")
    if sample_doc_path.exists():
        img_bytes = sample_doc_path.read_bytes()
    else:
        img_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 500

    # 1. Scan upload
    res = client.post(
        "/api/v1/ingest/scan",
        headers=auth_headers,
        data={"document_type": "khatian"},
        files={"file": ("khatian.png", img_bytes, "image/png")},
    )
    assert res.status_code == 201
    draft_data = res.json()
    assert draft_data["status"] == "DRAFT"
    assert draft_data["document_type"] == "khatian"
    assert "extracted" in draft_data
    assert "confidence" in draft_data
    assert draft_data["confidence"]["overall"] > 0.8
    draft_id = draft_data["id"]

    # 2. Get Draft
    res_get = client.get(f"/api/v1/ingest/{draft_id}", headers=auth_headers)
    assert res_get.status_code == 200
    assert res_get.json()["id"] == draft_id

    # 3. Approve Khatian Draft -> Commits to active Khatian table
    khatian_count_before = db_session.scalar(select(Khatian).count()) if hasattr(select(Khatian), "count") else len(db_session.scalars(select(Khatian)).all())
    res_approve = client.post(f"/api/v1/ingest/{draft_id}/approve", headers=auth_headers)
    assert res_approve.status_code == 200
    app_data = res_approve.json()
    assert app_data["status"] == "APPROVED"
    assert app_data["created_khatian_id"] is not None

    # Verify Khatian record was committed
    khatian_rec = db_session.get(Khatian, app_data["created_khatian_id"])
    assert khatian_rec is not None
    assert khatian_rec.plot_id == plot.id
    assert khatian_rec.survey_type == "RS"


def test_scan_and_reject_draft(client: TestClient, enable_ocr, auth_headers: dict):
    dummy_jpeg = b"\xff\xd8\xff" + b"\x00" * 300
    res = client.post(
        "/api/v1/ingest/scan",
        headers=auth_headers,
        data={"document_type": "khatian"},
        files={"file": ("scan.jpg", dummy_jpeg, "image/jpeg")},
    )
    assert res.status_code == 201
    draft_id = res.json()["id"]

    # Reject draft
    res_reject = client.post(
        f"/api/v1/ingest/{draft_id}/reject",
        headers=auth_headers,
        json={"reason": "Watermark obscured and owner details unreadable"},
    )
    assert res_reject.status_code == 200
    assert res_reject.json()["status"] == "REJECTED"

    # Subsequent approve must fail
    res_app_again = client.post(f"/api/v1/ingest/{draft_id}/approve", headers=auth_headers)
    assert res_app_again.status_code == 400


def test_deed_draft_approval_never_auto_registers(client: TestClient, db_session: Session, enable_ocr, auth_headers: dict):
    """Hard invariant test: approving a deed draft must NEVER create a registered Deed row."""
    dummy_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 500

    deeds_before = len(db_session.scalars(select(Deed)).all())

    res = client.post(
        "/api/v1/ingest/scan",
        headers=auth_headers,
        data={"document_type": "deed"},
        files={"file": ("deed_scan.png", dummy_png, "image/png")},
    )
    assert res.status_code == 201
    draft_id = res.json()["id"]

    # Approve deed draft
    res_approve = client.post(f"/api/v1/ingest/{draft_id}/approve", headers=auth_headers)
    assert res_approve.status_code == 200
    data = res_approve.json()

    assert data["status"] == "APPROVED"
    assert data["created_khatian_id"] is None
    assert data["prefill_deed_payload"] is not None
    assert "NOT registered automatically" in data["message"]

    # Assert ZERO new deeds in database
    deeds_after = len(db_session.scalars(select(Deed)).all())
    assert deeds_after == deeds_before, "CRITICAL INVARIANT VIOLATION: Ingest auto-registered a deed!"
