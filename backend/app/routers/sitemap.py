"""
Dynamic sitemap.xml generator.

Produces a standard XML sitemap listing all public articles and user profiles
so that search engines can discover and index content.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_session
from app.models import Article, User

router = APIRouter(tags=["sitemap"])
logger = logging.getLogger(__name__)


def _base_url(request: Request) -> str:
    if settings.frontend_url:
        return settings.frontend_url.rstrip("/")
    return str(request.base_url).rstrip("/")


@router.get("/api/sitemap.xml")
async def sitemap(
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    base = _base_url(request)

    # Static pages
    urls = [
        {"loc": base, "priority": "1.0", "changefreq": "daily"},
        {"loc": f"{base}/articles", "priority": "0.8", "changefreq": "daily"},
        {"loc": f"{base}/download", "priority": "0.5", "changefreq": "monthly"},
    ]

    # Public articles
    articles = (
        await session.execute(
            select(Article, User.nickname)
            .join(User, Article.author_id == User.id)
            .where(Article.access_state == "public")
            .order_by(Article.updated_at.desc())
        )
    ).all()

    for article, nickname in articles:
        urls.append({
            "loc": f"{base}/{nickname}/{article.slug}",
            "lastmod": article.updated_at.strftime("%Y-%m-%d"),
            "priority": "0.7",
            "changefreq": "weekly",
        })

    # User profiles (only those with at least one public article)
    authors = (
        await session.execute(
            select(User.nickname, func.max(Article.updated_at).label("last_updated"))
            .join(Article, Article.author_id == User.id)
            .where(Article.access_state == "public")
            .group_by(User.nickname)
        )
    ).all()

    for nickname, last_updated in authors:
        urls.append({
            "loc": f"{base}/{nickname}",
            "lastmod": last_updated.strftime("%Y-%m-%d") if last_updated else None,
            "priority": "0.6",
            "changefreq": "weekly",
        })

    # Build XML
    xml_parts = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]

    for url in urls:
        xml_parts.append("  <url>")
        xml_parts.append(f"    <loc>{url['loc']}</loc>")
        if url.get("lastmod"):
            xml_parts.append(f"    <lastmod>{url['lastmod']}</lastmod>")
        if url.get("changefreq"):
            xml_parts.append(f"    <changefreq>{url['changefreq']}</changefreq>")
        if url.get("priority"):
            xml_parts.append(f"    <priority>{url['priority']}</priority>")
        xml_parts.append("  </url>")

    xml_parts.append("</urlset>")

    xml_content = "\n".join(xml_parts)

    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"},
    )
