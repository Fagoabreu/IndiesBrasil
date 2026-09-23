# galene — Webconferência (Galene 1.2.1)

Subprojeto do Indies Brasil que entrega o servidor de webconferência: um **fork
vendorizado** do [Galene][up] com as nossas customizações no cliente web. É o
artefato do serviço `galene` declarado em `deploy/compose.yaml` (produção) e em
`infra/compose.yaml` (desenvolvimento).

O Galene é um SFU (Selective Forwarding Unit): **toda** a mídia WebRTC passa
pelo servidor, sem modo P2P, e **sem IA** (MediaPipe/background blur não é
compilado — o menu correspondente simplesmente não aparece).

|                                       |                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Versão base do upstream               | `galene-1.2.1`                                                                              |
| Imagem Docker                         | `indies-galene:galene-1.2.1`                                                                |
| O que é nosso e como rebasear         | [`UPSTREAM.md`](UPSTREAM.md)                                                                |
| O que cada customização faz e por quê | [`CUSTOMIZATIONS.md`](CUSTOMIZATIONS.md)                                                    |
| Documentação oficial do upstream      | `galene.md`, `galene-install.md`, `galene-api.md`, `galene-client.md`, `galene-protocol.md` |

## Estrutura

| Caminho                | Papel                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `*.go` e subdiretórios | Código do upstream — **não modificar** sem ler `UPSTREAM.md`           |
| `static/`              | Cliente web servido pelo Galene (é onde vivem as customizações)        |
| `static/indies.css`    | Skin da marca: superfícies planas, raio e paleta roxa (customização 3) |
| `CUSTOMIZATIONS.md`    | O porquê de cada customização do cliente (leia antes de mexer)         |
| `templates/`           | `config.example.json` e `group.example.json` de referência             |
| `groups/`              | Só um `.gitkeep`: as salas são provisionadas em runtime                |
| `Dockerfile`           | Build da imagem a partir desta árvore                                  |
| `deploy/galene`        | **não existe mais** — foi tudo consolidado aqui                        |

## Customizações

São todas no cliente (`static/`). Nenhum arquivo Go do servidor foi alterado.

| #   | Efeito                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Mantém o `?token=` no `sessionStorage` para o refresh da página não cair na tela de login                                                    |
| 2   | Painel esquerdo mostra a contagem de participantes (o nome do estúdio vive só na barra superior, sem duplicar)                               |
| 3   | Carrega `/indies.css` como overlay depois do `galene.css`                                                                                    |
| 4   | Classe `peer-screenshare` no tile de compartilhamento de tela                                                                                |
| 5   | Com tela compartilhada: "palco" no topo (uma tela em linha inteira; várias dividem o topo em grade) + faixa de miniaturas das câmeras abaixo |
| 6   | Avatar do perfil do participante na lista, publicado por `setdata` e restrito ao nosso Cloudinary                                            |
| 7   | Sair da sala quando o organizador encerra a reunião (reage ao `status.locked`)                                                               |
| 8   | Saída que funciona: reconectar com o token guardado, ou voltar para a plataforma (`?back=`)                                                  |

## Arquitetura de rede

O serviço em produção usa **`network_mode: host`** (obrigatório):

- o TURN embutido (`-turn :1194`) enumera apenas endereços IPv4 **públicos** do
  host (`publicAddresses()` pula RFC1918). Em bridge o container só tem IP
  privado e o TURN morre com `no public addresses`;
- o nginx termina o TLS em `meet.jogos.social.br` e faz proxy para
  `http://host.docker.internal:8000` via `extra_hosts: host-gateway`
  (websocket `/ws` com `Upgrade`);
- a porta `:8000` escuta em todas as interfaces do host, mas o firewall do VPS
  **não** a libera publicamente (ufw permite apenas 80/443 + as portas abaixo).

### Portas no host

| Porta       | Proto   | Finalidade                                                      |
| ----------- | ------- | --------------------------------------------------------------- |
| 8000        | TCP     | HTTP interno (nginx → host-gateway). **Não abrir no firewall.** |
| 1194        | TCP+UDP | TURN embutido (cliente em rede restrita)                        |
| 40000-40100 | UDP     | Mídia WebRTC do SFU (`-udp-range`)                              |

Como o nginx termina o TLS e repassa HTTP, o Galene veria `r.TLS == nil` e
anunciaria endpoints `ws://` — o que quebraria o WebSocket numa página https. O
deploy resolve gravando `data/config.json` com `"proxyURL"` derivado de
`MEET_URL` (ver `.github/workflows/deploy.yml`, passo _Ensure Galene volumes
ownership_). Modelo: [`templates/config.example.json`](templates/config.example.json).

## Provisionamento de salas

Cada **estúdio** é um arquivo `groups/<estudio>.json` com `authKeys` (JWT HS256)
e `"auto-subgroups": true`. As **reuniões** são subgrupos desse arquivo:
`<estudio>/<reuniao>`. O Galene faz **hot-reload** — não é preciso reiniciar o
servidor depois de gravar.

Por que um arquivo por estúdio, e não por reunião:

- o número de arquivos é O(nº de estúdios), não O(nº de reuniões) — não cresce
  sem limite nem deixa sala órfã quando a reunião termina (era o que acontecia
  antes: o diretório acumulou 44 arquivos de reuniões já encerradas);
- a sala herda `displayName` e `authKeys` do estúdio;
- criar uma reunião não escreve em disco;
- um token vazado abre as salas de **um** estúdio, não do servidor inteiro.

Quem grava é a plataforma, em `lib/galene.js`:

1. `ensureStudioGroup(studioSlug, displayName)` escreve o arquivo do estúdio de
   forma atômica (tmp + `rename`, para o Galene nunca ler um JSON parcial) e só
   reescreve se o conteúdo mudou. É idempotente e pode rodar a cada entrada em
   sala, sem acumular arquivos;
2. `createJoinTokenAndUrl({ studio, roomId, ... })` emite o JWT com audiência no
   **estúdio** (`"<origin>/group/<estudio>/"`) e `include-subgroups: true`, e
   monta a URL de entrada da **sala**
   (`"<origin>/group/<estudio>/<reuniao>/?username=<nome>&token=<jwt>"`).

Com `include-subgroups` o Galene casa a audiência por prefixo
(`galene/token/jwt.go` → `matchGroup`): o token vale para qualquer sala do
estúdio e para nenhuma de outro. `roomGroupName(studio, roomId)` monta o par e
valida as duas partes.

Além de `authKeys`, a plataforma grava `displayName` com o nome do estúdio, que
aparece na barra superior da sala.

### Encerrar uma reunião

Encerrar exige **expulsar** quem está na sala, e o Galene não tem "expulsar
todos". O `lib/galene.js` faz três coisas, nesta ordem:

1. `closeRoom()` grava `groups/<estudio>/<roomId>.json` com `expires` no passado
   — como as permissões de participante não incluem `op`, o Galene recusa a
   entrada, inclusive de um token já emitido. É o que mantém a sala fechada se o
   servidor reiniciar (o lock é estado em memória);
2. `pruneClosedRooms()` remove os arquivos de salas cuja janela já passou. O
   arquivo do passo 1 só é necessário enquanto `ends_at` é futuro — inclusive
   para a reunião recém-encerrada, que continua com `ends_at` no futuro quando
   encerrada antes do tempo;
3. `lockRoom()` entra na sala com um token efêmero de moderador (`op`, nunca
   entregue a ninguém), envia `groupaction lock` e sai. O `SetLocked` empurra um
   `change` a todos e o servidor responde com `Status(true, nil)`, então
   `locked: true` chega aos presentes — é assim que a customização 7 do cliente
   sabe que deve sair.

Só o passo 3 depende de rede, e é o último de propósito: uma falha ali deixa a
reunião já fechada no banco e no disco (fail-closed).

> O parâmetro `GALENE_INTERNAL_WS_URL` é o WebSocket interno do Galene,
> necessário para o passo 3. O Galene usa `network_mode: host`, então o app o
> alcança por `host.docker.internal` (ver `extra_hosts` no `deploy/compose.yaml`).

O container `indies-app` e o `galene` compartilham o volume `galene-groups`
(ambos com uid **1001**). Caminho dos grupos:

| Ambiente        | Diretório       | Como                                                                   |
| --------------- | --------------- | ---------------------------------------------------------------------- |
| Produção        | `/app/groups`   | volume nomeado `indies_galene-groups`, `GALENE_GROUPS_DIR=/app/groups` |
| Desenvolvimento | `galene/groups` | bind-mount `../galene/groups:/app/groups`                              |

O padrão de `getGroupsDir()` (`lib/galene.js`) é `galene/groups` relativo à raiz
do repositório, o mesmo diretório que o compose de dev monta.

## Desenvolvimento local

O serviço `galene` do `infra/compose.yaml` usa **esta árvore como contexto de
build** (`build.context: ../galene`) e publica o cliente em
`http://localhost:8000`. O primeiro `npm run dev` compila a imagem localmente
(`indies-galene:galene-1.2.1`) junto com o banco e o Mailcatcher.

Diferenças propositais para o dev (ver `infra/compose.yaml`):

- porta `8000` **publicada** em vez de `network_mode: host` — o Docker Desktop
  (Windows/macOS) não suporta host networking;
- TURN desligado (`-turn ""`) — sem rede restrita local o TURN só geraria erro
  de `no public addresses` dentro do container;
- os grupos são um bind-mount de `galene/groups`, o mesmo diretório que o app
  usa em dev — é assim que o hot-reload funciona;
- `data/` não é montado (com `-insecure` o `config.json`/`proxyURL` é opcional).

Depois de alterar qualquer arquivo de `static/` (incluindo o `indies.css`) ou
qualquer `.go`, **reconstrua a imagem** — o compose só recompila quando ela não
existe:

```sh
docker compose -f infra/compose.yaml build galene
docker compose -f infra/compose.yaml up -d --force-recreate galene
```

Para testar o servidor sem o app (cliente cru do Galene): suba a imagem e abra
`http://localhost:8000`. Sem um grupo provisionado não há como entrar numa sala
protegida por `authKeys` — as salas de teste nascem pelo fluxo do app.

## Build

```sh
# A mesma imagem que o CI publica no VPS.
docker build -t indies-galene:galene-1.2.1 galene
```

O build compila a árvore local (não clona nada). `CGO_ENABLED=0` gera um
binário estático; o runtime é `alpine` com um usuário `galene` de uid **1001**,
o mesmo do usuário `nextjs` da imagem do app — é o que permite o volume de
grupos ser compartilhado.

> A tag da imagem é o nome da tag base do upstream. Ao rebasear para uma versão
> nova, atualize a tag nos **três** lugares que a referenciam:
> `deploy/compose.yaml`, `infra/compose.yaml` e `.github/workflows/deploy.yml`.

## Operação no VPS

O deploy é feito pelo GitHub Actions (`.github/workflows/deploy.yml`), que
compila a imagem, garante o dono `1001:1001` nos volumes e recria o container.
Para aplicar uma imagem já publicada:

```sh
cd /var/www/indies
docker compose -f compose.yaml up -d --force-recreate galene
docker compose -f compose.yaml up -d --no-deps nginx   # se o vhost mudou
```

Logs:

```sh
docker logs -f galene
```

## Upstream

O Galene é (c) Juliusz Chroboczek e colaboradores, sob licença MIT
([`LICENCE`](LICENCE)). Documentação oficial versionada nesta árvore:

- [`galene.md`](galene.md) — manual do usuário e do administrador;
- [`galene-install.md`](galene-install.md) — instalação a partir do código;
- [`galene-api.md`](galene-api.md) — API administrativa HTTP (`/galene-api/v0/`);
- [`galene-client.md`](galene-client.md) — como escrever um cliente;
- [`galene-protocol.md`](galene-protocol.md) — o protocolo do cliente.

Lista de discussão: <https://lists.galene.org/>. Site: <https://galene.org>.

[up]: https://github.com/jech/galene
