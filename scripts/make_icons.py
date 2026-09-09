#!/usr/bin/env python3
"""Generate 线探 favicon and app icons for browser / 收录 use."""

from __future__ import annotations

import io
import struct
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "img"
SOURCE = IMG / "mark-source.png"
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REG = Path(r"C:\Windows\Fonts\msyh.ttc")
DARK = (7, 11, 20)
TEXT = (233, 240, 255)
MUTED = (139, 155, 184)


def load_font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size, index=0)


def mark(size: int) -> Image.Image:
    src = Image.open(SOURCE).convert("RGB")
    if src.size[0] != src.size[1]:
        side = min(src.size)
        left = (src.size[0] - side) // 2
        top = (src.size[1] - side) // 2
        src = src.crop((left, top, left + side, top + side))
    return src.resize((size, size), Image.Resampling.LANCZOS)


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)


def write_ico(path: Path, images) -> None:
    pngs = []
    for im in images:
        buf = io.BytesIO()
        im.save(buf, format="PNG")
        pngs.append((im.size[0], im.size[1], buf.getvalue()))
    offset = 6 + 16 * len(pngs)
    out = bytearray(struct.pack("<HHH", 0, 1, len(pngs)))
    for w, h, data in pngs:
        out += struct.pack("<BBBBHHII", w % 256, h % 256, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
    for _, _, data in pngs:
        out += data
    path.write_bytes(out)


def write_svg(path: Path) -> None:
    path.write_text(
        """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="线探">
  <defs>
    <linearGradient id="g" x1="6" y1="6" x2="58" y2="58" gradientUnits="userSpaceOnUse">
      <stop stop-color="#3EE0C2"/>
      <stop offset="1" stop-color="#2F8BFF"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" fill="url(#g)"/>
  <path d="M10 38h12l6-10 8 16 6-8h12" fill="none" stroke="#F4FFFC" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="42" cy="24" r="4.2" fill="#F4FFFC"/>
  <path d="M42 15.5a12 12 0 0 1 8.5 8.5" fill="none" stroke="#F4FFFC" stroke-width="2.4" stroke-linecap="round"/>
  <path d="M42 10.5a17 17 0 0 1 12 12" fill="none" stroke="#F4FFFC" stroke-width="2.2" stroke-linecap="round" opacity=".75"/>
</svg>
""",
        encoding="utf-8",
    )


def og_image() -> Image.Image:
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), DARK)
    draw = ImageDraw.Draw(img)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-120, -180, 620, 520), fill=(62, 224, 194, 38))
    od.ellipse((700, -80, 1380, 560), fill=(47, 139, 255, 36))
    img = Image.alpha_composite(img.convert("RGBA"), overlay.filter(ImageFilter.GaussianBlur(40))).convert("RGB")
    icon = mark(280).resize((280, 280), Image.Resampling.LANCZOS)
    img.paste(icon, (120, 175))
    draw = ImageDraw.Draw(img)
    title = load_font(FONT_BOLD, 92)
    sub = load_font(FONT_REG, 34)
    draw.text((460, 210), "线探", font=title, fill=TEXT)
    draw.text((460, 330), "中转站导航 · 模型实况", font=sub, fill=MUTED)
    return img


def main() -> None:
    IMG.mkdir(parents=True, exist_ok=True)
    sizes = {
        IMG / "favicon-16.png": 16,
        IMG / "favicon-32.png": 32,
        IMG / "icon-48.png": 48,
        IMG / "icon-64.png": 64,
        IMG / "icon-128.png": 128,
        IMG / "apple-touch-icon.png": 180,
        IMG / "icon-192.png": 192,
        IMG / "icon-512.png": 512,
    }
    rasters = {}
    for path, size in sizes.items():
        rasters[size] = mark(size)
        save_png(rasters[size], path)
    write_ico(ROOT / "favicon.ico", [rasters[16], rasters[32], rasters[48]])
    write_svg(IMG / "logo.svg")
    save_png(og_image(), IMG / "og.png")
    print("wrote favicon.ico and", len(sizes) + 2, "image files")


if __name__ == "__main__":
    main()
