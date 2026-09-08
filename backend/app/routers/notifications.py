import json
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import Article, Notification, User
from app.routers.auth import get_current_user
from app.schemas import NotificationListResponse, NotificationResponse

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


def _to_response(notif: Notification) -> NotificationResponse:
    sender_nick = notif.sender.nickname if notif.sender else None
    sender_avatar = notif.sender.avatar_url if notif.sender else None
    art_title = notif.article.title if notif.article else None
    art_slug = notif.article.slug if notif.article else None
    art_author = notif.article.author.nickname if (notif.article and notif.article.author) else None

    extra_data = {}
    if notif.data:
        try:
            extra_data = json.loads(notif.data)
        except Exception:
            pass

    if not art_title and "article_title" in extra_data:
        art_title = extra_data["article_title"]

    title = ""
    message = ""
    link = None

    display_sender = sender_nick or "Пользователь"
    display_article = art_title or "Статья"

    if notif.type == "comment":
        title = f"{display_sender} оставил(а) комментарий к статье «{display_article}»"
        snippet = extra_data.get("snippet", "")
        message = snippet if snippet else "Оставил(а) новый комментарий"
        if art_author and art_slug:
            link = f"/{art_author}/{art_slug}#comments"
        elif notif.article_id:
            link = f"/editor/{notif.article_id}"
    elif notif.type == "collab_invite":
        role = extra_data.get("role", "advisor")
        role_label = "соавтором" if role == "coauthor" else "советчиком"
        title = f"Приглашение стать {role_label}"
        message = f"{display_sender} пригласил(а) вас {role_label} статьи «{display_article}»"
        if notif.article_id:
            link = f"/editor/{notif.article_id}"
    else:
        title = extra_data.get("title", "Уведомление")
        message = extra_data.get("message", notif.data or "")
        link = extra_data.get("link")

    return NotificationResponse(
        id=notif.id,
        user_id=notif.user_id,
        sender_id=notif.sender_id,
        sender_nickname=sender_nick,
        sender_avatar_url=sender_avatar,
        article_id=notif.article_id,
        article_title=art_title,
        article_slug=art_slug,
        article_author_nickname=art_author,
        type=notif.type,
        data=notif.data,
        read=notif.read,
        is_read=notif.read,
        title=title,
        message=message,
        link=link,
        created_at=notif.created_at,
    )


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    offset = (page - 1) * size

    unread_count = (
        await session.execute(
            select(func.count(Notification.id)).where(
                Notification.user_id == current_user.id,
                Notification.read == False,
            )
        )
    ).scalar_one()

    query = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        query = query.where(Notification.read == False)

    total = (
        await session.execute(
            select(func.count(Notification.id)).where(Notification.user_id == current_user.id)
        )
    ).scalar_one()

    query = query.order_by(Notification.created_at.desc()).offset(offset).limit(size)
    result = await session.execute(query)
    notifications = result.scalars().all()

    return NotificationListResponse(
        items=[_to_response(n) for n in notifications],
        unread_count=unread_count,
        total=total,
    )


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
async def mark_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    notif = await session.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.read = True
    await session.commit()
    await session.refresh(notif)
    return _to_response(notif)


@router.post("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    await session.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.read == False)
        .values(read=True)
    )
    await session.commit()
    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    notif = await session.get(Notification, notification_id)
    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")

    await session.delete(notif)
    await session.commit()
