'use strict';

const crypto = require('node:crypto');

function config() {
  const c = {
    url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    anon: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || '',
    service: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    site: (process.env.SITE_URL || 'https://adegaetabacariaesquinamix.vercel.app').replace(/\/+$/, ''),
    cpfSecret: process.env.CPF_HASH_SECRET || ''
  };
  if (!c.url || !c.anon || !c.service) {
    const e = new Error('AUTH_CONFIGURATION_MISSING');
    e.status = 503;
    throw e;
  }
  return c;
}

function requireCpfSecret(c) {
  const secret = String(c && c.cpfSecret || '');
  if (secret.length < 32) {
    const e = new Error('CPF_HASH_CONFIGURATION_MISSING');
    e.status = 503;
    throw e;
  }
  return secret;
}

function send(res, status, data, extra) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (extra) Object.keys(extra).forEach((k) => res.setHeader(k, extra[k]));
  res.end(JSON.stringify(data));
}

function method(req, allowed) {
  if (allowed.indexOf(req.method) === -1) {
    const e = new Error('METHOD_NOT_ALLOWED');
    e.status = 405;
    e.allow = allowed.join(', ');
    throw e;
  }
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16384) {
      const e = new Error('BODY_TOO_LARGE');
      e.status = 413;
      throw e;
    }
  }
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch (_) {
    const e = new Error('INVALID_JSON');
    e.status = 400;
    throw e;
  }
}

function digits(value) { return String(value || '').replace(/\D/g, ''); }

function normalizePhone(value) {
  let raw = String(value || '').trim();
  let d = digits(raw);
  if (raw.startsWith('+')) {
    if (!d.startsWith('55')) return '';
    d = d.slice(2);
  } else if (d.startsWith('0055')) {
    d = d.slice(4);
  } else if (d.startsWith('55') && (d.length === 12 || d.length === 13)) {
    d = d.slice(2);
  }
  if (!/^([1-9][0-9])([2-9][0-9]{7,8})$/.test(d)) return '';
  return '+55' + d;
}

function validPhone(value) { return !!normalizePhone(value); }

function validCpf(value) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let t = 9; t < 11; t += 1) {
    let sum = 0;
    for (let i = 0; i < t; i += 1) sum += Number(cpf[i]) * (t + 1 - i);
    if ((((sum * 10) % 11) % 10) !== Number(cpf[t])) return false;
  }
  return true;
}

function validBirth(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const d = new Date(value + 'T00:00:00Z');
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - d.getUTCFullYear();
  if (now.getUTCMonth() < d.getUTCMonth() ||
      (now.getUTCMonth() === d.getUTCMonth() && now.getUTCDate() < d.getUTCDate())) age -= 1;
  return age >= 18 && age <= 120;
}

function hash(value, secret) {
  const key = String(secret || '');
  if (key.length < 32) {
    const e = new Error('CPF_HASH_CONFIGURATION_MISSING');
    e.status = 503;
    throw e;
  }
  return crypto.createHmac('sha256', key).update(String(value)).digest('hex');
}

function clientIp(req) {
  const raw = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '';
  return String(raw).split(',')[0].trim().slice(0, 80) || 'unknown';
}

function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > 0) {
      const key = part.slice(0, i).trim();
      const value = part.slice(i + 1).trim();
      try { out[key] = decodeURIComponent(value); } catch (_) { out[key] = value; }
    }
  });
  return out;
}

function setSession(res, session) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const accessAge = Math.max(60, Number(session.expires_in) || 3600);
  const refreshAge = 60 * 60 * 24 * 30;
  res.setHeader('Set-Cookie', [
    'esquina_access=' + encodeURIComponent(session.access_token) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + accessAge + secure,
    'esquina_refresh=' + encodeURIComponent(session.refresh_token) + '; HttpOnly; Path=/; SameSite=Lax; Max-Age=' + refreshAge + secure
  ]);
}

function clearSession(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', [
    'esquina_access=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0' + secure,
    'esquina_refresh=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0' + secure
  ]);
}

function requestHeaders(c, options) {
  const o = options || {};
  const key = o.admin ? c.service : c.anon;
  const headers = {
    apikey: key,
    'Content-Type': 'application/json'
  };
  if (o.token) headers.Authorization = 'Bearer ' + o.token;
  // New sb_secret_/sb_publishable_ keys are API keys, not JWTs.
  // Keep the Bearer header only for legacy JWT keys (eyJ...).
  else if (/^eyJ/.test(key)) headers.Authorization = 'Bearer ' + key;
  if (o.prefer) headers.Prefer = o.prefer;
  return headers;
}

async function sbFetch(c, path, options) {
  const o = options || {};
  const headers = requestHeaders(c, o);
  const response = await fetch(c.url + path, {
    method: o.method || 'GET',
    headers,
    body: o.body === undefined ? undefined : JSON.stringify(o.body)
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch (_) { data = { message: raw.slice(0, 300) }; }
  if (!response.ok) {
    const e = new Error(data.msg || data.message || data.error_description || data.error || 'SUPABASE_REQUEST_FAILED');
    e.status = response.status;
    e.code = data.code || data.error_code || '';
    throw e;
  }
  return data;
}

function safeNext(value) {
  const v = String(value || '/').slice(0, 1500);
  if (!v.startsWith('/') || v.startsWith('//') || /[\r\n\\]/.test(v)) return '/';
  return v;
}

function confirmationUrl(c, next) {
  return c.site + '/auth/confirm.html?next=' + encodeURIComponent(safeNext(next));
}

async function deleteAuthUser(c, id) {
  try {
    await sbFetch(c, '/auth/v1/admin/users/' + encodeURIComponent(id), { method: 'DELETE', admin: true });
  } catch (_) {}
}

async function authUserExists(c, userId) {
  try {
    await sbFetch(c, '/auth/v1/admin/users/' + encodeURIComponent(userId), { admin: true });
    return true;
  } catch (e) {
    if (e && e.status === 404) return false;
    const error = new Error('AUTH_USER_LOOKUP_UNAVAILABLE');
    error.status = 503;
    throw error;
  }
}

async function profileFor(c, user, token) {
  const rows = await sbFetch(c, '/rest/v1/customer_profiles?select=full_name,birth_date,phone_e164,phone_verified_at&user_id=eq.' +
    encodeURIComponent(user.id) + '&limit=1', { token: token || user.access_token });
  const profile = rows && rows[0];
  const meta = user.user_metadata || {};
  const name = profile && profile.full_name || meta.full_name || meta.name || '';
  return {
    id: user.id, name, email: user.email || '',
    emailVerified: !!(user.email_confirmed_at || user.confirmed_at),
    phone: profile && profile.phone_e164 || meta.phone_e164 || '',
    phoneVerified: !!(profile && profile.phone_verified_at),
    birth: profile && profile.birth_date || meta.birth_date || '',
    address: String(meta.delivery_address || ''),
    registrationStatus: profile ? 'complete' : 'pending',
    needsCpf: !profile, needsPhone: !profile || !(profile.phone_e164 || meta.phone_e164)
  };
}

async function currentUser(req, res, c) {
  const jar = cookies(req);
  let access = jar.esquina_access;
  const refresh = jar.esquina_refresh;
  if (!access && !refresh) return null;
  try {
    const user = await sbFetch(c, '/auth/v1/user', { token: access });
    if (!(await authUserExists(c, user.id))) {
      clearSession(res);
      return null;
    }
    req.esquinaAccessToken = access;
    return await profileFor(c, user, access);
  } catch (error) {
    if (error && error.message === 'AUTH_USER_LOOKUP_UNAVAILABLE') throw error;
    if (!refresh) {
      clearSession(res);
      return null;
    }
    try {
      const session = await sbFetch(c, '/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', body: { refresh_token: refresh }
      });
      if (!(await authUserExists(c, session.user.id))) {
        clearSession(res);
        return null;
      }
      setSession(res, session);
      req.esquinaAccessToken = session.access_token;
      return await profileFor(c, session.user, session.access_token);
    } catch (refreshError) {
      if (refreshError && refreshError.message === 'AUTH_USER_LOOKUP_UNAVAILABLE') throw refreshError;
      clearSession(res);
      return null;
    }
  }
}

function maskEmail(email) {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return '';
  const local = parts[0];
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return shown + '•••@' + parts[1];
}

function errorResponse(res, error) {
  const status = Number(error && error.status) || 500;
  const code = error && (error.message === 'AUTH_CONFIGURATION_MISSING' || error.message === 'CPF_HASH_CONFIGURATION_MISSING')
    ? error.message
    : (error && error.message === 'METHOD_NOT_ALLOWED' ? 'METHOD_NOT_ALLOWED' : 'UNAVAILABLE');
  if (error && error.allow) res.setHeader('Allow', error.allow);
  send(res, status >= 500 ? 503 : status, {
    code,
    error: code === 'AUTH_CONFIGURATION_MISSING'
      ? 'O serviço de conta ainda não foi configurado.'
      : (code === 'CPF_HASH_CONFIGURATION_MISSING'
        ? 'O serviço de validação de cadastro está temporariamente indisponível.'
        : 'Não foi possível concluir a solicitação. Tente novamente.')
  });
}

module.exports = {
  config, requireCpfSecret, send, method, body, digits, normalizePhone, validPhone, validCpf, validBirth, hash, clientIp,
  cookies, setSession, clearSession, requestHeaders, sbFetch, safeNext, confirmationUrl,
  deleteAuthUser, authUserExists, profileFor, currentUser, maskEmail, errorResponse
};
