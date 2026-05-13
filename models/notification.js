import { NotFoundError } from "@/infra/errors";
import database from "infra/database";

async function createUserNotification(userInputValues) {
  const newNotification = await runInsertQuery(userInputValues);
  return newNotification;

  async function runInsertQuery(userInputValues) {
    const results = await database.query({
      text: `
      INSERT INTO user_notifications (
        user_id,
        type,
        source_user_id,
        is_read,
        created_at
      )
      VALUES ($1,$2,$3,false,NOW())
      ON CONFLICT (user_id, source_user_id, type) DO NOTHING
      RETURNING *`,
      values: [userInputValues.user_id, userInputValues.type, userInputValues.source_user_id],
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
  const currentNotification = await findPostNotificationsById(userInputValues.id);
  const notificationWithNewValues = {
    ...currentNotification,
    ...userInputValues,
  };

  const updatedNotification = await runUpdateQuery(notificationWithNewValues);
  return updatedNotification;

  async function runUpdateQuery(userInputValues) {
    const results = await database.query({
      text: `
      Update post_notifications 
      set
        user_id=$1,
        type=$2,
        source_user_id=$3,
        post_id=$4,
        is_read=$5,
      where id=$6
      returning
        *`,
      values: [
        userInputValues.user_id,
        userInputValues.type,
        userInputValues.source_user_id,
        userInputValues.post_id,
        userInputValues.is_read,
        userInputValues.id,
      ],
    });
    return results.rows[0];
  }
}

async function updateUserNotification(userInputValues) {
  const currentNotification = await findUserNotificationsById(userInputValues.id);
  const notificationWithNewValues = {
    ...currentNotification,
    ...userInputValues,
  };

  const updatedNotification = await runUpdateQuery(notificationWithNewValues);
  return updatedNotification;

  async function runUpdateQuery(userInputValues) {
    const results = await database.query({
      text: `
      Update user_notifications 
      set
        user_id=$1,
        type=$2,
        source_user_id=$3,
        is_read=$4
      where id=$5
      returning
        *`,
      values: [userInputValues.user_id, userInputValues.type, userInputValues.source_user_id, userInputValues.is_read, userInputValues.id],
    });
    return results.rows[0];
  }
}

async function findPostNotificationsById(id) {
  const userFound = await runSelectQuery(id);
  return userFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
      Select *
      from post_notifications
      where id = $1
    `,
      values: [id],
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

async function findUserNotificationsById(id) {
  const notificationFound = await runSelectQuery(id);
  return notificationFound;

  async function runSelectQuery(id) {
    const results = await database.query({
      text: `
      Select *
      from user_notifications
      where id = $1
    `,
      values: [id],
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
      Select *
      from post_notifications
      left join notification_messages 
      on post_notifications.type = notification_messages.type
      where user_id = $1
    `,
      values: [userId],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Notificação não encontrada no sistema.",
        action: "Verifique se o id foi digitado corretamente",
      });
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
      Select *
      from user_notifications
      left join notification_messages 
      on user_notifications.type = notification_messages.type
      where user_id = $1
    `,
      values: [userId],
    });

    if (results.rowCount === 0) {
      throw new NotFoundError({
        message: "Notificação não encontrada no sistema.",
        action: "Verifique se o id foi digitado corretamente",
      });
    }

    return results.rows;
  }
}

const notification = {
  createPostNotification,
  updatePostNotification,
  findPostNotificationsById,
  findPostNotificationsByUserId,

  createUserNotification,
  updateUserNotification,
  findUserNotificationsById,
  findUserNotificationsByUserId,
};

export default notification;
