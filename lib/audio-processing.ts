import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { Readable, Writable } from 'stream';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { randomUUID } from 'crypto';

// Set the FFmpeg binary path - ensure it's a real absolute path
let ffmpegPath = ffmpegStatic || "";

// Turbopack / Next.js sometimes virtualize paths to \ROOT or /ROOT
if (ffmpegPath.startsWith('\\ROOT') || ffmpegPath.startsWith('/ROOT')) {
  ffmpegPath = path.join(process.cwd(), ffmpegPath.replace(/^[\\\/]ROOT/, ''));
}

// Fallback: if the path doesn't exist, try common locations
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  const exeName = os.platform() === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  const localPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', exeName);
  if (fs.existsSync(localPath)) {
    ffmpegPath = localPath;
  }
}

console.log(`[FFmpeg] Path: ${ffmpegPath}`);
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

/**
 * Normalizes voice audio to a consistent 100% volume peak.
 */
export const normalizeAudioBuffer = (inputBuffer: Buffer): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    const chunks: Buffer[] = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });

    ffmpeg(inputStream)
      .inputFormat('wav')
      // Normalization filter: 
      // p=1.0  : Target peak value (100% of max volume - completely consistent)
      // m=20   : Max gain factor (allow up to 20x amplification for very quiet parts)
      // s=5    : Compression factor
      .audioFilter('dynaudnorm=p=1.0:m=20:s=5')
      .toFormat('wav')
      .on('error', (err) => {
        console.error('[FFmpeg Audio Normalization Error]', err.message, 'Path used:', ffmpegPath);
        reject(err);
      })
      .on('end', () => {
        resolve(Buffer.concat(chunks));
      })
      .pipe(outputStream, { end: true });
  });
};

/**
 * Mixes background music into the voice audio.
 * The BGM will be looped if it's shorter than the voice, ducked in volume,
 * and perfectly cut to the exact length of the voice audio.
 */
export const mixBackgroundMusic = async (voiceBuffer: Buffer, bgmUrl: string): Promise<Buffer> => {
  let tempBgmPath = '';
  
  if (bgmUrl.startsWith('http')) {
    // Use a robust path for temp directory
    let baseDir = process.cwd();
    if (baseDir === '/ROOT' || baseDir === '\\ROOT') {
      baseDir = './'; // Fallback to relative
    }
    const tempDir = path.join(baseDir, 'public', 'temp_bgm');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    tempBgmPath = path.join(tempDir, `bgm_${randomUUID()}.mp3`);
    console.log(`[BGM] Downloading to: ${tempBgmPath}`);
    
    const res = await fetch(bgmUrl);
    if (!res.ok) throw new Error(`Failed to fetch BGM: ${res.statusText}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(tempBgmPath, buffer);
    console.log(`[BGM] Download complete. Size: ${buffer.length} bytes`);
  } else {
    tempBgmPath = bgmUrl;
  }

  return new Promise((resolve, reject) => {
    const voiceStream = new Readable();
    voiceStream.push(voiceBuffer);
    voiceStream.push(null);

    const chunks: Buffer[] = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });

    const cleanup = () => {
      if (bgmUrl.startsWith('http') && fs.existsSync(tempBgmPath)) {
        try { 
          // console.log(`[BGM] Cleaning up: ${tempBgmPath}`);
          fs.unlinkSync(tempBgmPath); 
        } catch(e) {}
      }
    };

    ffmpeg()
      .input(voiceStream)
      .inputFormat('wav')
      // Pass the local file path instead of HTTP URL to avoid stream breaking
      .input(tempBgmPath)
      .inputOptions(['-stream_loop', '-1'])
      .complexFilter([
        // Voice processing: Resample and boost
        {
          filter: 'aresample', options: '44100',
          inputs: '0:a', outputs: 'v_resampled'
        },
        {
          filter: 'aformat', options: 'channel_layouts=stereo',
          inputs: 'v_resampled', outputs: 'v_stereo'
        },
        {
          filter: 'volume', options: '2.5', // Boosted slightly more for authority
          inputs: 'v_stereo', outputs: 'v_boosted'
        },
        // Split voice so it can be used for both sidechain and final mix
        {
          filter: 'asplit', options: '2',
          inputs: 'v_boosted', outputs: ['v_for_sidechain', 'v_for_mix']
        },
        // BGM processing: Resample and set base volume
        {
          filter: 'aresample', options: '44100',
          inputs: '1:a', outputs: 'b_resampled'
        },
        {
          filter: 'aformat', options: 'channel_layouts=stereo',
          inputs: 'b_resampled', outputs: 'b_stereo'
        },
        {
          filter: 'volume', options: '0.4', // Lower base BGM volume to leave room for ducking
          inputs: 'b_stereo', outputs: 'bgm_base'
        },
        // Sidechain compression: Ducks BGM based on Voice activity
        {
          filter: 'sidechaincompress', 
          options: 'threshold=0.05:ratio=4:attack=10:release=700', // Faster duck, slower recovery for pro feel
          inputs: ['bgm_base', 'v_for_sidechain'], outputs: 'bg_ducked'
        },
        // Final Mix
        {
          filter: 'amix', 
          options: 'inputs=2:duration=first',
          inputs: ['v_for_mix', 'bg_ducked']
        }
      ])
      .toFormat('wav')
      .on('error', (err) => {
        cleanup();
        console.error('[FFmpeg BGM Mix Error]', err.message);
        reject(err);
      })
      .on('end', () => {
        cleanup();
        resolve(Buffer.concat(chunks));
      })
      .pipe(outputStream, { end: true });
  });
};

/**
 * Fixes TTS speed drift — the AI tends to rush toward the end.
 * atempo=0.93 slows the audio ~7% to match natural human speech pace,
 * without changing the pitch. This keeps voice speed consistent start-to-end.
 */
export const fixSpeechTempo = (inputBuffer: Buffer): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const inputStream = new Readable();
    inputStream.push(inputBuffer);
    inputStream.push(null);

    const chunks: Buffer[] = [];
    const outputStream = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      }
    });

    ffmpeg(inputStream)
      .inputFormat('wav')
      // atempo: 1.0 = normal speed, 0.93 = 7% slower (pitch unchanged)
      // This counteracts the model's tendency to accelerate at end-of-text
      .audioFilter('atempo=0.93')
      .toFormat('wav')
      .on('error', (err) => {
        console.error('[FFmpeg Speed Fix Error]', err.message);
        reject(err);
      })
      .on('end', () => {
        resolve(Buffer.concat(chunks));
      })
      .pipe(outputStream, { end: true });
  });
};

