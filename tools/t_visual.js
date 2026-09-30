const { enter } = require('./common');
module.exports = async (page, out, logs) => {
  await enter(page, logs, 31337);
  await page.evaluate(() => { const g = DL.game; g.settings.difficulty = 0; g.world.difficulty = 0; g.chatMessage = () => {}; DL.GUI.chat.length = 0; });
  // find a cave near spawn: air pocket with sky 0 below y 50
  const cave = await page.evaluate(() => {
    const w = DL.game.world, p = DL.game.player, B = DL.S.B;
    for (let r = 0; r < 40; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = Math.floor(p.x) + dx, z = Math.floor(p.z) + dz;
      if (!w.isReady(x, z)) continue;
      for (let y = 20; y < 55; y++) {
        if (w.getBlock(x, y, z) === 0 && w.getBlock(x, y + 1, z) === 0 && w.getBlock(x, y + 2, z) === 0 && DL.S.SOLID[w.getBlock(x, y - 1, z)] && w.getSky(x, y, z) === 0) return [x, y, z];
      }
    }
    return null;
  });
  logs.push('cave ' + JSON.stringify(cave));
  if (cave) {
    await page.evaluate((c) => {
      const g = DL.game, p = g.player, w = g.world, B = DL.S.B;
      p.setPos(c[0] + 0.5, c[1], c[2] + 0.5); p.vy = 0; p.pitch = -0.1;
      // torches around
      for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [5, 5]]) {
        for (let y = c[1] + 2; y > c[1] - 4; y--) if (w.getBlock(c[0] + dx, y, c[2] + dz) === 0 && DL.S.SOLID[w.getBlock(c[0] + dx, y - 1, c[2] + dz)]) { w.setBlock(c[0] + dx, y, c[2] + dz, B.torch, 0, 3); break; }
      }
    }, cave);
    await page.waitForTimeout(1500);
    for (const [i, yaw] of [[0, 0], [1, 1.6], [2, 3.2]]) {
      await page.evaluate((yaw) => { DL.game.player.yaw = yaw; }, yaw);
      await page.waitForTimeout(700);
      await page.screenshot({ path: out + '/cave' + i + '.png' });
    }
  }
  // night with torches on surface
  await page.evaluate(() => {
    const g = DL.game, p = g.player, w = g.world, B = DL.S.B;
    const sp = g.meta.spawn; p.setPos(sp[0], sp[1], sp[2]); p.pitch = -0.2; w.time = 14500;
    for (let i = 0; i < 6; i++) { const x = Math.floor(p.x) + 3 + i * 2, z = Math.floor(p.z) - 4 + (i % 2) * 6; const y = w.topSolidY(x, z); if (w.getBlock(x, y, z) === 0) w.setBlock(x, y, z, B.torch, 0, 3); }
    p.yaw = -Math.PI / 2;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/night_torch.png' });
  // find desert & lava
  const spots = await page.evaluate(() => {
    const w = DL.game.world, g = w.gen, B = DL.S.B;
    let desert = null, tundra = null;
    for (let r = 0; r < 60 && (!desert || !tundra); r++) for (let a = 0; a < 16; a++) {
      const x = Math.round(Math.cos(a / 16 * Math.PI * 2) * r * 32), z = Math.round(Math.sin(a / 16 * Math.PI * 2) * r * 32);
      const b = g.biomeAt(x, z);
      if (b === DL.S.BIOME.DESERT && !desert) desert = [x, z];
      if (b === DL.S.BIOME.TUNDRA && !tundra) tundra = [x, z];
    }
    return { desert, tundra };
  });
  logs.push('spots ' + JSON.stringify(spots));
  for (const k of ['desert', 'tundra']) {
    const s = spots[k]; if (!s) continue;
    await page.evaluate((s) => { const g = DL.game, p = g.player; p.setPos(s[0] + 0.5, 120, s[1] + 0.5); p.vy = 0; p.health = 20; p.invulnerable = true; g.world.time = 4000; p.pitch = -0.35; }, s);
    for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); const ok = await page.evaluate(() => { const w = DL.game.world, p = DL.game.player; const pr = w.spawnProgress(p.x, p.z, 3); return pr.ready >= 1; }); if (ok) break; }
    await page.evaluate(() => { const g = DL.game, p = g.player, w = g.world; const y = w.topSolidY(Math.floor(p.x), Math.floor(p.z)); p.setPos(p.x, y + 1, p.z); p.vy = 0; p.fallDistance = 0; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: out + '/biome_' + k + '.png' });
  }
};
