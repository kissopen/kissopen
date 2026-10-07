/*
The bar under a usage line, drawn here because a native menu cannot lay one out.

A menu item carries a label and an image, and nothing else. There is no view to
put a progress bar in — macOS has one, `NSMenuItem.view`, and Electron does not
expose it — so the bar is the image: a few hundred pixels of RGBA, encoded as a
PNG and handed to the item. It is drawn rather than shipped as an asset because
its whole content is the number, which is only known when the menu opens.

Encoded by hand for the same reason the mark is generated at build time rather
than fetched: the alternative is a raster library in the application's runtime
dependencies, and a bar six pixels tall is not worth one. `zlib` is already
there, and a PNG is a header, one deflated block of scanlines, and a CRC.
*/
import { nativeImage, type NativeImage } from "electron";
import { deflateSync } from "node:zlib";

/** Logical size. Wide enough to read as a measure, narrow enough not to widen the menu. */
const WIDTH = 208;
const HEIGHT = 6;
/** Drawn at twice that, so it stays crisp on a retina display. */
const SCALE = 2;

type Channels = readonly [number, number, number];

/** Blurple, from the brand sheet. */
const FILL: Channels = [0x91, 0x84, 0xd9];
/**
 * The unspent remainder. Neutral grey at low alpha so it reads as a recess on a
 * light menu and on a dark one, which one fixed colour cannot do.
 */
const TRACK: Channels = [0x80, 0x80, 0x80];
const TRACK_ALPHA = 0.32;

/**
 * One limit, as a bar.
 *
 * `percent` is clamped, because a window can be spent past its limit and a bar
 * wider than its track is a drawing bug rather than a fact about the account.
 */
export function trayUsageBar(percent: number): NativeImage {
    const width = WIDTH * SCALE;
    const height = HEIGHT * SCALE;
    const radius = height / 2;
    const fraction = Math.min(1, Math.max(0, percent / 100));
    /*
     * A spent fraction narrower than the bar is round still reads as "some",
     * because the cap alone is visible. Zero stays empty: nothing spent must
     * not look like a little spent.
     */
    const filled = fraction === 0 ? 0 : Math.max(height, width * fraction);

    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const track = coverage(x, y, width, height, radius);
            if (track <= 0) continue;
            const fill = filled > 0 ? coverage(x, y, filled, height, radius) : 0;
            const [red, green, blue] = fill > 0 ? FILL : TRACK;
            const alpha = fill > 0 ? fill : track * TRACK_ALPHA;
            const at = (y * width + x) * 4;
            pixels[at] = red;
            pixels[at + 1] = green;
            pixels[at + 2] = blue;
            pixels[at + 3] = Math.round(alpha * 255);
        }
    }
    return nativeImage.createFromBuffer(png(pixels, width, height), { scaleFactor: SCALE });
}

/**
 * How much of this pixel the rounded bar covers, from 0 to 1.
 *
 * The distance to the shape's edge, softened across one pixel. Enough
 * antialiasing that a six-point bar does not have staircase ends, and little
 * enough to stay a few lines of arithmetic.
 */
function coverage(x: number, y: number, right: number, height: number, radius: number): number {
    // A rounded bar is every point within `radius` of its medial segment, so
    // the distance to that segment is the distance to the shape.
    const nearestX = Math.min(Math.max(x + 0.5, radius), right - radius);
    const dx = x + 0.5 - nearestX;
    const dy = y + 0.5 - height / 2;
    return Math.min(1, Math.max(0, 0.5 - (Math.hypot(dx, dy) - radius)));
}

/** The pixels as a PNG: signature, header, one deflated image block, end. */
function png(pixels: Buffer, width: number, height: number): Buffer {
    // Every scanline carries its filter type, and 0 means "stored as is".
    const stride = width * 4 + 1;
    const raw = Buffer.alloc(height * stride);
    for (let y = 0; y < height; y++) {
        raw[y * stride] = 0;
        pixels.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(width, 0);
    header.writeUInt32BE(height, 4);
    header[8] = 8; // Eight bits per channel.
    header[9] = 6; // Truecolour with alpha.
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(raw)),
        chunk("IEND", Buffer.alloc(0)),
    ]);
}

function chunk(type: string, body: Buffer): Buffer {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(body.length, 0);
    const named = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc(named), 0);
    return Buffer.concat([length, named, checksum]);
}

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index++) {
        let value = index;
        for (let bit = 0; bit < 8; bit++)
            value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        table[index] = value >>> 0;
    }
    return table;
})();

function crc(bytes: Buffer): number {
    let value = 0xffffffff;
    for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff]! ^ (value >>> 8);
    return (value ^ 0xffffffff) >>> 0;
}
