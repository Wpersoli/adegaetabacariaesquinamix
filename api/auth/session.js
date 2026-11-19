'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['POST']);
    const c=A.config(),d=await A.body(req);
    if(d.action==='profile'){
      const jar=A.cookies(req),user=await A.currentUser(req,res,c),access=req.esquinaAccessToken||jar.esquina_access;
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
      catch(e){try{await A.sbFetch(c,'/auth/v1/user',{method:'PUT',token:access,body:{data:previous}})}catch(_){}return A.send(res,503,{code:'PROFILE_UPDATE_UNAVAILABLE',error:'Não foi possível salvar os dados. Tente novamente.'})}
      const refreshed=await A.sbFetch(c,'/auth/v1/user',{token:access});
      return A.send(res,200,{user:await A.profileFor(c,refreshed,access)});
    }
    if(d.action==='delete'){
      const jar=A.cookies(req),user=await A.currentUser(req,res,c),access=req.esquinaAccessToken||jar.esquina_access;
      if(!user||!access)return A.send(res,401,{code:'UNAUTHENTICATED'});
      if(d.confirm!=='ENCERRAR')return A.send(res,400,{code:'CONFIRMATION_REQUIRED'});
      try{
        // Revoga todos os refresh tokens antes da exclusão. JWTs de acesso já emitidos
        // só expiram no prazo original; currentUser também confirma a existência da conta.
        await A.sbFetch(c,'/auth/v1/logout?scope=global',{method:'POST',token:access});
        await A.sbFetch(c,'/auth/v1/admin/users/'+encodeURIComponent(user.id),{method:'DELETE',admin:true});
      }catch(e){return A.send(res,503,{code:'ACCOUNT_DELETE_UNAVAILABLE'})}
      A.clearSession(res);
      return A.send(res,200,{ok:true});
    }
    const access=String(d.access_token||''),refresh=String(d.refresh_token||'');
    if(!access||!refresh) return A.send(res,400,{code:'INVALID_SESSION'});
    const user=await A.sbFetch(c,'/auth/v1/user',{token:access});
    if(!(await A.authUserExists(c,user.id))) return A.send(res,401,{code:'UNAUTHENTICATED'});
    if(!user.email_confirmed_at&&!user.confirmed_at) return A.send(res,403,{code:'EMAIL_NOT_VERIFIED'});
    A.setSession(res,{access_token:access,refresh_token:refresh,expires_in:3600});
    return A.send(res,200,{user:await A.profileFor(c,user,access)});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    if(e.message==='AUTH_CONFIGURATION_MISSING') return A.send(res,503,{code:'AUTH_CONFIGURATION_MISSING'});
    if(e.message==='AUTH_USER_LOOKUP_UNAVAILABLE'||e.message==='PROFILE_LOOKUP_UNAVAILABLE'||(e.status&&e.status>=500)) return A.send(res,503,{code:'UNAVAILABLE'});
    return A.send(res,401,{code:'INVALID_SESSION'});
  }
};
