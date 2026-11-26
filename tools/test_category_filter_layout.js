'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const WIDTHS = [320,360,390,430,600,768,820,900,972,1024,1025,1100,1280,1348,1440,1920];
const CATEGORIES = ['headshop','narguile'];

(async () => {
  const browser = await chromium.launch();
  let passed = 0, failed = 0;
  const check = (condition, label, details) => {
    if (condition) { passed++; console.log(' ✓ ' + label); }
    else { failed++; console.error(' ✗ ' + label + ' ' + JSON.stringify(details)); }
  };

  for (const width of WIDTHS) for (const category of CATEGORIES) {
    const mobileMenu = width <= 1024;
    const page = await browser.newPage({
      viewport: { width, height: 820 },
      isMobile: width <= 600,
      hasTouch: width <= 1024
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('esquinaMixAge18', 'yes'));
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const preloader = document.querySelector('#esquinaPreloader');
      if (preloader) preloader.remove();
    });

    if (mobileMenu) {
      await page.locator('#menuBtn').click();
      const parent = page.locator('#mnav .mnav__a[aria-expanded]')
        .filter({ hasText: new RegExp(category, 'i') });
      await parent.waitFor({ state: 'visible' });
      await parent.click();
      await page.locator('#mnav .mnav__sub button.all')
        .filter({ hasText: 'Ver tudo em ' + (category === 'headshop' ? 'Headshop' : 'Narguile') })
        .click();
    } else {
      await page.locator('#nav button[data-cat="' + category + '"]').hover();
      await page.locator('#mega .mega__all').waitFor({ state: 'visible' });
      await page.locator('#mega .mega__all').click();
    }

    await page.waitForTimeout(180);
    const layout = await page.evaluate(() => {
      const rect = selector => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const r = element.getBoundingClientRect();
        return { left: r.left, width: r.width, right: r.right };
      };
      return {
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        pageX: window.scrollX,
        body: rect('body'),
        header: rect('.top'),
        hero: rect('.hero'),
        catalog: rect('#cardapio'),
        activeCategory: document.querySelector('#chips .is-active')?.dataset.cat || ''
      };
    });

    const good = layout.clientWidth === width &&
      Math.abs(layout.pageX) < 1 &&
      layout.body && Math.abs(layout.body.left) < 1 &&
      Math.abs(layout.body.width - width) < 2 &&
      layout.header && Math.abs(layout.header.left) < 1 &&
      layout.activeCategory === category &&
      errors.length === 0;
    check(good, width + 'px ' + category + ' menu ' + (mobileMenu ? 'mobile' : 'desktop'), { layout, errors });
    await page.close();
  }

  await browser.close();
  console.log('Resultado: ' + passed + ' aprovados, ' + failed + ' falhas');
  process.exitCode = failed ? 1 : 0;
})();
