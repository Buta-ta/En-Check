"""Usage: python scripts/assets/prepare-pointages-art.py input.png output.webp
Requires Pillow. Extends only paper margins; keeps the approved figure intact.
"""
import sys
from PIL import Image, ImageOps

source = Image.open(sys.argv[1]).convert('RGB').resize((1024, 1024), Image.Resampling.LANCZOS)
# 16:9 canvas; source pixels remain unchanged at the center before WebP encoding.
width, height, offset = 1824, 1026, 400
canvas = Image.new('RGB', (width, height), '#f4eedf')
for right in (False, True):
    tile = source.crop((960 if right else 0, 0, 1024 if right else 64, 984))
    for i in range(7):
        patch = ImageOps.mirror(tile) if i % 2 == 0 else tile
        x = offset + 1024 + i * 64 if right else offset - (i + 1) * 64
        canvas.paste(patch, (x, 1))
canvas.paste(source, (offset, 1))
# Continue the original ornament without inventing or stretching its pattern.
band = source.crop((0, 984, 1024, 1024))
for x in range(offset - 1024, width, 1024):
    canvas.paste(band, (x, 985))
canvas.paste(canvas.crop((0, 1, width, 2)), (0, 0))
canvas.paste(canvas.crop((0, 1024, width, 1025)), (0, 1025))
canvas.save(sys.argv[2], 'WEBP', quality=95, method=6)
