#!/usr/bin/env python3
"""
Generate the BadaMangal QR code with a faded brand logo in the center.

Outputs (under public/brand/qr/):
  • badamangal-qr-1200.png  — newsprint / web (1200×1200, 300 dpi → 10cm)
  • badamangal-qr-3000.png  — poster / vinyl / hoarding (3000×3000)
  • badamangal-qr-flat.png  — pure B&W, no logo (fallback / scanner test)

Design choices:
  • Encodes the canonical brandable URL `https://badamangal.com` (NOT a
    UTM-tagged variant — printed QRs live for years, UTMs go stale; we
    track print-source attribution via a referrer-string survey instead).
  • ERROR_CORRECT_H (30% module recovery) so the faded center logo can
    obscure up to ~22% of the modules without breaking scans.
  • QR modules in sindoor-700 (#9C2A2A) for brand cohesion vs flat
    black. Still high contrast against cream background; tested by
    iOS + Android default cameras.
  • Logo is rendered from logo-primary.svg (the 8-rayed sun + gada),
    composited at ~32% opacity over a soft cream halo so the QR
    pattern is visible THROUGH the logo — this is what makes the
    "faded" effect work without killing scannability.
  • Quiet zone (border) is 4 modules — slightly above the 1-module
    spec minimum, because Indian newsprint ink-spread eats the edge.
"""

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from PIL import Image, ImageDraw, ImageFilter
import cairosvg
import io
import re
from pathlib import Path

# ─── Paths ────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
LOGO_SVG = ROOT / "public/brand/logo-primary.svg"
OUT_DIR = ROOT / "public/brand/qr"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ─── Brand palette (from tailwind.config.ts) ──────────────────────────
SAFFRON_600 = (224, 122, 31)   # #E07A1F
SINDOOR_700 = (156, 42, 42)    # #9C2A2A
CREAM_50    = (251, 247, 240)  # #FBF7F0
INK_900     = (26, 20, 16)     # #1A1410

# ─── Encode target ────────────────────────────────────────────────────
URL = "https://badamangal.com"


def render_logo(target_px: int) -> Image.Image:
    """Rasterize ONLY the iconic gada-sun mark to a square RGBA
    image at the requested pixel size. We strip the two <text>
    wordmark elements ("BadaMangal" + "बड़ा मंगल") and crop the
    viewBox to 480×480 (the icon area) before handing to cairosvg
    — otherwise the Devanagari wordmark renders as tofu boxes
    because cairosvg can't reach a Devanagari font on macOS, and
    the wordmarks would clutter the center anyway. Mark-only is
    the right visual: iconic, instantly recognisable, doesn't
    fight the QR pattern for attention. Keeps full alpha so we
    can fade it down when compositing."""
    svg_text = LOGO_SVG.read_text(encoding="utf-8")
    # 1. Crop viewBox to icon area (top square).
    svg_text = re.sub(
        r'viewBox="0 0 480 560"',
        'viewBox="0 0 480 480"',
        svg_text,
        count=1,
    )
    # 2. Drop the two wordmark <text> elements at y=500 / y=540.
    svg_text = re.sub(
        r"<text[^>]*>.*?</text>",
        "",
        svg_text,
        flags=re.DOTALL,
    )
    png_bytes = cairosvg.svg2png(
        bytestring=svg_text.encode("utf-8"),
        output_width=target_px,
        output_height=target_px,
    )
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


def make_qr(size_px: int, with_logo: bool, out_path: Path) -> None:
    """Build a single QR at the given pixel size and write it to
    out_path. When with_logo is True, the brand mark is faded over
    the center; otherwise a plain B&W QR is written (used for the
    scanner-test fallback)."""

    # box_size is per-module pixels. We pick it so the final image
    # is at least `size_px` wide; qrcode rounds to integer modules.
    # 25-version QR holds plenty for the short URL. We let the lib
    # auto-pick version (fit=True) so it uses the smallest grid
    # consistent with H-level correction.
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=40,  # large, we downscale at the end
        border=4,
    )
    qr.add_data(URL)
    qr.make(fit=True)

    # Custom fill/back colors → brand cohesion vs default black.
    qr_img = qr.make_image(
        fill_color=INK_900 if not with_logo else SINDOOR_700,
        back_color=CREAM_50,
    ).convert("RGBA")

    # Downscale to the requested output size with high-quality
    # resampling. We always generate at 40px-per-module first so
    # the final image has crisp module edges even at small sizes.
    if qr_img.size[0] != size_px:
        qr_img = qr_img.resize((size_px, size_px), Image.LANCZOS)

    if with_logo:
        # Logo occupies ~22% of QR width — well inside the 30%
        # error-correction headroom. Center it precisely.
        logo_size = int(size_px * 0.22)
        logo = render_logo(logo_size)

        # 1. Soft cream halo behind the logo so the faded mark
        #    has consistent contrast regardless of which modules
        #    sit underneath. Halo is slightly larger than the
        #    logo with a feathered edge (Gaussian blur on the
        #    alpha) for a "faded into the QR" look rather than
        #    a hard rectangular knockout.
        halo_size = int(logo_size * 1.30)
        halo = Image.new("RGBA", (halo_size, halo_size), (0, 0, 0, 0))
        halo_draw = ImageDraw.Draw(halo)
        halo_draw.ellipse(
            (0, 0, halo_size, halo_size),
            fill=CREAM_50 + (200,),  # ~78% opacity
        )
        halo = halo.filter(ImageFilter.GaussianBlur(radius=halo_size * 0.04))

        # 2. Fade the logo by knocking its alpha down to 32%.
        #    Visually: the saffron mark is clearly readable as
        #    a watermark, but the underlying QR pattern still
        #    shows through enough for scanners to lock on.
        faded_logo = logo.copy()
        alpha = faded_logo.split()[3]
        alpha = alpha.point(lambda a: int(a * 0.32))
        faded_logo.putalpha(alpha)

        # 3. Paste halo first, then faded logo on top.
        cx = (size_px - halo_size) // 2
        cy = (size_px - halo_size) // 2
        qr_img.alpha_composite(halo, (cx, cy))

        lx = (size_px - logo_size) // 2
        ly = (size_px - logo_size) // 2
        qr_img.alpha_composite(faded_logo, (lx, ly))

    qr_img.convert("RGB").save(out_path, "PNG", optimize=True, dpi=(300, 300))
    print(f"  ✓ {out_path.relative_to(ROOT)}  ({qr_img.size[0]}×{qr_img.size[1]})")


def main() -> None:
    print(f"Encoding: {URL}")
    print(f"Logo:     {LOGO_SVG.relative_to(ROOT)}")
    print(f"Output:   {OUT_DIR.relative_to(ROOT)}/\n")

    make_qr(1200, with_logo=True,  out_path=OUT_DIR / "badamangal-qr-1200.png")
    make_qr(3000, with_logo=True,  out_path=OUT_DIR / "badamangal-qr-3000.png")
    make_qr(1200, with_logo=False, out_path=OUT_DIR / "badamangal-qr-flat.png")

    print("\nDone. Verify by opening any of the PNGs with your phone")
    print("camera — should auto-detect and offer to open badamangal.com.")


if __name__ == "__main__":
    main()
