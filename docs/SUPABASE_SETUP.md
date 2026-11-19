# Esquina Mix — configuração da autenticação Supabase

## Estado atual (2026-11-19)

- Projeto Supabase: **adega-mix** · ref **rduwcxzegiffqgnnbhis** · região **sa-east-1** · estado **ACTIVE_HEALTHY**.
- O histórico remoto do Supabase registra seis migrações aplicadas: `20261117024320`, `20261117031101`, `20261117231903`, `20261117235556`, `20261118023925` e `20261119022341`.
- **Divergência de reprodutibilidade:** o arquivo da migração `20261119022341_pending_registration_and_hardening.sql` não foi encontrado na branch `main`, embora a versão esteja registrada como aplicada no banco. Não renomeie, reaplique nem invente uma migração substituta. Antes de reconstruir ambientes, recupere o SQL original do histórico de trabalho ou gere uma migração de baseline validada a partir do schema remoto.
- As tabelas públicas `customer_profiles` e `customer_orders` têm RLS habilitado. As tabelas privadas de identidade, tentativas, rate limit, cadastro pendente e analytics também têm RLS habilitado e não concedem acesso direto a `anon` ou `authenticated`.
- Produção: **https://adegaetabacariaesquinamix.vercel.app**. Deploy `08525ca8e019a04155e37119a58d7f36a6a72bdf` confirmado como **READY** no ambiente Production.
- A Vercel não registrou erros de runtime na janela consultada de 30 minutos. O plano Hobby não reteve logs para a janela de 24 horas solicitada; ausência de logs não deve ser interpretada como ausência de erros nesse período.

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

## 7. Verificações executadas em 2026-11-19

- Deploy de Production do commit `08525ca8e019a04155e37119a58d7f36a6a72bdf`: **READY**; build concluído em 452 ms; alias de produção associado.
- Combined status do commit: Vercel **success**.
- Banco Supabase: **ACTIVE_HEALTHY**; seis versões de migração registradas no histórico remoto.
- RLS habilitado em todas as tabelas verificadas dos schemas `public` e `private`.
- As políticas públicas permitem leitura do próprio perfil e dos próprios pedidos; a atualização de perfil mantém `USING` e `WITH CHECK` vinculados a `auth.uid()`.
- Tabelas privadas verificadas concedem privilégios somente a `service_role`; não foi encontrado grant de tabela para `anon`, `authenticated` ou `PUBLIC`.
- Funções privilegiadas `check_rate_limit`, `stage_pending_registration`, `promote_pending_registration` e `update_customer_profile` têm execução concedida a `service_role` e não a `anon`, `authenticated` ou `PUBLIC`. Todas usam `search_path` fixo.
- Security Advisor: cinco avisos INFO de RLS sem políticas em tabelas do schema privado (intencionais no modelo de acesso atual) e um WARN para proteção contra senhas vazadas desabilitada.
- Performance Advisor: seis índices ainda sem uso observado. Não os remova sem avaliar tráfego e consultas reais.
- Runtime Errors da Vercel: nenhum erro na janela consultada de 30 minutos.
- A suíte `node tools/test_auth.js` e o workflow `.github/workflows/auth-check.yml` existem no repositório, mas não foi encontrada execução associada ao commit de produção nesta consulta. Não declarar os testes automatizados como aprovados sem executá-los.
- Não foi realizado teste ponta a ponta com conta real nesta revisão.

## 8. Pendências operacionais e critérios de liberação

- **Proteção contra senhas vazadas:** o Supabase Security Advisor informa `auth_leaked_password_protection` desabilitada. Habilite em Authentication → Password Security quando o plano/configuração permitir. A ferramenta conectada nesta revisão não expõe a alteração dessa configuração Auth; não foi feita mudança.
- **Migração ausente no Git:** recuperar o SQL original da versão `20261119022341` ou gerar baseline validada e versionada antes de declarar o repositório totalmente reproduzível. Não aplicar SQL reconstruído por suposição ao banco já migrado.
- **Teste ponta a ponta obrigatório antes de ampliar o cadastro:** usar conta de teste dedicada para cadastro + confirmação por e-mail, login, renovação de sessão, edição de perfil, recuperação de senha/e-mail, endereço temporário e padrão no checkout, histórico de pedido, logout e exclusão da conta. Nunca usar conta real de cliente em testes destrutivos.
- **Token administrativo de pedidos:** `ORDERS_ADMIN_TOKEN` não aparece entre as variáveis de ambiente listadas para o projeto Vercel. Sem ele, não habilitar atualização administrativa de status via API; manter o Table Editor com acesso administrativo restrito até configurar e testar o token no servidor.
- **Catálogo comercial:** o README e `catalog.js` identificam produtos/preços demonstrativos. Substitua pelos dados confirmados pela loja antes de anunciar valores ou disponibilidade como reais. Não inventar preços, estoque, promoções, avaliações ou ranking.
- **Índices sem uso:** manter até análise de volume e plano de consulta; não remover por alerta isolado.
- **Plano Hobby/Free:** a retenção de runtime logs é limitada; não usar consultas fora da janela disponível como evidência de zero erros.
- **Dados sensíveis:** não rotacionar `CPF_HASH_SECRET` sem plano de migração dos HMACs existentes. Não recriar nem sobrescrever segredos Vercel já cadastrados sem necessidade.
Não reverta as migrações aplicadas, não remova variáveis sensíveis existentes e não altere `CPF_HASH_SECRET` sem plano de migração dos hashes.
