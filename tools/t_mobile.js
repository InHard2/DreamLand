const { enter } = require('./common');
module.exports = async (page, out, logs) => {
  await page.waitForTimeout(3000);
  await page.screenshot({ path: out + '/m_title.png' });
  await page.touchscreen.tap(10, 10);
  await enter(page, logs, 777);
  await page.evaluate(() => { DL.Input.lastDevice = 'touch'; const p = DL.game.player; p.addItem(DL.Items.stack(4, 20)); p.addItem(DL.Items.stack(50, 20)); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + '/m_game.png' });
  // simulate joystick drag via CDP touch
  const cdp = await page.context().newCDPSession(page);
  const W = page.viewportSize().width, H = page.viewportSize().height;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: H - 110, id: 1 }] });
  for (let i = 0; i < 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: H - 110 - i * 5, id: 1 }] }); await page.waitForTimeout(30); }
  await page.waitForTimeout(600);
  const moved = await page.evaluate(() => { const p = DL.game.player; return [p.x.toFixed(2), p.z.toFixed(2), DL.Input.touch.move.map(v => v.toFixed(2))]; });
  logs.push('joy move ' + JSON.stringify(moved));
  await page.screenshot({ path: out + '/m_joy.png' });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  // look drag on right side
  const y0 = await page.evaluate(() => DL.game.player.yaw);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: W - 250, y: H / 2, id: 2 }] });
  for (let i = 0; i < 8; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: W - 250 - i * 10, y: H / 2, id: 2 }] }); await page.waitForTimeout(20); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const y1 = await page.evaluate(() => DL.game.player.yaw);
  logs.push('look delta ' + (y1 - y0).toFixed(3));
  // open inventory via button
  const inv = await page.evaluate(() => { const L = DL.GUI.touchLayout(DL.game); return L.buttons.find(b => b.id === 'inventory'); });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: inv.x + inv.w / 2, y: inv.y + inv.h / 2, id: 3 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(500);
  logs.push('screen: ' + await page.evaluate(() => DL.GUI.screen && DL.GUI.screen.constructor.name));
  await page.screenshot({ path: out + '/m_inv.png' });
};
