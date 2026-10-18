import json
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.khatian import Khatian
from app.services.fraud.explain import TEMPLATES
from app.services.pipeline.base import AnalysisContext, Finding, Layer
from app.utils.privacy import person_view

SURVEY_ORDER: dict[str, int] = {
    "CS": 1,
    "SA": 2,
    "RS": 3,
    "BS": 4,
}
ORDER_TO_SURVEY: dict[int, str] = {v: k for k, v in SURVEY_ORDER.items()}


def _mask_owners(raw_owners_json: str | None, viewer: Any = None) -> list[dict[str, Any]]:
    """Parse owners JSON string and serialize owner views using person_view."""
    if not raw_owners_json:
        return []
    try:
        data = json.loads(raw_owners_json)
        if isinstance(data, list):
            res: list[dict[str, Any]] = []
            for item in data:
                if isinstance(item, dict):
                    name = item.get("name", "")
                    share = item.get("share", 1.0)
                    pv = person_view(str(name), viewer)
                    res.append({"name": pv.name, "share": share})
                elif isinstance(item, str):
                    pv = person_view(item, viewer)
                    res.append({"name": pv.name, "share": 1.0})
            return res
    except Exception:
        pass
    return []


def check_lineage(
    khatians: list[Khatian],
    tolerance: float = 0.05,
) -> list[tuple[str, str, dict[str, Any]]]:
    """Audit historical survey chains (CS -> SA -> RS -> BS) for gaps and discrepancies per TRD 6C.

    Sub-codes:
    - MISSING_GENERATION: present survey types are not contiguous between earliest and latest
    - ORPHAN: a khatian that is not of earliest present type has no parent
    - BAD_PARENT: parent is not of an earlier survey type
    - AREA_GROWTH: child area > parent area * (1.0 + tolerance)
    """
    if not khatians:
        return []

    issues: list[tuple[str, str, dict[str, Any]]] = []
    khatian_by_id = {k.id: k for k in khatians}

    # Distinct valid survey types present in order
    present_order_types = sorted(
        list(set(k.survey_type.upper() for k in khatians if k.survey_type.upper() in SURVEY_ORDER)),
        key=lambda s: SURVEY_ORDER[s],
    )

    if present_order_types:
        earliest_type = present_order_types[0]
        latest_type = present_order_types[-1]
        min_order = SURVEY_ORDER[earliest_type]
        max_order = SURVEY_ORDER[latest_type]

        # 1. MISSING_GENERATION: check contiguous survey chain between earliest and latest
        missing = [
            ORDER_TO_SURVEY[o]
            for o in range(min_order, max_order + 1)
            if ORDER_TO_SURVEY[o] not in present_order_types
        ]
        if missing:
            issues.append((
                "MISSING_GENERATION",
                f"Survey lineage gap: missing intermediate survey generation(s) {', '.join(missing)} between {earliest_type} and {latest_type}",
                {"missing": missing, "earliest": earliest_type, "latest": latest_type},
            ))

        # 2. ORPHAN: non-earliest khatian has no parent
        for k in khatians:
            st = k.survey_type.upper()
            if st != earliest_type:
                if k.parent_id is None or k.parent_id not in khatian_by_id:
                    issues.append((
                        "ORPHAN",
                        f"{k.survey_type} survey khatian #{k.khatian_no} has no documented parent in earlier surveys",
                        {"khatian_id": k.id, "survey_type": k.survey_type, "khatian_no": k.khatian_no},
                    ))

    # 3. BAD_PARENT & 4. AREA_GROWTH
    for k in khatians:
        if k.parent_id is not None and k.parent_id in khatian_by_id:
            parent = khatian_by_id[k.parent_id]
            p_order = SURVEY_ORDER.get(parent.survey_type.upper(), 0)
            c_order = SURVEY_ORDER.get(k.survey_type.upper(), 0)

            # BAD_PARENT: parent survey order >= child survey order
            if p_order >= c_order:
                issues.append((
                    "BAD_PARENT",
                    f"{k.survey_type} survey khatian #{k.khatian_no} references parent #{parent.khatian_no} from non-earlier survey {parent.survey_type}",
                    {
                        "khatian_id": k.id,
                        "parent_id": parent.id,
                        "parent_survey": parent.survey_type,
                        "child_survey": k.survey_type,
                    },
                ))

            # AREA_GROWTH: child area > parent area * (1.0 + tolerance)
            max_allowed = float(parent.area_decimal) * (1.0 + tolerance)
            if float(k.area_decimal) > max_allowed:
                issues.append((
                    "AREA_GROWTH",
                    f"Unjustified area expansion in {k.survey_type} khatian #{k.khatian_no} ({k.area_decimal} decimals) compared to parent {parent.survey_type} #{parent.khatian_no} ({parent.area_decimal} decimals)",
                    {
                        "khatian_id": k.id,
                        "parent_id": parent.id,
                        "child_area": float(k.area_decimal),
                        "parent_area": float(parent.area_decimal),
                        "max_allowed": round(max_allowed, 4),
                    },
                ))

    return issues


def get_lineage(
    db: Session,
    plot_id: int,
    tolerance: float | None = None,
    viewer: Any = None,
) -> dict[str, Any]:
    """Retrieve full survey lineage directed acyclic graph and audit report for a plot."""
    khatians = db.scalars(
        select(Khatian).where(Khatian.plot_id == plot_id).order_by(Khatian.id.asc())
    ).all()

    if not khatians:
        return {
            "plot_id": plot_id,
            "lineage_available": False,
            "nodes": [],
            "edges": [],
            "issues": [],
            "status": "NO_DATA",
        }

    eff_tolerance = tolerance if tolerance is not None else getattr(settings, "lineage_area_tolerance", 0.05)
    raw_issues = check_lineage(khatians, tolerance=eff_tolerance)
    khatian_by_id = {k.id: k for k in khatians}

    nodes: list[dict[str, Any]] = []
    for k in khatians:
        nodes.append({
            "id": k.id,
            "survey_type": k.survey_type,
            "khatian_no": k.khatian_no,
            "dag_no": k.dag_no,
            "area_decimal": float(k.area_decimal),
            "parent_id": k.parent_id,
            "created_at": k.created_at.isoformat() if k.created_at else None,
            "owners": _mask_owners(k.owners_json, viewer),
        })

    edges: list[dict[str, Any]] = []
    for k in khatians:
        if k.parent_id is not None and k.parent_id in khatian_by_id:
            parent = khatian_by_id[k.parent_id]
            edges.append({
                "from": k.parent_id,
                "to": k.id,
                "type": f"{parent.survey_type}->{k.survey_type}",
            })

    issue_objects: list[dict[str, Any]] = []
    for sub_code, default_msg, details in raw_issues:
        tmpl = TEMPLATES.get(sub_code, {})
        issue_objects.append({
            "sub_code": sub_code,
            "rule_id": "R7",
            "severity": "HIGH",
            "message_en": tmpl.get("en", default_msg),
            "message_bn": tmpl.get("bn", default_msg),
            "details": details,
        })

    return {
        "plot_id": plot_id,
        "lineage_available": True,
        "nodes": nodes,
        "edges": edges,
        "issues": issue_objects,
        "status": "DISCREPANCY" if issue_objects else "ALIGNED",
    }


class LineageLayer(Layer):
    name = "lineage"
    enabled_flag = "feature_lineage"

    def analyze(self, ctx: AnalysisContext) -> list[Finding]:
        khatians = ctx.db.scalars(
            select(Khatian).where(Khatian.plot_id == ctx.plot.id).order_by(Khatian.id.asc())
        ).all()

        ctx.lineage_available = bool(khatians)

        if not khatians:
            return []

        tolerance = getattr(settings, "lineage_area_tolerance", 0.05)
        raw_issues = check_lineage(khatians, tolerance=tolerance)

        findings: list[Finding] = []
        for sub_code, msg, _details in raw_issues:
            findings.append(
                Finding(
                    layer="lineage",
                    rule_id="R7",
                    sub_code=sub_code,
                    severity="HIGH",
                    weight=35,
                    decisive=True,
                    reasons=[msg],
                )
            )

        return findings
