"""Rasterize Access PWA icons from the brand mark on WikiTraveler blue.

Usage: python scripts/generate-access-pwa-icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "access" / "public" / "icons"
BLUE = (29, 78, 216, 255)  # #1d4ed8
WHITE = (255, 255, 255, 255)


def draw_logo(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), BLUE)
    d = ImageDraw.Draw(img)
    s = size / 512.0

    def p(x: float, y: float) -> tuple[float, float]:
        return (x * s, y * s)

    hexagon = [p(256, 116), p(376, 186), p(376, 326), p(256, 396), p(136, 326), p(136, 186)]
    stroke = max(2, int(17.5 * s))
    d.line(hexagon + [hexagon[0]], fill=WHITE, width=stroke, joint="curve")
    d.polygon([p(256, 186), p(296, 246), p(216, 246)], fill=WHITE)
    d.line([p(196, 296), p(316, 296)], fill=WHITE, width=max(2, int(20 * s)))
    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size, name in [(192, "icon-192.png"), (512, "icon-512.png"), (180, "apple-touch-icon.png")]:
        path = OUT / name
        draw_logo(size).save(path, "PNG")
        print(f"wrote {path.name} ({size}x{size})")


if __name__ == "__main__":
    main()
