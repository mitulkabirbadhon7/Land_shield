import re

BANGLA_GRAPHEME = re.compile(r"[\u0980-\u09FF][\u09BE-\u09CD\u09D7\u09E2\u09E3]*|.")


def mask_name(name: str | None) -> str:
    """Mask a name keeping first + last grapheme of each word."""
    if not name:
        return ""
    words = name.strip().split()
    if not words:
        return ""
    masked: list[str] = []
    for word in words:
        graphemes = BANGLA_GRAPHEME.findall(word)
        if len(graphemes) <= 2:
            masked.append(word)
        else:
            masked.append(graphemes[0] + "***" + graphemes[-1])
    return " ".join(masked)

