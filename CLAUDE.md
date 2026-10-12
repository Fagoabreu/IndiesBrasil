# CLAUDE.md

## Stack

- Next.js 16.1.6 — **Pages Router** (`pages/`). Nunca `"use client"` nem App Router.
- React 19.2.3 / @primer/react 38.0.0 / @primer/primitives 11.2.1 / react-easy-crop 5.5.6
- PostgreSQL + node-pg-migrate. Queries sempre parametrizadas.
- Dirs: `pages/`, `pages/api/`, `components/`, `models/`, `lib/`, `infra/`, `context/`, `css/`, `tests/`

## Primer React v38

- `Dialog`: props `title` + `footerButtons`. Nunca `Dialog.Header/Footer/Title` como filhos diretos.
- `Dialog.onClose(gesture)` — `onDismiss` removido.
- Prop `sx` deprecada — use CSS Modules.
- Duvida de API: `node_modules/@primer/react/dist/<Component>/<Component>.d.ts`

## Imagens

- Nunca `<img>` — sempre `<Image>` de `next/image`. Nao otimizaveis (blob/canvas/dataURI): `unoptimized` + `width`/`height`.
- `fill`: pai com `position:relative`, CSS do fill so `object-fit`.

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
- `Number.parseInt(x,10)`, `Number.isNaN`, `===`. Nunca `var`.
- `infra/**/*.js` excluido do lint.
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`).

## Git (revisao obrigatoria)

- **NUNCA** fazer `merge` nem `push` automaticamente, sem ordem explicita do usuario.
- Ao concluir uma tarefa, parar e apresentar o resumo das alteracoes (arquivos + diff) para revisao.
- Aguardar o usuario revisar e autorizar explicitamente antes de qualquer `push`/`merge`.
- Nao usar comandos `git checkout`, `git merge`, `git push` ou abrir PR/merge em remoto como parte da execucao; apenas quando solicitado.

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

## Seguranca

- Sem secrets hardcoded. Sanitizar todo input externo. Auth sempre server-side.
- `dangerouslySetInnerHTML`: comentar justificativa inline.

## Padroes

- SEO: `SeoHead` — nunca `<Head>` inline.
- CSS Module junto ao componente (`ComponentName.module.css`).
- Nomes: componentes `PascalCase`, hooks/utils `camelCase`, assets `kebab-case`, constantes `UPPER_SNAKE_CASE`.
- Models: `const modelName = { ... }; export default modelName;` — nunca `export default { ... }` direto (evita `import/no-anonymous-default-export`).
- Sidebar: novos itens em `components/LeftSidebarComponent.js` dentro do grupo `NavList` apropriado.
- Video embed customizado: criar componente `VideoEmbed` inline (YouTube/Vimeo parser). Nao usar `Embeds` existente — ele espera estrutura especifica de post.
- Nao criar arquivos de exemplo/demo sem solicitacao.

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

Imagem estatica (nao vem de upload): a arte do site sao DOIS arquivos com o MESMO desenho e o mesmo canvas — `public/images/og-cover.jpg` (`OG_COVER_IMAGE` -> `DEFAULT_OG_IMAGE`, capa de todo preview de link) e `public/images/og-cover.png` (`OG_COVER_ART`, exibida na home). Sao dois porque as superficies pedem coisas opostas: as redes recortam o preview em 1,91:1, entao o jpg ja vem nesse formato, com a moldura da arte centralizada e sobra nas laterais justamente para o recorte nao comer a moldura; na home a sobra nao serve para nada e, opaca, engrossava a borda branca da arte — o png tem a sobra transparente e o card da home a descarta (`.promoCard` declara `aspect-ratio: 832 / 736`, a proporcao do DESENHO e nao a do canvas, e o `.promoImage` faz `object-fit: cover`, que corta a sobra dos dois lados). A arte e mantida a mao, sem gerador (o `scripts/build-og-cover.js` e a arte quadrada `ArteSite.png` sairam junto com ela), entao `scripts/audit-image-presets.js` confere contra os arquivos: que existem, que os dois canvas batem entre si e com `OG_IMAGE_SIZE` (`lib/seo.js`, consumido pelo `og:image:width/height` e pelo `<Image>` da home), que a proporcao do jpg e a do card, que o png tem alfa e que o `aspect-ratio` do `.promoCard` e o do conteudo da arte (medido no bbox do alfa). Nao voltar a apontar para arquivo inexistente: ja aconteceu (`/images/og-cover.png` respondia 404 e a home era compartilhada sem imagem).

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

## Cadastro abandonado (nunca ativado)

- O cadastro grava a linha em `users` **antes** da ativacao, e `email`, `cpf` e `username` sao unicos. Sem saida, quem nao ativa fica travado para sempre — e a mensagem do token vencido ainda manda "faca um novo cadastro", que e o que as validacoes recusam. Reenviar e-mail nao resolve o caso mais provavel (**email digitado errado**: o endereco nao existe) e o CPF e unico, entao trocar de email nao contorna.
- `user.annulAbandonedRegistrations` (`models/user.js`), chamada no inicio de `create`, apaga o cadastro abandonado e libera as tres chaves. Roda no model (e nao na rota) para valer em todo caminho de criacao e para a unicidade seguir sendo a unica autoridade sobre conflito.
- So anula com as **tres** condicoes juntas: (1) nunca ativado (`create:session` ausente em `features`); (2) sem nenhum token valido; (3) **nenhum token de outra finalidade** — um token de reset, mesmo vencido ou ja usado, mantem o cadastro. O estado do token nao importa; o que importa e ele ter existido: pedir reset exige saber email + CPF e o link chega por e-mail, o que e engajamento que o cadastro sozinho nao produz.
- Sem a condicao (3), um cadastro abandonado **com pedido de reset** era anulado e outra pessoa tomava o CPF (verificado: dava 201, agora da 400).
- `sessions` e `user_activation_tokens` **nao tem FK para `users`**: apagar o usuario deixaria as duas com linhas orfas, entao a limpeza e explicita num unico CTE. Muitas tabelas tem FK `NO ACTION` (posts, comments, organizations); como a condicao garante "nunca ativado", essas linhas nao existem — e se existirem, a operacao falha em vez de apagar dados de alguem pela metade.
- Testes em `tests/integration/api/v1/users/post.test.js` (bloco "cadastro abandonado"), incluindo os dois negativos. Testes que criam usuario **nunca ativado** e esperam conflito de unicidade precisam ativar a conta de referencia, senao a anulacao os libera e o teste mede outra coisa.

## CPF (documento, nao numero)

- `users.cpf` e **`VARCHAR(11)`**, nao numerico. CPF e documento: `012.345.678-90` e `12.345.678-90` sao documentos diferentes, e coluna numerica apaga o zero a esquerda — o registro passa a apontar para outro CPF. A referencia e `organizations.cnpj VARCHAR(18)`.
- Toda a traducao entre o que o usuario digita e o que a coluna guarda vive em **`lib/cpf.js`** (registro unico, como `lib/contactTypes.js`): `normalizeCpf` (so digitos), `isValidCpf` (digitos verificadores), `formatCpf` (exibicao), `maskCpfInput` (mascara progressiva enquanto digita).
- Na **escrita** (`models/user.js`, `normalizeCpfInObject`) o CPF e normalizado e recusado se nao tiver 11 digitos — **400**, nao 500. Antes, entrada mascarada (`"012.345.678-90"`) fazia o Postgres responder `invalid input syntax for type numeric` e virava 500; e sem normalizar, a coluna de texto aceitaria a versao COM e SEM mascara como duas linhas, furando a unicidade.
- A validacao do model e de **formato** (11 digitos), nao de digito verificador: o formulario ja valida o algoritmo (`isValidCpf`). Recusar por verificador no servidor quebraria dados legados.
- Na **comparacao** (`/api/v1/reset-password/request`) os dois lados passam por `normalizeCpf`. Era `===` direto, e isso falhava em silencio: o banco devolvia sem mascara e sem zero a esquerda, o usuario digita com mascara, a comparacao nao casava, a API respondia sucesso generico e **nenhum e-mail era enviado**.

## E-mail em desenvolvimento (Mailcatcher)

- O Mailcatcher publica **4025 (SMTP)** e **4080 (HTTP)** no host — nao 1025/1080. A 1025 e `quick` no IANA e o Windows a disputa: o **Rockstar Games Launcher (`RLHostService`) a ocupa em `127.0.0.1` e aceita a conexao sem responder SMTP**, o que aparece como `ETIMEDOUT: Greeting never received` no nodemailer e como e-mail que nunca chega.
- Dentro do container as portas continuam 1025/1080 (imagem fixa); muda so o lado do host. Ao mexer, atualize os **dois** lugares: `ports` em `infra/compose.yaml` e `EMAIL_SMTP_PORT`/`EMAIL_HTTP_PORT` em `.env.development`.
- O app usa `EMAIL_HTTP_PORT` no link do e-mail; a suite de testes usa `EMAIL_HTTP_HOST`/`EMAIL_HTTP_PORT` no `orchestrator` (o `beforeAll` testa `GET /` do Mailcatcher — um substituto precisa responder 200 nessa rota).

## Janela de validade de token (um relogio so)

- `activation.create` calcula `created_at`/`expires_at` com **`now()` do banco**, nao com `Date.now()` do Node. Antes eram dois relogios medindo a mesma janela: com qualquer diferenca entre processo e Postgres (o ambiente local chega a ~5,5 s), o token nascia praticamente vencido ou durava mais que a hora prevista.
- Por isso, teste de token expirado **envelhece a linha no banco** (`UPDATE ... SET expires_at = now() - interval '1 hour'`), nao usa `jest.useFakeTimers` — adiantar o relogio do Node nao tem efeito nenhum sobre quem decide a validade.

## SEO / descoberta (Google)

- **Sitemap**: `lib/sitemap.js` e a fonte unica. `sitemap.xml` e um **indice**; cada tipo tem um filho (`/sitemap/jogos.xml`, `/sitemap/noticias.xml`...) servido por `pages/sitemap/[type].js`. Acrescentar um tipo e acrescentar um item em `ENTITY_SITEMAPS` — nenhuma rota nova.
- A **agenda** entra com so os eventos PUBLICOS e publicados (`findAllForSitemap` de `models/event.js` filtra `visibility = 'public'` e `status = 'published'`). Reuniao de estudio fica de fora de proposito: e privada, vive em outra tabela (`meetings`) e a pagina dela e `noIndex` fixo.
- O sitemap enumera **eventos, nao instancias**: `event.findAll` devolve uma linha por ocorrencia (`event_instances`) porque o calendario precisa delas — um evento recorrente entraria repetido, todas as copias apontando para o mesmo endereco.
- O `.xml` faz parte do **valor** do parametro, nao do caminho do arquivo: o Pages Router casa um segmento dinamico inteiro, entao `sitemap-[type].xml.js` (trecho fixo + dinamico no mesmo segmento) nao gera rota nenhuma — a resposta era o 404 em HTML do site.
- Um indice de sitemaps **nao pode listar a si mesmo** (o Google recusa o arquivo inteiro). Por isso as rotas fixas tambem tem arquivo proprio (`/sitemap/estatico.xml`).
- Cada tipo tem `findAllForSitemap()` no model: so `slug` (ou `id`) e `updated_at`, sem paginacao e **com o mesmo filtro de moderacao do `findAll`**. Nao reaproveite `findAll` — ela corta em 50 itens, monta o card com JOINs e nao devolve `updated_at`.
- `<lastmod>` vem do `updated_at` da linha (`created_at` nas organizacoes, que nao tem `updated_at`). Nunca `new Date()`: data que muda a cada requisicao ensina o Google a ignorar o campo.
- **Listagem monta no servidor** (`getServerSideProps` da primeira pagina): o HTML precisa ter `<a href="/jogos/<slug>">`. Busca em `useEffect` deixa o HTML como spinner e nenhum link — o Google so chega a entidade se executar JavaScript. O `skipInitialLoad` (useRef) evita que o efeito de filtros refaca a busca da pagina 1 na montagem e troque os cards por um spinner.
- **`Date` em props quebra a rota**: `node-pg` devolve TIMESTAMP como `Date`, e o Next nao serializa — a pagina responde 500 ("Error serializing `.x.created_at`"). Props de model sempre passam por `JSON.parse(JSON.stringify(...))`. Isso ja quebrou `jogos-de-mesa/[slug]` inteiro.
- Nao gate o render em `loadingUser`: ele comeca `true` e so e resolvido por um efeito de cliente, que **nao roda no servidor**. Use `if (!initialX && (loadingUser || loading))`, senao o HTML servido e o spinner.
- **JSON-LD**: `lib/structured-data.js` monta (`breadcrumbList`, `videoGame`, `boardGame`, `book`, `newsArticle`, `review`, `course`, `event`) e o `SeoHead` serializa com escape anti-XSS. Nunca propriedade sem valor — campo opcional vazio e pior que campo ausente (o validador marca erro e o item perde o rich result); e o papel de `compact`. Em evento, `startDate` e obrigatoria (sem ela o builder devolve `null` e o item nao sai) e `eventAttendanceMode`/`eventStatus` refletem `is_online` e `status` — declarar presencial o que e misto, ou agendado o que foi cancelado, faz o Google exibir o evento errado.
- **`og:image:width/height`** sai de `ogImageSizeFromPreset(nome)` (`lib/seo.js`) para capa de conteudo, e de `OG_CARD_SIZE` (`lib/seo.js`) para os cards gerados em `/api/og/**`. Numero digitado a mao nao bate com o arquivo e a rede dimensiona o card errado **antes** de baixar a imagem.
- `OG_CARD_SIZE` mora em `lib/seo.js` e nao em `lib/og-image.js` porque **pagina** precisa dela: importar `lib/og-image.js` de uma pagina traz o `sharp` para o bundle de cliente e o build quebra ("Can't resolve 'fs'"). `lib/og-image.js` reexporta como `OG_WIDTH`/`OG_HEIGHT` para nao haver dois numeros.
- `next.config.js` **nao tem `i18n`**: o site e de um idioma so e os quatro locales mantinham tres copias nao traduzidas de cada pagina em `/en-US/`, `/fr/`, `/es/`.
- `Disallow` no `robots.txt` proibe rastreio, nao indexacao: `/admin/**` recebe `X-Robots-Tag: noindex` em `next.config.js`.
- `SeoHead` usa a prop `noIndex` (camelCase). `noindex` nao existe e o `undefined` cai no ternario, publicando `index, follow`.
- Regressao aqui e silenciosa (o site continua funcionando no navegador): `tests/integration/pages/` confere sitemap e os links das listagens no HTML servido.

### Exposicao de dados (o que o SSR pode e nao pode publicar)

- **A regra de leitura de evento mora no MODEL**: `visibilityCondition(userIdParamIndex)` (`models/event.js`), usada por `findAll` (lista) e `findById` (detalhe). Nao filtre visibilidade na rota ou na tela: esconder na lista e entregar no detalhe nao e meia protecao — e a protecao que nao existe, porque o endereco do evento e exatamente o link que circula por fora do site. Foi o bug: `findAll` filtrava, `findById` nao, e o visitante sem sessao lia titulo e descricao de evento `private` so sabendo o UUID.
- Visibilidade de evento: `public` para qualquer um; `members` para autenticado; `private` so para quem criou ou foi convidado — e o convite **pendente** ja da acesso (senao o convidado nao leria o evento que acabou de receber). Negar e **404**, nunca 403: 403 confirmaria que existe um evento ali.
- Como o SSR busca sem sessao, a pagina de evento restrito responde **404 tambem para quem tem acesso**; o cliente rebusca com `credentials: "include"` quando `user?.id` existe (`pages/agenda/[id]/index.js`) e desenha o evento. O card de OG (`pages/api/og/event/[id].js`) responde 404 para tudo que nao e publico — quem o busca e a rede social, sem sessao.
- Rascunho (`status = 'draft'`) e filtrado nas LISTAS, mas `findById` nao filtra status: quem tem o UUID le um evento publico ainda nao publicado. Se virar requisito, o lugar e a mesma `visibilityCondition`.
- **A lista de features do anonimo (`ANONYMOUS_FEATURES` em `infra/controller.js`) e a fonte unica de "o que e publico".** Nao ha tabela de permissao por tipo: o controller declara e os dois caminhos consultam. As rotas pelo middleware (`injectAnonymousOrUser` + `canRequest`); as paginas por `anonymousCan(feature)`, porque **`getServerSideProps` nao passa por middleware nenhum**.
- Toda pagina que le conteudo no servidor **precisa** do gate: `const { anonymousCan } = await import("@/infra/controller"); if (!anonymousCan("<feature>")) return { notFound: true };`. Import dinamico dentro do `getServerSideProps`, como os models, para o `infra/controller` nao entrar no bundle do cliente.
- A feature de cada gate e **a mesma da rota de API que a pagina espelha** (`/jogos` ↔ `GET /api/v1/games` ↔ `read:game:all`; `/jogos/[slug]` ↔ `GET /api/v1/games/[slug]` ↔ `read:game` — o `:all` e a listagem, o simples e o item). Negar vira **404, nao 403**: o projeto ja prefere nao confirmar existencia (ver `models/conversation.js`).
- O sitemap tambem respeita isso: cada item de `ENTITY_SITEMAPS` (`lib/sitemap.js`) declara `feature`, e `pages/sitemap/[type].js` faz o gate antes de montar. Tipo revogado do anonimo some do sitemap em vez de anunciar endereco que responde 404.
- `tests/unit/infra/publicReadFeatures.test.js` varre os `anonymousCan(...)` das paginas e falha se alguma feature usada nao estiver na lista do anonimo — e nomeia o arquivo. E o que impede a lista e as paginas de divergirem em silencio.
- **Nao contorne o gate chamando o model direto.** Se o dado precisa ser privado, ele nao entra em `ANONYMOUS_FEATURES` e a pagina nao o le. Retirar `read:course` da lista derruba a API **e** as tres paginas de curso juntas (verificado).
- `news` e o unico tipo com whitelist de saida (`getNewsResource` em `models/authorization.js`), e ela equivale as colunas de `newsFields`. Campo novo em `newsFields` sem entrar la faz o SSR publicar o que a API esconderia.
- Nao existe `pages/api/v1/studios/[slug]`: o detalhe do estudio e servido **so** pelo SSR, entao a feature de referencia e a da listagem (`read:studio`).
- Tudo que e varredura publica em massa (sitemap, listagem) repete o filtro de moderacao do `findAll`. Verificado ponta a ponta: com jogo ou estudio bloqueado, o detalhe, a listagem e o sitemap deixam de expor o item — inclusive as obras **do** estudio bloqueado (o `findBySlug` de cada tipo checa `studioBlocked`).
- Texto de usuario no JSON-LD passa pelo escape do `SeoHead` (`\u003c/script\u003e`) e no `<title>`/`<meta>` pelo escape do React. Testado com `</script><img src=x onerror=...>`: nenhuma superficie quebra.
- Leitura publica e **sem paginacao** ganha teto: `rateLimit.limiters.sitemap` (60/min por IP) em `pages/sitemap/[type].js`, porque o standalone do Next nao guarda cache de `getServerSideProps` e cada arquivo varre a tabela inteira. A isencao de loopback (`isLocalRequest`) mantem os testes sem limite.
- Resposta de erro **nao reflete** parametro do visitante (o 404 do sitemap lista as chaves validas, sem repetir o valor recebido).
- **`safeFetch` (`lib/safe-fetch.js`) e o unico jeito de buscar URL que vem de usuario.** `isSafeUrl` sozinho **nao basta**: ele valida a URL de entrada e o `fetch` segue redirecionamentos por padrao, entao um host publico controlado pelo atacante responde `302 Location: http://169.254.169.254/...` e o servidor busca o endereco de metadados. O `safeFetch` segue redirect **a mao**, revalidando cada hop, e **fixa o endereco validado** na conexao (option `lookup` do `http.request`) — o que fecha tambem o DNS rebinding, porque a resposta usada na checagem e a usada no socket. Usado por `image-proxy`, `pdf-proxy`, `fetchLinkPreview` e `fetchItchWidget`.
- O `image-proxy` **nao repassa o status do upstream**: devolve-lo transformava o proxy num oraculo de varredura da rede interna (porta aberta vs. fechada vs. servico que responde). Sempre 400 generico, com o motivo no log.
- **Token de ativacao e token de reset sao coisas diferentes**: `user_activation_tokens.purpose` (`activation` | `reset`, migration `1790700000001`). `changePasswordByToken` exige `reset` — sem isso, o token que chega por e-mail no cadastro (fica no inbox, pode ser encaminhado) trocava a senha. Ao criar token, passe a finalidade: `activation.create(userId, activation.TOKEN_PURPOSE.RESET)`.
- **`sessions.token` guarda o SHA-256 do token**, nao o token: quem obtem um dump do banco nao tem sessoes prontas para usar. `findOneValidByToken` aceita o formato antigo (texto plano) e **converte na hora** (upgrade on read), entao subir nao desloga ninguem. Consequencia: `session.renew` devolve o hash — **nunca** use `row.token` para reescrever o cookie, use o token que veio do cookie (`pages/api/v1/user/index.js`).
- `rateLimit.isLocalRequest` **nao** trata `"unknown"` como local: sem `X-Forwarded-For` nao da para afirmar que a origem e interna, e presumir isso desligava o limiter inteiro (fail-open).
- O sanitizador remove `style` de conteudo de usuario (`lib/sanitize.js`): nao e vetor de script, mas permite sobreposicao visual (phishing por cima da pagina). `tests/unit/lib/sanitize.test.js` fixa os payloads de ataque.
- Aula e publica por desenho (`read:course:lesson` e anonima, sem checagem de matricula). O conteudo da aula entra no payload de `findFullBySlug`, que e **compartilhado** com `GET /api/v1/courses/[slug]`: restringir aula a matriz/inscrito e mexer no MODEL, nao so na rota — senao o SSR continua embutindo o que a API passou a esconder.
- **Adicionar uma feature de API?** Registrar nos 3 lugares de sempre (`models/authorization.js`, `models/activation.js`, `infra/controller.js`) — e, se a pagina correspondente precisar dela para o visitante anonimo, o `anonymousCan` no `getServerSideProps` junto.

## PowerShell

- Windows PowerShell 5.1: `Get-Content -Raw` e `Set-Content -NoNewline` **nao existem**.
- Usar `[System.IO.File]::ReadAllText($path)` e `[System.IO.File]::WriteAllText($path, $content)`.
- Verificar line endings: arquivos sao CRLF. Usar `` `r`n `` nas strings de replace.
