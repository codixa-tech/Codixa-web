"""Sanitize rich text (HTML from the dashboard editor) before it is stored and shown on the public site.

Allows the formatting the editor produces — headings, bold/italic/underline/strike, lists, quotes, links,
images, text colour, highlight, font size and alignment — and nothing that can run code or break layout.
"""
import re

import nh3

TAGS = {
    "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "mark", "span", "a", "img",
    "ul", "ol", "li", "blockquote", "hr", "code", "pre",
}
ATTRIBUTES = {
    "*": {"style", "dir"},
    "a": {"href", "target", "title"},
    "img": {"src", "alt", "title", "width", "height"},
    "ol": {"start"},
}
STYLE_PROPS = {"color", "background-color", "font-size", "text-align"}
URL_SCHEMES = {"http", "https", "mailto", "tel"}

_COLOR = re.compile(r"^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$", re.I)
_SIZE = re.compile(r"^\d{1,3}(\.\d{1,2})?(px|rem|em|%)$")
_ALIGN = {"left", "right", "center", "justify", "start", "end"}
_MIN_PX, _MAX_PX = 10, 72


def _valid_decl(prop: str, value: str) -> bool:
    if prop in ("color", "background-color"):
        return bool(_COLOR.match(value)) and "url" not in value.lower()
    if prop == "font-size":
        if not _SIZE.match(value):
            return False
        if value.endswith("px"):
            return _MIN_PX <= float(value[:-2]) <= _MAX_PX
        return True
    if prop == "text-align":
        return value in _ALIGN
    return False


def clean_style(style: str) -> str:
    out = []
    for decl in style.split(";"):
        if ":" not in decl:
            continue
        prop, value = (x.strip().lower() for x in decl.split(":", 1))
        if prop in STYLE_PROPS and _valid_decl(prop, value):
            out.append(f"{prop}: {value}")
    return "; ".join(out)


def _attribute_filter(tag: str, attr: str, value: str):
    if attr == "style":
        cleaned = clean_style(value)
        return cleaned or None
    if attr == "dir":
        return value if value in ("rtl", "ltr", "auto") else None
    if tag == "a" and attr == "target":
        return "_blank" if value == "_blank" else None
    if tag == "img" and attr == "src":
        # Uploaded images (relative /media/...) or https images only — no data: URIs.
        return value if value.startswith("/media/") or value.startswith("https://") else None
    if tag == "img" and attr in ("width", "height"):
        return value if value.isdigit() and int(value) <= 4000 else None
    if tag == "ol" and attr == "start":
        return value if value.isdigit() else None
    return value


def sanitize_html(html: str, max_length: int = 200_000) -> str:
    if not html:
        return ""
    html = html[:max_length]
    cleaned = nh3.clean(
        html,
        tags=TAGS,
        attributes=ATTRIBUTES,
        attribute_filter=_attribute_filter,
        url_schemes=URL_SCHEMES,
        link_rel="noopener noreferrer nofollow",
        strip_comments=True,
    )
    # An editor with nothing typed sends "<p></p>".
    return "" if re.fullmatch(r"(\s|<p>\s*</p>|<br\s*/?>)*", cleaned) else cleaned


def plain_text(html: str, limit: int = 300) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]
