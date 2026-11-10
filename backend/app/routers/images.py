import os
import uuid
import asyncio
import socket
import ipaddress
from urllib.parse import urlparse
from pathlib import Path
from typing import List
from datetime import datetime
from xml.etree import ElementTree as ET

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User, Article, ArticleImage, CollaborationMember
from app.routers.auth import get_current_user
from app.schemas import ArticleImageResponse, UploadImageFromUrlRequest
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
            text_content = content.decode('utf-8')
            tree = ET.fromstring(text_content)

            DANGEROUS_ELEMENTS = {
                'script', 'foreignobject', 'iframe', 'object', 'embed', 'applet',
                'audio', 'video', 'style', 'meta', 'link'
            }

            def check_element(el) -> bool:
                tag = el.tag.split('}')[-1].lower() if '}' in str(el.tag) else str(el.tag).lower()
                if tag in DANGEROUS_ELEMENTS:
                    return False
                for attr_name, attr_val in el.attrib.items():
                    local_name = attr_name.split('}')[-1].lower() if '}' in attr_name else attr_name.lower()
                    if local_name.startswith('on'):
                        return False
                    val_lower = str(attr_val).strip().lower()
                    if 'javascript:' in val_lower or 'data:text/html' in val_lower or 'vbscript:' in val_lower:
                        return False
                for child in el:
                    if not check_element(child):
                        return False
                return True

            return check_element(tree)
        except Exception:
            return False
    return False


async def is_safe_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https"):
            return False
        hostname = parsed.hostname
        if not hostname or hostname.lower() in ("localhost", "127.0.0.1", "::1"):
            return False

        addr_info = await asyncio.to_thread(socket.getaddrinfo, hostname, None)
        for entry in addr_info:
            sockaddr = entry[4]
            ip_str = sockaddr[0]
            ip = ipaddress.ip_address(ip_str)
            if (
                ip.is_private
                or ip.is_loopback
                or ip.is_link_local
                or ip.is_reserved
                or ip.is_multicast
            ):
                return False
        return True
    except Exception:
        return False


def detect_mime_type(content: bytes, header_mime: str | None = None) -> str:
    if header_mime:
        cleaned = header_mime.split(";")[0].strip().lower()
        if cleaned in ALLOWED_MIME_TYPES:
            return cleaned
    if content.startswith(b'\xff\xd8\xff'):
        return "image/jpeg"
    elif content.startswith(b'\x89PNG\r\n\x1a\n'):
        return "image/png"
    elif content.startswith(b'GIF87a') or content.startswith(b'GIF89a'):
        return "image/gif"
    elif content.startswith(b'RIFF') and content[8:12] == b'WEBP':
        return "image/webp"
    elif b'<svg' in content[:1000].lower():
        return "image/svg+xml"
    return ""


async def check_article_edit_permission(article_id: int, user_id: int, db: AsyncSession) -> Article:
    article_res = await db.execute(select(Article).where(Article.id == article_id))
    article = article_res.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    is_author = article.author_id == user_id
    if not is_author:
        collab_res = await db.execute(
            select(CollaborationMember)
            .where(CollaborationMember.article_id == article_id, CollaborationMember.user_id == user_id)
        )
        collab = collab_res.scalar_one_or_none()
        if not collab or collab.role not in ("editor", "co_author"):
            raise HTTPException(status_code=403, detail="Not authorized to edit this article")
    return article


async def save_image_record(
    article_id: int,
    user_id: int,
    filename_hint: str,
    mime_type: str,
    content: bytes,
    db: AsyncSession,
) -> ArticleImage:
    file_size = len(content)

    if file_size > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail=f"File too large (max {MAX_IMAGE_SIZE // (1024 * 1024)}MB)")

    if mime_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")

    if not await verify_image_content(content, mime_type):
        raise HTTPException(status_code=400, detail="Invalid image content or corrupt file")

    images_res = await db.execute(select(ArticleImage).where(ArticleImage.article_id == article_id))
    current_images = images_res.scalars().all()
    total_size = sum(img.file_size for img in current_images)

    if total_size + file_size > MAX_ARTICLE_STORAGE:
        raise HTTPException(status_code=400, detail="Article storage quota exceeded")

    ext = ""
    if "." in filename_hint:
        ext = "." + filename_hint.rsplit(".", 1)[1].lower()

    if ext not in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"]:
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
    try:
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(content)
    except OSError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Storage write error: {str(e)}",
        )
    abs_path = str(target_path)
    url = f"/uploads/{rel_path}"

    image = ArticleImage(
        article_id=article_id,
        user_id=user_id,
        filename=secure_filename,
        original_name=filename_hint[:500],
        file_path=abs_path,
        file_size=file_size,
        mime_type=mime_type,
        url=url,
    )
    db.add(image)
    await db.commit()
    await db.refresh(image)

    return image


@router.post("/articles/{article_id}/images", response_model=ArticleImageResponse)
async def upload_image(
    article_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    await check_article_edit_permission(article_id, current_user.id, db)
    content = await file.read()
    detected_mime = detect_mime_type(content, file.content_type)
    if not detected_mime:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    return await save_image_record(
        article_id=article_id,
        user_id=current_user.id,
        filename_hint=file.filename or "image",
        mime_type=detected_mime,
        content=content,
        db=db,
    )


@router.post("/articles/{article_id}/images/from-url", response_model=ArticleImageResponse)
async def upload_image_from_url(
    article_id: int,
    data: UploadImageFromUrlRequest,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    await check_article_edit_permission(article_id, current_user.id, db)

    if not await is_safe_url(data.url):
        raise HTTPException(status_code=400, detail="Invalid or restricted URL")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            resp = await client.get(data.url, headers=headers)
            if resp.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to fetch image from URL (HTTP {resp.status_code})")
            for r in resp.history:
                if not await is_safe_url(str(r.url)):
                    raise HTTPException(status_code=400, detail="Redirected to restricted URL")
            if not await is_safe_url(str(resp.url)):
                raise HTTPException(status_code=400, detail="Redirected to restricted URL")
            content = resp.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to download image from URL: {str(e)}")

    parsed = urlparse(data.url)
    raw_name = Path(parsed.path).name or "image"
    mime_type = detect_mime_type(content, resp.headers.get("Content-Type"))
    if not mime_type:
        raise HTTPException(status_code=400, detail="Could not determine a supported image format")

    return await save_image_record(
        article_id=article_id,
        user_id=current_user.id,
        filename_hint=raw_name,
        mime_type=mime_type,
        content=content,
        db=db,
    )


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
