const { enter } = require('./common');
module.exports = async (page, out, logs) => {
  await enter(page, logs, 1234);
  await page.evaluate(() => {
    const g = DL.game, p = g.player, w = g.world; g.settings.difficulty = 0; w.difficulty = 0; DL.GUI.chat.length = 0;
    p.armor = [DL.Items.stack(306), DL.Items.stack(311), null, DL.Items.stack(301)];
    ['pig', 'cow', 'sheep', 'chicken', 'zombie', 'skeleton', 'creeper', 'spider'].forEach((t, i) => {
      const a = p.yaw + (i - 3.5) * 0.2, x = p.x - Math.sin(a) * 6, z = p.z - Math.cos(a) * 6;
      const m = DL.Entities.spawnMob(w, t, x, w.topSolidY(Math.floor(x), Math.floor(z)), z); m.yaw = m.bodyYaw = p.yaw + Math.PI;
    });
    p.pitch = -0.2;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + '/smoke_mobs.png' });
  await page.evaluate(() => { DL.game.thirdPerson = 2; DL.game.player.pitch = 0.1; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/smoke_player.png' });
};
