from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


import re


def check_password_strength(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(v) > 128:
        raise ValueError("Password must be at most 128 characters")
    has_letter = any(c.isalpha() for c in v)
    has_digit = any(c.isdigit() for c in v)
    if not (has_letter and has_digit):
        raise ValueError("Password must contain at least one letter and one digit")
    weak = {"password", "12345678", "qwerty123", "password1", "abc12345", "123456789"}
    if v.lower() in weak:
        raise ValueError("This password is too common")
    return v


# ── Auth ──

class RegisterRequest(BaseModel):
    nickname: str
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError("Nickname must be at least 2 characters")
        if len(v) > 30:
            raise ValueError("Nickname must be at most 30 characters")
        if not re.match(r"^[a-zA-Z0-9_-]+$", v):
            raise ValueError("Nickname can only contain Latin letters, numbers, underscores and hyphens")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return check_password_strength(v)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    id: int
    nickname: str
    email: str
    email_verified: bool
    role: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    old_password: Optional[str] = None
    password: Optional[str] = None
    confirm_password: Optional[str] = None

    @field_validator("avatar_url")
    @classmethod
    def validate_avatar_url(cls, v: str | None) -> str | None:
        if v is not None and v != "" and not v.startswith("/uploads/"):
            raise ValueError("Avatar URL must start with /uploads/")
        return v

    @field_validator("nickname")
    @classmethod
    def validate_nickname_update(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v or len(v) < 2:
                raise ValueError("Nickname must be at least 2 characters")
            if len(v) > 30:
                raise ValueError("Nickname must be at most 30 characters")
            if not re.match(r"^[a-zA-Z0-9_-]+$", v):
                raise ValueError("Nickname can only contain Latin letters, numbers, underscores and hyphens")
        return v

    @field_validator("password")
    @classmethod
    def validate_password_update(cls, v: str | None) -> str | None:
        if v is not None:
            return check_password_strength(v)
        return v

    @field_validator("confirm_password")
    @classmethod
    def passwords_match_if_present(cls, v: str | None, info) -> str | None:
        if v is not None and info.data.get("password") != v:
            raise ValueError("Passwords do not match")
        return v


# ── Email verification / password reset ──

class VerifyEmailRequest(BaseModel):
    code: Optional[str] = None
    token: Optional[str] = None
    email: Optional[EmailStr] = None


class ResendVerificationResponse(BaseModel):
    message: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str
    confirm_password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        return check_password_strength(v)

    @field_validator("confirm_password")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Passwords do not match")
        return v


# ── Articles ──

class ArticleCreateRequest(BaseModel):
    title: str
    content: str = ""
    slug: Optional[str] = None


class ArticleUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    access_state: Optional[str] = None
    slug: Optional[str] = None

    @field_validator("access_state")
    @classmethod
    def valid_state(cls, v: str | None) -> str | None:
        if v is not None and v not in ("private", "link", "public", "blocked"):
            raise ValueError("Invalid access_state")
        return v


class ArticleResponse(BaseModel):
    id: int
    author_id: int
    title: str
    content: str
    access_state: str
    slug: str
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    liked_by_user: bool = False
    created_at: datetime
    updated_at: datetime
    author_nickname: Optional[str] = None

    model_config = {"from_attributes": True}


class ArticleListItem(BaseModel):
    id: int
    title: str
    access_state: str
    slug: str
    author_nickname: str
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0
    created_at: datetime
    updated_at: datetime
    my_roles: Optional[list[str]] = None

    model_config = {"from_attributes": True}


class UserSuggestion(BaseModel):
    id: int
    nickname: str

    model_config = {"from_attributes": True}


# ── Images ──

class ArticleImageResponse(BaseModel):
    id: int
    url: str
    filename: str
    file_size: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Moderation ──

class ModerateRequest(BaseModel):
    action: str

    @field_validator("action")
    @classmethod
    def valid_action(cls, v: str) -> str:
        if v not in ("block", "unblock"):
            raise ValueError("Action must be 'block' or 'unblock'")
        return v


class ModerateResponse(BaseModel):
    message: str


# ── Comments ──

class CommentCreateRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        if len(v) > 5000:
            raise ValueError("Comment is too long (max 5000 characters)")
        return v


class CommentUpdateRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Comment cannot be empty")
        if len(v) > 5000:
            raise ValueError("Comment is too long (max 5000 characters)")
        return v


class CommentResponse(BaseModel):
    id: int
    article_id: int
    user_id: int
    author_nickname: str
    content: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Likes ──

class LikeResponse(BaseModel):
    liked: bool
    count: int


# ── Views ──

class ViewResponse(BaseModel):
    count: int


# ── User Profile ──

class UserProfileResponse(BaseModel):
    id: int
    nickname: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    role: str
    article_count: int = 0
    total_views: int = 0
    total_likes: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Collaboration ──

VALID_ROLES = ("editor", "co_author")


class InviteCollaboratorRequest(BaseModel):
    nickname: str
    role: str

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError("Role must be 'editor' or 'co_author'")
        return v


class CollaboratorResponse(BaseModel):
    id: int
    user_id: int
    nickname: str
    role: str
    source: str
    invited_at: datetime

    model_config = {"from_attributes": True}


class ShareLinkResponse(BaseModel):
    token: str
    url: str
    role: str


class GenerateShareLinkRequest(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError("Role must be 'editor' or 'co_author'")
        return v


class CheckAccessResponse(BaseModel):
    has_access: bool
    role: str


class SyncStateRequest(BaseModel):
    content: str


# ── Notifications ──

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    sender_id: Optional[int] = None
    sender_nickname: Optional[str] = None
    sender_avatar_url: Optional[str] = None
    article_id: Optional[int] = None
    article_title: Optional[str] = None
    article_slug: Optional[str] = None
    article_author_nickname: Optional[str] = None
    type: str  # 'comment', 'collab_invite'
    data: Optional[str] = None
    read: bool
    is_read: bool = False
    title: str = ""
    message: str = ""
    link: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int
    total: int
