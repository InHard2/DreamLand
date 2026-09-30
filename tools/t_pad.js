module.exports = async (page, out, logs) => {
  await page.addInitScript(() => {});
  await page.waitForTimeout(1200);
  // install a fake standard-mapping Xbox pad
  await page.evaluate(() => {
    const pad = { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })), vibrationActuator: { effects: ['dual-rumble', 'trigger-rumble'], playEffect: (t, o) => { (window.__rumble = window.__rumble || []).push(t + ':' + o.duration); return Promise.resolve('complete'); } } };
    window.__pad = pad;
    navigator.getGamepads = () => [pad, null, null, null];
    window.__press = (b, v) => { pad.buttons[b] = { pressed: v > 0.5, value: v }; };
  });
  const press = async (b) => { await page.evaluate((b) => window.__press(b, 1), b); await page.waitForTimeout(350); await page.evaluate((b) => window.__press(b, 0), b); await page.waitForTimeout(350); };
  await press(0); // A on Singleplayer (focus)
  await page.waitForTimeout(400);
  logs.push('screen1 ' + await page.evaluate(() => DL.GUI.screen.constructor.name + ' dev=' + DL.Input.lastDevice + ' focus=' + DL.GUI.screen.focus));
  await page.screenshot({ path: out + '/pad_select.png' });
  // choose slot 4 (navigate down 3) -> create world
  await press(13); await press(13); await press(13);
  await press(0);
  await page.waitForTimeout(300);
  logs.push('screen2 ' + await page.evaluate(() => DL.GUI.screen.constructor.name + ' focus=' + DL.GUI.screen.focus));
  await press(0); // Create New World (focused)
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(600); if (await page.evaluate(() => DL.game.inGame)) break; }
  await page.waitForTimeout(500);
  // move with left stick & look with right stick
  const p0 = await page.evaluate(() => { const p = DL.game.player; return [p.x, p.z, p.yaw]; });
  await page.evaluate(() => { window.__pad.axes = [0, -1, 0.8, 0]; });
  await page.waitForTimeout(800);
  await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 0]; });
  const p1 = await page.evaluate(() => { const p = DL.game.player; return [p.x, p.z, p.yaw]; });
  logs.push('moved ' + Math.hypot(p1[0] - p0[0], p1[1] - p0[1]).toFixed(2) + ' yaw ' + (p1[2] - p0[2]).toFixed(2));
  // RT attack -> rumble
  await page.evaluate(() => { DL.game.player.addItem(DL.Items.stack(4, 5)); });
  await page.evaluate(() => window.__press(7, 1)); await page.waitForTimeout(600); await page.evaluate(() => window.__press(7, 0));
  // Y inventory, dpad nav, B close
  await press(3);
  logs.push('inv ' + await page.evaluate(() => DL.GUI.screen && DL.GUI.screen.constructor.name));
  await press(15); await press(15);
  await page.screenshot({ path: out + '/pad_inv.png' });
  await press(1);
  logs.push('closed ' + await page.evaluate(() => String(DL.GUI.screen)));
  await press(9);
  logs.push('pause ' + await page.evaluate(() => DL.GUI.screen && DL.GUI.screen.constructor.name));
  await page.screenshot({ path: out + '/pad_pause.png' });
  logs.push('rumble ' + await page.evaluate(() => (window.__rumble || []).slice(0, 6).join(',')));
};
