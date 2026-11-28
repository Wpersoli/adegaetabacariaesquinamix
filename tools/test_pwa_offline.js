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
    const heroM2 = await c.match(new URL('/assets/hero-m2-880.webp', location.origin).href);
    const heroM2Response = await fetch('/assets/hero-m2-880.webp');
    const heroM2Bitmap = heroM2Response.ok ? await createImageBitmap(await heroM2Response.blob()) : null;
    return {
      version, product: !!product, hero: !!hero, heroM2: !!heroM2,
      heroM2Status: heroM2Response.status,
      heroM2Width: heroM2Bitmap ? heroM2Bitmap.width : 0,
      heroM2Height: heroM2Bitmap ? heroM2Bitmap.height : 0
    };
  });
  check(cached.product, 'produtos.html incluído no pré-cache');
  check(cached.hero, 'banner promocional incluído no pré-cache');
  check(cached.heroM2, 'banner mobile 2 incluído no pré-cache');
  check(cached.heroM2Status === 200 && cached.heroM2Width > 0 && cached.heroM2Height > 0, 'banner mobile 2 responde e decodifica: ' + cached.heroM2Width + '×' + cached.heroM2Height);
  check(Math.abs(cached.heroM2Width / cached.heroM2Height - 1003 / 2048) < 0.002, 'banner mobile 2 mantém proporção original sem deformação');
  await page.setViewportSize({ width: 390, height: 844 });
  const hotspots = await page.evaluate(() => {
    const slide = document.querySelector('#heroMobile .hm-slide[data-hm="1"]');
    if (!slide) return null;
    const base = slide.getBoundingClientRect();
    const rect = selector => {
      const r = slide.querySelector(selector).getBoundingClientRect();
      return { top: (r.top - base.top) / base.height, left: (r.left - base.left) / base.width, width: r.width / base.width, height: r.height / base.height };
    };
    return { ig: rect('.hm-hit--ig'), route: rect('.hm-hit--rota'), whatsapp: rect('.hm-hit--zap'), cta: rect('.hm-hit--btn') };
  });
  check(!!hotspots && Math.abs(hotspots.ig.top - 0.572) < 0.01 && Math.abs(hotspots.route.left - 0.3333) < 0.01 && Math.abs(hotspots.whatsapp.left - 0.6667) < 0.01, 'ícones Instagram, rota e WhatsApp alinhados em três colunas iguais');
  check(!!hotspots && hotspots.cta.top > 0.73 && hotspots.cta.top < 0.77 && hotspots.cta.width > 0.95, 'área clicável do CTA alinhada ao botão magenta');
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
