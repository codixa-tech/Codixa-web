"""HTML -> PDF with WeasyPrint. Fonts are bundled, so Arabic renders the same on every server."""
from pathlib import Path

from django.template.loader import render_to_string
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration

STATIC_DIR = Path(__file__).resolve().parent.parent / "static" / "core"
_fonts = FontConfiguration()


def render_pdf(template: str, context: dict) -> bytes:
    html = render_to_string(template, context)
    return HTML(string=html, base_url=str(STATIC_DIR)).write_pdf(font_config=_fonts)
