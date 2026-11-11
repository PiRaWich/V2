const fs = require('fs');
fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www', { recursive: true });
fs.cpSync('src', 'www', { recursive: true });
fs.copyFileSync('node_modules/matter-js/build/matter.min.js', 'www/matter.min.js');
console.log('built -> www/');
