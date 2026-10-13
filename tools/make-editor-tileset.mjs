// Generates public/maps/editor-tileset.png: flat coloured squares shown in the Tiled editor.
// The game itself never loads this image; it turns each tile's "terrain" property into 3D models.
// Run with: node tools/make-editor-tileset.mjs
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const TILE_SIZE = 32;
const TILE_COLORS = [
  [147, 198, 110], // floor
  [155, 143, 131], // wall
  [190, 196, 202], // rock
  [46, 120, 58], // tree
  [69, 172, 224], // water
  [255, 122, 31], // lava
  [21, 17, 15], // pit
];

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
}

function pixelColor(x, y) {
  const [r, g, b] = TILE_COLORS[Math.floor(x / TILE_SIZE)];
  const localX = x % TILE_SIZE;
  const localY = y % TILE_SIZE;
  const isBorder = localX === 0 || localY === 0 || localX === TILE_SIZE - 1 || localY === TILE_SIZE - 1;
  const shade = isBorder ? 0.7 : 1;
  return [r * shade, g * shade, b * shade, 255];
}

function buildImageData(width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [0]; // PNG filter type "none"
    for (let x = 0; x < width; x++) row.push(...pixelColor(x, y));
    rows.push(Buffer.from(row));
  }
  return Buffer.concat(rows);
}

const width = TILE_SIZE * TILE_COLORS.length;
const height = TILE_SIZE;
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  pngChunk('IHDR', header),
  pngChunk('IDAT', deflateSync(buildImageData(width, height))),
  pngChunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(new URL('../public/maps/editor-tileset.png', import.meta.url), png);
console.log(`Wrote editor-tileset.png (${width}x${height})`);
