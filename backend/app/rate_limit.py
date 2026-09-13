"""
Centralized rate-limiter configuration.

Uses slowapi with in-memory storage (suitable for single-instance deployments).
For multi-instance, switch to RedisBackend.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200/minute"],
    storage_uri="memory://",
)
