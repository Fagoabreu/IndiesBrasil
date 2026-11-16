# Rascunho — Verificação de membros

Análise do único item em aberto da [fase 2 do roadmap](./roadmap.md). Não é plano aprovado: é o material para escolher o caminho.

> Conferido no código em 15/11/2026. As três opções abaixo custam coisas diferentes e resolvem problemas diferentes — escolher a errada é caro para desfazer, porque as duas primeiras guardam dado pessoal e a terceira não.

---

## O problema real

Hoje o único critério de "conta real" é a conta estar **ativada**, e o diretório já filtra por isso: `findUsers` exige `'create:session' = ANY(u.features)`, a mesma definição de `user_accounts` em `models/serverStatus.js`.

Isso resolve "não listar cadastro abandonado", mas não responde as perguntas que a comunidade vai fazer:

| Pergunta de quem usa                                 | Hoje                                                                                  |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------- |
| "Esse perfil é de uma pessoa de verdade?"            | Não há como saber                                                                     |
| "Esse perfil fala pelo estúdio que diz representar?" | Não há como saber                                                                     |
| "Esse estúdio é empresa mesmo?"                      | Só indiretamente: a elegibilidade da loja checa CNPJ, mas isso não aparece na vitrine |

E há a pergunta de quem opera:

| Risco                                          | Hoje                                           |
| ---------------------------------------------- | ---------------------------------------------- |
| Perfil falso se passando por estúdio conhecido | Só depois de denúncia, por moderação manual    |
| Estúdio reivindicando CNPJ de terceiro         | Nada impede — o CNPJ é texto livre no cadastro |
| Conta descartável criando conteúdo e saindo    | Rate limit segura volume, não identidade       |

O objetivo da verificação não é "ter selo". É reduzir esses quatro riscos a um custo aceitável. Por isso o critério de sucesso de qualquer opção é: **um selo que não pode ser comprado por quem quer só o selo.**

---

## As três opções

### Opção A — Verificação de identidade (documento)

A pessoa envia RG/CNH e uma selfie; alguém — ou um serviço de KYC — compara. É o modelo das redes grandes.

**O que resolve:** "essa pessoa é quem diz ser". É a única opção que cobre pessoa física sem estúdio.

**O que custa:**

- **Guardar documento é o problema, não o processo.** Documento de identificação é dado pessoal de risco alto sob a LGPD: exige base legal específica, finalidade declarada, prazo de retenção, criptografia em repouso e um lugar onde a exclusão a pedido funcione. Hoje o projeto não tem nada disso — não há nem política de retenção escrita.
- **Terceirizar (KYC) não tira o problema**, só muda de lugar: o fornecedor vira operador, e ainda é preciso contrato de tratamento, escolha de região e um fornecedor que atenda brasileiro.
- **Fila humana**: cada verificação é uma decisão com consequência jurídica (recusar alguém sem motivo justificado é problema). Sem equipe de suporte, vira gargalo na primeira semana.
- **Custo por verificação**: serviços de KYC cobram por consulta, e a maioria exige CNPJ do contratante.

**Veredito:** não fazer agora. É o caminho certo quando houver CNPJ da plataforma, equipe de suporte e política de privacidade madura — não antes.

---

### Opção B — Domínio verificado (DNS ou arquivo no site)

O estúdio prova que controla o domínio que já declarou em `organizations.website`: um registro `TXT` em `_jogosocial.<dominio>` ou um `<meta>`/arquivo numa URL combinada.

**O que resolve:** "quem fala por esse domínio é quem está aqui". Cobre estúdio e membro — um membro pode verificar `pessoal.dev` e um estúdio verifica `estudio.com.br`.

**O que custa:**

- **Praticamente nada de dado pessoal.** O que fica guardado é o token de prova e a data; nenhum documento.
- Uma migration, um model, uma rota de "gerar desafio" e outra de "conferir", uma tela simples e um selo.
- **Duas armadilhas de implementação:**
  1. **Consulta de DNS não usa o `fetch` do projeto** — não passa por `lib/safe-fetch.js`. Um `TXT` lookup não faz requisição HTTP ao endereço do usuário, então o risco de SSRF não é o mesmo, mas **a alternativa de "buscar uma meta tag no site" é**: essa sim precisa de `safeFetch`, porque é uma URL fornecida por usuário. Se optar por meta tag, não escreva `fetch(url)` direto.
  2. **Domínio expira e muda de dono.** O selo precisa ser reconferível e revogável — não é um "sim" gravado para sempre.

**O que não resolve:** estúdio sem site próprio (a maioria dos pequenos) e pessoa física sem domínio.

**Veredito:** o melhor custo/benefício, mas só serve para quem já tem site. Precisa de uma segunda perna.

---

### Opção C — CNPJ verificado

O dado **já existe**: `organizations.cnpj` e `lib/cnpj.js` validam os dígitos verificadores. E o projeto já tem um portão que praticamente define "estúdio levado a sério": a elegibilidade para vender exige CNPJ válido, endereço completo e contato cadastrado (`models/organization.js`).

**O que resolve:** "esse estúdio é empresa mesmo". É o selo que mais ajuda um comprador ou um contratante de serviço.

**O que custa:** pouco em código, **muito em rigor**. A pergunta difícil é:

> CNPJ válido prova que o número existe. **Não prova que ele é seu.**

Comparar com a base pública da Receita resolveria isso **se** a plataforma tivesse o nome civil do titular do CNPJ para cruzar — e não tem: o cadastro pede usuário, e-mail, CPF e senha, não razão social. Então as saídas são:

1. **Declaração + confiança + revogação.** O estúdio marca "sou responsável por este CNPJ", um admin confere na base pública (nome do estúdio já aparece na tela) e aprova. Barato, e suficiente para o tamanho da comunidade hoje.
2. **Cobrança de verificação.** Transferir valor irrisório da conta do CNPJ e conferir o nome do remetente. Prova forte, mas exige meio de pagamento — que é justamente a fase 5.
3. **Conta gov.br do responsável.** Prova de identidade forte e sem guardar documento, mas depende de integração com a plataforma de identidade do governo.

**Veredito:** a opção 1 é a única viável agora, e é honesta desde que o selo seja nomeado pelo que ele é: **"CNPJ conferido"**, não "empresa verificada".

---

## Recomendação

**Dois selos com nomes distintos, nenhum deles guardando documento.**

| Selo                   | Critério                                                                                  | Quem concede     | Custo de dado pessoal |
| ---------------------- | ----------------------------------------------------------------------------------------- | ---------------- | --------------------- |
| **CNPJ conferido**     | Elegibilidade que já existe (CNPJ válido + endereço + contato) **e** confirmação do admin | Admin, pela fila | nenhum                |
| **Domínio verificado** | Registro `TXT` conferido em `organizations.website`                                       | Automático       | nenhum                |

Por que dois e não um: são perguntas diferentes, e chamar as duas de "verificado" faria o selo significar "depende" — o que é pior que não ter selo. O primeiro responde "existe empresa", o segundo responde "controla este endereço". Uma conta pode ter os dois, um, ou nenhum.

**O que fica explicitamente fora de escopo agora:** selo de pessoa física por documento (opção A). É o item mais caro e o de menor retorno imediato — a comunidade de dev indie se apresenta por estúdio e por portfólio, não por documento.

Se em algum momento o selo de pessoa física for necessário, a porta de entrada mais barata é **conta gov.br**, justamente por não guardar documento.

---

## Esboço de implementação

Só o necessário para estimar; não é código final.

### Dados

Uma tabela **polimórfica**, no mesmo padrão que `reports` e `moderation_actions` já usam (`target_type` + `target_id`), em vez de duas tabelas quase iguais:

```
verifications
  id, target_type ('user' | 'organization'), target_id
  kind ('email_domain' | 'site_domain' | 'cnpj')
  status ('pending' | 'approved' | 'rejected' | 'expired')
  evidence            -- token do desafio, ou o CNPJ conferido
  requested_at, reviewed_at, reviewed_by, expires_at
  UNIQUE (target_type, target_id, kind)
```

Decisões que precisam entrar no comentário da migration:

- **`UNIQUE` por (alvo, tipo)** — uma verificação por tipo por alvo. Reprovar não pode criar linha nova silenciosamente; a linha é atualizada, com histórico em `reviewed_at`.
- **`expires_at` é obrigatório na prática**, para o selo de domínio. Sem expiração, um domínio que muda de dono continua verificado para sempre.
- **Nada de documento nesta tabela.** Se um dia entrar KYC, ele entra como referência a um fornecedor (`provider`, `provider_ref`), nunca como arquivo.

### Estado derivado, não coluna solta

O selo exibido deve ser **lido da tabela** (`status = 'approved' AND expires_at > now()`), não um booleano em `users`/`organizations`. Dois motivos:

- um booleano não diz **quem** concedeu, **quando**, **com que base** nem **por que** — e é exatamente isso que a moderação precisa quando alguém questiona o selo;
- booleano e tabela divergem em silêncio na primeira revogação feita só num dos dois lugares.

Se a leitura ficar caro no diretório, o caminho é uma coluna **mantida por trigger** ou recalculada na escrita — nunca digitada à mão.

### Não usar `features` para isso

`users.features` é o canal de **permissão**, e já acumula um segundo papel (marcar conta ativada via `create:session`). Colocar "verificado" ali criaria três problemas:

- o selo passaria a ser concedido por quem edita feature, misturando identidade com autorização;
- `features` é exposto em `getUserResource` para o próprio usuário e para admin, e a lista de features é a mesma que `ANONYMOUS_FEATURES` controla — dois conceitos, um campo;
- revogar o selo viraria "tirar uma permissão", com efeito colateral em gate de rota.

### Ponto que engana: o retorno da API é allowlist

`getUserResource` (`models/authorization.js`) monta a resposta **campo a campo**. Um campo novo em `users` **não aparece** em `/api/v1/users`, `/api/v1/user` nem no diretório até ser adicionado ali — e o contrário também vale: incluir ali é o que expõe publicamente. Isso é proteção, não obstáculo, mas é o passo que se esquece.

O mesmo vale do lado do estúdio: `organizations` precisa do campo no retorno do model e no card (`components/Card/StudioCard.jsx`).

### Fila de aprovação

O padrão já existe três vezes (`profession_suggestions`, `service_suggestions`, `game_genre_suggestions`) e deve ser copiado, não reinventado: `status` com `pending/approved/rejected`, `reviewed_by`, `reviewed_at`, tela em `/admin/*` com `read:admin`, e notificação ao solicitante por `createUserNotification` / `createOrgNotification`.

**Aprovar precisa registrar o motivo**, mesmo quando for "ok": é o que permite revisar a decisão depois.

### Feature nova (obrigatório nos 3 lugares + 4 arrays de teste)

Se a verificação tiver rota própria, ela precisa de feature registrada em:

1. `models/authorization.js` → `availableFeatures`
2. `models/activation.js` → `activateUserByUserId`
3. `infra/controller.js` → `injectAnonymousUser` (apenas se pública)

E os arrays de teste em **quatro** arquivos precisam ser atualizados: `registration-flow`, `users/[username]/patch`, `user/get` e `activations/[token_id]/patch`. O quarto é o que se esquece e o sintoma é um único teste vermelho.

### Onde o selo aparece

- **Perfil**: ícone ao lado do `@username`. O ícone precisa de `title`/`aria-label` textual ("CNPJ conferido"), não só cor — cor sozinha não é informação acessível.
- **Card de estúdio e de membro**: na linha de identidade, que em `cardBase` é **texto**, não chip. O selo entra como ícone inline nessa linha, não como quinta pílula — a decisão de "identidade é texto, chip é estado" está documentada e vale aqui.
- **Ficha do estúdio e press kit**: é onde o selo tem mais valor de negócio, porque é a página que um contratante abre.

### Moderação e revogação

Sem isso o selo é uma promessa que não se sustenta:

- entrar em `REPORT_TARGET_TYPES` para denúncia do selo;
- revogar = `status = 'rejected'` com motivo, ou `expires_at` no passado;
- **CNPJ que muda de dono** invalida o selo — a reconferência precisa ser possível sem abrir novo pedido.

---

## Riscos que a decisão precisa cobrir

| Risco                                              | Mitigação mínima                                                              |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Selo comprado (CNPJ de terceiro)                   | Conferência humana contra a base pública + revogação por denúncia             |
| Selo eterno em domínio que mudou de dono           | `expires_at` curto com reconferência automática                               |
| Selo como sinal de qualidade que ele não significa | Nomear o selo pelo que foi conferido ("CNPJ conferido"), nunca "confiável"    |
| Custo de suporte da fila                           | Começar com volume baixo e conceder automático só o que é verificável sozinho |
| Vazamento de dado de verificação                   | Não guardar documento; se um dia guardar, só referência de fornecedor         |

---

## Perguntas que precisam de resposta antes de começar

1. **Qual é o nome exato de cada selo na tela?** "Verificado" é curto e enganoso; "CNPJ conferido" é honesto e menos vendável. A escolha é de produto, e trava o resto.
2. **Quem aprova a fila?** Se for a mesma pessoa que faz moderação, o selo entra na fila existente; se for outra, precisa de notificação própria.
3. **Membro sem estúdio tem selo?** Sem domínio e sem CNPJ, ele não tem nenhum dos dois — e é a maioria. Aceitar isso explicitamente evita prometer o que a fase não entrega.
4. **O selo é público na API ou só na tela?** Público na API permite que terceiros consumam; também significa que revogar tem que refletir na hora.
5. **Existe política de privacidade publicada?** Sem ela, qualquer verificação que guarde dado pessoal (mesmo e-mail corporativo) fica sem base declarada.

## Ordem sugerida, se for começar agora

1. Tabela `verifications` + leitura derivada + selo de **CNPJ conferido** reusando a elegibilidade de loja que já existe. É a menor entrega com valor real.
2. Fila de aprovação em `/admin/verificacoes`, notificação e revogação.
3. Selo de **domínio verificado** com `TXT`, expiração e reconferência.
4. Só então avaliar pessoa física — e pela porta da gov.br, não por documento.
