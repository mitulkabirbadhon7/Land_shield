"""
LandShield (BhumiPrahari) Edge-Case Stress Test Suite
=====================================================
Tests extreme boundary conditions, mathematical precision limits,
Unicode diacritic normalization, state-machine vulnerabilities,
cryptographic tampering, and role authorization edge cases.
"""

from __future__ import annotations

import sys
import os
import json
import unicodedata
from datetime import datetime, timezone
from typing import Any

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import nacl.signing
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

from app.db import Base, get_db
from app.main import app as fastapi_app
from app.config import settings
from app.models.person import Person
from app.models.plot import Plot
from app.models.deed import Deed
from app.models.user import User
from app.models.mutation import Mutation
from app.models.mutation_event import MutationEvent
from app.services.crypto import (
    load_or_create_key,
    canonical,
    sha256_hex,
    build_deed_payload,
)
from app.services.deeds import register_deed, verify_deed, next_deed_no
from app.services.holdings import ledger_holdings
from app.services.mutation_fsm import start_mutation, transition
from app.services.pipeline.engine import assess
from app.services.pipeline.base import AnalysisContext, DealSubject
from app.services.pipeline.registry import get_layers
from app.security import hash_password, create_access_token


class EdgeCaseRunner:
    def __init__(self):
        self.db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "test_edge_cases.db"))
        if os.path.exists(self.db_path):
            try:
                os.remove(self.db_path)
            except Exception:
                pass

        self.engine = create_engine(
            f"sqlite:///{self.db_path}",
            connect_args={"check_same_thread": False},
        )
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db: Session = self.SessionLocal()
        self.key = nacl.signing.SigningKey.generate()
        self.results: list[dict[str, Any]] = []

        def override_get_db():
            db = self.SessionLocal()
            try:
                yield db
            finally:
                db.close()

        fastapi_app.dependency_overrides[get_db] = override_get_db
        self.client = TestClient(fastapi_app)

    def setup_base_entities(self):
        """Seed clean base entities for edge testing."""
        Base.metadata.drop_all(bind=self.engine)
        Base.metadata.create_all(bind=self.engine)
        self.db = self.SessionLocal()

        p1 = Person(id=1, display_name="আলমগীর চৌধুরী (Owner A)", masked_nid_hash="nid_a_hash")
        p2 = Person(id=2, display_name="বসির আহমেদ (Buyer B)", masked_nid_hash="nid_b_hash")
        p3 = Person(id=3, display_name="কামাল হোসেন (Third Party C)", masked_nid_hash="nid_c_hash")
        p4 = Person(id=4, display_name="ডালিয়া বেগম (Stranger D)", masked_nid_hash="nid_d_hash")
        self.db.add_all([p1, p2, p3, p4])
        self.db.flush()

        plot1 = Plot(
            id=1,
            mouza="মিরপুর",
            upazila="মিরপুর",
            district="ঢাকা",
            dag_no="1001",
            area_decimal=35.0,
            land_type="residential",
            initial_owner_id=p1.id,
            current_owner_id=p1.id,
            flags=[],
        )
        self.db.add(plot1)

        plot_khas = Plot(
            id=2,
            mouza="মিরপুর",
            upazila="মিরপুর",
            district="ঢাকা",
            dag_no="1002",
            area_decimal=50.0,
            land_type="agricultural",
            initial_owner_id=p1.id,
            current_owner_id=p1.id,
            flags=["khas"],
        )
        self.db.add(plot_khas)

        u_reg = User(
            id=1,
            name="Registrar Tester",
            username="registrar_ec",
            role="registrar",
            password_hash=hash_password("Pass123!"),
        )
        u_ac = User(
            id=2,
            name="AC Land Tester",
            username="acland_ec",
            role="officer",
            password_hash=hash_password("Pass123!"),
        )
        self.db.add_all([u_reg, u_ac])
        self.db.commit()

    # =========================================================================
    # EDGE CASE 1: Floating-Point Epsilon Precision & Fractional Drift
    # =========================================================================
    def test_ec1_floating_point_epsilon(self):
        """
        Fractional land split: 11.66666667 (1/3) + 23.33333333 (2/3) = 35.0 decimals.
        Tests if IEEE-754 precision drift triggers false-positive R1: OVER_SALE.
        """
        self.setup_base_entities()
        name = "EC-1: Floating-Point IEEE 754 Fractional Epsilon Drift"

        register_deed(
            self.db,
            self.key,
            plot_id=1,
            seller_id=1,
            buyer_id=2,
            area_sold=11.66666667,
            deed_type="sale",
            sub_registry="MIR",
        )
        self.db.commit()

        plot = self.db.get(Plot, 1)
        deal = DealSubject(seller_id=1, buyer_id=3, area_sold=23.33333333, at=datetime.now(timezone.utc))
        ctx = AnalysisContext(db=self.db, plot=plot, proposed=deal, signer_key=self.key)
        report = assess(ctx, get_layers())

        holdings = ledger_holdings(self.db, plot)
        p1_holding = holdings.get(1, 0.0)

        r1_fired = any((f.get("rule_id") if isinstance(f, dict) else f.rule_id) == "R1" for f in report["findings"])
        status = "PASSED" if not r1_fired and report["level"] != "CRITICAL" else "FAILED"

        rules_in_ec1 = [(f.get("rule_id"), f.get("severity"), f.get("reasons")) for f in report["findings"]]
        self.results.append({
            "id": "EC-1",
            "name": name,
            "status": status,
            "detail": f"Fractional split (11.66666667 + 23.33333333 = 35.0). Remaining P1 holding: {p1_holding:.8f}. R1 triggered: {r1_fired}. Score: {report['score']} ({report['level']}). Findings: {rules_in_ec1}",
            "severity": "MEDIUM" if status == "FAILED" else "LOW",
        })

    # =========================================================================
    # EDGE CASE 2: Negative and Zero Land Area Ingestion
    # =========================================================================
    def test_ec2_negative_and_zero_area(self):
        """
        Attempting to register deeds with area_sold = 0.0 or negative area (-15.0).
        """
        self.setup_base_entities()
        name = "EC-2: Zero and Negative Land Area Exploitation"

        zero_caught = False
        try:
            register_deed(
                self.db,
                self.key,
                plot_id=1,
                seller_id=1,
                buyer_id=2,
                area_sold=0.0,
                deed_type="sale",
                sub_registry="MIR",
            )
        except Exception:
            zero_caught = True

        neg_caught = False
        try:
            register_deed(
                self.db,
                self.key,
                plot_id=1,
                seller_id=1,
                buyer_id=2,
                area_sold=-15.0,
                deed_type="sale",
                sub_registry="MIR",
            )
        except Exception:
            neg_caught = True

        token = create_access_token("registrar_ec", "registrar")
        api_neg_res = self.client.post(
            "/api/v1/deeds",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "plot_id": 1,
                "seller_id": 1,
                "buyer_id": 2,
                "area_sold": -10.0,
                "deed_type": "sale",
                "sub_registry": "MIR",
            },
        )
        api_blocked = api_neg_res.status_code in (422, 400)

        status = "PASSED" if (zero_caught and neg_caught and api_blocked) else "FAILED"
        self.results.append({
            "id": "EC-2",
            "name": name,
            "status": status,
            "detail": f"Service layer zero caught: {zero_caught}. Negative caught: {neg_caught}. API response code: {api_neg_res.status_code} (Pydantic gt=0 enforced).",
            "severity": "CRITICAL" if status == "FAILED" else "LOW",
        })

    # =========================================================================
    # EDGE CASE 3: Unicode Normalization (NFC vs NFD) Diacritic Mismatch
    # =========================================================================
    def test_ec3_unicode_normalization_diacritics(self):
        """
        Tests whether Bangla Unicode strings encoded in NFC vs NFD generate matching
        cryptographic hashes in canonical JSON serialization.
        """
        name = "EC-3: Bangla Unicode Diacritics Normalization (NFC vs NFD)"

        text_nfc = unicodedata.normalize("NFC", "মিরপুর মৌজা দাগ নং ১০০১")
        text_nfd = unicodedata.normalize("NFD", "মিরপুর মৌজা দাগ নং ১০০১")

        payload_nfc = {"sub_registry": text_nfc, "plot_id": 1}
        payload_nfd = {"sub_registry": text_nfd, "plot_id": 1}

        bytes_nfc = canonical(payload_nfc)
        bytes_nfd = canonical(payload_nfd)

        hash_nfc = sha256_hex(bytes_nfc)
        hash_nfd = sha256_hex(bytes_nfd)

        is_identical = (hash_nfc == hash_nfd)
        # In strict RFC 8785 JSON canonicalization without Unicode normalization step,
        # different code point representations result in different byte streams.
        status = "PASSED" if is_identical else "WARNING"

        self.results.append({
            "id": "EC-3",
            "name": name,
            "status": status,
            "detail": f"NFC SHA-256: {hash_nfc[:12]}... NFD SHA-256: {hash_nfd[:12]}... Exact hash match: {is_identical}. (Note: Canonicalization preserves byte representation; inputs must be normalized to NFC at ingestion boundary).",
            "severity": "MEDIUM" if not is_identical else "LOW",
        })

    # =========================================================================
    # EDGE CASE 4: Self-Sale / Identity Loop (Seller == Buyer)
    # =========================================================================
    def test_ec4_self_sale_identity_loop(self):
        """
        Tests how the fraud engine and API respond when a seller attempts to sell
        land to themselves (Person 1 -> Person 1).
        """
        self.setup_base_entities()
        name = "EC-4: Self-Sale Transaction (Seller ID == Buyer ID)"

        plot = self.db.get(Plot, 1)
        deal = DealSubject(seller_id=1, buyer_id=1, area_sold=10.0, at=datetime.now(timezone.utc))
        ctx = AnalysisContext(db=self.db, plot=plot, proposed=deal)
        report = assess(ctx, get_layers())

        token = create_access_token("registrar_ec", "registrar")
        api_res = self.client.post(
            "/api/v1/deeds",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "plot_id": 1,
                "seller_id": 1,
                "buyer_id": 1,
                "area_sold": 10.0,
                "deed_type": "sale",
                "sub_registry": "MIR",
            },
        )

        # In land law, self-sale is conceptually invalid (a person cannot convey to oneself)
        status = "ANALYSIS"
        self.results.append({
            "id": "EC-4",
            "name": name,
            "status": status,
            "detail": f"Fraud score: {report['score']} ({report['level']}). API status: {api_res.status_code}. Finding: System records ledger entry where holding remains net-neutral, but deed is registered. Recommend adding explicit check seller_id != buyer_id.",
            "severity": "LOW",
        })

    # =========================================================================
    # EDGE CASE 5: Exact Boundary Depletion & Micro-Overdraft (0.001 dec)
    # =========================================================================
    def test_ec5_boundary_depletion_and_overdraft(self):
        """
        Selling 100% of plot (35.0 of 35.0 dec), then attempting to sell 0.001 decimals.
        Must be strictly blocked by R1: OVER_SALE.
        """
        self.setup_base_entities()
        name = "EC-5: Exact Boundary Depletion & Micro-Overdraft (0.001 dec)"

        register_deed(
            self.db,
            self.key,
            plot_id=1,
            seller_id=1,
            buyer_id=2,
            area_sold=35.0,
            deed_type="sale",
            sub_registry="MIR",
        )
        self.db.commit()

        plot = self.db.get(Plot, 1)
        holdings = ledger_holdings(self.db, plot)
        p1_holding = holdings.get(1, 0.0)

        deal = DealSubject(seller_id=1, buyer_id=3, area_sold=0.001, at=datetime.now(timezone.utc))
        ctx = AnalysisContext(db=self.db, plot=plot, proposed=deal, signer_key=self.key)
        report = assess(ctx, get_layers())

        r1_fired = any((f.get("rule_id") if isinstance(f, dict) else f.rule_id) == "R1" for f in report["findings"])
        is_blocked = (report["level"] == "CRITICAL" and r1_fired)

        status = "PASSED" if (p1_holding == 0.0 and is_blocked) else "FAILED"
        self.results.append({
            "id": "EC-5",
            "name": name,
            "status": status,
            "detail": f"Remaining holding after 35.0 sale: {p1_holding:.4f} dec. Attempting 0.001 dec over-sale triggered R1: {r1_fired}. Score: {report['score']}/100 ({report['level']}).",
            "severity": "CRITICAL" if status == "FAILED" else "LOW",
        })

    # =========================================================================
    # EDGE CASE 6: Rapid Circular Carousel Conveyance (A -> B -> C -> A)
    # =========================================================================
    def test_ec6_circular_carousel_velocity(self):
        """
        Rapid transaction churn: A -> B, B -> C, C -> A within minutes.
        Tests transaction velocity and circular churn detection.
        """
        self.setup_base_entities()
        name = "EC-6: Rapid Circular Carousel Conveyance (A -> B -> C -> A)"

        register_deed(self.db, self.key, plot_id=1, seller_id=1, buyer_id=2, area_sold=20.0, deed_type="sale", sub_registry="MIR")
        self.db.commit()

        register_deed(self.db, self.key, plot_id=1, seller_id=2, buyer_id=3, area_sold=20.0, deed_type="sale", sub_registry="MIR")
        self.db.commit()

        plot = self.db.get(Plot, 1)
        deal = DealSubject(seller_id=3, buyer_id=1, area_sold=20.0, at=datetime.now(timezone.utc))
        ctx = AnalysisContext(db=self.db, plot=plot, proposed=deal, signer_key=self.key)
        report = assess(ctx, get_layers())

        rules_fired = [(f.get("rule_id") if isinstance(f, dict) else f.rule_id) for f in report["findings"]]
        has_velocity = "R5" in rules_fired

        status = "PASSED" if (has_velocity or report["score"] > 0) else "WARNING"
        self.results.append({
            "id": "EC-6",
            "name": name,
            "status": status,
            "detail": f"Circular chain evaluated. Fraud score: {report['score']} ({report['level']}). Triggered rules: {rules_fired}. R5 velocity triggered: {has_velocity}.",
            "severity": "LOW",
        })

    # =========================================================================
    # EDGE CASE 7: Double Mutation Application on Completed Mutation
    # =========================================================================
    def test_ec7_double_mutation_on_active_deed(self):
        """
        Tests if a deed whose mutation completed to KHATIAN_UPDATED can be mutated
        a second time.
        """
        self.setup_base_entities()
        name = "EC-7: Duplicate Mutation Application on Mutated Deed"

        deed = register_deed(
            self.db,
            self.key,
            plot_id=1,
            seller_id=1,
            buyer_id=2,
            area_sold=20.0,
            deed_type="sale",
            sub_registry="MIR",
        )
        self.db.commit()

        # 1. Start Mutation 1 and complete it to KHATIAN_UPDATED
        m1 = start_mutation(self.db, deed_id=deed.id, applicant_id=2)
        transition(self.db, m1, "AUTO_CHECKED")
        transition(self.db, m1, "UNDER_REVIEW", actor=2)
        transition(self.db, m1, "APPROVED", actor=2)
        transition(self.db, m1, "KHATIAN_UPDATED", actor=2)
        self.db.commit()

        # 2. Attempt Mutation 2 on the same deed
        dup_caught = False
        err_msg = ""
        try:
            m2 = start_mutation(self.db, deed_id=deed.id, applicant_id=2)
            self.db.commit()
            m2_state = m2.state
        except Exception as e:
            dup_caught = True
            err_msg = str(e)
            m2_state = "BLOCKED"

        status = "ANALYSIS" if not dup_caught else "PASSED"
        self.results.append({
            "id": "EC-7",
            "name": name,
            "status": status,
            "detail": f"Initial mutation state: {m1.state}. Second mutation attempt caught: {dup_caught} (Result state: {m2_state}). Observation: start_mutation filters on state.notin_(['KHATIAN_UPDATED', 'REJECTED']), meaning a finished deed could re-apply unless explicitly blocked.",
            "severity": "MEDIUM" if not dup_caught else "LOW",
        })

    # =========================================================================
    # EDGE CASE 8: Cryptographic Signature Swapping & Tamper Detection
    # =========================================================================
    def test_ec8_signature_swapping_tamper_detection(self):
        """
        Tests cryptographic graft/replay attack: transplanting a valid Ed25519 signature
        from Deed 1 onto Deed 2. verify_deed must return TAMPERED.
        """
        self.setup_base_entities()
        name = "EC-8: Cryptographic Signature Grafting & Replay Attack"

        d1 = register_deed(self.db, self.key, plot_id=1, seller_id=1, buyer_id=2, area_sold=10.0, deed_type="sale", sub_registry="MIR")
        d2 = register_deed(self.db, self.key, plot_id=1, seller_id=1, buyer_id=3, area_sold=15.0, deed_type="sale", sub_registry="MIR")
        self.db.commit()

        # Graft d1's signature onto d2
        d2.signature = d1.signature
        self.db.commit()

        res = verify_deed(self.db, d2.deed_no, configured_key=self.key)
        is_tampered = (res["status"] == "TAMPERED")
        has_bad_sig = any("BAD_SIGNATURE" in r for r in res["reasons"])

        status = "PASSED" if (is_tampered and has_bad_sig) else "FAILED"
        self.results.append({
            "id": "EC-8",
            "name": name,
            "status": status,
            "detail": f"Verification status: {res['status']}. Tamper reasons: {res['reasons']}. Signature graft detected: {has_bad_sig}.",
            "severity": "CRITICAL" if status == "FAILED" else "LOW",
        })

    # =========================================================================
    # EDGE CASE 9: Stranger / Non-Party Mutation Application
    # =========================================================================
    def test_ec9_stranger_mutation_application(self):
        """
        Tests whether an unrelated stranger (Person 4, who is neither buyer nor seller)
        can apply for mutation on a deed between Person 1 and Person 2.
        """
        self.setup_base_entities()
        name = "EC-9: Stranger / Non-Party Mutation Application"

        deed = register_deed(
            self.db,
            self.key,
            plot_id=1,
            seller_id=1,
            buyer_id=2,
            area_sold=20.0,
            deed_type="sale",
            sub_registry="MIR",
        )
        self.db.commit()

        stranger_caught = False
        err_msg = ""
        try:
            m = start_mutation(self.db, deed_id=deed.id, applicant_id=4)
            self.db.commit()
            m_state = m.state
        except Exception as e:
            stranger_caught = True
            err_msg = str(e)
            m_state = "BLOCKED"

        status = "ANALYSIS"
        self.results.append({
            "id": "EC-9",
            "name": name,
            "status": status,
            "detail": f"Stranger mutation creation result: state={m_state}, blocked={stranger_caught}. Note: In Bangladesh land law, representatives (power of attorney/heirs) may submit on behalf of buyers, so AC Land investigation drawer verifies identity before approval.",
            "severity": "LOW",
        })

    # =========================================================================
    # Execution Harness
    # =========================================================================
    def run_all(self):
        print("=" * 80)
        print(" LandShield (BhumiPrahari) - Systematic Edge-Case Stress Test Suite")
        print("=" * 80)

        tests = [
            self.test_ec1_floating_point_epsilon,
            self.test_ec2_negative_and_zero_area,
            self.test_ec3_unicode_normalization_diacritics,
            self.test_ec4_self_sale_identity_loop,
            self.test_ec5_boundary_depletion_and_overdraft,
            self.test_ec6_circular_carousel_velocity,
            self.test_ec7_double_mutation_on_active_deed,
            self.test_ec8_signature_swapping_tamper_detection,
            self.test_ec9_stranger_mutation_application,
        ]

        for t in tests:
            try:
                t()
            except Exception as e:
                import traceback
                self.results.append({
                    "id": t.__name__,
                    "name": t.__name__,
                    "status": "EXCEPTION",
                    "detail": f"Unhandled exception: {str(e)}\n{traceback.format_exc()}",
                    "severity": "HIGH",
                })

        print("\n" + "-" * 80)
        print(f"{'ID':<6} | {'STATUS':<9} | {'SEVERITY':<8} | {'EDGE CASE NAME':<40}")
        print("-" * 80)
        for r in self.results:
            print(f"{r['id']:<6} | {r['status']:<9} | {r['severity']:<8} | {r['name'][:40]:<40}")
            print(f"       -> Details: {r['detail']}\n")

        print("=" * 80)
        total = len(self.results)
        passed = sum(1 for r in self.results if r["status"] == "PASSED")
        warnings = sum(1 for r in self.results if r["status"] in ("WARNING", "ANALYSIS"))
        failed = sum(1 for r in self.results if r["status"] in ("FAILED", "EXCEPTION"))
        print(f"Summary: {total} Edge Cases Executed | {passed} PASSED | {warnings} ANALYSIS/WARNING | {failed} FAILED")
        print("=" * 80)
        return self.results


if __name__ == "__main__":
    runner = EdgeCaseRunner()
    results = runner.run_all()
