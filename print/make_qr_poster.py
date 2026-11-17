"""Builds the A4 desk poster: the one event QR inside the site's batik medallion.

Writes print/qr-poster.html, then renders it with headless Chromium to a 300 dpi PNG and an
A4 PDF in the output folder (default: the hi-tea folder above this repo, so print files stay
out of git). The QR is drawn from the real matrix and scanned back before anything is saved.

    python print/make_qr_poster.py [output_dir]
"""
import math
import sys
from pathlib import Path

import cv2
import qrcode
from playwright.sync_api import sync_playwright

SITE_URL = "https://azizakmal97.github.io/anugerah-gemilang-2026/"
HERE = Path(__file__).resolve().parent
TEMPLATE = HERE / "qr-poster.template.html"
PAGE = HERE / "qr-poster.html"
A4_CSS_PX = (794, 1123)
SCALE_FOR_300_DPI = 3.125


def qr_svg(url: str, size: int) -> str:
    """QR as SVG: soft data dots, square finder eyes, a kawung emblem in the middle."""
    code = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_H, border=0)
    code.add_data(url)
    code.make(fit=True)
    matrix = code.get_matrix()
    count = len(matrix)
    cell = size / count
    emblem_cells = 7 if count < 37 else 9
    emblem_lo = (count - emblem_cells) // 2
    emblem_hi = emblem_lo + emblem_cells

    def in_finder(row, col):
        return (row < 7 and col < 7) or (row < 7 and col >= count - 7) or (row >= count - 7 and col < 7)

    def in_emblem(row, col):
        return emblem_lo <= row < emblem_hi and emblem_lo <= col < emblem_hi

    parts = []
    for row in range(count):
        for col in range(count):
            if matrix[row][col] and not in_finder(row, col) and not in_emblem(row, col):
                # 92% dots with soft corners: smaller or rounder dots stopped OpenCV's detector reading it.
                x, y = col * cell + cell * 0.04, row * cell + cell * 0.04
                side = cell * 0.92
                parts.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{side:.2f}" height="{side:.2f}" rx="{side * 0.3:.2f}"/>')

    # Finder eyes stay square: even slightly rounded eyes stopped OpenCV finding the code.
    for row0, col0 in ((0, 0), (0, count - 7), (count - 7, 0)):
        x, y = col0 * cell, row0 * cell
        parts.append(
            f'<rect x="{x + cell * 0.5:.2f}" y="{y + cell * 0.5:.2f}" width="{cell * 6:.2f}" height="{cell * 6:.2f}" '
            f'class="eye-ring" stroke-width="{cell:.2f}"/>'
            f'<rect class="eye" x="{x + cell * 2:.2f}" y="{y + cell * 2:.2f}" width="{cell * 3:.2f}" height="{cell * 3:.2f}" />'
        )

    centre = size / 2
    radius = emblem_cells * cell / 2 - cell * 0.4
    petal_ry, petal_rx = radius * 0.42, radius * 0.2
    petals = "".join(
        f'<ellipse cx="{centre:.2f}" cy="{centre - radius * 0.45:.2f}" rx="{petal_rx:.2f}" ry="{petal_ry:.2f}" '
        f'transform="rotate({angle} {centre:.2f} {centre:.2f})"/>'
        for angle in (45, 135, 225, 315)
    )
    emblem = (
        f'<circle cx="{centre:.2f}" cy="{centre:.2f}" r="{radius:.2f}" class="emblem-disc"/>'
        f'<g class="emblem-petals">{petals}<circle cx="{centre:.2f}" cy="{centre:.2f}" r="{radius * 0.1:.2f}"/></g>'
        f'<circle cx="{centre:.2f}" cy="{centre:.2f}" r="{radius * 0.86:.2f}" class="emblem-ring"/>'
    )
    return f'<svg class="qr" viewBox="0 0 {size} {size}" width="{size}" height="{size}"><g class="dots">{"".join(parts)}</g>{emblem}</svg>'


def ring(count: int, shape: str, offset_deg: float = 0) -> str:
    step = 360 / count
    return "".join(f'<g transform="rotate({offset_deg + i * step:.3f} 200 200)">{shape}</g>' for i in range(count))


def medallion_svg() -> str:
    """Same three rings as the site's medallion (effects.js), drawn static."""
    rebung = ring(48, '<path d="M190 6 L200 26 L210 6 M195 6 L200 16 L205 6"/>')
    kawung = ring(20, '<ellipse cx="200" cy="58" rx="9" ry="22"/>')
    dots = ring(20, '<circle cx="200" cy="44" r="2.4" class="fill"/>', offset_deg=9)
    rays = ring(72, '<line x1="200" y1="88" x2="200" y2="96"/>')
    return (
        '<svg class="medallion" viewBox="0 0 400 400" aria-hidden="true">'
        f'<g class="ring-a">{rebung}<circle cx="200" cy="200" r="172"/><circle cx="200" cy="200" r="166" stroke-dasharray="2 6"/></g>'
        f'<g class="ring-b">{kawung}{dots}<circle cx="200" cy="200" r="132"/><circle cx="200" cy="200" r="124" stroke-dasharray="1 5"/></g>'
        f'<g class="ring-c">{rays}</g>'
        "</svg>"
    )


def gold_dust(seed: int = 7, motes: int = 70) -> str:
    """Fixed scatter of soft motes, like light in the ballroom photo. Seeded, so reruns match."""
    state = seed
    items = []
    for _ in range(motes):
        values = []
        for _ in range(3):
            state = (state * 1103515245 + 12345) % 2**31
            values.append(state / 2**31)
        x, y, size = values[0] * 100, values[1] * 100, 1 + values[2] * 3.5
        items.append(f'<i style="left:{x:.1f}%;top:{y:.1f}%;width:{size:.1f}px;height:{size:.1f}px;opacity:{0.25 + values[2] * 0.6:.2f}"></i>')
    return "".join(items)


def build_page() -> None:
    html = TEMPLATE.read_text(encoding="utf-8")
    html = html.replace("{{QR}}", qr_svg(SITE_URL, 400))
    html = html.replace("{{MEDALLION}}", medallion_svg())
    html = html.replace("{{DUST}}", gold_dust())
    PAGE.write_text(html, encoding="utf-8")


def assert_scans(png_path: Path) -> None:
    """Scan the rendered poster, full size and shrunk to phone-camera size."""
    image = cv2.imread(str(png_path))
    detector = cv2.QRCodeDetector()
    # OpenCV is a much weaker reader than a phone camera, so it is the strict test here.
    for width in (1400, 1100, 900, 700, 500):
        scaled = cv2.resize(image, (width, round(image.shape[0] * width / image.shape[1])), interpolation=cv2.INTER_AREA)
        value, _, _ = detector.detectAndDecode(scaled)
        if value != SITE_URL:
            raise SystemExit(f"QR did not scan with the poster {width}px wide (got {value!r}). Nothing is final.")
        print(f"scan ok with the poster {width}px wide")


def render(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    png = out_dir / "qr-meja-pendaftaran-A4.png"
    pdf = out_dir / "qr-meja-pendaftaran-A4.pdf"
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            page = browser.new_page(viewport={"width": A4_CSS_PX[0], "height": A4_CSS_PX[1]}, device_scale_factor=SCALE_FOR_300_DPI)
            page.goto(PAGE.as_uri())
            page.evaluate("document.fonts.ready")
            page.wait_for_timeout(400)
            page.screenshot(path=str(png), full_page=False)
            page.pdf(path=str(pdf), format="A4", print_background=True, margin={"top": "0", "bottom": "0", "left": "0", "right": "0"})
        finally:
            browser.close()
    assert_scans(png)
    print(f"wrote {png}\nwrote {pdf}")


if __name__ == "__main__":
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent.parent / "qr"
    build_page()
    render(output)
