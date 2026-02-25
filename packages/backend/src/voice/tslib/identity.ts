import * as crypto from "crypto";
import { Worker } from "worker_threads";
import { fileURLToPath } from "url";
import path from "path";
import { sha1, xorInto } from "./crypto.js";

// Static obfuscation key used by TS3 identity export
const OBFUSCATION_KEY = Buffer.from(
  "b9dfaa7bee6ac57ac7b65f1094a1c155" +
    "e747327bc2fe5d51c512023fe54a2802" +
    "01004e90ad1daaae1075d53b7d571c30" +
    "e063b5a62a4a017bb394833aa0983e6e",
  "hex"
);

export interface IdentityData {
  privateKey: crypto.KeyObject; // ECDSA private key (P-256)
  publicKey: crypto.KeyObject; // ECDSA public key (P-256)
  privateKeyBigInt: bigint; // Raw private key scalar
  publicKeyString: string; // Base64 of libtomcrypt-style public key export
  keyOffset: bigint;
  uid: string; // base64(sha1(publicKeyString))
}

// Restore identity from serialized JSON (KeyObjects reconstructed from privateKeyBigInt)
export function restoreIdentity(data: {
  privateKeyBigInt: string | bigint;
  keyOffset: string | bigint;
  publicKeyString: string;
  uid: string;
}): IdentityData {
  const privScalar = typeof data.privateKeyBigInt === 'bigint'
    ? data.privateKeyBigInt
    : BigInt(data.privateKeyBigInt);
  const keyOffset = typeof data.keyOffset === 'bigint'
    ? data.keyOffset
    : BigInt(data.keyOffset);

  const dBuf = bigintToBuffer32(privScalar);
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(dBuf);
  const pub = ecdh.getPublicKey();
  const xBuf = pub.subarray(1, 33);
  const yBuf = pub.subarray(33, 65);

  const jwk = {
    kty: "EC" as const,
    crv: "P-256" as const,
    x: Buffer.from(xBuf).toString("base64url"),
    y: Buffer.from(yBuf).toString("base64url"),
    d: dBuf.toString("base64url"),
  };

  const privateKey = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const publicKey = crypto.createPublicKey(privateKey);

  return {
    privateKey,
    publicKey,
    privateKeyBigInt: privScalar,
    publicKeyString: data.publicKeyString,
    keyOffset,
    uid: data.uid,
  };
}

// Import identity from TS3 client export format: "0V<base64data>"
export function fromTsIdentity(identityStr: string): IdentityData {
  const match = identityStr.match(/^(\d+)V([\w/+=]+)$/);
  if (!match) throw new Error("Invalid TS3 identity format");

  const keyOffset = BigInt(match[1]);
  const ident = Buffer.from(match[2], "base64");
  if (ident.length < 20) throw new Error("Identity too short");

  // Find null terminator starting at offset 20
  let nullIdx = -1;
  for (let i = 20; i < ident.length; i++) {
    if (ident[i] === 0) {
      nullIdx = i - 20;
      break;
    }
  }
  const hashLen = nullIdx < 0 ? ident.length - 20 : nullIdx;
  const hash = sha1(ident.subarray(20, 20 + hashLen));

  // Deobfuscate: XOR first 20 bytes with hash
  xorInto(ident, hash, 20);
  // XOR up to 100 bytes with obfuscation key
  xorInto(ident, OBFUSCATION_KEY, Math.min(100, ident.length));

  // The result is base64-encoded ASN.1 DER data (as UTF-8 bytes)
  const innerB64 = ident.toString("utf-8").replace(/\0.*$/, "");
  const asnData = Buffer.from(innerB64, "base64");

  return importKeyFromAsn(asnData, keyOffset);
}

// Import from raw base64 ASN.1 key (libtomcrypt format)
export function fromBase64Key(
  base64Key: string,
  keyOffset: bigint = 0n
): IdentityData {
  const asnData = Buffer.from(base64Key, "base64");
  return importKeyFromAsn(asnData, keyOffset);
}

// Parse libtomcrypt-style ASN.1 key: SEQUENCE { BIT STRING, INTEGER(32), INTEGER(x), INTEGER(y) [, INTEGER(d)] }
function importKeyFromAsn(
  asnData: Buffer,
  keyOffset: bigint
): IdentityData {
  const parsed = parseDerSequence(asnData);
  if (parsed.length < 3) throw new Error("Invalid ASN.1 key data");

  const bitInfo = parsed[0] as number;
  let privateKeyScalar: bigint | null = null;
  let pubX: bigint;
  let pubY: bigint;

  if (bitInfo === 0x00 || bitInfo === 0x80) {
    pubX = parsed[2] as bigint;
    pubY = parsed[3] as bigint;
    if (bitInfo === 0x80 && parsed.length >= 5) {
      privateKeyScalar = parsed[4] as bigint;
    }
  } else if (bitInfo === 0xc0) {
    privateKeyScalar = parsed[2] as bigint;
    pubX = 0n;
    pubY = 0n;
  } else {
    throw new Error(`Unknown key bitInfo: 0x${bitInfo.toString(16)}`);
  }

  if (privateKeyScalar === null) {
    throw new Error("Key does not contain a private key");
  }

  let ecPrivKey: crypto.KeyObject;
  let ecPubKey: crypto.KeyObject;

  if (pubX !== 0n || pubY !== 0n) {
    const dBuf = bigintToBuffer32(privateKeyScalar);
    const xBuf = bigintToBuffer32(pubX);
    const yBuf = bigintToBuffer32(pubY);

    const jwk = {
      kty: "EC",
      crv: "P-256",
      x: xBuf.toString("base64url"),
      y: yBuf.toString("base64url"),
      d: dBuf.toString("base64url"),
    };
    ecPrivKey = crypto.createPrivateKey({ key: jwk, format: "jwk" });
    ecPubKey = crypto.createPublicKey(ecPrivKey);
  } else {
    const privKeyBuf = bigintToBuffer32(privateKeyScalar);
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.setPrivateKey(privKeyBuf);
    const pub = ecdh.getPublicKey();
    const xBuf = pub.subarray(1, 33);
    const yBuf = pub.subarray(33, 65);
    const jwk = {
      kty: "EC",
      crv: "P-256",
      x: Buffer.from(xBuf).toString("base64url"),
      y: Buffer.from(yBuf).toString("base64url"),
      d: bigintToBuffer32(privateKeyScalar).toString("base64url"),
    };
    ecPrivKey = crypto.createPrivateKey({ key: jwk, format: "jwk" });
    ecPubKey = crypto.createPublicKey(ecPrivKey);
  }

  const pubKeyString = exportPublicKeyString(ecPubKey);
  const uid = sha1(Buffer.from(pubKeyString, "ascii")).toString("base64");

  return {
    privateKey: ecPrivKey,
    publicKey: ecPubKey,
    privateKeyBigInt: privateKeyScalar,
    publicKeyString: pubKeyString,
    keyOffset,
    uid,
  };
}

// Generate a new random TS3 identity
export function generateIdentity(securityLevel: number = 8): IdentityData {
  const { privateKey: ecPrivKey, publicKey: ecPubKey } =
    crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
  const jwk = ecPrivKey.export({ format: "jwk" }) as any;
  const privScalar = bufferToBigint(Buffer.from(jwk.d!, "base64url"));
  const pubKeyString = exportPublicKeyString(ecPubKey);
  const uid = sha1(Buffer.from(pubKeyString, "ascii")).toString("base64");

  const identity: IdentityData = {
    privateKey: ecPrivKey,
    publicKey: ecPubKey,
    privateKeyBigInt: privScalar,
    publicKeyString: pubKeyString,
    keyOffset: 0n,
    uid,
  };

  if (securityLevel > 0) {
    improveSecurity(identity, securityLevel);
  }

  return identity;
}

// Non-blocking identity generation using a Worker thread
export function generateIdentityAsync(securityLevel: number = 8): Promise<IdentityData> {
  return new Promise((resolve, reject) => {
    const workerPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "identity-worker.js"
    );
    const worker = new Worker(workerPath, {
      workerData: { securityLevel },
    });
    worker.on("message", (data) => {
      try {
        resolve(restoreIdentity(data));
      } catch (err) {
        reject(err);
      }
    });
    worker.on("error", reject);
    worker.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Identity worker exited with code ${code}`));
    });
  });
}

function improveSecurity(identity: IdentityData, toLevel: number): void {
  const pubKeyBytes = Buffer.from(identity.publicKeyString, "ascii");
  let offset = identity.keyOffset;
  let best = getSecurityLevel(pubKeyBytes, offset);

  for (let checked_ = offset; ; checked_++) {
    if (best >= toLevel) {
      identity.keyOffset = offset;
      return;
    }
    const curr = getSecurityLevel(pubKeyBytes, checked_);
    if (curr > best) {
      offset = checked_;
      best = curr;
    }
  }
}

function getSecurityLevel(pubKeyBytes: Buffer, offset: bigint): number {
  const offsetStr = offset.toString();
  const hashInput = Buffer.concat([
    pubKeyBytes,
    Buffer.from(offsetStr, "ascii"),
  ]);
  const hash = sha1(hashInput);
  return countLeadingZeroBits(hash);
}

function countLeadingZeroBits(data: Buffer): number {
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] === 0) {
      count += 8;
    } else {
      for (let bit = 0; bit < 8; bit++) {
        if ((data[i] & (1 << bit)) === 0) count++;
        else return count;
      }
    }
  }
  return count;
}

// Export public key in libtomcrypt ASN.1 format (for omega parameter)
export function exportPublicKeyString(pubKey: crypto.KeyObject): string {
  const spki = pubKey.export({ type: "spki", format: "der" });
  const buf = Buffer.from(spki);
  let pointIdx = -1;
  for (let i = buf.length - 65; i >= 0; i--) {
    if (buf[i] === 0x04 && buf.length - i >= 65) {
      pointIdx = i;
      break;
    }
  }
  if (pointIdx < 0) throw new Error("Cannot extract EC point from SPKI");

  const x = bufferToBigint(buf.subarray(pointIdx + 1, pointIdx + 33));
  const y = bufferToBigint(buf.subarray(pointIdx + 33, pointIdx + 65));

  const der = buildLtcPublicKeyDer(x, y);
  return der.toString("base64");
}

// ECDH shared secret (P-256) - returns x coordinate, SHA-1 hashed
export function getSharedSecret(
  privateKey: crypto.KeyObject,
  serverPublicKeyDer: Buffer
): Buffer {
  const parsed = parseDerSequence(serverPublicKeyDer);
  const x = parsed[2] as bigint;
  const y = parsed[3] as bigint;

  const pubPoint = Buffer.concat([
    Buffer.from([0x04]),
    bigintToBuffer32(x),
    bigintToBuffer32(y),
  ]);

  const jwk = privateKey.export({ format: "jwk" }) as any;
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.setPrivateKey(Buffer.from(jwk.d!, "base64url"));

  const shared = ecdh.computeSecret(pubPoint);
  let keyArr: Buffer;
  if (shared.length === 32) {
    keyArr = shared;
  } else if (shared.length > 32) {
    keyArr = shared.subarray(shared.length - 32);
  } else {
    keyArr = Buffer.alloc(32, 0);
    shared.copy(keyArr, 32 - shared.length);
  }
  return crypto.createHash("sha1").update(keyArr).digest();
}

// Simple DER parser for libtomcrypt key format
function parseDerSequence(data: Buffer): (number | bigint)[] {
  const results: (number | bigint)[] = [];
  let pos = 0;

  if (data[pos] !== 0x30) throw new Error("Expected SEQUENCE tag");
  pos++;
  const [seqLen, seqLenBytes] = readDerLength(data, pos);
  pos += seqLenBytes;
  const seqEnd = pos + seqLen;

  while (pos < seqEnd) {
    const tag = data[pos];
    pos++;
    const [len, lenBytes] = readDerLength(data, pos);
    pos += lenBytes;

    if (tag === 0x03) {
      const unusedBits = data[pos];
      const value = data[pos + 1];
      results.push(value);
    } else if (tag === 0x02) {
      const intBuf = data.subarray(pos, pos + len);
      results.push(bufferToBigint(intBuf));
    }
    pos += len;
  }

  return results;
}

function readDerLength(
  data: Buffer,
  pos: number
): [number, number] {
  if (data[pos] < 0x80) return [data[pos], 1];
  const numBytes = data[pos] & 0x7f;
  let len = 0;
  for (let i = 0; i < numBytes; i++) {
    len = (len << 8) | data[pos + 1 + i];
  }
  return [len, 1 + numBytes];
}

// Build libtomcrypt public key DER
function buildLtcPublicKeyDer(x: bigint, y: bigint): Buffer {
  const bitStr = Buffer.from([0x03, 0x02, 0x07, 0x00]);
  const int32 = buildDerBigInteger(32n);
  const intX = buildDerBigInteger(x);
  const intY = buildDerBigInteger(y);
  const content = Buffer.concat([bitStr, int32, intX, intY]);
  return Buffer.concat([
    Buffer.from([0x30]),
    buildDerLength(content.length),
    content,
  ]);
}

function buildDerBigInteger(value: bigint): Buffer {
  let hex = value.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let buf = Buffer.from(hex, "hex");
  if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]);
  return Buffer.concat([
    Buffer.from([0x02]),
    buildDerLength(buf.length),
    buf,
  ]);
}

function buildDerLength(len: number): Buffer {
  if (len < 0x80) return Buffer.from([len]);
  if (len < 0x100) return Buffer.from([0x81, len]);
  return Buffer.from([0x82, (len >> 8) & 0xff, len & 0xff]);
}

function bigintToBuffer32(n: bigint): Buffer {
  let hex = n.toString(16);
  if (hex.startsWith("-")) hex = hex.slice(1);
  while (hex.length < 64) hex = "0" + hex;
  if (hex.length > 64) hex = hex.slice(hex.length - 64);
  return Buffer.from(hex, "hex");
}

function bufferToBigint(buf: Buffer): bigint {
  if (buf.length === 0) return 0n;
  return BigInt("0x" + buf.toString("hex"));
}
