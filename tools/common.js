module.exports.enter = async (page, logs, seed) => {
  await page.waitForTimeout(1200);
  await page.evaluate((seed) => { DL.game.createWorld(5, 'Test', seed); }, seed || 1234);
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => DL.game.inGame);
    if (st) break;
  }
  await page.waitForTimeout(800);
};
module.exports.cmd = (page, c) => page.evaluate((c) => DL.game.command(c), c);
