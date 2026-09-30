// Contact sheet: node tools/sheet.js out.png cols img1 img2 ...
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [out, cols, ...imgs] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
  const data = imgs.map(f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  await p.setContent(`<body style="margin:0;background:#222"><div id=g style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:4px;width:1600px">${data.map((d, i) => `<div style="position:relative"><img src="${d}" style="width:100%;display:block"><span style="position:absolute;left:4px;top:2px;color:#ff0;font:14px monospace;background:#000a">${imgs[i].split('/').pop()}</span></div>`).join('')}</div></body>`);
  await p.waitForTimeout(300);
  const el = await p.$('#g');
  await el.screenshot({ path: out });
  await b.close();
})();
