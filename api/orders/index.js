'use strict';
// GET  /api/orders -> pedidos do cliente logado (andamento + historico)
// POST /api/orders -> registra um pedido enviado pela sacola (cliente logado)
// PATCH /api/orders -> uso da loja: atualiza o status de um pedido
//   Cabecalho: Authorization: Bearer <ORDERS_ADMIN_TOKEN>
//   Corpo: { "id": "<uuid>" | "code": "<numero da comanda>", "status": "recebido|em_preparo|pronto|entregue|cancelado" }
const crypto = require('node:crypto');
const A = require('../../lib/esquina-auth');
const eventsHandler = require('../../lib/events-handler');

const STATUS = ['recebido', 'em_preparo', 'pronto', 'entregue', 'cancelado'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorized(req) {
  const expected = process.env.ORDERS_ADMIN_TOKEN || '';
  if (expected.length < 24) return null; // nao configurado
  const given = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

async function updateStatus(req, res) {
  const ok = authorized(req);
  if (ok === null) return A.send(res, 503, { code: 'ADMIN_NOT_CONFIGURED' });
  if (!ok) return A.send(res, 401, { code: 'UNAUTHORIZED' });
  const c = A.config();
  const d = await A.body(req);
  if (STATUS.indexOf(d.status) === -1) return A.send(res, 400, { code: 'INVALID_STATUS' });
  let filter;
  if (d.id && UUID.test(String(d.id))) {
    filter = 'id=eq.' + encodeURIComponent(d.id);
  } else if (d.code) {
    const code = String(d.code).replace(/[^0-9A-Za-z-]/g, '').slice(0, 24);
    if (!code) return A.send(res, 400, { code: 'INVALID_ORDER' });
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const found = await A.sbFetch(c, '/rest/v1/customer_orders?select=id&code=eq.' + encodeURIComponent(code) +
      '&created_at=gte.' + encodeURIComponent(since) + '&limit=2', { admin: true });
    if (!found || !found.length) return A.send(res, 404, { code: 'NOT_FOUND' });
    if (found.length > 1) return A.send(res, 409, { code: 'AMBIGUOUS_CODE' });
    filter = 'id=eq.' + encodeURIComponent(found[0].id);
  } else {
    return A.send(res, 400, { code: 'INVALID_ORDER' });
  }
  const rows = await A.sbFetch(c, '/rest/v1/customer_orders?' + filter, {
    method: 'PATCH', admin: true, prefer: 'return=representation', body: { status: d.status }
  });
  if (!rows || !rows.length) return A.send(res, 404, { code: 'NOT_FOUND' });
  return A.send(res, 200, { id: rows[0].id, code: rows[0].code, status: rows[0].status });
}

const PAY = ['Pix', 'Débito', 'Crédito', 'Dinheiro'];
const COLUMNS = 'id,code,status,items,total,payment,change_for,created_at,updated_at';

function clean(value, max) {
  return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function money(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}
function view(r) {
  return {
    id: r.id,
    code: r.code,
    status: r.status,
    items: Array.isArray(r.items) ? r.items : [],
    total: Number(r.total),
    pay: r.payment,
    changeFor: r.change_for == null ? null : Number(r.change_for),
    createdAt: r.created_at,
    updatedAt: r.updated_at
  };
}
function parseOrder(d) {
  if (!d || !Array.isArray(d.items) || d.items.length < 1 || d.items.length > 60) return null;
  const items = [];
  let total = 0;
  for (const x of d.items) {
    const n = clean(x && x.n, 120);
    const q = Number(x && x.q);
    const p = money(x && x.p);
    if (!n || !Number.isInteger(q) || q < 1 || q > 99 || !(p > 0) || p > 100000) return null;
    items.push({ n, q, p });
    total = Math.round((total + q * p) * 100) / 100;
  }
  const code = clean(d.code, 24);
  const pay = PAY.indexOf(d.pay) > -1 ? d.pay : '';
  if (!code || !pay || !(total > 0)) return null;
  let changeFor = null;
  if (pay === 'Dinheiro' && d.changeFor != null && d.changeFor !== '') {
    changeFor = money(d.changeFor);
    if (!(changeFor > total) || changeFor > 1000000) changeFor = null;
  }
  return { items, total, code, pay, changeFor };
}

// POST /api/orders?route=events -> metricas agregadas da loja (lib/events-handler.js).
// Fica aqui para respeitar o limite de 12 Serverless Functions do plano Hobby da Vercel.
function routeOf(req) {
  let r = req.query && req.query.route;
  if (Array.isArray(r)) r = r[0];
  if (!r) { const m = /[?&]route=([^&#]*)/.exec(String(req.url || '')); r = m && decodeURIComponent(m[1]); }
  return String(r || '');
}

module.exports = async function (req, res) {
  if (routeOf(req) === 'events') return eventsHandler(req, res);
  try {
    A.method(req, ['GET', 'POST', 'PATCH']);
    if (req.method === 'PATCH') return await updateStatus(req, res);
    const c = A.config();
    const user = await A.currentUser(req, res, c);
    if (!user) return A.send(res, 401, { code: 'UNAUTH' });

    if (req.method === 'GET') {
      const rows = await A.sbFetch(c, '/rest/v1/customer_orders?select=' + COLUMNS +
        '&user_id=eq.' + encodeURIComponent(user.id) + '&order=created_at.desc&limit=50', { admin: true });
      return A.send(res, 200, { orders: (rows || []).map(view) });
    }

    const d = await A.body(req);
    const order = parseOrder(d);
    if (!order) return A.send(res, 400, { code: 'INVALID_ORDER' });

    // limite simples contra repeticao: no maximo 3 pedidos por minuto
    const since = new Date(Date.now() - 60 * 1000).toISOString();
    const recent = await A.sbFetch(c, '/rest/v1/customer_orders?select=id&user_id=eq.' + encodeURIComponent(user.id) +
      '&created_at=gte.' + encodeURIComponent(since) + '&limit=3', { admin: true });
    if (recent && recent.length >= 3) return A.send(res, 429, { code: 'RATE_LIMIT' });

    const rows = await A.sbFetch(c, '/rest/v1/customer_orders', {
      method: 'POST', admin: true, prefer: 'return=representation',
      body: {
        user_id: user.id,
        code: order.code,
        items: order.items,
        total: order.total,
        payment: order.pay,
        change_for: order.changeFor,
        customer_name: clean(user.name, 120) || null,
        customer_phone: A.normalizePhone(d.phone) || user.phone || null
      }
    });
    return A.send(res, 201, { order: view(rows[0]) });
  } catch (e) {
    if (e.message === 'METHOD_NOT_ALLOWED') return A.send(res, 405, { code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, POST, PATCH' });
    if (e.message === 'AUTH_CONFIGURATION_MISSING') return A.send(res, 503, { code: 'AUTH_CONFIGURATION_MISSING' });
    if (e.status === 413 || e.status === 400) return A.send(res, e.status, { code: 'INVALID_ORDER' });
    return A.send(res, 503, { code: 'UNAVAILABLE' });
  }
};
