import json
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Article, Comment, Notification, User
from app.routers.auth import get_current_user, get_optional_user, get_verified_user
from app.schemas import CommentCreateRequest, CommentResponse, CommentUpdateRequest

router = APIRouter(tags=["comments"])


def _comment_to_response(comment: Comment, author: User) -> CommentResponse:
    return CommentResponse(
        id=comment.id,
        article_id=comment.article_id,
        user_id=comment.user_id,
        author_nickname=author.nickname,
        content=comment.content,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.get(
    "/api/articles/{article_id}/comments",
    response_model=list[CommentResponse],
)
async def list_comments(
    response: Response,
    article_id: int,
    sort: str = Query("newest", pattern="^(newest|oldest)$"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    is_author = current_user and current_user.id == article.author_id
    is_moderator = current_user and current_user.role == "moderator"
    is_collab = current_user and any(
        m.user_id == current_user.id for m in article.collaborators
    ) if current_user else False

    if not is_author and not is_moderator and not is_collab and article.access_state not in ("public", "link"):
        raise HTTPException(status_code=403, detail="Access denied")

    offset = (page - 1) * size

    total = (
        await session.execute(
            select(func.count(Comment.id)).where(Comment.article_id == article_id)
        )
    ).scalar_one()

    order_col = Comment.created_at.asc() if sort == "oldest" else Comment.created_at.desc()

    result = await session.execute(
        select(Comment, User)
        .join(User, Comment.user_id == User.id)
        .where(Comment.article_id == article_id)
        .order_by(order_col)
        .offset(offset)
        .limit(size)
    )
    rows = result.all()

    response.headers["X-Total-Count"] = str(total)
    return [_comment_to_response(comment, author) for comment, author in rows]


@router.post(
    "/api/articles/{article_id}/comments",
    response_model=CommentResponse,
    status_code=201,
)
async def create_comment(
    article_id: int,
    data: CommentCreateRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    article = await session.get(Article, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    is_author = current_user.id == article.author_id
    is_moderator = current_user.role == "moderator"
    is_collab = any(
        m.user_id == current_user.id for m in article.collaborators
    )

    if not is_author and not is_moderator and not is_collab and article.access_state not in ("public", "link"):
        raise HTTPException(status_code=403, detail="Access denied")

    comment = Comment(
        article_id=article_id,
        user_id=current_user.id,
        content=data.content,
    )
    session.add(comment)

    if article.author_id != current_user.id:
        snippet = data.content[:100] + "..." if len(data.content) > 100 else data.content
        notif = Notification(
            user_id=article.author_id,
            sender_id=current_user.id,
            article_id=article_id,
            type="comment",
            data=json.dumps({"snippet": snippet, "article_title": article.title}),
        )
        session.add(notif)

    await session.commit()
    await session.refresh(comment)

    return _comment_to_response(comment, current_user)


@router.patch(
    "/api/comments/{comment_id}",
    response_model=CommentResponse,
)
async def update_comment(
    comment_id: int,
    data: CommentUpdateRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    comment = await session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your comment")

    comment.content = data.content
    await session.commit()
    await session.refresh(comment)

    author = await session.get(User, comment.user_id)
    return _comment_to_response(comment, author)


@router.delete("/api/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    comment = await session.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")

    article = await session.get(Article, comment.article_id)
    if comment.user_id != current_user.id and current_user.role != "moderator":
        raise HTTPException(status_code=403, detail="Not your comment")

    await session.delete(comment)
    await session.commit()
    return None
