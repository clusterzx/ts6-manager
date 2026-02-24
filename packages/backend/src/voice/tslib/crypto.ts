import * as crypto from "crypto";

// AES-CMAC (OMAC1) implementation
const BLOCK_SIZE = 16;
const ZERO_BLOCK = Buffer.alloc(BLOCK_SIZE, 0);
const RB = 0x87; // Constant for GF(2^128) multiplication

function doubleBlock(buf: Buffer): Buffer {
  const out = Buffer.alloc(BLOCK_SIZE);
  let carry = 0;
  for (let i = BLOCK_SIZE - 1; i >= 0; i--) {
    const tmp = (buf[i] << 1) | carry;
    out[i] = tmp & 0xff;
    carry = (buf[i] >> 7) & 1;
  }
  if (carry) out[BLOCK_SIZE - 1] ^= RB;
  return out;
}

function aesEncryptBlock(key: Buffer, block: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(block), cipher.final()]);
}

function cmac(key: Buffer, data: Buffer): Buffer {
  // Generate subkeys
  const L = aesEncryptBlock(key, ZERO_BLOCK);
  const K1 = doubleBlock(L);
  const K2 = doubleBlock(K1);

  const n = data.length;
  const numBlocks = n === 0 ? 1 : Math.ceil(n / BLOCK_SIZE);
  const lastBlockComplete = n > 0 && n % BLOCK_SIZE === 0;

  // Process all blocks except the last
  let x: Buffer = Buffer.alloc(BLOCK_SIZE, 0);
  for (let i = 0; i < numBlocks - 1; i++) {
    const block = Buffer.from(data.subarray(i * BLOCK_SIZE, (i + 1) * BLOCK_SIZE));
    const y = xorBuffers(x, block);
    x = aesEncryptBlock(key, y);
  }

  // Process last block
  let lastBlock: Buffer;
  if (lastBlockComplete) {
    lastBlock = xorBuffers(Buffer.from(data.subarray((numBlocks - 1) * BLOCK_SIZE)), K1);
  } else {
    const padded = Buffer.alloc(BLOCK_SIZE, 0);
    const remaining = data.subarray((numBlocks - 1) * BLOCK_SIZE);
    remaining.copy(padded);
    padded[remaining.length] = 0x80;
    lastBlock = xorBuffers(padded, K2);
  }

  const y = xorBuffers(x, lastBlock);
  return aesEncryptBlock(key, y);
}

// EAX mode implementation (AES-128-EAX)
function eaxOmac(key: Buffer, tag: number, data: Buffer): Buffer {
  const tagBlock = Buffer.alloc(BLOCK_SIZE, 0);
  tagBlock[BLOCK_SIZE - 1] = tag;
  const input = Buffer.concat([tagBlock, data]);
  return cmac(key, input);
}

export function eaxEncrypt(
  key: Buffer,
  nonce: Buffer,
  header: Buffer,
  plaintext: Buffer,
  macLen: number = 8
): { ciphertext: Buffer; mac: Buffer } {
  const N = eaxOmac(key, 0, nonce);
  const H = eaxOmac(key, 1, header);
  const cipher = crypto.createCipheriv("aes-128-ctr", key, N);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const C = eaxOmac(key, 2, ciphertext);
  const tag = xorBuffers(xorBuffers(N, H), C);
  return { ciphertext, mac: tag.subarray(0, macLen) };
}

export function eaxDecrypt(
  key: Buffer,
  nonce: Buffer,
  header: Buffer,
  ciphertext: Buffer,
  mac: Buffer,
  macLen: number = 8
): Buffer | null {
  const N = eaxOmac(key, 0, nonce);
  const H = eaxOmac(key, 1, header);
  const C = eaxOmac(key, 2, ciphertext);
  const tag = xorBuffers(xorBuffers(N, H), C);
  if (!crypto.timingSafeEqual(tag.subarray(0, macLen), mac.subarray(0, macLen))) {
    return null;
  }
  const decipher = crypto.createDecipheriv("aes-128-ctr", key, N);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// Hash helpers
export function sha1(data: Buffer): Buffer {
  return crypto.createHash("sha1").update(data).digest();
}

export function sha256(data: Buffer): Buffer {
  return crypto.createHash("sha256").update(data).digest();
}

export function sha512(data: Buffer): Buffer {
  return crypto.createHash("sha512").update(data).digest();
}

export function xorBuffers(a: Buffer, b: Buffer): Buffer {
  const len = Math.min(a.length, b.length);
  const out = Buffer.alloc(len);
  for (let i = 0; i < len; i++) out[i] = a[i] ^ b[i];
  return out;
}

// XOR b into a (in-place, first `len` bytes)
export function xorInto(a: Buffer, b: Buffer, len: number): void {
  for (let i = 0; i < len; i++) a[i] ^= b[i];
}

export const MAC_LEN = 8;
export const INIT_MAC = Buffer.from("TS3INIT1", "ascii");
// "c:\windows\system\firewall32.cpl" split into key(16) + nonce(16)
export const DUMMY_KEY = Buffer.from("c:\\windows\\syste", "ascii");
export const DUMMY_NONCE = Buffer.from("m\\firewall32.cpl", "ascii");
export const INIT_VERSION = 1566914096; // 3.5.0 [Stable]

export function hashPassword(password: string): string {
  if (!password) return "";
  return sha1(Buffer.from(password, "utf-8")).toString("base64");
}

// Per-packet key/nonce derivation
export function deriveKeyNonce(
  fromServer: boolean,
  packetId: number,
  generationId: number,
  packetType: number,
  ivStruct: Buffer
): { key: Buffer; nonce: Buffer } {
  const tmpLen = ivStruct.length === 20 ? 26 : 70;
  const tmp = Buffer.alloc(tmpLen);
  tmp[0] = fromServer ? 0x30 : 0x31;
  tmp[1] = packetType;
  tmp.writeUInt32BE(generationId, 2);
  ivStruct.copy(tmp, 6);

  const keynonce = sha256(tmp);
  const key = Buffer.from(keynonce.subarray(0, 16));
  const nonce = Buffer.from(keynonce.subarray(16, 32));
  key[0] ^= (packetId >> 8) & 0xff;
  key[1] ^= packetId & 0xff;
  return { key, nonce };
}

// ECDSA sign with P-256 / SHA-256
export function ecdsaSign(privateKeyDer: Buffer, data: Buffer): Buffer {
  const key = crypto.createPrivateKey({
    key: privateKeyDer,
    format: "der",
    type: "sec1",
  });
  return crypto.sign("SHA256", data, key);
}

// ECDSA verify with P-256 / SHA-256
export function ecdsaVerify(
  publicKeyDer: Buffer,
  data: Buffer,
  signature: Buffer
): boolean {
  const key = crypto.createPublicKey({
    key: publicKeyDer,
    format: "der",
    type: "spki",
  });
  return crypto.verify("SHA256", data, key, signature);
}
