"""Builds the e-sijil background: A4 portrait, batik theme, signature, and an empty name band.

The signature lives outside this public repo (hi-tea/sijil/tandatangan.png), so the filled page
and the renders go to that folder too. Apps Script lays each guest's name over the band.

    python print/make_sijil.py [output_dir]            # background PNG (no name)
    python print/make_sijil.py [output_dir] --preview  # also a sample with a name, for review
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from make_qr_poster import A4_CSS_PX, SCALE_FOR_300_DPI, medallion_svg

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "sijil.template.html"
ASSETS = HERE.parent / "assets"
PREVIEW_NAME = "Jama'atul Nadirah binti Ramli"


def fill_page(out_dir: Path, name: str) -> Path:
    signature = out_dir / "tandatangan.png"
    if not signature.exists():
        raise SystemExit(f"Signature missing: {signature}. It is kept outside the repo on purpose.")
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("../assets/", ASSETS.as_uri() + "/")
    html = html.replace("{{MEDALLION}}", medallion_svg())
    html = html.replace("{{SIGNATURE}}", signature.as_uri())
    html = html.replace("{{NAME}}", name)
    page = out_dir / ("_sijil-preview.html" if name else "_sijil.html")
    page.write_text(html, encoding="utf-8")
    return page


def render(page_path: Path, png_path: Path) -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": A4_CSS_PX[0], "height": A4_CSS_PX[1]}, device_scale_factor=SCALE_FOR_300_DPI)
            page.goto(page_path.as_uri())
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(400)
            page.screenshot(path=str(png_path))
        finally:
            browser.close()
    page_path.unlink()
    print(f"wrote {png_path}")


if __name__ == "__main__":
    args = [arg for arg in sys.argv[1:] if not arg.startswith("--")]
    output = Path(args[0]) if args else HERE.parent.parent / "sijil"
    render(fill_page(output, ""), output / "sijil-latar-A4.png")
    if "--preview" in sys.argv:
        render(fill_page(output, PREVIEW_NAME), output / "_sijil-contoh-nama.png")
