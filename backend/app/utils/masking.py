def mask_name(name: str | None) -> str:
    """Mask a person's display name to protect privacy in public outputs.

    Keeps the first and last character of each word with '***' in between.
    Supports both Bangla and Latin scripts, handling short words gracefully.

    Examples:
        "রহিম উদ্দিন" -> "র***ম উ***ন"
        "John Doe"    -> "J***n D***e"
        "Md Ali"      -> "M***d A***i"
        "A"           -> "A***"
    """
    if not name:
        return ""

    words = name.strip().split()
    if not words:
        return ""

    masked_words: list[str] = []
    for word in words:
        if len(word) <= 1:
            masked_words.append(f"{word}***")
        elif len(word) == 2:
            masked_words.append(f"{word[0]}***{word[1]}")
        else:
            masked_words.append(f"{word[0]}***{word[-1]}")

    return " ".join(masked_words)
