"""
OG (Open Graph) meta-tags endpoint.

Nginx detects social-media / search-engine bots by User-Agent and proxies
their requests here instead of serving the SPA shell.  The response is a
minimal HTML page packed with <meta property="og:*"> / <meta name="twitter:*">
tags so that Telegram, Discord, VK, Twitter/X, Facebook, Google etc. can
build a rich link preview.
"""

import logging
import re
from html import escape

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.models import Article, User

router = APIRouter(prefix="/api/og", tags=["og"])
logger = logging.getLogger(__name__)

SITE_NAME = "Type Club"


def _base_url(request: Request) -> str:
    """Canonical base URL (https://type-club.ru or http://localhost:5173)."""
    if settings.frontend_url:
        return settings.frontend_url.rstrip("/")
    return str(request.base_url).rstrip("/")


def _strip_markdown(text: str, max_len: int = 200) -> str:
    """Rough markdown→plain-text for og:description."""
    # Remove images, links keep text, strip markers
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", text)       # ![alt](url)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)   # [text](url)
    text = re.sub(r"```[\s\S]*?```", "", text)              # code blocks
    text = re.sub(r"`([^`]*)`", r"\1", text)                # inline code
    text = re.sub(r"#{1,6}\s+", "", text)                   # headings
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)          # bold
    text = re.sub(r"\*([^*]+)\*", r"\1", text)              # italic
    text = re.sub(r"~~([^~]+)~~", r"\1", text)              # strikethrough
    text = re.sub(r"==([^=]+)==", r"\1", text)              # highlight
    text = re.sub(r"\|\|([^|]+)\|\|", r"\1", text)          # spoiler
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.M)   # list markers
    text = re.sub(r"^\s*>\s?", "", text, flags=re.M)        # blockquote
    text = re.sub(r"\$\$[\s\S]*?\$\$", "[формула]", text)   # display math
    text = re.sub(r"\$[^$]+\$", "[формула]", text)          # inline math
    text = re.sub(r"\n{2,}", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        text = text[: max_len - 1] + "…"
    return text


def _render_og_html(
    *,
    title: str,
    description: str,
    url: str,
    image_url: str,
    base_url: str,
    og_type: str = "article",
    author: str | None = None,
    body_html: str = "",
) -> str:
    t = escape(title)
    d = escape(description)
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>{t} | {SITE_NAME}</title>
<meta property="og:type" content="{og_type}">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{image_url}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="{url}">
<meta property="og:site_name" content="{SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{t}">
<meta name="twitter:description" content="{d}">
<meta name="twitter:image" content="{image_url}">
{f'<meta property="article:author" content="{escape(author)}">' if author else ''}
<meta http-equiv="refresh" content="0;url={url}">
</head>
<body>
{body_html}
<p><a href="{url}">Открыть на {SITE_NAME}</a></p>
</body>
</html>"""


# ── Article OG ──────────────────────────────────────────────


@router.get("/{username}/{slug}", response_class=HTMLResponse)
async def og_article(
    username: str,
    slug: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    author = (
        await session.execute(select(User).where(User.nickname == username))
    ).scalar_one_or_none()
    if not author:
        return _fallback_html(request)

    article = (
        await session.execute(
            select(Article).where(
                Article.author_id == author.id,
                Article.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if not article or article.access_state not in ("public", "link"):
        return _fallback_html(request)

    base = _base_url(request)
    description = _strip_markdown(article.content)
    url = f"{base}/{username}/{slug}"
    image_url = f"{base}/api/og-image/{username}/{slug}"

    body = f"<h1>{escape(article.title)}</h1>"
    body += f"<p>Автор: {escape(author.nickname)}</p>"
    if description:
        body += f"<p>{escape(description)}</p>"

    return HTMLResponse(
        _render_og_html(
            title=article.title,
            description=description or f"Статья от {author.nickname} на {SITE_NAME}",
            url=url,
            image_url=image_url,
            base_url=base,
            og_type="article",
            author=author.nickname,
            body_html=body,
        )
    )


# ── User profile OG ────────────────────────────────────────


@router.get("/{username}", response_class=HTMLResponse)
async def og_profile(
    username: str,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    user = (
        await session.execute(select(User).where(User.nickname == username))
    ).scalar_one_or_none()
    if not user:
        return _fallback_html(request)

    base = _base_url(request)
    url = f"{base}/{username}"

    # Count public articles
    article_count = (
        await session.execute(
            select(Article)
            .where(Article.author_id == user.id, Article.access_state == "public")
        )
    ).scalars().all()
    count = len(article_count)

    title = f"@{user.nickname}"
    description = user.bio or f"Профиль {user.nickname} на {SITE_NAME}"
    if count > 0:
        description = f"{count} публикаций. {description}"

    image_url = f"{base}/api/og-image/{username}"

    body = f"<h1>@{escape(user.nickname)}</h1>"
    if user.bio:
        body += f"<p>{escape(user.bio)}</p>"
    body += f"<p>Статей: {count}</p>"

    return HTMLResponse(
        _render_og_html(
            title=title,
            description=description,
            url=url,
            image_url=image_url,
            base_url=base,
            og_type="profile",
            body_html=body,
        )
    )


# ── Fallback ────────────────────────────────────────────────


def _fallback_html(request: Request) -> HTMLResponse:
    base = _base_url(request)
    return HTMLResponse(
        _render_og_html(
            title=SITE_NAME,
            description="Пиши. Публикуй. Делись.",
            url=base,
            image_url=f"{base}/icons/icon_256x256.png",
            base_url=base,
            og_type="website",
        ),
        status_code=404,
    )
