def escape_like(value: str) -> str:
    """Escape special LIKE/ILIKE characters: %, _, \\"""
    return (
        value
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_")
    )
