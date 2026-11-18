# Esquina Mix — configuração da autenticação Supabase

## Estado atual

- Projeto Supabase: **adega-mix**
- Project ref: **rduwcxzegiffqgnnbhis**
- Região: **South America (São Paulo), sa-east-1**
- Organização: **Wpersoli's Org**, plano **Free**.
- Estado do banco: **ACTIVE_HEALTHY**.
- Migrações de autenticação, telefone e pedidos aplicadas e verificadas. A migração `20261117170000_customer_account_details.sql` deve ser aplicada antes de publicar os novos recursos de Minha Conta.
- Tabelas confirmadas: `public.customer_profiles`, `private.customer_identity` e `private.email_lookup_attempts`; RLS habilitado nas três.
- A branch de integração continua isolada. Nenhuma alteração foi publicada na Produção.

**Limite do plano Free:** mantenha no máximo dois projetos ativos na organização. `trotebox-prod` está pausado (INACTIVE) e `valora-credito` continua ativo e preservado. Não reative o projeto pausado enquanto `adega-mix` estiver ativo sem antes rever o limite do plano.

## 1. Preview Vercel (somente branch)

A implantação da integração está isolada na branch **feature/supabase-auth-esquina-mix**. O endereço de Preview da branch é:

**https://adegaetabacariaesquinamix-git-feature-7c866c-wpersolis-projects.vercel.app**

As variáveis já preparadas no Preview são `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `CPF_HASH_SECRET` e `SITE_URL`, vinculadas à branch de integração. A chave administrativa ainda precisa ser cadastrada:

| Nome | Valor |
|---|---|
| `SUPABASE_URL` | `https://rduwcxzegiffqgnnbhis.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publishable `sb_publishable_...` do projeto |
| `SUPABASE_SECRET_KEY` | Chave secreta `sb_secret_...` do projeto; **somente servidor** |
| `CPF_HASH_SECRET` | Segredo aleatório de pelo menos 32 bytes; somente servidor |
| `SITE_URL` | URL de Preview acima, sem barra final |

Em Vercel → Project → Settings → Environment Variables, cadastre `SUPABASE_SECRET_KEY` no ambiente **Preview**, limitado à branch `feature/supabase-auth-esquina-mix`. Marque a variável como **Sensitive/Encrypted**. Não use prefixos `NEXT_PUBLIC_` e não compartilhe a chave por chat.

O código aceita a nova chave `SUPABASE_SECRET_KEY` (formato `sb_secret_...`) e mantém compatibilidade temporária com a antiga `SUPABASE_SERVICE_ROLE_KEY` (JWT legado). Para novos projetos, prefira a chave secreta atual do Supabase. Consulte a [documentação oficial de API keys](https://supabase.com/docs/guides/getting-started/api-keys).

**Produção não deve receber essas variáveis ainda.** Primeiro valide a integração no Preview, e só depois prepare as variáveis de Production e a publicação do PR.

## 2. Supabase Auth — ativação no Dashboard

No projeto `adega-mix`, abra Authentication:

### E-mail

Em **Authentication → Providers → Email**:
- habilite o provedor Email;
- habilite **Confirm email** para exigir confirmação antes do primeiro login;
- mantenha a confirmação obrigatória;
- configure um SMTP próprio antes de abrir o cadastro ao público. O serviço de e-mail padrão pode ter limites de envio.

O template **Confirm signup** deve preservar o link `{{ .ConfirmationURL }}`, para que o Supabase respeite o `redirect_to` enviado pela aplicação. O template de recuperação também deve usar o link de confirmação do Supabase.

### URLs permitidas

Em **Authentication → URL Configuration**:
- Site URL de Produção: `https://adegaetabacariaesquinamix.vercel.app`
- Adicione às Redirect URLs permitidas:
  - `https://adegaetabacariaesquinamix.vercel.app/auth/confirm.html`
  - `https://adegaetabacariaesquinamix-git-feature-7c866c-wpersolis-projects.vercel.app/auth/confirm.html`

Não use curingas amplos. Adicione apenas os endereços que realmente serão usados.

## 3. Modelo do banco

A migração aplicada está em **supabase/migrations/202611160001_esquina_auth.sql**.

Ela cria:
- **public.customer_profiles**: nome, nascimento, consentimento e telefone E.164 (com estado separado de verificação), com RLS para o próprio usuário;
- **private.customer_identity**: guarda somente HMAC-SHA256 do CPF e a data de nascimento;
- **private.email_lookup_attempts**: limita tentativas de recuperação por IP e CPF;
- RPCs de cadastro e localização de identidade executáveis exclusivamente pelo servidor.

O CPF nunca é salvo em texto puro. O segredo HMAC fica exclusivamente em variável de servidor da Vercel.

## 4. Segurança e fluxo de conta

- Cadastro por e-mail exige nome, e-mail, telefone com DDD, CPF válido matematicamente, data de nascimento, maioridade, senha e consentimento.
- Cadastro Google exige telefone com DDD, CPF, data de nascimento e consentimento na etapa de conclusão.
- O telefone é armazenado normalizado em E.164 (+55...) como dado obrigatório de contato. Sem API paga de WhatsApp/SMS, não há envio de OTP; `phone_verified_at` permanece NULL e a interface informa que o telefone não foi verificado.
- A confirmação de e-mail continua sendo o método de ativação da conta.
- A conta só libera sessão após confirmar o e-mail.
- Sessões são mantidas em cookies HttpOnly, SameSite=Lax e Secure em execução de Produção.
- A chave secreta Supabase é usada somente pelos endpoints server-side em `/api/auth/*`.
- Os schemas/tabelas privadas não concedem acesso a `anon` ou `authenticated`; o acesso administrativo é exclusivo ao servidor.
- A validação do CPF verifica os dígitos. **Não consulta a Receita Federal** nem comprova identidade perante o governo.

## 5. WhatsApp manual

O botão usa a meta existente **esquina-whatsapp** no `index.html`. Abre a conversa manual com a loja; não envia mensagens automáticas e não confirma cadastro sozinho. A confirmação automática desta arquitetura é por e-mail.

Atendimento humano pelo WhatsApp pode orientar o cliente, mas não deve aprovar identidade ou marcar e-mail como confirmado por meio de link público.

## 6. Google OAuth (opcional)

Para ativar Google:
1. Configure Google em **Authentication → Providers → Google**.
2. Cadastre no Google Cloud o callback:
   `https://rduwcxzegiffqgnnbhis.supabase.co/auth/v1/callback`
3. Adicione também as Redirect URLs Vercel da seção 2.
4. Faça um teste completo no Preview antes de liberar em Produção.

Sem as credenciais OAuth do Google, esse método não concluirá login.

## 7. Testes obrigatórios antes de Produção

1. Cadastro válido cria usuário pendente e envia e-mail.
2. Login antes da confirmação é recusado.
3. Link expirado/reutilizado não autentica.
4. Link válido cria cookies HttpOnly e retorna à rota original.
5. Login confirmado recupera perfil e nome.
6. Logout invalida a sessão e limpa cookies.
7. Recuperação de senha permite cadastrar nova senha.
8. Recuperação de e-mail mascara o endereço e limita tentativas.
9. CPF duplicado é rejeitado sem salvar o número em texto puro.
10. Outro usuário não consegue ler ou alterar o perfil alheio.
11. API e página de confirmação não entram no cache do Service Worker.
12. Catálogo, busca, filtros, favoritos, carrinho, responsividade, animações, mapa, PWA e WhatsApp manual continuam funcionando como antes.

## 8. Critério de publicação

Não mesclar o PR nem alterar Produção até:
- configurar `SUPABASE_SECRET_KEY` no Preview;
- confirmar Email provider e URLs de redirect no Supabase;
- configurar SMTP de teste;
- concluir os testes de cadastro, confirmação, login, sessão, logout e recuperação;
- validar visualmente desktop, tablet e mobile e testar as funcionalidades já existentes.

A ativação de Google OAuth pode ser concluída depois, desde que o botão não seja apresentado como funcional antes de configurar as credenciais.


## 7. Dados editáveis da conta e endereço padrão

Antes de publicar a atualização de Minha Conta, aplique a migração
`supabase/migrations/20261117170000_customer_account_details.sql` no projeto Supabase.
Ela adiciona `delivery_address` a `customer_profiles` e cria a RPC
`update_customer_profile`, que atualiza nome, telefone, nascimento e endereço
padrão em uma única operação. A data de nascimento também é sincronizada com
`private.customer_identity`; o CPF continua armazenado somente como HMAC.
O endereço informado diretamente no checkout é usado apenas na mensagem do
pedido pelo WhatsApp e não substitui o endereço padrão salvo na conta.
