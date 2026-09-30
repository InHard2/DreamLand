// Renders a top-down map of generated terrain to PNG for tuning.
const fs = require('fs');
eval(fs.readFileSync(__dirname + '/../js/shared.js', 'utf8'));
const png = require('./png');
const S = DL_SHARED_FACTORY();
const seed = +(process.argv[2] || 12345);
const R = +(process.argv[3] || 8);
const out = process.argv[4] || '/tmp/claude-0/map.png';
const g = new S.Generator(seed);
const W = R * 2 * 16;
const img = Buffer.alloc(W * W * 3);
const col = { 1: [120,120,120], 2: [80,170,60], 3: [130,90,60], 8: [50,80,220], 12: [220,210,150], 13: [140,130,130], 7:[40,40,40], 10:[255,100,0], 4:[100,100,100]};
let t0 = Date.now(), n = 0, hist = {}, bio = {};
for (let cx = -R; cx < R; cx++) for (let cz = -R; cz < R; cz++) {
  const r = g.generate(cx, cz); n++;
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
    let y = 127; while (y > 0 && r.blocks[(y<<8)|(z<<4)|x] === 0) y--;
    const b = r.blocks[(y<<8)|(z<<4)|x];
    bio[r.biomes[(z<<4)|x]] = (bio[r.biomes[(z<<4)|x]]||0)+1;
    hist[Math.floor(y/8)*8] = (hist[Math.floor(y/8)*8]||0)+1;
    let c = col[b] || [255,0,255];
    if (b === 2 && r.biomes[(z<<4)|x] === 3) c = [230,240,255];
    if (b === 2 && r.biomes[(z<<4)|x] === 1) c = [40,130,40];
    const shade = 0.4 + (y - 40) / 90;
    const px = (cx + R) * 16 + x, pz = (cz + R) * 16 + z;
    const o = (pz * W + px) * 3;
    img[o] = Math.min(255, c[0]*shade); img[o+1] = Math.min(255, c[1]*shade); img[o+2] = Math.min(255, c[2]*shade);
  }
}
console.log('ms/chunk', ((Date.now()-t0)/n).toFixed(1));
console.log('heights', JSON.stringify(hist));
console.log('biomes', JSON.stringify(bio));
fs.writeFileSync(out, png(W, W, img));
