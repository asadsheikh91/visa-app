from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL_RAW = os.getenv("DATABASE_URL")
if not DATABASE_URL_RAW:
    raise RuntimeError(
        "DATABASE_URL is not set. Please configure backend/.env or the environment "
        "with a valid PostgreSQL connection URL."
    )


def normalize_async_database_url(url: str) -> str:
    """Convert common Postgres URLs to SQLAlchemy asyncpg dialect."""
    parsed = make_url(url)
    if parsed.drivername in {"postgres", "postgresql"}:
        parsed = parsed.set(drivername="postgresql+asyncpg")
    return parsed.render_as_string(hide_password=False)


DATABASE_URL = normalize_async_database_url(DATABASE_URL_RAW)
# Verbose SQL logging is opt-in (set SQL_ECHO=1 locally). Off by default so
# production logs aren't flooded with every statement.
_SQL_ECHO = os.getenv("SQL_ECHO", "").strip().lower() in {"1", "true", "yes"}
engine = create_async_engine(DATABASE_URL, echo=_SQL_ECHO)
async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
