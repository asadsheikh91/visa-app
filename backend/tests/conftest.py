"""
conftest.py

Sets up a minimal test environment:
  - DATABASE_URL: required by database.py at import time; set to a dummy URL
    so create_async_engine() doesn't raise at module load.
  - Rate limiter: reset between every test so no test hits the per-minute cap.
"""

import os
import sys

# Must be set BEFORE any module imports database.py.
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://testuser:testpass@localhost:5432/testdb",
)

# Ensure the backend root is on sys.path.
_backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_root not in sys.path:
    sys.path.insert(0, _backend_root)

import pytest


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """
    Reset slowapi's in-memory rate limit counters before every test.
    Without this, tests that share the same endpoint quickly exhaust the
    per-minute limit (e.g. 10/minute on the check endpoint) and get 429s.
    """
    from limiter import limiter
    try:
        limiter._storage.reset()
    except Exception:
        pass
    yield
    try:
        limiter._storage.reset()
    except Exception:
        pass
