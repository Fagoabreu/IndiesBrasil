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
        SELECT un.*, nm.title, nm.message, u.username AS source_username
        FROM user_notifications un
        LEFT JOIN notification_messages nm ON nm.type = un.type
        LEFT JOIN users u ON u.id = un.source_user_id
        WHERE un.user_id = $1
        ORDER BY un.created_at DESC
      `,
      values: [userId],
    });

    return results.rows;
  }
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
};

export default notification;
