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
  'api/auth/google.js'
];

for (const file of javascript) {
  execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
}

assert.equal(auth.validCpf('529.982.247-25'), true);
assert.equal(auth.validCpf('111.111.111-11'), false);
assert.equal(auth.validCpf('52998224724'), false);
assert.equal(auth.validBirth('1990-04-20'), true);
assert.equal(auth.validBirth('2010-04-20'), false);
assert.equal(auth.safeNext('/catalogo?categoria=bebidas'), '/catalogo?categoria=bebidas');
assert.equal(auth.safeNext('//evil.example/path'), '/');
assert.equal(auth.safeNext('https://evil.example'), '/');
assert.equal(auth.maskEmail('cliente@example.com'), 'cl•••@example.com');

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

const migration = fs.readFileSync(path.join(root, 'supabase/migrations/202611160001_esquina_auth.sql'), 'utf8');
assert.match(migration, /enable row level security/i);
assert.match(migration, /cpf_hash text not null unique/i);
assert.match(migration, /revoke all on function public\.register_customer_profile[\s\S]*from public, anon, authenticated/i);
assert.match(migration, /revoke all on function public\.lookup_customer_identity[\s\S]*from public, anon, authenticated/i);
assert.equal((migration.match(/as \$\$/g) || []).length, 2);
assert.equal((migration.match(/\$\$;/g) || []).length, 2);
assert.ok(migration.includes("p_cpf_hash !~ '^[0-9a-f]{64}$'"));
assert.ok(migration.includes('v_existing_hash is not null and v_existing_hash <> p_cpf_hash'));

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert.match(app, /Cliente: '\+customer\.name/);
assert.match(app, /Status da conta/);

const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(index, /name="esquina-auth" content="api"/);

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
assert.match(sw, /u\.pathname\.indexOf\('\/api\/'\)===0/);
assert.match(sw, /u\.pathname\.indexOf\('\/auth\/'\)===0/);

console.log('Esquina Mix auth: sintaxe JS, validação CPF, retorno seguro, máscara e verificações RLS aprovadas.');
