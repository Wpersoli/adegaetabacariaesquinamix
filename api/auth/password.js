'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['PUT']);
    const c=A.config(),d=await A.body(req),jar=A.cookies(req);
    const password=String(d.password||'');
    if(password.length<8||!/[A-Za-z]/.test(password)||!/\d/.test(password)) return A.send(res,400,{code:'WEAK_PASSWORD'});
    if(!jar.esquina_access) return A.send(res,401,{code:'UNAUTHENTICATED'});
    await A.sbFetch(c,'/auth/v1/user',{method:'PUT',token:jar.esquina_access,body:{password}});
    return A.send(res,200,{ok:true});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    return A.send(res,401,{code:'UNAUTHENTICATED'});
  }
};
