/* Esquina Mix — Login / Cadastro (botao de usuario no cabecalho).
   • Entrar com e-mail e senha, ou criar conta com Google ou com e-mail pessoal.
   • Cadastro por e-mail exige CPF valido (digitos verificadores) e maior de 18 anos; 1 CPF = 1 conta.
   • MODO (meta "esquina-auth" no index.html):
       "demo" = tudo roda so neste navegador (para testar o layout e o fluxo). NAO consulta a Receita
                Federal e NAO e seguro para producao.
       "api"  = fala com o servidor em /api/auth/* (contrato descrito no README). A validacao do CPF junto
                ao governo, a unicidade do CPF, a senha e a sessao ficam SEMPRE no servidor.
   • Google: fluxo por redirecionamento (GET /api/auth/google) — nao exige liberar nada na CSP. */
(function(){
'use strict';
var btn=document.getElementById('accountBtn');
if(!btn)return;

var meta=document.querySelector('meta[name="esquina-auth"]');
var MODE=meta&&meta.getAttribute('content')==='api'?'api':'demo';
var API='/api/auth',KU='esquina.auth.users',KS='esquina.auth.session',KO='esquina.auth.orders',MINAGE=18;
var user=null,root=null,card=null,view='login',lastFocus=null,busy=false,fresh=false,ordTimer=0,ordBusy=false,ordSeq=0;

/* ---------- utilidades ---------- */
function sget(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}}
function sset(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch(e){return false}}
function sdel(k){try{localStorage.removeItem(k)}catch(e){}}
function err(code,msg){var e=new Error(msg||code);e.code=code;return e}
function $(s,r){return (r||root).querySelector(s)}
function $$(s,r){return [].slice.call((r||root).querySelectorAll(s))}

function onlyDigits(v){return String(v||'').replace(/\D/g,'')}
function maskCpf(v){
  var d=onlyDigits(v).slice(0,11);
  return d.replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d)/,'$1.$2').replace(/(\d{3})(\d{1,2})$/,'$1-$2');
}
function maskPhone(v){
  var d=onlyDigits(v);
  if(d.indexOf('55')===0&&d.length>11)d=d.slice(2);
  d=d.slice(0,11);
  if(d.length<=2)return d?'('+d:d;
  if(d.length<=6)return '('+d.slice(0,2)+') '+d.slice(2);
  if(d.length<=10)return '('+d.slice(0,2)+') '+d.slice(2,6)+'-'+d.slice(6);
  return '('+d.slice(0,2)+') '+d.slice(2,7)+'-'+d.slice(7);
}
function cpfOk(c){
  c=onlyDigits(c);
  if(c.length!==11||/^(\d)\1{10}$/.test(c))return false;
  for(var t=9;t<11;t++){
    var s=0;for(var i=0;i<t;i++)s+=(+c[i])*(t+1-i);
    if(((s*10)%11)%10!==+c[t])return false;
  }
  return true;
}
function ageOf(iso){
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||'');if(!m)return -1;
  var y=+m[1],mo=+m[2]-1,d=+m[3],b=new Date(y,mo,d);
  if(y<1900||b.getFullYear()!==y||b.getMonth()!==mo||b.getDate()!==d)return -1;
  var n=new Date(),a=n.getFullYear()-y;
  if(n.getMonth()<mo||(n.getMonth()===mo&&n.getDate()<d))a--;
  return a;
}
function todayIso(){var n=new Date(),p=function(x){return('0'+x).slice(-2)};return n.getFullYear()+'-'+p(n.getMonth()+1)+'-'+p(n.getDate())}

/* validadores por campo (data-v) — devolvem '' quando esta ok */
var V={
  name:function(v){v=v.trim();return v.length>=5&&v.split(/\s+/).length>=2?'':'Informe nome e sobrenome.'},
  email:function(v){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())?'':'Informe um e-mail válido.'},
  phone:function(v){var d=onlyDigits(v);if(d.indexOf('55')===0&&d.length>11)d=d.slice(2);return /^(?:[1-9][0-9])(?:[2-9][0-9]{7,8})$/.test(d)?'':'Informe um telefone válido com DDD.'},
  cpf:function(v){return cpfOk(v)?'':'CPF inválido. Confira os 11 números.'},
  birth:function(v){
    var a=ageOf(v);
    if(a<0)return 'Informe uma data de nascimento válida.';
    return a>=MINAGE?'':'Cadastro permitido apenas para maiores de 18 anos.';
  },
  pw:function(v){return v.length>=8&&/[A-Za-z]/.test(v)&&/\d/.test(v)?'':'Use no mínimo 8 caracteres, com letras e números.'},
  pwl:function(v){return v?'':'Informe a sua senha.'},
  consent:function(v,el){return el.checked?'':'É preciso aceitar para continuar.'}
};

/* ---------- criptografia do modo demo ---------- */
var enc=window.TextEncoder?new TextEncoder():null;
function hasCrypto(){return !!(window.crypto&&crypto.subtle&&enc)}
function hex(buf){return [].map.call(new Uint8Array(buf),function(b){return('0'+b.toString(16)).slice(-2)}).join('')}
function sha(s){return crypto.subtle.digest('SHA-256',enc.encode(s)).then(hex)}
function pbk(pw,salt){
  return crypto.subtle.importKey('raw',enc.encode(pw),'PBKDF2',false,['deriveBits']).then(function(k){
    return crypto.subtle.deriveBits({name:'PBKDF2',salt:enc.encode(salt),iterations:100000,hash:'SHA-256'},k,256);
  }).then(hex);
}
function rnd(){var a=new Uint8Array(16);crypto.getRandomValues(a);return hex(a)}

/* ---------- adaptador DEMO (so neste navegador) ---------- */
var demo={
  me:function(){var s=sget(KS);return Promise.resolve({user:s||null})},
  signup:function(d){
    if(!hasCrypto())return Promise.reject(err('NO_CRYPTO'));
    var users=sget(KU)||[],em=d.email.trim().toLowerCase(),cpf=onlyDigits(d.cpf);
    return sha('esquina:'+cpf).then(function(ch){
      if(users.some(function(u){return u.cpf===ch}))throw err('CPF_IN_USE');
      if(users.some(function(u){return u.email===em}))throw err('EMAIL_IN_USE');
      var salt=rnd();
      return pbk(d.password,salt).then(function(ph){
        users.push({email:em,name:d.name.trim(),phone:maskPhone(d.phone),cpf:ch,birth:d.birth,salt:salt,pw:ph,at:Date.now()});
        if(!sset(KU,users))throw err('STORAGE');
        var u={name:d.name.trim(),email:em,phone:maskPhone(d.phone),phoneVerified:false,cpfStatus:'pending'};sset(KS,u);return{user:u};
      });
    });
  },
  login:function(d){
    if(!hasCrypto())return Promise.reject(err('NO_CRYPTO'));
    var em=d.email.trim().toLowerCase(),u=(sget(KU)||[]).filter(function(x){return x.email===em})[0];
    if(!u)return Promise.reject(err('BAD_CREDENTIALS'));
    return pbk(d.password,u.salt).then(function(ph){
      if(ph!==u.pw)throw err('BAD_CREDENTIALS');
      var s={name:u.name,email:u.email,phone:u.phone||'',phoneVerified:false,cpfStatus:'pending'};sset(KS,s);return{user:s};
    });
  },
  complete:function(){return Promise.reject(err('UNAVAILABLE'))},
  forgot:function(){return Promise.resolve({ok:true})},
  logout:function(){sdel(KS);return Promise.resolve({ok:true})},
  saveProfile:function(d){var u=sget(KS)||{};u.name=d.name;u.phone=maskPhone(d.phone);u.birth=d.birth;u.address=d.address;sset(KS,u);return Promise.resolve({user:u})},
  deleteAccount:function(){sdel(KS);return Promise.resolve({ok:true})},
  orders:function(){return Promise.resolve({orders:(sget(KO)||[]).slice().reverse()})},
  addOrder:function(o){var l=sget(KO)||[],now=new Date().toISOString();l.push({id:'d'+Date.now(),code:o.code,status:'recebido',items:o.items,total:o.total,pay:o.pay,changeFor:o.changeFor,createdAt:now,updatedAt:now});sset(KO,l.slice(-50));return Promise.resolve({ok:true})}
};

/* ---------- adaptador API (servidor) ---------- */
function call(path,method,body){
  return fetch(API+path,{
    method:method,credentials:'same-origin',
    headers:{'Content-Type':'application/json','X-Requested-With':'esquina'},
    body:body?JSON.stringify(body):undefined
  }).then(function(r){
    return r.json().catch(function(){return{}}).then(function(j){
      if(r.ok)return j;
      var e=err(j.code||(r.status===404||r.status>=500?'UNAVAILABLE':'HTTP_'+r.status),j.error);
      e.status=r.status;throw e;
    });
  },function(){throw err('OFFLINE')});
}
var api={
  me:function(){return call('/me','GET').catch(function(){return{user:null}})},
  signup:function(d){return call('/signup','POST',{name:d.name.trim(),email:d.email.trim(),phone:d.phone,cpf:onlyDigits(d.cpf),birth:d.birth,password:d.password,consent:true,returnTo:d.returnTo})},
  login:function(d){return call('/login','POST',{email:d.email.trim(),password:d.password})},
  complete:function(d){return call('/complete','POST',{phone:d.phone,cpf:onlyDigits(d.cpf),birth:d.birth,consent:true})},
  forgot:function(d){return call('/forgot','POST',{email:d.email.trim()})},
  resend:function(d){return call('/resend','POST',{email:d.email.trim(),returnTo:d.returnTo})},
  forgotEmail:function(d){return call('/forgot-email','POST',{cpf:onlyDigits(d.cpf),birth:d.birth})},
  logout:function(){return call('/logout','POST')},
  saveProfile:function(d){return call('/session','POST',Object.assign({action:'profile'},d))},
  deleteAccount:function(){return call('/session','POST',{action:'delete',confirm:'ENCERRAR'})},
  orders:function(){return fetch('/api/orders',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{'X-Requested-With':'esquina'}}).then(function(r){
    return r.json().catch(function(){return{}}).then(function(j){if(r.ok)return j;var e=err(j.code||(r.status===401?'UNAUTH':'UNAVAILABLE'));e.status=r.status;throw e});
  },function(){throw err('OFFLINE')})},
  addOrder:function(o){return fetch('/api/orders',{method:'POST',credentials:'same-origin',keepalive:true,headers:{'Content-Type':'application/json','X-Requested-With':'esquina'},body:JSON.stringify(o)}).then(function(r){
    return r.json().catch(function(){return{}}).then(function(j){if(r.ok)return j;var e=err(j.code||'UNAVAILABLE');e.status=r.status;throw e});
  },function(){throw err('OFFLINE')})}
};
var A=MODE==='api'?api:demo;

var MSG={
  BAD_CREDENTIALS:'E-mail ou senha incorretos.',
  EMAIL_NOT_VERIFIED:'Seu e-mail ainda não foi confirmado. Abra o link enviado para concluir o cadastro.',
  CPF_IN_USE:'Este CPF já possui cadastro. Entre na sua conta ou recupere o acesso.',
  EMAIL_CONFIRMATION_NOT_ENFORCED:'A confirmação de e-mail precisa ser ativada nas configurações do serviço.',
  AUTH_CONFIGURATION_MISSING:'O serviço de contas ainda está em configuração. Tente novamente mais tarde.',
  INVALID_NAME:'Informe nome e sobrenome.',
  INVALID_EMAIL:'Informe um e-mail válido.',
  PHONE_INVALID:'Informe um telefone válido com DDD.',
  WEAK_PASSWORD:'Use no mínimo 8 caracteres, com letras e números.',
  CONSENT_REQUIRED:'É necessário aceitar o uso dos dados para concluir o cadastro.',
  UNDERAGE_OR_INVALID_BIRTH:'Cadastro permitido apenas para maiores de 18 anos.',
  CPF_IN_USE:'Este CPF já possui cadastro. Entre na sua conta ou recupere a senha.',
  EMAIL_IN_USE:'Este e-mail já possui cadastro. Entre na sua conta.',
  CPF_INVALID:'CPF inválido. Confira os dígitos informados.',
  CPF_NOT_MATCH:'Os dados informados não conferem. Verifique e tente novamente.',
  UNDERAGE:'Cadastro permitido apenas para maiores de 18 anos.',
  RATE_LIMIT:'Muitas tentativas. Aguarde alguns minutos e tente de novo.',
  OFFLINE:'Sem conexão com a internet. Verifique e tente novamente.',
  UNAVAILABLE:'Serviço de cadastro indisponível no momento. Tente novamente em instantes.',
  NO_CRYPTO:'Este navegador não suporta o recurso seguro necessário. Use uma versão atualizada.',
  STORAGE:'Não foi possível salvar neste aparelho (armazenamento bloqueado).'
};
var FIELD={CPF_IN_USE:'cpf',CPF_INVALID:'cpf',CPF_NOT_MATCH:'cpf',EMAIL_IN_USE:'email',UNDERAGE:'birth',PHONE_INVALID:'phone'};

/* ---------- marcação do modal ---------- */
var EYE='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
var GLOGO='<svg viewBox="0 0 18 18" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2045c0-.638-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2582h2.9086c1.7018-1.5668 2.6837-3.8741 2.6837-6.6155z"/><path fill="#34A853" d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9086-2.2582c-.806.54-1.8368.859-3.0477.859-2.344 0-4.3282-1.5832-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z"/><path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.2823-1.1168-.2823-1.71s.1023-1.17.2823-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z"/><path fill="#EA4335" d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.426 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.656 3.5795 9 3.5795z"/></svg>';
function pwField(id,label,ac,v){
  return '<div class="au-f"><label for="'+id+'">'+label+'</label><div class="au-pw"><input id="'+id+'" name="password" type="password" autocomplete="'+ac+'" data-v="'+v+'" aria-describedby="'+id+'-e" autocapitalize="none" spellcheck="false" required><button type="button" class="au-eye" aria-label="Mostrar senha" aria-pressed="false">'+EYE+'</button></div><p class="au-err" id="'+id+'-e"></p></div>';
}
function field(id,label,attrs,v,hint){
  return '<div class="au-f"><label for="'+id+'">'+label+'</label><input id="'+id+'" data-v="'+v+'" aria-describedby="'+id+'-e'+(hint?' '+id+'-h':'')+'" '+attrs+' required>'+(hint?'<p class="au-hint" id="'+id+'-h">'+hint+'</p>':'')+'<p class="au-err" id="'+id+'-e"></p></div>';
}
function consent(id,txt){
  return '<div class="au-f"><label class="au-chk" for="'+id+'"><input type="checkbox" id="'+id+'" data-v="consent" aria-describedby="'+id+'-e"><span>'+txt+'</span></label><p class="au-err" id="'+id+'-e"></p></div>';
}
var CPFHINT=MODE==='api'?'Um CPF por conta. O site verifica os dígitos e guarda apenas um código protegido; não consulta a Receita Federal.':'Um CPF por conta.';
var CPFATTR='name="cpf" type="text" inputmode="numeric" autocomplete="off" maxlength="14" placeholder="000.000.000-00"';
var BIRTHATTR='name="birth" type="date" autocomplete="bday" min="1900-01-01"';
var CONSENT='Autorizo o uso do meu CPF e dos meus dados para validar minha identidade e evitar contas duplicadas, conforme a LGPD. Declaro ter 18 anos ou mais.';

function tpl(){
  return ''+
  '<div class="au__card" role="dialog" aria-modal="true" aria-labelledby="au-t" tabindex="-1">'+
    '<button type="button" class="au__x" data-act="close" aria-label="Fechar"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'+
    '<div class="au__head"><img class="au__logo" src="assets/logo.webp" width="52" height="52" alt=""><h2 class="au__title" id="au-t" tabindex="-1">Entrar</h2></div>'+

    '<div class="au-tabs" role="tablist" aria-label="Acesso" data-tabs>'+
      '<button type="button" class="au-tab" role="tab" id="au-tab-login" aria-controls="au-p-login" data-go="login">Entrar</button>'+
      '<button type="button" class="au-tab" role="tab" id="au-tab-signup" aria-controls="au-p-signup" data-go="signup">Criar conta</button>'+
    '</div>'+

    /* ENTRAR */
    '<section id="au-p-login" role="tabpanel" aria-labelledby="au-tab-login" data-view="login">'+
      '<button type="button" class="au-g" data-act="google">'+GLOGO+'<span>Entrar com Google</span></button>'+
      '<div class="au-or" aria-hidden="true">ou com e-mail</div>'+
      '<form class="au-form" data-form="login" novalidate>'+
        field('l-email','E-mail','name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="voce@email.com"','email')+
        pwField('l-pw','Senha','current-password','pwl')+
        '<p class="au-st" role="status" aria-live="polite"></p>'+
        '<button type="submit" class="au-btn">Entrar</button>'+
        '<button type="button" class="au-link" data-go="forgot">Esqueci minha senha</button>'+
        '<button type="button" class="au-link" data-act="resend">Reenviar confirmação de e-mail</button>'+
        '<button type="button" class="au-link" data-go="forgotEmail">Esqueci meu e-mail</button>'+
        '<button type="button" class="au-link" data-act="whatsapp-pending">Preciso de ajuda para confirmar pelo WhatsApp</button>'+
      '</form>'+
    '</section>'+

    /* CRIAR CONTA */
    '<section id="au-p-signup" role="tabpanel" aria-labelledby="au-tab-signup" data-view="signup" hidden>'+
      '<button type="button" class="au-g" data-act="google">'+GLOGO+'<span>Cadastrar com Google</span></button>'+
      '<div class="au-or" aria-hidden="true">ou com e-mail pessoal</div>'+
      '<form class="au-form" data-form="signup" novalidate>'+
        field('s-name','Nome completo','name="name" type="text" autocomplete="name" placeholder="Nome e sobrenome"','name')+
        field('s-email','E-mail','name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="voce@email.com"','email')+
        field('s-phone','Telefone com DDD','name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="(11) 99999-9999"','phone')+
        '<p class="au-hint">Telefone obrigatório para contato da loja. Não enviaremos código por WhatsApp.</p>'+
        '<div class="au-row">'+
          field('s-cpf','CPF',CPFATTR,'cpf')+
          field('s-birth','Nascimento',BIRTHATTR,'birth')+
        '</div>'+
        '<p class="au-hint">'+CPFHINT+'</p>'+
        pwField('s-pw','Crie uma senha','new-password','pw')+
        consent('s-ok',CONSENT)+
        '<p class="au-st" role="status" aria-live="polite"></p>'+
        '<button type="submit" class="au-btn">Criar minha conta</button>'+
      '</form>'+
    '</section>'+

    /* CONCLUIR CADASTRO (apos Google) */
    '<section data-view="complete" hidden>'+
      '<p class="au-lead">Falta pouco! Para concluir o cadastro com o Google, informe seu telefone de contato, CPF e data de nascimento.</p>'+
      '<form class="au-form" data-form="complete" novalidate>'+
        field('c-phone','Telefone com DDD','name="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="16" placeholder="(11) 99999-9999"','phone')+
        '<p class="au-hint">Telefone obrigatório para contato da loja. Não enviaremos código por WhatsApp.</p>'+
        '<div class="au-row">'+field('c-cpf','CPF',CPFATTR,'cpf')+field('c-birth','Nascimento',BIRTHATTR,'birth')+'</div>'+
        '<p class="au-hint">'+CPFHINT+'</p>'+
        consent('c-ok',CONSENT)+
        '<p class="au-st" role="status" aria-live="polite"></p>'+
        '<button type="submit" class="au-btn">Concluir cadastro</button>'+
        '<button type="button" class="au-link" data-act="cancel-completion">Cancelar e voltar para entrar</button>'+
      '</form>'+
    '</section>'+

    /* RECUPERAR SENHA */
    '<section data-view="forgot" hidden>'+
      '<p class="au-lead">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos as instruções para criar uma nova senha.</p>'+
      '<form class="au-form" data-form="forgot" novalidate>'+
        field('f-email','E-mail','name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="voce@email.com"','email')+
        '<p class="au-st" role="status" aria-live="polite"></p>'+
        '<button type="submit" class="au-btn">Enviar instruções</button>'+
        '<button type="button" class="au-link" data-go="login">Voltar para entrar</button>'+
      '</form>'+
    '</section>'+

    /* RECUPERAR E-MAIL */
    '<section data-view="forgotEmail" hidden>'+
      '<p class="au-lead">Informe seu CPF e sua data de nascimento. Se os dados forem localizados, mostraremos apenas uma versão protegida do e-mail. Se precisar de ajuda, fale diretamente com a equipe da loja.</p>'+
      '<form class="au-form" data-form="forgotEmail" novalidate>'+
        field('fe-cpf','CPF',CPFATTR,'cpf')+
        field('fe-birth','Nascimento',BIRTHATTR,'birth')+
        '<p class="au-st" role="status" aria-live="polite"></p>'+
        '<button type="submit" class="au-btn">Localizar meu e-mail</button>'+
        '<button type="button" class="au-link" data-act="whatsapp-recovery">Preciso de ajuda pelo WhatsApp</button>'+
        '<button type="button" class="au-link" data-go="login">Voltar para entrar</button>'+
      '</form>'+
    '</section>'+

    /* MINHA CONTA */
    '<section data-view="account" hidden>'+
      '<div class="au-acc"><span class="au-av" id="a-av" aria-hidden="true"></span><div><strong id="a-name"></strong><small id="a-mail"></small></div></div>'+
      '<p class="au-st" role="status" aria-live="polite"></p>'+
      '<div class="au-acts">'+
        '<button type="button" class="au-btn" data-act="profile" data-acc="always">Editar meus dados</button>'+
        '<button type="button" class="au-btn au-btn--ghost" data-act="orders" data-acc="menu">Pedidos</button>'+
        '<button type="button" class="au-btn au-btn--ghost" data-act="logout" data-acc="menu">Sair da conta</button>'+
        '<button type="button" class="au-btn" data-act="close" data-acc="fresh">Fechar</button>'+
      '</div>'+
    '</section>'+
 
    '<section data-view="profile" hidden>'+
      '<p class="au-lead">Mantenha seus dados atualizados. O endereço salvo será sugerido automaticamente nos próximos pedidos.</p>'+
      '<p class="au-st" role="status" aria-live="polite"></p>'+
      '<form class="au-form" id="auProfileForm" novalidate>'+
        '<div class="au-f"><label for="auProfileName">Nome completo</label><input id="auProfileName" name="name" type="text" maxlength="120" autocomplete="name" required></div>'+
        '<div class="au-f"><label for="auProfilePhone">Telefone / WhatsApp</label><input id="auProfilePhone" name="phone" type="tel" inputmode="tel" maxlength="19" autocomplete="tel" required></div>'+
        '<div class="au-f"><label for="auProfileBirth">Data de nascimento</label><input id="auProfileBirth" name="birth" type="date" required><p class="au-hint">A data deve continuar compatível com os dados de identificação da conta. Apenas maiores de 18 anos podem manter cadastro.</p></div>'+
        '<div class="au-f"><label for="auProfileAddress">Endereço padrão de entrega</label><textarea id="auProfileAddress" name="address" rows="3" maxlength="300" placeholder="Rua, número, complemento, bairro e cidade"></textarea><p class="au-hint">Este endereço fica salvo na conta e será usado como sugestão. Você ainda poderá informar outro endereço em um pedido específico.</p></div>'+
        '<button type="submit" class="au-btn">Salvar alterações</button>'+
      '</form>'+
      '<div class="au-danger"><strong>Encerrar conta</strong><p>Esta ação exclui permanentemente sua conta e o histórico associado. Não poderá ser desfeita.</p><button type="button" class="au-btn au-btn--danger" data-act="delete-account">Encerrar minha conta</button></div>'+
      '<button type="button" class="au-btn au-btn--ghost" data-go="account">Voltar à minha conta</button>'+
    '</section>'+

    /* PEDIDOS (andamento em tempo real + historico) */
    '<section data-view="orders" hidden>'+
      '<p class="au-st" role="status" aria-live="polite"></p>'+
      '<div class="ord" id="o-box" aria-live="polite"></div>'+
      '<button type="button" class="au-btn au-btn--ghost" data-go="account">Voltar</button>'+
    '</section>'+

    (MODE==='demo'?'<p class="au-demo">Modo demonstração: os dados ficam salvos só neste aparelho e o CPF ainda não é consultado na Receita Federal.</p>':'')+
  '</div>';
}

/* ---------- controle de telas ---------- */
var TITLES={login:'Entrar',signup:'Criar conta',complete:'Concluir cadastro',forgot:'Recuperar senha',forgotEmail:'Recuperar e-mail',account:'Minha conta',profile:'Meus dados',orders:'Meus pedidos'};
function status(sec,type,txt){var s=$('.au-st',sec);if(!s)return;s.className='au-st'+(type?' is-'+type:'');s.textContent=txt||''}
function fieldErr(el,txt){
  var e=document.getElementById(el.id+'-e');
  if(e)e.textContent=txt||'';
  if(el.type==='checkbox')return;
  if(txt)el.setAttribute('aria-invalid','true');else el.removeAttribute('aria-invalid');
}
function clearAll(sec){$$('[data-v]',sec).forEach(function(i){fieldErr(i,'')});status(sec,'','')}

function setView(v,focus){
  if(v==='login'&&user)v='account';
  if(view==='orders'&&v!=='orders')stopOrders();
  view=v;
  $$('[data-view]').forEach(function(s){s.hidden=s.getAttribute('data-view')!==v});
  var tabs=v==='login'||v==='signup';
  $('[data-tabs]').hidden=!tabs;
  $$('.au-tab').forEach(function(t){t.setAttribute('aria-selected',String(t.getAttribute('data-go')===v));t.tabIndex=t.getAttribute('data-go')===v?0:-1});
  $('#au-t').textContent=TITLES[v]||'Entrar';
  var sec=$('[data-view="'+v+'"]');clearAll(sec);
  if(v==='account')paintAccount();
  if(v==='profile')paintProfile();
  if(v==='orders')startOrders();
  card.scrollTop=0;
  if(focus!==false){
    var fine=window.matchMedia&&matchMedia('(hover:hover) and (pointer:fine)').matches;   /* no celular nao abre o teclado sozinho */
    var f=v==='account'?$$('.au-acts [data-act]',sec).filter(function(x){return !x.hidden})[0]:(fine?$('input:not([type=checkbox])',sec):$('#au-t'));
    if(f)f.focus({preventScroll:true});
  }
}
function paintAccount(){
  $('#a-av').textContent=(user.name||'?').trim().charAt(0).toUpperCase();
  $('#a-name').textContent=user.name||'';
  $('#a-mail').textContent=user.email||'';
  /* logo apos entrar/cadastrar: so "Fechar"; ao reabrir a conta: "Pedidos" e "Sair da conta" */
  $('.au-acts [data-acc]').forEach(function(b){var mode=b.getAttribute('data-acc');b.hidden=mode!=='always'&&mode!==(fresh?'fresh':'menu')});
}
function paintProfile(){
  var f=$('#auProfileForm');if(!f||!user)return;
  f.elements.name.value=user.name||'';
  f.elements.phone.value=maskPhone(user.phone||'');
  f.elements.birth.value=user.birth||'';
  f.elements.address.value=user.address||'';
}
function saveProfile(form){
  if(busy)return;
  var d={name:form.elements.name.value.trim().replace(/\s+/g,' '),phone:form.elements.phone.value,birth:form.elements.birth.value,address:form.elements.address.value.trim()};
  if(d.name.length<5||d.name.split(/\s+/).length<2){status(form.parentNode,'err','Informe nome e sobrenome.');form.elements.name.focus();return}
  if(V.phone(d.phone)){status(form.parentNode,'err','Informe um telefone válido com DDD.');form.elements.phone.focus();return}
  if(V.birth(d.birth)){status(form.parentNode,'err',V.birth(d.birth));form.elements.birth.focus();return}
  if(d.address.length>300){status(form.parentNode,'err','O endereço deve ter até 300 caracteres.');return}
  lock(form,true,'Salvando…');
  A.saveProfile(d).then(function(r){user=r.user||Object.assign({},user,{name:d.name,phone:d.phone,birth:d.birth,address:d.address});paintBtn();paintAccount();status(form.parentNode,'ok','Seus dados foram atualizados com sucesso.');},function(e){fail(form,e)}).then(function(){lock(form,false)});
}
function deleteAccount(t){
  if(busy||!user)return;
  if(!window.confirm('Deseja realmente encerrar sua conta? Seus dados e histórico de pedidos serão excluídos permanentemente.'))return;
  busy=true;t.disabled=true;t.textContent='Encerrando…';
  A.deleteAccount().then(function(){user=null;paintBtn();close();},function(e){status($('[data-view="profile"]'),'err',MSG[e.code]||'Não foi possível encerrar a conta. Tente novamente.');}).then(function(){busy=false;t.disabled=false;t.textContent='Encerrar minha conta'});
}
function paintBtn(){
  try{document.dispatchEvent(new CustomEvent('esquina:user',{detail:user}))}catch(e){}
  btn.classList.toggle('is-in',!!user);
  btn.setAttribute('aria-label',user?'Minha conta — '+user.name:'Entrar ou criar conta');
  btn.title=user?'Minha conta':'Entrar ou criar conta';
}

function build(){
  if(root)return;
  root=document.createElement('div');
  root.className='au';root.id='authModal';root.hidden=true;
  root.innerHTML=tpl();
  document.body.appendChild(root);
  card=$('.au__card');
  var today=todayIso();
  $$('input[type=date]').forEach(function(i){i.max=today});

  /* fecha ao clicar fora do cartao */
  root.addEventListener('mousedown',function(e){if(e.target===root)close()});
  root.addEventListener('click',function(e){
    var t=e.target.closest('[data-go],[data-act],.au-eye');if(!t)return;
    if(t.hasAttribute('data-go')){setView(t.getAttribute('data-go'));return}
    if(t.classList.contains('au-eye')){
      var inp=t.parentNode.querySelector('input'),show=inp.type==='password';
      inp.type=show?'text':'password';t.setAttribute('aria-pressed',String(show));t.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha');return;
    }
    var a=t.getAttribute('data-act');
    if(a==='close')close();
    else if(a==='google')google(t);
    else if(a==='logout')logout(t);
    else if(a==='orders')setView('orders');
    else if(a==='profile')setView('profile');
    else if(a==='delete-account')deleteAccount(t);
    else if(a==='cancel-completion'&&view==='complete')logout(t);
    else if(a==='resend')resendConfirmation(t);
    else if(a==='whatsapp-recovery')whatsappRecovery();
    else if(a==='whatsapp-pending')whatsappPending();
  });
  /* mascara de CPF e limpeza de erro ao digitar */
  root.addEventListener('input',function(e){
    var i=e.target;if(!i.matches('input'))return;
    if(i.name==='cpf')i.value=maskCpf(i.value);
    if(i.name==='phone')i.value=maskPhone(i.value);
    if(i.getAttribute('aria-invalid')==='true'||(i.type==='checkbox'&&document.getElementById(i.id+'-e').textContent))fieldErr(i,'');
  });
  root.addEventListener('submit',function(e){if(e.target&&e.target.id==='auProfileForm'){e.preventDefault();saveProfile(e.target);return}onSubmit(e)});
  root.addEventListener('keydown',onKey);
}

/* teclado: Esc fecha, Tab fica preso dentro do modal, setas trocam de aba */
function onKey(e){
  if(e.key==='Escape'){e.preventDefault();close();return}
  if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&e.target.classList.contains('au-tab')){
    e.preventDefault();setView(e.target.getAttribute('data-go')==='login'?'signup':'login',false);
    var s=$('.au-tab[aria-selected="true"]');if(s)s.focus();return;
  }
  if(e.key!=='Tab')return;
  var f=$$('button,input,a[href],[tabindex="0"]',card).filter(function(x){return !x.disabled&&x.tabIndex>=0&&x.offsetParent!==null});
  if(!f.length)return;
  var first=f[0],last=f[f.length-1];
  if(e.shiftKey&&(document.activeElement===first||document.activeElement===card||document.activeElement.id==='au-t')){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
}

function open(v,isFresh){
  build();
  lastFocus=document.activeElement;
  var target=v||(user?(user.needsCpf||user.needsPhone?'complete':'account'):'login');
  if(target==='account')fresh=!!isFresh;
  root.hidden=false;
  document.documentElement.classList.add('au-lock');
  btn.setAttribute('aria-expanded','true');
  setView(target);
}
function close(){
  if(!root||root.hidden)return;
  stopOrders();fresh=false;
  root.hidden=true;
  document.documentElement.classList.remove('au-lock');
  btn.setAttribute('aria-expanded','false');
  busy=false;
  if(lastFocus&&lastFocus.focus)lastFocus.focus({preventScroll:true});else btn.focus();
}

/* ---------- envio dos formularios ---------- */
function validate(form){
  var bad=null;
  $$('[data-v]',form).forEach(function(i){
    var m=V[i.getAttribute('data-v')](i.value||'',i);
    fieldErr(i,m);if(m&&!bad)bad=i;
  });
  if(bad)bad.focus();
  return !bad;
}
function data(form){
  var d={};$$('input',form).forEach(function(i){if(i.type!=='checkbox')d[i.name]=i.value});return d;
}
function lock(form,on,label){
  var b=$('.au-btn',form);if(!b)return;
  if(on){b.dataset.t=b.textContent;b.textContent=label||'Aguarde…';b.disabled=true}
  else{b.textContent=b.dataset.t||b.textContent;b.disabled=false}
  busy=on;
}
function fail(form,e){
  var code=e&&e.code,msg=MSG[code]||(e&&e.message&&code&&code.indexOf('HTTP_')!==0?e.message:'Não foi possível concluir. Tente novamente.');
  var key=FIELD[code],el=key&&$('[name="'+key+'"]',form);
  if(el){fieldErr(el,msg);el.focus()}
  else status(form.parentNode,'err',msg);
}
function signedIn(u,sec,welcome){
  user=u;paintBtn();
  if(user.needsCpf||user.needsPhone){setView('complete');status($('[data-view="complete"]'),'info','Para concluir, informe seu telefone de contato e os dados solicitados.');return;}
  fresh=true;setView('account');status($('[data-view="account"]'),'ok',welcome);
}
function resendConfirmation(t){
  if(busy)return;
  var sec=$('[data-view="login"]'),email=$('[name="email"]',sec).value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){status(sec,'err','Informe seu e-mail para reenviar a confirmação.');$('[name="email"]',sec).focus();return;}
  busy=true;t.disabled=true;var old=t.textContent;t.textContent='Enviando…';
  A.resend({email:email,returnTo:location.pathname+location.search+location.hash}).then(function(){status(sec,'ok','Se o cadastro estiver pendente, enviaremos um novo link de confirmação.');},function(){status(sec,'err','Não foi possível reenviar agora. Tente novamente ou fale com a loja.');}).then(function(){busy=false;t.disabled=false;t.textContent=old;});
}
function whatsappRecovery(){
  var phone=(document.querySelector('meta[name="esquina-whatsapp"]')||{}).content||'';
  phone=phone.replace(/\D/g,'');
  if(!phone){status($('[data-view="forgotEmail"]'),'err','O WhatsApp da loja ainda não foi configurado.');return;}
  var message='Olá! Preciso de ajuda para recuperar o acesso à minha conta da Esquina Mix.';
  window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank','noopener');
}
function whatsappPending(){
  var phone=(document.querySelector('meta[name="esquina-whatsapp"]')||{}).content||'';
  phone=phone.replace(/\D/g,'');
  if(!phone){status($('[data-view="login"]'),'err','O WhatsApp da loja ainda não foi configurado.');return;}
  var message='Olá! Preciso de ajuda manual para confirmar meu cadastro na Esquina Mix.';
  window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(message),'_blank','noopener');
}
function onSubmit(e){
  e.preventDefault();
  var form=e.target,name=form.getAttribute('data-form');
  if(busy||!validate(form))return;
  var d=data(form);status(form.parentNode,'','');
  if(name==='login'){
    lock(form,true,'Entrando…');
    A.login(d).then(function(r){lock(form,false);signedIn(r.user,form,'Login realizado. Bem-vindo de volta!')},function(x){lock(form,false);fail(form,x)});
  }else if(name==='signup'){
    lock(form,true,'Criando conta…');
    d.returnTo=location.pathname+location.search+location.hash;
    A.signup(d).then(function(r){
      lock(form,false);
      if(r&&r.pending){setView('login');status($('[data-view="login"]'),'ok','Cadastro iniciado. Enviamos um link de confirmação para seu e-mail. Abra o link para ativar a conta e retornar ao site.');}
      else signedIn(r.user,form,'Conta criada com sucesso. Bem-vindo à Esquina Mix!');
    },function(x){lock(form,false);fail(form,x)});
  }else if(name==='complete'){
    lock(form,true,'Validando…');
    A.complete(d).then(function(r){lock(form,false);signedIn(r.user,form,'Cadastro concluído!')},function(x){lock(form,false);fail(form,x)});
  }else if(name==='forgot'){
    lock(form,true,'Enviando…');
    A.forgot(d).then(function(){lock(form,false);status(form.parentNode,'ok','Se o e-mail estiver cadastrado, você receberá as instruções em instantes.')},function(x){lock(form,false);fail(form,x)});
  }else if(name==='forgotEmail'){
    lock(form,true,'Consultando…');
    A.forgotEmail(d).then(function(r){
      lock(form,false);
      status(form.parentNode,'ok',r&&r.emailMasked?'E-mail localizado: '+r.emailMasked+'. Se não reconhecer o endereço, solicite ajuda pelo WhatsApp da loja.':'Não foi possível localizar o e-mail com os dados informados. Confira os dados ou fale com a loja pelo WhatsApp.');
    },function(x){lock(form,false);fail(form,x)});
  }
}
function google(t){
  var sec=t.closest('[data-view]');
  if(MODE!=='api'){
    status(sec,'info','O login com Google será ativado quando o servidor de autenticação for conectado. Por enquanto, use o e-mail.');
    return;
  }
  location.assign(API+'/google?next='+encodeURIComponent(location.pathname+location.search+location.hash));
}
function logout(t){
  if(busy)return;busy=true;t.disabled=true;
  A.logout().then(function(){},function(){}).then(function(){
    user=null;busy=false;t.disabled=false;paintBtn();setView('login');
    status($('[data-view="login"]'),'ok','Você saiu da conta.');
  });
}

/* ---------- pedidos: andamento em tempo real + historico ---------- */
var STEPS=[['recebido','Recebido'],['em_preparo','Em preparo'],['pronto','Pronto'],['entregue','Entregue']];
var STL={recebido:'Pedido recebido',em_preparo:'Em preparo',pronto:'Pronto',entregue:'Entregue',cancelado:'Cancelado'};
var ordSig='';
function brl(v){return Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}
function fdate(iso){
  try{return new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(iso)).replace(',',' às')}catch(e){return ''}
}
function h(tag,cls,txt){var e=document.createElement(tag);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e}
function isOpenOrder(o){return o.status!=='entregue'&&o.status!=='cancelado'}
function orderBody(o){
  var f=document.createDocumentFragment();
  if(isOpenOrder(o)){
    var idx=0;STEPS.forEach(function(st,i){if(st[0]===o.status)idx=i});
    var ol=h('ol','ord__steps');
    STEPS.forEach(function(st,i){
      var li=h('li',i<idx?'is-done':(i===idx?'is-now':''),st[1]);
      if(i===idx)li.setAttribute('aria-current','step');
      ol.appendChild(li);
    });
    f.appendChild(ol);
  }
  var ul=h('ul','ord__items');
  (o.items||[]).forEach(function(x){ul.appendChild(h('li',null,(x.q||1)+'× '+(x.n||'Item')))});
  f.appendChild(ul);
  var pay=o.pay?(' · '+o.pay+(o.changeFor?' (troco para '+brl(o.changeFor)+')':'')):'';
  f.appendChild(h('p','ord__tot','Total '+brl(o.total)+pay));
  return f;
}
function orderHead(o){
  var top=h('span','ord__top');
  top.appendChild(h('strong',null,'Pedido Nº '+(o.code||'—')));
  top.appendChild(h('span','ord__badge is-'+o.status,STL[o.status]||o.status));
  var wrap=h('span','ord__hd');
  wrap.appendChild(top);
  wrap.appendChild(h('small',null,fdate(o.createdAt)));
  return wrap;
}
function renderOrders(list){
  var box=$('#o-box');if(!box)return;
  var open=list.filter(isOpenOrder),past=list.filter(function(o){return !isOpenOrder(o)});
  box.textContent='';
  box.appendChild(h('p','ord__live','Atualizando automaticamente'));
  if(!list.length){
    box.appendChild(h('p','ord__empty','Você ainda não fez pedidos por aqui. Os pedidos enviados pela sacola, com você logado, aparecem neste painel.'));
    return;
  }
  box.appendChild(h('h3','ord__h','Em andamento'));
  if(!open.length)box.appendChild(h('p','ord__none','Nenhum pedido em andamento.'));
  open.forEach(function(o){
    var c=h('article','ord__card is-open');
    c.appendChild(orderHead(o));c.appendChild(orderBody(o));box.appendChild(c);
  });
  box.appendChild(h('h3','ord__h','Histórico'));
  if(!past.length)box.appendChild(h('p','ord__none','Seus pedidos finalizados aparecem aqui.'));
  past.forEach(function(o){
    var d=h('details','ord__card'),sm=h('summary','ord__sum');
    sm.appendChild(orderHead(o));d.appendChild(sm);d.appendChild(orderBody(o));box.appendChild(d);
  });
}
function loadOrders(quiet){
  if(ordBusy||!user)return;
  ordBusy=true;var my=ordSeq,sec=$('[data-view="orders"]');
  if(!quiet)status(sec,'info','Carregando seus pedidos…');
  A.orders().then(function(r){
    ordBusy=false;
    if(my!==ordSeq||view!=='orders')return;
    var list=(r&&r.orders)||[],sig=JSON.stringify(list.map(function(o){return[o.id,o.status,o.updatedAt]}));
    status(sec,'','');
    if(sig!==ordSig){ordSig=sig;renderOrders(list)}
  },function(e){
    ordBusy=false;
    if(my!==ordSeq||view!=='orders')return;
    if(e&&e.status===401){user=null;paintBtn();setView('login');status($('[data-view="login"]'),'err','Sua sessão expirou. Entre novamente.');return}
    if(!ordSig)status(sec,'err',MSG[e&&e.code]||'Não foi possível carregar seus pedidos agora. Tente novamente em instantes.');
  });
}
function startOrders(){
  stopOrders();ordSig='';
  var box=$('#o-box');if(box)box.textContent='';
  loadOrders(false);
  ordTimer=setInterval(function(){if(!document.hidden)loadOrders(true)},8000);
}
function stopOrders(){clearInterval(ordTimer);ordTimer=0;ordSeq++;ordBusy=false}
document.addEventListener('visibilitychange',function(){if(!document.hidden&&view==='orders'&&root&&!root.hidden)loadOrders(true)});
function recordOrder(o){
  if(!user)return Promise.reject(err('UNAUTH'));
  return A.addOrder(o).then(function(r){if(view==='orders'&&root&&!root.hidden)loadOrders(true);return r});
}

/* ---------- inicio ---------- */
btn.addEventListener('click',function(){open()});
paintBtn();
A.me().then(function(r){
  user=r&&r.user||null;paintBtn();
  /* volta do Google: se faltar CPF, abre direto a tela de conclusao */
  if(MODE==='api'&&/[?&]auth=/.test(location.search)){
    try{var u=new URL(location.href);u.searchParams.delete('auth');history.replaceState(null,'',u.pathname+u.search+u.hash)}catch(e){}
    if(user)open(user.needsCpf||user.needsPhone?'complete':'account',true);
  }
});
window.EsquinaAuth={open:open,close:close,recordOrder:recordOrder,mode:MODE,get user(){return user}};
})();
