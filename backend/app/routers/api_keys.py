import datetime
import hashlib
import secrets
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import ApiKey, User
from app.routers.auth import get_verified_user
from app.schemas import ApiKeyCreatedResponse, ApiKeyCreateRequest, ApiKeyResponse

router = APIRouter(prefix="/api/api-keys", tags=["api_keys"])


def _api_key_to_response(key: ApiKey) -> ApiKeyResponse:
    scopes_list = [s.strip() for s in key.scopes.split(",") if s.strip()]
    return ApiKeyResponse(
        id=key.id,
        name=key.name,
        prefix=key.prefix,
        scopes=scopes_list,
        created_at=key.created_at,
        expires_at=key.expires_at,
        last_used_at=key.last_used_at,
    )


@router.post("", response_model=ApiKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    data: ApiKeyCreateRequest,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    # Maximum 20 API keys per user to prevent bloat
    existing_count = (
        await session.execute(
            select(ApiKey).where(ApiKey.user_id == current_user.id)
        )
    ).scalars().all()
    if len(existing_count) >= 20:
        raise HTTPException(
            status_code=400,
            detail="Maximum number of API keys reached (20). Please revoke unused keys."
        )

    # Format: tc_pat_ + 40 hex chars
    raw_token = f"tc_pat_{secrets.token_hex(20)}"
    prefix = f"{raw_token[:13]}..."
    key_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    expires_at: Optional[datetime.datetime] = None
    if data.expires_in_days and data.expires_in_days > 0:
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            days=data.expires_in_days
        )

    scopes_str = ",".join(data.scopes)

    api_key = ApiKey(
        user_id=current_user.id,
        name=data.name,
        prefix=prefix,
        key_hash=key_hash,
        scopes=scopes_str,
        expires_at=expires_at,
    )
    session.add(api_key)
    await session.commit()
    await session.refresh(api_key)

    resp = _api_key_to_response(api_key)
    return ApiKeyCreatedResponse(
        id=resp.id,
        name=resp.name,
        prefix=resp.prefix,
        scopes=resp.scopes,
        created_at=resp.created_at,
        expires_at=resp.expires_at,
        last_used_at=resp.last_used_at,
        token=raw_token,
    )


@router.get("", response_model=list[ApiKeyResponse])
async def list_api_keys(
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    result = await session.execute(
        select(ApiKey)
        .where(ApiKey.user_id == current_user.id)
        .order_by(ApiKey.created_at.desc())
    )
    keys = result.scalars().all()
    return [_api_key_to_response(k) for k in keys]


@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: int,
    current_user: User = Depends(get_verified_user),
    session: AsyncSession = Depends(get_session),
):
    api_key = await session.get(ApiKey, key_id)
    if not api_key or api_key.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="API key not found")

    await session.delete(api_key)
    await session.commit()
    return None
