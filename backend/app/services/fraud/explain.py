from __future__ import annotations
from typing import Any


TEMPLATES: dict[str, dict[str, str]] = {
    "OVERSOLD": {
        "en_deed": "Deed {deed_no}: The transferred land area exceeds the total registered plot area.",
        "en": "The transferred land area exceeds the total registered plot area.",
        "bn_deed": "দলিল {deed_no}: হস্তান্তরিত জমির পরিমাণ এই দাগের মোট জমির পরিমাণের চেয়ে বেশি।",
        "bn": "হস্তান্তরিত জমির পরিমাণ এই দাগের মোট জমির পরিমাণের চেয়ে বেশি।",
    },
    "DOUBLE_SALE": {
        "en_deed": "Deed {deed_no}: Double-sale attempt detected. This land was already transferred in an earlier deed.",
        "en": "Double-sale attempt detected. This land was already transferred in an earlier deed.",
        "bn_deed": "দলিল {deed_no}: দ্বৈত বিক্রয় বা প্রতারণার আশঙ্কা। বিক্রেতা আগেই অন্য দলিলে এই জমি বিক্রি করেছেন।",
        "bn": "দ্বৈত বিক্রয় বা প্রতারণার আশঙ্কা। বিক্রেতা আগেই অন্য দলিলে এই জমি বিক্রি করেছেন।",
    },
    "NOT_OWNER": {
        "en_deed": "Deed {deed_no}: Seller is not the owner. Seller has neither record holding nor ownership in the ledger.",
        "en": "Seller is not the owner. Seller has neither record holding nor ownership in the ledger.",
        "bn_deed": "দলিল {deed_no}: বিক্রেতা খতিয়ানভুক্ত মালিক নন এবং দলিল লেজারেও তার কোনো জমির রেকর্ড নেই।",
        "bn": "বিক্রেতা খতিয়ানভুক্ত মালিক নন এবং দলিল লেজারেও তার কোনো জমির রেকর্ড নেই।",
    },
    "MISSING_MUTATION": {
        "en_deed": "Deed {deed_no}: Active deed registered over 90 days ago has not completed e-mutation (khatian update).",
        "en": "Active deed registered over 90 days ago has not completed e-mutation (khatian update).",
        "bn_deed": "দলিল {deed_no}: ৯০ দিনের বেশি সময় পূর্বে রেজিস্ট্রি হওয়া দলিলে এখনও নামজারি (খতিয়ান সংশোধন) সম্পন্ন হয়নি।",
        "bn": "৯০ দিনের বেশি সময় পূর্বে রেজিস্ট্রি হওয়া দলিলে এখনও নামজারি (খতিয়ান সংশোধন) সম্পন্ন হয়নি।",
    },
    "RAPID_TRANSFERS": {
        "en_deed": "Deed {deed_no}: Suspicious rapid transfers. 3 or more ownership transfers occurred on this plot within 30 days.",
        "en": "Suspicious rapid transfers. 3 or more ownership transfers occurred on this plot within 30 days.",
        "bn_deed": "দলিল {deed_no}: অস্বাভাবিক দ্রুত হস্তান্তর। এই দাগে ৩০ দিনের মধ্যে ৩টি বা ততোধিক দলিলের মাধ্যমে মালিকানা বদল হয়েছে।",
        "bn": "অস্বাভাবিক দ্রুত হস্তান্তর। এই দাগে ৩০ দিনের মধ্যে ৩টি বা ততোধিক দলিলের মাধ্যমে মালিকানা বদল হয়েছে।",
    },
    "FLAGGED_LAND": {
        "en_deed": "Deed {deed_no}: Restricted or disputed plot. The land is flagged (khas/acquisition/disputed) or has active court litigation.",
        "en": "Restricted or disputed plot. The land is flagged (khas/acquisition/disputed) or has active court litigation.",
        "bn_deed": "দলিল {deed_no}: বিরোধপূর্ণ বা সংরক্ষিত জমি। দাগটি সরকারি খাস/অধিগ্রহণকৃত অথবা আদালতে সক্রিয় মামলা রয়েছে।",
        "bn": "বিরোধপূর্ণ বা সংরক্ষিত জমি। দাগটি সরকারি খাস/অধিগ্রহণকৃত অথবা আদালতে সক্রিয় মামলা রয়েছে।",
    },
    "INTEGRITY": {
        "en_deed": "Deed {deed_no}: Cryptographic integrity failure. Tampered deed data, invalid signature, or broken ledger hash chain.",
        "en": "Cryptographic integrity failure. Tampered deed data, invalid signature, or broken ledger hash chain.",
        "bn_deed": "দলিল {deed_no}: ক্রিপ্টোগ্রাফিক সুরক্ষা ত্রুটি। দলিলে পরিবর্তন, ভুয়া ডিজিটাল স্বাক্ষর অথবা লেজার চেইনে অসঙ্গতি সনাক্ত হয়েছে।",
        "bn": "ক্রিপ্টোগ্রাফিক সুরক্ষা ত্রুটি। দলিলে পরিবর্তন, ভুয়া ডিজিটাল স্বাক্ষর অথবা লেজার চেইনে অসঙ্গতি সনাক্ত হয়েছে।",
    },
}


def explain(finding: Any, lang: str = "bn") -> str:
    """Generate a natural bilingual explanation for a finding.
    
    Supports both Bangla ('bn') and English ('en').
    Mentions deed number when present.
    """
    if isinstance(finding, dict):
        rule_id = finding.get("rule_id", "")
        sub_code = finding.get("sub_code") or ""
        deed_no = finding.get("deed_no")
        reasons = finding.get("reasons", [])
    else:
        rule_id = getattr(finding, "rule_id", "")
        sub_code = getattr(finding, "sub_code", None) or ""
        deed_no = getattr(finding, "deed_no", None)
        reasons = getattr(finding, "reasons", [])

    # Normalize sub_code if missing
    if not sub_code:
        rule_str = str(rule_id).upper()
        if "R1" in rule_str:
            reasons_str = " ".join(str(r) for r in reasons)
            sub_code = "OVERSOLD" if "OVERSOLD" in reasons_str else "DOUBLE_SALE"
        elif "R2" in rule_str:
            sub_code = "NOT_OWNER"
        elif "R3" in rule_str:
            sub_code = "MISSING_MUTATION"
        elif "R4" in rule_str:
            sub_code = "RAPID_TRANSFERS"
        elif "R5" in rule_str:
            sub_code = "INTEGRITY"
        elif "R6" in rule_str:
            sub_code = "FLAGGED_LAND"
        else:
            sub_code = rule_str

    sub_code_key = sub_code.upper()
    tpl = TEMPLATES.get(sub_code_key)

    is_english = str(lang).lower().startswith("en")

    if tpl:
        if deed_no:
            key = "en_deed" if is_english else "bn_deed"
            return tpl[key].format(deed_no=deed_no)
        else:
            key = "en" if is_english else "bn"
            return tpl[key]

    # Fallback to reasons if sub-code template not found
    if reasons:
        return reasons[0]
    return f"Rule {rule_id} triggered" if is_english else f"নিয়ম {rule_id} লঙ্ঘিত হয়েছে"
