'use strict';
const {chromium}=require('playwright');
const BASE=process.argv[2]||'http://127.0.0.1:8080';
const VIEWPORTS=[{w:390,h:844,m:true},{w:768,h:1024,m:true},{w:1440,h:900,m:false}];
let ok=0,bad=0;
const check=(v,s)=>{if(v){ok++;console.log(' ✓ '+s)}else{bad++;console.log(' ✗ '+s)}};
async function ready(p){await p.waitForFunction(()=>!document.querySelector('#esquinaPreloader'),{timeout:5000})}
(async()=>{
 const b=await chromium.launch();
 for(const v of VIEWPORTS){
  const c=await b.newContext({viewport:{width:v.w,height:v.h},hasTouch:v.m,isMobile:false});
  const p=await c.newPage(),errs=[],http=[];
  p.on('pageerror',e=>errs.push(e.message));
  p.on('response',r=>{if(r.status()>=500)http.push(r.status()+' '+r.url())});
  await p.goto(BASE+'/',{waitUntil:'networkidle'});await ready(p);await p.locator('#yes').click();
  await p.locator('#vitrine').scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>Array.from(document.querySelectorAll('#vitrine img')).every(i=>i.complete&&i.naturalWidth>0),{timeout:10000});
  check(await p.locator('#vitrine').isVisible(),v.w+'px vitrine aparece');
  check(await (await p.locator('#vitrineFeature').count())===1&&(await p.locator('#vitrineList .prod-card').count())===4,v.w+'px cinco destaques renderizados');
  check(await p.locator('#vitrine img').evaluateAll(a=>a.every(i=>i.complete&&i.naturalWidth>0)),v.w+'px imagens da vitrine carregadas');
  check(await p.evaluate(()=>{const s=document.querySelector('#vitrine'),r=s.getBoundingClientRect(),i=s.querySelector('.wrap').getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1&&i.left>=-1&&i.right<=innerWidth+1&&document.documentElement.scrollLeft===0}),v.w+'px vitrine contida na viewport sem deslocamento horizontal');
  if(v.w<=600){
    check(await p.locator('#vitrineList').evaluate(e=>e.scrollWidth>e.clientWidth),v.w+'px carrossel horizontal funcional');
    await p.locator('#vitrineDots .vitrine__dot:nth-child(2)').click();await p.waitForTimeout(260);
    check(await p.locator('#vitrineList').evaluate(e=>e.scrollLeft>0),v.w+'px indicador navega para o próximo destaque');
    await p.locator('#vitrineDots .vitrine__dot:nth-child(1)').click();await p.waitForTimeout(260);
  }
  await p.locator('#vitrineFeature .vitrine__buy').click();
  check((await p.locator('#cartCount').innerText()).includes('1'),v.w+'px vitrine adiciona à sacola compartilhada');
  await p.evaluate(()=>document.dispatchEvent(new Event('cart:clear')));
  await p.evaluate(()=>scrollTo(0,0));
  if(v.m){
   await p.click('#menuBtn');await p.waitForTimeout(180);
   check(await p.locator('#mnav').evaluate(e=>e.classList.contains('is-open')),v.w+'px menu abre');
   await p.locator('#mnav .mnav__x').click();await p.waitForTimeout(180);
   check(!(await p.locator('#mnav').evaluate(e=>e.classList.contains('is-open'))),v.w+'px menu fecha');
   await p.click('#searchBtn');
  }else check(await p.locator('.nav').isVisible(),'1440px navegação desktop');
  await p.locator('#q').fill('água');await p.waitForTimeout(180);
  check((await p.locator('#sug').innerText()).includes('Água mineral'),v.w+'px busca/sugestões');
  await p.keyboard.press('Escape');await p.click('#accountBtn');
  check(await p.locator('.au__card').isVisible(),v.w+'px modal de conta');
  await p.keyboard.press('Escape');
  const y=await p.locator('#grid .prod-buy').first().evaluate(e=>e.getBoundingClientRect().top+scrollY);
  await p.evaluate(y=>scrollTo(0,Math.max(0,y-300)),y);
  await p.locator('#grid .prod-buy').first().click();await p.waitForTimeout(100);
  check((await p.locator('#cartCount').innerText()).includes('1'),v.w+'px adicionar à sacola');
  await p.click('#cartBtn');check(await p.locator('#drawer').isVisible(),v.w+'px abrir sacola');
  await p.click('#confirmOrder');
  check(await p.locator('#ckName').isVisible(),v.w+'px checkout/nome');
  check(await p.locator('#ckPhone').isVisible(),v.w+'px checkout/telefone');
  check(await p.locator('#send').isEnabled(),v.w+'px pedido pronto sem envio');
  check(!errs.length,v.w+'px sem exceções JS');check(!http.length,v.w+'px sem HTTP 5xx');
  await c.close();
 }
 const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:false});
 const p=await c.newPage();await p.goto(BASE+'/produtos.html',{waitUntil:'networkidle'});await ready(p);
 await p.locator('#yes').evaluate(e=>e.click());
 await p.locator('#catChips .feat-chip[data-cat="bebidas"]').click();await p.waitForTimeout(150);
 check(await p.locator('#grid .prod-card').evaluateAll(a=>a.length>0&&a.every(e=>e.querySelector('.prod-cat')?.innerText==='BEBIDAS')),'catálogo: filtro Bebidas');
 await p.locator('#grid .prod-buy').first().click();await p.waitForTimeout(100);
 check((await p.locator('#cartCount').innerText()).includes('1'),'catálogo: adicionar produto');
 await p.reload({waitUntil:'networkidle'});await ready(p);
 check((await p.locator('#cartCount').innerText()).includes('1'),'catálogo: sacola persiste após reload');
 await c.close();await b.close();
 console.log('\nFluxos funcionais: '+ok+' OK, '+bad+' falhas');process.exit(bad?1:0);
})().catch(e=>{console.error(e);process.exit(1)});
