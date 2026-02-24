import * as crypto from "crypto";
import { sha512 } from "./crypto.js";

// We use libsodium-wrappers-sumo for Ed25519 point operations
let sodium: any = null;

async function getSodium() {
  if (!sodium) {
    const mod = await import("libsodium-wrappers-sumo");
    await mod.default.ready;
    sodium = mod.default;
  }
  return sodium;
}

// License root key (Ed25519 point, compressed)
const LICENSE_ROOT_KEY = Buffer.from([
  0xcd, 0x0d, 0xe2, 0xae, 0xd4, 0x63, 0x45, 0x50, 0x9a, 0x7e, 0x3c, 0xfd,
  0x8f, 0x68, 0xb3, 0xdc, 0x75, 0x55, 0xb2, 0x9d, 0xcc, 0xec, 0x73, 0xcd,
  0x18, 0x75, 0x0f, 0x99, 0x38, 0x12, 0x40, 0x8a,
]);

interface LicenseBlock {
  key: Buffer; // 32 bytes
  hash: Buffer; // 32 bytes (first 32 of SHA-512 of block content)
  type: number;
}

export function parseLicense(data: Buffer): LicenseBlock[] {
  if (data.length < 1) throw new Error("License too short");
  if (data[0] !== 1) throw new Error("Unsupported license version");

  const blocks: LicenseBlock[] = [];
  let pos = 1;

  while (pos < data.length) {
    if (data.length - pos < 42) throw new Error("License block too short");
    if (data[pos] !== 0) throw new Error(`Wrong key kind ${data[pos]}`);

    const key = data.subarray(pos + 1, pos + 33);
    const blockType = data[pos + 33];

    let extraLen = 0;
    switch (blockType) {
      case 0: // Intermediate
        extraLen = findNullTerminator(data, pos + 46) + 5;
        break;
      case 2: // Server
        extraLen = findNullTerminator(data, pos + 47) + 6;
        break;
      case 8: { // TS5 Server
        let p = pos + 44;
        const propCount = data[pos + 43];
        for (let i = 0; i < propCount; i++) {
          const propLen = data[p];
          p += 1 + propLen;
        }
        extraLen = p - (pos + 42);
        break;
      }
      case 32: // Ephemeral
        extraLen = 0;
        break;
      default:
        throw new Error(`Invalid license block type ${blockType}`);
    }

    const blockLen = 42 + extraLen;
    const hashInput = data.subarray(pos + 1, pos + blockLen);
    const hash = sha512(Buffer.from(hashInput)).subarray(0, 32);

    blocks.push({
      key: Buffer.from(key),
      hash: Buffer.from(hash),
      type: blockType,
    });
    pos += blockLen;
  }

  return blocks;
}

function findNullTerminator(data: Buffer, start: number): number {
  for (let i = start; i < data.length; i++) {
    if (data[i] === 0) return i - start;
  }
  throw new Error("Non-null-terminated string in license");
}

// Derive the final public key from the license chain
export async function deriveLicenseKey(blocks: LicenseBlock[]): Promise<Buffer> {
  await getSodium();
  let parentKey: Buffer = Buffer.from(LICENSE_ROOT_KEY);

  for (const block of blocks) {
    parentKey = deriveBlockKey(block.key, block.hash, parentKey);
  }

  return parentKey;
}

function deriveBlockKey(
  blockKey: Buffer,
  hash: Buffer,
  parentKey: Buffer
): Buffer {
  const scalar = Buffer.from(hash);
  scalar[0] &= 0xf8;
  scalar[31] &= 0x3f;
  scalar[31] |= 0x40;

  const mulResult = Buffer.from(
    sodium.crypto_scalarmult_ed25519_noclamp(
      new Uint8Array(scalar),
      new Uint8Array(blockKey)
    )
  );

  const result = Buffer.from(
    sodium.crypto_core_ed25519_add(
      new Uint8Array(mulResult),
      new Uint8Array(parentKey)
    )
  );

  return result;
}

// Compute shared secret for new protocol (initivexpand2)
export async function getSharedSecret2(
  serverDerivedKey: Buffer,
  tempPrivateKey: Buffer
): Promise<Buffer> {
  await getSodium();

  const privKeyCopy = Buffer.from(tempPrivateKey);
  privKeyCopy[31] &= 0x7f;

  const mulResult = Buffer.from(
    sodium.crypto_scalarmult_ed25519_noclamp(
      new Uint8Array(privKeyCopy),
      new Uint8Array(serverDerivedKey)
    )
  );

  return sha512(mulResult);
}

// Generate a temporary Ed25519 keypair
export async function generateTemporaryKey(): Promise<{
  publicKey: Buffer;
  privateKey: Buffer;
}> {
  await getSodium();

  const privateKey = Buffer.from(crypto.randomBytes(32));
  privateKey[0] &= 248;
  privateKey[31] &= 127;
  privateKey[31] |= 64;

  const publicKey = Buffer.from(
    sodium.crypto_scalarmult_ed25519_base_noclamp(
      new Uint8Array(privateKey)
    )
  );

  return { publicKey, privateKey };
}
