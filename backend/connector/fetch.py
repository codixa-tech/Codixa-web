"""Download a file from a public URL for the connector (images/videos the user links in chat).

Guards against SSRF: http(s) only, every hop (including redirects) must resolve to public IP
addresses, bounded size and time. Common share links (Google Drive, Dropbox) become direct downloads.
"""
import ipaddress
import re
import socket
import urllib.error
import urllib.request
from urllib.parse import parse_qs, urlencode, urljoin, urlsplit, urlunsplit

from django.conf import settings

MAX_REDIRECTS = 5
TIMEOUT = 25
UA = "CodixaConnector/1.0"


class FetchError(ValueError):
    pass


def normalize_share_link(url: str) -> str:
    m = re.match(r"https://drive\.google\.com/file/d/([\w-]+)", url) or re.match(r"https://drive\.google\.com/open\?id=([\w-]+)", url)
    if m:
        return f"https://drive.usercontent.google.com/download?id={m.group(1)}&export=download&confirm=t"
    parts = urlsplit(url)
    if parts.hostname in {"www.dropbox.com", "dropbox.com"}:
        q = parse_qs(parts.query)
        q["dl"] = ["1"]
        return urlunsplit(parts._replace(query=urlencode(q, doseq=True)))
    return url


def _check_host(url: str) -> None:
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"} or not parts.hostname:
        raise FetchError("Only http(s) links are supported")
    if getattr(settings, "CONNECTOR_ALLOW_PRIVATE_URLS", False):
        return
    try:
        infos = socket.getaddrinfo(parts.hostname, parts.port or (443 if parts.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise FetchError("Could not resolve the link's host") from exc
    for info in infos:
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise FetchError("Links to private or local addresses are not allowed")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def download(url: str, max_bytes: int) -> tuple[bytes, str, str]:
    """Return (data, content_type, filename)."""
    url = normalize_share_link(url.strip())
    for _ in range(MAX_REDIRECTS + 1):
        _check_host(url)
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
        try:
            resp = _opener.open(req, timeout=TIMEOUT)
        except urllib.error.HTTPError as exc:
            if exc.code in (301, 302, 303, 307, 308) and exc.headers.get("Location"):
                url = urljoin(url, exc.headers["Location"])
                continue
            raise FetchError(f"The link returned HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            raise FetchError("Could not download the link") from exc
        with resp:
            length = resp.headers.get("Content-Length")
            if length and length.isdigit() and int(length) > max_bytes:
                raise FetchError(f"File is larger than {max_bytes // (1024 * 1024)} MB")
            chunks, total = [], 0
            while True:
                chunk = resp.read(256 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise FetchError(f"File is larger than {max_bytes // (1024 * 1024)} MB")
                chunks.append(chunk)
            ctype = (resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
            name = ""
            disp = resp.headers.get("Content-Disposition") or ""
            m = re.search(r'filename="?([^";]+)', disp)
            if m:
                name = m.group(1)
            if not name:
                name = urlsplit(url).path.rsplit("/", 1)[-1]
            return b"".join(chunks), ctype, (name or "file")[:120]
    raise FetchError("Too many redirects")
