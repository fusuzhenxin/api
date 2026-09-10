#!/usr/bin/env python3
"""Generate search-index-safe favicons and Baidu site logos."""

from __future__ import annotations

import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "img"
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REG = Path(r"C:\Windows\Fonts\msyh.ttc")

BG = (6, 18, 32)
TEAL = (20, 196, 168)
INK = (244, 255, 252)
MUTED = (168, 190, 210)
DARK = (7, 11, 20)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size, index=0)


def mark(size: int) -> Image.Image:
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)
    pad = max(1, round(size * 0.08))
    draw.rounded_rectangle((pad, pad, size - pad - 1, size - pad - 1), radius=max(2, size // 6), fill=TEAL)

    def p(x: float, y: float) -> tuple[int, int]:
        return (round(size * x), round(size * y))

    stroke = max(2, round(size * 0.09))
    r = max(2, round(size * 0.075))
    a, b, c = p(0.28, 0.62), p(0.50, 0.34), p(0.74, 0.58)
    draw.line([a, b, c], fill=INK, width=stroke, joint="curve")
    for pt in (a, b, c):
        draw.ellipse((pt[0] - r, pt[1] - r, pt[0] + r, pt[1] + r), fill=INK)
    return img


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def dib32(im: Image.Image) -> bytes:
    w, h = im.size
    rgba = im.convert("RGBA")
    pixels = bytearray()
    for y in range(h - 1, -1, -1):
        for x in range(w):
            r, g, b, a = rgba.getpixel((x, y))
            pixels += bytes((b, g, r, a))
    row = ((w + 31) // 32) * 4
    mask = bytearray(row * h)
    header = struct.pack("<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, len(pixels), 0, 0, 0, 0)
    return header + pixels + mask


def write_ico(path: Path, images: list[Image.Image]) -> None:
    entries = [(im.size[0], im.size[1], dib32(im.convert("RGB"))) for im in images]
    offset = 6 + 16 * len(entries)
    out = bytearray(struct.pack("<HHH", 0, 1, len(entries)))
    for w, h, data in entries:
        out += struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    for _, _, data in entries:
        out += data
    path.write_bytes(out)


def write_svg(path: Path) -> None:
    path.write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="API中转站导航">
  <rect width="64" height="64" fill="#061220"/>
  <rect x="5" y="5" width="54" height="54" rx="11" fill="#14C4A8"/>
  <path d="M18 40 L32 22 L47 37" fill="none" stroke="#F4FFFC" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="18" cy="40" r="4.6" fill="#F4FFFC"/>
  <circle cx="32" cy="22" r="4.6" fill="#F4FFFC"/>
  <circle cx="47" cy="37" r="4.6" fill="#F4FFFC"/>
</svg>
""",
        encoding="utf-8",
    )


def baidu_wordmark(w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h), BG)
    draw = ImageDraw.Draw(img)
    side = min(h - 12, 36 if w < 160 else 72)
    icon = mark(side)
    x = 8
    y = (h - side) // 2
    img.paste(icon, (x, y))
    tx = x + side + 8
    if w >= 120:
        label = "API导航" if w < 160 else "API中转站导航"
        title = font(FONT_BOLD, 16 if w < 160 else 26)
        ty = (h - 24) // 2 if h < 100 else 32
        draw.text((tx, ty), label, font=title, fill=INK)
        if h >= 100:
            draw.text((tx, 72), "对照中转可用性", font=font(FONT_REG, 16), fill=MUTED)
    return img


def og_image() -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), DARK)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-120, -180, 620, 520), fill=(20, 196, 168, 40))
    od.ellipse((700, -80, 1380, 560), fill=(47, 139, 255, 36))
    img = Image.alpha_composite(img.convert("RGBA"), overlay.filter(ImageFilter.GaussianBlur(40))).convert("RGB")
    icon = mark(260)
    img.paste(icon, (130, 185))
    draw = ImageDraw.Draw(img)
    draw.text((460, 200), "API中转站导航", font=font(FONT_BOLD, 72), fill=INK)
    draw.text((460, 320), "对照可用性与延迟，再决定充哪家", font=font(FONT_REG, 32), fill=MUTED)
    return img


def main() -> None:
    IMG.mkdir(parents=True, exist_ok=True)
    sizes = {
        IMG / "favicon-16.png": 16,
        IMG / "favicon-32.png": 32,
        IMG / "icon-48.png": 48,
        IMG / "icon-96.png": 96,
        IMG / "icon-64.png": 64,
        IMG / "icon-128.png": 128,
        IMG / "apple-touch-icon.png": 180,
        IMG / "icon-192.png": 192,
        IMG / "icon-512.png": 512,
    }
    rasters = {size: mark(size) for size in sizes.values()}
    for path, size in sizes.items():
        save_png(rasters[size], path)
    write_ico(ROOT / "favicon.ico", [rasters[16], rasters[32], rasters[48]])
    write_svg(IMG / "logo.svg")
    save_png(rasters[75] if 75 in rasters else mark(75), IMG / "baidu-logo-75.png")
    save_png(baidu_wordmark(121, 75), IMG / "baidu-logo-121x75.png")
    save_png(baidu_wordmark(200, 133), IMG / "baidu-logo-200x133.png")
    save_png(og_image(), IMG / "og.png")
    print("wrote favicon.ico, baidu logos, og.png")


if __name__ == "__main__":
    main()
