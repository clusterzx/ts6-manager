// QuickLZ level 1 decompression (ported from TSLib QuickerLz.cs)

const TABLE_SIZE = 4096;
const MAX_DECOMPRESSED_SIZE = 1024 * 1024;

export function qlzGetDecompressedSize(data: Buffer): number {
  return (data[0] & 0x02) !== 0
    ? data.readInt32LE(5)
    : data[2];
}

export function qlzGetCompressedSize(data: Buffer): number {
  return (data[0] & 0x02) !== 0
    ? data.readInt32LE(1)
    : data[1];
}

function read24(buf: Buffer, off: number): number {
  return buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16);
}

function hash(value: number): number {
  return ((value >> 12) ^ value) & 0xfff;
}

export function qlzDecompress(data: Buffer): Buffer {
  const flags = data[0];
  const level = (flags >> 2) & 0x03;
  if (level !== 1) {
    throw new Error(`QuickLZ level ${level} not supported`);
  }

  const headerLen = (flags & 0x02) !== 0 ? 9 : 3;
  const decompressedSize = qlzGetDecompressedSize(data);

  if (decompressedSize > MAX_DECOMPRESSED_SIZE) {
    throw new Error(`Decompressed size ${decompressedSize} exceeds max`);
  }

  const dest = Buffer.alloc(decompressedSize);

  if ((flags & 0x01) === 0) {
    data.copy(dest, 0, headerLen, headerLen + decompressedSize);
    return dest;
  }

  // Level 1 decompression
  const hashtable = new Int32Array(TABLE_SIZE);
  let control = 1;
  let sourcePos = headerLen;
  let destPos = 0;
  let nextHashed = 0;

  while (true) {
    if (control === 1) {
      control = data.readUInt32LE(sourcePos) >>> 0;
      sourcePos += 4;
    }

    if ((control & 1) !== 0) {
      // Back-reference
      control >>>= 1;
      const next = data[sourcePos++];
      const hashIdx = (next >> 4) | (data[sourcePos++] << 4);

      let matchLen = next & 0x0f;
      if (matchLen !== 0) {
        matchLen += 2;
      } else {
        matchLen = data[sourcePos++];
      }

      const offset = hashtable[hashIdx];

      // Copy bytes (may overlap, byte-by-byte)
      dest[destPos] = dest[offset];
      dest[destPos + 1] = dest[offset + 1];
      dest[destPos + 2] = dest[offset + 2];
      for (let i = 3; i < matchLen; i++) {
        dest[destPos + i] = dest[offset + i];
      }
      destPos += matchLen;

      // Update hash table
      const end = destPos + 1 - matchLen;
      if (nextHashed < end) {
        let nxt = read24(dest, nextHashed);
        hashtable[hash(nxt)] = nextHashed;
        for (let i = nextHashed + 1; i < end; i++) {
          nxt = (nxt >> 8) | (dest[i + 2] << 16);
          hashtable[hash(nxt)] = i;
        }
      }
      nextHashed = destPos;
    } else if (destPos >= Math.max(decompressedSize, 10) - 10) {
      // Near end, copy remaining literals
      while (destPos < decompressedSize) {
        if (control === 1) {
          sourcePos += 4;
        }
        control >>>= 1;
        dest[destPos++] = data[sourcePos++];
      }
      break;
    } else {
      // Literal byte
      dest[destPos++] = data[sourcePos++];
      control >>>= 1;

      const end = Math.max(destPos - 2, 0);
      if (nextHashed < end) {
        let nxt = read24(dest, nextHashed);
        hashtable[hash(nxt)] = nextHashed;
        for (let i = nextHashed + 1; i < end; i++) {
          nxt = (nxt >> 8) | (dest[i + 2] << 16);
          hashtable[hash(nxt)] = i;
        }
      }
      nextHashed = Math.max(nextHashed, end);
    }
  }

  return dest;
}
