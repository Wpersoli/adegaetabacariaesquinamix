'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const WIDTHS = [320,360,390,430,600,768,820,900,972,1024,1025,1100,1280,1348,1440,1920];
const CATEGORIES = ['headshop','narguile'];
(async () => {
  const browser = await chromium.launch();
  let passed = 0, failed = 0;
  const check = (condition, label) => {
    if (condition) { passed++; console.log(' ✓ ' + label); }
    else { failed++; console.error(' ✗ ' + label); }
  };
  for (const width of WIDTHS) for (const category of CATEGORIES) {
    const page = await browser.newPage({ viewport: { width, height: 800 }, isMobile: width <= 600, hasTouch: width <= 1024 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { const preloader = document.querySelector('#esquinaPreloader'); if (preloader) preloader.remove(); });
    const ageGate = page.locator('#yes');
    if (await ageGate.isVisible().catch(() => false)) await ageGate.evaluate(element => element.click());
    await page.evaluate(cat => {
      const button = document.querySelector('#nav button[data-cat="' + cat + '"]');
      if (!button) throw new Error('Categoria não encontrada: ' + cat);
      button.click();
    }, category);
    await page.waitForTimeout(180);
    const layout = await page.evaluate(() => {
      const nav = document.querySelector('#nav').getBoundingClientRect();
      return { viewport: innerWidth, clientWidth: document.documentElement.clientWidth, pageX: scrollX,
        navLeft: nav.left, bodyWidth: document.body.getBoundingClientRect().width };
    });
    const good = layout.viewport === width && layout.clientWidth === width && Math.abs(layout.pageX) < 1 &&
      Math.abs(layout.navLeft) < 1 && Math.abs(layout.bodyWidth - width) < 1 && errors.length === 0;
    check(good, width + 'px ' + category + ': filtro sem deslocamento horizontal / layout preservado' +
      (good ? '' : ' ' + JSON.stringify({ layout, errors })));
    await page.close();
  }
  await browser.close();
  console.log('Resultado: ' + passed + ' aprovados, ' + failed + ' falhas');
  process.exitCode = failed ? 1 : 0;
})();