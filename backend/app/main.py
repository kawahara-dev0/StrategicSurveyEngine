"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.middleware.schema_middleware import SchemaSwitchingMiddleware
from app.routers import admin, manager, survey

app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
)

# CORS last = outermost: handles OPTIONS first, adds headers to all responses (incl. 500)
app.add_middleware(SchemaSwitchingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(admin.router)
app.include_router(manager.router)
app.include_router(survey.router)


@app.get("/health")
async def health():
    """Health check (no DB, no schema switch)."""
    return {"status": "ok"}
