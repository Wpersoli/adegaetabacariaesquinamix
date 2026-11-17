# Adega e Tabacaria Esquina Mix

Cardapio digital responsivo, sem framework e sem dependencias de build.

## Estrutura
- `index.html`: estrutura da pagina; `styles.css`: estilos; `app.js`: catalogo, busca, sacola e envio por WhatsApp.
- `assets/hero-desktop.webp` / `hero-mobile.webp`: banners do hero. `assets/og-image.jpg`: imagem de compartilhamento (1200x630).
- `design-src/`: artes-fonte (logo HD etc.). Fica no Git, mas NAO vai para o site (`.vercelignore`).
- `assets/marcas/`: logos da secao "Frota oficial" (letreiro borda a borda, loop para a esquerda). Para incluir/remover marca, edite o array `brands` em `app.js` e adicione o `.webp` nessa pasta.
- Animacao dos logos da frota: flutuacao escalonada, brilho que atravessa o bloco e destaque no hover, tudo em CSS (final do `styles.css`). Desativa sozinha com "reduzir movimento" do sistema.
- Botoes flutuantes (canto direito): WhatsApp fixo e "voltar ao topo" logo acima (aparece apos rolar 400px). O numero do WhatsApp do botao vem da meta `esquina-whatsapp`. Os dois letreiros (barra "Retira no balcao" e "Frota oficial") correm em loop continuo para a esquerda, inclusive com "reduzir movimento" ativo.
- `assets/favicon.ico`, `favicon-48.png`, `apple-touch-icon.png`: icones gerados a partir da logo oficial.

## Identidade visual
- Tipografia (referencia PLANET EXPRESS): titulos, menus, botoes e cards usam `--f-display` = Rohn Rounded Black (fonte comercial; se instalada/embutida e usada primeiro, senao cai em `Russo One`, depois `Archivo Black`). A assinatura ADEGA · TABACARIA e rotulos usam `Bebas Neue` (`--f-sign`) em dourado `#E5A900`. Corpo de texto continua `DM Sans`. Para usar a Rohn de verdade, coloque o `.woff2` em `assets/fonts/` e adicione `url()` no `@font-face` do fim do `styles.css`. Neon branco/dourado da marca reage ao mouse (final do `app.js`).
- Paleta de cores (rosa/dourado/ciano sobre fundo escuro) mantida conforme o manual da marca Esquina Mix.
- Elementos funcionais adicionados: barra de avisos com ticker animado, botao flutuante do WhatsApp, barra fixa de sacola no mobile, favoritos (coracao) por produto e microanimacao de "Adicionado" no botao de compra.

## Configuracoes pendentes
1. Substituir os itens demonstrativos em `catalog` (`app.js`) pelos produtos, descricoes e precos reais.
2. Numero do WhatsApp: fica na tag `<meta name="esquina-whatsapp">` do `index.html` (DDI + DDD + numero, so digitos) e nos links `wa.me` da pagina.
3. Revisar os textos de `Atendimento` no rodape e no ticker (horario de funcionamento, bairro/regiao de entrega).

O catalogo atual e demonstrativo; os valores e a disponibilidade devem ser confirmados com a loja. O carrinho e os favoritos persistem no navegador (localStorage). A finalizacao abre o WhatsApp apos configurar o numero.

## Publicacao
Projeto estatico. Basta conectar a branch `main` na Vercel; nao requer comando de build nem instalacao de pacotes.

## Seguranca e deploy
- `vercel.json`: CSP restritiva, HSTS, Permissions-Policy, COOP, nosniff. Se adicionar qualquer dominio externo (analytics, fontes, iframes), inclua-o na CSP.
- `robots.txt` e `sitemap.xml` na raiz; ao trocar para dominio proprio, atualize canonical, og:url, sitemap e JSON-LD.
- Horario de funcionamento: constantes `OPEN`/`CLOSE` no bloco "Status da loja" de `app.js` e no JSON-LD do `index.html`.

## Mapa e rota (seção "// base terrestre")
- Cartão (selo de horário, endereço, painel de rotas com modos carro/ônibus/a pé/bike, origem digitável ou "usar minha localização", copiar endereço) + mapa com botões de rota. Mesma estrutura no desktop (2 colunas) e no celular (empilhado).
- **Celular/tablet (≤900px):** tocar em "Como chegar" (cartão), no endereço ou em "Como chegar" da barra flutuante abre uma **tela cheia de rota** com o mapa do próprio site, distância em linha reta, tempo aproximado e precisão do GPS. O mapa se atualiza a cada ~20 m / 6 s de deslocamento; o botão Voltar do aparelho fecha a tela. No desktop, "Como chegar" continua abrindo o Google Maps e o endereço traça a rota no mapa da página.
- A posição não é gravada: só é enviada ao Google Maps para desenhar a rota. Tempo/distância da tela cheia são estimativas (linha reta x fator de ruas x velocidade média); o tempo oficial com trânsito aparece no próprio mapa.
- Sem chave, usa o embed do Google sem API key. Para a rota oficial com trânsito, crie uma chave da **Maps Embed API**, restrinja por referrer e cole em `MAPS_KEY` (bloco "Rota até a loja" do `app.js`). A CSP já permite os iframes do Google; `geolocation=(self)` está no `vercel.json`.

## Barra do topo
- Cabeçalho + categorias ficam num bloco `.bar` (sticky): somem ao rolar para baixo e reaparecem ao rolar para cima, no desktop e no celular. Não esconde com a sacola aberta, com a busca em foco, logo após clicar numa categoria ou adicionar um item (a barra reaparece para mostrar a sacola). Respeita "reduzir movimento".

## Fotos de produtos
- `assets/produtos/`: fotos padronizadas (800x800, fundo branco, WebP). No `catalog` do `app.js`, use `img:'assets/produtos/arquivo.webp'`.
- `tools/coletar_imagens.py`: coleta e padroniza novas fotos (requer Pillow). Confirme os direitos de uso das imagens antes de publicar.
- Os precos dos itens com foto (ids 12+) sao EXEMPLO e precisam ser substituidos pelos reais.

## App instalável (PWA)
- `manifest.webmanifest` + `sw.js` + `assets/icon-*.png`: o site pode ser instalado como app/atalho.
- O convite aparece depois da confirmação +18 (Android/Chrome/Edge: botão nativo; iPhone/iPad: passo a passo). "Agora não" silencia por 7 dias.
- Ao publicar mudanças grandes, aumente `VERSAO` no `sw.js` para renovar o cache dos visitantes.

## Cabeçalho responsivo (baseado no exemplo de referência)
- Ponto de quebra: **1025px**. Desktop: marca | busca (56px) | conta e sacola (caixas 48px) + barra de categorias centralizada.
- Celular/tablet (≤1024px): hambúrguer 44px | marca centralizada 78px | lupa, conta e sacola 44px sem caixa. A barra horizontal vira um menu em tela cheia (hambúrguer), com subcategorias em sanfona. A lupa abre o campo de busca (com auto-preenchimento) em linha própria.
- **Validar:** `npm i -D playwright && npx playwright install chromium`, depois `python -m http.server 8080` e `node tools/validar_responsivo.js http://localhost:8080` (11 larguras, de 320 a 1920px).

## Login e cadastro (botão de usuário no cabeçalho)
Arquivos: `auth.css`, `auth.js` e o botão `#accountBtn` no `index.html`. Abre um painel responsivo (cartão no desktop, painel que sobe da base no celular) com: Entrar, Criar conta, Concluir cadastro (após Google), Recuperar senha e Minha conta.
- **Cadastro por e-mail:** nome, e-mail, CPF (máscara + validação dos dígitos), nascimento (só maiores de 18) e senha (mín. 8, letras e números), com consentimento LGPD. **1 CPF = 1 conta.**
- **Google:** botão "Entrar/Cadastrar com Google" (fluxo por redirecionamento). Quem entra pelo Google informa CPF e nascimento na tela "Concluir cadastro".
- **Modo** (meta `esquina-auth` no `<head>`): `demo` (padrão, só neste navegador; NÃO é seguro nem consulta a Receita) ou `api` (usa o servidor). **Para produção troque para `api`.**
- **Contrato do servidor** (`/api/auth`, JSON, cookie de sessão httpOnly+Secure+SameSite, header `X-Requested-With: esquina`):
  - `POST /signup {name,email,cpf,birth,password,consent}` → 201 `{user}`; erros `{code}`: `CPF_IN_USE`, `EMAIL_IN_USE`, `CPF_INVALID`, `CPF_NOT_MATCH`, `UNDERAGE`, `RATE_LIMIT`
  - `POST /login {email,password}` → 200 `{user}` | 401 `{code:"BAD_CREDENTIALS"}`
  - `POST /complete {cpf,birth,consent}` (conta Google sem CPF) · `POST /forgot {email}` (sempre 200) · `POST /logout`
  - `GET /me` → `{user:{name,email,cpfStatus,needsCpf?}}` ou 401 · `GET /google` → redireciona ao Google; o callback grava a sessão e volta para `/?auth=google`
  - No servidor: validar o CPF na base do governo (ex.: Serpro Datavalid ou provedor de KYC), guardar só o hash do CPF com índice único, senha com argon2/bcrypt, limitar tentativas.
- Para a CSP do `vercel.json` não é preciso liberar nada: o Google usa redirecionamento e as chamadas vão para o mesmo domínio.


## Autenticação Supabase (nova implementação)

A implementação de autenticação em andamento está isolada na branch **feature/supabase-auth-esquina-mix**.
Consulte **docs/SUPABASE_SETUP.md** antes de configurar ou publicar.

- Cadastro com confirmação obrigatória por e-mail; a sessão não é criada antes da confirmação.
- Sessão mantida por cookies HttpOnly, Secure em produção e SameSite=Lax.
- Perfil com RLS; CPF guardado somente como HMAC-SHA256 em schema privado.
- Recuperação de senha e recuperação de e-mail com máscara e limitação de tentativas.
- O Service Worker não armazena respostas da API nem a página de confirmação.
- WhatsApp é atendimento manual; não há envio automático nem aprovação de cadastro pelo WhatsApp nesta integração.
- A validação do CPF verifica os dígitos. Não consulta a Receita Federal.

A migração do banco está em **supabase/migrations/202611160001_esquina_auth.sql**.
