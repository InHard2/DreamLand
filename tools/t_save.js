const { enter } = require('./common');
module.exports = async (page, out, logs) => {
  await enter(page, logs, 4242);
  const r1 = await page.evaluate(async () => {
    const g = DL.game, p = g.player, w = g.world, B = DL.S.B, I = DL.Items;
    const ticks = (n) => { for (let i = 0; i < n; i++) g.tick(); };
    const bx = Math.floor(p.x), bz = Math.floor(p.z), by = Math.floor(p.y) + 12;
    for (let x = bx - 8; x <= bx + 8; x++) for (let z = bz - 8; z <= bz + 8; z++) { w.setBlock(x, by - 1, z, B.stone, 0, 0); for (let y = by; y < by + 4; y++) w.setBlock(x, y, z, 0, 0, 0); }
    w.setBlock(bx, by, bz, B.water, 0, 1); w.schedule(bx, by, bz, 5);
    ticks(200);
    let water = 0; for (let x = bx - 8; x <= bx + 8; x++) for (let z = bz - 8; z <= bz + 8; z++) if (w.getBlock(x, by, z) === B.water) water++;
    w.setBlock(bx + 3, by + 2, bz + 3, B.gold_block, 0, 1);
    w.setBlock(bx + 4, by, bz + 4, B.chest, 0, 1);
    const te = w.getTile(bx + 4, by, bz + 4); te.items[5] = I.stack(264, 7);
    p.inv[3] = I.stack(B.torch, 33);
    p.setPos(bx + 0.5, by + 3, bz + 0.5);
    const pig = DL.Entities.spawnMob(w, 'pig', bx + 2.5, by, bz - 2.5);
    ticks(2);
    await g.quitToTitle();
    return { water, pos: [bx, by, bz], title: DL.GUI.screen && DL.GUI.screen.constructor.name };
  });
  logs.push('before: ' + JSON.stringify(r1));
  await page.waitForTimeout(500);
  await page.evaluate(async () => { const worlds = await DL.Storage.listWorlds(); const m = worlds.find(w => w.slot === 5); DL.game.startWorld(5, m, false); });
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(600); if (await page.evaluate(() => DL.game.inGame)) break; }
  await page.waitForTimeout(500);
  const r2 = await page.evaluate((r1) => {
    const g = DL.game, p = g.player, w = g.world, B = DL.S.B;
    const [bx, by, bz] = r1.pos;
    const te = w.getTile(bx + 4, by, bz + 4);
    const pigs = w.entities.filter(e => e.type === 'pig' && Math.abs(e.x - bx) < 10 && Math.abs(e.z - bz) < 10).length;
    return { gold: w.getBlock(bx + 3, by + 2, bz + 3) === B.gold_block, chest: te && te.items[5], torch: p.inv[3], pos: [p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1)], pigs, water: w.getBlock(bx, by, bz) };
  }, r1);
  logs.push('after: ' + JSON.stringify(r2));
  await page.screenshot({ path: out + '/reload.png' });
};
