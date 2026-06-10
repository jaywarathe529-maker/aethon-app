#!/usr/bin/env python3
# generate_icons.py
# Run this in your project root: python3 generate_icons.py
# Generates all required PWA icons using only Python stdlib (no PIL needed)

import struct, zlib, os, math

def create_png(size):
    """Create a simple Aethon icon PNG at given size using pure Python"""
    width = height = size

    def pack_chunk(chunk_type, data):
        c = chunk_type + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr = pack_chunk(b'IHDR', ihdr_data)

    # Generate pixel data
    raw_rows = []
    cx, cy = width / 2, height / 2
    r_outer = size * 0.45
    r_inner = size * 0.28

    for y in range(height):
        row = bytearray([0])  # filter byte
        for x in range(width):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx*dx + dy*dy)

            # Background
            r, g, b = 7, 7, 16

            # Outer glow ring
            if r_inner - size*0.04 < dist < r_outer + size*0.04:
                t = 0
                if dist < r_inner:
                    t = (dist - (r_inner - size*0.04)) / (size*0.04)
                elif dist > r_outer:
                    t = 1 - (dist - r_outer) / (size*0.04)
                else:
                    # gradient between inner and outer radius
                    progress = (dist - r_inner) / (r_outer - r_inner)
                    # green to purple gradient
                    gr = int(0 + progress * 124)
                    gg = int(214 - progress * 156)
                    gb = int(143 + progress * 94)
                    t = 1
                    r = int(r + t * (gr - r))
                    g = int(g + t * (gg - g))
                    b = int(b + t * (gb - b))
                if t > 0 and not (r_inner <= dist <= r_outer):
                    r = int(r + t * (0 - r))
                    g = int(g + t * (100 - g))
                    b = int(b + t * (80 - b))

            # Main ring
            ring_w = size * 0.06
            if abs(dist - (r_inner + (r_outer - r_inner) * 0.5)) < ring_w:
                progress = (dist - r_inner) / (r_outer - r_inner)
                progress = max(0, min(1, progress))
                r = int(0 * (1 - progress) + 124 * progress)
                g = int(214 * (1 - progress) + 58 * progress)
                b = int(143 * (1 - progress) + 237 * progress)

            # Center dot
            if dist < size * 0.08:
                t = 1 - dist / (size * 0.08)
                r = int(r + t * (0 - r))
                g = int(g + t * (214 - g))
                b = int(b + t * (143 - b))

            row.extend([
                max(0, min(255, r)),
                max(0, min(255, g)),
                max(0, min(255, b))
            ])
        raw_rows.append(bytes(row))

    compressed = zlib.compress(b''.join(raw_rows), 9)
    idat = pack_chunk(b'IDAT', compressed)
    iend = pack_chunk(b'IEND', b'')

    return b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend

# Generate all required icon sizes
sizes = [72, 96, 128, 144, 152, 192, 384, 512]
os.makedirs('public/icons', exist_ok=True)

for size in sizes:
    png_data = create_png(size)
    path = f'public/icons/icon-{size}.png'
    with open(path, 'wb') as f:
        f.write(png_data)
    print(f'✓ Created {path} ({size}x{size})')

# Also copy 192 as favicon
with open('public/icons/icon-192.png', 'rb') as f:
    data = f.read()
with open('public/favicon.png', 'wb') as f:
    f.write(data)
print('✓ Created public/favicon.png')
print('\nAll icons generated successfully!')
print('Now run: npm run build')
