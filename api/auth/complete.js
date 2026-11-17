'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['POST']);
    const c=A.config(),d=await A.body(req),user=await A.currentUser(req,res,c);
    if(!user) return A.send(res,401,{code:'UNAUTHENTICATED'});
    const cpf=A.digits(d.cpf),birth=String(d.birth||''),phone=A.normalizePhone(d.phone);
    if(!A.validCpf(cpf)) return A.send(res,400,{code:'CPF_INVALID'});
    if(!phone) return A.send(res,400,{code:'PHONE_INVALID'});
    if(!A.validBirth(birth)) return A.send(res,400,{code:'UNDERAGE_OR_INVALID_BIRTH'});
    if(d.consent!==true) return A.send(res,400,{code:'CONSENT_REQUIRED'});
    A.requireCpfSecret(c);
    await A.sbFetch(c,'/rest/v1/rpc/register_customer_profile',{method:'POST',admin:true,body:{
      p_user_id:user.id,p_full_name:user.name||String(d.name||'').trim(),
      p_birth_date:birth,p_cpf_hash:A.hash(cpf,c.cpfSecret),p_phone_e164:phone
    }});
    return A.send(res,200,{user:Object.assign({},user,{phone,phoneVerified:false,needsPhone:false,needsCpf:false,registrationStatus:'complete'})});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    if(e.message==='CPF_HASH_CONFIGURATION_MISSING') return A.send(res,503,{code:'CPF_HASH_CONFIGURATION_MISSING'});
    if(e.status===409||/duplicate|unique/i.test(e.message)) return A.send(res,409,{code:'CPF_IN_USE'});
    return A.send(res,503,{code:'UNAVAILABLE'});
  }
};
