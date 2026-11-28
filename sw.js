/* Service worker do Esquina Mix: deixa o site instalavel e abre mesmo com internet ruim.
   Aumente VERSAO a cada publicacao grande para renovar o cache. */
var VERSAO='esquina-mix-v36',BASE=['./','index.html','produtos.html','styles.css','catalog.js','app.js','suggest.js','pedido.js','produtos.css','produtos.js','preloader.css','preloader.js','auth.css','auth.js','manifest.webmanifest','assets/logo.webp','assets/icon-192.png','assets/hero-mobile.webp','assets/hero-cardapio-1920.webp','assets/hero-bebida-1920.webp','assets/hero-drinks-1920.webp','assets/hero-cardapio-2880.webp','assets/hero-bebida-2880.webp','assets/hero-drinks-2880.webp','assets/hero-promo-desktop.webp'];
self.addEventListener('install',function(e){e.waitUntil(caches.open(VERSAO).then(function(c){return c.addAll(BASE)}).then(function(){return self.skipWaiting()}))});
self.addEventListener('activate',function(e){e.waitUntil(caches.keys().then(function(ks){return Promise.all(ks.filter(function(k){return k!==VERSAO}).map(function(k){return caches.delete(k)}))}).then(function(){return self.clients.claim()}))});
self.addEventListener('fetch',function(e){
  var r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  /* Nunca armazenar respostas de autenticação ou páginas de confirmação em cache. */
  if(u.pathname.indexOf('/api/')===0||u.pathname.indexOf('/auth/')===0)return;
  var estatico=/\.(?:webp|png|jpg|jpeg|ico|svg|woff2?)$/i.test(u.pathname);
  if(estatico){ /* imagens: cache primeiro */
    e.respondWith(caches.match(r).then(function(h){return h||fetch(r).then(function(res){if(res.ok){var c=res.clone();caches.open(VERSAO).then(function(ca){ca.put(r,c)})}return res})}));return}
  /* pagina, CSS e JS: rede primeiro, cache se estiver sem internet */
  e.respondWith(fetch(r).then(function(res){if(res.ok){var c=res.clone();caches.open(VERSAO).then(function(ca){ca.put(r,c)})}return res}).catch(function(){return caches.match(r).then(function(h){if(h)return h;if(u.pathname.replace(/\/+$/,'')==='/produtos')return caches.match('produtos.html');return caches.match('index.html')})}));
});
