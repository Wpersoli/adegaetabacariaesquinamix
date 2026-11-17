(function(){
'use strict';
var message=document.getElementById('confirm-message');
var form=document.getElementById('password-form');
var input=document.getElementById('new-password');
var back=document.getElementById('back-link');
var params=new URLSearchParams(location.search);
var mode=params.get('mode')||'signup';
var next=params.get('next')||'/';
if(!next.startsWith('/')||next.startsWith('//')||/[\r\n\\]/.test(next))next='/';
function say(text){message.textContent=text;}
function goHome(){back.hidden=false;}
function goNext(){
  var target=new URL(next,location.origin);
  if(target.origin!==location.origin)target=new URL('/',location.origin);
  if(mode!=='recovery')target.searchParams.set('auth','confirmed');
  location.replace(target.pathname+target.search+target.hash);
}
async function post(url,data,method){
  var r=await fetch(url,{method:method||'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Requested-With':'esquina'},body:JSON.stringify(data)});
  var j=await r.json().catch(function(){return{}});
  if(!r.ok)throw new Error(j.code||'REQUEST_FAILED');
  return j;
}
async function init(){
  var hash=new URLSearchParams(location.hash.replace(/^#/,''));
  var access=hash.get('access_token'),refresh=hash.get('refresh_token');
  var error=hash.get('error_description')||params.get('error_description');
  if(error){say('Não foi possível confirmar o link. Solicite um novo e-mail de confirmação ou fale com a loja.');goHome();return;}
  if(!access||!refresh){say('Link inválido ou expirado. Volte ao site e solicite um novo link.');goHome();return;}
  try{
    await post('/api/auth/session',{access_token:access,refresh_token:refresh});
    history.replaceState(null,'',location.pathname+location.search);
    if(mode==='recovery'){
      say('Identidade confirmada. Defina uma nova senha para sua conta.');
      form.hidden=false;
      input.focus();
      return;
    }
    say('E-mail confirmado. Você será redirecionado para continuar de onde parou.');
    setTimeout(goNext,900);
  }catch(e){
    say('Não foi possível validar este link. Ele pode ter expirado ou já ter sido utilizado. Solicite um novo.');
    goHome();
  }
}
form.addEventListener('submit',async function(e){
  e.preventDefault();
  var password=input.value;
  if(password.length<8||!/[A-Za-z]/.test(password)||!/\d/.test(password)){
    say('A senha precisa ter pelo menos 8 caracteres, com letras e números.');return;
  }
  var button=form.querySelector('button');button.disabled=true;button.textContent='Salvando…';
  try{
    await post('/api/auth/password',{password},'PUT');
    say('Senha atualizada. Voltando para sua conta…');
    setTimeout(goNext,900);
  }catch(err){
    say('Não foi possível atualizar a senha. Tente novamente.');
    button.disabled=false;button.textContent='Salvar nova senha';
  }
});
init();
})();
