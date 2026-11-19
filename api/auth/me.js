'use strict';
const A=require('../../lib/esquina-auth');
module.exports=async function(req,res){
  try{
    A.method(req,['GET']);
    const c=A.config();
    const user=await A.currentUser(req,res,c);
    return user?A.send(res,200,{user}):A.send(res,401,{user:null});
  }catch(e){
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    if(e.message==='AUTH_CONFIGURATION_MISSING') return A.send(res,503,{code:'AUTH_CONFIGURATION_MISSING'});
    return A.send(res,503,{code:'UNAVAILABLE'});
  }
};
