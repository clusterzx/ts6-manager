// TS3 Protocol Library (ported from DreamSpeak/TSLib)

export { Ts3Client } from './client.js';
export type { Ts3ClientOptions } from './client.js';
export { buildCommand, parseCommand, tsEscape, tsUnescape } from './commands.js';
export type { ParsedCommand } from './commands.js';
export { eaxEncrypt, eaxDecrypt, deriveKeyNonce, hashPassword, sha1, sha256, sha512 } from './crypto.js';
export { generateIdentity, generateIdentityAsync, restoreIdentity, fromTsIdentity, fromBase64Key, exportPublicKeyString, getSharedSecret } from './identity.js';
export type { IdentityData } from './identity.js';
export { parseLicense, deriveLicenseKey, generateTemporaryKey, getSharedSecret2 } from './license.js';
export { qlzDecompress } from './quicklz.js';
