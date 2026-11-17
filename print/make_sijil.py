"""Builds the two e-sijil backgrounds (peserta, urus setia): A4 portrait, batik, signature, empty name band.

The signature lives outside this public repo (hi-tea/sijil/tandatangan.png), so the filled page
and the renders go to that folder too. Apps Script lays each guest's name over the band.

    python print/make_sijil.py [output_dir]            # both background PNGs (no name)
    python print/make_sijil.py [output_dir] --preview  # also a sample of each with a name, for review
"""
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from make_qr_poster import A4_CSS_PX, SCALE_FOR_300_DPI

HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "sijil.template.html"
ASSETS = HERE.parent / "assets"
PREVIEW_NAME = "Jama'atul Nadirah binti Ramli"
PREVIEW_IC = "No. K/P: 000000-00-0000"

# file stem -> the words that differ between the two versions. Apps Script looks the PNGs up by name.
VERSIONS = {
    "sijil-latar-A4": {
        "TITLE": "Sijil Penyertaan",
        "LEAD": "Dengan ini diperakukan bahawa",
        "BODY": "telah menyertai",
    },
    "sijil-urusetia-latar-A4": {
        "TITLE": "Sijil Penghargaan",
        "LEAD": "Setinggi-tinggi penghargaan kepada",
        "BODY": "atas sumbangan sebagai urus setia",
    },
}


def fill_page(out_dir: Path, words: dict, name: str, ic_line: str = "") -> Path:
    signature = out_dir / "tandatangan.png"
    if not signature.exists():
        raise SystemExit(f"Signature missing: {signature}. It is kept outside the repo on purpose.")
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("../assets/", ASSETS.as_uri() + "/")
    for key, text in words.items():
        html = html.replace("{{" + key + "}}", text)
    html = html.replace("{{SIGNATURE}}", signature.as_uri())
    html = html.replace("{{NAME}}", name)
    html = html.replace("{{IC}}", ic_line)
    page = out_dir / "_sijil-render.html"
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
    for stem, words in VERSIONS.items():
        render(fill_page(output, words, ""), output / f"{stem}.png")
        if "--preview" in sys.argv:
            render(fill_page(output, words, PREVIEW_NAME, PREVIEW_IC), output / f"_{stem}-contoh-nama.png")
