from datetime import datetime, timezone
import json
from sqlalchemy import select

from app.config import settings
from app.models.case import Case
from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.models.mutation import Mutation
from app.services.holdings import TOLERANCE, ledger_holdings, record_holdings
from app.services.ledger import is_superseded
from app.services.pipeline.base import AnalysisContext, DealSubject, Finding, Layer


def _to_utc_datetime(val: datetime | str) -> datetime:
    if isinstance(val, str):
        dt = datetime.fromisoformat(val)
    else:
        dt = val
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class RulesLayer(Layer):
    name = "rules"

    def analyze(self, ctx: AnalysisContext) -> list[Finding]:
        findings: list[Finding] = []

        # ---------------------------------------------------------------------
        # 1. Subject-level rules: R1 (Oversold / Double Sale), R2 (Seller Not Owner)
        # ---------------------------------------------------------------------
        subjects: list[DealSubject] = []
        if ctx.mode == "PROPOSED":
            if ctx.proposed is not None:
                subjects = [ctx.proposed]
        else:
            # PLOT mode: replay history for all ACTIVE deeds in sequence order
            stmt = (
                select(LedgerEntry, Deed)
                .join(Deed, LedgerEntry.deed_id == Deed.id)
                .where(LedgerEntry.plot_id == ctx.plot.id)
                .order_by(LedgerEntry.seq.asc())
            )
            rows = ctx.db.execute(stmt).all()
            for entry, deed in rows:
                if deed.status != "ACTIVE":
                    continue
                try:
                    payload = json.loads(deed.payload_json)
                    reg_at = payload.get("registered_at", deed.registered_at)
                except Exception:
                    reg_at = deed.registered_at

                subjects.append(
                    DealSubject(
                        seller_id=deed.seller_id,
                        buyer_id=deed.buyer_id,
                        area_sold=float(deed.area_sold),
                        at=reg_at,
                        seq=entry.seq,
                        deed_no=deed.deed_no,
                    )
                )

        plot_area = float(ctx.plot.area_decimal)

        for subject in subjects:
            L = ledger_holdings(ctx.db, ctx.plot, before_seq=subject.seq)
            Rr = record_holdings(ctx.db, ctx.plot, as_of=subject.at, before_seq=subject.seq)

            l_seller = L.get(subject.seller_id, 0.0)
            rr_seller = Rr.get(subject.seller_id, 0.0)
            area_sold = float(subject.area_sold)

            deed_no = subject.deed_no if ctx.mode == "PLOT" else None
            r1_fired = False

            # R1 OVERSOLD: Sold area exceeds total plot area
            if area_sold > plot_area + TOLERANCE:
                findings.append(
                    Finding(
                        layer="rules",
                        rule_id="R1",
                        sub_code="OVERSOLD",
                        severity="CRITICAL",
                        weight=60,
                        decisive=True,
                        deed_no=deed_no,
                        reasons=[
                            f"R1_OVERSOLD: Sold area ({area_sold:.2f} dec) exceeds total plot area ({plot_area:.2f} dec)"
                        ],
                    )
                )
                r1_fired = True

            # R1 DOUBLE_SALE: L[seller] < area_sold <= Rr[seller]
            elif (l_seller < area_sold - TOLERANCE) and (area_sold <= rr_seller + TOLERANCE):
                findings.append(
                    Finding(
                        layer="rules",
                        rule_id="R1",
                        sub_code="DOUBLE_SALE",
                        severity="CRITICAL",
                        weight=60,
                        decisive=True,
                        deed_no=deed_no,
                        reasons=[
                            f"R1_DOUBLE_SALE: Seller has record holding ({rr_seller:.2f} dec) but insufficient ledger holding "
                            f"({l_seller:.2f} dec) for {area_sold:.2f} dec transfer. Land already committed in unmutated deed."
                        ],
                    )
                )
                r1_fired = True

            # R2 NOT_OWNER: L[seller] < area_sold and Rr[seller] < area_sold, and R1 did not fire
            if not r1_fired:
                if (l_seller < area_sold - TOLERANCE) and (rr_seller < area_sold - TOLERANCE):
                    findings.append(
                        Finding(
                            layer="rules",
                            rule_id="R2",
                            sub_code="NOT_OWNER",
                            severity="CRITICAL",
                            weight=60,
                            decisive=True,
                            deed_no=deed_no,
                            reasons=[
                                f"R2_SELLER_NOT_OWNER: Seller holding in ledger ({l_seller:.2f} dec) and record "
                                f"({rr_seller:.2f} dec) are both less than sold area ({area_sold:.2f} dec). Seller is not the owner."
                            ],
                        )
                    )

        # ---------------------------------------------------------------------
        # 2. Plot-level rule: R3 (Missing Mutation over N days)
        # ---------------------------------------------------------------------
        active_deeds_stmt = select(Deed).where(Deed.plot_id == ctx.plot.id, Deed.status == "ACTIVE")
        active_deeds = ctx.db.scalars(active_deeds_stmt).all()

        now_utc = _to_utc_datetime(ctx.now)
        for deed in active_deeds:
            deed_dt = _to_utc_datetime(deed.registered_at)
            age_days = (now_utc - deed_dt).total_seconds() / 86400.0

            if age_days > settings.mutation_days:
                # If deed is superseded by a subsequent deed, it has no ongoing mutation obligation
                if is_superseded(ctx.db, deed):
                    continue

                # Check if a completed mutation exists
                mutation_stmt = select(Mutation).where(
                    Mutation.deed_id == deed.id,
                    Mutation.state == "KHATIAN_UPDATED",
                )
                has_completed_mutation = ctx.db.scalars(mutation_stmt).first() is not None

                if not has_completed_mutation:
                    findings.append(
                        Finding(
                            layer="rules",
                            rule_id="R3",
                            sub_code="MISSING_MUTATION",
                            severity="MEDIUM",
                            weight=25,
                            decisive=True,
                            deed_no=deed.deed_no,
                            reasons=[
                                f"R3_MISSING_MUTATION: Active deed {deed.deed_no} registered {int(age_days)} days ago has no completed mutation (exceeds {settings.mutation_days} days limit)."
                            ],
                        )
                    )

        # ---------------------------------------------------------------------
        # 3. Plot-level rule: R4 (Rapid Transfers - sliding window 30 days)
        # ---------------------------------------------------------------------
        timestamps: list[datetime] = [_to_utc_datetime(d.registered_at) for d in active_deeds]
        if ctx.mode == "PROPOSED" and ctx.proposed is not None:
            timestamps.append(_to_utc_datetime(ctx.proposed.at))

        timestamps.sort()
        window_seconds = 30 * 86400.0
        rapid_detected = False
        for i in range(len(timestamps)):
            if i + 2 < len(timestamps):
                if (timestamps[i + 2] - timestamps[i]).total_seconds() <= window_seconds:
                    rapid_detected = True
                    break

        if rapid_detected:
            findings.append(
                Finding(
                    layer="rules",
                    rule_id="R4",
                    sub_code="RAPID_TRANSFERS",
                    severity="HIGH",
                    weight=35,
                    decisive=True,
                    deed_no=ctx.proposed.deed_no if ctx.mode == "PROPOSED" and ctx.proposed else None,
                    reasons=[
                        "R4_RAPID_TRANSFERS: 3 or more land transfers detected within a 30-day window on this plot."
                    ],
                )
            )

        # ---------------------------------------------------------------------
        # 4. Plot-level rule: R6 (Flagged Land / Khas / Acquisition / Active Case)
        # ---------------------------------------------------------------------
        flags = [f.strip().lower() for f in (ctx.plot.flags or [])]
        flag_triggers = [f for f in flags if f in ["khas", "acquisition", "disputed"]]

        case_stmt = select(Case).where(
            Case.plot_id == ctx.plot.id,
            Case.status.in_(["PENDING", "OPEN", "ACTIVE", "FILED", "HEARING"]),
        )
        open_cases = ctx.db.scalars(case_stmt).all()

        if flag_triggers or open_cases:
            r6_reasons: list[str] = []
            if flag_triggers:
                r6_reasons.append(
                    f"R6_FLAGGED_LAND: Plot has governmental restriction flags: {', '.join(flag_triggers)}"
                )
            if open_cases:
                case_numbers = [c.case_no for c in open_cases]
                r6_reasons.append(
                    f"R6_FLAGGED_LAND: Plot has active court dispute case(s): {', '.join(case_numbers)}"
                )

            findings.append(
                Finding(
                    layer="rules",
                    rule_id="R6",
                    sub_code="FLAGGED_LAND",
                    severity="HIGH",
                    weight=40,
                    decisive=True,
                    reasons=r6_reasons,
                )
            )

        return findings
