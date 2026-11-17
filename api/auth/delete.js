'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
 try{
  A.method(req,['POST']);
  const c=A.config(),d=await A.body(req);
  const user=await A.currentUser(req,res,c);
  if(!user)return A.send(res,401,{code:'UNAUTHENTICATED'});
  if(d.confirm!=='ENCERRAR')return A.send(res,400,{code:'CONFIRMATION_REQUIRED'});
  await A.sbFetch(c,'/auth/v1/admin/users/'+encodeURIComponent(user.id),{method:'DELETE',admin:true});
  A.clearSession(res);
  return A.send(res,200,{ok:true});
 }catch(e){
  if(e.message==='METHOD_NOT_ALLOWED')return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
  if(e.message==='AUTH_CONFIGURATION_MISSING')return A.send(res,503,{code:'AUTH_CONFIGURATION_MISSING'});
  return A.send(res,503,{code:'ACCOUNT_DELETE_UNAVAILABLE'});
 }
};