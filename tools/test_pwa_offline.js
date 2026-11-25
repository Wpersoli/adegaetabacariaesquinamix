#!/usr/bin/env node
/* Confirma que a primeira visita offline a /produtos abre o catálogo pré-cacheado.
   Uso: node tools/test_pwa_offline.js http://127.0.0.1:8080 */
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:8080';
let ok = 0, bad = 0;
const check = (cond, msg) => { cond ? (ok++, console.log('   ✓ ' + msg)) : (bad++, console.log('   ✗ ' + msg)); };
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE + '/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 10000 });
  const cached = await page.evaluate(async () => {
    const sw = await fetch('/sw.js').then(r => r.text());
    const version = (sw.match(/var VERSAO='([^']+)'/) || [])[1];
    if (!version) throw new Error('Versão do cache não encontrada em sw.js');
    const c = await caches.open(version);
    const product = await c.match(new URL('/produtos.html', location.origin).href);
    const hero = await c.match(new URL('/assets/hero-promo-desktop.webp', location.origin).href);
    return { version, product: !!product, hero: !!hero };
  });
  check(cached.product, 'produtos.html incluído no pré-cache');
  check(cached.hero, 'banner promocional incluído no pré-cache');
  await context.setOffline(true);
  let response = null, navigationError = '';
  try { response = await page.goto(BASE + '/produtos', { waitUntil: 'domcontentloaded', timeout: 10000 }); }
  catch (e) { navigationError = e.message; }
  check(!!response && response.status() === 200, 'rota /produtos responde HTTP 200 sem rede' + (navigationError ? ': ' + navigationError : ''));
  if (response && response.status() === 200) {
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => ({
      path: location.pathname,
      cards: document.querySelectorAll('#grid .prod-card').length,
      title: document.title
    }));
    check(state.path.replace(/\/+$/, '') === '/produtos', 'URL limpa preservada');
    check(state.cards > 0, 'catálogo renderizado sem conexão');
  }
  check(!errors.length, 'sem erros JavaScript: ' + errors.join('; '));
  await browser.close();
  console.log(`\nPWA offline: ${ok} verificações OK, ${bad} falhas`);
  process.exit(bad ? 1 : 0);
})();
