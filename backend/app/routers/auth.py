from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_jwt, decode_jwt, hash_password, verify_password
from app.database import get_session
from app.models import User
from app.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def get_current_user(
    session: AsyncSession = Depends(get_session),
    authorization: str | None = Header(None),
) -> User:
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = decode_jwt(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def get_optional_user(
    session: AsyncSession = Depends(get_session),
    authorization: str | None = Header(None),
) -> User | None:
    if not authorization:
        return None
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        return None
    user_id = decode_jwt(token)
    if user_id is None:
        return None
    return await session.get(User, user_id)


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(data: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = (await session.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    existing_nick = (await session.execute(select(User).where(User.nickname == data.nickname))).scalar_one_or_none()
    if existing_nick:
        raise HTTPException(status_code=409, detail="Nickname already taken")

    user = User(
        nickname=data.nickname,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    token = create_jwt(user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
async def login(data: LoginRequest, session: AsyncSession = Depends(get_session)):
    user = (await session.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_jwt(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    if data.nickname is not None:
        existing = (
            await session.execute(
                select(User).where(User.nickname == data.nickname, User.id != current_user.id)
            )
        ).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Nickname already taken")
        current_user.nickname = data.nickname

    if data.password is not None:
        current_user.password_hash = hash_password(data.password)

    await session.commit()
    await session.refresh(current_user)
    return current_user
