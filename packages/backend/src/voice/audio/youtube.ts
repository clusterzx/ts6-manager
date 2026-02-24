import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export interface YouTubeInfo {
  id: string;
  title: string;
  artist: string;
  duration: number; // seconds
  thumbnail: string;
  url: string;
}

export interface YouTubeSearchResult {
  id: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
}

/**
 * Download audio from a YouTube URL using yt-dlp
 */
export function downloadYouTube(url: string, outputDir: string): Promise<{ filePath: string; info: YouTubeInfo }> {
  return new Promise((resolve, reject) => {
    const outputTemplate = path.join(outputDir, "%(id)s.%(ext)s");

    // First get info
    const infoProc = spawn("yt-dlp", [
      "--dump-json",
      "--no-playlist",
      url,
    ], { shell: false });

    let infoJson = "";
    let infoErr = "";
    infoProc.stdout.on("data", (chunk: Buffer) => {
      infoJson += chunk.toString();
    });
    infoProc.stderr.on("data", (chunk: Buffer) => {
      infoErr += chunk.toString();
    });

    infoProc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp info failed (code ${code}): ${infoErr.slice(0, 200)}`));
      }

      let parsed: any;
      try {
        parsed = JSON.parse(infoJson);
      } catch {
        return reject(new Error("Failed to parse yt-dlp output"));
      }

      const info: YouTubeInfo = {
        id: parsed.id,
        title: parsed.title || "Unknown",
        artist: parsed.uploader || parsed.channel || "Unknown",
        duration: parsed.duration || 0,
        thumbnail: parsed.thumbnail || "",
        url,
      };

      const expectedPath = path.join(outputDir, `${info.id}.opus`);

      // Check if already downloaded
      if (fs.existsSync(expectedPath)) {
        return resolve({ filePath: expectedPath, info });
      }

      // Download audio only
      const dlProc = spawn("yt-dlp", [
        "-x",                       // extract audio
        "--audio-format", "opus",   // opus format (native for TS3)
        "--audio-quality", "0",     // best quality
        "--no-playlist",
        "-o", outputTemplate,
        url,
      ], { shell: false });

      let dlErr = "";
      dlProc.stderr.on("data", (chunk: Buffer) => {
        dlErr += chunk.toString();
      });

      dlProc.on("close", (dlCode) => {
        if (dlCode !== 0) {
          return reject(new Error(`yt-dlp download failed (code ${dlCode}): ${dlErr.slice(0, 200)}`));
        }

        // yt-dlp may use different extensions, find the actual file
        const files = fs.readdirSync(outputDir).filter((f) => f.startsWith(info.id));
        if (files.length === 0) {
          return reject(new Error("Downloaded file not found"));
        }

        const filePath = path.join(outputDir, files[files.length - 1]);
        resolve({ filePath, info });
      });

      dlProc.on("error", (err) => {
        reject(new Error(`yt-dlp not found: ${err.message}`));
      });
    });

    infoProc.on("error", (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
}

/**
 * Get info about a YouTube URL (single video or playlist).
 * Returns type ('video' or 'playlist') and array of items.
 */
export function getYouTubeUrlInfo(url: string): Promise<{ type: 'video' | 'playlist'; items: YouTubeSearchResult[] }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", [
      "--dump-json",
      "--flat-playlist",
      "--no-download",
      url,
    ], { shell: false });

    let output = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp info failed (code ${code}): ${stderr.slice(0, 200)}`));
      }

      try {
        const lines = output.trim().split("\n").filter(Boolean);
        const items: YouTubeSearchResult[] = lines.map((line) => {
          const parsed = JSON.parse(line);
          return {
            id: parsed.id,
            title: parsed.title || "Unknown",
            artist: parsed.uploader || parsed.channel || "Unknown",
            duration: parsed.duration || 0,
            thumbnail: parsed.thumbnails?.[0]?.url || parsed.thumbnail || "",
          };
        });

        const type = items.length > 1 ? 'playlist' : 'video';
        resolve({ type, items });
      } catch {
        reject(new Error("Failed to parse yt-dlp output"));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
}

/**
 * Search YouTube using yt-dlp
 */
export function searchYouTube(query: string, maxResults: number = 10): Promise<YouTubeSearchResult[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", [
      `ytsearch${maxResults}:${query}`,
      "--dump-json",
      "--flat-playlist",
      "--no-download",
    ], { shell: false });

    let output = "";
    let stderr = "";
    proc.stdout.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp search failed (code ${code}): ${stderr.slice(0, 200)}`));
      }

      try {
        // yt-dlp outputs one JSON object per line
        const results = output
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => {
            const parsed = JSON.parse(line);
            return {
              id: parsed.id,
              title: parsed.title || "Unknown",
              artist: parsed.uploader || parsed.channel || "Unknown",
              duration: parsed.duration || 0,
              thumbnail: parsed.thumbnails?.[0]?.url || "",
            };
          });

        resolve(results);
      } catch {
        resolve([]);
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`yt-dlp not found: ${err.message}`));
    });
  });
}
