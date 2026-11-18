'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['POST']);
    const c=A.config(),d=await A.body(req),u=await A.currentUser(req,res,c);
    if(!u) return A.send(res,401,{code:'UNAUTHENTICATED'});
    if(d.confirmation!=='ENCERRAR') return A.send(res,400,{code:'CONFIRMATION_REQUIRED'});
    await A.sbFetch(c,'/auth/v1/admin/users/'+encodeURIComponent(u.id),{method:'DELETE',admin:true});
    A.clearSession(res);
    return A.send(res,200,{ok:true});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    return A.send(res,503,{code:'UNAVAILABLE'});
  }
};
