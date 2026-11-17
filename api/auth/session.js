'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['POST']);
    const c=A.config(),d=await A.body(req);
    const access=String(d.access_token||''),refresh=String(d.refresh_token||'');
    if(!access||!refresh) return A.send(res,400,{code:'INVALID_SESSION'});
    const user=await A.sbFetch(c,'/auth/v1/user',{token:access});
    if(!user.email_confirmed_at&&!user.confirmed_at) return A.send(res,403,{code:'EMAIL_NOT_VERIFIED'});
    A.setSession(res,{access_token:access,refresh_token:refresh,expires_in:3600});
    return A.send(res,200,{user:await A.profileFor(c,user,access)});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    if(e.message==='AUTH_CONFIGURATION_MISSING') return A.send(res,503,{code:'AUTH_CONFIGURATION_MISSING'});
    return A.send(res,401,{code:'INVALID_SESSION'});
  }
};
