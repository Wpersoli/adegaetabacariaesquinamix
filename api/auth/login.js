'use strict';
const A = require('../../lib/esquina-auth');
module.exports = async function(req,res) {
  try {
    A.method(req,['POST']);
    const c=A.config(),d=await A.body(req);
    const email=String(d.email||'').trim().toLowerCase(),password=String(d.password||'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)||!password) return A.send(res,400,{code:'BAD_CREDENTIALS'});
    const session=await A.sbFetch(c,'/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
    if(!session.access_token||!session.refresh_token||!session.user) return A.send(res,401,{code:'BAD_CREDENTIALS'});
    if(!session.user.email_confirmed_at&&!session.user.confirmed_at) return A.send(res,403,{code:'EMAIL_NOT_VERIFIED'});
    A.setSession(res,session);
    const user=await A.profileFor(c,session.user,session.access_token);
    return A.send(res,200,{user});
  } catch(e) {
    if(e.message==='METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    if(e.message==='AUTH_CONFIGURATION_MISSING') return A.send(res,503,{code:'AUTH_CONFIGURATION_MISSING'});
    if(e.code==='email_not_confirmed') return A.send(res,403,{code:'EMAIL_NOT_VERIFIED'});
    return A.send(res,e.status===400||e.status===401||e.status===403?401:503,{code:e.status===400||e.status===401||e.status===403?'BAD_CREDENTIALS':'UNAVAILABLE'});
  }
};
