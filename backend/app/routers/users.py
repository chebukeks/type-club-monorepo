from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User
from app.schemas import UserSuggestion

router = APIRouter(prefix="/api/users", tags=["users"])


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
