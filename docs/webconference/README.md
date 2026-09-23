# Webconferência — Galene 1.2.1

Runbook operacional da integração da webconferência de estúdio com o
[Galene](https://galene.org/) (SFU em Go, sem IA no servidor).

O servidor é um **subprojeto vendorizado** em [`galene/`](../../galene/README.md):
o upstream fica versionado no repositório e as customizações do cliente são
nossas. Versão base **`galene-1.2.1`**, imagem **`indies-galene:galene-1.2.1`**.
Antes de mexer em qualquer arquivo dentro de `galene/`, leia
[`galene/UPSTREAM.md`](../../galene/UPSTREAM.md).

Índice do código:

- `galene/` — o subprojeto Galene (upstream + customizações + `Dockerfile`);
  `galene/README.md` é a visão geral e `galene/UPSTREAM.md` o contrato com o
  upstream (o que é nosso, o que não alterar, como rebasear).
- `lib/galene.js` — provisiona o grupo do **estúdio** (`groups/<estudio>.json`,
  com `auto-subgroups` e o `displayName` exibido no topo das salas) + emite o
  JWT HS256 com escopo de estúdio + monta a URL de entrada da sala
  (`getAuthSecret`, `getMeetOrigin`, `ensureStudioGroup`, `roomGroupName`,
  `createJoinTokenAndUrl`).
- `scripts/audit-galene-upstream.js` — confere que `galene/` continua sendo o
  upstream na tag base + exatamente as customizações documentadas.
- `models/meeting.js` + `pages/api/v1/meetings/*` — agendamento, código
  expirante por reunião e convite de externos.
- `pages/reunioes/[meetingId]/index.js` — fluxo do convidado (código → nova
  aba com o cliente Galene).
- `deploy/compose.yaml` — serviço `galene` em produção (`network_mode: host`).
- `infra/compose.yaml` — serviço `galene` no dev local (build a partir de
  `galene/`, porta `8000` publicada, TURN desligado).
- `deploy/nginx/meet.https.conf` — vhost TLS `meet.jogos.social.br` →
  proxy para o Galene.
- `.github/workflows/deploy.yml` — build da imagem, volumes e start.

> `deploy/galene/` **não existe mais**: `Dockerfile`, `patches/`, `templates/`,
> `static/indies.css` e a documentação foram consolidados em `galene/`.

## Topologia

```
                        VPS (firewall ufw)
  navegador ──wss/443──▶ nginx (TLS) ──host-gateway──▶ galene :8000 (host net)
                              ▲                            │
                        certbot SAN                      TURN :1194 + UDP 40000-40100
                  (jogos.social.br + meet)                     │
                                                        mídia WebRTC direta
```

- O Galene roda em `network_mode: host`: o TURN embutido enumera IPs **públicos**
  do host e a mídia SFU é relayada pelo servidor.
- Porta `:8000` **não** é liberada no firewall — só nginx (443) chega nela.
- `indies-app` e `galene` compartilham o volume `galene-groups` (uid 1001).

## Desenvolvimento local

O compose de dev (`infra/compose.yaml`) tem o serviço `galene`, então
`npm run dev` sobe o servidor junto com o banco e o Mailcatcher:

```sh
npm run dev            # compila a imagem na 1ª vez e sobe tudo
# ou, só o servidor Galene:
docker compose -f infra/compose.yaml up -d galene
```

- Cliente (escolha de sala): `http://localhost:8000`.
- Sem variáveis extras: `lib/galene.js` usa `MEET_URL=ws://localhost:8000` e a
  chave de desenvolvimento fixa quando as envs não existem.
- O grupo provisionado pelo app cai em `galene/groups/<estudio>.json`
  (bind-mount) e o Galene faz hot-reload. As salas (`<estudio>/<reuniao>`) são
  resolvidas por esse arquivo do estúdio — não há arquivo por reunião.
- Diferenças para produção: porta `8000` publicada (sem `network_mode: host`),
  `-turn ""` e sem `data/config.json` (com `-insecure` a `proxyURL` é
  opcional).

Ao alterar `galene/static/` ou qualquer `.go`, reconstrua a imagem — o compose
só recompila quando ela não existe:

```sh
docker compose -f infra/compose.yaml build galene
docker compose -f infra/compose.yaml up -d --force-recreate galene
```

## Setup único (manual) — pendências fora do repositório

Estas etapas são manuais e **obrigatórias** antes do primeiro deploy:

1. **DNS**: criar registro `A meet.jogos.social.br` apontando para o IP do VPS.

2. **GitHub — Variável `CERTBOT_DOMAIN`**: incluir `meet.jogos.social.br` na
   lista (o certbot roda com `--expand --cert-name jogos.social.br`, então o
   certificado existente ganha o novo SAN). Exemplo:
   `jogos.social.br,www.jogos.social.br,meet.jogos.social.br`

3. **GitHub — Variável `MEET_URL`**: `wss://meet.jogos.social.br`

4. **GitHub — Secret `GALENE_AUTH_SECRET`** (32 bytes, base64url — igual à
   `authKeys` dos grupos):

   ```sh
   openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n'
   ```

5. **Firewall do VPS** (ufw), além de 80/443:

   ```sh
   sudo ufw allow 1194/tcp
   sudo ufw allow 1194/udp
   sudo ufw allow 40000:40100/udp
   ```

6. **Expandir o certificado** (SAN com `meet`): rodar o workflow
   `deploy-infra` (confirmar o deploy) uma vez — ou aguardar a renovação
   automática — e conferir com:
   ```sh
   docker exec nginx openssl x509 -in /etc/letsencrypt/live/jogos.social.br/fullchain.pem -noout -text | grep -A1 "Subject Alternative Name"
   ```

## Deploy

O workflow `deploy.yml` já cuida de:

- gerar `.env.production` com `MEET_URL`, `GALENE_AUTH_SECRET` e
  `GALENE_GROUPS_DIR=/app/groups`;
- garantir dono `1001:1001` dos volumes `indies_galene-groups` e
  `indies_galene-data`;
- gravar `data/config.json` com `"proxyURL"` (base https derivada de
  `MEET_URL`) — sem isso o Galene anuncia `ws://` e o WebSocket falha em
  página https (veja "Solução de problemas");
- build da imagem `indies-galene:galene-1.2.1` a partir de `galene/` (compila a
  árvore já com as customizações aplicadas; não clona nem aplica patches no
  build);
- `up --force-recreate indies-app galene` e `up nginx` (recriação do nginx só
  quando o compose muda — ex.: `extra_hosts`).

## Validação pós-deploy

```sh
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'galene|nginx|indies'
docker logs galene --tail 30
curl -sI https://meet.jogos.social.br/ | head -n 5
```

Procurar no log do Galene linhas tipo `Listening on` e a ausência de erro de
TURN ("no public addresses"). Abrir `https://meet.jogos.social.br/` deve
carregar a página de escolha de sala (grupos visíveis apenas com token).

Para confirmar que o container está na versão certa:

```sh
docker image inspect indies-galene:galene-1.2.1 --format '{{index .Config.Labels "org.opencontainers.image.description"}}'
```

## Atualização da imagem (tag fixa)

A tag da imagem é o nome da tag base do upstream, então um novo build reusa o
mesmo nome — `--force-recreate` é necessário para o container passar a usá-la:

```sh
cd /var/www/indies
docker compose -f compose.yaml up -d --force-recreate galene
```

Ao rebasear para uma tag nova do upstream, a tag da imagem muda; atualize-a nos
**três** lugares (`deploy/compose.yaml`, `infra/compose.yaml` e
`.github/workflows/deploy.yml`) seguindo o runbook em `galene/UPSTREAM.md`.

## Customização do cliente

As customizações do cliente vivem **na árvore do subprojeto** (`galene/static/`)
e são versionadas junto com o código — nada é editado à mão dentro do container
e não há arquivos de patch. Quem explica o porquê de cada uma é
[`galene/CUSTOMIZATIONS.md`](../../galene/CUSTOMIZATIONS.md); o contrato com o
upstream e o procedimento de rebase estão em
[`galene/UPSTREAM.md`](../../galene/UPSTREAM.md).

| #                          | Efeito                                                                                                                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                          | Mantém o `?token=` (sessionStorage) ao dar refresh — evita o "softlock" de login                                                                                                                                                         |
| 2                          | Exibe o `displayName` do grupo (nome do estúdio) também no painel esquerdo (não só no `#title`)                                                                                                                                          |
| 3                          | Injeta `<link href="/indies.css">` após o `galene.css` no `head`                                                                                                                                                                         |
| 4                          | Adiciona a classe `peer-screenshare` ao tile de compartilhamento de tela                                                                                                                                                                 |
| 5                          | Com screenshare ativo, as telas ficam no topo com destaque (uma = palco em linha inteira; várias = grade) e as câmeras viram faixa de miniaturas (padrão Teams/Zoom/Discord)                                                             |
| `galene/static/indies.css` | Skin "MSN Messenger": paleta roxa da marca; molduras/bevel, lista de contatos, grade igualitária arredondada e modo palco+faixa (`#peers.has-screenshare`, com variáveis `--thumb-w`/`--thumb-h` para calibrar o tamanho das miniaturas) |

O `displayName` é gravado no arquivo do **estúdio** no provisionamento
(`lib/galene.js` → `ensureStudioGroup(studioSlug, displayName)`) e herdado por
todas as salas dele, alimentando a customização 2.

### Modo palco + faixa (compartilhamento de tela)

A customização 5 detecta os tiles `.peer-screenshare` no `resizePeers` e marca o
container com `has-screenshare`; o `indies.css` então troca a grade igualitária
por um layout flex: as telas compartilhadas ocupam o topo — uma tela vira
"palco" em linha inteira (destaque roxo + selo "Apresentando"); várias telas
dividem o topo em grade — e as câmeras descem como miniaturas centralizadas,
sempre visíveis na parte de baixo.

Para calibrar o tamanho das miniaturas e a altura do palco, ajuste em
`galene/static/indies.css` as variáveis `--thumb-w`/`--thumb-h` do `#peers` (a
faixa mobile fica no `@media (max-width:1024px)`). O `resizePeersScreenshare`
lê essas variáveis via `getComputedStyle` a cada redimensionamento, então não
há nada a mexer no JS.

Como `indies.css` é servido com cache, após alterar a skin faça **hard refresh
(Ctrl+F5)** na sala — e, para validar as mudanças, use a aba de
desenvolvedor em "Network" para confirmar que `/indies.css` veio atualizado.

## Solução de problemas

| Sintoma                                                 | Causa provável                                                        | Ação                                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Sala não entra / TURN morre                             | Firewall fechado ou rede errada                                       | Conferir ufw (1194 + 40000-40100/udp) e que `galene` está em `network_mode: host`                 |
| Certificado inválido no navegador                       | SAN `meet` ainda não emitido                                          | Atualizar `CERTBOT_DOMAIN` e rodar `deploy-infra` (ou renovação)                                  |
| 502 no `meet.jogos.social.br`                           | nginx não recriado com `extra_hosts`                                  | `docker compose up -d --no-deps nginx`                                                            |
| JWT rejeitado (`invalid signature`)                     | `GALENE_AUTH_SECRET` diverge da `authKeys`                            | Regenerar grupos com a secret correta (hot-reload)                                                |
| Sala não carrega / some depois de um deploy             | Campo desconhecido no `groups/<estudio>.json`                         | O Galene lê o grupo com `DisallowUnknownFields`: conferir o JSON gravado por `lib/galene.js`      |
| Cliente tenta `ws://` (Mixed Content / "Not Connected") | `data/config.json` sem `proxyURL`                                     | Gravar `"proxyURL": "https://meet.jogos.social.br"` (deploy ou manual) e `docker restart galene`  |
| Refresh na sala pede login (usuário/senha)              | Galene remove o `?token=` da URL após o join                          | Usar a imagem `indies-galene:galene-1.2.1` (customização 1) — exige `--force-recreate galene`     |
| Topo esquerdo mostra "Galène" em vez do estúdio         | Grupo sem `displayName` ou imagem sem a customização 2                | Provisionar com `displayName` (nome do estúdio) e recriar o container com a imagem atual          |
| Tema MSN/grade não aparece no navegador                 | Cache do CSS ou imagem sem a skin                                     | Hard refresh (Ctrl+F5) e confirmar `/indies.css` (customização 3) + `static/indies.css` na imagem |
| Sem áudio no navegador MI (Xiaomi)                      | Autoplay/permissão de microfone restritas; navegador Chromium próprio | Liberar autoplay e microfone nas configurações do MI; como fallback testar em Chrome/Edge/desktop |
