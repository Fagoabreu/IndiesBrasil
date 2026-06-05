# CLAUDE.md

Instruções de projeto para o Claude. Este arquivo substitui as configurações anteriores do GitHub Copilot (`.github/copilot-instructions.md` e `.github/agents/`).

---

## Stack & Versões

| Biblioteca           | Versão  | Notas críticas de API                                                                                  |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `next`               | 16.1.6  | **Pages Router** (`pages/` dir). **NÃO** adicione `"use client"` — essa diretiva é exclusiva do App Router |
| `react`              | 19.2.3  |                                                                                                        |
| `@primer/react`      | 38.0.0  | Ver regras abaixo                                                                                      |
| `@primer/primitives` | 11.2.1  | CSS variables com escopo no div do ThemeProvider                                                       |
| `react-easy-crop`    | 5.5.6   |                                                                                                        |
| `node-pg-migrate`    | ver `package.json` |                                                                                           |
| `pg`                 | ver `package.json` |                                                                                           |

---

## 1. Estrutura do Projeto

- **Pages Router** (`pages/` dir) — não usar App Router.
- Estrutura de diretórios de referência:
  - `pages/` — Rotas, layouts e páginas
  - `pages/api/` — Route Handlers (API Routes)
  - `public/` — Assets estáticos
  - `lib/` — Utilitários compartilhados, clientes de API e lógica de domínio
  - `components/` — Componentes de UI reutilizáveis
  - `context/` — Context providers React
  - `css/` — Folhas de estilo globais e modulares
  - `models/` — Entidades de domínio e regras
  - `infra/` — Banco de dados, serviços externos e adaptadores
  - `tests/` — Testes unitários e de integração (co-localizados por feature)

---

## 2. Regras — @primer/react v38 (Inegociáveis)

- **`Dialog`**: use a prop `title` para o texto do cabeçalho e `footerButtons` para os botões de ação. **NÃO** renderize `Dialog.Header`, `Dialog.Footer` ou `Dialog.Title` como filhos diretos — eles existem apenas para uso dentro dos render props `renderHeader`/`renderFooter`.
- **`Dialog.onClose`**: o único callback de fechamento suportado é `onClose(gesture)`. `onDismiss` foi removido na v38.
- **`Box` com prop `sx`**: o sistema `sx` está deprecado. Use CSS Modules (`.module.css`) em vez disso.
- **Sem diretiva `"use client"`** em nenhum lugar — este é um projeto Pages Router.
- Em caso de dúvida sobre a API atual de um componente, consulte `node_modules/@primer/react/dist/<ComponentName>/<ComponentName>.d.ts`.

### Documentação Primer — Consultar antes de implementar

| Tópico                            | URL                                                         |
| --------------------------------- | ----------------------------------------------------------- |
| **Color tokens** (CSS variables)  | https://primer.style/product/primitives/color/              |
| **Theming** (ThemeProvider, etc.) | https://primer.style/product/getting-started/react/theming/ |
| **Components**                    | https://primer.style/product/components/                    |

---

## 3. Sistema de Cores — Sempre Usar CSS Variables (Light & Dark Mode)

Este projeto suporta **light e dark mode** via `ThemeProvider` do Primer React. O modo ativo é refletido como `data-color-mode="light"` ou `data-color-mode="dark"` na div do ThemeProvider. **Nunca use valores hex ou rgb hardcoded fora dos arquivos de token designados.**

### 3.1. Hierarquia de Tokens

| Camada                       | Variáveis                                                                                                                                                                                                                                                       | Fonte                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Identidade de marca          | `--brand-primary`, `--brand-secondary`, `--brand-gradient-*`, `--brand-glow-*`, `--brand-card-glow`, `--brand-btn-shadow`, `--brand-ambient-bg`, `--brand-hover-bg`, `--brand-active-bg`, `--brand-hover-border`, `--brand-active-ring`, `--brand-empty-border` | `css/styles.css :root`                                                 |
| Canais RGB de marca          | `--brand-rgb-primary`, `--brand-rgb-secondary`                                                                                                                                                                                                                  | `css/styles.css :root`                                                 |
| UI semântica (texto/bg/borda) | `--fgColor-default`, `--fgColor-muted`, `--fgColor-onInverse`, `--bgColor-default`, `--bgColor-muted`, `--bgColor-inset`, `--bgColor-accent-muted`, `--borderColor-default`, `--borderColor-muted`                                                              | Primer primitives (alterna light/dark automaticamente)                 |
| Syntax highlighting          | `--syntax-key`, `--syntax-string`, `--syntax-number`, `--syntax-bool`, `--syntax-null`, `--syntax-attr`                                                                                                                                                         | `css/styles.css` (dark default + override `[data-color-mode="light"]`) |

### 3.2. Regras de Cores

- **Brand colors** — sempre referencie `--brand-primary`, `--brand-secondary`, etc. de `css/styles.css`. Nunca duplique seus valores hex.
- **rgba() com brand colors** — use as variáveis de canal RGB:
  ```css
  /* Correto */
  background: rgba(var(--brand-rgb-primary), 0.08);

  /* Errado */
  background: rgba(149, 74, 255, 0.08);
  ```
- **Texto e backgrounds** — use sempre os tokens semânticos do Primer (`--fgColor-*`, `--bgColor-*`). Adaptam-se automaticamente ao light/dark mode.
- **Borders** — use `--borderColor-muted`, `--borderColor-default`, ou `--brand-hover-border` / `--brand-active-ring`.
- **Novas cores de marca** — se uma nova cor for necessária, adicione em `css/styles.css :root` primeiro e referencie via variável.
- **Nunca use `prefers-color-scheme` media query** — o site controla o tema via cookie. Use seletores `[data-color-mode="..."]`.

### 3.3. Exceções Permitidas

| Valor                 | Contexto                                           | Motivo                                                          |
| --------------------- | -------------------------------------------------- | --------------------------------------------------------------- |
| `color: #fff`         | Texto em botões/badges com gradiente de marca      | O background é sempre colorido — branco é correto em ambos os modos |
| `background: #ffffff` | `<iframe>` de preview HTML na ferramenta de viewer | O iframe renderiza HTML autoral; branco é o default do browser  |

### 3.4. Padrão de Override Light/Dark

```css
/* Padrão (dark mode) */
.myClass {
  color: var(--syntax-key);
}

/* Override para light mode */
[data-color-mode="light"] .myClass {
  color: var(--fgColor-default);
}
```

---

## 4. Qualidade de Código (SonarQube)

Todo código produzido deve passar nos quality gates do SonarQube. Trate violações como bloqueadoras — não opcionais.

### Duplicação (≤ 3% em código novo)

- **Extraia antes de repetir.** Qualquer bloco de lógica usado mais de uma vez deve viver em um módulo compartilhado (`lib/`, `utils/`, `components/` ou `models/`).
- Nunca copie blocos JSX entre páginas ou componentes. Extraia qualquer estrutura repetida para um componente dedicado.
- Antes de criar um componente, pesquise na árvore `components/` por algo reutilizável. Estenda ou componha antes de duplicar.
- Padrões de metadata/SEO compartilhados devem usar `SeoHead` (ou componente equivalente) — nunca blocos `<Head>` inline.

### Complexidade & Manutenibilidade

- Complexidade ciclomática ≤ 10 por função/componente.
- Funções devem fazer uma coisa. Separe data-fetching, transformação e renderização.
- Use early returns e guard clauses em vez de `if/else` aninhados.
- Sem comentários `TODO`/`FIXME` no código commitado — resolva ou abra uma issue rastreável.

### Confiabilidade

- Nunca silencie exceções (`catch {}` sem tratamento). Logue ou relance com contexto.
- Sempre trate rejeições de Promise explicitamente — nunca deixe chamadas `async` flutuando.
- Evite `parseInt` sem radix. Use `Number.parseInt(x, 10)` ou `Number(x)`.
- Prefira `globalThis` em vez de `window` para verificações agnósticas de ambiente.

### JavaScript

- `const` em vez de `let`; nunca `var`.
- Remova imports e variáveis não utilizados antes de commitar.
- Use formas qualificadas: `Number.parseInt`, `Number.isNaN`, `Object.keys`.
- Sempre `===` — nunca `==`.

### CSS / Styling

- Sem regras CSS duplicadas no mesmo módulo.
- Sem valores hex hardcoded — use design tokens exclusivamente.
- **Nunca use a prop `sx`** (do Primer React) para estilização. Use sempre CSS Modules (`.module.css`) colocalizados com o componente.

---

## 5. Segurança (OWASP ASVS / Top 10)

- **Nunca introduza defaults inseguros**, secrets hardcoded ou tratamento fraco de input.
- **Valide e sanitize** todos os inputs externos antes de usar.
- **Acesso com menor privilégio** em todas as operações de dados.
- **Nunca logue dados sensíveis** (passwords, tokens, PII) mesmo em `console.error`.
- **Proteja boundaries de auth/sessão** — prefira verificações server-side explícitas para ações privilegiadas.
- **Hotspots a monitorar:**
  - `dangerouslySetInnerHTML` — confirme fonte do conteúdo e sanitização; comente a justificativa inline.
  - `document.cookie` / `localStorage` — confirme atributos `Secure`, `HttpOnly` e `SameSite`.
  - `eval`, `new Function`, `setTimeout(string)` — nunca use.
  - `require()` ou `import()` dinâmico com input não sanitizado — nunca use.
  - Credenciais, tokens ou secrets hardcoded em qualquer arquivo — nunca.
  - Verificações de autenticação/autorização ausentes em rotas de API.

---

## 6. Regras de Lint (eslint.config.mjs)

Todo código gerado deve cumprir a configuração ESLint do projeto **antes** de considerar a tarefa concluída.

**Rule sets ativos:**

- `@eslint/js` recommended — regras JS de base
- `eslint-config-next` — regras Next.js Pages Router; inclui plugin `react-hooks`
- `eslint-plugin-primer-react` recommended — enforça uso correto de componentes Primer React
- `eslint-plugin-jest` — para arquivos de teste em `tests/`
- `eslint-config-prettier` — desabilita regras de formatação que conflitam com Prettier
- Globals customizados: `no-unused-vars: warn`, `no-undef: error`

**Práticas obrigatórias:**

- Execute `npm run lint` após qualquer mudança e corrija todos os erros antes da entrega.
- Execute `npm run lint:prettier:fix` para auto-formatar.
- Nunca desabilite regras ESLint inline (`// eslint-disable`) sem comentário de justificativa documentado.
- Arquivos `infra/**/*.js` são excluídos do lint — não assuma cobertura de lint lá.
- Mensagens de commit devem seguir **Conventional Commits**: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, etc.

---

## 7. Banco de Dados & Migrations (node-pg-migrate / PostgreSQL)

- **Sempre priorize** padrões de migration documentados e boas práticas de banco de dados.
- **Nunca faça mudanças destrutivas de schema** sem plano explícito de rollback ou migration em estágios.
- **Nunca assuma zero-downtime** a menos que a estratégia de deploy confirme isso.
- **Não acople** lógica de migration com refatorações não relacionadas da aplicação.
- **Consultas SQL:**
  - Sempre use queries parametrizadas — nunca interpolação de strings SQL.
  - Extraia fragmentos SQL repetidos em query builders ou constantes nomeadas.
  - Use `Number.parseInt(x, 10)` para coerção numérica de resultados de query.
- **Migrations devem ser single-purpose** — um concern por arquivo.
- **Transformações complexas de dados** devem ser extraídas para helpers nomeados, não inlined.
- **Toda função `async`** em código de data-access deve ter tratamento explícito de erros.

### Abordagem de Evolução de Schema

1. Avalie o uso atual do schema e as restrições de compatibilidade.
2. Projete estratégia de migration em estágios (expand, migrate, contract) quando necessário.
3. Escreva scripts de migration com defaults seguros, indexes, constraints e lógica de rollback.
4. Atualize a camada de data-access e contratos de validação de forma consistente.
5. Documente considerações operacionais (locks, backfills, sequenciamento de deploy).

---

## 8. Arquitetura Limpa (Clean Architecture)

Mapeie mudanças para as camadas do Clean Architecture com boundaries claros:

- **Presentation:** pages/app routes e components
- **Application:** use cases e orquestração
- **Domain:** entidades, regras e políticas
- **Infrastructure:** banco de dados, serviços externos e adaptadores

Aplique design patterns onde reduzem acoplamento e melhoram clareza: Factory, Strategy, Adapter, Repository, Dependency Injection.

---

## 9. Componentes & Imagens

- **Nunca use `<img>` puro.** Use sempre `<Image>` do `next/image`. Para fontes não otimizáveis (blob URLs, `URL.createObjectURL`, data URIs, exports de canvas), adicione a prop `unoptimized` com `width` e `height` explícitos.
- **Não crie arquivos de exemplo/demo** (como `ModalExample.tsx`) no codebase principal a menos que explicitamente solicitado.
- **Nome de arquivos de componente:** `PascalCase` (ex: `UserCard.jsx`).
- **Nome de hooks:** `camelCase` (ex: `useUser.js`).
- **Nome de assets estáticos:** `snake_case` ou `kebab-case`.
- **Context providers:** nomeie como `XyzProvider` (ex: `ThemeProvider`).

---

## 10. Testes

- Use Jest, React Testing Library.
- Escreva testes para toda lógica crítica e componentes.
- Arquivos de teste de integração em `tests/integration/`, unitários em `tests/unit/`.
- `eslint-plugin-jest` está ativo para arquivos em `tests/`.

---

## 11. Fluxo de Trabalho por Tipo de Tarefa

### Frontend (UI/UX)

1. Entenda a intenção de UX, dependências de dados e requisitos de interatividade.
2. Divida a UI em componentes coesos com responsabilidades claras.
3. Prefira primitivos/componentes Primer React — consulte a documentação antes de implementar.
4. Use HTML semântico e CSS focado para layout, responsividade e acessibilidade.
5. Mantenha o bundle pequeno; preserve boundaries server/client do Next.js.
6. Inclua estados de loading, vazio e erro significativos.

### Fullstack / Arquitetura

1. Confirme intent, critérios de aceitação e fluxos sensíveis a ameaças (auth, sessão, uploads, formulários, APIs externas).
2. Mapeie a mudança para as camadas do Clean Architecture.
3. Aplique design patterns adequados.
4. Implemente com práticas modernas do Next.js.
5. Enforça comportamento secure-by-default.
6. Verifique impacto com lint/tests/build.

### Revisão de Segurança

1. Identifique superfícies de ataque e trust boundaries.
2. Revise code paths para falhas OWASP ASVS e OWASP Top 10.
3. Valide exploitabilidade e impacto de negócio antes de classificar severidade.
4. Forneça mitigações concretas com mínima disrupção.
5. Aponte testes de segurança ou controles de observabilidade ausentes.

### Formato de output de revisão de segurança

- Findings primeiro, ordenados por severidade (Critical, High, Medium, Low).
- Para cada finding: risco, evidência, impacto e recomendação de correção.
- Perguntas abertas/suposições se a evidência for incompleta.
- Riscos residuais e testes de segurança sugeridos.

---

## 12. Convenções de Nomenclatura

| Contexto           | Convenção       | Exemplo              |
| ------------------ | --------------- | -------------------- |
| Pastas             | `kebab-case`    | `user-profile/`      |
| Componentes        | `PascalCase`    | `UserCard.jsx`       |
| Utilitários/hooks  | `camelCase`     | `useUser.js`         |
| Assets estáticos   | `kebab-case`    | `logo-dark.svg`      |
| Variáveis/funções  | `camelCase`     | `getUserById`        |
| Constantes         | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| Tipos/Interfaces   | `PascalCase`    | `UserProfile`        |
