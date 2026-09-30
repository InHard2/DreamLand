module.exports = async (page, out) => {
  await page.waitForTimeout(3500);
  await page.screenshot({ path: out + '/title.png' });
};
