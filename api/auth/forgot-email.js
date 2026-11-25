'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['POST']);
    if(!A.sameOrigin(req)) return A.send(res,403,{code:'ORIGIN_NOT_ALLOWED'});
    const c=A.config(),d=await A.body(req);
    const cpf=A.digits(d.cpf),birth=String(d.birth||'');
    if(!A.validCpf(cpf)||!A.validBirth(birth)) return A.send(res,400,{code:'IDENTITY_NOT_MATCHED'});
    A.requireCpfSecret(c);
    const ipHash=A.hash(A.clientIp(req),c.cpfSecret);
    const rows=await A.sbFetch(c,'/rest/v1/rpc/lookup_customer_identity',{method:'POST',admin:true,body:{
      p_cpf_hash:A.hash(cpf,c.cpfSecret),p_birth_date:birth,p_ip_hash:ipHash
    }});
    const userId=typeof rows==='string'?rows:(rows&&rows.user_id)||null;
    if(!userId) return A.send(res,200,{ok:true,emailMasked:null});
    const account=await A.sbFetch(c,'/auth/v1/admin/users/'+encodeURIComponent(userId),{admin:true});
    return A.send(res,200,{ok:true,emailMasked:A.maskEmail(account.email)});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    if(e.message==='AUTH_CONFIGURATION_MISSING') return A.send(res,503,{code:'AUTH_CONFIGURATION_MISSING'});
    if(e.message==='CPF_HASH_CONFIGURATION_MISSING') return A.send(res,503,{code:'CPF_HASH_CONFIGURATION_MISSING'});
    return A.send(res,200,{ok:true,emailMasked:null});
  }
};
