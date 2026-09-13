from datetime import datetime, timezone, timedelta
import hashlib

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Article, ArticleLike, ArticleView, User
from app.rate_limit import limiter
from app.routers.auth import get_current_user, get_optional_user, get_verified_user
from app.schemas import LikeResponse, ViewResponse

router = APIRouter(tags=["stats"])


@router.post("/api/articles/{article_id}/view", response_model=ViewResponse)
@limiter.limit("30/minute")
async def record_view(
    request: Request,
    article_id: int,
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")
    raw = f"{client_ip}:{user_agent}:{article_id}"
    viewer_hash = hashlib.sha256(raw.encode()).hexdigest()[:32]

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
    existing = (await session.execute(
        select(ArticleView).where(
            ArticleView.article_id == article_id,
            ArticleView.viewer_hash == viewer_hash,
            ArticleView.viewed_at > cutoff,
        )
    )).scalar_one_or_none()

    if not existing:
        view = ArticleView(article_id=article_id, viewer_hash=viewer_hash)
        session.add(view)
        await session.commit()

    count = (
        await session.execute(
            select(func.count(ArticleView.id)).where(ArticleView.article_id == article_id)
        )
    ).scalar_one()

    return ViewResponse(count=count)


@router.get("/api/articles/{article_id}/views", response_model=ViewResponse)
async def get_views(
    article_id: int,
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    count = (
        await session.execute(
            select(func.count(ArticleView.id)).where(ArticleView.article_id == article_id)
        )
    ).scalar_one()

    return ViewResponse(count=count)


@router.post("/api/articles/{article_id}/like", response_model=LikeResponse)
async def toggle_like(
    article_id: int,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    existing = (
        await session.execute(
            select(ArticleLike).where(
                ArticleLike.article_id == article_id,
                ArticleLike.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()

    if existing:
        await session.delete(existing)
        liked = False
    else:
        like = ArticleLike(article_id=article_id, user_id=current_user.id)
        session.add(like)
        liked = True

    await session.commit()

    count = (
        await session.execute(
            select(func.count(ArticleLike.id)).where(ArticleLike.article_id == article_id)
        )
    ).scalar_one()

    return LikeResponse(liked=liked, count=count)


@router.get("/api/articles/{article_id}/likes", response_model=LikeResponse)
async def get_likes(
    article_id: int,
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    count = (
        await session.execute(
            select(func.count(ArticleLike.id)).where(ArticleLike.article_id == article_id)
        )
    ).scalar_one()

    liked = False
    if current_user:
        existing = (
            await session.execute(
                select(ArticleLike).where(
                    ArticleLike.article_id == article_id,
                    ArticleLike.user_id == current_user.id,
                )
            )
        ).scalar_one_or_none()
        liked = existing is not None

    return LikeResponse(liked=liked, count=count)
