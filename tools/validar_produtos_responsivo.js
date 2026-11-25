#!/usr/bin/env node
/* Testa a página de catálogo em Chromium em larguras de celular a desktop.
   Uso: node tools/validar_produtos_responsivo.js http://127.0.0.1:8080 */
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
const WIDTHS = [320, 360, 390, 430, 600, 768, 820, 821, 1024, 1025, 1280, 1440, 1920];
let ok = 0, bad = 0;
const check = (cond, msg) => { cond ? ok++ : (bad++, console.log('   ✗ ' + msg)); };
(async () => {
  const browser = await chromium.launch();
  for (const width of WIDTHS) {
    const mobile = width <= 1024, bottomBar = width <= 820;
    const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: mobile, isMobile: mobile });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(new URL('/produtos', BASE).toString());
    await page.evaluate(() => { const loader = document.getElementById('esquinaPreloader'); if (loader) loader.remove(); });
    const age = await page.$('#yes');
    if (age && await age.isVisible()) { await age.click(); await page.waitForTimeout(200); }
    await page.waitForTimeout(180);
    const layout = await page.evaluate(() => {
      const rect = s => { const el = document.querySelector(s); if (!el) return null; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return null; const r = el.getBoundingClientRect(); return { x:r.left, y:r.top, w:r.width, h:r.height, right:r.right }; };
      const cards = [...document.querySelectorAll('#grid .prod-card')].map(el => { const r=el.getBoundingClientRect(); return {x:r.left,right:r.right,w:r.width,h:r.height}; });
      const nav = [...document.querySelectorAll('#nav > *')].map(el => { const r=el.getBoundingClientRect(); return {y:Math.round(r.top),x:r.left,right:r.right}; });
      const bar = document.getElementById('mbar');
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        menu: rect('#menuBtn'), searchButton: rect('#searchBtn'), search: rect('.search'),
        nav: rect('#nav'), navItems: nav, brand: rect('.brand img'),
        grid: rect('#grid'), cards, count: cards.length,
        bottomBarDisplay: bar ? getComputedStyle(bar).display : 'missing',
        bottomItems: bar ? bar.querySelectorAll('.mbar__item').length : 0,
        filterButton: rect('#filtBtn')
      };
    });
    console.log(`\nProdutos ${width}px (${mobile ? 'MOBILE/TABLET' : 'DESKTOP'})`);
    check(!layout.overflow, 'rolagem horizontal');
    check(!errors.length, 'erros JS: ' + errors.join('; '));
    check(layout.count > 0, 'catálogo deve renderizar produtos');
    check(layout.cards.every(c => c.w > 0 && c.right <= width + 1), 'cards dentro da largura da tela');
    check(layout.grid && layout.grid.w > 0, 'grade de produtos visível');
    if (bottomBar) {
      check(layout.bottomBarDisplay !== 'none' && layout.bottomBarDisplay !== 'missing', 'barra inferior mobile visível');
      check(layout.bottomItems === 5, 'barra inferior com cinco atalhos');
    } else {
      check(layout.bottomBarDisplay === 'none', 'barra inferior oculta acima de 820px');
    }
    if (mobile) {
      check(layout.menu && Math.round(layout.menu.w) === 44, 'menu mobile com alvo de toque 44px');
      check(!layout.nav, 'navegação horizontal oculta no mobile');
      check(layout.searchButton && layout.searchButton.w >= 40, 'botão de busca disponível');
      if (bottomBar) await page.click('#mbar [data-act="search"]');
      else await page.click('#searchBtn');
      await page.waitForTimeout(120);
      check(await page.$eval('.top', e => e.classList.contains('is-search')), 'busca abre pelo atalho mobile');
      check(await page.$eval('#hq', e => e.getBoundingClientRect().height > 0), 'campo de busca fica visível');
      await page.keyboard.press('Escape'); await page.waitForTimeout(120);
      check(!(await page.$eval('.top', e => e.classList.contains('is-search'))), 'Escape fecha a busca');
      await page.click('#menuBtn'); await page.waitForTimeout(160);
      check(await page.$eval('#mnav', e => e.classList.contains('is-open')), 'menu mobile abre');
      check((await page.$$eval('#mnav .mnav__list > li', e => e.length)) >= 5, 'menu mobile apresenta categorias');
      await page.click('#mnav .mnav__x'); await page.waitForTimeout(120);
      check(!(await page.$eval('#mnav', e => e.classList.contains('is-open'))), 'menu mobile fecha');
    } else {
      check(!layout.menu && !layout.searchButton, 'menu e lupa mobile ocultos no desktop');
      check(layout.nav && layout.navItems.length >= 5, 'navegação desktop visível');
      check(layout.navItems.every(n => n.y === layout.navItems[0].y), 'categorias em uma única linha');
      check(layout.search && Math.round(layout.search.h) === 56, 'busca desktop com altura de 56px');
    }
    await context.close();
  }
  await browser.close();
  console.log(`\nProdutos: ${ok} verificações OK, ${bad} falhas`);
  process.exit(bad ? 1 : 0);
})();
