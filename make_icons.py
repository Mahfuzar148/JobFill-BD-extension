"""Generate simple PNG icons for Chrome extension using only stdlib."""
import struct
import zlib
import os

def create_png(width, height, pixels):
    """Create a minimal PNG from RGBA pixel list."""
    def chunk(name, data):
        c = name + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            r, g, b = pixels[y * width + x]
            raw += bytes([r, g, b])

    idat = chunk(b'IDAT', zlib.compress(raw, 9))
    return (b'\x89PNG\r\n\x1a\n'
            + chunk(b'IHDR', ihdr)
            + idat
            + chunk(b'IEND', b''))

def lerp_color(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))

def make_icon(size, path):
    px = []
    blue = (26, 86, 219)
    teal = (13, 148, 136)
    white = (255, 255, 255)
    green = (16, 185, 129)
    r_corner = max(2, size // 8)

    for y in range(size):
        for x in range(size):
            # Rounded corner mask
            in_corner = False
            for cx, cy in [(r_corner, r_corner), (size - r_corner - 1, r_corner),
                           (r_corner, size - r_corner - 1), (size - r_corner - 1, size - r_corner - 1)]:
                if (x - cx) ** 2 + (y - cy) ** 2 > r_corner ** 2:
                    if x < r_corner and y < r_corner and cx == r_corner and cy == r_corner: in_corner = True
                    if x >= size - r_corner and y < r_corner and cx == size - r_corner - 1 and cy == r_corner: in_corner = True
                    if x < r_corner and y >= size - r_corner and cx == r_corner and cy == size - r_corner - 1: in_corner = True
                    if x >= size - r_corner and y >= size - r_corner and cx == size - r_corner - 1 and cy == size - r_corner - 1: in_corner = True

            if in_corner:
                px.append((240, 244, 248))
                continue

            # Gradient background
            t = (x + y) / (2 * size)
            bg = lerp_color(blue, teal, t)

            # Draw document lines (white bars)
            lx1, lx2 = int(size * 0.18), int(size * 0.72)
            line_h = max(1, size // 12)
            line_gap = max(2, size // 8)
            line_starts = [int(size * 0.17), int(size * 0.17) + line_gap, int(size * 0.17) + line_gap * 2, int(size * 0.17) + line_gap * 3]

            on_line = False
            for ls in line_starts:
                if ls <= y < ls + line_h and lx1 <= x <= lx2:
                    on_line = True
                    break

            # Check circle in bottom-right
            cr = size // 5
            ccx, ccy = int(size * 0.78), int(size * 0.78)
            in_circle = (x - ccx) ** 2 + (y - ccy) ** 2 <= cr ** 2

            if in_circle:
                px.append(green)
            elif on_line:
                px.append(white)
            else:
                px.append(bg)

    png_data = create_png(size, size, px)
    with open(path, 'wb') as f:
        f.write(png_data)
    print(f"Created: {path} ({size}x{size})")

base = r"C:\Users\mahfu\AppData\Local\Temp\JobFormFiller\icons"
os.makedirs(base, exist_ok=True)

make_icon(16,  os.path.join(base, "icon16.png"))
make_icon(48,  os.path.join(base, "icon48.png"))
make_icon(128, os.path.join(base, "icon128.png"))
print("All icons created!")
