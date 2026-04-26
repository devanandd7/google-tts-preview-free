const fs = require('fs');
console.log('process.cwd():', process.cwd());
console.log('fs.realpathSync("."):', fs.realpathSync('.'));
console.log('__dirname:', __dirname);
