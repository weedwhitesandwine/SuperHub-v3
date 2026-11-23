"""Original pixel-art scene for SuperHub-v3's console screen: a calm meadow with open
sky on top (room for the clock, date and battery). 160 x 120 logical pixels in four
greys, scaled up with hard edges."""
import sys
from PIL import Image, ImageDraw
W, H = 130, 120  # the console screen is a little taller than wide (494 x 456)
C0, C1, C2, C3 = (238, 238, 238), (176, 176, 176), (100, 100, 100), (24, 24, 24)  # light..dark
im = Image.new('RGB', (W, H), C0); d = ImageDraw.Draw(im)
px = lambda x, y, c: d.point((x, y), c)
# ground starts at y=66: grass band with a few tufts
d.rectangle((0, 66, W, H), C0)
for x in range(0, W, 2): px(x, 66, C2)                       # horizon dotted
for (x, y) in [(10,74),(26,90),(44,80),(58,104),(84,86),(100,98),(116,78),(20,108),(70,72),(124,110)]:
    for dx, dy in [(0,0),(-1,1),(1,1)]: px(x+dx, y+dy, C2)
# path winding from the bottom to a cottage
for y in range(84, H):
    cx = 63 + int(6 * __import__('math').sin(y / 9))
    d.line((cx-6, y, cx+6, y), C1)
# cottage
d.rectangle((51, 70, 75, 84), C0, outline=C3)
d.polygon([(47, 71), (63, 60), (79, 71)], fill=C2, outline=C3)
d.rectangle((60, 76, 66, 84), C2, outline=C3)
d.rectangle((53, 73, 57, 77), C1, outline=C3); d.rectangle((69, 73, 73, 77), C1, outline=C3)
d.rectangle((71, 61, 74, 67), C2, outline=C3)                 # chimney
for i, (x, y) in enumerate([(74, 57), (76, 54), (75, 51)]): px(x, y, C1); px(x+1, y, C1)  # smoke
# trees at the edges
def tree(x, y, r):
    d.rectangle((x-1, y, x+1, y+6), C3)
    d.ellipse((x-r, y-2*r+2, x+r, y+2), C2, outline=C3)
    px(x-r//2, y-r, C1); px(x-r//2+1, y-r+1, C1)
for x, y, r in [(9, 80, 6), (22, 76, 5), (112, 82, 7), (123, 92, 5)]: tree(x, y, r)
# pond with ripples
d.ellipse((84, 98, 110, 111), C1, outline=C3)
d.line((90, 103, 96, 103), C0); d.line((98, 106, 104, 106), C0)
# fence
for x in range(16, 42, 5): d.line((x, 92, x, 98), C3)
d.line((16, 94, 41, 94), C3); d.line((16, 97, 41, 97), C3)
# a small walker on the path
d.rectangle((59, 104, 63, 110), C3); d.rectangle((60, 100, 62, 103), C2, outline=C3); px(59, 111, C3); px(63, 111, C3)
# flowers
for (x, y) in [(30, 106), (34, 110), (86, 76), (104, 74), (46, 112)]: px(x, y, C3); px(x, y-1, C1)
# sun and two clouds high up, leaving the middle sky clear for the clock
d.ellipse((112, 6, 124, 18), C1, outline=C2)
for cx, cy in [(6, 10), (96, 22)]:
    d.ellipse((cx, cy, cx+14, cy+6), C1); d.ellipse((cx+6, cy-3, cx+18, cy+5), C1)
im = im.resize((W * 8, H * 8), Image.NEAREST)
im.convert('L').save(sys.argv[1])
