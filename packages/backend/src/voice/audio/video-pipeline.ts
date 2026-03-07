import { spawn, type ChildProcess } from 'child_process';
import type { Readable } from 'stream';
import axios from 'axios';

// M3U8 parser - simple implementation for parsing HLS playlists
interface M3U8Playlist {
  playlists?: Array<{
    uri: string;
    attributes?: {
      RESOLUTION?: {
        height: number;
      };
    };
  }>;
}

export interface VideoStreamOptions {
  videoCodec: 'h264' | 'vp9';
  fps: number;
  quality: 'auto' | '1080p' | '720p' | '480p' | '360p';
}

export interface VideoStream {
  process: ChildProcess;
  audioOut: Readable;
  videoOut: Readable;
  kill: () => void;
}

/**
 * VideoPipeline handles M3U8 streaming and FFmpeg processing for video content
 */
export class VideoPipeline {
  /**
   * Parse M3U8 playlist and return the best quality stream URL
   */
  async parseM3U8(m3u8Url: string, preferredQuality: string): Promise<string> {
    try {
      const response = await axios.get(m3u8Url, { responseType: 'text' });
      const playlist = this.parsePlaylist(response.data);

      // Handle master playlist (with multiple quality variants)
      if (playlist.playlists && playlist.playlists.length > 0) {
        const playlists = playlist.playlists.sort((a, b) => {
          const heightA = a.attributes?.RESOLUTION?.height || 0;
          const heightB = b.attributes?.RESOLUTION?.height || 0;
          return heightB - heightA; // Sort descending by quality
        });

        // Select quality based on preference
        let selectedPlaylist = playlists[0]; // Default to highest
        if (preferredQuality !== 'auto') {
          const targetHeight = parseInt(preferredQuality);
          selectedPlaylist = playlists.find(
            (p) => p.attributes?.RESOLUTION?.height === targetHeight
          ) || playlists[0];
        }

        // Resolve relative URLs
        const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        return selectedPlaylist.uri.startsWith('http')
          ? selectedPlaylist.uri
          : baseUrl + selectedPlaylist.uri;
      }

      // Direct media playlist
      return m3u8Url;
    } catch (error) {
      console.error('Error parsing M3U8:', error);
      return m3u8Url;
    }
  }

  /**
   * Simple M3U8 playlist parser
   */
  private parsePlaylist(content: string): M3U8Playlist {
    const lines = content.split('\n');
    const playlists: M3U8Playlist['playlists'] = [];
    let currentAttrs = {};

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith('#EXT-X-STREAM-INF')) {
        // Parse stream info attributes
        const attrs = this.parseAttributes(line);
        if (attrs.RESOLUTION) {
          const [width, height] = attrs.RESOLUTION.split('x').map(Number);
          currentAttrs = {
            RESOLUTION: { height },
          };
        }
      } else if (line && !line.startsWith('#') && currentAttrs) {
        // Next line is the URI for this stream
        playlists.push({
          uri: line,
          attributes: currentAttrs as any,
        });
        currentAttrs = {};
      }
    }

    return { playlists };
  }

  /**
   * Parse M3U8 attributes (simplified)
   */
  private parseAttributes(line: string): Record<string, string> {
    const attrs: Record<string, string> = {};
    const matches = line.matchAll(/([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))/g);

    for (const match of matches) {
      const key = match[1];
      const value = match[2] || match[3];
      attrs[key] = value;
    }

    return attrs;
  }

  /**
   * Create FFmpeg process to handle M3U8 video stream with both audio and video outputs
   */
  async toVideoStream(
    m3u8Url: string,
    options: VideoStreamOptions
  ): Promise<VideoStream> {
    // Parse M3U8 to get the actual stream URL
    const streamUrl = await this.parseM3U8(m3u8Url, options.quality);

    const args = [
      '-i',
      streamUrl,
      '-protocol_whitelist',
      'file,http,https,tcp,tls,crypto',
      // Audio output (PCM for TeamSpeak voice)
      '-map',
      '0:a:0',
      '-f',
      's16le',
      '-ac',
      '1',
      '-ar',
      '48000',
      'pipe:1',
      // Video output (H.264 for TS6 video streaming)
      '-map',
      '0:v:0',
      '-c:v',
      options.videoCodec === 'vp9' ? 'libvpx-vp9' : 'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-r',
      String(options.fps),
      '-pix_fmt',
      'yuv420p',
      '-f',
      'rawvideo',
      'pipe:3', // Video output on fd 3
    ];

    const ffmpeg = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe', 'pipe'], // stdin, stdout (audio), stderr, pipe:3 (video)
    });

    let killed = false;
    const kill = () => {
      if (!killed) {
        killed = true;
        ffmpeg.kill('SIGKILL');
      }
    };

    return {
      process: ffmpeg,
      audioOut: ffmpeg.stdout as Readable,
      videoOut: ffmpeg.stdio[3] as Readable,
      kill,
    };
  }
}
