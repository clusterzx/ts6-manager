import { spawn, type ChildProcess } from "child_process";
import type { Readable } from "stream";
import OpusScript from "opusscript";
import { validateUrl } from "../../utils/url-validator.js";

export const SAMPLE_RATE = 48000;
export const CHANNELS = 2;
export const FRAME_SIZE = 960; // 20ms at 48kHz
export const BYTES_PER_FRAME = FRAME_SIZE * CHANNELS * 2; // 16-bit = 2 bytes per sample
export const FRAME_MS = 20;
const BITRATE = 96000;

export class AudioPipeline {
  private encoder: OpusScript;
  private opusPeak = 0;
  private lastOpusPeakLog = 0;

  constructor() {
    this.encoder = new OpusScript(SAMPLE_RATE, CHANNELS, OpusScript.Application.AUDIO);
    this.encoder.setBitrate(BITRATE);
    // After this.encoder.setBitrate(BITRATE);

    const OPUS_SET_VBR = 4006;
    const OPUS_SET_VBR_CONSTRAINT = 4020;
    const OPUS_SET_SIGNAL = 4024;

    const OPUS_SIGNAL_MUSIC = 3002;

    // Hard CBR (reduces spikes)
    this.encoder.encoderCTL(OPUS_SET_VBR, 0);

    // (Optional; CBR ignores it, but harmless)
    this.encoder.encoderCTL(OPUS_SET_VBR_CONSTRAINT, 1);

    // Tell encoder it’s music (helps tuning)
    this.encoder.encoderCTL(OPUS_SET_SIGNAL, OPUS_SIGNAL_MUSIC);
  }

  /**
   * Convert audio file to raw PCM (48kHz, mono, s16le) at full volume.
   */
  toPcm(filePath: string): Promise<Buffer> {
    return this.ffmpegToPcm(filePath);
  }

  /**
   * Split raw PCM buffer into 960-sample frames.
   */
  splitFrames(pcmData: Buffer): Buffer[] {
    const frames: Buffer[] = [];
    for (let offset = 0; offset < pcmData.length; offset += BYTES_PER_FRAME) {
      let frame = pcmData.subarray(offset, offset + BYTES_PER_FRAME);
      if (frame.length < BYTES_PER_FRAME) {
        const padded = Buffer.alloc(BYTES_PER_FRAME, 0);
        frame.copy(padded);
        frame = padded;
      }
      frames.push(frame);
    }
    return frames;
  }

  /**
   * Encode a single PCM frame to Opus, applying volume scaling in real-time.
   */
  encodeFrame(pcmFrame: Buffer, volume: number): Buffer {
    let input = pcmFrame;
    if (volume !== 100) {
      const scaled = Buffer.alloc(pcmFrame.length);
      const factor = volume / 100;
      for (let i = 0; i < pcmFrame.length; i += 2) {
        const sample = pcmFrame.readInt16LE(i);
        const v = Math.round(sample * factor);
        scaled.writeInt16LE(Math.max(-32768, Math.min(32767, v)), i);
      }
      input = scaled;
    }
    const encoded = this.encoder.encode(input, FRAME_SIZE);
    const opusFrame = Buffer.isBuffer(encoded) ? encoded : Buffer.from(encoded);

    this.opusPeak = Math.max(this.opusPeak, opusFrame.length);

    //const now = Date.now();
    //if (now - this.lastOpusPeakLog > 1000) {
    //  console.log(`[voice] opus peak (1s): ${this.opusPeak} bytes`);
    //  this.opusPeak = 0;
    //  this.lastOpusPeakLog = now;
    //}

    return opusFrame;
  }

  /**
   * Stream audio from a URL to raw PCM (for live radio streams).
   * Returns a readable stdout stream + kill function. Does NOT buffer the entire stream.
   */
  async toPcmStream(url: string): Promise<{ stdout: Readable; process: ChildProcess; kill: () => void }> {
    // C4: Validate URL before passing to ffmpeg
    const urlCheck = await validateUrl(url, { allowedProtocols: ['http:', 'https:'] });
    if (!urlCheck.valid) {
      throw new Error(`Stream URL blocked: ${urlCheck.error}`);
    }

    const args = [
      "-reconnect", "1",
      "-reconnect_streamed", "1",
      "-reconnect_delay_max", "5",
      "-i", url,
      "-f", "s16le",
      "-acodec", "pcm_s16le",
      "-ar", String(SAMPLE_RATE),
      "-ac", String(CHANNELS),
      "-loglevel", "error",
      "pipe:1",
    ];

    const ffmpeg = spawn("ffmpeg", args, { shell: false });
    return {
      stdout: ffmpeg.stdout,
      process: ffmpeg,
      kill: () => {
        try { ffmpeg.kill("SIGKILL"); } catch { }
      },
    };
  }

  private ffmpegToPcm(input: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const args = [
        "-i", input,
        "-f", "s16le",
        "-acodec", "pcm_s16le",
        "-ar", String(SAMPLE_RATE),
        "-ac", String(CHANNELS),
        "-loglevel", "error",
        "pipe:1",
      ];

      const ffmpeg = spawn("ffmpeg", args, { shell: false });
      const chunks: Buffer[] = [];

      ffmpeg.stdout.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

      ffmpeg.stderr.on("data", () => { });

      ffmpeg.on("close", (code) => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`FFmpeg exited with code ${code}`));
        }
      });

      ffmpeg.on("error", (err) => {
        reject(new Error(`FFmpeg not found or failed to start: ${err.message}`));
      });
    });
  }
}
