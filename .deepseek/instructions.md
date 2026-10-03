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

## Modularizacao e reuso (obrigatorio)

Antes de escrever UI ou logica nova, procure o que ja existe (grep no repo). Duplicar e proibido: copias divergem em silencio — foi assim que a pagina de editar evento passou a usar `styles.hint`, classe que so existia no CSS da pagina de criar.

Ordem de preferencia:

1. **Reusar** o que existe. Se falta um caso, adicione prop/variante no componente (ex.: um novo `preset`), nunca um clone.
2. **Extrair** para compartilhado e consumir nos dois lugares.
3. **Criar** novo so se nao houver nada reaproveitavel.

Onde colocar: UI em `components/` (com `ComponentName.module.css` ao lado); logica, constantes e helpers em `lib/` ou `utils/`; dados e regra de negocio em `models/`. Nunca copiar CSS Module entre pastas — importe o modulo compartilhado.

Extraia quando: duas paginas tem o mesmo formulario, listagem ou card; o mesmo bloco de JSX se repete com pequenas diferencas; a mesma constante, option list ou formatador aparece em 2+ arquivos; a mesma query ou regra aparece em 2+ rotas.

Como dividir o que difere: variacao de contexto vira prop (`mode`, `submitLabel`); API e efeito colateral ficam na pagina e entram por callback (`onSubmit`); valores iniciais e derivados viram helpers no modulo compartilhado (`emptyValues()`, `valuesFromApi()`).

CSS Module: `styles.x` so resolve se `.x` existir no topo do modulo. Seletor composto (`.a.b`) **nao** cria `styles.b` — o resultado e `className="undefined"` e o estilo nunca aplica.

## Upload de imagem (obrigatorio)

Toda imagem enviada pelo usuario passa por `components/ImageTools/ImageUploader/ImageUploader.jsx`. Nunca escreva `<input type="file">`, `new FileReader` nem `ImageCropModal` direto na pagina — o `ImageUploader` ja encapsula seletor, leitura, fila de recorte e modal.

Excecoes que ja existem e sao intencionais (nao "corrija" migrando para o ImageUploader):

- `CreatePost`: um `<input type="file">` proprio so para a camera do mobile, que precisa do atributo `capture`. O arquivo resultante entra no recorte via `openWith`.
- `QrCodeCustomizer`: a marca e desenhada pequena dentro do QR, sem recorte.
- `pages/ferramentas/imagecrop.jsx`: ferramenta publica de recorte livre, chama `generateImage` direto.
- PDFs (`imagens-para-pdf`, PDF do livro) nao passam por aqui: nao sao imagem.

O formato vem de `lib/image-presets.js` (o catalogo unico). Nunca passe `aspect` inline nem crie um preset paralelo.

- O preset precisa ter a MESMA proporcao com que a imagem e renderizada. Crop e CSS discordando = o usuario enquadra uma coisa e recebe outra. Confira o `aspect-ratio` (ou a altura fixa) do CSS que exibe a imagem antes de escolher o preset; ao mudar um dos lados, atualize o outro.
- A proporcao e conferida por `node scripts/audit-image-presets.js`: ele compara o `aspect-ratio` do CSS com o `aspect` do preset e falha quando a superficie declara altura fixa — altura fixa faz a caixa mudar de proporcao conforme a largura da tela e o `object-fit: cover` descarta o enquadramento. Ao declarar uma superficie nova que exibe um recorte escolhido no formulario, adicione o par em `RATIO_SURFACES` nesse script.
- So o RECORTE e enviado; o arquivo original nao fica guardado. Por isso mudar o `aspect` de um preset existente deixa todas as imagens ja enviadas cortadas sem chance de reenquadrar (o usuario teria de reenviar o arquivo). Corrija o CSS, nao o preset.
- Cada preset declara `aspect`, `shape`, `label`, `outputWidth` e `format`. PNG so onde houver transparencia (avatar circular, logo); JPEG no resto.
- Comente em cada preset ONDE a imagem aparece — e o que permite conferir a proporcao no CSS. Novo formato: adicione um preset, nunca clone o componente.
- `getImagePreset` lanca em nome desconhecido de proposito. Nao adicione fallback silencioso: esconderia `preset` errado e entregaria um recorte diferente do esperado sem aviso.

Como usar:

- `preset` (obrigatorio) e `onCropped({ blob, dataUrl, preset })`.
- Gatilho: `variant="icon"` ou `"button"`; `children` como funcao `({ open, openWith, disabled, busy })` para gatilho proprio estilizado; ou `ref` com `open()` / `openWith(source)` quando a imagem nasce fora do input (webcam, colar da area de transferencia, camera do celular).
- `multiple` enfileira varios arquivos, um recorte de cada vez.
- Preview da imagem salva e botao de remover ficam na pagina (sao layout de cada tela); o `ImageUploader` so entrega o recorte.
- A API fica na pagina, dentro de `onCropped`: upload imediato (`await fetch` com FormData) ou adiado (guardar `blob`/`dataUrl` e enviar no submit do formulario).

Imagem estatica (nao vem de upload): `DEFAULT_OG_IMAGE` (`lib/seo.js`) e a capa padrao dos previews de link, usada por toda pagina que nao informa `ogImage`. E o arquivo `public/images/og-cover.jpg`, gerado de `ArteSite.png` por `node scripts/build-og-cover.js` — **rode o script ao trocar a arte**, e nao edite o jpg a mao (ele nao guarda o original). `OG_IMAGE_SIZE` (`lib/seo.js`) e o tamanho declarado em `og:image:width/height`, e `scripts/audit-image-presets.js` confere as duas coisas: que o arquivo existe e que as dimensoes batem. Nao voltar a apontar para arquivo inexistente: ja aconteceu (`/images/og-cover.png` respondia 404 e a home era compartilhada sem imagem).

## Contatos (perfil, estudio, press kit, curriculo)

- O contato e **um campo de texto livre** (`contact_value`, `VARCHAR(255)`) em duas tabelas espelhadas: `users_contacts` e `organization_contacts`. Os tipos vem de `contact_type` (gerenciavel em `/admin/contact-types`).
- Toda traducao entre o que o usuario digita e o que a tela mostra vive em `lib/contactTypes.js` — o **registro unico**. Nunca decida formato/rotulo na tela: eram 6 telas decidindo sozinhas, e divergiam (o press kit usava emoji, o resto SVG).
- `serializeContact(row)` enriquece um contato com `url` (href), `display` (handle legivel: `@canal`, `greentale.itch.io`, `(11) 99999-9999`) e `label` (rotulo do tipo). Roda na **leitura** e nunca lanca nem descarta.
- **Contrato que torna a mudanca segura:** URL absoluta desconhecida passa intacta e continua clicavel. Por isso nenhum contato antigo quebra e a migracao de dados e opcional (`node scripts/normalize-contacts.js --dry-run`).
- Na **escrita** a regra e outra: `contact.resolveValue({contact_type_id, contact_value})` (`models/contact.js`) normaliza e valida. Roda nos models (`profile.saveContato`, `profile.patchContacts`, `organization.createContact`), nao nas rotas — e no PATCH o tipo pode vir do registro ja gravado.
- Telefone (`lib/phone.js`) aceita so fixo ou celular do Brasil, com **DDD conferido contra a lista da Anatel**: "20" e "36" parecem plausiveis e nao sao DDD nenhum. WhatsApp e Fone sao os unicos tipos com formato obrigatorio; os outros sao permissivos de proposito.
- `contact_value` guarda a forma canonica: `https://www.youtube.com/@canal`, `https://wa.me/5511999999999`, `tel:+5511999999999`. Um tipo sem entrada no registro cai em `GENERIC` — continua funcionando, so nao ganha handle nem validacao (nao tornamos `contact_type` refem do codigo).
- Ao criar ou editar, o retorno precisa trazer `icon_key` (usar CTE no `INSERT`/`UPDATE`): um `RETURNING *` de `users_contacts` nao tem essa coluna, e sem ela a serializacao nao sabe interpretar o valor e o handle sai `null`.
- Exibicao: `components/Portfolio/Contatos/ContatoItem.jsx` e o ponto unico. O hande fica visivel e a URL completa vai no `title`/`href`.
- **Nao use tooltip em CSS posicionado fora da linha**: `SectionPanel` e `ListableSectionPanel` tem `overflow: hidden` e o balao seria cortado. O rotulo usa `title` nativo, e onde nao existe hover (`@media (hover: none)`) ele aparece como legenda fixa — informacao que so existe no hover e informacao perdida no toque.
- Contato sem URL utilizavel (um `@usuario` do Discord) vira **texto, nao link** — `href="@usuario"` e um link relativo apontando para dentro do site.

## Mensagens diretas (membro <-> membro, membro <-> estudio)

- Identidade do participante e polimorfica: `(party_type, party_id)` com `user` ou `studio`, em `conversations`, `messages` e `conversation_reads`. `users.id` e `organizations.id` sao ambos `uuid`, entao nao ha tabela de mapeamento.
- **O par e canonico no banco**: `CHECK ROW(party_a_type, party_a_id) < ROW(party_b_type, party_b_id)` + `UNIQUE INDEX conversations_pair_unique`. Sem isso `A -> B` e `B -> A` seriam duas conversas e cada lado veria metade da historia. `findOrCreateForUser` e idempotente e resolve a corrida com `INSERT ... ON CONFLICT DO NOTHING` + releitura.
- **O estudio so responde.** Existe apenas `findOrCreateForUser` — nao ha `findOrCreateForStudio`, de proposito: sem API para iniciar uma thread com a identidade do estudio, a regra nao pode ser violada por descuido. Abrir conversa com o proprio estudio e recusado.
- Autoria x identidade: `messages.author_*` e a identidade EXIBIDA (o estudio, quando um membro responde em nome dele) e `messages.sent_by_user_id` e SEMPRE o humano que digitou. Sem esse campo, a denuncia de uma mensagem de estudio nao teria autor a quem atribuir acao.
- **Leitura e da PARTE, nao do membro**: `conversation_reads` tem uma linha por parte, e `muted` fica nela (preferencia da caixa, nao de cada pessoa). Por isso qualquer membro marca como lido para o estudio, e quem entra no estudio depois passa a ver o historico anterior — consequencia do desenho, nao codigo extra.
- **Um unico ponto de decisao de acesso**: `conversation.assertCanRead({conversationId, party})`, sempre depois de `conversation.resolveParty({type, id, userId})`. `resolveParty` recusa `party_type=user` com `id` de outra pessoa (403) e valida o vinculo ativo do estudio a cada acesso (quem sai perde o acesso na hora). Nao-participante recebe **404**, nao 403 — confirmar a existencia revelaria que duas outras pessoas estao conversando.
- `unread_count` e os contadores sao calculados no servidor (`countUnreadForParty`), e mensagem do proprio autor nunca conta como nao lida.
- Corpo da mensagem e TEXTO PURO, renderizado como texto (React escapa): **nao** passa por `sanitizeHtml` de proposito — sanitizar mutilaria texto legitimo como "a < b". O limite e `MAX_BODY_LENGTH`.
- Rotas em `app/api/v1/conversations`: `GET`/`POST` na colecao, `GET`/`POST`/`PATCH` no `[id]` (abrir a conversa marca como lida; PATCH e o silenciar), `GET .../unread` para o selo e `?scope=muted` para a lista de silenciadas (existe para o silencio ser reversivel). A moderacao le em `GET /api/v1/admin/conversations/[id]` com `read:admin` — um recurso novo (`read:conversation:any`) nao seria concedido a ninguem e a rota nasceria morta.
- Notificacao: no maximo **uma por conversa**. `user_notifications` (PK `user_id, type, source_user_id, org_slug`) e rearmada com `is_read=false`/`created_at=now()` por `upsertUserNotification`; o feed do estudio usa `upsertConversationNotification` sobre o indice unico parcial `org_notifications_conversation_unique`. Titulos e textos ficam no cliente (`CLIENT_NOTIF_DEFS`/`ORG_NOTIF_TEMPLATES`), nao em `notification_messages` (limite de snapshot do enum).
- Denuncia de conversa usa `target_type = 'conversation'` em `reports`/`moderation_actions`. Ninguem denuncia conversa de que nao participa (`conversation.isParticipantByUserId`), e "Bloquear" a conversa a CONGELA — os dois lados seguem lendo o historico (a denuncia precisa dele) e ninguem escreve.
- UI: `components/Messages/MessagesPanel.jsx` (lista + filtro silenciadas) e `ConversationThread.jsx` (historico, compositor, silenciar, denunciar) servem as duas caixas — a pessoal (`partyType` ausente) e a do estudio (`partyType="studio"`). Uma tela so porque as regras de nao lida, silencio e denuncia sao as mesmas. React 19 removeu `defaultProps` de componente de funcao: usar valor padrao na desestruturacao.
- A aba vive no **endereco** (`?tab=mensagens&conversa=<id>`), nao em estado paralelo: e o que faz o link da notificacao abrir direto na conversa e a pagina sobreviver a recarregar. `router.replace(..., { shallow: true })` troca de aba sem reexecutar o `getServerSideProps`.
- Nao ha tempo real: `ConversationThread` atualiza por consulta a cada 15s enquanto a conversa esta aberta e ao voltar o foco para a aba.
- Carga de dados em efeito passa por `Promise.resolve().then(fn)` quando a funcao define estado: `react-hooks/set-state-in-effect` (erro no lint, com `--max-warnings=0`) acusa `setState` sincrono no corpo do efeito.
- `scripts/audit-css-modules.js` confere classe usada contra classe definida; ele apara a linha antes da regex porque classe definida dentro de `@media` vem indentada e continua sendo exportada pelo CSS Module.

## Webconferencia (Galene)

- `galene/` e um **subprojeto Go vendorizado** do upstream `jech/galene` (tag base `galene-1.2.1`) — nao uma pasta de deploy. Leia `galene/UPSTREAM.md` (contrato com o upstream) e `galene/CUSTOMIZATIONS.md` (o porque de cada customizacao) antes de alterar qualquer arquivo de la.
- Arquivos Go do servidor (`*.go` e subdiretorios) sao do upstream: **nao modificar**. Toda customizacao e de cliente, editada **direto** em `galene/static/` — nao ha arquivos de patch. A arvore e a fonte unica da verdade.
- Alterar `galene/static/` ou qualquer `.go` **exige rebuild da imagem** (`docker compose -f infra/compose.yaml build galene`) — o compose so recompila quando a imagem nao existe.
- `galene/` e LF, como o upstream publica, e tem `.gitattributes` proprio. Nao gravar arquivo em CRLF la dentro — e nao "corrigir" line endings sem comparar com a tag: o upstream **nao e uniforme** (terceiros vendorizados vem em CRLF). `node scripts/audit-galene-upstream.js` compara a arvore byte a byte com a tag e falha se algo divergir do documentado; rode depois de qualquer edicao em `galene/`.
- A tag da imagem e o nome da tag base do upstream (`indies-galene:galene-1.2.1`). Ao rebasear, atualizar nos **3** lugares: `deploy/compose.yaml`, `infra/compose.yaml`, `.github/workflows/deploy.yml`.
- Grupo de estudio (`groups/<estudio>.json`, gravado por `lib/galene.js`) so aceita campos que existam na struct `Description` de `galene/group/description.go`: ela usa `DisallowUnknownFields`, entao um campo desconhecido faz o decode falhar e a **sala inteira nao carregar**. Nunca adicione campo "por garantia".
- Provisionamento e **por estudio, nao por reuniao**: o arquivo tem `"auto-subgroups": true` e as salas sao subgrupos dele (`<estudio>/<reuniao>`, via `roomGroupName`). Um arquivo por reuniao deixava sala orfa depois que a reuniao terminava. A funcao e `ensureStudioGroup(slug, displayName)`.
- O JWT tem escopo de **estudio** (`aud = "<origin>/group/<estudio>/"` + `include-subgroups: true`), nao da sala: com `include-subgroups` o Galene casa por prefixo (`galene/token/jwt.go` → `matchGroup`), entao o token abre qualquer sala do estudio e nenhuma de outro. Nao "conserte" para o escopo da sala sem ler `lib/galene.js`.
- Encerrar reuniao (`POST .../meetings/[id]/end`) faz 4 coisas em ordem: `meeting.end()` no banco, arquivo da sala com `expires` no passado (`closeRoom`), poda (`pruneClosedRooms`) e **lock** (`lockRoom`). O lock e o unico jeito de EXPULSAR: o Galene nao tem "expulsar todos" (`group.Delete` desiste com clientes dentro; a API admin so apaga o arquivo; `desc.Expires` e lido so no `AddClient`). Ele exige `op` e e aplicado ao grupo do proprio cliente, por isso o app entra na sala com um token efemero de moderador (`GALENE_MODERATOR_PERMISSIONS`) — esse token nunca vai para usuario.
- `GALENE_INTERNAL_WS_URL` (WebSocket interno do Galene) e obrigatoria em producao para o lock; sem ela a rota falha em vez de fingir que encerrou. O app alcanca o Galene por `host.docker.internal` (`extra_hosts` no `deploy/compose.yaml`), porque o servico usa `network_mode: host`.
- A poda usa `ends_at > agora` como criterio, **nao** o status: reuniao encerrada antes do tempo continua com `ends_at` no futuro e precisa do arquivo para seguir fechada se o Galene reiniciar.
- Avatar do participante usa `setdata` (chave `avatar`), sem tocar em Go. A URL so e aceita se comecar com `https://res.cloudinary.com/<CLOUDINARY_CLOUD_NAME>/` — sem essa trava um participante usaria o avatar para coletar o IP de quem assiste (o Galene e SFU e nao expoe IP entre pares). Sem `CLOUDINARY_CLOUD_NAME` nao ha avatar (fail-closed). A CSP do meet precisa de `https://res.cloudinary.com` no `img-src`, senao a imagem e bloqueada em silencio.
- O cliente publica o avatar **apenas** no `kind === 'join'`: `setdata` sempre dispara broadcast de `change`, entao republicar a cada `change` entraria em loop infinito.

## PowerShell

- Windows PowerShell 5.1: `Get-Content -Raw` e `Set-Content -NoNewline` **nao existem**.
- Usar `[System.IO.File]::ReadAllText($path)` e `[System.IO.File]::WriteAllText($path, $content)`.
- Verificar line endings: arquivos sao CRLF. Usar `` `r`n `` nas strings de replace.
