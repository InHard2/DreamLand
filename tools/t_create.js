module.exports = async (page, out, logs) => {
  await page.waitForTimeout(1500);
  const W = await page.evaluate(() => [DL.GUI.W, DL.GUI.H, DL.GUI.scale]);
  const click = async (gx, gy) => { await page.mouse.click(gx * W[2], gy * W[2]); await page.waitForTimeout(300); };
  // Singleplayer
  await click(W[0] / 2, W[1] / 4 + 48 + 10);
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/select.png' });
  const top = Math.max(30, W[1] / 6);
  await click(W[0] / 2, top + 10);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/create.png' });
  // type seed via direct field set
  await page.evaluate(() => { const s = DL.GUI.screen; if (s.seed) s.seed.value = process_seed(); function process_seed(){ return '1234'; } });
  await click(W[0] / 2, W[1] / 4 + 96 + 10);
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => { const s = DL.GUI.screen; return s ? (s.title || '') + ' ' + (s.status || '') + ' ' + (s.progress !== undefined ? s.progress.toFixed(2) : '') : 'ingame'; });
    logs.push('t' + i + ': ' + st);
    if (i === 1) await page.screenshot({ path: out + '/loading.png' });
    if (st === 'ingame') break;
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/game.png' });
  const info = await page.evaluate(() => { const g = DL.game, p = g.player, w = g.world; return { pos: [p.x, p.y, p.z].map(v => v.toFixed(1)), chunks: w.chunks.size, fps: g.fps, ents: w.entities.length, drawn: g.renderer.stats.drawn }; });
  logs.push(JSON.stringify(info));
};
