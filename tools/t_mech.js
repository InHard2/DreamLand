const { enter } = require('./common');
module.exports = async (page, out, logs) => {
  await enter(page, logs);
  const r = await page.evaluate(async () => {
    const g = DL.game, p = g.player, w = g.world, I = DL.Items, B = DL.S.B;
    const res = {};
    const ticks = (n) => { for (let i = 0; i < n; i++) g.tick(); };
    // flat test area: build a platform
    const bx = Math.floor(p.x) + 3, bz = Math.floor(p.z), by = Math.floor(p.y) + 10;
    for (let x = bx - 6; x <= bx + 6; x++) for (let z = bz - 6; z <= bz + 6; z++) { w.setBlock(x, by - 1, z, B.stone, 0, 0); for (let y = by; y < by + 5; y++) w.setBlock(x, y, z, 0, 0, 0); }
    p.setPos(bx + 0.5, by, bz + 0.5); p.vy = 0; p.fallDistance = 0;
    ticks(5);
    res.onGround = p.onGround;
    // recipes
    const R = (grid, size) => { const m = I.matchRecipe(grid.map(n => n ? I.stack(I.find(n).id) : null), size); return m ? I.name(m.id) + ' x' + m.count : null; };
    res.recipes = [
      R(['log', null, null, null], 2), R(['planks', null, 'planks', null], 2), R(['planks', 'planks', 'planks', 'planks'], 2),
      R(['cobblestone', 'cobblestone', 'cobblestone', 'cobblestone', null, 'cobblestone', 'cobblestone', 'cobblestone', 'cobblestone'], 3),
      R(['iron_ingot', 'iron_ingot', 'iron_ingot', null, 'stick', null, null, 'stick', null], 3),
      R([null, 'diamond', 'diamond', null, 'stick', 'diamond', null, 'stick', null], 3),
      R(['coal', null, 'stick', null], 2), R(['wheat', 'wheat', 'wheat', null, null, null, null, null, null], 3)
    ];
    // place block: look straight down at the stone below
    p.pitch = -Math.PI / 2 + 0.01; p.yaw = 0;
    p.inv[0] = I.stack(B.cobblestone, 10); p.selected = 0;
    g.updateTarget();
    res.target = g.target && [g.target.x, g.target.y, g.target.z, g.target.face];
    // look at the wall-side: place cobble on the ground next to us
    p.pitch = -0.7; g.updateTarget();
    const t0 = g.target && [g.target.x, g.target.y, g.target.z, g.target.face];
    g.usePressed = true; ticks(1);
    res.placed = t0 ? w.getBlock(t0[0], t0[1] + 1, t0[2]) : -1;
    res.cobbleLeft = p.inv[0] && p.inv[0].count;
    // mine it with a diamond pickaxe
    p.inv[1] = I.stack(I.find('diamond_pickaxe').id, 1); p.selected = 1;
    g.updateTarget();
    const t1 = g.target && [g.target.x, g.target.y, g.target.z];
    g.attackHeld = true; let n = 0;
    while (w.getBlock(t1[0], t1[1], t1[2]) !== 0 && n < 200) { g.updateTarget(); ticks(1); n++; }
    g.attackHeld = false;
    res.mineTicks = n;
    ticks(30);
    res.cobbleAfterMine = p.countItem(B.cobblestone);
    res.pickDamage = p.inv[1] && p.inv[1].dmg;
    // water flow
    w.setBlock(bx - 4, by, bz - 4, B.water, 0, 1); w.schedule(bx - 4, by, bz - 4, 5);
    ticks(120);
    let water = 0; for (let x = bx - 6; x <= bx + 6; x++) for (let z = bz - 6; z <= bz + 6; z++) if (w.getBlock(x, by, z) === B.water) water++;
    res.waterSpread = water;
    // sand fall
    w.setBlock(bx + 4, by + 4, bz + 4, B.sand, 0, 1);
    ticks(60);
    res.sandLanded = w.getBlock(bx + 4, by, bz + 4) === B.sand && w.getBlock(bx + 4, by + 4, bz + 4) === 0;
    // lava + water -> cobble/obsidian
    // furnace smelting
    const fx = bx + 5, fz = bz - 5;
    w.setBlock(fx, by, fz, B.furnace, 0, 1);
    const te = w.getTile(fx, by, fz);
    te.items[0] = I.stack(B.iron_ore, 2); te.items[1] = I.stack(263, 1);
    ticks(450);
    res.smelted = te.items[2] && (I.name(te.items[2].id) + ' x' + te.items[2].count);
    res.furnaceBlock = w.getBlock(fx, by, fz) === B.lit_furnace ? 'lit' : 'unlit';
    // light check: torch
    w.setBlock(bx - 2, by, bz + 3, B.torch, 0, 1);
    res.torchLight = [w.getBlockLight(bx - 2, by, bz + 3), w.getBlockLight(bx - 2 + 3, by, bz + 3), w.getBlockLight(bx - 2 + 13, by, bz + 3)];
    // mobs: zombie chase at night
    w.time = 18000; w.difficulty = 2;
    const z = DL.Entities.spawnMob(w, 'zombie', bx + 5.5, by, bz + 5.5);
    const d0 = z.distTo(p);
    ticks(80);
    res.zombie = [d0.toFixed(1), z.distTo(p).toFixed(1), p.health];
    // TNT
    const tx = bx - 5, tz = bz + 5;
    z.removed = true;
    p.setPos(bx + 0.5, by + 20, bz + 0.5);
    w.setBlock(tx, by - 1, tz, B.tnt, 0, 1);
    w.igniteTNT(tx, by - 1, tz, 5);
    ticks(40);
    let holes = 0; for (let x = tx - 3; x <= tx + 3; x++) for (let zz = tz - 3; zz <= tz + 3; zz++) if (w.getBlock(x, by - 1, zz) === 0) holes++;
    res.tntHoles = holes;
    // save and reload check
    await g.saveWorld();
    res.saved = w.savedKeys.size;
    return res;
  });
  logs.push(JSON.stringify(r, null, 1));
};
