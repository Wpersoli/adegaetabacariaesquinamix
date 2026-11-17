'use strict';
const A = require('../../lib/esquina-auth');
module.exports = async function(req, res) {
  try {
    A.method(req, ['POST']);
    const c = A.config();
    const d = await A.body(req);
    const name = String(d.name || '').trim().replace(/\s+/g, ' ');
    const email = String(d.email || '').trim().toLowerCase();
    const cpf = A.digits(d.cpf);
    const birth = String(d.birth || '');
    const password = String(d.password || '');
    if (name.length < 5 || name.split(' ').length < 2) return A.send(res, 400, {code:'INVALID_NAME'});
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return A.send(res, 400, {code:'INVALID_EMAIL'});
    if (!A.validCpf(cpf)) return A.send(res, 400, {code:'CPF_INVALID'});
    if (!A.validBirth(birth)) return A.send(res, 400, {code:'UNDERAGE_OR_INVALID_BIRTH'});
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return A.send(res, 400, {code:'WEAK_PASSWORD'});
    if (d.consent !== true) return A.send(res, 400, {code:'CONSENT_REQUIRED'});
    const redirect = A.confirmationUrl(c, d.returnTo);
    const created = await A.sbFetch(c, '/auth/v1/signup?redirect_to=' + encodeURIComponent(redirect), {
      method:'POST',
      body:{email,password,data:{full_name:name}}
    });
    const user = created.user || created;
    if (!user || !user.id) return A.send(res, 409, {code:'SIGNUP_FAILED'});
    if (created.session || user.email_confirmed_at || user.confirmed_at) {
      await A.deleteAuthUser(c, user.id);
      return A.send(res, 503, {code:'EMAIL_CONFIRMATION_NOT_ENFORCED'});
    }
    try {
      await A.sbFetch(c, '/rest/v1/rpc/register_customer_profile', {
        method:'POST', admin:true,
        body:{
          p_user_id:user.id,
          p_full_name:name,
          p_birth_date:birth,
          p_cpf_hash:A.hash(cpf,c.cpfSecret)
        }
      });
    } catch (e) {
      await A.deleteAuthUser(c, user.id);
      if (e.status === 409 || /duplicate|unique/i.test(e.message)) return A.send(res, 409, {code:'CPF_IN_USE'});
      throw e;
    }
    return A.send(res, 202, {pending:true,user:{name,email,cpfStatus:'pending'}});
  } catch (e) {
    if (e.message === 'METHOD_NOT_ALLOWED') return A.send(res,405,{code:'METHOD_NOT_ALLOWED'});
    if (e.message === 'AUTH_CONFIGURATION_MISSING') return A.send(res,503,{code:'AUTH_CONFIGURATION_MISSING'});
    return A.send(res,503,{code:'UNAVAILABLE',error:'Não foi possível criar sua conta agora.'});
  }
};
