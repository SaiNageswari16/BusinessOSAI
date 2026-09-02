import asyncio
import os
import sys
from dotenv import load_dotenv

load_dotenv()

import asyncpg

async def migrate():
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = int(os.getenv("POSTGRES_PORT", 5432))
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "0111")
    database = os.getenv("POSTGRES_DB", "businessosai")

    print(f"Connecting to database {database} on {host}:{port} as {user}...")
    try:
        conn = await asyncpg.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database
        )
        print("Connected successfully.")

        queries = [
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_review_url VARCHAR;",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_place_id VARCHAR;",
            "ALTER TABLE companies ADD COLUMN IF NOT EXISTS google_review_enabled BOOLEAN DEFAULT TRUE;"
        ]

        for q in queries:
            print(f"Executing: {q}")
            await conn.execute(q)
            print("Done.")

        await conn.close()
        print("Migration completed successfully!")
    except Exception as e:
        print(f"Migration failed: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(migrate())
