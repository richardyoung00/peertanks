// Compact fixed-point encodings keep snapshots small on slow connections.
const COORD_SCALE = 128; // 1/128 tile precision, range ±256 tiles
const VELOCITY_SCALE = 256; // range ±128 tiles per second
const ANGLE_SCALE = 32767 / Math.PI;
const DISTANCE_SCALE = 64;

function clampInt16(value: number): number {
  return Math.max(-32768, Math.min(32767, Math.round(value)));
}

function clampUint16(value: number): number {
  return Math.max(0, Math.min(65535, Math.round(value)));
}

/** Grows if more is written than the starting capacity. */
export class ByteWriter {
  private view: DataView;
  private offset = 0;

  constructor(capacity: number) {
    this.view = new DataView(new ArrayBuffer(capacity));
  }

  u8(value: number): void {
    this.reserve(1);
    this.view.setUint8(this.offset, value);
    this.offset += 1;
  }

  i8(value: number): void {
    this.reserve(1);
    this.view.setInt8(this.offset, value);
    this.offset += 1;
  }

  u16(value: number): void {
    this.reserve(2);
    this.view.setUint16(this.offset, value);
    this.offset += 2;
  }

  i16(value: number): void {
    this.reserve(2);
    this.view.setInt16(this.offset, value);
    this.offset += 2;
  }

  u32(value: number): void {
    this.reserve(4);
    this.view.setUint32(this.offset, value);
    this.offset += 4;
  }

  coord(value: number): void {
    this.i16(clampInt16(value * COORD_SCALE));
  }

  velocity(value: number): void {
    this.i16(clampInt16(value * VELOCITY_SCALE));
  }

  angle(value: number): void {
    this.i16(clampInt16(value * ANGLE_SCALE));
  }

  distance(value: number): void {
    this.u16(clampUint16(value * DISTANCE_SCALE));
  }

  finish(): ArrayBuffer {
    return this.view.buffer.slice(0, this.offset) as ArrayBuffer;
  }

  private reserve(bytes: number): void {
    const needed = this.offset + bytes;
    if (needed <= this.view.byteLength) return;
    const grown = new Uint8Array(Math.max(needed, this.view.byteLength * 2));
    grown.set(new Uint8Array(this.view.buffer, 0, this.offset));
    this.view = new DataView(grown.buffer);
  }
}

export class ByteReader {
  private readonly view: DataView;
  private offset = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  u8(): number {
    const value = this.view.getUint8(this.offset);
    this.offset += 1;
    return value;
  }

  i8(): number {
    const value = this.view.getInt8(this.offset);
    this.offset += 1;
    return value;
  }

  u16(): number {
    const value = this.view.getUint16(this.offset);
    this.offset += 2;
    return value;
  }

  i16(): number {
    const value = this.view.getInt16(this.offset);
    this.offset += 2;
    return value;
  }

  u32(): number {
    const value = this.view.getUint32(this.offset);
    this.offset += 4;
    return value;
  }

  coord(): number {
    return this.i16() / COORD_SCALE;
  }

  velocity(): number {
    return this.i16() / VELOCITY_SCALE;
  }

  angle(): number {
    return this.i16() / ANGLE_SCALE;
  }

  distance(): number {
    return this.u16() / DISTANCE_SCALE;
  }
}
