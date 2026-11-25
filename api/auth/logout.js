'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['POST']);
    if(!A.sameOrigin(req)) return A.send(res,403,{code:'ORIGIN_NOT_ALLOWED'});
    const c=A.config(),jar=A.cookies(req);
    if(jar.esquina_access){
      try{await A.sbFetch(c,'/auth/v1/logout?scope=local',{method:'POST',token:jar.esquina_access});}catch(_){}
    }
    A.clearSession(res);
    return A.send(res,200,{ok:true});
  }catch(e){
    A.clearSession(res);
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    return A.send(res,200,{ok:true});
  }
};
