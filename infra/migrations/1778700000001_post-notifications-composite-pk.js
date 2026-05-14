exports.up = (pgm) => {
  const sql = `
    -- Remove a unique constraint adicionada pela migration anterior (já não necessária com PK composta).
    ALTER TABLE post_notifications
      DROP CONSTRAINT post_notifications_user_source_post_type_key;

    -- Remove a coluna id (e sua PK implícita), pois a identidade da linha passa a ser a chave composta.
    ALTER TABLE post_notifications
      DROP COLUMN id;

    -- Define a chave primária composta: cada combinação (usuário, autor, post, tipo) é única por natureza.
    ALTER TABLE post_notifications
      ADD PRIMARY KEY (user_id, source_user_id, post_id, type);
  `;

  pgm.sql(sql);
};
