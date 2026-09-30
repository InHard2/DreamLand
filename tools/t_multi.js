const { enter, cmd } = require('./common');
module.exports = async (page, out, logs) => {
  await enter(page, logs);
  await page.evaluate(() => {
    const g = DL.game, p = g.player;
    ['diamond_pickaxe', 'torch', 'cobblestone', 'planks', 'iron_sword', 'bread', 'bow', 'arrow', 'crafting_table', 'furnace', 'chest', 'glass', 'wood_stairs', 'fence', 'slab', 'dandelion', 'iron_chestplate', 'apple'].forEach((n, i) => {
      const d = DL.Items.find(n); p.addItem(DL.Items.stack(d.id, d.maxStack > 1 ? 32 : 1));
    });
    p.selected = 0;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/hand_pick.png' });
  await page.evaluate(() => { DL.game.player.selected = 1; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out + '/hand_torch.png' });
  await page.evaluate(() => { DL.game.player.selected = 2; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out + '/hand_block.png' });
  await page.evaluate(() => { DL.game.player.selected = 7; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: out + '/hand_empty.png' });
  await page.evaluate(() => { DL.game.openInventory(); });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/inventory.png' });
  await page.evaluate(() => DL.game.setScreen(null));
  // mobs in front
  await page.evaluate(() => {
    const g = DL.game, p = g.player, w = g.world;
    const l = p.look();
    const types = ['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider'];
    types.forEach((t, i) => {
      const a = p.yaw + (i - 3.5) * 0.18;
      const x = p.x - Math.sin(a) * 7, z = p.z - Math.cos(a) * 7;
      const y = w.topSolidY(Math.floor(x), Math.floor(z));
      const m = DL.Entities.spawnMob(w, t, x, y, z); m.persistent = true; m.yaw = m.bodyYaw = p.yaw + Math.PI;
    });
    p.pitch = -0.15;
    w.difficulty = 0; g.settings.difficulty = 0;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/mobs.png' });
  await page.evaluate(() => { DL.game.thirdPerson = 1; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/third.png' });
  await page.evaluate(() => { DL.game.thirdPerson = 2; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/front.png' });
  await page.evaluate(() => { DL.game.thirdPerson = 0; DL.game.world.time = 12500; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/sunset.png' });
  await page.evaluate(() => { DL.game.world.time = 18000; DL.game.player.pitch = 0.6; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/night.png' });
  await page.evaluate(() => { DL.game.world.time = 3000; DL.game.player.pitch = 0; DL.game.setScreen(new DL.GUI.CraftingScreen(DL.game, 0, 0, 0)); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/crafting.png' });
  await page.evaluate(() => { DL.game.setScreen(new DL.GUI.FurnaceScreen(DL.game, { items: [DL.Items.stack(15, 3), DL.Items.stack(263, 5), DL.Items.stack(265, 2)], burn: 800, burnMax: 1600, cook: 90, x: 0, y: 0, z: 0 })); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + '/furnace.png' });
  await page.evaluate(() => { DL.game.setScreen(new DL.GUI.PauseScreen(DL.game)); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/pause.png' });
  await page.evaluate(() => { DL.game.setScreen(new DL.GUI.OptionsScreen(DL.game, null)); });
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '/options.png' });
};
