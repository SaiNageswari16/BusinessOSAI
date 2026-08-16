import os
import json
import time
import logging
import uuid
from functools import wraps
from fastapi.encoders import jsonable_encoder
try:
    import redis.asyncio as redis
except ImportError:
    redis = None

logger = logging.getLogger("redis_cache")

# Load Redis Config
REDIS_URL = os.getenv("REDIS_URL")
REDIS_HOST = os.getenv("REDIS_HOST", "127.0.0.1")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

redis_client = None
_redis_disabled_until = 0  # Timestamp until which Redis is bypassed if offline

if redis:
    try:
        if REDIS_URL:
            redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=0.1, socket_connect_timeout=0.1)
        else:
            redis_client = redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                password=REDIS_PASSWORD,
                decode_responses=True,
                socket_timeout=0.1,
                socket_connect_timeout=0.1
            )
        logger.info("Redis cache client initialized.")
    except Exception as e:
        logger.warning(f"Redis client initialization skipped: {e}")
        redis_client = None


def _is_redis_ready() -> bool:
    """Returns True if Redis is configured and not temporarily disabled due to outage."""
    global _redis_disabled_until
    if not redis_client:
        return False
    now = time.time()
    if now < _redis_disabled_until:
        return False  # Bypassed — zero latency
    return True


def _disable_redis_temporarily(reason: str):
    """Disables Redis attempts for 60 seconds when connection fails, avoiding repeated 2s timeouts."""
    global _redis_disabled_until
    _redis_disabled_until = time.time() + 60.0
    logger.warning(f"Disabling Redis cache for 60s due to connection error: {reason}")


def cache_response(expire: int = 60, prefix: str = "cache"):
    """
    FastAPI endpoint cache decorator using Redis.
    Bypasses Redis instantly (0ms delay) if Redis is offline or not installed.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            if not _is_redis_ready():
                return await func(*args, **kwargs)

            try:
                # Exclude internal non-serializable objects from raw kwargs iteration
                EXCLUDED_KWARGS = {"current_user", "ctx", "db", "request", "response"}
                
                key_parts = [prefix, func.__name__]
                
                # Add tenant scope FIRST to guarantee strict multi-tenant isolation
                user_ctx = kwargs.get("current_user") or kwargs.get("ctx")
                if user_ctx:
                    tenant_id = getattr(user_ctx, "tenant_id", None)
                    if not tenant_id and hasattr(user_ctx, "user"):
                        tenant_id = getattr(user_ctx.user, "tenant_id", None)
                    if tenant_id:
                        key_parts.append(f"tenant:{tenant_id}")
                        
                    user_id = getattr(user_ctx, "user_id", None)
                    if not user_id and hasattr(user_ctx, "user"):
                        user_id = getattr(user_ctx.user, "id", None)
                    if user_id:
                        key_parts.append(f"user:{user_id}")

                for k, v in sorted(kwargs.items()):
                    if k in EXCLUDED_KWARGS or str(k).startswith("_"):
                        continue
                    # Only include primitive parameter types in cache keys
                    if isinstance(v, (str, int, float, bool, type(None), uuid.UUID)):
                        key_parts.append(f"{k}:{v}")
                
                cache_key = ":".join(key_parts)
                
                # Try reading from Redis cache
                try:
                    cached_val = await redis_client.get(cache_key)
                    if cached_val:
                        return json.loads(cached_val)
                except (redis.RedisError, TimeoutError, OSError) as read_ex:
                    _disable_redis_temporarily(str(read_ex))
                    return await func(*args, **kwargs)
                
                # Execute original DB query function
                result = await func(*args, **kwargs)
                
                # Save to Redis
                try:
                    serialized = json.dumps(jsonable_encoder(result))
                    await redis_client.setex(cache_key, expire, serialized)
                except Exception:
                    pass
                
                return result
                
            except Exception as e:
                return await func(*args, **kwargs)
                
        return wrapper
    return decorator



async def invalidate_cache_by_prefix(prefix: str):
    """
    Evicts all cached keys matching a specific prefix (e.g. on new product creation / updates).
    """
    if not redis_client:
        return
    try:
        keys = await redis_client.keys(f"{prefix}:*")
        if keys:
            await redis_client.delete(*keys)
            logger.info(f"Evicted {len(keys)} cached keys matching prefix: {prefix}")
    except Exception as e:
        logger.error(f"Failed to invalidate Redis cache: {e}")
