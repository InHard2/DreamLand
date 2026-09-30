module.exports = async (page, out, logs) => {
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const W = DL.World.prototype;
    window.__perf = {};
    for (const fn of ['populate', 'lightChunk', 'buildMeshJob', 'installGenerated', 'relight', 'processMeshing', 'updateChunks']) {
      const orig = W[fn];
      W[fn] = function () { const t = performance.now(); const r = orig.apply(this, arguments); const d = performance.now() - t; const s = window.__perf[fn] || (window.__perf[fn] = { n: 0, t: 0, max: 0 }); s.n++; s.t += d; s.max = Math.max(s.max, d); return r; };
    }
    const M = DL.S.Mesher.prototype, om = M.mesh;
    M.mesh = function () { const t = performance.now(); const r = om.apply(this, arguments); const d = performance.now() - t; const s = window.__perf.meshMain || (window.__perf.meshMain = { n: 0, t: 0, max: 0 }); s.n++; s.t += d; s.max = Math.max(s.max, d); return r; };
    DL.game.settings.renderDist = 1; // NORMAL (8)
    DL.game.createWorld(4, 'Perf', 98765);
  });
  const t0 = Date.now();
  for (let i = 0; i < 60; i++) { await page.waitForTimeout(500); if (await page.evaluate(() => DL.game.inGame)) break; }
  logs.push('load time ms ' + (Date.now() - t0));
  await page.waitForTimeout(8000);
  const r = await page.evaluate(() => {
    const o = {};
    for (const k in window.__perf) { const s = window.__perf[k]; o[k] = 'n=' + s.n + ' avg=' + (s.t / s.n).toFixed(2) + 'ms max=' + s.max.toFixed(1); }
    const w = DL.game.world;
    o.chunks = w.chunks.size; o.meshed = [...w.chunks.values()].filter(c => c.meshReady).length; o.dirty = w.dirtySections.size;
    o.workers = w.pool.workers.length;
    return o;
  });
  logs.push(JSON.stringify(r, null, 1));
  // single mesh timing on main thread for a typical surface section
  const m = await page.evaluate(() => {
    const w = DL.game.world, p = DL.game.player;
    const c = w.getChunk(Math.floor(p.x / 16), Math.floor(p.z / 16));
    const s = c.sections[Math.floor(p.y / 16)];
    const job = w.buildMeshJob(s);
    const me = new DL.S.Mesher();
    for (let i = 0; i < 5; i++) me.mesh(job);
    const t = performance.now(); let r; for (let i = 0; i < 20; i++) r = me.mesh(job);
    return { ms: ((performance.now() - t) / 20).toFixed(2), quads: r.solidCount / 4 + r.transCount / 4 };
  });
  logs.push('surface section mesh: ' + JSON.stringify(m));
};
