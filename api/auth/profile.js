'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
 try{
  A.method(req,['POST']);
  const c=A.config(),d=await A.body(req),jar=A.cookies(req);
  const user=await A.currentUser(req,res,c),access=req.esquinaAccessToken||jar.esquina_access;
  if(!user||!access)return A.send(res,401,{code:'UNAUTHENTICATED'});
  const name=String(d.name||'').trim().replace(/\s+/g,' '),phone=A.normalizePhone(d.phone),birth=String(d.birth||'');
  const address=String(d.address||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ');
  if(name.length<5||name.split(' ').length<2)return A.send(res,400,{code:'INVALID_NAME'});
  if(!phone)return A.send(res,400,{code:'PHONE_INVALID'});
  if(!A.validBirth(birth))return A.send(res,400,{code:'UNDERAGE_OR_INVALID_BIRTH'});
  if(address.length>300)return A.send(res,400,{code:'ADDRESS_INVALID'});
  const current=await A.sbFetch(c,'/auth/v1/user',{token:access}),previous=current.user_metadata||{};
  await A.sbFetch(c,'/auth/v1/user',{method:'PUT',token:access,body:{data:Object.assign({},previous,{full_name:name,phone_e164:phone,birth_date:birth,delivery_address:address})}});
  try{await A.sbFetch(c,'/rest/v1/rpc/update_customer_profile',{method:'POST',admin:true,body:{p_user_id:user.id,p_full_name:name,p_birth_date:birth,p_phone_e164:phone}})}
  catch(e){try{await A.sbFetch(c,'/auth/v1/user',{method:'PUT',token:access,body:{data:previous}})}catch(_){}throw e}
  const refreshed=await A.sbFetch(c,'/auth/v1/user',{token:access});
  return A.send(res,200,{user:await A.profileFor(c,refreshed,access)});
 }catch(e){
  if(e.message==='METHOD_NOT_ALLOWED')return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
  if(e.message==='AUTH_CONFIGURATION_MISSING')return A.send(res,503,{code:'AUTH_CONFIGURATION_MISSING'});
  if(e.status===400)return A.send(res,400,{code:'PROFILE_UPDATE_INVALID'});
  return A.send(res,503,{code:'PROFILE_UPDATE_UNAVAILABLE',error:'Não foi possível salvar os dados. Tente novamente.'});
 }
};