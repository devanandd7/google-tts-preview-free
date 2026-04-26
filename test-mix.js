const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const path = require('path');
const fs = require('fs');

// Path fix logic
let ffmpegPath = ffmpegStatic || "";
if (ffmpegPath.startsWith('\\ROOT') || ffmpegPath.startsWith('/ROOT')) {
  ffmpegPath = path.join(process.cwd(), ffmpegPath.replace(/^[\\\/]ROOT/, ''));
}
if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
  const localPath = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
  if (fs.existsSync(localPath)) ffmpegPath = localPath;
}
ffmpeg.setFfmpegPath(ffmpegPath);

const voicePath = "D:\\CrossEye startup\\Research and Development\\genbox - google tts\\google_tts_provider\\public\\genbox-prod-Devsheel & Sunidhi-1777224314839.wav";
const bgmUrl = "https://jvdbazjbqmrkytnacjsa.supabase.co/storage/v1/object/public/GenBox%201/bg_music/news_hindi_bg_2.mp3";
const outputPath = path.join(process.cwd(), 'public', 'test_mix_final.wav');

async function testMix() {
    console.log("Starting test mix...");
    
    // Download BGM
    const tempBgmPath = path.join(process.cwd(), 'public', 'temp_bgm', 'test_bgm.mp3');
    if (!fs.existsSync(path.dirname(tempBgmPath))) fs.mkdirSync(path.dirname(tempBgmPath), { recursive: true });
    
    console.log("Downloading BGM...");
    const response = await fetch(bgmUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempBgmPath, buffer);
    console.log("BGM Downloaded.");

    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(voicePath)
            .input(tempBgmPath)
            .inputOptions(['-stream_loop', '-1'])
            .complexFilter([
                {
                    filter: 'aresample', options: '44100',
                    inputs: '0:a', outputs: 'v_resampled'
                },
                {
                    filter: 'aformat', options: 'channel_layouts=stereo',
                    inputs: 'v_resampled', outputs: 'v_stereo'
                },
                {
                    filter: 'volume', options: '2.0',
                    inputs: 'v_stereo', outputs: 'v_boosted'
                },
                {
                    filter: 'asplit', options: '2',
                    inputs: 'v_boosted', outputs: ['v_for_sidechain', 'v_for_mix']
                },
                {
                    filter: 'aresample', options: '44100',
                    inputs: '1:a', outputs: 'b_resampled'
                },
                {
                    filter: 'aformat', options: 'channel_layouts=stereo',
                    inputs: 'b_resampled', outputs: 'b_stereo'
                },
                {
                    filter: 'volume', options: '1.2',
                    inputs: 'b_stereo', outputs: 'bgm_base'
                },
                {
                    filter: 'sidechaincompress', 
                    options: 'threshold=0.1:ratio=2.5:attack=10:release=500',
                    inputs: ['bgm_base', 'v_for_sidechain'], outputs: 'bg_ducked'
                },
                {
                    filter: 'amix', 
                    options: 'inputs=2:duration=first',
                    inputs: ['v_for_mix', 'bg_ducked']
                }
            ])
            .on('start', (cmd) => console.log('Spawned FFmpeg with command: ' + cmd))
            .on('error', (err, stdout, stderr) => {
                console.error('Error:', err.message);
                console.error('FFmpeg stderr:', stderr);
                reject(err);
            })
            .on('end', () => {
                console.log('Finished mixing! Output at:', outputPath);
                resolve();
            })
            .save(outputPath);
    });
}

testMix().catch(console.error);
