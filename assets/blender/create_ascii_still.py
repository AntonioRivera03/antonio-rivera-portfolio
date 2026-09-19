"""Rasterize a shaded Blender render as crisp, transparent ASCII characters."""

from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("output", type=Path)
parser.add_argument("--font", default="DejaVuSansMono.ttf")
args = parser.parse_args()
args.output.parent.mkdir(parents=True, exist_ok=True)
source = Image.open(args.source).convert("RGBA")
cell_width, cell_height = 7, 10
columns = source.width // cell_width
rows = source.height // cell_height
samples = source.resize((columns, rows), Image.Resampling.BOX)
canvas = Image.new('RGBA', source.size, (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)
font = ImageFont.truetype(args.font, 10)
glyphs = '.:-=+*#%@'
text_rows = []
for row in range(rows):
    characters = []
    for column in range(columns):
        red, green, blue, alpha = samples.getpixel((column, row))
        if alpha < 120:
            characters.append(' ')
            continue
        luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255
        shade = max(0, min(1, (luminance - 0.16) / 0.71))
        density = 0.08 + 0.92 * (1 - shade)
        character = glyphs[min(len(glyphs) - 1, int(density * len(glyphs)))]
        characters.append(character)
        draw.text((column * cell_width, row * cell_height - 2), character, font=font, fill=(34, 34, 34, alpha))
    text_rows.append(''.join(characters))
canvas.save(args.output, optimize=True)
args.output.with_suffix(".txt").write_text("\n".join(text_rows))
print(args.output)
