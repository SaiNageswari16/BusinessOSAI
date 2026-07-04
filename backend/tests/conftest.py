import os
import asyncio
import pytest

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from src.main import app
from src.config import get_settings
from src.database.base import Base
from src.database.session import get_db
import src.utils.email as email_utils


settings = get_settings()


TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL") or settings.async_database_url


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop()
    yield loop


@pytest.fixture(scope="session")
async def engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(scope="session")
async def db_session_factory(engine):
    return async_sessionmaker(engine, expire_on_commit=False)


@pytest.fixture
async def db(db_session_factory):
    async with db_session_factory() as session:
        yield session


@pytest.fixture
async def async_client(db_session_factory):
    async def override_get_db():
        async with db_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    # disable real email sending during tests
    async def _noop_send_email(*args, **kwargs):
        return None

    email_utils.send_email = _noop_send_email

    async with AsyncClient(app=app, base_url="http://testserver") as client:
        yield client
