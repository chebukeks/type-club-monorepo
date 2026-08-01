import os
import secrets
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Response, UploadFile, File
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Article, ArticleLike, ArticleView, User
from app.config import settings
from app.routers.auth import get_current_user, get_optional_user, get_verified_user
from app.schemas import (
    ArticleListItem,
    UserProfileResponse,
    UserSuggestion,
)

router = APIRouter(prefix="/api/users", tags=["users"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2 MB


def _article_to_list_item(article: Article, my_roles: list[str] | None = None) -> ArticleListItem:
    return ArticleListItem(
        id=article.id,
        title=article.title,
        access_state=article.access_state,
        slug=article.slug,
        author_nickname=article.author.nickname,
        view_count=len(article.views),
        like_count=len(article.likes),
        comment_count=len(article.comments),
        created_at=article.created_at,
        updated_at=article.updated_at,
        my_roles=my_roles,
    )


@router.get("/search", response_model=list[UserSuggestion])
@router.get("", response_model=list[UserSuggestion])
async def search_users(
    q: str = Query("", max_length=255),
    limit: int = Query(10, ge=1, le=20),
    session: AsyncSession = Depends(get_session),
):
    q = q.strip()
    if not q:
        return []
    result = await session.execute(
        select(User)
        .where(User.nickname.ilike(f"%{q}%"))
        .order_by(User.nickname)
        .limit(limit)
    )
    return [UserSuggestion(id=u.id, nickname=u.nickname) for u in result.scalars().all()]


@router.get("/{nickname}", response_model=UserProfileResponse)
async def get_profile(
    nickname: str,
    session: AsyncSession = Depends(get_session),
):
    user = (
        await session.execute(
            select(User).where(User.nickname == nickname)
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    article_count = (
        await session.execute(
            select(func.count(Article.id)).where(Article.author_id == user.id)
        )
    ).scalar_one()

    total_views = (
        await session.execute(
            select(func.count(ArticleView.id))
            .join(Article, ArticleView.article_id == Article.id)
            .where(Article.author_id == user.id)
        )
    ).scalar_one()

    total_likes = (
        await session.execute(
            select(func.count(ArticleLike.id))
            .join(Article, ArticleLike.article_id == Article.id)
            .where(Article.author_id == user.id)
        )
    ).scalar_one()

    return UserProfileResponse(
        id=user.id,
        nickname=user.nickname,
        avatar_url=user.avatar_url,
        bio=user.bio,
        role=user.role,
        article_count=article_count,
        total_views=total_views,
        total_likes=total_likes,
        created_at=user.created_at,
    )


@router.get("/{nickname}/articles", response_model=list[ArticleListItem])
async def get_profile_articles(
    response: Response,
    nickname: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    user = (
        await session.execute(
            select(User).where(User.nickname == nickname)
        )
    ).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    is_owner = current_user and current_user.id == user.id

    offset = (page - 1) * size
    conditions = [Article.author_id == user.id]
    if not is_owner:
        conditions.append(Article.access_state == "public")

    total = (
        await session.execute(
            select(func.count(Article.id)).where(*conditions)
        )
    ).scalar_one()

    result = await session.execute(
        select(Article)
        .where(*conditions)
        .order_by(Article.updated_at.desc())
        .offset(offset)
        .limit(size)
    )
    articles = result.scalars().all()

    response.headers["X-Total-Count"] = str(total)
    return [_article_to_list_item(a) for a in articles]


@router.post("/avatar", response_model=dict)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    content = await file.read()
    if len(content) > MAX_AVATAR_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 2 MB)")

    uploads_dir = Path(settings.uploads_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)

    safe_name = f"{uuid.uuid4().hex}{ext}"
    file_path = uploads_dir / safe_name
    file_path.write_bytes(content)

    avatar_url = f"/uploads/{safe_name}"

    current_user.avatar_url = avatar_url
    await session.commit()

    return {"avatar_url": avatar_url}
