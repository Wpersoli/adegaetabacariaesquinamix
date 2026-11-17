# Esquina Mix — ativação da autenticação Supabase

## Estado desta implementação

O fluxo foi preparado em uma branch isolada. A produção não foi alterada.
A ativação real depende de um projeto Supabase exclusivo e das variáveis privadas da Vercel.

## 1. Organização paga exclusiva (recomendado)

**Não atualize Wpersoli's Org diretamente.** Ela contém os projetos existentes **trotebox-prod** e **valora-credito**. Como o plano é aplicado à organização inteira, todos os projetos nela passam a seguir a assinatura paga e seus custos de compute. Para mantê-los intactos no Free, crie uma organização separada chamada **Esquina Mix** e escolha o plano **Pro** para essa nova organização.

Preço público consultado em 16/11/2026: Pro a partir de **US$ 25/mês**, com o primeiro projeto incluído. A franquia de compute de US$ 10 cobre um projeto no tamanho Micro padrão. O uso acima das franquias pode gerar custos adicionais; os valores finais e eventuais tributos/conversão aparecem no checkout e na fatura. Mantenha o spend cap ativado. Consulte https://supabase.com/pricing e https://supabase.com/docs/guides/platform/billing-faq.

Passos:
1. Abra https://supabase.com/dashboard/new e crie a organização **Esquina Mix**.
2. Escolha **Pro** para essa organização e confira o valor final apresentado pelo Supabase antes de concluir o pagamento.
3. Não altere o plano de **Wpersoli's Org** e não pause, exclua ou transfira **trotebox-prod** ou **valora-credito**.
4. Depois que a nova organização aparecer na conexão Supabase, crie nela o projeto **esquina-mix-auth** na região São Paulo (**sa-east-1**).

Supabase não oferece, nesta conexão, uma ação para criar organizações ou alterar assinaturas. Essa etapa de cobrança precisa ser concluída pelo proprietário no Dashboard. O restante — criação do projeto, migração, chaves, configuração e testes — pode continuar pela integração depois que a nova organização estiver disponível.

## 2. Aplicar o banco

No SQL Editor do novo projeto, execute o conteúdo de:

**supabase/migrations/202611160001_esquina_auth.sql**

O script cria:
- **public.customer_profiles**, com RLS para cada cliente consultar/alterar apenas o próprio nome;
- **private.customer_identity**, que guarda somente HMAC-SHA256 do CPF e data de nascimento;
- **private.email_lookup_attempts**, para limitar tentativas de recuperação;
- RPCs restritas a **service_role** para cadastrar e localizar identidade.

O CPF nunca é salvo em texto puro. A chave HMAC fica exclusivamente no servidor Vercel.

## 3. Configurar Supabase Auth

Em Authentication → Providers → Email:
- habilite Email;
- habilite confirmação de e-mail;
- mantenha a confirmação obrigatória antes de criar sessão;
- configure SMTP de produção antes de abrir o cadastro ao público (o serviço SMTP padrão pode ter limites de envio).

Em Authentication → URL Configuration:
- Site URL: **https://adegaetabacariaesquinamix.vercel.app**
- Redirect URL: **https://adegaetabacariaesquinamix.vercel.app/auth/confirm.html****
- Para testes locais, adicione somente a origem local que realmente será usada.

O template “Confirm signup” deve usar **{{ .ConfirmationURL }}** para que o Supabase respeite o redirect_to enviado pela aplicação. O link de recuperação também usa a rota **/auth/confirm.html?mode=recovery**.

## 4. Variáveis privadas na Vercel

Cadastre em Project → Settings → Environment Variables, para Production e Preview quando necessário:

| Nome | Valor |
|---|---|
| SUPABASE_URL | URL do projeto Supabase |
| SUPABASE_PUBLISHABLE_KEY | Chave publishable (sb_publishable_...) ou, em instalações antigas, SUPABASE_ANON_KEY |
| SUPABASE_SERVICE_ROLE_KEY | Legacy JWT da chave service_role em Project Settings → API Keys — somente servidor |
| CPF_HASH_SECRET | Segredo aleatório com pelo menos 32 bytes (ex.: gere com openssl rand -hex 32) |
| SITE_URL | https://adegaetabacariaesquinamix.vercel.app |
| NODE_ENV | production |

Nunca coloque **SUPABASE_SERVICE_ROLE_KEY** ou **CPF_HASH_SECRET** em HTML, JavaScript do navegador, GitHub ou variáveis NEXT_PUBLIC_*.
Use **.env.example** apenas como modelo. Não commite um .env real.

## 5. WhatsApp manual

O botão usa a meta já existente **esquina-whatsapp** no index.html. A mensagem abre uma conversa manual com a loja; não envia mensagens automáticas nem confirma cadastro por conta própria. A confirmação automática disponível nesta entrega é por e-mail.

Se a loja decidir aceitar validação humana como alternativa ao e-mail, o atendente precisará verificar o cliente fora do site e aprovar a conta por um procedimento administrativo protegido. Não se deve marcar e-mails como confirmados apenas porque alguém clicou em um link público de WhatsApp.

## 6. Google OAuth

O botão Google permanece no layout. Para ativá-lo, configure Google em Authentication → Providers → Google e cadastre o callback do Supabase no Google Cloud:

**https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback**

Sem essas credenciais no Supabase, o botão não concluirá login.

## 7. Testes de aceite antes de publicar

1. Cadastro válido cria usuário sem sessão e envia confirmação.
2. Login antes da confirmação é recusado.
3. Link expirado ou reutilizado não autentica.
4. Link válido cria cookies HttpOnly e retorna à rota original.
5. Login válido recupera perfil e nome.
6. Logout revoga sessão e limpa cookies.
7. Recuperação de senha permite definir uma nova senha.
8. Recuperação de e-mail mascara o endereço e limita tentativas.
9. CPF duplicado é rejeitado sem armazenar CPF em texto puro.
10. Perfil não pode ser lido por outro usuário (RLS).
11. API e rota de confirmação nunca entram no cache do Service Worker.

## 8. Limites conhecidos

- Não existe integração automática com WhatsApp Business nesta arquitetura; o canal é atendimento manual.
- A recuperação de e-mail usa CPF + nascimento e limitação de tentativas. Antes de produção, avalie um fator adicional de verificação de posse (por exemplo, confirmação por WhatsApp feita pelo atendente).
- A validação matemática do CPF não consulta a Receita Federal. Não alegar validação governamental sem contratar e integrar um provedor autorizado.
- Google OAuth depende de credenciais externas.
