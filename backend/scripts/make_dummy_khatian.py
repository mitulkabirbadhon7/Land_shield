"""Script to generate realistic synthetic Land Khatian (Porcha) and Deed images with watermarks.

Uses Pillow and Noto Sans Bengali font.
Outputs sample documents to data/dummy_docs/.
"""

import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def get_font(size: int = 24, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    font_candidates = [
        Path("data/fonts/static/NotoSansBengali-Bold.ttf") if bold else Path("data/fonts/static/NotoSansBengali-Regular.ttf"),
        Path("data/fonts/NotoSansBengali-Bold.ttf") if bold else Path("data/fonts/NotoSansBengali-Regular.ttf"),
        Path(__file__).resolve().parent.parent.parent / "data" / "fonts" / "static" / ("NotoSansBengali-Bold.ttf" if bold else "NotoSansBengali-Regular.ttf"),
    ]
    for p in font_candidates:
        if p.exists():
            try:
                return ImageFont.truetype(str(p), size)
            except Exception:
                pass
    return ImageFont.load_default()


def create_synthetic_khatian(
    out_path: Path,
    survey_type: str,
    khatian_no: str,
    dag_no: str,
    mouza: str,
    upazila: str,
    district: str,
    area_decimal: float,
    owners: list[dict[str, str]],
) -> Path:
    width, height = 1000, 1300
    # Aged paper parchment color
    image = Image.new("RGB", (width, height), color=(253, 251, 245))
    draw = ImageDraw.Draw(image)

    # Outer and inner border
    draw.rectangle([(20, 20), (width - 20, height - 20)], outline=(80, 80, 80), width=3)
    draw.rectangle([(28, 28), (width - 28, height - 28)], outline=(120, 120, 120), width=1)

    # Prominent diagonal synthetic watermark
    watermark_font = get_font(42, bold=True)
    draw.text((120, 350), "DUMMY - SYNTHETIC RECORD ONLY", fill=(230, 200, 200), font=watermark_font)
    draw.text((160, 650), "LANDSHIELD DEMO - NOT OFFICIAL", fill=(230, 200, 200), font=watermark_font)
    draw.text((220, 950), "FOR HACKATHON TESTING ONLY", fill=(230, 200, 200), font=watermark_font)

    # Top Header
    title_font = get_font(32, bold=True)
    sub_font = get_font(22, bold=False)
    bold_font = get_font(20, bold=True)
    text_font = get_font(19, bold=False)

    draw.text((width // 2 - 190, 50), "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার", fill=(20, 20, 20), font=title_font)
    draw.text((width // 2 - 130, 95), "ভূমি মন্ত্রণালয় - খতিয়ান (পর্চা)", fill=(40, 40, 40), font=title_font)
    draw.text((width // 2 - 70, 140), f"জরিপ: {survey_type}", fill=(180, 40, 40), font=title_font)

    # Metadata bar
    y_start = 200
    draw.line([(50, y_start), (width - 50, y_start)], fill=(100, 100, 100), width=2)
    draw.text((60, y_start + 15), f"বিভাগ/জেলা: {district}", fill=(30, 30, 30), font=bold_font)
    draw.text((400, y_start + 15), f"থানা/উপজেলা: {upazila}", fill=(30, 30, 30), font=bold_font)
    draw.text((720, y_start + 15), f"মৌজা: {mouza} (JL-102)", fill=(30, 30, 30), font=bold_font)

    draw.line([(50, y_start + 55), (width - 50, y_start + 55)], fill=(100, 100, 100), width=1)
    draw.text((60, y_start + 70), f"খতিয়ান নং: {khatian_no}", fill=(20, 20, 20), font=bold_font)
    draw.text((400, y_start + 70), f"দাগ নং: {dag_no}", fill=(20, 20, 20), font=bold_font)
    draw.text((720, y_start + 70), f"জমির শ্রেণি: নাল", fill=(20, 20, 20), font=bold_font)

    draw.line([(50, y_start + 110), (width - 50, y_start + 110)], fill=(100, 100, 100), width=2)

    # Owners Table
    table_y = y_start + 150
    draw.text((60, table_y), "মালিকের নাম ও অংশ বিবরণী", fill=(20, 20, 20), font=title_font)
    table_y += 50
    draw.rectangle([(50, table_y), (width - 50, table_y + 40)], fill=(235, 230, 220), outline=(100, 100, 100), width=1)
    draw.text((70, table_y + 8), "ক্রমিক", fill=(20, 20, 20), font=bold_font)
    draw.text((180, table_y + 8), "মালিকের নাম ও পিতার নাম", fill=(20, 20, 20), font=bold_font)
    draw.text((600, table_y + 8), "অংশ (শেয়ার)", fill=(20, 20, 20), font=bold_font)
    draw.text((780, table_y + 8), "জমির পরিমাণ (শতক)", fill=(20, 20, 20), font=bold_font)

    cur_row_y = table_y + 40
    for idx, o in enumerate(owners, 1):
        draw.rectangle([(50, cur_row_y), (width - 50, cur_row_y + 45)], outline=(160, 160, 160), width=1)
        draw.text((80, cur_row_y + 10), str(idx), fill=(40, 40, 40), font=text_font)
        draw.text((180, cur_row_y + 10), o["name"], fill=(40, 40, 40), font=text_font)
        draw.text((640, cur_row_y + 10), str(o["share"]), fill=(40, 40, 40), font=text_font)
        draw.text((820, cur_row_y + 10), f"{float(o['share']) * area_decimal:.2f}", fill=(40, 40, 40), font=text_font)
        cur_row_y += 45

    # Total area row
    draw.rectangle([(50, cur_row_y), (width - 50, cur_row_y + 45)], fill=(245, 240, 235), outline=(100, 100, 100), width=1)
    draw.text((180, cur_row_y + 10), "মোট জমির পরিমাণ:", fill=(20, 20, 20), font=bold_font)
    draw.text((640, cur_row_y + 10), "১.০০০০", fill=(20, 20, 20), font=bold_font)
    draw.text((820, cur_row_y + 10), f"{area_decimal:.2f} শতক", fill=(180, 40, 40), font=bold_font)

    # Official Seal / Signature block
    footer_y = height - 180
    draw.line([(50, footer_y), (width - 50, footer_y)], fill=(120, 120, 120), width=1)
    draw.text((80, footer_y + 20), "স্বাক্ষর ও মোহর:", fill=(60, 60, 60), font=bold_font)
    draw.rectangle([(80, footer_y + 55), (220, footer_y + 115)], outline=(180, 50, 50), width=2)
    draw.text((95, footer_y + 75), "[কৃত্রিম সিলমোহর]", fill=(180, 50, 50), font=bold_font)

    draw.text((680, footer_y + 40), "সহকারী কমিশনার (ভূমি)", fill=(30, 30, 30), font=bold_font)
    draw.text((700, footer_y + 70), "উপজেলা ভূমি অফিস", fill=(60, 60, 60), font=sub_font)
    draw.text((720, footer_y + 95), f"{upazila}, {district}", fill=(60, 60, 60), font=sub_font)

    # Top red synthetic stamp
    draw.rectangle([(width - 280, 35), (width - 35, 75)], fill=(240, 220, 220), outline=(200, 40, 40), width=2)
    draw.text((width - 265, 45), "SYNTHETIC DEMO ONLY", fill=(200, 40, 40), font=bold_font)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path, format="PNG")
    print(f"[+] Saved synthetic porcha document to: {out_path.resolve()}")
    return out_path


def generate_sample_documents() -> list[Path]:
    docs_dir = Path("data/dummy_docs")
    docs_dir.mkdir(parents=True, exist_ok=True)

    samples = [
        {
            "filename": "khatian_rs_102.png",
            "survey_type": "RS",
            "khatian_no": "১০২",
            "dag_no": "১২০১",
            "mouza": "মিরপুর",
            "upazila": "মিরপুর",
            "district": "ঢাকা",
            "area_decimal": 12.50,
            "owners": [
                {"name": "মোহাম্মদ রফিকুল ইসলাম", "share": "0.60"},
                {"name": "নাসিমা বেগম", "share": "0.40"},
            ],
        },
        {
            "filename": "khatian_bs_504.png",
            "survey_type": "BS",
            "khatian_no": "৫০৪",
            "dag_no": "১২০১",
            "mouza": "মিরপুর",
            "upazila": "মিরপুর",
            "district": "ঢাকা",
            "area_decimal": 12.50,
            "owners": [
                {"name": "মোহাম্মদ রফিকুল ইসলাম", "share": "1.00"},
            ],
        },
        {
            "filename": "khatian_sa_308.png",
            "survey_type": "SA",
            "khatian_no": "৩০৮",
            "dag_no": "৮৮২",
            "mouza": "মিরপুর",
            "upazila": "মিরপুর",
            "district": "ঢাকা",
            "area_decimal": 18.00,
            "owners": [
                {"name": "করিম বক্স", "share": "0.50"},
                {"name": "রহিম বক্স", "share": "0.50"},
            ],
        },
    ]

    out_paths = []
    for s in samples:
        target = docs_dir / s["filename"]
        create_synthetic_khatian(
            out_path=target,
            survey_type=s["survey_type"],
            khatian_no=s["khatian_no"],
            dag_no=s["dag_no"],
            mouza=s["mouza"],
            upazila=s["upazila"],
            district=s["district"],
            area_decimal=s["area_decimal"],
            owners=s["owners"],
        )
        out_paths.append(target)

    return out_paths


if __name__ == "__main__":
    generate_sample_documents()
