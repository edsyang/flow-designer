import { test } from '@playwright/test';
test('check errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push('PAGE: ' + e.message.substring(0, 300)));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text().substring(0, 300)); });
  await page.goto('http://127.0.0.1:5179');
  await page.waitForTimeout(8000);
  console.log('=== ERRORS ===');
  errors.forEach(e => console.log(e));
  console.log('=== BODY CONTENT ===');
  const body = await page.evaluate(() => document.body.innerHTML.substring(0, 800));
  console.log(body);
});
