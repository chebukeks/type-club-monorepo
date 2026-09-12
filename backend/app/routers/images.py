import os
import uuid
from pathlib import Path
from typing import List
from datetime import datetime
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User, Article, ArticleImage, CollaborationMember
from app.routers.auth import get_current_user
from app.schemas import ArticleImageResponse
from app.config import settings

router = APIRouter(prefix="/api", tags=["images"])

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB
MAX_ARTICLE_STORAGE = 500 * 1024 * 1024  # 500 MB
ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]


async def verify_image_content(content: bytes, mime_type: str) -> bool:
    if mime_type == "image/jpeg":
        return content.startswith(b'\xff\xd8\xff')
    elif mime_type == "image/png":
        return content.startswith(b'\x89PNG\r\n\x1a\n')
    elif mime_type == "image/gif":
        return content.startswith(b'GIF87a') or content.startswith(b'GIF89a')
    elif mime_type == "image/webp":
        return content.startswith(b'RIFF') and content[8:12] == b'WEBP'
    elif mime_type == "image/svg+xml":
        try:
            # Check for malicious content in SVG
            text_content = content.decode('utf-8')
            lower_content = text_content.lower()
            if "<script" in lower_content or "javascript:" in lower_content or "onload=" in lower_content or "onerror=" in lower_content:
                return False
            # Try parsing as XML
            ET.fromstring(text_content)
            return True
        except Exception:
            return False
    return False

@router.post("/articles/{article_id}/images", response_model=ArticleImageResponse)
async def upload_image(
    article_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Check if article exists and user has edit permission
    article_res = await db.execute(select(Article).where(Article.id == article_id))
    article = article_res.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    is_author = article.author_id == current_user.id
    if not is_author:
        collab_res = await db.execute(
            select(CollaborationMember)
            .where(CollaborationMember.article_id == article_id, CollaborationMember.user_id == current_user.id)
        )
        collab = collab_res.scalar_one_or_none()
        if not collab or collab.role not in ("editor", "co_author"):
            raise HTTPException(status_code=403, detail="Not authorized to edit this article")

    content = await file.read()
    file_size = len(content)

    if file_size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large (max {MAX_IMAGE_SIZE // (1024 * 1024)}MB)")
        
    mime_type = file.content_type
    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
        
    if not await verify_image_content(content, mime_type):
        raise HTTPException(status_code=400, detail="Invalid image content or corrupt file")

    # Check total storage limit for article
    images_res = await db.execute(select(ArticleImage).where(ArticleImage.article_id == article_id))
    current_images = images_res.scalars().all()
    total_size = sum(img.file_size for img in current_images)
    
    if total_size + file_size > MAX_ARTICLE_STORAGE:
        raise HTTPException(status_code=400, detail="Article storage quota exceeded")

    # Generate secure filename
    ext = ""
    if "." in file.filename:
        ext = "." + file.filename.rsplit(".", 1)[1].lower()
    
    # Optional sanitization of extension to prevent bypassing
    if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]:
        # infer from mime
        ext = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
            "image/svg+xml": ".svg",
        }.get(mime_type, "")

    secure_filename = str(uuid.uuid4()) + ext
    rel_path = f"articles/{article_id}/{secure_filename}"
    target_path = Path(settings.uploads_dir) / "articles" / str(article_id) / secure_filename
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(content)
    abs_path = str(target_path)
    url = f"/uploads/{rel_path}"

    image = ArticleImage(
        article_id=article_id,
        user_id=current_user.id,
        filename=secure_filename,
        original_name=file.filename[:500],
        file_path=abs_path,
        file_size=file_size,
        mime_type=mime_type,
        url=url
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)

    return image


@router.get("/articles/{article_id}/images", response_model=List[ArticleImageResponse])
async def list_images(
    article_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    # Check access to article
    article_res = await db.execute(select(Article).where(Article.id == article_id))
    article = article_res.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
        
    is_author = article.author_id == current_user.id
    if not is_author:
        collab_res = await db.execute(
            select(CollaborationMember)
            .where(CollaborationMember.article_id == article_id, CollaborationMember.user_id == current_user.id)
        )
        if not collab_res.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Not authorized to view this article")

    images_res = await db.execute(select(ArticleImage).where(ArticleImage.article_id == article_id))
    images = images_res.scalars().all()
    return images


@router.delete("/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_image(
    image_id: int,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    image_res = await db.execute(select(ArticleImage).where(ArticleImage.id == image_id))
    image = image_res.scalar_one_or_none()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found")
        
    article_res = await db.execute(select(Article).where(Article.id == image.article_id))
    article = article_res.scalar_one_or_none()
    
    if not article:
        # Orphaned image, just check if owner
        if image.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this image")
    else:
        is_author = article.author_id == current_user.id
        is_uploader = image.user_id == current_user.id
        if not (is_author or is_uploader):
            raise HTTPException(status_code=403, detail="Not authorized to delete this image")

    # Delete from filesystem
    if os.path.exists(image.file_path):
        try:
            os.remove(image.file_path)
        except Exception:
            pass
            
    await db.delete(image)
    await db.commit()
    return None
