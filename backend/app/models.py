from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "typeclub_users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    nickname: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified: Mapped[bool] = mapped_column(default=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="user", server_default="user")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    articles: Mapped[list["Article"]] = relationship(back_populates="author", lazy="selectin")


class Article(Base):
    __tablename__ = "typeclub_articles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("typeclub_users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    access_state: Mapped[str] = mapped_column(String(20), nullable=False, default="private")
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    share_token: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    author: Mapped["User"] = relationship(back_populates="articles", lazy="selectin")
    collaborators: Mapped[list["CollaborationMember"]] = relationship(
        back_populates="article", lazy="selectin", cascade="all, delete-orphan"
    )


class CollaborationMember(Base):
    __tablename__ = "collaboration_members"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    article_id: Mapped[int] = mapped_column(
        ForeignKey("typeclub_articles.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        ForeignKey("typeclub_users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="editor")
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="invite")
    invited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    article: Mapped["Article"] = relationship(back_populates="collaborators")
    user: Mapped["User"] = relationship(lazy="selectin")


class VerificationToken(Base):
    __tablename__ = "typeclub_verification_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("typeclub_users.id"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    purpose: Mapped[str] = mapped_column(String(20), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
