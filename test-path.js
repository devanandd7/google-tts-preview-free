console.log('process.cwd():', process.cwd());
const path = require('path');
const ffmpegPath = path.resolve(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg.exe');
console.log('ffmpegPath:', ffmpegPath);
const fs = require('fs');
console.log('Exists:', fs.existsSync(ffmpegPath));
