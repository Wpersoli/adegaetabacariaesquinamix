'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['PATCH']);
    const c=A.config(),d=await A.body(req),u=await A.currentUser(req,res,c);
    if(!u) return A.send(res,401,{code:'UNAUTHENTICATED'});
    const name=String(d.name||'').trim().replace(/\\s+/g,' ');
    const phone=A.normalizePhone(d.phone);
    const birth=String(d.birth||'');
    const address=String(d.address||'').trim();
    if(name.length<5||name.split(' ').length<2) return A.send(res,400,{code:'INVALID_NAME'});
    if(!phone) return A.send(res,400,{code:'PHONE_INVALID'});
    if(!A.validBirth(birth)) return A.send(res,400,{code:'UNDERAGE_OR_INVALID_BIRTH'});
    if(address.length>500) return A.send(res,400,{code:'ADDRESS_TOO_LONG'});
    await A.sbFetch(c,'/rest/v1/rpc/update_customer_profile',{
      method:'POST',admin:true,body:{
        p_user_id:u.id,p_full_name:name,p_birth_date:birth,
        p_phone_e164:phone,p_delivery_address:address
      }
    });
    return A.send(res,200,{user:Object.assign({},u,{name,phone,birth,address,phoneVerified:u.phone===phone?u.phoneVerified:false,needsPhone:false,needsCpf:false})});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    return A.send(res,e.status&&e.status<500?e.status:503,{code:e.message==='AUTH_CONFIGURATION_MISSING'?'AUTH_CONFIGURATION_MISSING':'UNAVAILABLE'});
  }
};
