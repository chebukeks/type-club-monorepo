import logging
import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from sqlalchemy import text
from app.config import settings
from app.models import Base
from app.database import engine
from app.routers import auth, articles, users, comments, stats, og, og_image, sitemap, notifications, images

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

app = FastAPI(title="Type Club API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)

app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(users.router)
app.include_router(comments.router)
app.include_router(stats.router)
app.include_router(og.router)
app.include_router(og_image.router)
app.include_router(sitemap.router)
app.include_router(notifications.router)
app.include_router(images.router)

uploads_dir = settings.uploads_dir
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


from app.tasks.cleanup_images import cleanup_orphaned_images
from app.database import async_session
import asyncio

async def run_periodic_cleanup():
    while True:
        try:
            # Run cleanup
            async with async_session() as session:
                await cleanup_orphaned_images(session)
        except Exception as e:
            logger.error(f"Error during image cleanup: {e}")
        # Sleep for 1 hour
        await asyncio.sleep(3600)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE typeclub_users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);"))
        await conn.execute(text("ALTER TABLE typeclub_users ADD COLUMN IF NOT EXISTS bio TEXT;"))
        await conn.execute(text("ALTER TABLE typeclub_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();"))
        await conn.execute(text("ALTER TABLE typeclub_articles ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);"))
        await conn.execute(text("ALTER TABLE typeclub_articles ADD COLUMN IF NOT EXISTS share_role VARCHAR(20);"))
    logger.info("Database tables and schema migrations completed")
    asyncio.create_task(run_periodic_cleanup())

@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.api_host, port=settings.api_port, reload=settings.debug)
