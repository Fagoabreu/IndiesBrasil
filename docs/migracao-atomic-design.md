# Migração para Atomic Design

Documento de acompanhamento da padronização de layout do frontend.
A regra normativa vive em `## Atomic Design (frontend)` no `CLAUDE.md`; aqui fica o
inventário, os contratos e o progresso.

Medição inicial: **79 rotas de UI** (as ~150 rotas de `pages/api/**` não entram),
**65 CSS Modules em `pages/`** e **139 declarações de `max-width`** dentro deles.

## 1. Alvo

Uma página passa a ser **composta**, não desenhada: `PageShell` (largura + ritmo),
`PageHeader`, `Section` e blocos de `components/ui`.

Nenhuma página declara `max-width`, `margin: 0 auto` ou `padding` lateral
próprios — isso pertence ao `PageShell` e ao `.main-content` (que já aplica
`padding: clamp(10px, 2.3vw, 20px)`).

Dependência, numa seta só:

```
Primer (@primer/react)  ->  atoms  ->  molecules  ->  organisms  ->  pages
```

- `atoms` não importa `molecules`/`organisms`; nada em `components/ui` importa de `pages/`.
- Dado (`getServerSideProps`, SWR, `fetch`) fica na página. A camada de UI recebe
  props e devolve intenção (`onChange`, `onSubmit`, `onLoadMore`).
- Componente do Primer é usado direto. Só vira átomo o que carrega regra nossa
  (variante, acessibilidade, token).

## 2. Camadas

### L0 — tokens (`css/styles.css`)

| Token                                | Valor               | Substitui                                                                    |
| ------------------------------------ | ------------------- | ---------------------------------------------------------------------------- |
| `--control-h`                        | `32px`              | altura local em `pages/servicos/index.module.css`; divergia no resto do site |
| `--control-h-sm`                     | `28px`              | botão pequeno dentro de barra                                                |
| `--layout-form`                      | `720px`             | `720/800/820/840/860px` espalhados por 6 módulos                             |
| `--section-gap`                      | `var(--space-6)`    | `margin-bottom` próprio de cada `.section`                                   |
| `--layout-content` / `--layout-wide` | `1040px` / `1200px` | já existiam; passam a ser o único par de larguras de página                  |

### L1 — átomos (`components/ui/atoms`)

| Átomo            | Contrato                                               | Consumidores                                          | Onda |
| ---------------- | ------------------------------------------------------ | ----------------------------------------------------- | ---- |
| `Stack`          | `gap`, `as`, `align`                                   | espaçamento vertical de 46 páginas                    | 0 ✅ |
| `Inline`         | `gap`, `wrap`, `align`, `justify`, `as`                | `.actions` (10), `.toolbar` (5)                       | 0 ✅ |
| `SectionHeading` | `as`, `title`, `description`, `action`, `eyebrow`      | `.sectionTitle` (22 pág./76 usos), `.headerTitle` (7) | 0 ✅ |
| `BackLink`       | `href`, `children`                                     | `.backLink` (16 pág.)                                 | 1    |
| `FormField`      | `label`, `id`, `required`, `hint`, `error`, `children` | `.label` (8), `.hint` (11), `.error` (5)              | 4    |
| `Tag`            | `tone: neutral/brand/ok/warn/danger`, `size`           | `.badge` (6), `.typeBadge` (5)                        | 1    |
| `IconButton`     | `icon`, `label` (obrigatório), `tone`, `onClick`       | `<button className={styles.x}>` (~27 pág.)            | 1    |

> `Button`, `Label`, `TextInput`, `Select`, `Textarea`, `Flash`, `Spinner`,
> `Avatar` e `Dialog` vêm do Primer e **não** se reembrulham.

### L2 — moléculas (`components/ui/molecules`)

| Molécula         | Contrato                                                        | Consumidores                                                 | Onda |
| ---------------- | --------------------------------------------------------------- | ------------------------------------------------------------ | ---- |
| `EmptyState`     | `icon`, `title`, `description`, `action`, `variant: block/page` | `.empty*` — 55 usos em 20 pág.                               | 1    |
| `LoadingState`   | `label`, `variant: block/page`                                  | `.loading*` — 38 usos em 15 pág.                             | 1    |
| `SearchField`    | `value`, `onChange`, `placeholder`, `onClear`                   | `.searchInput` (8 pág.) — corrige o `leadingVisual="search"` | 2    |
| `FilterToolbar`  | `children`, `onClear`, `activeCount`, `sticky`                  | `.toolbar`/`.filters` (8 pág.)                               | 2    |
| `FilterChips`    | `items[{label,onRemove}]`, `onClearAll`                         | 4 pág.                                                       | 2    |
| `LoadMoreButton` | `onClick`, `loading`, `remaining`                               | `.loadMore` (6 pág.)                                         | 2    |
| `Breadcrumbs`    | `items[{label,href}]`                                           | 8 pág.                                                       | 3    |
| `DefinitionList` | `items[{label,value}]`, `columns`                               | 8 pág. (`<dl>` já usado)                                     | 3    |
| `FormSection`    | `title`, `description`, `columns`, `children`                   | `.section` em formulários (13 pág.)                          | 4    |
| `FormActions`    | `submit`, `cancel`, `busy`                                      | `.actions` de formulário (10 pág.)                           | 4    |

### L3 — organismos (`components/ui/organisms`)

| Organismo              | Papel                                                                        | Onda      |
| ---------------------- | ---------------------------------------------------------------------------- | --------- |
| `PageShell`            | shell único: `width: content/wide/form/full`, gutter herdado, ritmo vertical | 0 ✅      |
| `Section`              | `SectionHeading` + corpo, com `--section-gap`                                | 0 ✅      |
| `PageHeader`           | cabeçalho de página (absorve 9 `.pageHeader`)                                | existe ✅ |
| `TabBar`               | abas em pílula (absorve 4 `.feedTab`)                                        | existe ✅ |
| `ListingTemplate`      | `PageHeader` + filtros + grid/lista + vazio + carregar mais                  | 2         |
| `DetailTemplate`       | `Breadcrumbs` + cabeçalho + `DefinitionList` + `Section[]` + coluna lateral  | 3         |
| `FormTemplate`         | `BackLink` + `PageHeader` + `FormSection[]` + `FormActions`                  | 4         |
| `CatalogAdminTemplate` | catálogo + painel de sugestões (padrão `game-genres`)                        | 5         |
| `ReviewQueueTemplate`  | fila de itens a aprovar (`reports`, `moderation`)                            | 5         |
| `SettingsTemplate`     | secções de configuração com guardar/cancelar por secção                      | 6         |
| `ToolLayout`           | cabeçalho `card` + controlos + área de resultado                             | 7         |
| `LandingShell`         | `nav` + `hero` + `Section[]` + footer (hoje em `pages/index.js`)             | 8         |

### L4 — shell do app

`components/Layout.js` (envolve tudo em `_app.js`) + `PageShell` dentro do `<main>`.

## 3. Larguras e ritmo

A largura é da **família**, não da página.

| Família                                                                                  | `PageShell` | Valor  | Porquê                        |
| ---------------------------------------------------------------------------------------- | ----------- | ------ | ----------------------------- |
| Grids de 3–4 colunas (jogos, mesa, quadrinhos, membros, estúdios, estudos, loja)         | `wide`      | 1200px | card de 260–280px sem apertar |
| Feed de 1 coluna e conteúdo longo (streams, análises, agenda, notícias, posts, detalhes) | `content`   | 1040px | medida de leitura             |
| Press-kit, ferramentas                                                                   | `wide`      | 1200px | pré-visualização lado a lado  |
| Formulários, configurações, auth                                                         | `form`      | 720px  | campo largo cansa a leitura   |
| Home                                                                                     | `full`      | 100%   | a página tem shell próprio    |

Ritmo: `PageShell` aplica `padding-block: var(--space-3) var(--space-12)`;
`Section` aplica `margin-bottom: var(--section-gap)`; dentro de um bloco, o
espaçamento é de `Stack`/`Inline` com a escala `--space-*`. Não há terceiro
vocabulário.

## 4. Matriz página a página (79 rotas)

Legenda: ⬜ pendente · 🟨 em execução · ✅ migrada.
`Shell` é o valor de `PageShell`; `Organismo` é o bloco que a página passa a compor.

### A · Home (1)

|     | Página           | Shell | Organismo alvo                                   | Onda |
| --- | ---------------- | ----- | ------------------------------------------------ | ---- |
| ⬜  | `pages/index.js` | full  | `LandingShell` + `Hero` + `Section` + `CardGrid` | 8    |

### B · Listagens com feed (7)

Estados vazios são aqui a maior duplicação (25 usos de `.empty*`) e a barra de
busca ainda imprime a palavra "search" dentro do campo em 6 destas páginas.

|     | Página                         | Shell | Organismo alvo                                         | Onda |
| --- | ------------------------------ | ----- | ------------------------------------------------------ | ---- |
| 🟨  | `pages/jogos/index.js`         | wide  | `ListingTemplate` + `TabBar` (piloto Onda 0: só shell) | 2    |
| ⬜  | `pages/jogos-de-mesa/index.js` | wide  | `ListingTemplate` + `TabBar`                           | 2    |
| ⬜  | `pages/quadrinhos/index.js`    | wide  | `ListingTemplate` + `TabBar`                           | 2    |
| ⬜  | `pages/membros/index.js`       | wide  | `ListingTemplate` + `TabBar`                           | 2    |
| ⬜  | `pages/estudios/index.js`      | wide  | `ListingTemplate`                                      | 2    |
| ⬜  | `pages/estudos/index.js`       | wide  | `ListingTemplate`                                      | 2    |
| ⬜  | `pages/loja/index.js`          | wide  | `ListingTemplate`                                      | 2    |

### C · Listagens simples (8)

|     | Página                     | Shell   | Organismo alvo                    | Onda |
| --- | -------------------------- | ------- | --------------------------------- | ---- |
| ⬜  | `pages/streams/index.js`   | content | `ListingTemplate`                 | 2    |
| ⬜  | `pages/analises/index.js`  | content | `ListingTemplate`                 | 2    |
| ⬜  | `pages/agenda/index.js`    | content | `ListingTemplate`                 | 2    |
| ⬜  | `pages/assets/index.js`    | content | `ListingTemplate` + `FilterChips` | 2    |
| ⬜  | `pages/servicos/index.js`  | content | `ListingTemplate` + `FilterChips` | 2    |
| ⬜  | `pages/noticias/index.jsx` | content | `ListingTemplate`                 | 2    |
| ⬜  | `pages/posts/index.jsx`    | content | `ListingTemplate`                 | 2    |
| ⬜  | `pages/loja/pedidos.js`    | content | `ListingTemplate` (sem filtros)   | 2    |

### D · Detalhes de catálogo (8)

|     | Página                                | Shell   | Organismo alvo                      | Onda |
| --- | ------------------------------------- | ------- | ----------------------------------- | ---- |
| ⬜  | `pages/jogos/[slug]/index.js`         | content | `DetailTemplate` + `DefinitionList` | 3    |
| ⬜  | `pages/jogos-de-mesa/[slug]/index.js` | content | `DetailTemplate`                    | 3    |
| ⬜  | `pages/quadrinhos/[slug]/index.js`    | content | `DetailTemplate`                    | 3    |
| ⬜  | `pages/assets/[slug]/index.js`        | content | `DetailTemplate`                    | 3    |
| ⬜  | `pages/analises/[slug]/index.js`      | content | `DetailTemplate`                    | 3    |
| ⬜  | `pages/estudos/[slug]/index.js`       | content | `DetailTemplate`                    | 3    |
| ⬜  | `pages/estudios/[slug]/index.js`      | content | `DetailTemplate`                    | 3    |
| ⬜  | `pages/streams/[slug].js`             | content | `DetailTemplate`                    | 3    |

### E · Press-kit e reuniões (6)

|     | Página                                    | Shell   | Organismo alvo                  | Onda |
| --- | ----------------------------------------- | ------- | ------------------------------- | ---- |
| ⬜  | `pages/jogos/[slug]/press-kit.js`         | wide    | `DetailTemplate` (duas colunas) | 3    |
| ⬜  | `pages/jogos-de-mesa/[slug]/press-kit.js` | wide    | `DetailTemplate` (duas colunas) | 3    |
| ⬜  | `pages/quadrinhos/[slug]/press-kit.js`    | wide    | `DetailTemplate` (duas colunas) | 3    |
| ⬜  | `pages/estudios/[slug]/press-kit.js`      | wide    | `DetailTemplate` (duas colunas) | 3    |
| ⬜  | `pages/presskit/index.js`                 | wide    | `DetailTemplate`                | 3    |
| ⬜  | `pages/reunioes/[meetingId]/index.js`     | content | `DetailTemplate`                | 3    |

### F · Conteúdo longo (4)

|     | Página                                  | Shell   | Organismo alvo                      | Onda |
| --- | --------------------------------------- | ------- | ----------------------------------- | ---- |
| ⬜  | `pages/agenda/[id]/index.js`            | content | `DetailTemplate`                    | 3    |
| ⬜  | `pages/estudos/[slug]/aulas/[order].js` | content | `DetailTemplate` (aula + navegação) | 3    |
| ⬜  | `pages/noticias/[id].jsx`               | content | `DetailTemplate`                    | 3    |
| ⬜  | `pages/posts/[id].jsx`                  | content | `DetailTemplate`                    | 3    |

### G · Formulários públicos (8)

Todos passam a montar `FormTemplate` + `FormField` + `FormSection` + `FormActions`;
`<input>`, `<select>` e `<textarea>` crus saem de `pages/`.

|     | Página                           | Shell | Organismo alvo                    | Onda |
| --- | -------------------------------- | ----- | --------------------------------- | ---- |
| ⬜  | `pages/agenda/criar.js`          | form  | `FormTemplate`                    | 4    |
| ⬜  | `pages/agenda/[id]/editar.js`    | form  | `FormTemplate`                    | 4    |
| ⬜  | `pages/analises/novo.js`         | form  | `FormTemplate`                    | 4    |
| ⬜  | `pages/estudios/novo.js`         | form  | `FormTemplate`                    | 4    |
| ⬜  | `pages/estudos/novo.js`          | form  | `FormTemplate`                    | 4    |
| ⬜  | `pages/estudos/[slug]/editar.js` | form  | `FormTemplate`                    | 4    |
| ⬜  | `pages/servicos/sugerir.js`      | form  | `FormTemplate`                    | 4    |
| ⬜  | `pages/loja/[slug].js`           | form  | `FormTemplate` (produto + pedido) | 4    |

### H · Autenticação (5)

|     | Página                                        | Shell | Organismo alvo               | Onda |
| --- | --------------------------------------------- | ----- | ---------------------------- | ---- |
| ⬜  | `pages/login/index.jsx`                       | form  | `AuthCard` + `FormField`     | 4    |
| ⬜  | `pages/cadastro/index.jsx`                    | form  | `AuthCard` + `FormField`     | 4    |
| ⬜  | `pages/cadastro/ativar/[token_id].js`         | form  | `AuthCard` + `StatusMessage` | 4    |
| ⬜  | `pages/cadastro/reset-password/index.js`      | form  | `AuthCard` + `FormField`     | 4    |
| ⬜  | `pages/cadastro/reset-password/[token_id].js` | form  | `AuthCard` + `FormField`     | 4    |

### I · Admin (11)

Hoje usam `PageLayout` do Primer, o segundo shell do projeto. Passam a
`PageShell` + `CatalogAdminTemplate` (catálogo/lista + fila de sugestões) ou
`ReviewQueueTemplate` (itens a aprovar).

|     | Página                                  | Shell   | Organismo alvo                   | Onda |
| --- | --------------------------------------- | ------- | -------------------------------- | ---- |
| ⬜  | `pages/admin/index.js`                  | wide    | `PageShell` + cartões de entrada | 5    |
| ⬜  | `pages/admin/game-genres/index.js`      | wide    | `CatalogAdminTemplate`           | 5    |
| ⬜  | `pages/admin/professions/index.js`      | wide    | `CatalogAdminTemplate`           | 5    |
| ⬜  | `pages/admin/services/index.js`         | wide    | `CatalogAdminTemplate`           | 5    |
| ⬜  | `pages/admin/asset-categories/index.js` | wide    | `CatalogAdminTemplate`           | 5    |
| ⬜  | `pages/admin/contact-types/index.js`    | wide    | `CatalogAdminTemplate`           | 5    |
| ⬜  | `pages/admin/tools/index.js`            | wide    | `CatalogAdminTemplate`           | 5    |
| ⬜  | `pages/admin/users/index.js`            | wide    | `CatalogAdminTemplate`           | 5    |
| ⬜  | `pages/admin/reports/index.js`          | wide    | `ReviewQueueTemplate`            | 5    |
| ⬜  | `pages/admin/moderation/index.js`       | wide    | `ReviewQueueTemplate`            | 5    |
| ⬜  | `pages/admin/conversas/[id].js`         | content | `DetailTemplate`                 | 5    |

### J · Painel de estúdio (6)

`estudios/[slug]/configuracoes.js` é o pior caso do repositório (17 `<select>`,
50 `<input>`, 5 `<textarea>`); migra secção a secção.

|     | Página                                   | Shell   | Organismo alvo                               | Onda |
| --- | ---------------------------------------- | ------- | -------------------------------------------- | ---- |
| 🟨  | `pages/estudios/[slug]/configuracoes.js` | form    | `SettingsTemplate` (piloto Onda 0: só shell) | 6    |
| ⬜  | `pages/estudios/[slug]/eventos.js`       | content | `SettingsTemplate`                           | 6    |
| ⬜  | `pages/estudios/[slug]/loja.js`          | content | `SettingsTemplate`                           | 6    |
| ⬜  | `pages/estudios/[slug]/pedidos.js`       | content | `ListingTemplate`                            | 6    |
| ⬜  | `pages/estudios/[slug]/reunioes.js`      | content | `ListingTemplate`                            | 6    |
| ⬜  | `pages/estudios/escolher.js`             | content | `ListingTemplate`                            | 6    |

### K · Conta (3)

|     | Página                                     | Shell   | Organismo alvo     | Onda |
| --- | ------------------------------------------ | ------- | ------------------ | ---- |
| ⬜  | `pages/perfil/[username]/index.js`         | content | `DetailTemplate`   | 6    |
| ⬜  | `pages/perfil/[username]/configuracoes.js` | form    | `SettingsTemplate` | 6    |
| ⬜  | `pages/perfil/[username]/curriculo.js`     | content | `DetailTemplate`   | 6    |

### L · Ferramentas (7)

|     | Página                                   | Shell | Organismo alvo | Onda |
| --- | ---------------------------------------- | ----- | -------------- | ---- |
| ⬜  | `pages/ferramentas/comprimir-video.jsx`  | wide  | `ToolLayout`   | 7    |
| ⬜  | `pages/ferramentas/htmlviewer.jsx`       | wide  | `ToolLayout`   | 7    |
| ⬜  | `pages/ferramentas/imagecrop.jsx`        | wide  | `ToolLayout`   | 7    |
| ⬜  | `pages/ferramentas/imagens-para-pdf.jsx` | wide  | `ToolLayout`   | 7    |
| ⬜  | `pages/ferramentas/mdviewer.jsx`         | wide  | `ToolLayout`   | 7    |
| ⬜  | `pages/ferramentas/qrgen.jsx`            | wide  | `ToolLayout`   | 7    |
| ⬜  | `pages/ferramentas/viewer.jsx`           | wide  | `ToolLayout`   | 7    |

### M · Estáticas (5)

|     | Página                               | Shell   | Organismo alvo                | Onda |
| --- | ------------------------------------ | ------- | ----------------------------- | ---- |
| ⬜  | `pages/sobre/index.js`               | content | `PageShell` + `Section`       | 8    |
| 🟨  | `pages/sobre/[slug].js`              | content | `PageShell` (piloto Onda 0)   | 8    |
| ⬜  | `pages/sobre/como-publicar/index.js` | content | `PageShell` + `Section`       | 8    |
| ⬜  | `pages/status/index.js`              | content | `PageShell` + `Section`       | 8    |
| ⬜  | `pages/construcao/[slug].js`         | content | `PageShell` + `StatusMessage` | 8    |

## 5. Ondas

Cada onda é um PR. Nenhuma avança sem a anterior verde.

| Onda | Escopo                              | Componentes                                                                        | Páginas   | Estado |
| ---- | ----------------------------------- | ---------------------------------------------------------------------------------- | --------- | ------ |
| 0    | Fundação de layout                  | tokens, `PageShell`, `Section`, `SectionHeading`, `Stack`, `Inline`                | 3 pilotos | 🟨     |
| 1    | Estados e tipografia de bloco       | `EmptyState`, `LoadingState`, `Tag`, `IconButton`, `BackLink`                      | 26        | ⬜     |
| 2    | Listagens públicas (famílias B + C) | `ListingTemplate`, `SearchField`, `FilterToolbar`, `FilterChips`, `LoadMoreButton` | 15        | ⬜     |
| 3    | Detalhes (famílias D + E + F)       | `DetailTemplate`, `Breadcrumbs`, `DefinitionList`                                  | 18        | ⬜     |
| 4    | Formulários e auth (G + H)          | `FormTemplate`, `FormField`, `FormSection`, `FormActions`, `AuthCard`              | 13        | ⬜     |
| 5    | Admin (I)                           | `CatalogAdminTemplate`, `ReviewQueueTemplate`                                      | 11        | ⬜     |
| 6    | Estúdio e conta (J + K)             | `SettingsTemplate`                                                                 | 9         | ⬜     |
| 7    | Ferramentas (L)                     | `ToolLayout`                                                                       | 7         | ⬜     |
| 8    | Home e estáticas (A + M)            | `LandingShell`, `Hero`                                                             | 6         | ⬜     |
| 9    | Gate                                | `scripts/audit-ui-consistency.js` + `npm run audit:ui`                             | —         | ⬜     |

### Onda 0 — detalhe

1. `css/styles.css`: `--control-h`, `--control-h-sm`, `--layout-form`, `--section-gap`.
2. `components/ui/organisms/PageShell/` — `width: content | wide | form | full`.
   Aplica `width: min(100%, var(--shell-w))`, `margin-inline: auto`,
   `padding-block: var(--space-3) var(--space-12)` e `overflow-x: clip`.
   **Não** aplica padding lateral: o gutter é do `.main-content`.
3. `components/ui/organisms/Section/` — `SectionHeading` + corpo, `--section-gap`.
4. `components/ui/atoms/SectionHeading/`, `Stack/`, `Inline/`.
5. Pilotos: `pages/jogos/index.js` (`wide`), `pages/sobre/[slug].js` (`content`),
   `pages/estudios/[slug]/configuracoes.js` (`form`).
6. `PageLayout` do Primer **não** sai aqui: sai na Onda 5, com o admin.

Aceite: Prettier, ESLint `--max-warnings=0`, `audit-css-modules` nos 3 pilotos,
rotas a 200, 6 capturas (1280/700/360 × 2 temas). A largura muda de propósito em
`/jogos` (1040 → 1200) e `configuracoes` perde o padding lateral de 16px.

### Onda 0 — execução registada

- `prettier --check` limpo em `components/ui`, `pages/jogos`, `pages/sobre`,
  `pages/estudios`, `css/styles.css`, `docs/`, `CLAUDE.md` e `README.md`.
- `node scripts/audit-css-modules.js` nos três pilotos: nenhuma classe
  indefinida (o aviso de `.page` não usada em `sobre.module.css` é esperado — o
  índice `pages/sobre/index.js` só migra na onda 8).
- `next dev` a 200 em `/jogos`, `/sobre/funcionalidades` e
  `/estudios/teste/configuracoes`; o HTML de `/jogos` traz
  `PageShell-module__…__root PageShell-module__…__wide` e o CSS servido traz
  `--shell-w: var(--layout-wide)` com `--layout-wide: 1200px`.
- Pendente: capturas em 1280/700/360 nos dois temas (o projeto não tem
  Playwright nem Puppeteer) e `npm run lint` (o ESLint trava neste ambiente;
  continua a correr no CI).

### Onda 1 — detalhe

`EmptyState` e `LoadingState` nascem com `variant: "block" | "page"` porque os
dois padrões existem no código: bloco dentro da página (15 usos) e página inteira
a carregar (`.loadingPage`, 6 usos). `Tag` cobre `.badge`/`.typeBadge`. `BackLink`
cobre os 16 `.backLink` e é o primeiro consumidor de `Inline` (ícone + texto).

### Critério de aceite comum (toda a página)

- [ ] `PageShell` com a largura da família
- [ ] `PageHeader` (nunca `.pageHeader` local)
- [ ] blocos em `Section`; espaçamento só com `--space-*`
- [ ] estados com `EmptyState`/`LoadingState`
- [ ] controlos do Primer dentro de `FormField`, altura `--control-h`
- [ ] ações em `Button`/`IconButton`
- [ ] zero hex no `*.module.css`; só variáveis
- [ ] o que resta no `*.module.css` de página é layout/grid
- [ ] 1280/700/360 nos dois temas, sem `overflowX` em nenhuma caixa
- [ ] rota a 200, `npm run lint`, `npm run lint:prettier:check`,
      `node scripts/audit-css-modules.js <ficheiros>`

## 6. Gate — `npm run audit:ui`

`scripts/audit-ui-consistency.js` falha o CI quando encontrar:

1. `max-width`/`width` literal numa classe de página que deveria ser `PageShell`.
2. `.pageHeader`, `.feedTab`, `.empty*`, `.backLink`, `.loadMore`,
   `.searchInput`, `.pageTitle`, `.pageSubtitle` ou `.sectionTitle` num
   `pages/**/*.module.css`.
3. `<select`, `<textarea` ou `<input type="text">` em `pages/**`.
4. `<button className={styles.*}>` como botão principal.
5. Hex literal em qualquer `*.module.css`.
6. `components/ui/atoms` importando de `molecules`/`organisms`/`pages`.
7. Contagem de módulos CSS sob `pages/` acima do limite da onda corrente.

Métrica de progresso: **65 → ≤ 30** módulos CSS em `pages/` e **139 → 0**
`max-width` literais (os que sobrarem usam `var(--layout-*)`).

## 7. Notas de ambiente

- **ESLint trava neste ambiente** (testado com `Start-Job`, `Start-Process`,
  PowerShell oculto e esperas até 240s; o ficheiro de saída fica vazio). Enquanto
  isso, a validação é Prettier + `audit-css-modules` + rota a 200 + capturas.
  `eslint` continua a correr no CI.
- **PowerShell trata `[slug].js` como wildcard**: usar `-LiteralPath` em
  `Select-String`/`Get-Content` e aspas nos argumentos do `audit-css-modules.js`.
- Sem `push`/`merge` automático: commit por onda, revisão manual (ver
  `## Git (revisao obrigatoria)` no `CLAUDE.md`).
