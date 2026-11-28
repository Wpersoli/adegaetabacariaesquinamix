# Ajustes visuais — 28/11/2026

## Alterações aplicadas

- Banners verticais mobile: renderização sem corte (`object-fit: contain`), centralização e manutenção da proporção original 440×896 / 880×1792.
- Áreas clicáveis sobre as faixas de Instagram, rota, WhatsApp e CTA inferior: recalibradas em percentuais da arte para acompanhar as posições visuais dos elementos.
- Rodapé: colunas responsivas, espaçamento consistente, logo com dimensões controladas, ícones sociais com alvos uniformes e textos de contato protegidos contra overflow.
- Logo do site: `assets/logo.webp` atualizado a partir da versão de maior resolução já existente no projeto (`design-src/esquina-mix-logo@2x.webp`, 1200×1200), sem redesenho da marca.
- Banner desktop: corrigido o descritor `srcset` da arte de 2880 px, que estava declarado incorretamente como 2048 px.
- Service Worker: versão elevada para `esquina-mix-v38`; removida da lista de pré-cache uma imagem legada inexistente (`assets/hero-mobile.webp`) e incluídas as seis versões reais dos banners mobile.

## Verificações executadas

- Sintaxe dos arquivos JavaScript: verificada com `node --check`.
- Sintaxe CSS: analisada sem erros de parsing.
- Referências locais do `index.html`: sem arquivos ausentes.
- Arquivos listados no pré-cache do Service Worker: todos existem.
- As seis artes mobile mantêm proporções correspondentes entre as versões 440×896 e 880×1792.

## Limite dos arquivos recebidos

As artes dos banners foram recebidas como imagens WebP achatadas, sem camadas editáveis. Por isso, os elementos gráficos internos (textos, produtos, logo impressa na arte e ilustrações) não foram deslocados individualmente. Foram preservados os arquivos originais, corrigidos o enquadramento e as áreas interativas do site. Para reposicionar cada elemento interno pixel a pixel, é necessário o arquivo-fonte editável de cada banner (PSD, AI, Canva ou equivalente) e o manual oficial da marca, caso exista em documento separado.

A identidade visual documentada no README do projeto foi mantida: paleta, tipografia e linguagem visual existentes. Nenhuma lógica de pedidos, autenticação, catálogo ou integração foi intencionalmente alterada.


## Correção adicional — segundo banner mobile (28/11/2026)

- O segundo slide agora referencia o único arquivo válido de alta resolução `assets/hero-m2-880.webp` (1003×2048); removida a referência inexistente `hero-m2-440.webp` e removida a cópia com nome duplicado `assets/assetshero-m2-440.webp`.
- A proporção original da arte é preservada no segundo slide, sem `object-fit: cover` ou deformação.
- As áreas clicáveis do Instagram, Como Chegar, WhatsApp e CTA foram reposicionadas somente no segundo slide, em três colunas iguais e sobre as respectivas regiões visuais.
- Service Worker atualizado para `esquina-mix-v39`; o teste PWA verifica cache, resposta HTTP, decodificação, proporção e alinhamento das áreas interativas.
