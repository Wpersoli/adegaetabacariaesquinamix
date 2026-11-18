'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const auth = require('../lib/esquina-auth');

const root = path.resolve(__dirname, '..');
const javascript = [
  'auth.js',
  'app.js',
  'catalog.js',
  'pedido.js',
  'produtos.js',
  'preloader.js',
  'auth-confirm.js',
  'lib/esquina-auth.js',
  'api/auth/signup.js',
  'api/auth/resend.js',
  'api/auth/login.js',
  'api/auth/me.js',
  'api/auth/session.js',
  'api/auth/logout.js',
  'api/auth/forgot.js',
  'api/auth/forgot-email.js',
  'api/auth/complete.js',
  'api/auth/password.js',
  'api/auth/google.js',
  'api/orders/index.js'
];

for (const file of javascript) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

assert.equal(auth.validCpf('529.982.247-25'), true);
assert.equal(auth.normalizePhone('(11) 99999-9999'), '+5511999999999');
assert.equal(auth.normalizePhone('+55 11 3333-4444'), '+551133334444');
assert.equal(auth.normalizePhone('123'), '');
assert.equal(auth.validCpf('111.111.111-11'), false);
assert.equal(auth.validCpf('52998224724'), false);
assert.equal(auth.validBirth('1990-04-20'), true);
assert.equal(auth.validBirth('2010-04-20'), false);
// Maioridade considera o calendário de São Paulo, não o dia UTC antes da meia-noite local.
assert.equal(auth.validBirth('2008-11-17', new Date('2026-11-17T02:00:00.000Z')), false);
assert.equal(auth.validBirth('2008-11-17', new Date('2026-11-17T03:01:00.000Z')), true);
assert.equal(auth.safeNext('/catalogo?categoria=bebidas'), '/catalogo?categoria=bebidas');
assert.equal(auth.safeNext('//evil.example/path'), '/');
assert.equal(auth.safeNext('https://evil.example'), '/');
assert.equal(auth.maskEmail('cliente@example.com'), 'cl•••@example.com');

const authUi = fs.readFileSync(path.join(root, 'auth.js'), 'utf8');
// a mensagem sobre o CPF foi removida da tela "Minha conta" a pedido da loja
assert.ok(!authUi.includes('CPF teve apenas os dígitos validados'));
assert.ok(!authUi.includes('Telefone de contato: '));
assert.ok(!authUi.includes('CPF verificado junto à Receita Federal'));
assert.ok(!authUi.includes('não encontrado na Receita Federal'));
assert.ok(authUi.includes('America/Sao_Paulo'));

const modernHeaders = auth.requestHeaders(
  { anon: 'sb_publishable_public', service: 'sb_secret_server' },
  { admin: true }
);
assert.equal(modernHeaders.apikey, 'sb_secret_server');
assert.equal(modernHeaders.Authorization, undefined);
const legacyHeaders = auth.requestHeaders(
  { anon: 'eyJlegacyAnon', service: 'eyJlegacyServiceRole' },
  { admin: true }
);
assert.equal(legacyHeaders.apikey, 'eyJlegacyServiceRole');
assert.equal(legacyHeaders.Authorization, 'Bearer eyJlegacyServiceRole');
const userHeaders = auth.requestHeaders(
  { anon: 'sb_publishable_public', service: 'sb_secret_server' },
  { token: 'user-access-token' }
);
assert.equal(userHeaders.Authorization, 'Bearer user-access-token');

const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20261117024320_esquina_auth.sql'), 'utf8');
assert.match(migration, /enable row level security/i);
assert.match(migration, /cpf_hash text not null unique/i);
assert.match(migration, /revoke all on function public\.register_customer_profile[\s\S]*from public, anon, authenticated/i);
assert.match(migration, /revoke all on function public\.lookup_customer_identity[\s\S]*from public, anon, authenticated/i);
assert.equal((migration.match(/as \$\$/g) || []).length, 2);
assert.equal((migration.match(/\$\$;/g) || []).length, 2);
assert.ok(migration.includes("p_cpf_hash !~ '^[0-9a-f]{64}$'"));
assert.ok(migration.includes('v_existing_hash is not null and v_existing_hash <> p_cpf_hash'));

const phoneMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261117031101_customer_phone_required.sql'), 'utf8');
assert.match(phoneMigration, /phone_e164 text/i);
assert.match(phoneMigration, /phone_verified_at timestamptz/i);
assert.ok(phoneMigration.includes('drop function if exists public.register_customer_profile(uuid, text, date, text)'));
assert.match(phoneMigration, /p_phone_e164 text/i);
assert.ok(phoneMigration.includes('revoke all on function public.register_customer_profile(uuid, text, date, text, text) from public, anon, authenticated'));
assert.ok(authUi.includes('Telefone com DDD'));
assert.ok(authUi.includes('phone:d.phone'));

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert.match(app, /Sou '\+customer\.name/);
assert.doesNotMatch(app, /customer\.cpfStatus/);
assert.match(app, /location\.href='\/produtos\?ordem=az'/);

const profileMigration = fs.readFileSync(path.join(root, 'supabase/migrations/20261117231903_customer_profile_edit.sql'), 'utf8');
assert.match(profileMigration, /update public\.customer_profiles/i);
assert.match(profileMigration, /update private\.customer_identity/i);
assert.match(profileMigration, /revoke all on function public\.update_customer_profile[\s\S]*from public, anon, authenticated/i);
assert.match(profileMigration, /grant execute on function public\.update_customer_profile[\s\S]*to service_role/i);

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(index, /name="esquina-auth" content="api"/);

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
assert.match(sw, /u\.pathname\.indexOf\('\/api\/'\)===0/);
assert.match(sw, /u\.pathname\.indexOf\('\/auth\/'\)===0/);


/* Configuração HMAC: não pode bloquear login/perfil; continua obrigatória para operações com CPF. */
const envKeys = ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SECRET_KEY','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY','CPF_HASH_SECRET'];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
try {
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.CPF_HASH_SECRET = '';
  const configWithoutCpfSecret = auth.config();
  assert.equal(configWithoutCpfSecret.cpfSecret, '');
  assert.throws(() => auth.requireCpfSecret(configWithoutCpfSecret), /CPF_HASH_CONFIGURATION_MISSING/);
  assert.equal(auth.requireCpfSecret({ cpfSecret: 'k'.repeat(32) }), 'k'.repeat(32));
  assert.throws(() => auth.hash('52998224725', ''), /CPF_HASH_CONFIGURATION_MISSING/);
} finally {
  envKeys.forEach((key) => {
    if (previousEnv[key] === undefined) delete process.env[key];
    else process.env[key] = previousEnv[key];
  });
}

/* Regressões: filtros na ordem solicitada e endereço temporário restrito a um pedido. */
const requestedCategories = ['Todos','Bebidas','Narguile','Headshop','Conveniência'];
const homeChipBlock = index.match(/<div class="feat__chips" id="chips"[^>]*>([\s\S]*?)<\/div>/);
assert.ok(homeChipBlock, 'Filtros da home precisam existir');
const homePositions = requestedCategories.map((label) => homeChipBlock[1].indexOf('>' + label + '</button>'));
assert.ok(homePositions.every((position) => position >= 0));
assert.deepEqual(homePositions, [...homePositions].sort((a,b) => a-b));
assert.equal((homeChipBlock[1].match(/data-cat=/g) || []).length, requestedCategories.length);
assert.ok(app.includes("[['todos','Todos'],['bebidas','Bebidas'],['narguile','Narguile'],['headshop','Headshop'],['outros','Conveniência']]"));
assert.doesNotMatch(app, /\['outros','Outros'\]/);

const productPage = fs.readFileSync(path.join(root, 'produtos.html'), 'utf8');
const productChipBlock = productPage.match(/<div class="feat__chips pg-category-chips"[^>]*>([\s\S]*?)<\/div>/);
assert.ok(productChipBlock, 'Filtros do catálogo precisam existir');
const productPositions = requestedCategories.map((label) => productChipBlock[1].indexOf('>' + label + '</button>'));
assert.ok(productPositions.every((position) => position >= 0));
assert.deepEqual(productPositions, [...productPositions].sort((a,b) => a-b));
assert.match(productPage, /href="\/#inicio"[^>]*aria-label="Voltar ao cardápio"/);
assert.match(productPage, /<a class="on pink" href="\/#inicio">Início<\/a>/);

const productJs = fs.readFileSync(path.join(root, 'produtos.js'), 'utf8');
assert.match(productJs, /location\.href='\/produtos\?ordem=az'/);
assert.doesNotMatch(productJs, /cpfStatus/);

const checkout = fs.readFileSync(path.join(root, 'pedido.js'), 'utf8');
assert.match(checkout, /function resetAddressChoice\(\)/);
assert.match(checkout, /function syncAddressUser\(\)/);
assert.match(checkout, /resetAddressChoice\(\);/);
assert.doesNotMatch(checkout, /cpfStatus/);

const signupApi = fs.readFileSync(path.join(root, 'api/auth/signup.js'), 'utf8');
const completeApi = fs.readFileSync(path.join(root, 'api/auth/complete.js'), 'utf8');
const forgotEmailApi = fs.readFileSync(path.join(root, 'api/auth/forgot-email.js'), 'utf8');
assert.match(signupApi, /A\.requireCpfSecret\(c\)/);
assert.match(completeApi, /A\.requireCpfSecret\(c\)/);
assert.match(forgotEmailApi, /A\.requireCpfSecret\(c\)/);

/* Segurança de sessão: contas excluídas não podem reabrir sessão com JWT antigo. */
const authLib = fs.readFileSync(path.join(root, 'lib/esquina-auth.js'), 'utf8');
assert.ok(authLib.includes('async function authUserExists'));
assert.ok(authLib.includes('AUTH_USER_LOOKUP_UNAVAILABLE'));
assert.ok(authLib.includes('authUserExists(c, authUser.id)'));
assert.ok(authLib.includes('authUserExists(c, authUser.id)'));

const sessionApi = fs.readFileSync(path.join(root, 'api/auth/session.js'), 'utf8');
assert.ok(sessionApi.includes('req.esquinaAccessToken||jar.esquina_access'));
assert.ok(sessionApi.includes('/auth/v1/logout?scope=global'));
const logoutApi = fs.readFileSync(path.join(root, 'api/auth/logout.js'), 'utf8');
assert.ok(logoutApi.includes('/auth/v1/logout?scope=local'));
assert.ok(sessionApi.includes('A.authUserExists(c,user.id)'));
assert.ok(sessionApi.includes('AUTH_USER_LOOKUP_UNAVAILABLE'));


/* currentUser: rejeita JWT de usuário apagado e limpa cookies; mantém login ativo se conta existe. */
(async function testCurrentUserAccountLookup() {
  const originalFetch = global.fetch;
  const headers = {};
  const seen = [];
  const response = (status, payload) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  });
  const config = {
    url: 'https://example.supabase.co',
    anon: 'sb_publishable_test',
    service: 'sb_secret_test'
  };
  const request = { headers: { cookie: 'esquina_access=old-access; esquina_refresh=old-refresh' } };
  const res = { setHeader(name, value) { headers[name] = value; } };

  try {
    global.fetch = async (url, options) => {
      const path = String(url).replace(config.url, '');
      seen.push({ path, options });
      if (path === '/auth/v1/user') {
        return response(200, { id: 'deleted-user', email: 'deleted@example.test', user_metadata: {} });
      }
      if (path === '/auth/v1/admin/users/deleted-user') {
        return response(404, { message: 'User not found', code: 'user_not_found' });
      }
      throw new Error('Unexpected request: ' + path);
    };
    const deleted = await auth.currentUser(request, res, config);
    assert.equal(deleted, null);
    assert.deepEqual(seen.map((entry) => entry.path), [
      '/auth/v1/user',
      '/auth/v1/admin/users/deleted-user'
    ]);
    assert.ok(Array.isArray(headers['Set-Cookie']));
    assert.ok(headers['Set-Cookie'].every((cookie) => cookie.includes('Max-Age=0')));

    const activeHeaders = {};
    const activeReq = { headers: { cookie: 'esquina_access=active-access' } };
    const activeRes = { setHeader(name, value) { activeHeaders[name] = value; } };
    global.fetch = async (url, options) => {
      const path = String(url).replace(config.url, '');
      if (path === '/auth/v1/user') {
        return response(200, {
          id: 'active-user',
          email: 'active@example.test',
          email_confirmed_at: '2026-01-01T00:00:00Z',
          user_metadata: { full_name: 'Cliente Teste' }
        });
      }
      if (path === '/auth/v1/admin/users/active-user') return response(200, { user: { id: 'active-user' } });
      if (path.indexOf('/rest/v1/customer_profiles?') === 0) return response(200, []);
      throw new Error('Unexpected request: ' + path);
    };
    const active = await auth.currentUser(activeReq, activeRes, config);
    assert.equal(active.id, 'active-user');
    assert.equal(active.registrationStatus, 'pending');
    assert.equal(activeReq.esquinaAccessToken, 'active-access');

    // Perfil indisponível não deve revogar nem limpar os cookies de uma sessão válida.
    const profileFailureHeaders = {};
    const profileFailureReq = { headers: { cookie: 'esquina_access=active-access; esquina_refresh=active-refresh' } };
    const profileFailureRes = { setHeader(name, value) { profileFailureHeaders[name] = value; } };
    global.fetch = async (url) => {
      const path = String(url).replace(config.url, '');
      if (path === '/auth/v1/user') return response(200, {
        id: 'active-user', email: 'active@example.test', user_metadata: { full_name: 'Cliente Teste' }
      });
      if (path === '/auth/v1/admin/users/active-user') return response(200, { user: { id: 'active-user' } });
      if (path.indexOf('/rest/v1/customer_profiles?') === 0) return response(503, { message: 'database unavailable' });
      throw new Error('Unexpected request: ' + path);
    };
    await assert.rejects(
      auth.currentUser(profileFailureReq, profileFailureRes, config),
      /PROFILE_LOOKUP_UNAVAILABLE/
    );
    assert.equal(profileFailureHeaders['Set-Cookie'], undefined);

    // Token expirado: renova a sessão; o lookup do perfil ocorre fora do catch de refresh.
    const refreshedHeaders = {};
    const refreshedReq = { headers: { cookie: 'esquina_access=expired-access; esquina_refresh=valid-refresh' } };
    const refreshedRes = { setHeader(name, value) { refreshedHeaders[name] = value; } };
    global.fetch = async (url) => {
      const path = String(url).replace(config.url, '');
      if (path === '/auth/v1/user') return response(401, { message: 'JWT expired' });
      if (path === '/auth/v1/token?grant_type=refresh_token') return response(200, {
        access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600,
        user: { id: 'refreshed-user', email: 'active@example.test', user_metadata: { full_name: 'Cliente Atualizado' } }
      });
      if (path === '/auth/v1/admin/users/refreshed-user') return response(200, { user: { id: 'refreshed-user' } });
      if (path.indexOf('/rest/v1/customer_profiles?') === 0) return response(200, []);
      throw new Error('Unexpected request: ' + path);
    };
    const refreshed = await auth.currentUser(refreshedReq, refreshedRes, config);
    assert.equal(refreshed.id, 'refreshed-user');
    assert.equal(refreshedReq.esquinaAccessToken, 'new-access');
    assert.ok(refreshedHeaders['Set-Cookie'][0].includes('new-access'));
  } finally {
    global.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

console.log('Esquina Mix: autenticação, sessões, HMAC, filtros, checkout e navegação validados.');


/* Integridade comercial: não apresentar ranking inventado, avaliações locais sem fonte ou promoções de tabaco. */
const commercialCatalog = fs.readFileSync(path.join(root, 'catalog.js'), 'utf8');
const commercialLines = commercialCatalog.split('\n');
assert.ok(!commercialLines.some((line) => line.includes("cat:'tabacos'") && line.includes('promo:1')));
assert.ok(!commercialLines.some((line) => line.includes("cat:'narguile'") && line.includes('promo:1')));
assert.ok(!commercialLines.some((line) => line.includes("cat:'headshop'") && line.includes('promo:1')));
assert.ok(!app.includes('Sabrina Duque') && !app.includes('Ulisses Gomes') && !app.includes('Leo Batista'));
assert.ok(app.includes('var reviews=[];'));
assert.ok(index.includes('Explore a <span class="hl">variedade</span>'));
assert.ok(!index.includes('Mais vendidos da') && !index.includes('+80</b> Avaliações verificadas') && !index.includes('Nota 5,0 de 5'));
