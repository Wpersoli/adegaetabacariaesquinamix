'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const WIDTHS = [320,360,390,430,600,768,820,900,972,1024,1025,1100,1280,1348,1440,1920];
const CATEGORIES = ['Headshop','Narguile'];
(async () => {
  const browser = await chromium.launch();
  let passed = 0, failed = 0;
  const check = (condition, label, details) => {
    if (condition) { passed++; console.log(' ✓ ' + label); }
    else { failed++; console.error(' ✗ ' + label + ' ' + JSON.stringify(details)); }
  };
  for (const width of WIDTHS) for (const category of CATEGORIES) {
    const mobileMenu = width <= 1024;
    const page = await browser.newPage({ viewport: { width, height: 800 }, isMobile: width <= 600, hasTouch: mobileMenu });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { const preloader = document.querySelector('#esquinaPreloader'); if (preloader) preloader.remove(); });
    const ageGate = page.locator('#yes');
    if (await ageGate.isVisible().catch(() => false)) await ageGate.evaluate(element => element.click());

    if (mobileMenu) {
      await page.locator('#menuBtn').click();
      const parent = page.locator('#mnav .mnav__a').filter({ hasText: new RegExp('^' + category + '$', 'i') });
      await parent.click();
      await page.locator('#mnav .mnav__sub button').filter({ hasText: 'Ver tudo em ' + category }).click();
    } else {
      const parent = page.locator('#nav button[data-cat="' + category.toLowerCase() + '"]');
      await parent.hover();
      await page.locator('#mega .mega__all').click();
    }
    await page.waitForTimeout(220);
    const layout = await page.evaluate(() => {
      const rect = selector => { const e = document.querySelector(selector); if (!e) return null; const r = e.getBoundingClientRect(); return { left: r.left, width: r.width }; };
      return { clientWidth: document.documentElement.clientWidth, pageX: window.scrollX,
        body: rect('body'), nav: rect('#nav'), catalog: rect('#cardapio'),
        activeCategory: document.querySelector('#chips .is-active')?.textContent?.trim() || '' };
    });
    const good = layout.clientWidth === width && Math.abs(layout.pageX) < 1 &&
      Math.abs(layout.body.left) < 1 && Math.abs(layout.body.width - width) < 1 &&
      layout.activeCategory.toLowerCase() === category.toLowerCase() && errors.length === 0;
    check(good, width + 'px ' + category + ' pelo menu ' + (mobileMenu ? 'mobile' : 'desktop'), { layout, errors });
    await page.close();
  }
  await browser.close();
  console.log('Resultado: ' + passed + ' aprovados, ' + failed + ' falhas');
  process.exitCode = failed ? 1 : 0;
})();
