module.exports = async (page, out, logs) => {
  await page.waitForTimeout(1500);
  const urls = await page.evaluate(() => ['player', 'zombie', 'pig', 'creeper', 'skeleton', 'spider', 'cow', 'sheep', 'chicken'].map(k => { const c = DL.Models.skins[k]; const b = document.createElement('canvas'); b.width = c.width * 6; b.height = c.height * 6; const x = b.getContext('2d'); x.imageSmoothingEnabled = false; x.fillStyle = '#f0f'; x.fillRect(0, 0, b.width, b.height); x.drawImage(c, 0, 0, b.width, b.height); return b.toDataURL(); }));
  const fs = require('fs');
  urls.forEach((u, i) => fs.writeFileSync(out + '/skin' + i + '.png', Buffer.from(u.split(',')[1], 'base64')));
};
