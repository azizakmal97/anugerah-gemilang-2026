"""Builds the two e-sijil backgrounds (peserta, urus setia): A4 portrait, batik, signature, empty name band.

The signature lives outside this public repo (hi-tea/sijil/tandatangan.png), so the filled page
and the renders go to that folder too. Apps Script lays each guest's name over the band.

    python print/make_sijil.py [output_dir]            # both background PNGs (no name)
    python print/make_sijil.py [output_dir] --preview  # also a sample of each with a name, for review
    python print/make_sijil.py [output_dir] --options  # one small peserta sample per colour option, to pick from
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

# Colour options for the cloth (frame gradient a -> b, field gradient a -> b -> c, plate rgb).
# Gold motifs stay the same in every option. The owner picks one; DEFAULT_THEME is used for the real PNGs.
THEMES = {
    "navy": {"cloth-a": "#1d3c86", "cloth-b": "#071334", "field-a": "#1a3473", "field-b": "#0b1736", "field-c": "#040a1e", "plate": "5, 12, 34"},
    "maroon": {"cloth-a": "#8e1838", "cloth-b": "#3c0717", "field-a": "#5a0f28", "field-b": "#2c0613", "field-c": "#16030a", "plate": "26, 4, 12"},
    "tema": {"cloth-a": "#f2d796", "cloth-b": "#a87a2c", "field-a": "#1a3473", "field-b": "#0b1736", "field-c": "#040a1e", "plate": "5, 12, 34", "frame-ink": "#0b1736", "frame-dot": "#0b1736"},
    # Gold and navy blended: a darker antique gold that steps down into navy, and gold light on the navy field.
    "emas-nila": {"cloth-a": "#d4ad5c", "cloth-b": "#6b4c17", "field-a": "#1d2f5e", "field-b": "#0b1736", "field-c": "#040a1e", "plate": "5, 12, 34", "frame-ink": "#0b1736", "frame-dot": "#0b1736",
                  "extra": "body { background: linear-gradient(160deg, #e6c574 0%, #a97d2e 35%, #3b3a45 70%, #0b1736 100%); } .field { background: radial-gradient(80% 30% at 50% 0%, rgba(214, 168, 78, 0.30), transparent 75%), radial-gradient(80% 30% at 50% 100%, rgba(214, 168, 78, 0.22), transparent 75%), radial-gradient(120% 75% at 50% 0%, var(--field-a), var(--field-b) 50%, var(--field-c)); }"},
    # Navy cloth with one diagonal gold sheen across it: the gold lives inside the navy.
    "nila-kilau": {"cloth-a": "#1d3c86", "cloth-b": "#071334", "field-a": "#1a3473", "field-b": "#0b1736", "field-c": "#040a1e", "plate": "5, 12, 34",
                   "extra": "body { background: linear-gradient(135deg, #071334 0%, #1d3c86 28%, #b8913f 48%, #f2d796 50%, #b8913f 52%, #1d3c86 72%, #071334 100%); } .field { background: radial-gradient(70% 25% at 50% 0%, rgba(214, 168, 78, 0.22), transparent 75%), radial-gradient(120% 75% at 50% 0%, var(--field-a), var(--field-b) 50%, var(--field-c)); }"},
    "emerald": {"cloth-a": "#0f6b57", "cloth-b": "#05303a", "field-a": "#0d4f52", "field-b": "#062b30", "field-c": "#03161a", "plate": "3, 22, 26"},
}
DEFAULT_THEME = "navy"


def theme_style(theme: str) -> str:
    colours = "".join(f" --{key}: {value};" for key, value in THEMES[theme].items() if key != "extra")
    return f"<style>:root {{{colours} }} {THEMES[theme].get('extra', '')}</style>"


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


def fill_page(out_dir: Path, words: dict, name: str, ic_line: str = "", theme: str = DEFAULT_THEME) -> Path:
    signature = out_dir / "tandatangan.png"
    if not signature.exists():
        raise SystemExit(f"Signature missing: {signature}. It is kept outside the repo on purpose.")
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("../assets/", ASSETS.as_uri() + "/")
    html = html.replace("{{THEME}}", theme_style(theme))
    for key, text in words.items():
        html = html.replace("{{" + key + "}}", text)
    html = html.replace("{{SIGNATURE}}", signature.as_uri())
    html = html.replace("{{NAME}}", name)
    html = html.replace("{{IC}}", ic_line)
    page = out_dir / "_sijil-render.html"
    page.write_text(html, encoding="utf-8")
    return page


def render(page_path: Path, png_path: Path, scale: float = SCALE_FOR_300_DPI) -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": A4_CSS_PX[0], "height": A4_CSS_PX[1]}, device_scale_factor=scale)
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
    if "--options" in sys.argv:
        peserta = VERSIONS["sijil-latar-A4"]
        for theme in THEMES:
            render(fill_page(output, peserta, PREVIEW_NAME, PREVIEW_IC, theme), output / f"_pilihan-{theme}.png", scale=1)
        sys.exit(0)
    for stem, words in VERSIONS.items():
        render(fill_page(output, words, ""), output / f"{stem}.png")
        if "--preview" in sys.argv:
            render(fill_page(output, words, PREVIEW_NAME, PREVIEW_IC), output / f"_{stem}-contoh-nama.png")
