#!/usr/bin/env python3
"""
Survey lifecycle batch: suspend expired contracts, delete past retention.
Run via cron (e.g. daily at 00:05):
  docker compose exec backend python run_survey_lifecycle.py
  # or locally: cd backend && python run_survey_lifecycle.py
"""

import asyncio
import os
import sys

# Ensure backend/app is on path when run from project root or backend
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import AsyncSessionLocal
from app.services.survey_lifecycle import run_survey_lifecycle


async def main() -> int:
    async with AsyncSessionLocal() as session:
        try:
            result = await run_survey_lifecycle(session)
            await session.commit()
            print(
                f"suspended={result.suspended_count} ids={result.suspended_ids!r} "
                f"deleted={result.deleted_count} ids={result.deleted_ids!r}"
            )
            return 0
        except Exception as e:
            await session.rollback()
            print(f"Error: {e}", file=sys.stderr)
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
