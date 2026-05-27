import database from "infra/database";
import { NotFoundError, ValidationError, ForbiddenError } from "infra/errors.js";

/* =========================================================
 * Helpers
 * ========================================================= */

/**
 * Gera um slug único a partir do nome do estúdio.
 * Usa o padrão: kebab-case + sufixo do UUID para evitar colisões.
 */
function generateSlug(name, id) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${id.slice(0, 8)}`;
}

/* =========================================================
 * Leitura
 * ========================================================= */

async function findAll({ page = 1, limit = 20, search = "" } = {}) {
  const offset = (page - 1) * limit;
  const results = await database.query({
    text: `
      SELECT
        o.id, o.slug, o.name, o.pitch, o.description, o.founded_at,
        o.banner_image_id, o.banner_video_url,
        o.created_at,
        ui_logo.secure_url  AS logo_url,
        ui_ban.secure_url   AS banner_url,
        u.username          AS owner_username,
        u.avatar_image      AS owner_avatar_image,
        COUNT(DISTINCT of2.follower_id) AS follower_count,
        COUNT(DISTINCT om.member_id)    AS member_count
      FROM organizations o
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN uploaded_images ui_ban  ON ui_ban.id  = o.banner_image_id
      LEFT JOIN users u   ON u.id = o.owner_id
      LEFT JOIN org_followers of2 ON of2.org_id = o.id
      LEFT JOIN org_members om    ON om.org_id   = o.id AND om.status = 'active'
      WHERE ($3 = '' OR o.name ILIKE '%' || $3 || '%' OR o.pitch ILIKE '%' || $3 || '%')
      GROUP BY o.id, ui_logo.secure_url, ui_ban.secure_url, u.username, u.avatar_image
      ORDER BY o.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    values: [limit, offset, search],
  });
  return results.rows;
}

async function findBySlug(slug) {
  const results = await database.query({
    text: `
      SELECT
        o.*,
        ui_logo.secure_url  AS logo_url,
        ui_ban.secure_url   AS banner_url,
        u.username          AS owner_username,
        u.avatar_image      AS owner_avatar_image,
        a.street, a.number, a.complement, a.neighborhood,
        a.city, a.state, a.zip_code, a.country,
        COUNT(DISTINCT of2.follower_id) AS follower_count
      FROM organizations o
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN uploaded_images ui_ban  ON ui_ban.id  = o.banner_image_id
      LEFT JOIN users u    ON u.id = o.owner_id
      LEFT JOIN addresses a ON a.id = o.address_id
      LEFT JOIN org_followers of2 ON of2.org_id = o.id
      WHERE o.slug = $1
      GROUP BY o.id, ui_logo.secure_url, ui_ban.secure_url,
               u.username, u.avatar_image,
               a.street, a.number, a.complement, a.neighborhood,
               a.city, a.state, a.zip_code, a.country
    `,
    values: [slug],
  });

  if (!results.rows[0]) {
    throw new NotFoundError({ message: `Estúdio "${slug}" não encontrado.` });
  }
  return results.rows[0];
}

async function findById(id) {
  const results = await database.query({
    text: `SELECT * FROM organizations WHERE id = $1`,
    values: [id],
  });
  if (!results.rows[0]) {
    throw new NotFoundError({ message: "Estúdio não encontrado." });
  }
  return results.rows[0];
}

/* =========================================================
 * Criação
 * ========================================================= */

async function create(ownerUser, data) {
  await validateOwnerHasNoStudio(ownerUser.id);

  // Gera o UUID antecipadamente para poder compor o slug na mesma query
  const idResult = await database.query({ text: `SELECT gen_random_uuid() AS id` });
  const newId = idResult.rows[0].id;
  const slug = generateSlug(data.name, newId);

  const result = await database.query({
    text: `
      INSERT INTO organizations (id, owner_id, name, slug, description, history, pitch, cnpj, founded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `,
    values: [
      newId,
      ownerUser.id,
      data.name,
      slug,
      data.description || null,
      data.history || null,
      data.pitch || null,
      data.cnpj || null,
      data.founded_at || null,
    ],
  });

  const org = result.rows[0];

  // Cria o endereço se fornecido
  if (data.address) {
    const addr = await createAddress(data.address);
    await database.query({
      text: `UPDATE organizations SET address_id = $1 WHERE id = $2`,
      values: [addr.id, org.id],
    });
    org.address_id = addr.id;
  }

  // Insere o criador como membro ativo
  await database.query({
    text: `INSERT INTO org_members (org_id, member_id, status) VALUES ($1, $2, 'active')`,
    values: [org.id, ownerUser.id],
  });

  // Concede a role de admin ao criador
  await database.query({
    text: `INSERT INTO org_roles (org_id, member_id, role, granted_by) VALUES ($1, $2, 'admin', $2)`,
    values: [org.id, ownerUser.id],
  });

  return org;
}

/* =========================================================
 * Atualização
 * ========================================================= */

async function update(slug, data) {
  const org = await findBySlug(slug);

  const fields = [];
  const values = [];
  let idx = 1;

  const updatable = ["name", "description", "history", "pitch", "cnpj", "founded_at", "banner_video_url", "twitch_channel", "youtube_channel_id"];
  for (const key of updatable) {
    if (key in data) {
      fields.push(`${key} = $${idx++}`);
      values.push(data[key]);
    }
  }

  if (fields.length > 0) {
    values.push(org.id);
    await database.query({
      text: `UPDATE organizations SET ${fields.join(", ")} WHERE id = $${idx}`,
      values,
    });
  }

  // Atualiza endereço
  if (data.address) {
    if (org.address_id) {
      await updateAddress(org.address_id, data.address);
    } else {
      const addr = await createAddress(data.address);
      await database.query({
        text: `UPDATE organizations SET address_id = $1 WHERE id = $2`,
        values: [addr.id, org.id],
      });
    }
  } else if (data.address === null && org.address_id) {
    await database.query({
      text: `UPDATE organizations SET address_id = NULL WHERE id = $1`,
      values: [org.id],
    });
    await deleteAddress(org.address_id);
  }

  return findBySlug(slug);
}

/* =========================================================
 * Imagens (logo e banner)
 * ========================================================= */

async function saveLogo(slug, imageId) {
  await database.query({
    text: `UPDATE organizations SET img = $1 WHERE slug = $2`,
    values: [imageId, slug],
  });
}

async function saveBanner(slug, imageId) {
  await database.query({
    text: `UPDATE organizations SET banner_image_id = $1 WHERE slug = $2`,
    values: [imageId, slug],
  });
}

/* =========================================================
 * Membros
 * ========================================================= */

async function findMembers(orgId) {
  const results = await database.query({
    text: `
      SELECT
        u.id, u.username, u.resumo AS display_name, ui.secure_url AS avatar_url,
        om.joined_at, om.status,
        array_agg(DISTINCT r.role::text) FILTER (WHERE r.role IS NOT NULL) AS roles
      FROM org_members om
      JOIN users u ON u.id = om.member_id
      LEFT JOIN uploaded_images ui ON ui.id = u.avatar_image
      LEFT JOIN org_roles r ON r.org_id = om.org_id AND r.member_id = om.member_id
      WHERE om.org_id = $1 AND om.status = 'active'
      GROUP BY u.id, u.username, u.resumo, ui.secure_url, om.joined_at, om.status
      ORDER BY om.joined_at
    `,
    values: [orgId],
  });
  return results.rows;
}

async function isMember(orgId, userId) {
  const result = await database.query({
    text: `SELECT 1 FROM org_members WHERE org_id = $1 AND member_id = $2 AND status = 'active'`,
    values: [orgId, userId],
  });
  return result.rows.length > 0;
}

async function isAdmin(orgId, userId) {
  const result = await database.query({
    text: `SELECT 1 FROM org_roles WHERE org_id = $1 AND member_id = $2 AND role = 'admin'`,
    values: [orgId, userId],
  });
  return result.rows.length > 0;
}

async function isOwner(org, userId) {
  return org.owner_id === userId;
}

async function removeMember(orgId, memberId) {
  await database.query({
    text: `UPDATE org_members SET status = 'removed' WHERE org_id = $1 AND member_id = $2`,
    values: [orgId, memberId],
  });
  await database.query({
    text: `DELETE FROM org_roles WHERE org_id = $1 AND member_id = $2`,
    values: [orgId, memberId],
  });
}

async function setMemberRole(orgId, memberId, role, grantedBy) {
  await database.query({
    text: `
      INSERT INTO org_roles (org_id, member_id, role, granted_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (org_id, member_id, role) DO NOTHING
    `,
    values: [orgId, memberId, role, grantedBy],
  });
}

async function revokeMemberRole(orgId, memberId, role) {
  await database.query({
    text: `DELETE FROM org_roles WHERE org_id = $1 AND member_id = $2 AND role = $3`,
    values: [orgId, memberId, role],
  });
}

/* =========================================================
 * Convites
 * ========================================================= */

async function createInvitation(orgId, invitedUserId, invitedBy, { role = "member", message = null } = {}) {
  // Verifica se já é membro
  const alreadyMember = await isMember(orgId, invitedUserId);
  if (alreadyMember) {
    throw new ValidationError({ message: "Usuário já é membro deste estúdio." });
  }

  const result = await database.query({
    text: `
      INSERT INTO org_invitations (org_id, invited_user_id, invited_by, role, message)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    values: [orgId, invitedUserId, invitedBy, role, message],
  });
  return result.rows[0];
}

async function findPendingInvitations(orgId) {
  const results = await database.query({
    text: `
      SELECT i.*, u.username AS invited_username, u2.username AS invited_by_username
      FROM org_invitations i
      JOIN users u  ON u.id  = i.invited_user_id
      JOIN users u2 ON u2.id = i.invited_by
      WHERE i.org_id = $1 AND i.status = 'pending'
      ORDER BY i.created_at DESC
    `,
    values: [orgId],
  });
  return results.rows;
}

async function findInvitationById(id) {
  const result = await database.query({
    text: `SELECT * FROM org_invitations WHERE id = $1`,
    values: [id],
  });
  if (!result.rows[0]) throw new NotFoundError({ message: "Convite não encontrado." });
  return result.rows[0];
}

async function findPendingInvitationForUser(orgId, userId) {
  const result = await database.query({
    text: `
      SELECT i.*, u.username AS invited_by_username
      FROM org_invitations i
      JOIN users u ON u.id = i.invited_by
      WHERE i.org_id = $1 AND i.invited_user_id = $2 AND i.status = 'pending'
      LIMIT 1
    `,
    values: [orgId, userId],
  });
  return result.rows[0] || null;
}

async function respondToInvitation(invitationId, userId, accept) {
  const inv = await findInvitationById(invitationId);

  if (inv.invited_user_id !== userId) {
    throw new ForbiddenError({ message: "Este convite não é para você." });
  }
  if (inv.status !== "pending") {
    throw new ValidationError({ message: "Este convite já foi respondido." });
  }

  const newStatus = accept ? "accepted" : "declined";

  await database.query({
    text: `UPDATE org_invitations SET status = $1, updated_at = now() WHERE id = $2`,
    values: [newStatus, invitationId],
  });

  if (accept) {
    // Insere como membro ativo
    await database.query({
      text: `
        INSERT INTO org_members (org_id, member_id, status)
        VALUES ($1, $2, 'active')
        ON CONFLICT (org_id, member_id) DO UPDATE SET status = 'active', joined_at = now()
      `,
      values: [inv.org_id, userId],
    });
    // Atribui a role do convite
    await setMemberRole(inv.org_id, userId, inv.role, inv.invited_by);
  }

  return { ...inv, status: newStatus };
}

async function cancelInvitation(invitationId, requestingUserId, org) {
  const inv = await findInvitationById(invitationId);
  if (inv.org_id !== org.id) throw new ForbiddenError({ message: "Convite não pertence a este estúdio." });

  const canCancel = inv.invited_by === requestingUserId || (await isAdmin(org.id, requestingUserId)) || org.owner_id === requestingUserId;
  if (!canCancel) throw new ForbiddenError({ message: "Sem permissão para cancelar este convite." });

  await database.query({
    text: `UPDATE org_invitations SET status = 'cancelled', updated_at = now() WHERE id = $1`,
    values: [invitationId],
  });
}

/* =========================================================
 * Follow / Unfollow
 * ========================================================= */

async function followOrg(orgId, userId) {
  await database.query({
    text: `INSERT INTO org_followers (org_id, follower_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    values: [orgId, userId],
  });
}

async function unfollowOrg(orgId, userId) {
  await database.query({
    text: `DELETE FROM org_followers WHERE org_id = $1 AND follower_id = $2`,
    values: [orgId, userId],
  });
}

async function isFollowing(orgId, userId) {
  const result = await database.query({
    text: `SELECT 1 FROM org_followers WHERE org_id = $1 AND follower_id = $2`,
    values: [orgId, userId],
  });
  return result.rows.length > 0;
}

async function findFollowing(userId, { page = 1, limit = 20, search = "" } = {}) {
  const offset = (page - 1) * limit;
  const results = await database.query({
    text: `
      SELECT
        o.id, o.slug, o.name, o.pitch, o.description, o.founded_at,
        o.banner_image_id, o.banner_video_url,
        o.created_at,
        ui_logo.secure_url  AS logo_url,
        ui_ban.secure_url   AS banner_url,
        u.username          AS owner_username,
        COUNT(DISTINCT of2.follower_id) AS follower_count,
        COUNT(DISTINCT om.member_id)    AS member_count
      FROM org_followers f
      JOIN organizations o ON o.id = f.org_id
      LEFT JOIN uploaded_images ui_logo ON ui_logo.id = o.img
      LEFT JOIN uploaded_images ui_ban  ON ui_ban.id  = o.banner_image_id
      LEFT JOIN users u   ON u.id = o.owner_id
      LEFT JOIN org_followers of2 ON of2.org_id = o.id
      LEFT JOIN org_members om    ON om.org_id   = o.id AND om.status = 'active'
      WHERE f.follower_id = $1
        AND ($4 = '' OR o.name ILIKE '%' || $4 || '%' OR o.pitch ILIKE '%' || $4 || '%')
      GROUP BY o.id, ui_logo.secure_url, ui_ban.secure_url, u.username
      ORDER BY o.created_at DESC
      LIMIT $2 OFFSET $3
    `,
    values: [userId, limit, offset, search],
  });
  return results.rows;
}

/* =========================================================
 * Transferência de responsabilidade
 * ========================================================= */

async function requestOwnershipTransfer(orgId, fromUserId, toUserId) {
  // Verifica que o destinatário é membro
  const targetIsMember = await isMember(orgId, toUserId);
  if (!targetIsMember) {
    throw new ValidationError({ message: "O destinatário precisa ser membro do estúdio antes de receber a responsabilidade." });
  }

  // Verifica que não há transferência pendente
  const existing = await database.query({
    text: `SELECT 1 FROM org_ownership_transfers WHERE org_id = $1 AND status = 'pending'`,
    values: [orgId],
  });
  if (existing.rows.length > 0) {
    throw new ValidationError({ message: "Já existe uma transferência pendente para este estúdio." });
  }

  const result = await database.query({
    text: `
      INSERT INTO org_ownership_transfers (org_id, from_user_id, to_user_id)
      VALUES ($1, $2, $3) RETURNING *
    `,
    values: [orgId, fromUserId, toUserId],
  });
  return result.rows[0];
}

async function respondToTransfer(transferId, userId, accept) {
  const result = await database.query({
    text: `SELECT * FROM org_ownership_transfers WHERE id = $1`,
    values: [transferId],
  });
  const transfer = result.rows[0];
  if (!transfer) throw new NotFoundError({ message: "Transferência não encontrada." });
  if (transfer.to_user_id !== userId) throw new ForbiddenError({ message: "Esta transferência não é para você." });
  if (transfer.status !== "pending") throw new ValidationError({ message: "Esta transferência já foi respondida." });

  const newStatus = accept ? "accepted" : "declined";
  await database.query({
    text: `UPDATE org_ownership_transfers SET status = $1, responded_at = now() WHERE id = $2`,
    values: [newStatus, transferId],
  });

  if (accept) {
    await database.query({
      text: `UPDATE organizations SET owner_id = $1 WHERE id = $2`,
      values: [userId, transfer.org_id],
    });
    // Garante que o novo dono tem role admin
    await setMemberRole(transfer.org_id, userId, "admin", userId);
  }
}

/* =========================================================
 * Validações
 * ========================================================= */

async function validateOwnerHasNoStudio(userId) {
  const result = await database.query({
    text: `SELECT 1 FROM organizations WHERE owner_id = $1`,
    values: [userId],
  });
  if (result.rows.length > 0) {
    throw new ValidationError({
      message: "Você já é responsável por um estúdio. Transfira a responsabilidade antes de criar um novo.",
    });
  }
}

/* =========================================================
 * Endereço (helper interno)
 * ========================================================= */

function normalizeZip(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  return digits.slice(0, 8) || null;
}

async function createAddress(addr) {
  const result = await database.query({
    text: `
      INSERT INTO addresses (street, number, complement, neighborhood, city, state, zip_code, country)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
    values: [
      addr.street || null,
      addr.number || null,
      addr.complement || null,
      addr.neighborhood || null,
      addr.city,
      addr.state,
      normalizeZip(addr.zip_code),
      addr.country || "Brasil",
    ],
  });
  return result.rows[0];
}

async function deleteAddress(addressId) {
  await database.query({
    text: `DELETE FROM addresses WHERE id = $1`,
    values: [addressId],
  });
}

async function updateAddress(addressId, addr) {
  const fields = ["street", "number", "complement", "neighborhood", "city", "state", "zip_code", "country"];
  const sets = [];
  const values = [];
  let idx = 1;
  for (const f of fields) {
    if (f in addr) {
      sets.push(`${f} = $${idx++}`);
      values.push(f === "zip_code" ? normalizeZip(addr[f]) : addr[f]);
    }
  }
  if (sets.length === 0) return;
  values.push(addressId);
  await database.query({
    text: `UPDATE addresses SET ${sets.join(", ")}, updated_at = now() WHERE id = $${idx}`,
    values,
  });
}

async function findContacts(orgId) {
  const result = await database.query({
    text: `
      SELECT oc.id, oc.contact_value, ct.icon_key, ct.icon_img, ct.id AS contact_type_id
      FROM organization_contacts oc
      JOIN contact_type ct ON ct.id = oc.contact_type_id
      WHERE oc.org_id = $1
      ORDER BY oc.id
    `,
    values: [orgId],
  });
  return result.rows;
}

async function createContact(orgId, contactTypeId, contactValue) {
  const result = await database.query({
    text: `
      INSERT INTO organization_contacts (org_id, contact_type_id, contact_value)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    values: [orgId, contactTypeId, contactValue.trim()],
  });
  return result.rows[0];
}

async function deleteContact(id, orgId) {
  const result = await database.query({
    text: `DELETE FROM organization_contacts WHERE id = $1 AND org_id = $2 RETURNING id`,
    values: [id, orgId],
  });
  if (!result.rowCount) {
    throw new NotFoundError({ message: "Contato não encontrado." });
  }
}

const organization = {
  findAll,
  findBySlug,
  findById,
  create,
  update,
  saveLogo,
  saveBanner,
  findMembers,
  isMember,
  isAdmin,
  isOwner,
  removeMember,
  setMemberRole,
  revokeMemberRole,
  createInvitation,
  findPendingInvitations,
  findPendingInvitationForUser,
  findInvitationById,
  respondToInvitation,
  cancelInvitation,
  followOrg,
  unfollowOrg,
  isFollowing,
  findFollowing,
  findContacts,
  createContact,
  deleteContact,
  requestOwnershipTransfer,
  respondToTransfer,
};

export default organization;
