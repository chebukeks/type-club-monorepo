import logging
import secrets

from fastapi import APIRouter, Depends, HTTPException, Header, Query, Response
from sqlalchemy import func, select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Article, ArticleLike, CollaborationMember, User
from app.config import settings
from app.routers.auth import get_current_user, get_moderator_user, get_optional_user, get_verified_user
from app.schemas import (
    ArticleCreateRequest,
    ArticleListItem,
    ArticleResponse,
    ArticleUpdateRequest,
    CheckAccessResponse,
    CollaboratorResponse,
    GenerateShareLinkRequest,
    InviteCollaboratorRequest,
    ModerateRequest,
    ModerateResponse,
    ShareLinkResponse,
    SyncStateRequest,
)

router = APIRouter(prefix="/api/articles", tags=["articles"])

logger = logging.getLogger(__name__)


def _article_to_response(
    article: Article,
    author: User | None = None,
    current_user: User | None = None,
) -> ArticleResponse:
    nick = author.nickname if author else None
    liked = False
    if current_user:
        liked = any(l.user_id == current_user.id for l in article.likes)
    return ArticleResponse(
        id=article.id,
        author_id=article.author_id,
        title=article.title,
        content=article.content,
        access_state=article.access_state,
        slug=article.slug,
        view_count=len(article.views),
        like_count=len(article.likes),
        comment_count=len(article.comments),
        liked_by_user=liked,
        created_at=article.created_at,
        updated_at=article.updated_at,
        author_nickname=nick,
    )


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


@router.get("", response_model=list[ArticleListItem])
async def list_articles(
    response: Response,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=500),
    author: str | None = Query(None, max_length=255),
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    offset = (page - 1) * size
    conditions = []
    if not (current_user and current_user.role == "moderator"):
        conditions.append(Article.access_state == "public")
    if q and q.strip():
        conditions.append(Article.title.ilike(f"%{q.strip()}%"))

    query = select(Article)
    count_query = select(func.count(Article.id))
    if author and author.strip():
        query = query.join(User, Article.author_id == User.id)
        count_query = count_query.join(User, Article.author_id == User.id)
        conditions.append(func.lower(User.nickname) == author.strip().lower())

    if conditions:
        query = query.where(*conditions)
        count_query = count_query.where(*conditions)

    total = (await session.execute(count_query)).scalar_one()
    result = await session.execute(
        query.order_by(Article.updated_at.desc()).offset(offset).limit(size)
    )
    articles = result.scalars().all()
    response.headers["X-Total-Count"] = str(total)
    return [_article_to_list_item(a) for a in articles]


VALID_MY_ROLES = ("author", "co_author", "editor")


@router.get("/my", response_model=list[ArticleListItem])
async def list_my_articles(
    response: Response,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=500),
    roles: str | None = Query(None, max_length=100),
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    offset = (page - 1) * size
    if roles is None:
        wanted_roles = list(VALID_MY_ROLES)
    else:
        wanted_roles = [r for r in (p.strip() for p in roles.split(",")) if r in VALID_MY_ROLES]
        if not wanted_roles:
            response.headers["X-Total-Count"] = "0"
            return []

    collab_rows = (
        await session.execute(
            select(CollaborationMember.article_id, CollaborationMember.role).where(
                CollaborationMember.user_id == current_user.id
            )
        )
    ).all()
    collab_role_by_article: dict[int, str] = {row[0]: row[1] for row in collab_rows}

    conditions = []
    if "author" in wanted_roles:
        conditions.append(Article.author_id == current_user.id)
    collab_ids = [
        article_id
        for article_id, role in collab_role_by_article.items()
        if role in wanted_roles
    ]
    if collab_ids:
        conditions.append(Article.id.in_(collab_ids))
    if not conditions:
        response.headers["X-Total-Count"] = "0"
        return []

    filters = [or_(*conditions)]
    if q and q.strip():
        filters.append(Article.title.ilike(f"%{q.strip()}%"))

    total = (
        await session.execute(select(func.count(Article.id)).where(*filters))
    ).scalar_one()
    result = await session.execute(
        select(Article)
        .where(*filters)
        .order_by(Article.updated_at.desc())
        .offset(offset)
        .limit(size)
    )
    articles = result.scalars().all()
    response.headers["X-Total-Count"] = str(total)

    items = []
    for a in articles:
        my_roles = []
        if a.author_id == current_user.id:
            my_roles.append("author")
        collab_role = collab_role_by_article.get(a.id)
        if collab_role:
            my_roles.append(collab_role)
        items.append(_article_to_list_item(a, my_roles))
    return items


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
    is_moderator = current_user and current_user.role == "moderator"
    is_collab = current_user and _user_can_access(article, current_user)
    if not is_author and not is_moderator and not is_collab and article.access_state not in ("public", "link"):
        raise HTTPException(status_code=403, detail="Access denied")

    return _article_to_response(article, author, current_user)


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
    is_moderator = current_user and current_user.role == "moderator"
    is_collab = current_user and _user_can_access(article, current_user)
    if not is_author and not is_moderator and not is_collab and article.access_state not in ("public", "link"):
        raise HTTPException(status_code=403, detail="Access denied")

    author = await session.get(User, article.author_id)
    return _article_to_response(article, author, current_user)


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
    if not _user_can_edit(article, current_user):
        raise HTTPException(status_code=403, detail="Not your article")

    if article.access_state == "blocked" and data.access_state and data.access_state != "blocked":
        raise HTTPException(status_code=403, detail="Cannot change state of blocked article")

    if data.title is not None:
        article.title = data.title
    if data.content is not None:
        if article.collaborators:
            logger.info(
                "Ignoring content update for article %s via PATCH (has collaborators; "
                "content is managed by collab-server)",
                article_id,
            )
        else:
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


@router.post("/{article_id}/moderate", response_model=ModerateResponse)
async def moderate_article(
    article_id: int,
    data: ModerateRequest,
    current_user: User = Depends(get_moderator_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if data.action == "block":
        article.access_state = "blocked"
    elif data.action == "unblock":
        if article.access_state != "blocked":
            raise HTTPException(status_code=400, detail="Article is not blocked")
        article.access_state = "private"

    await session.commit()
    return ModerateResponse(message=f"Article {data.action}ed")


@router.delete("/{article_id}", status_code=204)
async def delete_article(
    article_id: int,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.author_id != current_user.id and current_user.role != "moderator":
        raise HTTPException(status_code=403, detail="Not your article")

    await session.delete(article)
    await session.commit()
    return None


# ── Collaboration ──


@router.get("/{article_id}/collaborators", response_model=list[CollaboratorResponse])
async def list_collaborators(
    article_id: int,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if not _user_can_access(article, current_user):
        raise HTTPException(status_code=403, detail="Not your article")

    result_set = await session.execute(
        select(CollaborationMember, User.nickname)
        .join(User, CollaborationMember.user_id == User.id)
        .where(CollaborationMember.article_id == article_id)
    )
    rows = result_set.all()
    return [
        CollaboratorResponse(
            id=member.id,
            user_id=member.user_id,
            nickname=nickname,
            role=member.role,
            source=member.source,
            invited_at=member.invited_at,
        )
        for member, nickname in rows
    ]


@router.post("/{article_id}/collaborators", response_model=CollaboratorResponse, status_code=201)
async def invite_collaborator(
    article_id: int,
    data: InviteCollaboratorRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your article")

    target = (
        await session.execute(select(User).where(User.nickname == data.nickname))
    ).scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = (
        await session.execute(
            select(CollaborationMember).where(
                CollaborationMember.article_id == article_id,
                CollaborationMember.user_id == target.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="User already invited")

    member = CollaborationMember(
        article_id=article_id,
        user_id=target.id,
        role=data.role,
        source="invite",
    )
    session.add(member)
    await session.commit()
    await session.refresh(member)

    return CollaboratorResponse(
        id=member.id,
        user_id=member.user_id,
        nickname=target.nickname,
        role=member.role,
        source=member.source,
        invited_at=member.invited_at,
    )


@router.delete("/{article_id}/collaborators/{user_id}", status_code=204)
async def remove_collaborator(
    article_id: int,
    user_id: int,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your article")

    member = (
        await session.execute(
            select(CollaborationMember).where(
                CollaborationMember.article_id == article_id,
                CollaborationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Collaborator not found")

    await session.delete(member)
    await session.commit()
    return None


@router.post("/{article_id}/share-link", response_model=ShareLinkResponse)
async def generate_share_link(
    article_id: int,
    data: GenerateShareLinkRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your article")

    article.share_token = secrets.token_urlsafe(32)
    article.share_role = data.role
    await session.commit()

    url = f"https://type-club.ru/join/{article.share_token}"
    return ShareLinkResponse(token=article.share_token, url=url, role=data.role)


@router.get("/shared/{token}", response_model=ArticleResponse)
async def get_shared_article(
    token: str,
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    article = (
        await session.execute(
            select(Article).where(Article.share_token == token)
        )
    ).scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Invalid or expired link")

    author = await session.get(User, article.author_id)
    return _article_to_response(article, author, current_user)


@router.post("/shared/{token}/join", response_model=CollaboratorResponse)
async def join_via_share_link(
    token: str,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = (
        await session.execute(
            select(Article).where(Article.share_token == token)
        )
    ).scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Invalid or expired link")

    if article.author_id == current_user.id:
        raise HTTPException(status_code=400, detail="You are the author")

    existing = (
        await session.execute(
            select(CollaborationMember).where(
                CollaborationMember.article_id == article.id,
                CollaborationMember.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Already a collaborator")

    member = CollaborationMember(
        article_id=article.id,
        user_id=current_user.id,
        role=article.share_role or "editor",
        source="link",
    )
    session.add(member)
    await session.commit()
    await session.refresh(member)

    return CollaboratorResponse(
        id=member.id,
        user_id=member.user_id,
        nickname=current_user.nickname,
        role=member.role,
        source=member.source,
        invited_at=member.invited_at,
    )


# ── Internal: for collab-server ──


def _verify_service_token(authorization: str | None = Header(None)) -> None:
    if not settings.service_token:
        raise HTTPException(status_code=500, detail="Server misconfigured")
    if not authorization or authorization.replace("Bearer ", "") != settings.service_token:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/{article_id}/check-access", response_model=CheckAccessResponse)
async def check_access(
    article_id: int,
    x_user_id: str = Header("0"),
    _service: None = Depends(_verify_service_token),
    session: AsyncSession = Depends(get_session),
):
    user_id = int(x_user_id) if x_user_id.isdigit() else 0
    if not user_id:
        return CheckAccessResponse(has_access=False, role="")

    article = await session.get(Article, article_id)
    if not article:
        return CheckAccessResponse(has_access=False, role="")

    if article.author_id == user_id:
        return CheckAccessResponse(has_access=True, role="co_author")

    role = await _get_collaborator_role(article, user_id)
    if role:
        return CheckAccessResponse(has_access=True, role=role)

    return CheckAccessResponse(has_access=False, role="")


@router.get("/{article_id}/content")
async def get_article_content(
    article_id: int,
    _service: None = Depends(_verify_service_token),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return {"content": article.content}


@router.patch("/{article_id}/sync-state")
async def sync_state(
    article_id: int,
    data: SyncStateRequest,
    _service: None = Depends(_verify_service_token),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    article.content = data.content
    await session.commit()
    return {"status": "ok"}


@router.get("/{article_id}/user-role")
async def get_user_role(
    article_id: int,
    user_id: int = Query(...),
    _service: None = Depends(_verify_service_token),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    if article.author_id == user_id:
        return {"role": "author", "user_id": user_id}

    for m in article.collaborators:
        if m.user_id == user_id:
            return {"role": m.role, "user_id": user_id}

    raise HTTPException(status_code=403, detail="User has no access to this article")


def _slugify(text: str) -> str:
    import re
    import secrets
    import unicodedata

    normalized = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    cleaned = re.sub(r"[^\w\s-]", "", normalized).strip().lower()
    res = re.sub(r"[-\s]+", "-", cleaned)
    if not res:
        res = secrets.token_hex(4)
    return res


async def _get_collaborator_role(article: Article, user_id: int) -> str | None:
    for m in article.collaborators:
        if m.user_id == user_id:
            return m.role
    return None


def _user_can_edit(article: Article, user: User) -> bool:
    if article.author_id == user.id:
        return True
    return any(m.user_id == user.id and m.role == "co_author" for m in article.collaborators)


def _user_can_access(article: Article, user: User) -> bool:
    if article.author_id == user.id:
        return True
    return any(m.user_id == user.id for m in article.collaborators)
