module.exports = async (page, out, logs) => {
  await page.waitForTimeout(1200);
  await page.evaluate(() => DL.game.createWorld(3, 'C', 55, true));
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(600); if (await page.evaluate(() => DL.game.inGame)) break; }
  const r = await page.evaluate(() => { const g = DL.game, p = g.player; p.flying = true; p.jumping = true; for (let i = 0; i < 10; i++) g.tick(); const y0 = p.y; g.openInventory(); return { creative: p.creative, flyUp: +(p.y).toFixed(1), screen: DL.GUI.screen.constructor.name, hurt: p.damage('mob', 5), health: p.health }; });
  logs.push(JSON.stringify(r));
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + '/creative.png' });
};
