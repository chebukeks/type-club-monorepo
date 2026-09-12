import os
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import ArticleImage, Article

logger = logging.getLogger(__name__)

async def cleanup_orphaned_images(session: AsyncSession):
    """
    Finds and removes images that are no longer referenced in any article's content.
    Only checks images that are at least 1 hour old to avoid deleting images
    that were just uploaded and not yet saved in an article.
    """
    logger.info("Starting cleanup of orphaned images...")
    
    # 1 hour threshold
    time_threshold = datetime.now(timezone.utc) - timedelta(hours=1)
    
    # We might need to cast time_threshold or just rely on the DB
    images_res = await session.execute(
        select(ArticleImage).where(ArticleImage.created_at < time_threshold)
    )
    images = images_res.scalars().all()
    
    deleted_count = 0
    
    for img in images:
        article_res = await session.execute(select(Article).where(Article.id == img.article_id))
        article = article_res.scalar_one_or_none()
        
        if not article:
            # Parent article doesn't exist, definitively an orphan
            await _delete_image(session, img)
            deleted_count += 1
            continue
            
        # Check if URL or filename is in ANY article content
        any_article_res = await session.execute(
            select(Article.id).where(
                (Article.content.like(f"%{img.filename}%")) |
                (Article.content.like(f"%{img.url}%"))
            ).limit(1)
        )
        any_article_id = any_article_res.scalar_one_or_none()
        
        if not any_article_id:
            await _delete_image(session, img)
            deleted_count += 1
            
    await session.commit()
    logger.info(f"Cleanup completed. Deleted {deleted_count} orphaned images.")

async def _delete_image(session: AsyncSession, img: ArticleImage):
    logger.info(f"Deleting orphaned image {img.id}: {img.filename}")
    if os.path.exists(img.file_path):
        try:
            os.remove(img.file_path)
        except OSError as e:
            logger.error(f"Failed to delete file {img.file_path}: {e}")
    await session.delete(img)
