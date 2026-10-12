import io
import qrcode
from app.config import settings


def build_qr_url(deed_no: str, deed_hash: str) -> str:
    """Construct the official verification URL embedded into the QR code."""
    hash_prefix = deed_hash[:12] if deed_hash else ""
    return f"{settings.frontend_url}/verify?deed={deed_no}&h={hash_prefix}"


def qr_png(url: str) -> bytes:
    """Generate PNG bytes containing a QR code for the given URL/content."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
