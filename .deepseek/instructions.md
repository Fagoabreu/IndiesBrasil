# DeepSeek Instructions — Indies Brasil

## Stack

- Next.js 16.1.6 — **Pages Router** (`pages/`). Nunca `"use client"` nem App Router.
- React 19.2.3 / @primer/react 38.0.0 / @primer/primitives 11.2.1 / react-easy-crop 5.5.6
- PostgreSQL + node-pg-migrate. Queries sempre parametrizadas.
- Dirs: `pages/`, `pages/api/`, `components/`, `models/`, `lib/`, `infra/`, `context/`, `css/`, `tests/`

## Clean Architecture (camadas obrigatorias)

Toda mudanca deve ser mapeada para a camada correta. Nunca violar boundaries entre camadas.

| Camada         | Diretorio               | Responsabilidade                                 |
| -------------- | ----------------------- | ------------------------------------------------ |
| Presentation   | `pages/`, `components/` | UI, rotas, renderizacao, interacao com usuario   |
| Application    | `lib/`                  | Orquestracao de use cases, regras de negocio     |
| Domain         | `models/`               | Entidades, validacoes, politicas, regras puras   |
| Infrastructure | `infra/`                | Banco de dados, email, upload, servicos externos |

- `pages/api/` e `pages/` so chamam `models/` e `lib/`. Nunca acessam `infra/` diretamente.
- `models/` nao importam de `pages/` ou `components/`.
- `infra/` nao conhece regras de negocio — so adaptadores tecnicos.
- Logica reutilizada entre rotas vai para `lib/` ou `models/`, nunca duplicada em `pages/api/`.

## Primer React v38

- `Dialog`: props `title` + `footerButtons`. Nunca `Dialog.Header/Footer/Title` como filhos diretos.
- `Dialog.onClose(gesture)` — `onDismiss` removido.
- Prop `sx` deprecada — use CSS Modules.
- Duvida de API: `node_modules/@primer/react/dist/<Component>/<Component>.d.ts`

## Imagens

- Nunca `<img>` — sempre `<Image>` de `next/image`.
- Nao otimizaveis (blob/canvas/dataURI): `unoptimized` + `width`/`height` explicitos.
- `fill`: pai com `position:relative`; CSS do elemento so `object-fit`.

## CSS / Cores

- Sem hex/rgb hardcoded. Usar CSS variables:
  - Brand: `--brand-primary`, `--brand-secondary`, `--brand-rgb-primary`, `--brand-rgb-secondary` -> `css/styles.css :root`
  - UI: `--fgColor-*`, `--bgColor-*`, `--borderColor-*` -> Primer primitives (auto light/dark)
- rgba com brand: `rgba(var(--brand-rgb-primary), 0.08)` — nunca hex direto.
- Tema por cookie. Usar `[data-color-mode="light"]`, nunca `prefers-color-scheme`.
- Excecoes: `#fff` em texto sobre gradiente; `#ffffff` em `<iframe>` de preview HTML.

## Lint & Qualidade

- `npm run lint` apos toda mudanca. Zero erros para entregar.
- `no-undef: error` / `no-unused-vars: warn`. Remover imports nao usados.
- `Number.parseInt(x,10)`, `Number.isNaN`, `===`. Nunca `var`. Nunca `catch {}` vazio.
- `infra/**/*.js` excluido do lint.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).

## API Routes (Pages Router)

- next-connect: `createRouter()` + `controller.injectAnonymousOrUser` + `controller.canRequest(feature)`.
- Routes em `pages/api/v1/<resource>/[param]/`. Metodos HTTP exportados: `get`, `post`, `patch`, `del`.
- Respostas sempre JSON com tratamento de erro via `infra/errors.js`.

## Authorization (critico)

Toda nova feature de API exige registro em **3 lugares**:

1. `models/authorization.js` -> `availableFeatures`
2. `models/activation.js` -> `activateUserByUserId`
3. `infra/controller.js` -> `injectAnonymousUser` (se publica)

### Testes de feature arrays — atualizar sempre

Novas features exigem atualizar os arrays em **3 arquivos de teste**:

1. `tests/integration/_use-cases/registration-flow.test.js` — indentaçao 6 espaços
2. `tests/integration/api/v1/users/[username]/patch.test.js` — indentaçao 10 espaços (3 blocos)
3. `tests/integration/api/v1/user/get.test.js` — indentaçao 10 espaços (2 blocos)

Inserir antes de `"read:content_review"`. Usar contexto unico para cada bloco (varia entre arquivos).

## Banco de Dados

- Migrations single-purpose com `exports.down`. Sem string-interpolation em SQL.
- Funcoes `async` de data-access: tratamento explicito de erros obrigatorio.
- Logica de query reutilizada: extrair para funcao nomeada em `models/`, nao duplicar.

## Seguranca

- Sem secrets hardcoded. Sanitizar todo input externo. Auth sempre server-side.
- `dangerouslySetInnerHTML`: comentar justificativa inline.
- Nunca logar senhas, tokens ou PII.

## Padroes

- SEO: componente `SeoHead` — nunca `<Head>` inline.
- CSS Module junto ao componente (`ComponentName.module.css`).
- Nomes: componentes `PascalCase`, hooks/utils `camelCase`, assets `kebab-case`, constantes `UPPER_SNAKE_CASE`.
- Models: `const modelName = { ... }; export default modelName;` — nunca `export default { ... }` direto (evita `import/no-anonymous-default-export`).
- Sidebar: novos itens em `components/LeftSidebarComponent.js` dentro do grupo `NavList` apropriado.
- Video embed customizado: criar componente `VideoEmbed` inline (YouTube/Vimeo parser). Nao usar `Embeds` existente — ele espera estrutura especifica de post.
- Nao criar arquivos de exemplo/demo sem solicitacao explicita.
- Extrair antes de repetir: logica usada 2+ vezes vai para `lib/`, `utils/` ou `components/`.

## PowerShell

- Windows PowerShell 5.1: `Get-Content -Raw` e `Set-Content -NoNewline` **nao existem**.
- Usar `[System.IO.File]::ReadAllText($path)` e `[System.IO.File]::WriteAllText($path, $content)`.
- Verificar line endings: arquivos sao CRLF. Usar `` `r`n `` nas strings de replace.
