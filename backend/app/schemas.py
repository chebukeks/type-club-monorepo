from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ──

class RegisterRequest(BaseModel):
    nickname: str
    email: EmailStr
    password: str
    confirm_password: str

    @field_validator("nickname")
    @classmethod
    def nickname_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) < 2:
            raise ValueError("Nickname must be at least 2 characters")
        return v

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
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    nickname: str
    email: str
    email_verified: bool
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class UpdateProfileRequest(BaseModel):
    nickname: Optional[str] = None
    old_password: Optional[str] = None
    password: Optional[str] = None
    confirm_password: Optional[str] = None

    @field_validator("confirm_password")
    @classmethod
    def passwords_match_if_present(cls, v: str | None, info) -> str | None:
        if v is not None and info.data.get("password") != v:
            raise ValueError("Passwords do not match")
        return v


# ── Email verification / password reset ──

class VerifyEmailRequest(BaseModel):
    token: str


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
    created_at: datetime
    updated_at: datetime

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
