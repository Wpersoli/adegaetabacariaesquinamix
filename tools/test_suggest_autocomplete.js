'use strict';
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';

async function prepare(page, url) {
  await page.addInitScript(() => localStorage.setItem('esquinaMixAge18', 'yes'));
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const preloader = document.querySelector('#esquinaPreloader');
    if (preloader) preloader.remove();
  });
  await page.waitForFunction(() => !!window.EsquinaSuggest, { timeout: 10000 });
}

async function exercise(page, input, boxSelector, label) {
  await input.fill('ipa');
  const box = page.locator(boxSelector);
  await box.locator('.sug__i').first().waitFor({ state: 'visible', timeout: 8000 });
  const count = await box.locator('.sug__i').count();
  if (!count) throw new Error(label + ': nenhuma sugestão foi exibida');
  await input.press('ArrowDown');
  await input.press('Enter');
  const value = await input.inputValue();
  if (!value || value.toLowerCase() === 'ipa') throw new Error(label + ': a escolha não preencheu o produto');
  const visibleBox = await pageVisible(box);
  if (visibleBox) throw new Error(label + ': lista continuou aberta após a escolha');
  return { count, value };
}

async function pageVisible(locator) {
  return locator.isVisible().catch(() => false);
}

(async () => {
  const browser = await chromium.launch();
  const failures = [];
  const home = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  home.on('pageerror', error => failures.push('home: ' + error.message));
  await prepare(home, '/');
  await home.locator('#homeFilterToggle').click();
  const homeResult = await exercise(home, home.locator('#homeFilterSearch'), 'ul.sug--float:visible', 'filtro lateral da home');
  const homeClosed = !(await home.locator('#homeFilter').evaluate(el => el.classList.contains('is-open')));
  if (!homeClosed) failures.push('home: o painel de filtros não fechou após selecionar sugestão');
  await home.close();

  const products = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  products.on('pageerror', error => failures.push('produtos: ' + error.message));
  await prepare(products, '/produtos.html');
  const topResult = await exercise(products, products.locator('#hq'), 'ul.sug--float:visible', 'busca superior do catálogo');
  await products.locator('#filtTab').click();
  const panelResult = await exercise(products, products.locator('#pq'), 'ul.sug--float:visible', 'busca do painel lateral do catálogo');
  await products.close();
  await browser.close();

  if (failures.length) {
    failures.forEach(error => console.error(' ✗ ' + error));
    process.exitCode = 1;
  } else {
    console.log('Autocomplete aprovado: home (' + homeResult.count + ' sugestões), topo do catálogo (' +
      topResult.count + '), filtro lateral (' + panelResult.count + ').');
  }
})();
