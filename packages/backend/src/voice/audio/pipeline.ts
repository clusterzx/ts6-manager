import { spawn, type ChildProcess } from "child_process";
import type { Readable } from "stream";
import OpusScript from "opusscript";

export const SAMPLE_RATE = 48000;
export const CHANNELS = 1;
export const FRAME_SIZE = 960; // 20ms at 48kHz
export const BYTES_PER_FRAME = FRAME_SIZE * CHANNELS * 2; // 16-bit = 2 bytes per sample
export const FRAME_MS = 20;
const BITRATE = 96000;

export class AudioPipeline {
  private encoder: OpusScript;

  constructor() {
    this.encoder = new OpusScript(SAMPLE_RATE, CHANNELS, OpusScript.Application.AUDIO);
    this.encoder.setBitrate(BITRATE);
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
    return Buffer.from(this.encoder.encode(input, FRAME_SIZE));
  }

  /**
   * Stream audio from a URL to raw PCM (for live radio streams).
   * Returns a readable stdout stream + kill function. Does NOT buffer the entire stream.
   */
  toPcmStream(url: string): { stdout: Readable; process: ChildProcess; kill: () => void } {
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
        try { ffmpeg.kill("SIGKILL"); } catch {}
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

      ffmpeg.stderr.on("data", () => {});

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
