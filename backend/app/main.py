"""FastAPI application entry point."""
from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.schema_middleware import SchemaSwitchingMiddleware
from app.routers import admin

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

# Dynamic schema-switching: must run before any route that uses DB
app.add_middleware(SchemaSwitchingMiddleware)

app.include_router(admin.router)


@app.get("/health")
async def health():
    """Health check (no DB, no schema switch)."""
    return {"status": "ok"}


async def _debug_schema_impl(db: AsyncSession) -> dict:
    result = await db.execute(text("SHOW search_path"))
    path = result.scalar() or ""
    return {"search_path": path}


@app.get("/debug/schema")
async def debug_schema(db: AsyncSession = Depends(get_db)):
    """
    Phase 1 checkpoint: returns current search_path.
    Use header X-Survey-UUID: {uuid} to verify tenant schema switch.
    """
    return await _debug_schema_impl(db)


@app.get("/survey/{survey_id}/debug/schema")
@app.get("/manager/{survey_id}/debug/schema")
async def debug_schema_tenant(
    survey_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Phase 1 checkpoint: returns current search_path for the survey.
    Middleware resolves survey_id from path and sets tenant schema.
    """
    return await _debug_schema_impl(db)
