from sqlalchemy import select

from app.config import settings
from app.models.deed import Deed
from app.services.crypto import load_or_create_key, public_key_hex, sha256_hex, verify_sig
from app.services.ledger import verify_chain
from app.services.pipeline.base import AnalysisContext, Finding, Layer


class IntegrityLayer(Layer):
    name = "integrity"

    def analyze(self, ctx: AnalysisContext) -> list[Finding]:
        findings: list[Finding] = []
        plot_id = ctx.plot.id

        # 1. Verify cryptographic hash chain of the plot
        ok, reason, broken_seq = verify_chain(ctx.db, plot_id)
        if not ok:
            findings.append(
                Finding(
                    layer="integrity",
                    rule_id="R5",
                    sub_code="INTEGRITY",
                    severity="CRITICAL",
                    weight=100,
                    decisive=True,
                    reasons=[f"CHAIN_BROKEN: Plot hash chain verification failed at seq {broken_seq}: {reason}"],
                )
            )

        # 2. Verify individual ACTIVE deeds on the plot for payload hash and signature validity
        stmt = select(Deed).where(Deed.plot_id == plot_id, Deed.status == "ACTIVE")
        deeds = ctx.db.scalars(stmt).all()

        configured_pub_key = None
        sk = ctx.signer_key
        if sk is None:
            try:
                sk = load_or_create_key(settings.signing_key_path)
            except Exception:
                pass
        if sk is not None:
            try:
                configured_pub_key = public_key_hex(sk)
            except Exception:
                pass

        for deed in deeds:
            computed_hash = sha256_hex(deed.payload_json.encode("utf-8"))
            if computed_hash != deed.deed_hash:
                findings.append(
                    Finding(
                        layer="integrity",
                        rule_id="R5",
                        sub_code="INTEGRITY",
                        severity="CRITICAL",
                        weight=100,
                        decisive=True,
                        deed_no=deed.deed_no,
                        reasons=[f"HASH_MISMATCH: Deed {deed.deed_no} payload hash does not match stored deed_hash"],
                    )
                )

            if configured_pub_key and not verify_sig(configured_pub_key, deed.deed_hash, deed.signature):
                findings.append(
                    Finding(
                        layer="integrity",
                        rule_id="R5",
                        sub_code="INTEGRITY",
                        severity="CRITICAL",
                        weight=100,
                        decisive=True,
                        deed_no=deed.deed_no,
                        reasons=[f"BAD_SIGNATURE: Deed {deed.deed_no} Ed25519 signature verification failed"],
                    )
                )

        return findings
