import logging
import os

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from sqlalchemy import text
from app.config import settings
from app.models import Base
from app.database import engine
from app.rate_limit import limiter
from app.routers import auth, articles, users, comments, stats, og, og_image, sitemap, notifications, images

logging.basicConfig(level=settings.log_level.upper())
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Type Club API",
    version="0.1.0",
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
for dev_origin in [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:3000",
]:
    if dev_origin not in _origins:
        _origins.append(dev_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:[0-9]+)?$",
    allow_credentials=True,
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
    # SECURITY: Ensure production-safe secrets when not in debug mode
    if not settings.debug:
        if len(settings.jwt_secret_key) < 32 or "not-for-production" in settings.jwt_secret_key:
            raise RuntimeError("JWT_SECRET_KEY is not production-safe. Generate with: openssl rand -hex 32")
        if len(settings.service_token) < 32 or settings.service_token == "dev-token":
            raise RuntimeError("SERVICE_TOKEN is not production-safe. Generate with: openssl rand -hex 32")

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text("ALTER TABLE typeclub_users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);"))
        await conn.execute(text("ALTER TABLE typeclub_users ADD COLUMN IF NOT EXISTS bio TEXT;"))
        await conn.execute(text("ALTER TABLE typeclub_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();"))
        await conn.execute(text("ALTER TABLE typeclub_articles ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);"))
        await conn.execute(text("ALTER TABLE typeclub_articles ADD COLUMN IF NOT EXISTS share_role VARCHAR(20);"))
        await conn.execute(text("ALTER TABLE article_views ADD COLUMN IF NOT EXISTS viewer_hash VARCHAR(64);"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_article_views_viewer_hash ON article_views (viewer_hash);"))
    logger.info("Database tables and schema migrations completed")
    asyncio.create_task(run_periodic_cleanup())

@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("app.main:app", host=settings.api_host, port=settings.api_port, reload=settings.debug)
