from sqlalchemy import select

from app.config import settings
from app.models.deed import Deed
from app.services.crypto import key_id, load_or_create_key, public_key_hex, sha256_hex, verify_sig
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

        active_keys: dict[str, str] = {}
        if ctx.db:
            try:
                from app.models.signing_key import SigningKey
                rows = ctx.db.scalars(
                    select(SigningKey).where(SigningKey.status == "ACTIVE")
                ).all()
                for r in rows:
                    active_keys[r.key_id] = r.public_key_hex
            except Exception:
                pass

        sk = ctx.signer_key
        if sk is None:
            try:
                sk = load_or_create_key(settings.signing_key_path)
            except Exception:
                pass
        if sk is not None:
            try:
                active_keys[key_id(sk)] = public_key_hex(sk)
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

            # Check if signature is valid against the deed's signer_key_id or any registered active key
            is_valid_sig = False
            pub_key = active_keys.get(deed.signer_key_id) if deed.signer_key_id else None
            if pub_key:
                is_valid_sig = verify_sig(pub_key, deed.deed_hash, deed.signature)
            elif active_keys:
                is_valid_sig = any(verify_sig(pk, deed.deed_hash, deed.signature) for pk in active_keys.values())

            if not is_valid_sig:
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
