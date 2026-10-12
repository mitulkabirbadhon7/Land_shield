import json
from sqlalchemy import select

from app.models.deed import Deed
from app.models.ledger import LedgerEntry
from app.services.holdings import TOLERANCE, ledger_holdings, record_holdings
from app.services.pipeline.base import AnalysisContext, DealSubject, Finding, Layer


class RulesLayer(Layer):
    name = "rules"

    def analyze(self, ctx: AnalysisContext) -> list[Finding]:
        findings: list[Finding] = []

        # Build subjects based on evaluation mode
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

        return findings
