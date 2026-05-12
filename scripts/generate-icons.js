const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const projectRoot = path.join(__dirname, "..");
const buildDir = path.join(projectRoot, "build");
const iconPngPath = path.join(buildDir, "icon.png");
const iconIcoPath = path.join(buildDir, "icon.ico");
const iconSizes = [256, 64, 48, 32, 16];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(start, end, amount) {
  return Math.round(start + (end - start) * amount);
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (!lengthSquared) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function blendPixel(buffer, index, color, alpha) {
  const srcAlpha = clamp(alpha, 0, 1);

  if (srcAlpha <= 0) {
    return;
  }

  const dstAlpha = buffer[index + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

  for (let channel = 0; channel < 3; channel += 1) {
    const src = color[channel];
    const dst = buffer[index + channel];
    buffer[index + channel] = Math.round(
      (src * srcAlpha + dst * dstAlpha * (1 - srcAlpha)) / outAlpha
    );
  }

  buffer[index + 3] = Math.round(outAlpha * 255);
}

function createIconPng(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const circleRadius = 0.465;
  const checkRadius = 0.047;
  const feather = 1.25 / size;
  const blue = [84, 190, 255];
  const purple = [133, 98, 255];
  const white = [255, 255, 255];

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      const distanceFromCenter = Math.hypot(nx - 0.5, ny - 0.5);
      const circleAlpha =
        1 - smoothstep(circleRadius - feather, circleRadius + feather, distanceFromCenter);
      const index = (y * size + x) * 4;

      if (circleAlpha > 0) {
        const gradient = clamp((nx * 0.65 + ny * 0.85) / 1.5, 0, 1);
        blendPixel(
          rgba,
          index,
          [
            mix(blue[0], purple[0], gradient),
            mix(blue[1], purple[1], gradient),
            mix(blue[2], purple[2], gradient)
          ],
          circleAlpha
        );
      }

      const checkDistance = Math.min(
        distanceToSegment(nx, ny, 0.27, 0.53, 0.42, 0.68),
        distanceToSegment(nx, ny, 0.42, 0.68, 0.73, 0.34)
      );
      const checkAlpha =
        (1 - smoothstep(checkRadius - feather, checkRadius + feather, checkDistance)) *
        circleAlpha;

      blendPixel(rgba, index, white, checkAlpha);
    }
  }

  return encodePng(size, size, rgba);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;

  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", zlib.deflateSync(raw)),
    createPngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createPngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);

  length.writeUInt32BE(data.length, 0);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_value, index) => {
  let crc = index;

  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }

  return crc >>> 0;
});

function createIcoFromPngs(pngs) {
  const headerSize = 6;
  const entrySize = 16;
  const header = Buffer.alloc(headerSize);
  const entries = [];
  const images = [];
  let imageOffset = headerSize + iconSizes.length * entrySize;

  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(iconSizes.length, 4);

  for (const size of iconSizes) {
    const image = pngs.get(size);
    const entry = Buffer.alloc(entrySize);

    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.length, 8);
    entry.writeUInt32LE(imageOffset, 12);

    entries.push(entry);
    images.push(image);
    imageOffset += image.length;
  }

  return Buffer.concat([header, ...entries, ...images]);
}

fs.mkdirSync(buildDir, { recursive: true });

const pngs = new Map(iconSizes.map((size) => [size, createIconPng(size)]));
fs.writeFileSync(iconPngPath, pngs.get(256));
fs.writeFileSync(iconIcoPath, createIcoFromPngs(pngs));

console.log(`Generated ${path.relative(projectRoot, iconPngPath)}`);
console.log(`Generated ${path.relative(projectRoot, iconIcoPath)}`);
