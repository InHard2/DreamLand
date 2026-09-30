const { enter } = require('./common');
module.exports = async (page, out, logs) => {
  await enter(page, logs);
  await page.evaluate(() => { const g = DL.game; g.thirdPerson = 2; g.player.pitch = 0.2; g.world.difficulty = 0; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/tp_zoom.png', clip: { x: 440, y: 160, width: 400, height: 400 } });
  const parts = await page.evaluate(() => { const m = DL.game.renderer.modelMeshes.player; return Object.entries(m.parts).map(([k, v]) => k + ':' + v.start + '+' + v.count).join(' '); });
  logs.push(parts);
};
