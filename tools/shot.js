// Headless test driver: node tools/shot.js <script-name>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const out = process.env.OUT || '/tmp/claude-0/shots';
require('fs').mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: +(process.env.W || 1280), height: +(process.env.H || 720) }, deviceScaleFactor: +(process.env.DPR || 1), hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
  const logs = [];
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning' || process.env.VERBOSE) logs.push('[' + t + '] ' + m.text()); });
  page.on('pageerror', e => logs.push('[pageerror] ' + e.message + '\n' + (e.stack || '').split('\n').slice(0, 4).join('\n')));
  await page.goto('http://127.0.0.1:8080/index.html');
  const steps = require(path.resolve(process.argv[2]));
  try { await steps(page, out, logs); } catch (e) { logs.push('[driver] ' + e.stack); }
  console.log(logs.join('\n'));
  await browser.close();
})();
