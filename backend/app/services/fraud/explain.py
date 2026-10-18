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
    "OWNER_MISMATCH": {
        "en_deed": "Deed {deed_no}: Institutional discrepancy. Recorded owner in AC Land office differs from mutation-derived owner.",
        "en": "Institutional discrepancy: Recorded owner in AC Land office differs from mutation-derived owner.",
        "bn_deed": "দলিল {deed_no}: দপ্তরভিত্তিক অসঙ্গতি। সহকারী কমিশনার (ভূমি) অফিসের রেকর্ডভুক্ত মালিকের সাথে নামজারি সূত্রে প্রাপ্ত মালিকের অমিল রয়েছে।",
        "bn": "দপ্তরভিত্তিক অসঙ্গতি: সহকারী কমিশনার (ভূমি) অফিসের রেকর্ডভুক্ত মালিকের সাথে নামজারি সূত্রে প্রাপ্ত মালিকের অমিল রয়েছে।",
    },
    "MUTATION_STALLED": {
        "en_deed": "Deed {deed_no}: Administrative lag. A mutation application on this plot has remained stalled beyond the statutory limit.",
        "en": "Administrative lag: A mutation application on this plot has remained stalled beyond the statutory limit.",
        "bn_deed": "দলিল {deed_no}: প্রশাসনিক বিলম্ব। এই দাগের একটি নামজারি আবেদন সংবিধিবদ্ধ সময়সীমার বেশি সময় ধরে পর্যালোচনায় আটকে রয়েছে।",
        "bn": "প্রশাসনিক বিলম্ব: এই দাগের একটি নামজারি আবেদন সংবিধিবদ্ধ সময়সীমার বেশি সময় ধরে পর্যালোচনায় আটকে রয়েছে।",
    },
    "AREA_NOT_CONSERVED": {
        "en_deed": "Deed {deed_no}: Area conservation failure. Sum of recorded owner holdings does not equal the documented plot area.",
        "en": "Area conservation failure: Sum of recorded owner holdings does not equal the documented plot area.",
        "bn_deed": "দলিল {deed_no}: জমির পরিমাণে অসঙ্গতি। রেকর্ডভুক্ত অংশীদারদের মোট জমির পরিমাণ দাগের মূল পরিমাণের সাথে মিলছে না।",
        "bn": "জমির পরিমাণে অসঙ্গতি: রেকর্ডভুক্ত অংশীদারদের মোট জমির পরিমাণ দাগের মূল পরিমাণের সাথে মিলছে না।",
    },
    "MISSING_GENERATION": {
        "en_deed": "Deed {deed_no}: Survey lineage gap. One or more intermediate survey generations (e.g. SA or RS) are missing from the historical chain.",
        "en": "Survey lineage gap: One or more intermediate survey generations (e.g. SA or RS) are missing from the historical chain.",
        "bn_deed": "দলিল {deed_no}: জরিপ ধারাবাহিকতায় বিরতি। পূর্ববর্তী জরিপ শৃঙ্খল থেকে এক বা একাধিক মধ্যবর্তী জরিপ (যেমন এসএ বা আরএস) বাদ পড়েছে।",
        "bn": "জরিপ ধারাবাহিকতায় বিরতি: পূর্ববর্তী ঐতিহাসিক জরিপ শৃঙ্খল থেকে এক বা একাধিক মধ্যবর্তী জরিপ (যেমন এসএ বা আরএস) বাদ পড়েছে।",
    },
    "ORPHAN": {
        "en_deed": "Deed {deed_no}: Orphan survey record. A historical khatian lacks a documented parent reference in earlier surveys.",
        "en": "Orphan survey record: A historical khatian lacks a documented parent reference in earlier land surveys.",
        "bn_deed": "দলিল {deed_no}: মূলহীন জরিপ খতিয়ান। এই জরিপ খতিয়ানটির কোনো পূর্ববর্তী মূল খতিয়ান বা সংযোগ পাওয়া যায়নি।",
        "bn": "মূলহীন জরিপ খতিয়ান: এই ঐতিহাসিক জরিপ খতিয়ানটির কোনো পূর্ববর্তী মূল খতিয়ান বা সংযোগ পাওয়া যায়নি।",
    },
    "BAD_PARENT": {
        "en_deed": "Deed {deed_no}: Invalid survey link. Khatian references a parent from a later or invalid survey era.",
        "en": "Invalid survey link: Khatian references a parent from a later or invalid survey era.",
        "bn_deed": "দলিল {deed_no}: ভুল জরিপ সংযোগ। খতিয়ানটিতে পরবর্তী বা অযৌক্তিক জরিপ পর্যায়ের খতিয়ানকে মূল হিসেবে উল্লেখ করা হয়েছে।",
        "bn": "ভুল জরিপ সংযোগ: খতিয়ানটিতে পরবর্তী বা অযৌক্তিক জরিপ পর্যায়ের খতিয়ানকে মূল হিসেবে উল্লেখ করা হয়েছে।",
    },
    "AREA_GROWTH": {
        "en_deed": "Deed {deed_no}: Unjustified area expansion. Plot area expanded across historical surveys without lawful basis.",
        "en": "Unjustified area expansion: Plot area expanded across historical surveys without lawful acquisition or consolidation.",
        "bn_deed": "দলিল {deed_no}: জমির অযৌক্তিক বৃদ্ধি। আইনগত কারণ ব্যতীত পরবর্তী জরিপে জমির পরিমাণ বৃদ্ধি পেয়েছে।",
        "bn": "জমির অযৌক্তিক বৃদ্ধি: আইনগত কারণ ব্যতীত পরবর্তী জরিপে দাগের জমির পরিমাণ পূর্ববর্তী মূল জরিপের চেয়ে বৃদ্ধি পেয়েছে।",
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
