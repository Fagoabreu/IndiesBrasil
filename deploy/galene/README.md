# deploy/galene — Webconferência (Galene 1.1)

Artefato do serviço `galene` declarado em `deploy/compose.yaml` (produção) e
em `infra/compose.yaml` (desenvolvimento — a imagem é construída deste mesmo
contexto). O Galene é um SFU (Selective Forwarding Unit): **toda** a mídia
WebRTC passa pelo servidor, sem modo P2P, e **sem IA** (MediaPipe/background
blur não é compilado).

## Papel deste diretório

- `Dockerfile` — compila a imagem `indies-galene:galene-1.1` a partir do
  release oficial `jech/galene` (tag fixa `galene-1.1`). O GitHub Actions
  (`deploy.yml`) executa o build durante o deploy. Não existe imagem oficial
  no Docker Hub — apenas de terceiros, então o build é do código-fonte.
- `patches/` — 4 patches aplicados via `git apply` sobre a tag fixada **antes**
  do build (falham o build se não casarem): `0001` mantém o token no refresh,
  `0002` exibe o nome do estúdio no cabeçalho (usa o `displayName` do grupo),
  `0003` carrega o CSS local e `0004` marca os tiles de screenshare. Ver
  `patches/README.md`.
- `static/indies.css` — skin "MSN Messenger" do cliente: carregada depois do
  `galene.css` (patch `0003`) e copiada pelo Dockerfile para `/src/static`.
  Altera apenas aparência (molduras, gradientes, grade de vídeo); mantém a
  paleta roxa da marca e não remove funcionalidade.
- `groups/.gitkeep` — os arquivos `groups/<room>.json` são provisionados em
  runtime pela plataforma (`lib/galene.js`, `GALENE_GROUPS_DIR`) e vivem no
  volume `galene-groups`, não no repositório.
- `templates/group.example.json` — formato de referência do grupo com
  `authKeys` (JWT HS256).
- `.gitignore` — evita versionar segredos/dados locais de execução manual.

## Arquitetura de rede

O serviço no compose usa **`network_mode: host`** (obrigatório):

- O TURN embutido (`-turn :1194`) enumera apenas endereços IPv4 **públicos**
  do host (`publicAddresses()` pula RFC1918). Em bridge o container só tem IP
  privado e o TURN morre com "no public addresses".
- O nginx termina o TLS em `meet.jogos.social.br` e faz proxy para
  `http://host.docker.internal:8000` via `extra_hosts: host-gateway`
  (websocket `/ws` com `Upgrade`).
- A porta `:8000` escuta em todas as interfaces do host, mas o firewall do VPS
  **não** a libera publicamente (ufw permite apenas 80/443 + portas Galene).

### Portas no host

| Porta       | Proto   | Finalidade                                                      |
| ----------- | ------- | --------------------------------------------------------------- |
| 8000        | TCP     | HTTP interno (nginx → host-gateway). **Não abrir no firewall.** |
| 1194        | TCP+UDP | TURN embutido (cliente em rede restrita).                       |
| 40000-40100 | UDP     | Mídia WebRTC SFU (`-udp-range`).                                |

## Provisionamento de salas

Cada sala é um arquivo `groups/<room>.json` com `authKeys` (hot-reload — não é
preciso reiniciar o servidor). A plataforma grava esse arquivo e emite o JWT
HS256 de acesso (ver `lib/galene.js`). Além da `authKeys`, a plataforma grava
`displayName` com o nome do estúdio — o cliente Galene mostra esse nome na
barra superior e no painel de usuários (patch `0002`). O container `indies-app`
compartilha o mesmo volume `galene-groups` com o `galene` (ambos uid **1001**).

O deploy garante dono `1001:1001` nos volumes `indies_galene-groups` e
`indies_galene-data` antes do primeiro start, e grava `data/config.json` com
`"proxyURL"` derivado de `MEET_URL` (ex.: `https://meet.jogos.social.br`). Como
o nginx termina o TLS e repassa HTTP, o Galene precisa dessa base para anunciar
endpoint `wss://` no status da sala (`baseURL()` usa `r.TLS`, sempre nil no
upstream). Modelo de referência: `templates/config.example.json`.

## Desenvolvimento local

O serviço `galene` do `infra/compose.yaml` usa **este diretório como contexto
de build** (`build.context: ../deploy/galene`) e publica o cliente em
`http://localhost:8000`. O primeiro `npm run dev` compila a imagem localmente
(`indies-galene:galene-1.1`) junto com o banco e o Mailcatcher.

Diferenças propositais para o dev (ver `infra/compose.yaml`):

- porta `8000` **publicada** em vez de `network_mode: host` — o Docker Desktop
  (Windows/macOS) não suporta host networking;
- TURN desligado (`-turn ""`) — sem rede restrita local o TURN só geraria erro
  de "no public addresses" dentro do container;
- os grupos são um bind-mount de `deploy/galene/groups`, o mesmo diretório que
  o app usa em dev (`GALENE_GROUPS_DIR` padrão de `lib/galene.js`): o Galene
  faz hot-reload do `groups/<room>.json` provisionado pela plataforma;
- `data/` não é montado (com `-insecure` o `config.json`/`proxyURL` é
  opcional).

Depois de alterar `patches/*.patch` ou `static/indies.css`, **reconstrua** a
imagem — o compose só recompila quando ela não existe:

```sh
docker compose -f infra/compose.yaml build galene
docker compose -f infra/compose.yaml up -d --force-recreate galene
```

## Manutenção manual no VPS

Aplicar atualização da imagem (quando `deploy/galene/*` mudar e o workflow já
tiver publicado a imagem nova com a mesma tag):

```sh
cd /var/www/indies
docker compose -f compose.yaml up -d --force-recreate galene
docker compose -f compose.yaml up -d --no-deps nginx   # se o vhost mudou
```

Ver logs:

```sh
docker logs -f galene
```
