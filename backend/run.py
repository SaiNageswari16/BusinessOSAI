"""Run: python run.py"""

import uvicorn

from src.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    config = uvicorn.Config(
        "src.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_debug and not settings.is_production,
        timeout_keep_alive=120,
    )
    uvicorn.Server(config).run()
