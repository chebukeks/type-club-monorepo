import datetime
import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.rate_limit import limiter

from app.auth import (
    create_jwt,
    decode_jwt,
    generate_token,
    generate_verification_code,
    hash_password,
    verify_password,
)
from app.config import settings
from app.database import get_session
from app.mail import send_reset_password_email, send_verification_email
from app.models import User, VerificationToken
from app.schemas import (
    ForgotPasswordRequest,
    ForgotPasswordResponse,
    LoginRequest,
    RegisterRequest,
    ResendVerificationResponse,
    ResetPasswordRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

logger = logging.getLogger(__name__)


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


async def get_verified_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.email_verified:
        raise HTTPException(status_code=403, detail="Email not verified")
    return current_user


async def get_moderator_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "moderator":
        raise HTTPException(status_code=403, detail="Moderator access required")
    return current_user


async def _create_and_send_verification(user: User, session: AsyncSession) -> None:
    code_str = generate_verification_code()
    token = VerificationToken(
        user_id=user.id,
        token=code_str,
        purpose="email_verify",
        expires_at=datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(minutes=settings.verify_email_token_minutes),
    )
    session.add(token)
    await session.commit()
    try:
        await send_verification_email(user.email, user.nickname, code_str)
    except Exception:
        logger.exception("Failed to send verification email to %s", user.email)


@router.post("/register", response_model=TokenResponse, status_code=201)
@limiter.limit("5/minute")
async def register(
    request: Request,
    data: RegisterRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
):
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

    background_tasks.add_task(_create_and_send_verification, user, session)
    jwt_token = create_jwt(user.id)
    return TokenResponse(access_token=jwt_token)


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,
    data: LoginRequest,
    session: AsyncSession = Depends(get_session),
):
    user = (await session.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_jwt(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
):
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_me(
    data: UpdateProfileRequest,
    current_user: User = Depends(get_verified_user),
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

    if data.avatar_url is not None:
        if data.avatar_url and not data.avatar_url.startswith("/uploads/"):
            raise HTTPException(status_code=400, detail="Invalid avatar URL. Use the upload endpoint.")
        current_user.avatar_url = data.avatar_url

    if data.bio is not None:
        if len(data.bio) > 1000:
            raise HTTPException(status_code=400, detail="Bio is too long (max 1000 characters)")
        current_user.bio = data.bio

    if data.password is not None:
        if len(data.password) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        if not (any(c.isalpha() for c in data.password) and any(c.isdigit() for c in data.password)):
            raise HTTPException(status_code=400, detail="Password must contain at least one letter and one digit")
        if not data.old_password or not verify_password(data.old_password, current_user.password_hash):
            raise HTTPException(status_code=403, detail="Current password is incorrect")
        current_user.password_hash = hash_password(data.password)

    await session.commit()
    await session.refresh(current_user)
    return current_user


@router.post("/verify-email", response_model=ResendVerificationResponse)
@limiter.limit("5/minute")
async def verify_email(
    request: Request,
    data: VerifyEmailRequest,
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    code_to_check = (data.code or data.token or "").strip()
    if not code_to_check:
        raise HTTPException(status_code=400, detail="Verification code is required")

    target_user_id = current_user.id if current_user else None
    if not target_user_id and data.email:
        u = (await session.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
        if u:
            target_user_id = u.id

    if not target_user_id:
        raise HTTPException(status_code=400, detail="User identification required (login or provide email)")

    query = select(VerificationToken).where(
        VerificationToken.token == code_to_check,
        VerificationToken.purpose == "email_verify",
        VerificationToken.used == False,
        VerificationToken.user_id == target_user_id,
    )

    token = (await session.execute(query.order_by(VerificationToken.created_at.desc()))).scalars().first()

    if not token:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    if token.expires_at < datetime.datetime.now(datetime.timezone.utc):
        await session.delete(token)
        await session.commit()
        raise HTTPException(status_code=400, detail="Verification code has expired")

    user = await session.get(User, token.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.email_verified = True
    token.used = True
    await session.commit()
    return ResendVerificationResponse(message="Email verified successfully")


@router.post("/resend-verification", response_model=ResendVerificationResponse)
@limiter.limit("3/10minutes")
async def resend_verification(
    request: Request,
    data: Optional[VerifyEmailRequest] = None,
    current_user: User | None = Depends(get_optional_user),
    session: AsyncSession = Depends(get_session),
):
    user = current_user
    if not user and data and data.email:
        user = (await session.execute(select(User).where(User.email == data.email))).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated or email not found")

    if user.email_verified:
        return ResendVerificationResponse(message="Email already verified")

    await session.execute(
        update(VerificationToken)
        .where(
            VerificationToken.user_id == user.id,
            VerificationToken.purpose == "email_verify",
            VerificationToken.used == False,
        )
        .values(used=True)
    )

    code_str = generate_verification_code()
    token = VerificationToken(
        user_id=user.id,
        token=code_str,
        purpose="email_verify",
        expires_at=datetime.datetime.now(datetime.timezone.utc)
        + datetime.timedelta(minutes=settings.verify_email_token_minutes),
    )
    session.add(token)
    await session.commit()

    try:
        await send_verification_email(user.email, user.nickname, code_str)
    except Exception:
        logger.exception("Failed to send verification email to %s", user.email)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not send the verification email right now. Please try again later.",
        )
    return ResendVerificationResponse(message="Verification code sent")


@router.post("/forgot-password", response_model=ForgotPasswordResponse)
@limiter.limit("3/10minutes")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    session: AsyncSession = Depends(get_session),
):
    user = (await session.execute(select(User).where(User.email == data.email))).scalar_one_or_none()
    if user:
        await session.execute(
            update(VerificationToken)
            .where(
                VerificationToken.user_id == user.id,
                VerificationToken.purpose == "password_reset",
                VerificationToken.used == False,
            )
            .values(used=True)
        )

        token_str = generate_token()
        token = VerificationToken(
            user_id=user.id,
            token=token_str,
            purpose="password_reset",
            expires_at=datetime.datetime.now(datetime.timezone.utc)
            + datetime.timedelta(minutes=settings.reset_password_token_minutes),
        )
        session.add(token)
        await session.commit()

        await send_reset_password_email(user.email, user.nickname, token_str)

    return ForgotPasswordResponse(message="If the email is registered, a reset link has been sent")


@router.post("/reset-password", response_model=ResendVerificationResponse)
@limiter.limit("5/minute")
async def reset_password(
    request: Request,
    data: ResetPasswordRequest,
    session: AsyncSession = Depends(get_session),
):
    token = (
        await session.execute(
            select(VerificationToken).where(
                VerificationToken.token == data.token,
                VerificationToken.purpose == "password_reset",
                VerificationToken.used == False,
            )
        )
    ).scalar_one_or_none()

    if not token:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    if token.expires_at < datetime.datetime.now(datetime.timezone.utc):
        await session.delete(token)
        await session.commit()
        raise HTTPException(status_code=400, detail="Token has expired")

    user = await session.get(User, token.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(data.password)
    token.used = True
    await session.commit()
    return ResendVerificationResponse(message="Password reset successfully")
