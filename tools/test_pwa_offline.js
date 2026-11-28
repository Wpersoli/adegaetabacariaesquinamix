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
    if (sw.includes('assets/hero-m2-440.webp')) throw new Error('Pré-cache ainda referencia o arquivo inexistente hero-m2-440.webp');
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
  const heroAudit = await page.evaluate(async () => {
    const slides = Array.from(document.querySelectorAll('#heroMobile .hm-slide'));
    const footer = document.querySelector('#heroMobile .hm-footer');
    const imgs = await Promise.all(slides.map(async slide => {
      const img = slide.querySelector('img');
      img.loading = 'eager';
      if (!img.complete) await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
      return { src: img.getAttribute('src'), width: img.naturalWidth, height: img.naturalHeight };
    }));
    const rect = selector => {
      const el = footer && footer.querySelector(selector);
      if (!el) return null;
      const r = el.getBoundingClientRect(), b = footer.getBoundingClientRect();
      return { left:(r.left-b.left)/b.width, width:r.width/b.width, top:(r.top-b.top)/b.height };
    };
    return {
      slideCount: slides.length, imgs,
      footer: !!footer,
      instagram: footer && footer.querySelector('.hm-footer__link[href*="instagram.com"]')?.getAttribute('href'),
      route: footer && footer.querySelector('[data-hero-rota]')?.getAttribute('href'),
      whatsapp: footer && footer.querySelector('.hm-footer__link[href*="wa.me"]')?.getAttribute('href'),
      catalog: footer && footer.querySelector('.hm-footer__cta')?.getAttribute('href'),
      columns: ['.hm-footer__link:nth-child(1)','.hm-footer__link:nth-child(2)','.hm-footer__link:nth-child(3)'].map(rect),
      cta: rect('.hm-footer__cta')
    };
  });
  check(heroAudit.slideCount === 3, 'carrossel mobile mantém os três slides');
  check(heroAudit.imgs.every(i => i.width > 0 && i.height > 0 && Math.abs(i.width/i.height - 440/896) < 0.004), 'as três artes carregam e preservam a mesma proporção vertical');
  check(heroAudit.footer, 'rodapé HTML único compartilhado por todos os slides');
  check(heroAudit.instagram === 'https://www.instagram.com/esquinamix2025/', 'link do Instagram aponta para o perfil oficial');
  check(heroAudit.route === '#encontre', 'link Como Chegar aponta para o mapa interno');
  check(!!heroAudit.whatsapp && heroAudit.whatsapp.startsWith('https://wa.me/5511917221039'), 'link WhatsApp aponta para o número comercial');
  check(heroAudit.catalog === '#cardapio', 'CTA abre o catálogo');
  check(heroAudit.columns.every((r,i,a) => !!r && Math.abs(r.width-1/3) < 0.015 && (i===0 || Math.abs(r.left-(a[i-1].left+a[i-1].width)) < 0.015)), 'três colunas de contato têm largura e alinhamento uniformes');
  check(!!heroAudit.cta && heroAudit.cta.width > 0.94 && heroAudit.cta.top > 0.68, 'CTA magenta ocupa a faixa inferior compartilhada');
  for (const width of [320, 360, 390, 430, 480]) {
    await page.setViewportSize({ width, height: 844 });
    const layout = await page.evaluate(() => {
      const footer = document.querySelector('#heroMobile .hm-footer');
      const links = Array.from(footer.querySelectorAll('.hm-footer__link'));
      const cta = footer.querySelector('.hm-footer__cta');
      const fr = footer.getBoundingClientRect();
      return {
        pageWidth: document.documentElement.scrollWidth,
        viewport: innerWidth,
        footerInside: fr.left >= -1 && fr.right <= innerWidth + 1,
        columns: links.map(a => a.getBoundingClientRect().width),
        ctaInside: cta.scrollWidth <= cta.clientWidth + 2
      };
    });
    check(layout.pageWidth <= width + 1 && layout.viewport === width && layout.footerInside, width + 'px rodapé centralizado sem overflow horizontal');
    check(layout.columns.every(v => Math.abs(v-layout.columns[0]) < 1) && layout.ctaInside, width + 'px colunas iguais e CTA sem corte de texto');
  }
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
