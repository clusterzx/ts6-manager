import * as dgram from "dgram";
import * as crypto from "crypto";
import { EventEmitter } from "events";
import {
  eaxEncrypt,
  eaxDecrypt,
  sha1,
  sha512,
  xorInto,
  deriveKeyNonce,
  ecdsaSign,
  MAC_LEN,
  INIT_MAC,
  DUMMY_KEY,
  DUMMY_NONCE,
  INIT_VERSION,
  hashPassword,
} from "./crypto.js";
import {
  IdentityData,
  exportPublicKeyString,
  getSharedSecret,
} from "./identity.js";
import {
  parseLicense,
  deriveLicenseKey,
  getSharedSecret2,
  generateTemporaryKey,
} from "./license.js";
import { buildCommand, parseCommand, type ParsedCommand } from "./commands.js";
import { qlzDecompress } from "./quicklz.js";

// Packet types
export const enum PacketType {
  Voice = 0,
  VoiceWhisper = 1,
  Command = 2,
  CommandLow = 3,
  Ping = 4,
  Pong = 5,
  Ack = 6,
  AckLow = 7,
  Init1 = 8,
}

// Packet flags
const FLAG_FRAGMENTED = 0x10;
const FLAG_NEWPROTOCOL = 0x20;
const FLAG_COMPRESSED = 0x40;
const FLAG_UNENCRYPTED = 0x80;

// Header sizes (excluding MAC)
const C2S_HEADER_LEN = 5; // PId(2) + CId(2) + PT(1)
const S2C_HEADER_LEN = 3; // PId(2) + PT(1)
const MAX_PACKET_SIZE = 500;
const MAX_OUT_CONTENT = MAX_PACKET_SIZE - MAC_LEN - C2S_HEADER_LEN;

// Version sign - TS3AudioBot default (Linux 3.?.? far-future build)
const VERSION_SIGN = {
  platform: "Linux",
  version: "3.?.? [Build: 5680278000]",
  sign: "Hjd+N58Gv3ENhoKmGYy2bNRBsNNgm5kpiaQWxOj5HN2DXttG6REjymSwJtpJ8muC2gSwRuZi0R+8Laan5ts5CQ==",
};

interface ResendPacket {
  raw: Buffer;
  packetId: number;
  firstSend: number;
  lastSend: number;
}

export interface Ts3ClientOptions {
  host: string;
  port: number;
  identity: IdentityData;
  nickname: string;
  serverPassword?: string;
  defaultChannel?: string;
  channelPassword?: string;
}

type ClientState =
  | "disconnected"
  | "init"
  | "handshake"
  | "connected"
  | "disconnecting";

export class Ts3Client extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private state: ClientState = "disconnected";
  private opts!: Ts3ClientOptions;

  // Packet counters (one per packet type for outgoing)
  private packetCounter = new Uint16Array(9);
  private generationCounter = new Uint32Array(9);
  // Incoming generation tracking
  private inGenerationCounter = new Uint32Array(9);

  // Resend tracking
  private resendMap = new Map<number, ResendPacket>(); // packetId -> ResendPacket
  private initResend: ResendPacket | null = null;
  private resendTimer: ReturnType<typeof setInterval> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageTime = Date.now();

  // Crypto state
  private cryptoInitComplete = false;
  private ivStruct: Buffer | null = null;
  private fakeSignature = Buffer.alloc(MAC_LEN, 0);
  private keyNonceCache = new Map<number, { key: Buffer; nonce: Buffer; gen: number }>();
  private alphaTmp: Buffer | null = null;

  // Client ID assigned by server
  private clientId = 0;

  // Fragment reassembly
  private fragmentBuffer: Buffer[] = [];
  private fragmenting = false;
  private fragmentFlags = 0;

  // Channel map (populated during init sequence for auto-move)
  private channelMap = new Map<string, number>(); // channel_name → cid

  constructor() {
    super();
  }

  getState(): ClientState {
    return this.state;
  }

  getClientId(): number {
    return this.clientId;
  }

  async connect(opts: Ts3ClientOptions): Promise<void> {
    this.opts = opts;
    this.state = "init";
    this.cryptoInitComplete = false;
    this.ivStruct = null;
    this.fakeSignature.fill(0);
    this.keyNonceCache.clear();
    this.resendMap.clear();
    this.initResend = null;
    this.packetCounter.fill(0);
    this.generationCounter.fill(0);
    this.inGenerationCounter.fill(0);
    this.fragmentBuffer = [];
    this.fragmenting = false;
    this.fragmentFlags = 0;
    this.clientId = 0;
    this.channelMap.clear();

    return new Promise((resolve, reject) => {
      this.socket = dgram.createSocket("udp4");

      this.socket.on("message", (msg) => {
        try {
          this.handleIncomingPacket(msg);
        } catch (e) {
          this.emit("error", e);
        }
      });

      this.socket.on("error", (err) => {
        this.emit("error", err);
        reject(err);
      });

      this.socket.bind(0, () => {
        this.lastMessageTime = Date.now();

        // Start resend timer (100ms interval)
        this.resendTimer = setInterval(() => this.resendLoop(), 100);
        // Ping timer starts after connection
        this.pingTimer = null;

        // Increment command counter without actually sending (old clientinitiv behavior)
        this.incPacketCounter(PacketType.Command);

        // Send Init0
        const init0 = this.buildInit0();
        this.sendInitPacket(init0);

        // Set up connect timeout
        const timeout = setTimeout(() => {
          if (this.state !== "connected") {
            reject(new Error("Connection timeout"));
            this.disconnect();
          }
        }, 15000);

        this.once("connected", () => {
          clearTimeout(timeout);
          resolve();
        });

        this.once("error", (err) => {
          clearTimeout(timeout);
          reject(err);
        });
      });
    });
  }

  disconnect(): void {
    if (this.state === "connected") {
      this.state = "disconnecting";
      const cmd = buildCommand("clientdisconnect", {
        reasonid: 8,
        reasonmsg: "leaving",
      });
      this.sendCommand(cmd);
    }
    setTimeout(() => this.cleanup(), 500);
  }

  private cleanup(): void {
    this.state = "disconnected";
    if (this.resendTimer) clearInterval(this.resendTimer);
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.resendTimer = null;
    this.pingTimer = null;
    this.socket?.close();
    this.socket = null;
    this.emit("disconnected");
  }

  // Send voice data (already Opus-encoded)
  sendVoice(opusData: Buffer): void {
    if (this.state !== "connected") return;
    const voiceBuf = Buffer.alloc(3 + opusData.length);
    voiceBuf[2] = 5; // Opus Music
    opusData.copy(voiceBuf, 3);
    this.sendOutgoing(voiceBuf, PacketType.Voice);
  }

  // Send end-of-voice marker
  sendVoiceStop(): void {
    if (this.state !== "connected") return;
    const voiceBuf = Buffer.alloc(3);
    voiceBuf[2] = 5; // Opus Music
    this.sendOutgoing(voiceBuf, PacketType.Voice);
  }

  sendCommand(cmd: string): void {
    this.sendOutgoing(Buffer.from(cmd, "utf-8"), PacketType.Command);
  }

  // ====== Packet Building & Sending ======

  private buildInit0(): Buffer {
    const buf = Buffer.alloc(4 + 1 + 4 + 4 + 8); // version(4) + step(1) + timestamp(4) + random(4) + reserved(8)
    buf.writeUInt32BE(INIT_VERSION, 0);
    buf[4] = 0x00; // step 0
    buf.writeUInt32BE(Math.floor(Date.now() / 1000), 5);
    crypto.randomFillSync(buf, 9, 4);
    return buf;
  }

  private sendInitPacket(data: Buffer): void {
    const raw = this.buildRawPacket(data, PacketType.Init1, 101, 0, FLAG_UNENCRYPTED);
    // Use fixed MAC for init packets
    INIT_MAC.copy(raw, 0, 0, MAC_LEN);
    this.initResend = {
      raw,
      packetId: 101,
      firstSend: Date.now(),
      lastSend: Date.now(),
    };
    this.sendRaw(raw);
  }

  private sendOutgoing(
    data: Buffer,
    packetType: PacketType,
    extraFlags: number = 0
  ): void {
    const { id, gen } = this.getPacketCounter(packetType);
    this.incPacketCounter(packetType);

    let flags = extraFlags;

    switch (packetType) {
      case PacketType.Voice:
      case PacketType.VoiceWhisper:
        // Write the voice packet ID into the first 2 bytes of data
        data.writeUInt16BE(id, 0);
        break;
      case PacketType.Command:
      case PacketType.CommandLow:
        flags |= FLAG_NEWPROTOCOL;
        break;
      case PacketType.Ping:
        flags |= FLAG_UNENCRYPTED;
        break;
      case PacketType.Pong:
        flags |= FLAG_UNENCRYPTED;
        break;
      case PacketType.Ack:
      case PacketType.AckLow:
        break;
    }

    const raw = this.buildRawPacket(data, packetType, id, gen, flags);

    // Encrypt
    this.encryptPacket(raw, packetType, id, gen, flags, data);

    // Track for resend if needed
    if (
      packetType === PacketType.Command ||
      packetType === PacketType.CommandLow
    ) {
      this.resendMap.set(id, {
        raw,
        packetId: id,
        firstSend: Date.now(),
        lastSend: Date.now(),
      });
    }

    this.sendRaw(raw);
  }

  private buildRawPacket(
    data: Buffer,
    packetType: PacketType,
    packetId: number,
    _gen: number,
    flags: number
  ): Buffer {
    const raw = Buffer.alloc(MAC_LEN + C2S_HEADER_LEN + data.length);
    // Header at offset MAC_LEN: PId(2) + CId(2) + PT(1)
    raw.writeUInt16BE(packetId, MAC_LEN);
    raw.writeUInt16BE(this.clientId, MAC_LEN + 2);
    raw[MAC_LEN + 4] = (flags & 0xf0) | (packetType & 0x0f);
    // Copy data
    data.copy(raw, MAC_LEN + C2S_HEADER_LEN);
    return raw;
  }

  private encryptPacket(
    raw: Buffer,
    packetType: PacketType,
    packetId: number,
    gen: number,
    flags: number,
    data: Buffer
  ): void {
    if (packetType === PacketType.Init1) {
      INIT_MAC.copy(raw, 0);
      return;
    }

    if (flags & FLAG_UNENCRYPTED) {
      this.fakeSignature.copy(raw, 0, 0, MAC_LEN);
      return;
    }

    // Get key/nonce
    const useDummy = !this.cryptoInitComplete;
    let key: Buffer, nonce: Buffer;
    if (useDummy) {
      key = DUMMY_KEY;
      nonce = DUMMY_NONCE;
    } else {
      ({ key, nonce } = this.getKeyNonce(false, packetId, gen, packetType));
      if (packetId <= 3) {
        this.emit("debug", `[ENCRYPT] ptype=${packetType} pid=${packetId} gen=${gen} key=${key.toString("hex")} nonce=${nonce.toString("hex")}`);
      }
    }

    // Header for associated data
    const header = raw.subarray(MAC_LEN, MAC_LEN + C2S_HEADER_LEN);
    const { ciphertext, mac } = eaxEncrypt(key, nonce, header, data, MAC_LEN);

    // Write MAC and ciphertext
    mac.copy(raw, 0);
    ciphertext.copy(raw, MAC_LEN + C2S_HEADER_LEN);
  }

  private decryptPacket(
    raw: Buffer,
    packetType: PacketType,
    packetId: number,
    gen: number,
    flags: number
  ): Buffer | null {
    if (packetType === PacketType.Init1) {
      // Verify init MAC
      if (!INIT_MAC.equals(raw.subarray(0, MAC_LEN))) return null;
      return raw.subarray(MAC_LEN + S2C_HEADER_LEN);
    }

    if (flags & FLAG_UNENCRYPTED) {
      // Verify fake signature
      if (this.cryptoInitComplete) {
        if (!this.fakeSignature.equals(raw.subarray(0, MAC_LEN))) return null;
      }
      return raw.subarray(MAC_LEN + S2C_HEADER_LEN);
    }

    // Try current key mode first
    const result = this.tryDecrypt(raw, packetType, packetId, gen, false);
    if (result) return result;

    // Always try the other key mode as fallback
    const fallback = this.tryDecrypt(raw, packetType, packetId, gen, true);
    if (fallback) {
      this.emit("debug", `Decrypted type=${packetType} id=${packetId} with ${this.cryptoInitComplete ? "DUMMY" : "REAL"} key (fallback)`);
      return fallback;
    }

    return null;
  }

  private tryDecrypt(
    raw: Buffer,
    packetType: PacketType,
    packetId: number,
    gen: number,
    forceDummy: boolean
  ): Buffer | null {
    const useDummy = forceDummy || !this.cryptoInitComplete;
    let key: Buffer, nonce: Buffer;
    if (useDummy) {
      key = DUMMY_KEY;
      nonce = DUMMY_NONCE;
    } else {
      ({ key, nonce } = this.getKeyNonce(true, packetId, gen, packetType));
    }

    const header = raw.subarray(MAC_LEN, MAC_LEN + S2C_HEADER_LEN);
    const mac = raw.subarray(0, MAC_LEN);
    const ciphertext = raw.subarray(MAC_LEN + S2C_HEADER_LEN);

    return eaxDecrypt(key, nonce, header, ciphertext, mac, MAC_LEN);
  }

  private getKeyNonce(
    fromServer: boolean,
    packetId: number,
    gen: number,
    packetType: PacketType
  ): { key: Buffer; nonce: Buffer } {
    if (!this.ivStruct) {
      return { key: DUMMY_KEY, nonce: DUMMY_NONCE };
    }
    return deriveKeyNonce(fromServer, packetId, gen, packetType, this.ivStruct);
  }

  private getPacketCounter(
    packetType: PacketType
  ): { id: number; gen: number } {
    if (packetType === PacketType.Init1) return { id: 101, gen: 0 };
    return {
      id: this.packetCounter[packetType],
      gen: this.generationCounter[packetType],
    };
  }

  private incPacketCounter(packetType: PacketType): void {
    if (packetType === PacketType.Init1) return;
    this.packetCounter[packetType]++;
    if (this.packetCounter[packetType] === 0) {
      this.generationCounter[packetType]++;
    }
  }

  private sendRaw(raw: Buffer): void {
    if (!this.socket || this.state === "disconnected") return;
    const ptByte = raw[MAC_LEN + 4]; // C2S header: MAC(8) + PId(2) + CId(2) + PT(1)
    const ptype = ptByte & 0x0f;
    const pflags = ptByte & 0xf0;
    const pid = raw.readUInt16BE(MAC_LEN);
    this.emit("debug", `[OUT] type=${ptype} id=${pid} flags=0x${pflags.toString(16)} len=${raw.length}`);
    this.socket.send(raw, this.opts.port, this.opts.host);
  }

  // ====== Incoming Packet Handling ======

  private handleIncomingPacket(raw: Buffer): void {
    if (raw.length < MAC_LEN + S2C_HEADER_LEN) return;

    // Parse S2C header: MAC(8) + PId(2) + PT(1)
    const packetId = raw.readUInt16BE(MAC_LEN);
    const ptByte = raw[MAC_LEN + 2];
    const packetType = (ptByte & 0x0f) as PacketType;
    const flags = ptByte & 0xf0;

    this.lastMessageTime = Date.now();

    // Decrypt
    const gen = this.inGenerationCounter[packetType] || 0;
    const data = this.decryptPacket(raw, packetType, packetId, gen, flags);
    if (!data) {
      this.emit("debug", `Failed to decrypt packet type=${packetType} id=${packetId}`);
      return;
    }

    switch (packetType) {
      case PacketType.Init1:
        this.handleInit(data);
        break;
      case PacketType.Command:
      case PacketType.CommandLow:
        this.sendAck(packetId, packetType === PacketType.Command ? PacketType.Ack : PacketType.AckLow);
        this.handleCommandData(data, flags);
        break;
      case PacketType.Ack:
        this.handleAck(data);
        break;
      case PacketType.Ping:
        this.handlePing(packetId);
        break;
      case PacketType.Pong:
        // Pong received, good
        break;
      case PacketType.Voice:
      case PacketType.VoiceWhisper:
        this.emit("voice", data);
        break;
    }
  }

  private sendAck(ackId: number, ackType: PacketType): void {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(ackId);
    this.sendOutgoing(buf, ackType);
  }

  private handlePing(packetId: number): void {
    const buf = Buffer.alloc(2);
    buf.writeUInt16BE(packetId);
    this.sendOutgoing(buf, PacketType.Pong);
  }

  private handleAck(data: Buffer): void {
    if (data.length < 2) return;
    const ackedId = data.readUInt16BE(0);
    this.emit("debug", `ACK received for our packet id=${ackedId}`);
    this.resendMap.delete(ackedId);
  }

  // ====== Init Handshake ======

  private handleInit(data: Buffer): void {
    if (data.length < 1) return;
    const step = data[0];

    this.emit("debug", `Init step ${step} received (${data.length} bytes)`);

    switch (step) {
      case 1: {
        // Server response to Init0
        if (data.length < 21) {
          this.emit("debug", "Init1 too short");
          return;
        }
        // Build Init2: version(4) + step(1) + serverData(16) + reversedRandom(4)
        const init2 = Buffer.alloc(4 + 1 + 16 + 4);
        init2.writeUInt32BE(INIT_VERSION, 0);
        init2[4] = 0x02; // step 2
        data.subarray(1, 21).copy(init2, 5);
        this.initResend = null;
        this.sendInitPacket(init2);
        break;
      }

      case 3: {
        // Server RSA puzzle
        if (data.length < 1 + 64 + 64 + 4 + 100) {
          this.emit("debug", "Init3 too short");
          return;
        }

        this.state = "handshake";
        this.initResend = null;

        const x = data.subarray(1, 65);
        const n = data.subarray(65, 129);
        const level = data.readInt32BE(129);
        const serverData = data.subarray(133, 233);

        this.emit("debug", `RSA puzzle level=${level}`);

        // Solve RSA puzzle: y = x^(2^level) mod n
        const xBig = BigInt("0x" + x.toString("hex"));
        const nBig = BigInt("0x" + n.toString("hex"));
        const exp = 1n << BigInt(level); // 2^level
        const yBig = modPow(xBig, exp, nBig);

        let yHex = yBig.toString(16);
        while (yHex.length < 128) yHex = "0" + yHex;
        const y = Buffer.from(yHex, "hex");

        // Generate alpha (10 random bytes)
        this.alphaTmp = crypto.randomBytes(10);
        const alpha = this.alphaTmp.toString("base64");
        const omega = this.opts.identity.publicKeyString;

        const initAdd = buildCommand("clientinitiv", {
          alpha,
          omega,
          ot: 1,
          ip: "",
        });
        const textBytes = Buffer.from(initAdd, "utf-8");

        // Build Init4
        const init4 = Buffer.alloc(
          4 + 1 + 64 + 64 + 4 + 100 + 64 + textBytes.length
        );
        init4.writeUInt32BE(INIT_VERSION, 0);
        init4[4] = 0x04; // step 4
        x.copy(init4, 5);
        n.copy(init4, 69);
        init4.writeInt32BE(level, 133);
        serverData.copy(init4, 137);
        y.copy(init4, 237);
        textBytes.copy(init4, 301);

        this.sendInitPacket(init4);
        break;
      }

      case 0x7f: {
        // Server wants us to restart
        this.emit("debug", "Server requested restart, sending Init0 again");
        this.initResend = null;
        const init0 = this.buildInit0();
        this.sendInitPacket(init0);
        break;
      }
    }
  }

  private handleCommandData(data: Buffer, flags: number): void {
    // Handle fragmented packets
    if (flags & FLAG_FRAGMENTED) {
      if (!this.fragmenting) {
        // Start of fragment
        this.fragmenting = true;
        this.fragmentFlags = flags;
        this.fragmentBuffer = [Buffer.from(data)];
      } else {
        // End of fragment
        this.fragmentBuffer.push(Buffer.from(data));
        const merged = Buffer.concat(this.fragmentBuffer);
        const savedFlags = this.fragmentFlags;
        this.fragmenting = false;
        this.fragmentFlags = 0;
        this.fragmentBuffer = [];
        this.processCommand(merged, savedFlags);
      }
      return;
    }

    if (this.fragmenting) {
      // Middle fragment
      this.fragmentBuffer.push(Buffer.from(data));
      return;
    }

    this.processCommand(data, flags);
  }

  private processCommand(data: Buffer, flags: number = 0): void {
    // Decompress if needed
    if (flags & FLAG_COMPRESSED) {
      try {
        data = qlzDecompress(data);
      } catch (e: any) {
        this.emit("debug", `Decompression failed: ${e.message}`);
        return;
      }
    }

    const cmdStr = data.toString("utf-8");
    this.emit("debug", `[CMD IN] ${cmdStr.substring(0, 200)}`);

    const parsed = parseCommand(cmdStr);
    this.emit("command", parsed);

    switch (parsed.name) {
      case "initivexpand":
        this.handleInitIvExpand(parsed.params);
        break;
      case "initivexpand2":
        this.handleInitIvExpand2(parsed.params);
        break;
      case "initserver":
        this.handleInitServer(parsed.params);
        break;
      case "channellist":
        this.handleChannelList(parsed);
        break;
      case "channellistfinished":
        this.handleChannelListFinished();
        break;
      case "notifyclientleftview":
        if (
          parsed.params.clid &&
          parseInt(parsed.params.clid) === this.clientId
        ) {
          this.cleanup();
        }
        break;
      case "notifytextmessage":
        this.emit("textMessage", parsed.params);
        break;
      case "error":
        this.emit("ts3error", parsed.params);
        break;
    }
  }

  // ====== Crypto Init (Old Protocol - initivexpand) ======

  private handleInitIvExpand(params: Record<string, string>): void {
    this.initResend = null;
    this.emit("debug", "Processing initivexpand (old protocol)");

    const { alpha, beta, omega } = params;
    if (!alpha || !beta || !omega) {
      this.emit("error", new Error("Missing initivexpand parameters"));
      return;
    }

    const alphaBytes = Buffer.from(alpha, "base64");
    const betaBytes = Buffer.from(beta, "base64");
    const omegaBytes = Buffer.from(omega, "base64");

    const sharedKey = getSharedSecret(this.opts.identity.privateKey, omegaBytes);

    this.ivStruct = Buffer.alloc(10 + betaBytes.length);
    xorInto(this.ivStruct, sharedKey, 10);
    xorInto(this.ivStruct, Buffer.from(this.alphaTmp!), 10);
    const betaPart = this.ivStruct.subarray(10);
    for (let i = 0; i < betaBytes.length; i++) {
      betaPart[i] = sharedKey[10 + i] ^ betaBytes[i];
    }

    const sig = sha1(this.ivStruct);
    sig.copy(this.fakeSignature, 0, 0, MAC_LEN);

    this.cryptoInitComplete = true;
    this.alphaTmp = null;

    this.sendClientInit();
  }

  // ====== Crypto Init (New Protocol - initivexpand2) ======

  private async handleInitIvExpand2(params: Record<string, string>): Promise<void> {
    if (this.cryptoInitComplete || !this.alphaTmp) {
      this.emit("debug", "Ignoring duplicate initivexpand2");
      return;
    }
    this.initResend = null;
    this.emit("debug", "Processing initivexpand2 (new protocol)");

    const { l: license, beta, omega, proof } = params;
    if (!license || !beta || !omega) {
      this.emit("error", new Error("Missing initivexpand2 parameters"));
      return;
    }

    const betaBytes = Buffer.from(beta, "base64");
    const licenseBytes = Buffer.from(license, "base64");

    this.emit("debug", "Skipping proof verification");

    try {
      this.emit("debug", `License bytes (${licenseBytes.length}): ${licenseBytes.toString("hex").substring(0, 64)}...`);
      const blocks = parseLicense(licenseBytes);
      this.emit("debug", `Parsed ${blocks.length} license blocks`);
      for (let i = 0; i < blocks.length; i++) {
        this.emit("debug", `  Block ${i}: type=${blocks[i].type} key=${blocks[i].key.toString("hex").substring(0, 16)}... hash=${blocks[i].hash.toString("hex").substring(0, 16)}...`);
      }
      const serverKey = await deriveLicenseKey(blocks);
      this.emit("debug", `Derived server key: ${serverKey.toString("hex")}`);

      const { publicKey: tempPub, privateKey: tempPriv } = await generateTemporaryKey();

      const ekBase64 = tempPub.toString("base64");
      const toSign = Buffer.concat([tempPub, betaBytes]);
      const signBuf = crypto.sign("SHA256", toSign, this.opts.identity.privateKey);
      const proofBase64 = signBuf.toString("base64");
      const clientEkCmd = buildCommand("clientek", {
        ek: ekBase64,
        proof: proofBase64,
      });
      this.emit("debug", `Sending clientek (${clientEkCmd.length} chars): ${clientEkCmd.substring(0, 100)}...`);
      this.sendCommand(clientEkCmd);

      const sharedData = await getSharedSecret2(serverKey, tempPriv);
      this.emit("debug", `SharedSecret2 first16: ${sharedData.subarray(0, 16).toString("hex")}`);

      this.ivStruct = Buffer.from(sharedData);
      this.emit("debug", `Alpha: ${this.alphaTmp!.toString("hex")}`);
      this.emit("debug", `Beta (${betaBytes.length}): ${betaBytes.subarray(0, 16).toString("hex")}...`);
      xorInto(this.ivStruct, this.alphaTmp!, 10);
      xorInto(this.ivStruct.subarray(10), betaBytes, betaBytes.length);

      this.emit("debug", `ivStruct first16: ${this.ivStruct.subarray(0, 16).toString("hex")}`);

      const sig = sha1(this.ivStruct);
      sig.copy(this.fakeSignature, 0, 0, MAC_LEN);
      this.emit("debug", `FakeSignature: ${this.fakeSignature.toString("hex")}`);

      this.cryptoInitComplete = true;
      this.alphaTmp = null;

      this.sendClientInit();
    } catch (e) {
      this.emit("error", e);
    }
  }

  // ====== Post-Handshake ======

  private sendClientInit(): void {
    this.emit("debug", "Sending clientinit");

    const identity = this.opts.identity;
    const cmd = buildCommand("clientinit", {
      client_nickname: this.opts.nickname,
      client_version: VERSION_SIGN.version,
      client_platform: VERSION_SIGN.platform,
      client_input_hardware: 1,
      client_output_hardware: 1,
      client_default_channel: this.opts.defaultChannel || "",
      client_default_channel_password: this.opts.channelPassword
        ? hashPassword(this.opts.channelPassword)
        : "",
      client_server_password: this.opts.serverPassword
        ? hashPassword(this.opts.serverPassword)
        : "",
      client_meta_data: "",
      client_version_sign: VERSION_SIGN.sign,
      client_key_offset: identity.keyOffset.toString(),
      client_nickname_phonetic: "",
      client_default_token: "",
      hwid: "",
    });

    this.sendCommand(cmd);
  }

  private handleInitServer(params: Record<string, string>): void {
    this.clientId = parseInt(params.aclid) || 0;
    this.emit("debug", `Connected! ClientId=${this.clientId}`);

    this.state = "connected";

    // Start ping timer (every 1 second)
    this.pingTimer = setInterval(() => {
      if (this.state === "connected") {
        this.sendOutgoing(Buffer.alloc(0), PacketType.Ping);
      }
    }, 1000);

    this.emit("connected");
  }

  private handleChannelList(parsed: ParsedCommand): void {
    // Each channellist message may contain one or multiple channel entries (pipe-separated)
    const entries = parsed.groups ?? [parsed.params];
    for (const entry of entries) {
      const cid = parseInt(entry.cid);
      const name = entry.channel_name;
      if (cid && name) {
        this.channelMap.set(name, cid);
      }
    }
    this.emit("debug", `channellist: +${entries.length} channels (total: ${this.channelMap.size})`);
  }

  private handleChannelListFinished(): void {
    this.emit("debug", `Channel list received: ${this.channelMap.size} channel(s)`);

    // Auto-move to defaultChannel if configured
    const target = this.opts.defaultChannel;
    if (!target || !this.clientId) return;

    // Support both channel ID (numeric) and channel name
    let cid: number | undefined;
    const asNum = parseInt(target);
    if (!isNaN(asNum) && String(asNum) === target) {
      // Numeric value → treat as channel ID directly
      cid = asNum;
    } else {
      // String value → look up by channel name
      cid = this.channelMap.get(target);
    }

    if (!cid) {
      this.emit("debug", `Default channel "${target}" not found`);
      return;
    }

    const moveCmd = buildCommand("clientmove", {
      cid,
      clid: this.clientId,
      cpw: this.opts.channelPassword ?? "",
    });
    this.emit("debug", `Moving to channel "${target}" (cid=${cid})`);
    this.sendCommand(moveCmd);
  }

  // ====== Resend Loop ======

  private resendLoop(): void {
    const now = Date.now();

    // Check init resend
    if (this.initResend) {
      if (now - this.initResend.firstSend > 30000) {
        this.emit("error", new Error("Init timeout"));
        this.cleanup();
        return;
      }
      if (now - this.initResend.lastSend > 1000) {
        this.initResend.lastSend = now;
        this.sendRaw(this.initResend.raw);
      }
    }

    // Check command resends
    for (const [id, pkt] of this.resendMap) {
      if (now - pkt.firstSend > 30000) {
        this.emit("error", new Error(`Packet ${id} timeout`));
        this.cleanup();
        return;
      }
      if (now - pkt.lastSend > 1000) {
        pkt.lastSend = now;
        this.sendRaw(pkt.raw);
      }
    }

    // Check overall timeout
    if (now - this.lastMessageTime > 30000) {
      this.emit("error", new Error("Connection timeout - no response"));
      this.cleanup();
    }
  }
}

// Modular exponentiation for RSA puzzle
function modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  if (mod === 1n) return 0n;
  let result = 1n;
  base = base % mod;
  while (exp > 0n) {
    if (exp & 1n) {
      result = (result * base) % mod;
    }
    exp >>= 1n;
    base = (base * base) % mod;
  }
  return result;
}
