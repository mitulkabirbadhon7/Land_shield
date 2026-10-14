import re

# Comprehensive regex matching complete Bangla orthographic syllables (Akshors)
# including base consonants, nuktas, conjuncts (virama), vowel matras, and modifiers (chandrabindu, etc.)
AKSHOR = re.compile(
    r"(?:[\u0985-\u0994]|(?:[\u0995-\u09B9\u09CE\u09DC-\u09DF]\u09BC?(?:\u09CD[\u0995-\u09B9\u09DC-\u09DF]\u09BC?)*))[\u09BE-\u09CC\u09D7]?[\u0981-\u0983]?|."
)


def mask_name(name: str | None) -> str:
    """Mask a person's name keeping first + last grapheme/syllable of each word."""
    if not name:
        return ""
    words = name.strip().split()
    if not words:
        return ""
    masked: list[str] = []
    for word in words:
        graphemes = [g for g in AKSHOR.findall(word) if g]
        if len(graphemes) <= 1:
            masked.append(word)
        elif len(graphemes) == 2:
            masked.append(graphemes[0] + "***" + graphemes[1])
        else:
            masked.append(graphemes[0] + "***" + graphemes[-1])
    return " ".join(masked)


