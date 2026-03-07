# M3U8 Video Streaming Implementation Guide

## Current Status
✅ **Completed:**
- Prisma schema updated with video fields
- VideoPipeline class created (`packages/backend/src/voice/audio/video-pipeline.ts`)
- VideoPipeline import added to VoiceBot
- 3 commits on feature/video-m3u8-streaming branch

⏳ **Remaining Tasks:**

## Task 1: Complete VoiceBot Video Methods

**File:** `packages/backend/src/voice/voice-bot.ts`

Add after the class declaration (around line 40) - add these private fields:

```typescript
// Video streaming state
private _isVideoStreaming: boolean = false;
private videoPipeline: VideoPipeline = new VideoPipeline();
private videoStreamConfig: VideoStreamOptions | null = null;
```

Add getter property after line 90 (after `get isStreaming()`):

```typescript
get isVideoStreaming(): boolean {
  return this._isVideoStreaming;
}
```

Add new method after `playStream()` method (after line 330):

```typescript
async playVideoStream(item: QueueItem, videoConfig: VideoStreamOptions): Promise<void> {
  if (this._status !== 'connected' && this._status !== 'playing' && this._status !== 'paused') {
    throw new Error('Bot is not connected');
  }
  if (!videoConfig.m3u8Url) {
    throw new Error('No M3U8 URL provided');
  }

  this.stopIcyPolling();
  this.stopPlayback();
  this._nowPlaying = item;
  this._isVideoStreaming = true;
  this._isStreaming = true;
  this._status = 'playing';
  this.videoStreamConfig = videoConfig;
  this.streamStartTime = Date.now();
  this.emit('statusChange', this._status);
  this.emit('nowPlaying', item);
  this.updateNowPlayingNickname(item.title);

  try {
    const stream = await this.videoPipeline.toVideoStream(videoConfig.m3u8Url, {
      videoCodec: videoConfig.videoCodec || 'h264',
      fps: videoConfig.fps || 30,
      quality: videoConfig.quality || 'auto',
    });
    
    this.streamKill = stream.kill;
    this.streamBuffer = Buffer.alloc(0);

    const epoch = ++this.loopEpoch;
    let framesSent = 0;
    const startTime = performance.now();

    stream.audioOut.on('data', (chunk: Buffer) => {
      if (epoch !== this.loopEpoch) return;
      this.streamBuffer = Buffer.concat([this.streamBuffer, chunk]);
    });

    stream.videoOut.on('data', (videoChunk: Buffer) => {
      if (epoch !== this.loopEpoch) return;
      this.client.sendVideo(videoChunk);
    });

    stream.process.on('close', () => {
      if (epoch !== this.loopEpoch) return;
      this.client.sendVoiceStop();
      this.client.sendVideoStop?.();
      this._isStreaming = false;
      this._isVideoStreaming = false;
      this.videoStreamConfig = null;
      this.streamKill = null;
      this._nowPlaying = null;
      this._status = 'connected';
      this.emit('statusChange', this._status);
      this.emit('trackEnd', item);
    });

    stream.process.on('error', (err) => {
      if (epoch !== this.loopEpoch) return;
      this._isStreaming = false;
      this._isVideoStreaming = false;
      this.videoStreamConfig = null;
      this.streamKill = null;
      this._status = 'error';
      this.emit('error', err);
      this.emit('statusChange', this._status);
    });

    const sendLoop = () => {
      if (epoch !== this.loopEpoch) return;
      const elapsed = performance.now() - startTime;
      const targetFrames = Math.floor(elapsed / FRAME_MS);

      while (framesSent < targetFrames && this.streamBuffer.length >= BYTES_PER_FRAME) {
        const frame = this.streamBuffer.subarray(0, BYTES_PER_FRAME);
        this.streamBuffer = this.streamBuffer.subarray(BYTES_PER_FRAME);
        const opusFrame = this.pipeline.encodeFrame(frame, this.config.volume);
        this.client.sendVoice(opusFrame);
        framesSent++;
      }

      this.playbackTimer = setTimeout(sendLoop, 5);
    };

    this.playbackTimer = setTimeout(sendLoop, 200);
  } catch (err) {
    this._isStreaming = false;
    this._isVideoStreaming = false;
    this.videoStreamConfig = null;
    this.streamKill = null;
    this._status = 'connected';
    this._nowPlaying = null;
    this.emit('statusChange', this._status);
    throw err;
  }
}
```

Update `stopPlayback()` method to include:

```typescript
this._isVideoStreaming = false;
this.videoStreamConfig = null;
```

## Task 2: Update TS3 Client for Video

**File:** `packages/backend/src/voice/tslib/ts3-client.ts`

Add these methods after `sendVoiceStop()`:

```typescript
/**
 * Send video frame data via TS6 video streaming protocol
 */
sendVideo(videoFrame: Buffer): void {
  if (!this.socket || !this.connected) return;
  
  const packetType = Buffer.alloc(2);
  packetType.writeUInt16BE(0x0003, 0); // Video packet type
  
  const codecId = Buffer.alloc(2);
  codecId.writeUInt16BE(0x0001, 0); // H.264 codec
  
  const frameSize = Buffer.alloc(4);
  frameSize.writeUInt32BE(videoFrame.length, 0);
  
  const packet = Buffer.concat([packetType, codecId, frameSize, videoFrame]);
  this.socket.write(packet);
}

/**
 * Stop video streaming
 */
sendVideoStop(): void {
  if (!this.socket || !this.connected) return;
  
  const packetType = Buffer.alloc(2);
  packetType.writeUInt16BE(0x0004, 0); // Video stop packet
  this.socket.write(packetType);
}
```

## Task 3: Update package.json

**File:** `packages/backend/package.json`

Ensure axios dependency exists:

```json
"dependencies": {
  "axios": "^1.6.0",
  // ... other deps
}
```

## Task 4: Run Prisma Migration

```bash
cd packages/backend
npx prisma migrate dev --name add_video_streaming_fields
```

## Task 5: Test Locally

1. Start the application
2. Create a bot with `supportsVideo: true`
3. Add a song/media with:
   - `isVideo: true`
   - `m3u8Url: "https://example.com/stream.m3u8"`
   - `videoQuality: "720p"`
   - `videoCodec: "h264"`
4. Play the video stream

## Frontend (Optional)

Add UI components for:
- M3U8 URL input field
- Video quality selector (auto, 360p, 480p, 720p, 1080p)
- Codec preference (H.264, VP9)
- Video streaming status indicator

## Next: Flow Runner Integration (Advanced)

After basic video streaming works, integrate with flow-runner to enable video playback from bot actions.

## Commits Made

- ✅ feat: Add M3U8 video streaming support to Prisma schema
- ✅ feat: Implement VideoPipeline class for M3U8 streaming  
- ✅ feat: Add VideoPipeline import to VoiceBot

## Branch

`feature/video-m3u8-streaming` - 3 commits ahead of main
