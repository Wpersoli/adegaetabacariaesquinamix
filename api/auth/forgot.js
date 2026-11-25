'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['POST']);
    if(!A.sameOrigin(req)) return A.send(res,403,{code:'ORIGIN_NOT_ALLOWED'});
    const c=A.config(),d=await A.body(req);
    const email=String(d.email||'').trim().toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return A.send(res,400,{code:'INVALID_EMAIL'});
    const redirect=c.site+'/auth/confirm.html?mode=recovery';
    try{
      await A.sbFetch(c,'/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{method:'POST',body:{email}});
    }catch(_){}
    return A.send(res,200,{ok:true});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    return A.send(res,503,{code:'UNAVAILABLE'});
  }
};
