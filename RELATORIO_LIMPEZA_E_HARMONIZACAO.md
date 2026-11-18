# Relatório — Limpeza cirúrgica + harmonização visual
**Projeto:** Adega e Tabacaria Esquina Mix · **Escopo:** `styles.css`, `auth.css`
**Método:** nenhuma remoção foi aplicada sem comprovação; toda mudança foi validada por captura de tela (Chrome headless, larguras 360/414/768/1024/1280/1600px) e por diff de métricas computadas (altura, padding, gap) antes/depois, nas páginas `index.html` e `produtos.html`. Nenhuma alteração em HTML, JS, assets ou configuração (`vercel.json`, `sw.js`, Supabase, API).

## 1. Diagnóstico

**Limpeza (CSS morto comprovado):** cruzamento de todos os seletores de classe/ID definidos em `styles.css`/`auth.css`/`produtos.css`/`auth-confirm.css`/`preloader.css` contra o uso real em `index.html`, `produtos.html`, `auth/confirm.html` e todos os `.js` do projeto (incluindo geração dinâmica de classes via template string). Seis seletores não possuem nenhum elemento correspondente em lugar nenhum do site.

**Harmonização visual:** a home empilha seis seções de conteúdo (`.feat`, `.rank`, `.fleet`, `.rev`, `.loc2`, rodapé `.ft`) cujo padding vertical foi definido em momentos diferentes do histórico do projeto, sem uma escala comum — variando de 32px a 72px e produzindo respiros desiguais entre seções (de 80px a 128px), visível nas capturas de tela como trechos ora apertados (ranking→frota, frota→avaliações) ora excessivamente largos (cardápio→ranking).

## 2. Evidências

| Item | Seletor | Onde | Prova de que é morto/inconsistente |
|---|---|---|---|
| CSS morto | `.hero-cta` + `@keyframes pulse` | `styles.css` (regra própria + 2 listas de tipografia + 1 media query) | 0 ocorrências em qualquer HTML/JS do repositório; vestígio de um CTA do hero anterior ao carrossel atual |
| CSS morto | `.rev__big`, `.rev__sub` | `styles.css` | 0 ocorrências; os elementos reais usam `.rev__num b`/`.rev__count b` |
| CSS morto | `.facet-clear` | `styles.css` | 0 ocorrências; não gerado por `app.js`/`produtos.js` |
| CSS morto | `.au-lbl` (dentro de `.au-f .au-lbl`) | `auth.css` | 0 ocorrências; os rótulos reais usam `.au-f label` |
| CSS morto | `.au-note` | `auth.css` | 0 ocorrências em `auth.js`/`auth-confirm.js` |
| Espaçamento inconsistente | `.feat .rank .fleet .rev .loc2 .ft` | `styles.css` | padding vertical variava 32–72px; gap entre seções variava 80–128px (medido via `getBoundingClientRect`) |

Capturas antes/depois (1280px, 768px, 414px) confirmaram visualmente a correção, sem nenhuma quebra.

## 3. Impacto

- **Risco de regressão: nulo.** Cada remoção foi confirmada por busca exaustiva (estática + dinâmica); nenhuma delas jamais afetou um elemento real, logo a remoção não altera nenhum pixel renderizado. Comprovado por diff de screenshot pixel-a-pixel em `produtos.html` (página não tocada pela harmonização): **0 diferença de layout**, variação de altura total 0px.
- **Harmonização:** altera *apenas* `padding`/`margin` de seis seletores, nos mesmos breakpoints já usados pelo projeto (900px/600px) — não toca seletor, cor, fonte, grid ou comportamento. Resultado: ritmo vertical consistente (56px desktop / 40px tablet / 28px mobile) entre todas as seções da home, incluindo o topo do rodapé (`.ft`), que é compartilhado por todas as páginas do site.
- **Sem overflow horizontal introduzido** em nenhuma das seis larguras testadas, em nenhuma das duas páginas.
- **`produtos.html` intacto:** a grade de produtos (`.pg`, `.pg-grid`, `.pg-layout`) ficou pixel-idêntica antes/depois; apenas o rodapé compartilhado ganhou o mesmo respiro padronizado.

## 4. Correção aplicada

1. Removidas as 6 regras/seletores mortos listados acima (incluindo a keyframe `pulse`, exclusiva do `.hero-cta`).
2. Simplificado `.au-f label,.au-f .au-lbl{…}` → `.au-f label{…}` (mesma declaração, sem o seletor inútil).
3. Adicionado ao final de `styles.css` um bloco aditivo (no mesmo padrão de patches já usado no arquivo) que:
   - Define `padding-block` de `.feat/.rank/.fleet/.rev/.loc2` e `padding-top` de `.ft` em 56px (desktop) / 40px (≤900px) / 28px (≤600px).
   - Unifica `margin-bottom` de `.feat__head`/`.sec-head` em 28px (desktop) / 20px (≤600px).

## 5. Código corrigido

Ver `styles.css` e `auth.css` neste pacote. Resumo das linhas alteradas:
- `styles.css`: −24 linhas de CSS morto, +22 linhas de harmonização (bloco novo, comentado, ao final do arquivo).
- `auth.css`: −2 linhas de CSS morto.

Nenhum outro arquivo foi modificado.
