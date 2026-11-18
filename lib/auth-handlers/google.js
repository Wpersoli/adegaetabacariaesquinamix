'use strict';
const A=require('../esquina-auth');
module.exports=function(req,res){
  try{
    A.method(req,['GET']);
    const c=A.config();
    const next=A.safeNext(req.query&&req.query.next||'/');
    const redirect=A.confirmationUrl(c,next);
    const target=c.url+'/auth/v1/authorize?provider=google&redirect_to='+encodeURIComponent(redirect)+'&apikey='+encodeURIComponent(c.anon);
    res.statusCode=302;
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Location',target);
    res.end();
  }catch(e){
    res.statusCode=503;
    res.setHeader('Content-Type','text/plain; charset=utf-8');
    res.end('Login com Google indisponível. Verifique a configuração OAuth no Supabase.');
  }
};
