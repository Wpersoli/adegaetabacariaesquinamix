'use strict';
// POST /api/orders/status  (uso da loja)
// Cabecalho: Authorization: Bearer <ORDERS_ADMIN_TOKEN>
// Corpo: { "id": "<uuid>" | "code": "<numero da comanda>", "status": "recebido|em_preparo|pronto|entregue|cancelado" }
const crypto = require('node:crypto');
const A = require('../../lib/esquina-auth');

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

module.exports = async function (req, res) {
  try {
    A.method(req, ['POST']);
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
  } catch (e) {
    if (e.message === 'METHOD_NOT_ALLOWED') return A.send(res, 405, { code: 'METHOD_NOT_ALLOWED' }, { Allow: 'POST' });
    if (e.message === 'AUTH_CONFIGURATION_MISSING') return A.send(res, 503, { code: 'AUTH_CONFIGURATION_MISSING' });
    if (e.status === 413 || e.status === 400) return A.send(res, e.status, { code: 'INVALID_ORDER' });
    return A.send(res, 503, { code: 'UNAVAILABLE' });
  }
};
