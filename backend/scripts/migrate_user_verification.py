"""
Standalone database migration script for User Verification & First-Time Login.
Run directly on the server if manual database execution is preferred:
    python backend/scripts/migrate_user_verification.py
"""
import asyncio
import os
import sys

# Ensure backend root is on Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from src.database.session import engine


MIGRATION_QUERIES = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT TRUE;",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(20);",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP WITH TIME ZONE;",
    "UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL;",
]


async def run_migration():
    print("🚀 Starting User Verification database migration...")
    async with engine.begin() as conn:
        for q in MIGRATION_QUERIES:
            print(f"Executing: {q}")
            await conn.execute(text(q))
    print("✅ Migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run_migration())
