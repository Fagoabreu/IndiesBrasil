import database from "infra/database";
import password from "models/password";
import { ValidationError, NotFoundError } from "infra/errors.js";
import notification from "./notification";
import organization from "./organization";
import { normalizeUsername, usernameProblem } from "lib/username";
import { normalizeCpf, isCpfLength, CPF_LENGTH } from "lib/cpf";

/**
 * Aplica a forma canônica ao username e valida o resultado.
 *
 * Roda na ENTRADA de `create` e `update` para que todo o resto do model (a
 * checagem de unicidade, o INSERT/UPDATE, os `currentUser`) trabalhe com o
 * mesmo valor — e não com variantes que só diferem por espaço ou normalização
 * de acento.
 *
 * @param {object} values objeto de entrada, modificado no lugar
 */
function normalizeUsernameInObject(values) {
  if (!("username" in values)) return;

  const normalized = normalizeUsername(values.username);
  const problem = usernameProblem(normalized);
  if (problem) {
    throw new ValidationError({ message: problem });
  }

  values.username = normalized;
}

/**
 * Aplica a forma canônica ao CPF antes de gravar.
 *
 * O CPF vem do usuário em qualquer forma — `012.345.678-90`, `01234567890`,
 * `012 345 678 90` — e a coluna guarda **só os dígitos** (`lib/cpf.js`). Sem
 * normalizar aqui, um valor com máscara chegava ao banco e a coluna de texto
 * o aceitaria **inteiro**, criando duas linhas para o mesmo documento ("com
 * máscara" e "sem máscara") e furando a unicidade. Antes da migration para
 * `varchar`, o mesmo valor virava 500 (`invalid input syntax for type numeric`).
 *
 * A validação aqui é de **formato** (11 dígitos), não de dígito verificador: o
 * formulário já valida o algoritmo (`isValidCpf`), e o servidor recusar por
 * verificador quebraria dados legados que já estão no banco — o objetivo desta
 * camada é impedir corrupção e erro 500, não substituir a validação da tela.
 *
 * @param {object} values objeto de entrada, modificado no lugar
 */
function normalizeCpfInObject(values) {
  if (!("cpf" in values)) return;

  const normalized = normalizeCpf(values.cpf);
  if (!isCpfLength(normalized)) {
    throw new ValidationError({
      message: `O CPF deve ter ${CPF_LENGTH} dígitos.`,
      action: "Confira o número digitado, incluindo os zeros à esquerda.",
    });
  }

  values.cpf = normalized;
}

/**
 * Anula cadastros **abandonados** que colidem com os dados de um novo cadastro.
 *
 * ## O problema que isto resolve
 *
 * O cadastro grava a linha em `users` **antes** da ativação. Se a pessoa não
 * ativa (link perdido, token expirado — a validade é de 1 hora) e tenta se
 * cadastrar de novo, as três validações de unicidade a barram: email, CPF e
 * username. Ela fica permanentemente travada, e não há saída no produto:
 *
 *  - a mensagem de erro do link expirado manda "faça um novo cadastro", que é
 *    exatamente o que o sistema recusa;
 *  - reenviar o e-mail não resolve o caso mais provável, que é **ter digitado o
 *    email errado** — o endereço não existe, então nenhum e-mail chega;
 *  - e o CPF é único, então trocar de email não contorna.
 *
 * Anular o registro abandonado é a única saída que devolve o acesso: o CPF e o
 * username voltam a estar livres e a pessoa recomeça do zero.
 *
 * ## Quando é seguro anular (as três condições, juntas)
 *
 * 1. **Nunca foi ativado** — `features` não contém `create:session`. Ativação é
 *    o que concede as permissões; sem ela a conta nunca produziu conteúdo, não
 *    tem organização, post, seguidor nem sessão. É a diferença entre apagar um
 *    cadastro e apagar a conta de alguém.
 * 2. **Não existe token válido** (de nenhuma finalidade) — token não usado e não
 *    vencido significa intenção recente. Nesse caso a conta tem dono ativo e a
 *    resposta continua sendo "já está sendo utilizado"; destruí-la roubaria a
 *    ativação de quem só está um pouco atrasado.
 * 3. **Nunca houve token de outra finalidade** — um token de redefinição de
 *    senha, mesmo vencido, prova que alguém foi além do cadastro: pediu troca de
 *    senha sabendo **email e CPF**, e o pedido chegou por e-mail. O estado do
 *    token não importa; o que importa é que ele existiu. Sem esta condição, um
 *    cadastro abandonado **com pedido de reset** era anulado e outra pessoa
 *    tomava o CPF.
 *
 * Fora dessas condições nada é apagado, e a validação de unicidade responde o
 * 400 de sempre.
 *
 * ## Por que só o token de ativação libera
 *
 * Um token de **ativação** vencido é o abandono normal: a pessoa se cadastrou e
 * não clicou no link (ou digitou o e-mail errado, e o link nunca chegou) — é
 * exatamente o caso que a anulação existe para destravar. Qualquer outro tipo de
 * token é sinal de engajamento que o cadastro sozinho não produz.
 *
 * ## Por que aqui, e não numa rota
 *
 * Roda no início de `create` para que **todo** caminho de criação tenha o mesmo
 * comportamento (rota e `tests/orchestrator`), e para que as validações de
 * unicidade continuem sendo a única autoridade sobre conflito — depois da
 * anulação, elas decidem sozinhas, sem caso especial na rota.
 *
 * @param {{ email: string, cpf: string, username: string }} keys valores já
 *   normalizados (o chamador normaliza antes).
 * @returns {Promise<Array<{id: string, username: string, email: string}>>} os
 *   cadastros anulados (vazio quando não havia nada a anular).
 */
async function annulAbandonedRegistrations({ email, cpf, username }) {
  const results = await database.query({
    text: `
      WITH abandoned AS (
        SELECT u.id
        FROM users u
        WHERE (
            lower(u.email) = lower($1)
            OR u.cpf = $2
            OR lower(u.username) = lower($3)
          )
          AND NOT ('create:session' = ANY (u.features))
          AND NOT EXISTS (
            SELECT 1
            FROM user_activation_tokens t
            WHERE t.user_id = u.id
              AND t.used_at IS NULL
              AND t.expires_at > now()
          )
          /* Qualquer token que NÃO seja de ativação — em qualquer estado — mantém
             o cadastro. Um pedido de redefinição de senha (mesmo vencido, mesmo já
             usado) só acontece com quem sabe email e CPF, e chega por e-mail: é
             sinal de dono engajado, e apagar destruiria um cadastro legítimo. Sem
             esta condição, um cadastro abandonado com reset pendente era anulado e
             outra pessoa tomava o CPF. */
          AND NOT EXISTS (
            SELECT 1
            FROM user_activation_tokens t
            WHERE t.user_id = u.id
              AND t.purpose <> 'activation'
          )
      ),
      /* 'sessions' e 'user_activation_tokens' não têm FK para 'users' (foram
         criadas sem a constraint), então apagar o usuário deixaria as duas
         tabelas com linhas órfãs. A remoção é explícita. */
      cleared_tokens AS (
        DELETE FROM user_activation_tokens WHERE user_id IN (SELECT id FROM abandoned)
      ),
      cleared_sessions AS (
        DELETE FROM sessions WHERE user_id IN (SELECT id FROM abandoned)
      )
      DELETE FROM users WHERE id IN (SELECT id FROM abandoned)
      RETURNING id, username, email
    `,
    values: [email ?? null, cpf ?? null, username ?? null],
  });

  if (results.rowCount > 0) {
    // Visível no log de propósito: apagar registro é irreversível, e este é o
    // único ponto do sistema que faz isso sem um humano pedindo.
    console.info(
      `[cadastro] ${results.rowCount} cadastro(s) nunca ativado(s) anulado(s) para liberar novo cadastro:`,
      results.rows.map((row) => `${row.username} <${row.email}>`).join(", "),
    );
  }

  return results.rows;
}

/**
 * Apaga uma conta **por completo**, pelo email — ação de administrador.
 *
 * Diferente de `annulAbandonedRegistrations`: ali só sai cadastro que nunca foi
 * ativado e sem sinal de dono; aqui a intenção é remover tudo, inclusive o
 * usuário ativo que pediu exclusão ou a conta de teste que precisa sair do
 * banco.
 *
 * ## Por que não é só `DELETE FROM users`
 *
 * As tabelas que apontam para `users` dividem-se em três grupos, e nenhum deles
 * resolve sozinho:
 *
 * - `ON DELETE CASCADE` — apagaria sozinho, mas às vezes conteúdo de terceiros
 *   (comentários num post do usuário, respostas a ele);
 * - `NO ACTION` — o `DELETE` falharia com violação de FK e o operador receberia
 *   um 500 sem saber o que fazer;
 * - `SET NULL` — preserva o registro apontando para ninguém, que é o desejado
 *   em pedido pago e em obra do estúdio.
 *
 * O que é **recusado** (com mensagem dizendo o que fazer antes):
 * - ser o próprio usuário que chama;
 * - conta com `read:admin` (evita perder o último administrador);
 * - conta que é **titular de um estúdio** sem dizer o que fazer com ele: um
 *   estúdio não pode ficar sem responsável (`owner_id` é `NOT NULL`) e as obras
 *   pertencem a ele, não à pessoa. Por isso a exclusão exige escolher uma das
 *   duas saídas — `studioAction: "delete"` (com `confirmStudioSlug`, apaga o
 *   estúdio e as obras) ou `studioAction: "transfer"` (com `transferToUserId`,
 *   passa a titularidade a outro membro ativo). A recusa em si não muda nada no
 *   banco: as duas ações rodam **na mesma transação** da exclusão;
 * - conta que **criou reuniões** de estúdio (`meetings.created_by` é `NOT NULL`
 *   e a reunião pertence ao estúdio, não à pessoa). Excluir o estúdio resolve:
 *   as reuniões dele caem por `CASCADE` antes desta checagem;
 * - conta que aplicou **moderação** (`moderation_actions.moderator_id` é
 *   `NOT NULL` e é trilha de auditoria).
 *
 * O que é **apagado**: o que é do usuário (posts — inclusive as respostas de
 * terceiros a eles, que ficariam órfãs —, comentários, curtidas, seguidores,
 * papéis, contatos, portfólio, matrículas, presenças, notificações, sessões e
 * tokens) e o que apontaria para um `id` inexistente depois (conversas de que
 * ele participa, denúncias e bloqueios contra ele). O que é de outra pessoa ou
 * do estúdio fica: `games.owner_id`, `books.owner_id` e `boardgames.owner_id`
 * são `SET NULL`; pedidos pagos mantêm o histórico com `buyer_id` nulo.
 *
 * Roda em transação: ou sai tudo, ou não sai nada. O log `console.info` existe
 * porque a ação é irreversível e não há desfazer.
 */
async function purgeByEmail(email, { performedByUserId, studioAction, confirmStudioSlug, transferToUserId } = {}) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new ValidationError({ message: "Informe o email da conta a ser excluída." });
  }

  return database.transaction(async (client) => {
    const found = await client.query({
      text: `SELECT id, username, email, features FROM users WHERE lower(email) = $1 LIMIT 1`,
      values: [normalizedEmail],
    });

    if (found.rowCount === 0) {
      throw new NotFoundError({
        message: "O email informado não foi encontrado no sistema.",
        action: "Confira o email digitado — a exclusão não alterou nada.",
      });
    }

    const target = found.rows[0];

    if (target.id === performedByUserId) {
      throw new ValidationError({
        message: "Você não pode excluir a própria conta por esta tela.",
        action: "Peça a outro administrador para fazer a exclusão.",
      });
    }

    if ((target.features ?? []).includes("read:admin")) {
      throw new ValidationError({
        message: "Contas de administrador não podem ser excluídas por aqui.",
        action: "Remova a feature `read:admin` da conta antes de excluí-la.",
      });
    }

    const studios = await client.query({
      text: `SELECT id, name, slug FROM organizations WHERE owner_id = $1 ORDER BY name ASC`,
      values: [target.id],
    });

    // Estúdio do titular: a exclusão da conta **exige** uma decisão explícita.
    // Deixar seguir em frente deixaria um estúdio sem ninguém que possa
    // administrá-lo (`owner_id` é NOT NULL e não há "sem dono"), então as duas
    // saídas são excluir o estúdio e as obras ou passar a titularidade a outro
    // membro — e ambas têm confirmação própria.
    let studioOutcome = null;

    if (studios.rowCount > 0) {
      const studio = studios.rows[0];

      if (studioAction === "delete") {
        const expected = String(confirmStudioSlug ?? "").trim();
        if (expected !== studio.slug) {
          throw new ValidationError({
            message: "A confirmação do estúdio não corresponde ao endereço dele.",
            action: `Digite exatamente "${studio.slug}" para confirmar a exclusão do estúdio e das obras.`,
          });
        }

        // Recebe o cliente da transação: estúdio e conta saem juntos ou não sai
        // nada. Sem isso, um erro na exclusão da conta deixaria o estúdio já
        // apagado (e as obras junto) sem desfazer.
        const deletion = await organization.deleteWithWorks(studio.id, { client });
        studioOutcome = { action: "delete", ...deletion };
      } else if (studioAction === "transfer") {
        const transfer = await organization.transferOwnership(studio.id, {
          fromUserId: target.id,
          toUserId: transferToUserId,
          actorId: performedByUserId,
          client,
        });
        studioOutcome = { action: "transfer", ...transfer };
      } else {
        throw new ValidationError({
          message: `A conta é titular do estúdio "${studio.name}".`,
          action:
            "Escolha excluir o estúdio e as obras (`studio_action: delete`) ou transferir a responsabilidade para outro membro (`studio_action: transfer`).",
        });
      }
    }

    const meetings = await client.query({
      text: `SELECT count(*)::int AS total FROM meetings WHERE created_by = $1`,
      values: [target.id],
    });

    if (meetings.rows[0].total > 0) {
      throw new ValidationError({
        message: `A conta criou ${meetings.rows[0].total} reunião(ões) de estúdio.`,
        action: "As reuniões pertencem ao estúdio; exclua-as ou transfira-as antes de remover a conta.",
      });
    }

    const moderation = await client.query({
      text: `SELECT count(*)::int AS total FROM moderation_actions WHERE moderator_id = $1`,
      values: [target.id],
    });

    if (moderation.rows[0].total > 0) {
      throw new ValidationError({
        message: "A conta possui histórico de moderação e não pode ser excluída.",
        action: "O histórico é trilha de auditoria; ele precisa ser preservado.",
      });
    }

    // Posts do usuário + todas as respostas encadeadas a eles. Sem isso, uma
    // resposta de terceiro (`parent_post_id`, NO ACTION) impediria o DELETE e a
    // mensagem de erro seria violação de FK, não uma explicação.
    await client.query({
      text: `
        CREATE TEMP TABLE purge_posts ON COMMIT DROP AS
        WITH RECURSIVE tree AS (
          SELECT id FROM posts WHERE author_id = $1
          UNION
          SELECT p.id FROM posts p JOIN tree t ON p.parent_post_id = t.id
        )
        SELECT id FROM tree
      `,
      values: [target.id],
    });

    // Linhas que apontam para os posts e não caem por cascade.
    await client.query({ text: `DELETE FROM post_notifications WHERE post_id IN (SELECT id FROM purge_posts)` });
    await client.query({ text: `DELETE FROM post_likes WHERE post_id IN (SELECT id FROM purge_posts)` });

    const commentsOnDoomedPosts = await client.query({
      text: `DELETE FROM comments WHERE post_id IN (SELECT id FROM purge_posts) RETURNING id`,
    });

    // As respostas apontam para o post pai por `parent_post_id` (NO ACTION), e
    // o Postgres não garante a ordem de exclusão dentro de um mesmo DELETE:
    // soltar o vínculo antes evita a violação.
    await client.query({ text: `UPDATE posts SET parent_post_id = NULL WHERE id IN (SELECT id FROM purge_posts)` });

    const removedPosts = await client.query({
      text: `DELETE FROM posts WHERE id IN (SELECT id FROM purge_posts) RETURNING id`,
    });

    const removedComments = await client.query({
      text: `DELETE FROM comments WHERE author_id = $1 RETURNING id`,
      values: [target.id],
    });

    // Restos NO ACTION do usuário (o resto sai por CASCADE no DELETE final).
    const removedLikes = await client.query({
      text: `DELETE FROM post_likes WHERE user_id = $1 RETURNING post_id`,
      values: [target.id],
    });

    await client.query({
      text: `DELETE FROM post_notifications WHERE user_id = $1 OR source_user_id = $1`,
      values: [target.id],
    });

    await client.query({
      text: `DELETE FROM user_followers WHERE lead_user_id = $1 OR follower_id = $1`,
      values: [target.id],
    });

    await client.query({ text: `DELETE FROM org_followers WHERE follower_id = $1`, values: [target.id] });
    await client.query({ text: `DELETE FROM org_members WHERE member_id = $1`, values: [target.id] });
    await client.query({ text: `DELETE FROM user_roles WHERE user_id = $1`, values: [target.id] });
    await client.query({ text: `DELETE FROM users_contacts WHERE user_id = $1`, values: [target.id] });

    // Conversa em que ele é parte: sem FK (identidade polimórfica), ficaria uma
    // thread sem mensagens no inbox da outra pessoa. `messages` e
    // `conversation_reads` caem por CASCADE.
    const removedConversations = await client.query({
      text: `
        DELETE FROM conversations
        WHERE (party_a_type = 'user' AND party_a_id = $1)
           OR (party_b_type = 'user' AND party_b_id = $1)
        RETURNING id
      `,
      values: [target.id],
    });

    // Denúncias e bloqueios contra a conta: `target_id` é texto sem FK e
    // apontaria para um usuário que deixa de existir.
    await client.query({ text: `DELETE FROM reports WHERE target_type = 'user' AND target_id = $1::text`, values: [target.id] });
    await client.query({ text: `DELETE FROM moderation_actions WHERE target_type = 'user' AND target_id = $1::text`, values: [target.id] });

    // `sessions` e `user_activation_tokens` foram criadas sem FK para `users`
    // (ver `annulAbandonedRegistrations`), então a limpeza é explícita.
    const removedSessions = await client.query({
      text: `DELETE FROM sessions WHERE user_id = $1 RETURNING id`,
      values: [target.id],
    });

    await client.query({ text: `DELETE FROM user_activation_tokens WHERE user_id = $1`, values: [target.id] });

    const removedUser = await client.query({
      text: `DELETE FROM users WHERE id = $1 RETURNING id, username, email`,
      values: [target.id],
    });

    // Duas exclusões simultâneas da mesma conta: a segunda espera o commit da
    // primeira e então não apaga linha nenhuma. Sem esta guarda, `rows[0]` seria
    // `undefined` e o erro apareceria como 500 (TypeError no log), quando a
    // resposta correta é "não existe mais".
    if (removedUser.rowCount === 0) {
      throw new NotFoundError({
        message: "A conta já foi excluída por outra operação.",
        action: "Atualize a página — não há nada mais a remover.",
      });
    }

    const summary = {
      user: removedUser.rows[0],
      studio: studioOutcome,
      removed: {
        // A exclusão do estúdio leva junto os posts publicados em nome dele
        // (inclusive os do próprio usuário, que a CTE abaixo já não encontra).
        posts: removedPosts.rowCount + (studioOutcome?.removed?.posts ?? 0),
        // Dois grupos: os comentários que estavam nos posts apagados (de
        // qualquer autor) e os comentários do usuário em posts que continuam.
        comments: commentsOnDoomedPosts.rowCount + removedComments.rowCount + (studioOutcome?.removed?.comments ?? 0),
        post_likes: removedLikes.rowCount,
        conversations: removedConversations.rowCount,
        sessions: removedSessions.rowCount,
      },
    };

    // Irreversível e sem desfazer: o registro fica no log do servidor.
    console.info(`[admin] conta excluída definitivamente: ${summary.user.username} <${summary.user.email}>`, summary.removed);

    return summary;
  });
}

async function create(userInputValues) {
  normalizeUsernameInObject(userInputValues);
  normalizeCpfInObject(userInputValues);

  // Libera cadastro abandonado antes de checar unicidade — assim email, CPF e
  // username de um registro nunca ativado não bloqueiam quem quer recomeçar
  // (ver `annulAbandonedRegistrations`).
  await annulAbandonedRegistrations({
    email: userInputValues.email,
    cpf: userInputValues.cpf,
    username: userInputValues.username,
  });

  await validateUniqueUsename(userInputValues.username);
  await validateUniqueEmail(userInputValues.email);
  await validateUniqueCPF(userInputValues.cpf);
  await hashPasswordInObject(userInputValues);
  injectDefaultFeaturesInObject(userInputValues);

  const newUser = await runInsertQuery(userInputValues);
  return secureUserInterface(newUser);

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      Insert into
        users (
          username,
          email,
          password,
          cpf,
          birth_date,
          features,
          resumo,
          visibility,
          bio)
      values
        ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      returning
        *`,
      values: [
        userInputValues.username,
        userInputValues.email,
        userInputValues.password,
        userInputValues.cpf,
        userInputValues.birth_date,
        userInputValues.features,
        userInputValues.resumo,
        userInputValues.visibility || "public",
        userInputValues.bio,
      ],
    });
    return results.rows[0];
  }

  function injectDefaultFeaturesInObject(userInputValues) {
    userInputValues.features = ["read:activation_token"];
  }
}

async function update(username, userInputValues) {
  // O username usado para LOCALIZAR o usuário também passa pela forma canônica:
  // uma URL antiga com espaço no fim continua encontrando o registro, em vez de
  // responder 404.
  const currentUser = await findOneByUsername(normalizeUsername(username));
  if ("username" in userInputValues) {
    normalizeUsernameInObject(userInputValues);
    await validateUniqueUsename(userInputValues.username);
  }
  if ("email" in userInputValues) {
    await validateUniqueEmail(userInputValues.email);
  }
  if ("cpf" in userInputValues) {
    normalizeCpfInObject(userInputValues);
    await validateUniqueCPF(userInputValues.cpf);
  }
  if ("birth_date" in userInputValues) {
    validateBirthDate(userInputValues.birth_date);
  }
  if ("password" in userInputValues) {
    await hashPasswordInObject(userInputValues);
  }
  const userWithNewValues = {
    ...currentUser,
    ...userInputValues,
  };
  const updatedUser = await runUpdatedQuery(userWithNewValues);
  return updatedUser;
}

async function findOneById(id) {
  const userFound = await runSelectQuery(id);
  return userFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
        select
          id,
          username,
          email,
          cpf,
          features,
          reputation,
          resumo,
          bio,
          visibility,
          background_image,
          avatar_image,
          created_at,
          updated_at
        from
          users u
        where
          id = $1
        limit
          1`,
      values: [id],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O id informado não foi encontrado no sistema.",
        action: "Verifique se o id foi digitado corretamente",
      });
    }

    return results.rows[0];
  }
}

async function findOneByUsername(username) {
  const userFound = await runSelectQuery(normalizeUsername(username));
  return userFound;

  async function runSelectQuery(username) {
    const results = await database.query({
      text: `
        select
          u.id,
          u.username,
          u.email,
          u.updated_at,
          u.created_at,
          ui.secure_url as avatar_image,
          u.cpf,
          u.password,
          u.features,
          u.reputation,
          u.resumo,
          u.bio,
          u.visibility,
          ub.secure_url as background_image,
          COALESCE(f.followers_count, 0) AS followers_count,
          COALESCE(f2.following_count,0) as following_count,
          COALESCE(p.posts_count,0) as posts_count
        from
          users u
          -- Seguidores do usuário
          LEFT JOIN (
            SELECT
              lead_user_id,
              COUNT(*) AS followers_count
            FROM user_followers
            GROUP BY lead_user_id
          ) f ON f.lead_user_id = u.id
          -- usuário seguindo
          LEFT JOIN (
            SELECT
              follower_id,
              COUNT(*) AS following_count
            FROM user_followers
            GROUP BY follower_id
          ) f2 ON f2.follower_id = u.id
          -- Posts do Usuario
          LEFT JOIN (
            SELECT
              author_id,
              COUNT(*) AS posts_count
            FROM posts
            GROUP BY author_id
          ) p ON p.author_id = u.id
          -- busca imagens
          left join uploaded_images ui on ui.id = u.avatar_image
          left join uploaded_images ub on ub.id = u.background_image
        where
          LOWER(u.username) = LOWER($1)
        limit
          1`,
      values: [username],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O username informado não foi encontrado no sistema.",
        action: "Verifique se o username foi digitado corretamente",
      });
    }

    return results.rows[0];
  }
}

function secureUserInterface(selectedUser) {
  if (!selectedUser) {
    return;
  }

  return {
    id: selectedUser.id,
    username: selectedUser.username,
    email: selectedUser.email,
    updated_at: selectedUser.updated_at,
    created_at: selectedUser.created_at,
    followers_count: selectedUser.followers_count,
    following_count: selectedUser.following_count,
    posts_count: selectedUser.posts_count,
    features: selectedUser.features,
    reputation: selectedUser.reputation,
    resumo: selectedUser.resumo,
    bio: selectedUser.bio,
    visibility: selectedUser.visibility,
    avatar_image: selectedUser.avatar_image,
    background_image: selectedUser.background_image,
  };
}

async function findOneByUsernameSecured(username) {
  const user = await findOneByUsername(username);
  return secureUserInterface(user);
}

async function findOneByEmail(email) {
  const userFound = await runSelectQuery(email);
  return userFound;

  async function runSelectQuery(email) {
    const results = await database.query({
      text: `
        select
          *
        from
          users u
        where
          LOWER(u.email) = LOWER($1)
        limit
          1`,
      values: [email],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "O email informado não foi encontrado no sistema.",
        action: "Verifique se o email foi digitado corretamente",
      });
    }

    return results.rows[0];
  }
}

function validateBirthDate(birthDate) {
  if (Number.isNaN(birthDate.getTime())) {
    throw new ValidationError({
      message: "Data de nascimento inválida.",
      action: "Verifique se a data de nascimento foi digitada corretamente",
    });
  }
}

async function validateUniqueEmail(email) {
  const results = await database.query({
    text: `
      select email
      from users u
      where LOWER(u.email) = LOWER($1)`,
    values: [email],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "O email informado já está sendo utilizado.",
      action: "Utilize outro email para esta operação.",
    });
  }
}

async function validateUniqueUsename(username) {
  // A comparação é `LOWER` dos dois lados, então normalizar o valor procurado
  // faz "Henrique " e "Henrique" serem vistos como o MESMO nome — sem isso, o
  // segundo cadastro passaria pela validação e criaria um perfil inalcançável.
  const results = await database.query({
    text: `
      select username
      from users u
      where LOWER(u.username) = LOWER($1)`,
    values: [normalizeUsername(username)],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "O usuario informado já está sendo utilizado.",
      action: "Utilize outro username para esta operação.",
    });
  }
}

async function validateUniqueCPF(cpf) {
  const results = await database.query({
    text: `
      select cpf
      from users u
      where u.cpf = $1`,
    values: [cpf],
  });
  if (results.rowCount > 0) {
    throw new ValidationError({
      message: "O cpf informado já está sendo utilizado.",
      action: "Utilize outro cpf para esta operação.",
    });
  }
}

async function hashPasswordInObject(userInputValues) {
  const hashedPassword = await password.hash(userInputValues.password);
  userInputValues.password = hashedPassword;
}

async function setFeatures(userId, features) {
  const updatedUser = await runUpdatedQuery(userId, features);
  return updatedUser;

  async function runUpdatedQuery(userId, features) {
    const results = await database.query({
      text: `
      update
        users
      set
        features = $2,
        updated_at = timezone('utc',now())
      where
        id = $1
      returning
        *
      `,
      values: [userId, features],
    });
    return results.rows[0];
  }
}

async function addFeatures(userId, features) {
  const updatedUser = await runUpdatedQuery(userId, features);
  return updatedUser;

  async function runUpdatedQuery(userId, features) {
    const results = await database.query({
      text: `
      update
        users
      set
        features = array_cat(features,$2),
        updated_at = timezone('utc',now())
      where
        id = $1
      returning
        *
      `,
      values: [userId, features],
    });
    return results.rows[0];
  }
}

async function isFollowingUser(followerId, leaderId) {
  const results = await database.query({
    text: `
      SELECT EXISTS (
        SELECT 1 FROM user_followers
        WHERE follower_id = $1 AND lead_user_id = $2
      ) AS is_following
      `,
    values: [followerId, leaderId],
  });
  return results.rows[0].is_following;
}

async function runUpdatedQuery(userWithNewValues) {
  const results = await database.query({
    text: `
      update
        users
      set
        username = $2,
        email = $3,
        password = $4,
        cpf = $5,
        resumo = $6,
        bio = $7,
        visibility= $8,
        updated_at = timezone('utc',now())
      where
        id = $1
      returning
        *
    `,
    values: [
      userWithNewValues.id,
      userWithNewValues.username,
      userWithNewValues.email,
      userWithNewValues.password,
      userWithNewValues.cpf,
      userWithNewValues.resumo,
      userWithNewValues.bio,
      userWithNewValues.visibility,
    ],
  });
  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Usuario não encontrado.",
      action: "verifique se os dados enviados estão corretos.",
    });
  }

  return results.rows[0];
}

const DEFAULT_MEMBERS_LIMIT = 20;
const MAX_MEMBERS_LIMIT = 50;
const MAX_MEMBERS_SEARCH_LENGTH = 64;

// O cursor é keyset (created_at + id) para a paginação ser estável mesmo
// quando novos membros entram — ORDER BY RANDOM() (comportamento antigo)
// não permite paginar sem repetir/pular registros.
function encodeMembersCursor(row) {
  return `${row.created_at_cursor}|${row.id}`;
}

function decodeMembersCursor(cursor) {
  if (typeof cursor !== "string") {
    return null;
  }

  const separatorIndex = cursor.lastIndexOf("|");
  if (separatorIndex < 1) {
    return null;
  }

  const createdAt = cursor.slice(0, separatorIndex);
  const id = cursor.slice(separatorIndex + 1);
  if (!createdAt || !id) {
    return null;
  }

  return { createdAt, id };
}

function normalizeMembersLimit(limit) {
  const parsed = Number.parseInt(limit, 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_MEMBERS_LIMIT;
  }
  return Math.min(Math.max(parsed, 1), MAX_MEMBERS_LIMIT);
}

// Lista membros com busca e paginação por cursor.
// Retorna { items, total, hasMore, nextCursor }.
//
// `status` escolhe a população:
// - `"active"` (padrão) — contas ativadas (`create:session`), a mesma definição
//   que `serverStatus.getSummary` usa em `user_accounts`. Antes não havia filtro
//   nenhum: o diretório listava cadastro nunca ativado e o número em `/membros`
//   ficava maior que o da home (47 x 41 em produção), porque a home já contava
//   só ativados.
// - `"inactive"` — contas **travadas**: nunca ativadas e sem token de ativação
//   aproveitável (existe token, mas todos vencidos ou já usados). É o caso que
//   não sai sozinho: o e-mail/CPF/username continuam ocupados e a pessoa não
//   consegue ativar. Só administradores podem pedir esta lista (a rota faz o
//   gate); `email` e a data do token exposto só aparecem nela.
async function findUsers(options = {}) {
  const { userId, isfollowing, q } = options;
  const includeInactive = options.status === "inactive";
  const limit = normalizeMembersLimit(options.limit);
  const cursor = decodeMembersCursor(options.cursor);
  const search = typeof q === "string" ? q.trim().slice(0, MAX_MEMBERS_SEARCH_LENGTH) : "";

  // Colunas e junção que só a lista administrativa precisa: e-mail (para o
  // administrador reconhecer a conta) e o vencimento do último token de
  // ativação. Ficam fora da consulta pública de propósito — a lista normal não
  // pode pagar por elas.
  const inactiveSelect = includeInactive
    ? `,
        u.email,
        tok.expires_at AS activation_expires_at,
        EXISTS (
          SELECT 1
          FROM user_activation_tokens other
          WHERE other.user_id = u.id
            AND other.purpose <> 'activation'
        ) AS has_other_token`
    : "";

  const inactiveJoin = includeInactive
    ? `
        LEFT JOIN LATERAL (
          SELECT max(t.expires_at) AS expires_at
          FROM user_activation_tokens t
          WHERE t.user_id = u.id
            AND t.purpose = 'activation'
        ) tok ON true`
    : "";

  // `u.created_at::text` preserva os microssegundos — o driver `pg`
  // converte timestamptz para Date e perderia precisão no cursor.
  const baseQuery = `
      SELECT
        u.id,
        u.username,
        u.created_at,
        u.created_at::text AS created_at_cursor,
        u.reputation,
        ui.secure_url as avatar_image,
        u.resumo,
        u.bio,
        u.visibility,
        ub.secure_url as background_image,
        COALESCE(f.followers_count, 0) AS followers_count,
        COALESCE(p.posts_count, 0) AS posts_count,
        (uf.follower_id IS NOT NULL) AS is_following${inactiveSelect}
      FROM users u${inactiveJoin}
        -- Seguidores do usuário
        LEFT JOIN (
            SELECT
              lead_user_id,
              COUNT(*) AS followers_count
            FROM user_followers
            GROUP BY lead_user_id
          ) f ON f.lead_user_id = u.id
        --Posts do Usuario
        LEFT JOIN (
          SELECT
            author_id,
            COUNT(*) AS posts_count
          FROM posts
          GROUP BY author_id
        ) p ON p.author_id = u.id
        -- Verifica se o usuário atual segue esse usuário
        LEFT JOIN user_followers uf
          ON uf.lead_user_id = u.id
          AND uf.follower_id = $1::uuid
        --busca imagens
        left join uploaded_images ui
          on ui.id = u.avatar_image
        left join uploaded_images ub
          on ub.id = u.background_image
    `;

  // $1 ($1::uuid IS NULL) cobre o caso anônimo, em que o usuário não tem id.
  const conditions = ["($1::uuid IS NULL OR u.id <> $1::uuid)"];
  const whereValues = [userId ?? null];

  // População da lista. A condição de ativo é a MESMA de `serverStatus`
  // (`user_accounts`), e é por isso que o número de `/membros` e o da home
  // coincidem — antes divergiam em toda conta nunca ativada.
  if (includeInactive) {
    conditions.push(`
        NOT ('create:session' = ANY(u.features))
        AND EXISTS (
          SELECT 1
          FROM user_activation_tokens t
          WHERE t.user_id = u.id
            AND t.purpose = 'activation'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM user_activation_tokens t
          WHERE t.user_id = u.id
            AND t.purpose = 'activation'
            AND t.used_at IS NULL
            AND t.expires_at > now()
        )`);
  } else {
    conditions.push(`'create:session' = ANY(u.features)`);
  }

  if (isfollowing !== undefined) {
    const shouldFollow = isfollowing === true || isfollowing === "true";
    conditions.push(`${shouldFollow ? "" : "NOT "}EXISTS (
          SELECT 1
          FROM user_followers uf2
          WHERE uf2.lead_user_id = u.id
          AND uf2.follower_id = $1::uuid
        )`);
  }

  if (search) {
    whereValues.push(search);
    // strpos em vez de LIKE: o termo é literal, sem semântica de % e _.
    // Na lista de inativos o e-mail também é pesquisável — é o dado que o
    // administrador tem em mãos quando vai procurar a conta.
    const searchColumns = [
      `strpos(lower(u.username), lower($${whereValues.length})) > 0`,
      `strpos(lower(COALESCE(u.resumo, '')), lower($${whereValues.length})) > 0`,
    ];
    if (includeInactive) {
      searchColumns.push(`strpos(lower(u.email), lower($${whereValues.length})) > 0`);
    }

    conditions.push(`(
          ${searchColumns.join("\n          OR ")}
        )`);
  }

  const dataValues = [...whereValues];
  let cursorCondition = "";
  if (cursor) {
    dataValues.push(cursor.createdAt, cursor.id);
    cursorCondition = `
        AND (u.created_at, u.id) < ($${dataValues.length - 1}::timestamptz, $${dataValues.length}::uuid)`;
  }
  // Busca uma linha extra para saber se há próxima página sem heurística.
  dataValues.push(limit + 1);

  const totalResults = await database.query({
    text: `
      SELECT
        COUNT(*)::int AS total
      FROM users u
      WHERE
        ${conditions.join("\n        AND ")}`,
    values: whereValues,
  });

  const results = await database.query({
    text: `
      ${baseQuery}
      WHERE
        ${conditions.join("\n        AND ")}${cursorCondition}
      ORDER BY
        u.created_at DESC,
        u.id DESC
      LIMIT $${dataValues.length}`,
    values: dataValues,
  });

  const hasMore = results.rows.length > limit;
  const items = hasMore ? results.rows.slice(0, limit) : results.rows;
  const nextCursor = hasMore && items.length > 0 ? encodeMembersCursor(items[items.length - 1]) : null;

  return {
    items,
    total: totalResults.rows[0]?.total ?? 0,
    hasMore,
    nextCursor,
  };
}

async function addFollow(followerId, leaderId) {
  const result = await database.query({
    text: `
        INSERT INTO user_followers (follower_id, lead_user_id)
        VALUES ($1, $2)
        ON CONFLICT (follower_id, lead_user_id) DO NOTHING
        RETURNING 'followed' AS action, true as followed
      `,
    values: [followerId, leaderId],
  });

  if (result.rowCount === 0) {
    return { followed: "true", action: "already_following" };
  }
  await notification.createUserNotification({
    user_id: leaderId,
    source_user_id: followerId,
    type: "new_follower",
  });
  return result.rows[0];
}

async function removeFollow(followerId, leaderId) {
  const result = await database.query({
    text: `
      DELETE FROM user_followers
      WHERE follower_id = $1 AND lead_user_id = $2
      RETURNING 'unfollowed' AS action, false as followed
    `,
    values: [followerId, leaderId],
  });

  if (result.rowCount === 0) {
    return { followed: "false", action: "not_following" };
  }

  return result.rows[0];
}

/**
 * URL pública do avatar do usuário (`uploaded_images.secure_url`), ou null.
 *
 * `users.avatar_image` guarda o **id** da imagem, não a URL — a webconferência
 * precisa da URL pronta para o cliente do Galene exibir. Fica aqui (e não numa
 * consulta solta na rota) porque é a mesma resolução usada por
 * `pages/api/v1/user/index.js`.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
async function findAvatarUrl(userId) {
  const results = await database.query({
    text: `
      select
        ui.secure_url
      from
        users u
        left join uploaded_images ui on ui.id = u.avatar_image
      where
        u.id = $1
      limit
        1`,
    values: [userId],
  });

  return results.rows[0]?.secure_url || null;
}

const user = {
  create,
  update,
  //permissions
  setFeatures,
  addFeatures,
  //registration lifecycle
  annulAbandonedRegistrations,
  purgeByEmail,
  //follow
  addFollow,
  removeFollow,
  //select
  findOneById,
  findOneByUsername,
  findOneByUsernameSecured,
  findOneByEmail,
  findUsers,
  isFollowingUser,
  findAvatarUrl,
  //Security
  secureUserInterface,
};

export default user;
