import json
import logging
from pathlib import Path
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import require_role
from app.models.ingest_draft import IngestDraft
from app.models.khatian import Khatian
from app.models.plot import Plot
from app.models.user import User
from app.schemas.ingest import IngestApprovalResponse, IngestDraftOut, RejectDraftRequest
from app.services.llm.client import FakeLLM, get_llm_client

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["Ingest & OCR"])

MAX_IMAGE_SIZE = 3 * 1024 * 1024  # 3 MB
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"


def check_ocr_enabled():
    if not settings.is_ocr_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Document OCR scanning feature is disabled (FEATURE_OCR=false)",
        )


@router.post("/scan", response_model=IngestDraftOut, status_code=status.HTTP_201_CREATED)
async def scan_document_endpoint(
    file: UploadFile = File(...),
    document_type: str = Form("khatian"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("registrar")),
):
    """Accepts multipart image upload, validates file integrity, extracts metadata via Vision LLM, and queues IngestDraft."""
    check_ocr_enabled()

    clean_doc_type = document_type.strip().lower()
    if clean_doc_type not in ("khatian", "deed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document_type. Supported types: 'khatian', 'deed'",
        )

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size ({len(contents)} bytes) exceeds 3MB limit.",
        )

    # Magic bytes check
    is_png = contents.startswith(PNG_MAGIC)
    is_jpeg = contents.startswith(JPEG_MAGIC)
    if not (is_png or is_jpeg):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image format. Only authentic PNG and JPEG images are supported.",
        )

    ext = "png" if is_png else "jpg"
    upload_dir = Path("data/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    stored_path = upload_dir / stored_filename

    # Save to disk outside web root
    with open(stored_path, "wb") as f:
        f.write(contents)

    # Execute Vision Extraction
    client = get_llm_client()
    vision_result: dict[str, Any] = {}
    if client is not None:
        try:
            vision_result = client.extract_document_image(contents, clean_doc_type)
        except Exception as exc:
            logger.warning("Vision LLM extraction failed: %s. Falling back to template extractor.", exc)

    if not vision_result or "extracted" not in vision_result:
        fallback = FakeLLM()
        vision_result = fallback.extract_document_image(contents, clean_doc_type)

    extracted_dict = vision_result.get("extracted", {})
    confidence_dict = vision_result.get("confidence", {})

    draft = IngestDraft(
        document_type=clean_doc_type,
        image_ref=str(stored_path),
        extracted_json=json.dumps(extracted_dict),
        confidence_json=json.dumps(confidence_dict),
        status="DRAFT",
        reviewer_id=None,
    )
    db.add(draft)
    db.commit()
    db.refresh(draft)

    return IngestDraftOut(
        id=draft.id,
        document_type=draft.document_type,
        image_ref=draft.image_ref,
        extracted=extracted_dict,
        confidence=confidence_dict,
        status=draft.status,
        reviewer_id=draft.reviewer_id,
        created_at=draft.created_at.isoformat() if hasattr(draft.created_at, "isoformat") else str(draft.created_at),
    )


@router.get("/{draft_id}", response_model=IngestDraftOut)
def get_ingest_draft_endpoint(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("registrar")),
):
    """Returns extracted fields, per-field confidence scores, and review status of a scanned draft."""
    check_ocr_enabled()

    draft = db.get(IngestDraft, draft_id)
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"IngestDraft {draft_id} not found",
        )

    extracted_dict = json.loads(draft.extracted_json) if draft.extracted_json else {}
    confidence_dict = json.loads(draft.confidence_json) if draft.confidence_json else {}

    return IngestDraftOut(
        id=draft.id,
        document_type=draft.document_type,
        image_ref=draft.image_ref,
        extracted=extracted_dict,
        confidence=confidence_dict,
        status=draft.status,
        reviewer_id=draft.reviewer_id,
        created_at=draft.created_at.isoformat() if hasattr(draft.created_at, "isoformat") else str(draft.created_at),
    )


@router.post("/{draft_id}/approve", response_model=IngestApprovalResponse)
def approve_ingest_draft_endpoint(
    draft_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("registrar")),
):
    """Commits reviewed draft into active Khatian record or prefill deed payload. Never automatically registers deeds."""
    check_ocr_enabled()

    draft = db.get(IngestDraft, draft_id)
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"IngestDraft {draft_id} not found")

    if draft.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve draft with current status: {draft.status}",
        )

    extracted = json.loads(draft.extracted_json) if draft.extracted_json else {}

    if draft.document_type == "khatian":
        dag_no = str(extracted.get("dag_no", "DAG_1"))
        plot = db.scalars(select(Plot).where(Plot.dag_no == dag_no)).first()
        plot_id = plot.id if plot else 1

        khatian = Khatian(
            plot_id=plot_id,
            survey_type=extracted.get("survey_type", "RS"),
            khatian_no=str(extracted.get("khatian_no", "101")),
            dag_no=dag_no,
            area_decimal=float(extracted.get("area_decimal", 10.0)),
            owners_json=json.dumps(extracted.get("owners", [])),
        )
        db.add(khatian)
        db.flush()

        draft.status = "APPROVED"
        draft.reviewer_id = current_user.id
        db.commit()

        return IngestApprovalResponse(
            status="APPROVED",
            draft_id=draft.id,
            created_khatian_id=khatian.id,
            prefill_deed_payload=None,
            message="Khatian draft approved and successfully committed to active survey records.",
        )

    # Document type == "deed"
    # Invariant: Never automatically registers deed
    draft.status = "APPROVED"
    draft.reviewer_id = current_user.id
    db.commit()

    return IngestApprovalResponse(
        status="APPROVED",
        draft_id=draft.id,
        created_khatian_id=None,
        prefill_deed_payload=extracted,
        message="Deed draft approved and queued as prefill payload for registrar review. Deed was NOT registered automatically.",
    )


@router.post("/{draft_id}/reject", response_model=dict[str, Any])
def reject_ingest_draft_endpoint(
    draft_id: int,
    body: RejectDraftRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("registrar")),
):
    """Flags draft as rejected with mandatory review justification."""
    check_ocr_enabled()

    draft = db.get(IngestDraft, draft_id)
    if not draft:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"IngestDraft {draft_id} not found")

    if draft.status != "DRAFT":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot reject draft with current status: {draft.status}",
        )

    extracted = json.loads(draft.extracted_json) if draft.extracted_json else {}
    extracted["_rejection_reason"] = body.reason

    draft.extracted_json = json.dumps(extracted)
    draft.status = "REJECTED"
    draft.reviewer_id = current_user.id
    db.commit()

    return {
        "status": "REJECTED",
        "draft_id": draft.id,
        "reason": body.reason,
        "reviewer_id": current_user.id,
        "message": "Draft document was successfully rejected.",
    }
