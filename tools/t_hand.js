const { enter } = require('./common');
module.exports = async (page, out, logs) => {
  await enter(page, logs);
  await page.evaluate(() => {
    const g = DL.game, p = g.player;
    ['diamond_pickaxe', 'torch', 'cobblestone', 'arrow', 'apple', 'furnace'].forEach((n) => { const d = DL.Items.find(n); p.addItem(DL.Items.stack(d.id, d.maxStack > 1 ? 32 : 1)); });
    p.pitch = -0.3;
  });
  for (const [i, name] of [[0, 'pick'], [1, 'torch'], [2, 'block'], [3, 'arrow'], [4, 'apple'], [5, 'furnace'], [8, 'empty']]) {
    await page.evaluate((i) => { DL.game.player.selected = i; }, i);
    await page.waitForTimeout(700);
    await page.screenshot({ path: out + '/h_' + name + '.png', clip: { x: 640, y: 360, width: 640, height: 360 } });
  }
  await page.evaluate(() => { DL.game.player.selected = 0; DL.game.thirdPerson = 2; DL.game.player.pitch = 0; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: out + '/tp_front.png' });
  await page.evaluate(() => { DL.game.openInventory(); });
  await page.waitForTimeout(500);
  await page.mouse.move(640, 250);
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/inv2.png', clip: { x: 380, y: 110, width: 520, height: 500 } });
};
