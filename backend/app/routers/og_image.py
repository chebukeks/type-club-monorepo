"""
OG image generator — creates 1200×630 PNG preview cards for articles and profiles.

Design specs:
  - Outer background: #627ae1 (brand indigo)
  - Inner rounded rectangle: #f3f3f3 with 32px radius and 28px margins
  - Lower-right: Type Club logo watermark (360×360, 30% opacity)
  - Upper-left: Article title in Inter SemiBold, black, dynamically scaled by length
  - Lower-left: Author avatar (68×68 circle) + @nickname in Inter Regular, gray #64748b
"""

import hashlib
import io
import logging
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.models import Article, User

router = APIRouter(prefix="/api/og-image", tags=["og-image"])
logger = logging.getLogger(__name__)

# ── Dimensions & colors ─────────────────────────────────────

WIDTH = 1200
HEIGHT = 630

BG_OUTER = (98, 122, 225)       # #627ae1
BG_INNER = (243, 243, 243)     # #f3f3f3
TEXT_TITLE = (15, 23, 42)       # #0f172a (almost black)
TEXT_AUTHOR = (100, 116, 139)   # #64748b (muted gray)

MARGIN = 28
RADIUS = 32
INNER_LEFT = MARGIN
INNER_TOP = MARGIN
INNER_RIGHT = WIDTH - MARGIN
INNER_BOTTOM = HEIGHT - MARGIN

AVATAR_SIZE = 68

# ── Assets ───────────────────────────────────────────────────

ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"
CACHE_DIR = ASSETS_DIR / "og-cache"
LOGO_PATH = ASSETS_DIR / "logo.png"


def _get_font(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    """Load bundled Inter variable font and select the requested weight."""
    font_file = FONTS_DIR / "Inter-Regular.ttf"
    if font_file.exists():
        try:
            font = ImageFont.truetype(str(font_file), size)
            if hasattr(font, "set_variation_by_name"):
                try:
                    font.set_variation_by_name(weight)
                except Exception:
                    pass
            return font
        except Exception as e:
            logger.debug("Failed to load Inter variable font: %s", e)

    # Check for individual static font files
    for candidate in (f"Inter-{weight}.ttf", f"Inter-{weight}.otf", "Inter.ttf"):
        path = FONTS_DIR / candidate
        if path.exists():
            return ImageFont.truetype(str(path), size)

    # Fallback to system fonts with Cyrillic support
    for sys_font in (
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ):
        if os.path.exists(sys_font):
            return ImageFont.truetype(sys_font, size)

    return ImageFont.load_default()


# ── Cache helpers ────────────────────────────────────────────


def _cache_key(identifier: str, updated: str) -> str:
    raw = f"{identifier}:{updated}:v2"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def _get_cached(key: str) -> bytes | None:
    path = CACHE_DIR / f"{key}.png"
    if path.exists():
        return path.read_bytes()
    return None


def _set_cached(key: str, data: bytes) -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / f"{key}.png"
    path.write_bytes(data)


# ── Avatar generation / loading ──────────────────────────────


def _draw_initial_avatar(nickname: str, size: int) -> Image.Image:
    """Generate a dark circular badge with author's uppercase initials."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark background circle
    draw.ellipse((0, 0, size - 1, size - 1), fill=(30, 30, 36, 255))

    initial = (nickname[:2] if len(nickname) >= 2 else (nickname or "?")).upper()
    font = _get_font(int(size * 0.44), weight="Bold")
    bbox = font.getbbox(initial)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) // 2 - bbox[0]
    y = (size - th) // 2 - bbox[1]
    draw.text((x, y), initial, font=font, fill=(255, 255, 255, 255))
    return img


async def _load_avatar(avatar_url: str | None, nickname: str, size: int = AVATAR_SIZE) -> Image.Image:
    """Download and crop avatar to circle, or fall back to initial avatar."""
    if avatar_url:
        try:
            # SECURITY: Only allow local /uploads/ paths — never arbitrary URLs
            if not avatar_url.startswith("/uploads/"):
                return _draw_initial_avatar(nickname, size)

            url = f"http://localhost:{settings.api_port}{avatar_url}"

            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    img = Image.open(io.BytesIO(resp.content)).convert("RGBA")
                    img = img.resize((size, size), Image.LANCZOS)
                    mask = Image.new("L", (size, size), 0)
                    draw = ImageDraw.Draw(mask)
                    draw.ellipse((0, 0, size - 1, size - 1), fill=255)
                    img.putalpha(mask)
                    return img
        except Exception as e:
            logger.debug("Failed to load avatar %s: %s", avatar_url, e)

    return _draw_initial_avatar(nickname, size)


# ── Card rendering ───────────────────────────────────────────


def _create_base_card() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    """Create the base card with outer background, inner rounded rectangle and watermark logo."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_OUTER)

    # Inner rounded rectangle mask
    inner_mask = Image.new("L", (WIDTH, HEIGHT), 0)
    d_mask = ImageDraw.Draw(inner_mask)
    d_mask.rounded_rectangle(
        [(INNER_LEFT, INNER_TOP), (INNER_RIGHT, INNER_BOTTOM)],
        radius=RADIUS,
        fill=255,
    )

    # Inner canvas
    inner_img = Image.new("RGBA", (WIDTH, HEIGHT), (*BG_INNER, 255))

    # Watermark logo in bottom-right corner
    if LOGO_PATH.exists():
        try:
            logo = Image.open(LOGO_PATH).convert("RGBA")
            logo_size = 360
            logo = logo.resize((logo_size, logo_size), Image.LANCZOS)

            # 30% opacity
            r, g, b, a = logo.split()
            a = a.point(lambda p: int(p * 0.30))
            logo.putalpha(a)

            logo_x = INNER_RIGHT - logo_size - 16
            logo_y = INNER_BOTTOM - logo_size - 16
            inner_img.paste(logo, (logo_x, logo_y), logo)
        except Exception as e:
            logger.debug("Failed to paste logo watermark: %s", e)

    # Composite inner rectangle onto outer frame
    img.paste(inner_img.convert("RGB"), (0, 0), inner_mask)
    draw = ImageDraw.Draw(img)
    return img, draw


async def _render_article_card(
    title: str,
    author_name: str,
    avatar_url: str | None = None,
) -> bytes:
    """Render a 1200×630 article preview card matching the official Type Club design."""
    img, draw = _create_base_card()

    # Dynamic font scaling based on title length
    max_w = (INNER_RIGHT - INNER_LEFT) - 120
    if len(title) <= 20:
        font_size = 80
    elif len(title) <= 45:
        font_size = 64
    elif len(title) <= 80:
        font_size = 52
    else:
        font_size = 44

    title_font = _get_font(font_size, weight="SemiBold")

    # Word wrapping (up to 3 lines)
    words = title.split()
    lines: list[str] = []
    curr = ""
    for w in words:
        test = f"{curr} {w}".strip() if curr else w
        bbox = title_font.getbbox(test)
        if (bbox[2] - bbox[0]) <= max_w:
            curr = test
        else:
            if curr:
                lines.append(curr)
            curr = w
    if curr:
        lines.append(curr)

    # Truncate to 3 lines if needed
    if len(lines) > 3:
        lines = lines[:3]
        last = lines[-1]
        bbox = title_font.getbbox(last + "…")
        while last and (bbox[2] - bbox[0]) > max_w:
            last = last[:-1]
            bbox = title_font.getbbox(last + "…")
        lines[-1] = last + "…"

    # Draw Title
    title_x = INNER_LEFT + 56
    title_y = INNER_TOP + 56
    line_h = int(font_size * 1.24)
    for line in lines:
        draw.text((title_x, title_y), line, font=title_font, fill=TEXT_TITLE)
        title_y += line_h

    # Draw Author section (bottom-left)
    avatar_x = INNER_LEFT + 56
    avatar_y = INNER_BOTTOM - 56 - AVATAR_SIZE

    avatar = await _load_avatar(avatar_url, nickname=author_name, size=AVATAR_SIZE)
    img.paste(avatar.convert("RGB"), (avatar_x, avatar_y), avatar)

    author_font = _get_font(34, weight="Regular")
    author_text = f"@{author_name}"
    bbox = author_font.getbbox(author_text)
    text_h = bbox[3] - bbox[1]
    text_y = avatar_y + (AVATAR_SIZE - text_h) // 2 - bbox[1]
    draw.text((avatar_x + AVATAR_SIZE + 20, text_y), author_text, font=author_font, fill=TEXT_AUTHOR)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


async def _render_profile_card(
    nickname: str,
    bio: str | None,
    article_count: int,
    avatar_url: str | None = None,
) -> bytes:
    """Render a 1200×630 profile preview card matching the official Type Club design."""
    img, draw = _create_base_card()

    # Large avatar
    large_avatar_size = 110
    avatar_x = INNER_LEFT + 56
    avatar_y = INNER_TOP + 56

    avatar = await _load_avatar(avatar_url, nickname=nickname, size=large_avatar_size)
    img.paste(avatar.convert("RGB"), (avatar_x, avatar_y), avatar)

    # Nickname
    nick_font = _get_font(56, weight="SemiBold")
    nick_text = f"@{nickname}"
    nick_x = avatar_x + large_avatar_size + 28
    nick_y = avatar_y + 12
    draw.text((nick_x, nick_y), nick_text, font=nick_font, fill=TEXT_TITLE)

    # Bio
    if bio:
        bio_font = _get_font(32, weight="Regular")
        bio_words = bio.split()
        bio_lines = []
        curr = ""
        max_bio_w = (INNER_RIGHT - INNER_LEFT) - 140
        for w in bio_words:
            test = f"{curr} {w}".strip() if curr else w
            bbox = bio_font.getbbox(test)
            if (bbox[2] - bbox[0]) <= max_bio_w:
                curr = test
            else:
                if curr:
                    bio_lines.append(curr)
                curr = w
        if curr:
            bio_lines.append(curr)

        bio_y = avatar_y + large_avatar_size + 36
        for line in bio_lines[:3]:
            draw.text((avatar_x, bio_y), line, font=bio_font, fill=TEXT_TITLE)
            bio_y += 44

    # Stats (bottom-left)
    stats_font = _get_font(34, weight="Regular")
    stats_text = f"{article_count} публикаций"
    stats_y = INNER_BOTTOM - 56 - 34
    draw.text((INNER_LEFT + 56, stats_y), stats_text, font=stats_font, fill=TEXT_AUTHOR)

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


# ── Endpoints ────────────────────────────────────────────────


@router.get("/{username}/{slug}")
async def og_image_article(
    username: str,
    slug: str,
    session: AsyncSession = Depends(get_session),
):
    author = (
        await session.execute(select(User).where(User.nickname == username))
    ).scalar_one_or_none()
    if not author:
        return _placeholder_image()

    article = (
        await session.execute(
            select(Article).where(
                Article.author_id == author.id,
                Article.slug == slug,
            )
        )
    ).scalar_one_or_none()
    if not article or article.access_state not in ("public", "link"):
        return _placeholder_image()

    # Check cache
    cache_key = _cache_key(
        f"article:{article.id}",
        str(article.updated_at),
    )
    cached = _get_cached(cache_key)
    if cached:
        return Response(
            content=cached,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    # Render
    data = await _render_article_card(
        title=article.title,
        author_name=author.nickname,
        avatar_url=author.avatar_url,
    )

    _set_cached(cache_key, data)

    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/{username}")
async def og_image_profile(
    username: str,
    session: AsyncSession = Depends(get_session),
):
    user = (
        await session.execute(select(User).where(User.nickname == username))
    ).scalar_one_or_none()
    if not user:
        return _placeholder_image()

    articles = (
        await session.execute(
            select(Article).where(
                Article.author_id == user.id,
                Article.access_state == "public",
            )
        )
    ).scalars().all()
    count = len(articles)

    cache_key = _cache_key(
        f"profile:{user.id}:{count}",
        str(user.created_at),
    )
    cached = _get_cached(cache_key)
    if cached:
        return Response(
            content=cached,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    data = await _render_profile_card(
        nickname=user.nickname,
        bio=user.bio,
        article_count=count,
        avatar_url=user.avatar_url,
    )

    _set_cached(cache_key, data)

    return Response(
        content=data,
        media_type="image/png",
        headers={"Cache-Control": "public, max-age=3600"},
    )


def _placeholder_image() -> Response:
    """1×1 transparent PNG fallback."""
    img = Image.new("RGBA", (1, 1), (0, 0, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        status_code=404,
    )

