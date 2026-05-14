exports.up = (pgm) => {
  const sql = `
    -- Remove duplicados para permitir a criação da constraint única.
    -- Mantém o registro mais recente por combinação de conflito.
    WITH ranked AS (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, source_user_id, post_id, type
          ORDER BY created_at DESC NULLS LAST, id DESC
        ) AS row_num
      FROM post_notifications
      WHERE source_user_id IS NOT NULL
        AND post_id IS NOT NULL
    )
    DELETE FROM post_notifications pn
    USING ranked r
    WHERE pn.id = r.id
      AND r.row_num > 1;

    ALTER TABLE post_notifications
      ADD CONSTRAINT post_notifications_user_source_post_type_key
      UNIQUE (user_id, source_user_id, post_id, type);
      
  `;

  pgm.sql(sql);
};
