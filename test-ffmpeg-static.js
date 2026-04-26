const ffmpegStatic = require('ffmpeg-static');
console.log('ffmpegStatic path:', ffmpegStatic);
const fs = require('fs');
if (ffmpegStatic) {
    console.log('Exists:', fs.existsSync(ffmpegStatic));
} else {
    console.log('ffmpegStatic is null');
}
