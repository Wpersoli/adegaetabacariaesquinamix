# Esquina Mix — configuração da autenticação Supabase

## Estado atual (2026-11-17)

- Projeto Supabase: **adega-mix**.
- Project ref: **rduwcxzegiffqgnnbhis** · região **sa-east-1**.
- Banco: **ACTIVE_HEALTHY**.
- As migrações abaixo estão aplicadas e foram conferidas no histórico remoto:
  - `20261117024320_esquina_auth.sql`
  - `20261117031101_customer_phone_required.sql`
  - `20261117231903_customer_profile_edit.sql`
  - `20261117235556_customer_orders.sql`
- Tabelas confirmadas: `public.customer_profiles`, `public.customer_orders`, `private.customer_identity` e `private.email_lookup_attempts`. RLS está habilitado em todas.
- PR #3 está integrado à `main`.
- Produção está publicada em **https://adegaetabacariaesquinamix.vercel.app** no commit `4865d163a623146cc7a76fe025865759622bfbb0` (Vercel READY).

**Limite do plano Free:** mantenha no máximo dois projetos ativos na organização. `trotebox-prod` está pausado (INACTIVE) e `valora-credito` continua ativo e preservado. Não reative o projeto pausado sem rever o limite do plano.

## 1. Variáveis Vercel

As variáveis a seguir estão cadastradas para Production; as variáveis sensíveis são mascaradas pela Vercel e não podem ter seu valor lido depois de gravadas. Não as recrie nem as sobrescreva sem motivo.

| Nome | Escopo | Uso |
|---|---|---|
| `SUPABASE_URL` | Production | URL do projeto `adega-mix` |
| `SUPABASE_PUBLISHABLE_KEY` | Production | Chave pública usada como `apikey` |
| `SUPABASE_SECRET_KEY` | Production e Preview | Chave administrativa; somente servidor |
| `CPF_HASH_SECRET` | Production e Preview | Segredo HMAC de CPF; somente servidor |
| `SITE_URL` | Production | `https://adegaetabacariaesquinamix.vercel.app` |

A branch de Preview `feature/supabase-auth-esquina-mix` mantém variáveis separadas, limitadas a essa branch.

**Não rotacione `CPF_HASH_SECRET` sem um plano de migração dos registros existentes.** Os CPFs não são guardados em texto puro: o banco armazena HMAC-SHA256. Alterar a chave sem recalcular os hashes a partir do CPF fornecido pelos próprios titulares fará as rotinas de recuperação por CPF deixarem de localizar os registros existentes.

O código aceita `SUPABASE_SECRET_KEY` (`sb_secret_...`) e mantém compatibilidade temporária com `SUPABASE_SERVICE_ROLE_KEY` (JWT legado). Nunca exponha essas chaves em HTML, JavaScript do navegador, prefixos `NEXT_PUBLIC_`, logs ou no chat.

## 2. Supabase Auth — itens de configuração do Dashboard

A configuração de provedores, SMTP e templates não é totalmente auditável pelas ferramentas de banco utilizadas nesta revisão. Confirme no Dashboard antes de divulgar o cadastro ao público:

### E-mail

Em **Authentication → Providers → Email**:
- habilite o provedor Email;
- mantenha **Confirm email** habilitado para exigir confirmação antes do primeiro login;
- configure um SMTP próprio antes de abrir o cadastro ao público;
- preserve `{{ .ConfirmationURL }}` nos templates de confirmação e recuperação.

Se a confirmação não estiver ativa, a API rejeita o cadastro com `EMAIL_CONFIRMATION_NOT_ENFORCED`, em vez de ativar uma conta sem confirmação.

### URLs permitidas

Em **Authentication → URL Configuration**:
- Site URL de Produção: `https://adegaetabacariaesquinamix.vercel.app`;
- Redirect URL de Produção: `https://adegaetabacariaesquinamix.vercel.app/auth/confirm.html`;
- Redirect URL de Preview da branch de integração, se ainda utilizada: `https://adegaetabacariaesquinamix-git-feature-7c866c-wpersolis-projects.vercel.app/auth/confirm.html`.

Não use curingas amplos. Mantenha somente URLs realmente usadas.

## 3. Modelo do banco e migrações

As migrações locais em `supabase/migrations/` agora usam os mesmos nomes/versões registrados no projeto remoto. Não renomeie os arquivos para uma versão anterior e não reaplique manualmente migrations já registradas.

- **`public.customer_profiles`**: nome, nascimento, consentimento e telefone E.164, com estado de verificação separado e RLS limitado ao próprio usuário.
- **`public.update_customer_profile`**: RPC administrativa que sincroniza nome, nascimento e telefone em `customer_profiles` e nascimento em `private.customer_identity`. A execução está restrita a `service_role`.
- **`public.customer_orders`**: histórico de pedidos enviados por clientes logados; RLS permite leitura somente dos próprios pedidos; inserção/atualização é feita pelo servidor.
- **`private.customer_identity`**: guarda somente HMAC-SHA256 do CPF e a data de nascimento.
- **`private.email_lookup_attempts`**: limita tentativas de recuperação por IP e CPF.

Os dois objetos de identidade ficam no schema `private`, com RLS habilitado e sem políticas para usuários comuns; o acesso é feito pelas RPCs server-only. Não conceda acesso direto a `anon` ou `authenticated`.

O CPF é validado matematicamente, mas não é consultado na Receita Federal nem comprova identidade governamental. O estado de cadastro não deve ser apresentado como “CPF verificado”.

## 4. Segurança e fluxo de conta

- Cadastro por e-mail exige nome, e-mail, telefone com DDD, CPF válido matematicamente, nascimento, maioridade, senha e consentimento.
- Cadastro Google exige telefone, CPF, nascimento e consentimento na etapa de conclusão; só estará funcional quando as credenciais Google OAuth estiverem configuradas.
- O telefone é armazenado em E.164 (+55...). Sem API ativa de WhatsApp/SMS, `phone_verified_at` permanece NULL; telefone informado não significa telefone verificado.
- Sessões ficam em cookies HttpOnly, SameSite=Lax e Secure em Produção.
- A configuração HMAC é exigida apenas nas operações que realmente calculam/consultam hash de CPF; login, sessão, edição de perfil, pedidos e logout não devem depender desse segredo.
- A edição do endereço padrão grava `delivery_address` em `auth.users.raw_user_meta_data`; o checkout permite endereço alternativo somente para o pedido em curso.
- O encerramento da conta revoga refresh tokens globalmente antes de excluir o usuário. Como JWTs já emitidos podem permanecer válidos até expirarem, os endpoints também confirmam no Admin API que o usuário ainda existe.
- As relações de perfil, identidade e pedidos usam `ON DELETE CASCADE`; a exclusão remove dados associados nessas tabelas.
- A mensagem de pedido não deve chamar o CPF de “verificado”: o site não consulta a Receita Federal.

## 5. Pedidos e atualização de status

A tabela `public.customer_orders` já foi criada e verificada. A gravação e a leitura passam pelo endpoint `/api/orders`; a leitura autenticada fica limitada aos pedidos do próprio usuário.

A atualização administrativa de status por `PATCH /api/orders` exige a variável de servidor `ORDERS_ADMIN_TOKEN` (mínimo de 24 caracteres). Ela não aparece cadastrada nas variáveis Vercel auditadas. Até configurar esse token, a loja pode atualizar status pelo Table Editor do Supabase, com acesso administrativo. Não exponha esse token no navegador.

## 6. WhatsApp manual

O botão usa a meta `esquina-whatsapp` do HTML. Abre conversa manual com a loja; não envia mensagens automáticas nem confirma cadastro sozinho.

O pedido inclui o endereço escolhido no checkout. Quando o cliente escolhe endereço alternativo, a interface volta à opção padrão ao terminar o envio; o endereço temporário não é salvo no cadastro nem reaparece como padrão em outro pedido.

## 7. Verificações já executadas nesta revisão

- `git diff --check` e workflow de validação da `main`: aprovados.
- Sintaxe dos módulos JavaScript, incluindo `pedido.js` e `produtos.js`: aprovada.
- Testes de CPF, telefone E.164, retorno seguro, chaves Supabase, isolamento do HMAC, filtros e navegação: aprovados.
- Testes de regressão para reset de endereço alternativo, exclusão de conta e validação de maioridade no fuso `America/Sao_Paulo`: aprovados.
- Migrações remotas comparadas com os arquivos locais.
- `customer_orders`: tabela, RLS, política de leitura e grants conferidos.
- Deploy de Produção do commit `4865d163`: READY.
- Varredura de erros runtime da Vercel no período consultado: nenhum cluster encontrado. Isso não substitui teste real com conta de cliente.
- Advisor de saúde do banco: sem alertas.

## 8. Pendências de operação

- O Supabase Security Advisor informa **Leaked Password Protection Disabled**. Habilite em Authentication → Password Security/Settings a proteção contra senhas comprometidas antes de ampliar o cadastro. A integração disponível nesta revisão permite consultar os avisos, mas não expõe a alteração dessa configuração Auth.
- Os avisos INFO de RLS sem políticas em `private.customer_identity` e `private.email_lookup_attempts` são esperados com o desenho atual: o schema é privado e os usuários comuns não recebem acesso direto.
- Ainda é necessário um teste de ponta a ponta com uma conta de teste real: cadastro + e-mail de confirmação, login, salvar perfil, endereço temporário e padrão no WhatsApp, histórico de pedido, logout e encerramento de conta. Não use conta real de cliente para testes destrutivos.
- Configure `ORDERS_ADMIN_TOKEN` somente caso queira atualizar status pela API; caso contrário, mantenha o processo administrativo pelo Table Editor.

Não reverta as migrações aplicadas, não remova variáveis sensíveis existentes e não altere `CPF_HASH_SECRET` sem plano de migração dos hashes.
