"""Versioned cache for public endpoints: any content change bumps the version, so no stale pages."""
from django.core.cache import cache

VERSION_KEY = "public:version"


def version() -> int:
    v = cache.get(VERSION_KEY)
    if v is None:
        v = 1
        cache.set(VERSION_KEY, v, None)
    return v


def bump() -> None:
    try:
        cache.incr(VERSION_KEY)
    except ValueError:
        cache.set(VERSION_KEY, 2, None)


def key(name: str, *parts) -> str:
    return ":".join(["public", str(version()), name, *map(str, parts)])
