'use strict';
// GET  /api/orders -> pedidos do cliente logado (andamento + historico)
// POST /api/orders -> registra um pedido enviado pela sacola (cliente logado)
const A = require('../../lib/esquina-auth');

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

module.exports = async function (req, res) {
  try {
    A.method(req, ['GET', 'POST']);
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
    if (e.message === 'METHOD_NOT_ALLOWED') return A.send(res, 405, { code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, POST' });
    if (e.message === 'AUTH_CONFIGURATION_MISSING') return A.send(res, 503, { code: 'AUTH_CONFIGURATION_MISSING' });
    if (e.status === 413 || e.status === 400) return A.send(res, e.status, { code: 'INVALID_ORDER' });
    return A.send(res, 503, { code: 'UNAVAILABLE' });
  }
};
