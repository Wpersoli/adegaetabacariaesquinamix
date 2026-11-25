'use strict';
const { chromium } = require('playwright');
const axePath = require.resolve('axe-core/axe.min.js');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const WIDTHS = [390, 768, 1440];
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
let ok = 0, bad = 0;
function check(condition, label) {
  if (condition) { ok++; console.log('   ✓ ' + label); }
  else { bad++; console.log('   ✗ ' + label); }
}
async function ready(page) {
  await page.waitForFunction(() => !document.querySelector('#esquinaPreloader'), { timeout: 5000 });
}
async function scan(page, label) {
  const result = await page.evaluate(async tags => axe.run(document, {
    runOnly: { type: 'tag', values: tags }
  }), TAGS);
  if (!result.violations.length) return check(true, label + ': sem violações WCAG A/AA');
  bad++;
  console.log('   ✗ ' + label + ': ' + result.violations.length + ' regra(s) violada(s)');
  for (const violation of result.violations) {
    console.log('     - ' + violation.id + ' (' + violation.impact + '): ' +
      violation.nodes.map(node => node.target.join(' ')).slice(0, 8).join(', '));
  }
}
(async () => {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const mobile = width <= 820;
    const context = await browser.newContext({
      viewport: { width, height: 900 }, hasTouch: mobile, isMobile: false
    });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.addInitScript({ path: axePath });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await ready(page);
    await scan(page, width + 'px — confirmação 18+');
    await page.locator('#yes').click();
    await page.waitForTimeout(120);
    await scan(page, width + 'px — página inicial');
    await page.click('#accountBtn');
    await page.waitForTimeout(120);
    await scan(page, width + 'px — modal de conta');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    const buttonY = await page.locator('#grid .prod-buy').first()
      .evaluate(element => element.getBoundingClientRect().top + window.scrollY);
    await page.evaluate(y => window.scrollTo(0, Math.max(0, y - 300)), buttonY);
    await page.locator('#grid .prod-buy').first().click();
    await page.click('#cartBtn');
    await page.waitForTimeout(100);
    await scan(page, width + 'px — sacola');
    await page.click('#confirmOrder');
    await page.waitForTimeout(100);
    await scan(page, width + 'px — checkout');
    await page.goto(BASE + '/produtos.html', { waitUntil: 'networkidle' });
    await ready(page);
    await scan(page, width + 'px — catálogo');
    check(pageErrors.length === 0, width + 'px — sem exceções JavaScript' +
      (pageErrors.length ? ': ' + pageErrors.join('; ') : ''));
    await context.close();
  }
  await browser.close();
  console.log('\nAcessibilidade: ' + ok + ' verificações OK, ' + bad + ' falhas');
  process.exit(bad ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
