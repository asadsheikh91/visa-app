"""
limiter.py

Shared slowapi rate limiter instance.
Imported by main.py (registers the exception handler) and by routers
(applies @limiter.limit() decorators).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
