from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Article, User
from app.routers.auth import get_current_user, get_optional_user, get_verified_user
from app.schemas import (
    ArticleCreateRequest,
    ArticleListItem,
    ArticleResponse,
    ArticleUpdateRequest,
)

router = APIRouter(prefix="/api/articles", tags=["articles"])


def _article_to_response(article: Article, author: User | None = None) -> ArticleResponse:
    nick = author.nickname if author else None
    return ArticleResponse(
        id=article.id,
        author_id=article.author_id,
        title=article.title,
        content=article.content,
        access_state=article.access_state,
        slug=article.slug,
        created_at=article.created_at,
        updated_at=article.updated_at,
        author_nickname=nick,
    )


def _article_to_list_item(article: Article) -> ArticleListItem:
    return ArticleListItem(
        id=article.id,
        title=article.title,
        access_state=article.access_state,
        slug=article.slug,
        author_nickname=article.author.nickname,
        created_at=article.created_at,
        updated_at=article.updated_at,
    )


@router.get("", response_model=list[ArticleListItem])
async def list_articles(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    offset = (page - 1) * size
    result = await session.execute(
        select(Article)
        .where(Article.access_state == "public")
        .order_by(Article.updated_at.desc())
        .offset(offset)
        .limit(size)
    )
    articles = result.scalars().all()
    return [_article_to_list_item(a) for a in articles]


@router.get("/my", response_model=list[ArticleListItem])
async def list_my_articles(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    offset = (page - 1) * size
    result = await session.execute(
        select(Article)
        .where(Article.author_id == current_user.id)
        .order_by(Article.updated_at.desc())
        .offset(offset)
        .limit(size)
    )
    articles = result.scalars().all()
    return [_article_to_list_item(a) for a in articles]


@router.post("", response_model=ArticleResponse, status_code=201)
async def create_article(
    data: ArticleCreateRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    slug = data.slug or _slugify(data.title)
    existing = (
        await session.execute(
            select(Article).where(Article.author_id == current_user.id, Article.slug == slug)
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Article with this slug already exists")

    article = Article(
        author_id=current_user.id,
        title=data.title,
        content=data.content,
        slug=slug,
    )
    session.add(article)
    await session.commit()
    await session.refresh(article)
    return _article_to_response(article, current_user)


@router.get("/lookup/{username}/{slug}", response_model=ArticleResponse)
async def get_article_by_path(
    username: str,
    slug: str,
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    author = (await session.execute(select(User).where(User.nickname == username))).scalar_one_or_none()
    if not author:
        raise HTTPException(status_code=404, detail="Author not found")

    article = (
        await session.execute(
            select(Article).where(Article.author_id == author.id, Article.slug == slug)
        )
    ).scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    is_author = current_user and current_user.id == article.author_id
    if not is_author and article.access_state not in ("public", "link"):
        raise HTTPException(status_code=403, detail="Access denied")

    return _article_to_response(article, author)


@router.get("/{article_id}", response_model=ArticleResponse)
async def get_article(
    article_id: int,
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    is_author = current_user and current_user.id == article.author_id
    if not is_author and article.access_state not in ("public", "link"):
        raise HTTPException(status_code=403, detail="Access denied")

    author = await session.get(User, article.author_id)
    return _article_to_response(article, author)


@router.patch("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: int,
    data: ArticleUpdateRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your article")

    if article.access_state == "blocked" and data.access_state and data.access_state != "blocked":
        raise HTTPException(status_code=403, detail="Cannot change state of blocked article")

    if data.title is not None:
        article.title = data.title
    if data.content is not None:
        article.content = data.content
    if data.access_state is not None:
        article.access_state = data.access_state
    if data.slug is not None:
        existing = (
            await session.execute(
                select(Article).where(
                    Article.author_id == current_user.id,
                    Article.slug == data.slug,
                    Article.id != article_id,
                )
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Article with this slug already exists")
        article.slug = data.slug

    await session.commit()
    await session.refresh(article)
    return _article_to_response(article, current_user)


@router.delete("/{article_id}", status_code=204)
async def delete_article(
    article_id: int,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your article")

    await session.delete(article)
    await session.commit()
    return None


def _slugify(text: str) -> str:
    import re
    import unicodedata

    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[-\s]+", "-", text)
