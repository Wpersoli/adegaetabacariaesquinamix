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

Arquivos: `auth.css`, `auth.js`, `auth-confirm.js`, `auth-confirm.css` e endpoints em `api/auth/`. O painel mantém as telas Entrar, Criar conta, Concluir cadastro, Recuperar senha, Recuperar e-mail e Minha conta.

- Cadastro por e-mail e conclusão de cadastro Google: nome, e-mail, telefone com DDD (obrigatório), CPF (validação matemática dos dígitos), nascimento, maioridade e consentimento.
- O telefone é salvo em formato internacional E.164 como contato da loja. Não é enviado código por WhatsApp e o número permanece marcado como não verificado; a ativação da conta continua dependendo da confirmação por e-mail.
- A conta exige confirmação por e-mail antes de liberar sessão.
- Recuperação de senha por e-mail; recuperação de e-mail com CPF + nascimento, máscara de endereço e limitação de tentativas.
- Google OAuth está preparado no código, mas depende da configuração do provedor Google no Supabase.
- WhatsApp é atendimento manual. Não envia mensagens automaticamente nem aprova contas.

## Autenticação Supabase

A integração está isolada na branch **feature/supabase-auth-esquina-mix** e no PR [#1](https://github.com/Wpersoli/adegaetabacariaesquinamix/pull/1). A Produção não foi alterada.

- Projeto Supabase: **adega-mix**, região São Paulo (`sa-east-1`), plano Free.
- Migração `esquina_auth` aplicada; tabelas de perfil e identidade verificadas com RLS.
- O CPF não é armazenado em texto puro: o servidor guarda apenas HMAC-SHA256.
- A validação confirma somente os dígitos do CPF; não consulta a Receita Federal.
- Cookies de sessão HttpOnly e SameSite=Lax; Secure em ambientes de Produção.
- O Service Worker ignora a API de autenticação e a rota de confirmação.

Consulte **docs/SUPABASE_SETUP.md** para as variáveis Vercel, configuração de e-mail, URLs de redirecionamento e critérios de teste. Não mescle o PR nem altere as variáveis de Produção antes de concluir os testes de aceite.

## Auditoria final de responsividade (nov/2026)
- Testado de 320 a 2560px (18 larguras): sem rolagem horizontal. Grade do catálogo fluida (2 colunas até 480px; depois `auto-fill`, chegando a 7–8 colunas em telas muito largas via `--wrap-max`).
- Alvos de toque de 44px em celular/tablet, fontes mínimas de 10–11px, barra inferior, faixa rosa e cartão do mapa ajustados para 320px.
- "Mais vendidos" usa a foto do produto quando existe; subcategorias sem itens aparecem esmaecidas (continuam clicáveis).
- `.vercelignore` evita publicar `design-src/`, `supabase/`, `docs/`, `tools/` e README. `VERSAO` do `sw.js` = v13.
- Pendentes (dependem de você): banners em maior resolução (celular ~1200×1800; desktop 2880+ de largura), trocar itens demo (ids 1–11) e preços de exemplo, auto-hospedar fontes (.woff2).
