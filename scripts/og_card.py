#!/usr/bin/env python3
"""Render a 1200x630 share card for one 线探 station. JSON on stdin, JPEG on stdout."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
MARK = ROOT / "img" / "mark-source.png"
FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REG = Path(r"C:\Windows\Fonts\msyh.ttc")
DARK = (7, 11, 20)
TEXT = (233, 240, 255)
MUTED = (139, 155, 184)
TEAL = (62, 224, 194)
AMBER = (255, 176, 32)
ROSE = (255, 93, 122)
BLUE = (122, 167, 255)

VERDICT_COLOR = {"ok": TEAL, "watch": AMBER, "caution": ROSE}


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    try:
        return ImageFont.truetype(str(path), size, index=0)
    except OSError:
        return ImageFont.load_default()


def clip(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont, max_w: int) -> str:
    text = str(text or "").replace("\n", " ")
    if draw.textlength(text, font=fnt) <= max_w:
        return text
    while text and draw.textlength(text + "…", font=fnt) > max_w:
        text = text[:-1]
    return text + "…"


def render(payload: dict) -> bytes:
    w, h = 1200, 630
    img = Image.new("RGB", (w, h), DARK)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse((-140, -200, 560, 480), fill=(62, 224, 194, 36))
    od.ellipse((720, -60, 1400, 520), fill=(47, 139, 255, 34))
    img = Image.alpha_composite(img.convert("RGBA"), overlay.filter(ImageFilter.GaussianBlur(36))).convert("RGB")
    draw = ImageDraw.Draw(img)

    if MARK.exists():
        mark = Image.open(MARK).convert("RGB").resize((72, 72), Image.Resampling.LANCZOS)
        img.paste(mark, (64, 48))
    title = font(FONT_BOLD, 28)
    sub = font(FONT_REG, 22)
    name_f = font(FONT_BOLD, 56)
    body = font(FONT_REG, 28)
    metric_l = font(FONT_REG, 20)
    metric_v = font(FONT_BOLD, 36)
    badge_f = font(FONT_BOLD, 26)
    draw = ImageDraw.Draw(img)
    draw.text((156, 58), "API中转站导航", font=title, fill=TEXT)
    draw.text((156, 96), "API中转站对照", font=sub, fill=MUTED)

    name = clip(draw, payload.get("name") or "未命名", name_f, 980)
    domain = clip(draw, payload.get("domain") or "第三方中转", sub, 980)
    draw.text((64, 168), name, font=name_f, fill=TEXT)
    draw.text((64, 246), domain, font=sub, fill=MUTED)

    vid = str(payload.get("verdict_id") or "watch")
    label = str(payload.get("verdict") or "一般")
    color = VERDICT_COLOR.get(vid, AMBER)
    bw = int(draw.textlength(label, font=badge_f)) + 36
    draw.rounded_rectangle((64, 300, 64 + bw, 352), radius=18, fill=color)
    draw.text((82, 308), label, font=badge_f, fill=DARK)

    sentence = clip(draw, payload.get("sentence") or "", body, 1070)
    draw.text((64, 376), sentence, font=body, fill=TEXT)

    items = [
        ("可用", payload.get("uptime") or "—"),
        ("延迟", payload.get("latency") or "—"),
        ("投票", payload.get("votes") or "0 / 0"),
    ]
    x = 64
    for lab, val in items:
        draw.text((x, 470), lab, font=metric_l, fill=MUTED)
        draw.text((x, 502), str(val), font=metric_v, fill=BLUE)
        x += 280

    draw.text((64, 580), "仅作导航对照，充值前小额实测", font=sub, fill=MUTED)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=86, optimize=True)
    return buf.getvalue()


def main() -> None:
    raw = sys.stdin.buffer.read()
    payload = json.loads(raw.decode("utf-8") or "{}")
    sys.stdout.buffer.write(render(payload))


if __name__ == "__main__":
    main()
