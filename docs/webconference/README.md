# Webconferência — Galene 1.1 (produção)

Runbook operacional da integração da webconferência de estúdio com o
[Galene](https://galene.org/) (SFU em Go, sem IA no servidor).

Índice do código:

- `lib/galene.js` — provisiona `groups/<room>.json` + emite JWT HS256 + monta a
  URL de entrada (`getAuthSecret`, `getMeetOrigin`, `ensureRoomProvisioned`,
  `createJoinTokenAndUrl`).
- `models/meeting.js` + `pages/api/v1/meetings/*` — agendamento, código
  expirante por reunião e convite de externos.
- `pages/reunioes/[meetingId]/index.js` — fluxo do convidado (código → nova
  aba com o cliente Galene).
- `deploy/compose.yaml` — serviço `galene` (`network_mode: host`).
- `deploy/nginx/meet.https.conf` — vhost TLS `meet.jogos.social.br` →
  proxy para o Galene.
- `deploy/galene/` — Dockerfile (tag `galene-1.1`) e docs da imagem.
- `.github/workflows/deploy.yml` — build da imagem, volumes e start.

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

## Setup único (manual) — pendências fora do repositório

Estas etapas são manuais e **obrigatórias** antes do primeiro deploy da Fase 5:

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
- build da imagem `indies-galene:galene-1.1` a partir de `deploy/galene`
  (inclui os patches de `deploy/galene/patches/` aplicados no build);
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

## Atualização da imagem (tag fixa)

Como a tag `indies-galene:galene-1.1` é fixa, um novo build com o mesmo nome
exige `--force-recreate` para aplicar:

```sh
cd /var/www/indies
docker compose -f compose.yaml up -d --force-recreate galene
```

## Solução de problemas

| Sintoma                                                 | Causa provável                                                        | Ação                                                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Sala não entra / TURN morre                             | Firewall fechado ou rede errada                                       | Conferir ufw (1194 + 40000-40100/udp) e que `galene` está em `network_mode: host`                           |
| Certificado inválido no navegador                       | SAN `meet` ainda não emitido                                          | Atualizar `CERTBOT_DOMAIN` e rodar `deploy-infra` (ou renovação)                                            |
| 502 no `meet.jogos.social.br`                           | nginx não recriado com `extra_hosts`                                  | `docker compose up -d --no-deps nginx`                                                                      |
| JWT rejeitado (`invalid signature`)                     | `GALENE_AUTH_SECRET` diverge da `authKeys`                            | Regenerar grupos com a secret correta (hot-reload)                                                          |
| Cliente tenta `ws://` (Mixed Content / "Not Connected") | `data/config.json` sem `proxyURL`                                     | Gravar `"proxyURL": "https://meet.jogos.social.br"` (deploy ou manual) e `docker restart galene`            |
| Refresh na sala pede login (usuário/senha)              | Galene remove o `?token=` da URL após o join                          | Usar imagem com o patch `0001-keep-join-token-on-reload` (sessionStorage) — exige `--force-recreate galene` |
| Sem áudio no navegador MI (Xiaomi)                      | Autoplay/permissão de microfone restritas; navegador Chromium próprio | Liberar autoplay e microfone nas configurações do MI; como fallback testar em Chrome/Edge/desktop           |
