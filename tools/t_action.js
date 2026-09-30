const { enter } = require('./common');
module.exports = async (page, out, logs) => {
  await enter(page, logs, 2024);
  await page.evaluate(() => {
    const g = DL.game, p = g.player, w = g.world, B = DL.S.B, I = DL.Items;
    g.chatMessage = () => {}; DL.GUI.chat.length = 0;
    const bx = Math.floor(p.x), bz = Math.floor(p.z), by = Math.floor(p.y) + 8;
    for (let x = bx - 8; x <= bx + 8; x++) for (let z = bz - 8; z <= bz + 8; z++) { w.setBlock(x, by - 1, z, B.grass, 0, 0); for (let y = by; y < by + 6; y++) w.setBlock(x, y, z, 0, 0, 0); }
    p.setPos(bx + 0.5, by, bz + 0.5); p.yaw = 0; p.pitch = -0.45;
    window.__base = [bx, by, bz];
    // wall to mine in front
    for (let x = bx - 1; x <= bx + 1; x++) for (let y = by; y < by + 3; y++) w.setBlock(x, y, bz - 3, B.stone, 0, 0);
    p.inv[0] = I.stack(I.find('stone_pickaxe').id, 1); p.selected = 0;
    // dropped items
    for (const [i, id] of [[0, 264], [1, B.cobblestone], [2, 260], [3, B.torch], [4, 267], [5, B.log]].map(([i, n]) => [i, n])) w.spawnItem(bx - 2.5 + i, by + 0.3, bz - 1.5, I.stack(id, i === 1 ? 10 : 1), false);
    // fire
    w.setBlock(bx + 3, by, bz - 2, B.fire, 0, 3);
    // door
    g.target = { x: bx - 3, y: by - 1, z: bz - 2, face: 1, id: B.grass };
    p.inv[1] = I.stack(324, 1); p.selected = 1; g.placeBlock(B.wooden_door, g.target);
    // crops on farmland
    for (let i = 0; i < 4; i++) { w.setBlock(bx + 4 + i % 2, by - 1, bz + (i >> 1), B.farmland, 7, 0); w.setBlock(bx + 4 + i % 2, by, bz + (i >> 1), B.wheat, i * 2 + 1, 0); }
    p.selected = 0;
    g.settings.difficulty = 0; w.difficulty = 0;
    for (let x = bx - 8; x <= bx + 8; x++) for (let z = bz - 8; z <= bz + 8; z++) w.markBlockDirty(x, by, z);
  });
  await page.waitForTimeout(800);
  // mine partially: hold attack
  await page.evaluate(() => { const g = DL.game; g.updateTarget(); g.attackHeld = true; g.frameInput = function () { this.updateTarget(); }; });
  await page.waitForTimeout(1100);
  await page.screenshot({ path: out + '/a_crack.png' });
  await page.evaluate(() => { const g = DL.game; g.attackHeld = false; g.player.pitch = -0.25; g.player.yaw = 0.6; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/a_items.png' });
  await page.evaluate(() => { const g = DL.game; g.player.yaw = -0.7; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/a_fire_crops.png' });
  // explosion + arrows
  await page.evaluate(() => {
    const g = DL.game, w = g.world, p = g.player, [bx, by, bz] = window.__base, B = DL.S.B;
    p.yaw = 0; p.pitch = -0.2;
    w.setBlock(bx, by, bz - 7, B.tnt, 0, 1); w.igniteTNT(bx, by, bz - 7, 20);
    const s = DL.Entities.spawnMob(w, 'skeleton', bx + 4.5, by, bz - 6.5); s.persistent = true;
    w.difficulty = 2; g.settings.difficulty = 2; w.time = 18000; p.invulnerable = true;
  });
  await page.waitForTimeout(1300);
  await page.screenshot({ path: out + '/a_explode.png' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + '/a_arrow.png' });
  const info = await page.evaluate(() => DL.game.world.entities.map(e => e.type).join(','));
  logs.push(info);
};
