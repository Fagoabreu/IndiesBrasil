import { NotFoundError } from "@/infra/errors";
import database from "infra/database";

async function createUserNotification(userInputValues) {
  const newNotification = await runInsertQuery(userInputValues);
  return newNotification;

  async function runInsertQuery(userInputValues) {
    const orgSlug = userInputValues.org_slug ?? "";
    const results = await database.query({
      text: `
      INSERT INTO user_notifications (
        user_id,
        type,
        source_user_id,
        org_slug,
        is_read,
        created_at
      )
      VALUES ($1,$2,$3,$4,false,NOW())
      ON CONFLICT (user_id, type, source_user_id, org_slug) DO NOTHING
      RETURNING *`,
      values: [userInputValues.user_id, userInputValues.type, userInputValues.source_user_id, orgSlug],
    });
    return results.rows[0] ?? null;
  }
}

async function createPostNotification(userInputValues) {
  const newNotification = await runInsertQuery(userInputValues);
  return newNotification;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      INSERT INTO post_notifications (
        user_id,
        type,
        source_user_id,
        post_id,
        is_read,
        created_at
      )
      VALUES ($1,$2,$3,$4,false,NOW())
      ON CONFLICT (user_id, source_user_id, post_id, type) DO NOTHING
      RETURNING *`,
      values: [userInputValues.user_id, userInputValues.type, userInputValues.source_user_id, userInputValues.post_id],
    });
    return results.rows[0] ?? null;
  }
}

async function updatePostNotification(userInputValues) {
  const updatedNotification = await runUpdateQuery(userInputValues);
  return updatedNotification;

  async function runUpdateQuery(userInputValues) {
    const results = await database.query({
      text: `
      UPDATE post_notifications
      SET is_read = $5
      WHERE
        user_id = $1
        AND type = $2
        AND source_user_id = $3
        AND post_id = $4
      RETURNING *`,
      values: [userInputValues.user_id, userInputValues.type, userInputValues.source_user_id, userInputValues.post_id, userInputValues.is_read],
    });
    return results.rows[0];
  }
}

async function updateUserNotification(userInputValues) {
  const updatedNotification = await runUpdateQuery(userInputValues);
  return updatedNotification;

  async function runUpdateQuery(userInputValues) {
    const orgSlug = userInputValues.org_slug ?? "";
    const results = await database.query({
      text: `
      UPDATE user_notifications
      SET is_read = $5
      WHERE
        user_id = $1
        AND type = $2
        AND source_user_id = $3
        AND org_slug = $4
      RETURNING *`,
      values: [userInputValues.user_id, userInputValues.type, userInputValues.source_user_id, orgSlug, userInputValues.is_read],
    });
    return results.rows[0];
  }
}

async function findPostNotificationByKey({ user_id, type, source_user_id, post_id }) {
  const notification = await runSelectQuery();
  return notification;

  async function runSelectQuery() {
    const results = await database.query({
      text: `
      SELECT *
      FROM post_notifications
      WHERE
        user_id = $1
        AND type = $2
        AND source_user_id = $3
        AND post_id = $4
    `,
      values: [user_id, type, source_user_id, post_id],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Notificação não encontrada no sistema.",
        action: "Verifique se os campos da chave primária estão corretos",
      });
    }
    return results.rows[0];
  }
}

async function findUserNotificationsByKey(userInputValues) {
  const notificationFound = await runSelectQuery(userInputValues);
  return notificationFound;

  async function runSelectQuery(userInputValues) {
    const results = await database.query({
      text: `
      Select *
      from user_notifications
      where user_id = $1
        AND type = $2
        AND source_user_id = $3
    `,
      values: [userInputValues.user_id, userInputValues.type, userInputValues.source_user_id],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Notificação não encontrada no sistema.",
        action: "Verifique se o id foi digitado corretamente",
      });
    }
    return results.rows[0];
  }
}

async function findPostNotificationsByUserId(userId) {
  const userFound = await runSelectQuery(userId);
  return userFound;

  async function runSelectQuery(userId) {
    const results = await database.query({
      text: `
        SELECT pn.*, nm.title, nm.message, u.username AS source_username
        FROM post_notifications pn
        LEFT JOIN notification_messages nm ON nm.type = pn.type
        LEFT JOIN users u ON u.id = pn.source_user_id
        WHERE pn.user_id = $1
        ORDER BY pn.created_at DESC
      `,
      values: [userId],
    });

    if (results.rowCount === 0) {
      return [];
    }

    return results.rows;
  }
}

async function findUserNotificationsByUserId(userId) {
  const userNotificationFound = await runSelectQuery(userId);
  return userNotificationFound;

  async function runSelectQuery(userId) {
    const results = await database.query({
      text: `
        SELECT un.*, nm.title, nm.message, u.username AS source_username,
          s.name AS studio_name
        FROM user_notifications un
        LEFT JOIN notification_messages nm ON nm.type = un.type
        LEFT JOIN users u ON u.id = un.source_user_id
        LEFT JOIN organizations s ON s.slug = un.org_slug
        WHERE un.user_id = $1
        ORDER BY un.created_at DESC
      `,
      values: [userId],
    });

    return results.rows;
  }
}

/* =========================================================
 * Notificações do estúdio (feed compartilhado entre membros)
 * ========================================================= */

async function createOrgNotification({ org_id, type, source_user_id, resource_type, resource_id, subject_title, recipient_role = "member" }) {
  const results = await database.query({
    text: `
      INSERT INTO org_notifications (
        org_id,
        type,
        source_user_id,
        resource_type,
        resource_id,
        subject_title,
        recipient_role
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    values: [org_id, type, source_user_id, resource_type, resource_id, subject_title, recipient_role],
  });

  return results.rows[0];
}

async function findOrgNotificationsByUserId(userId) {
  const results = await database.query({
    text: `
      SELECT
        onr.id,
        onr.org_id,
        onr.type,
        onr.source_user_id,
        onr.resource_type,
        onr.resource_id,
        onr.subject_title,
        onr.created_at,
        org.name AS org_name,
        org.slug AS org_slug,
        org_logo.secure_url AS org_logo_url,
        u.username AS source_username,
        (reads.user_id IS NOT NULL) AS is_read
      FROM org_notifications onr
      JOIN organizations org
        ON org.id = onr.org_id
      LEFT JOIN uploaded_images org_logo
        ON org_logo.id = org.img
      JOIN users u
        ON u.id = onr.source_user_id
      LEFT JOIN org_notification_reads reads
        ON reads.notification_id = onr.id AND reads.user_id = $1
      WHERE onr.source_user_id <> $1
        AND EXISTS (
          SELECT 1
          FROM org_members om
          WHERE om.org_id = onr.org_id
            AND om.member_id = $1
            AND om.status = 'active'
        )
        AND (
          onr.recipient_role = 'member'
          OR (
            onr.recipient_role = 'admin'
            AND (
              org.owner_id = $1
              OR EXISTS (
                SELECT 1 FROM org_roles r
                WHERE r.org_id = onr.org_id AND r.member_id = $1 AND r.role = 'admin'
              )
            )
          )
          OR (
            onr.recipient_role = 'owner'
            AND org.owner_id = $1
          )
        )
      ORDER BY onr.created_at DESC
    `,
    values: [userId],
  });

  return results.rows;
}

async function findOrgNotificationsByOrgId(orgId, userId) {
  const results = await database.query({
    text: `
      SELECT
        onr.id,
        onr.org_id,
        onr.type,
        onr.source_user_id,
        onr.resource_type,
        onr.resource_id,
        onr.subject_title,
        onr.created_at,
        org.name AS org_name,
        org.slug AS org_slug,
        org_logo.secure_url AS org_logo_url,
        u.username AS source_username,
        (reads.user_id IS NOT NULL) AS is_read
      FROM org_notifications onr
      JOIN organizations org
        ON org.id = onr.org_id
      LEFT JOIN uploaded_images org_logo
        ON org_logo.id = org.img
      JOIN users u
        ON u.id = onr.source_user_id
      LEFT JOIN org_notification_reads reads
        ON reads.notification_id = onr.id AND reads.user_id = $2
      WHERE onr.org_id = $1
        AND onr.source_user_id <> $2
      ORDER BY onr.created_at DESC
    `,
    values: [orgId, userId],
  });

  return results.rows;
}

async function markOrgNotificationRead(notificationId, userId) {
  const results = await database.query({
    text: `
      INSERT INTO org_notification_reads (notification_id, user_id)
      SELECT $1, $2
      WHERE EXISTS (
        SELECT 1
        FROM org_notifications onr
        JOIN org_members om
          ON om.org_id = onr.org_id
         AND om.member_id = $2
         AND om.status = 'active'
        WHERE onr.id = $1
      )
      ON CONFLICT (notification_id, user_id) DO NOTHING
      RETURNING *
    `,
    values: [notificationId, userId],
  });

  return results.rows[0] ?? null;
}

const notification = {
  createPostNotification,
  updatePostNotification,
  findPostNotificationByKey,
  findPostNotificationsByUserId,

  createUserNotification,
  updateUserNotification,
  findUserNotificationsByKey,
  findUserNotificationsByUserId,

  createOrgNotification,
  findOrgNotificationsByUserId,
  findOrgNotificationsByOrgId,
  markOrgNotificationRead,
};

export default notification;
