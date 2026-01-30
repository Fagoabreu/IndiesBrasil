exports.up = (pgm) => {
  /**
   * 1. Adicionar campos do antigo portfolio em users
   */
  pgm.addColumns("users", {
    bio: {
      type: "text",
    },
    visibility: {
      type: "visibility_type",
      notNull: true,
      default: "public",
    },
    background_image: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
    },
  });

  /**
   * 2. Remover constraints que dependem de portfolios
   */
  pgm.dropConstraint("portfolio_formacao", "portfolio_formacao_portfolio_id_fkey");
  pgm.dropConstraint("portfolio_historico", "portfolio_historico_portfolio_id_fkey");
  pgm.dropConstraint("portfolio_medias", "portfolio_medias_portfolio_id_fkey");
  pgm.dropConstraint("portfolio_role_ref", "portfolio_role_ref_portfolio_id_fkey");
  pgm.dropConstraint("portfolio_tool_ref", "portfolio_tool_ref_portfolio_id_fkey");
  pgm.dropConstraint("notifications", "notifications_portfolio_id_fkey");

  /**
   * 3. Dropar colunas portfolio_id (int)
   */
  pgm.dropColumn("portfolio_formacao", "portfolio_id");
  pgm.dropColumn("portfolio_historico", "portfolio_id");
  pgm.dropColumn("portfolio_medias", "portfolio_id");
  pgm.dropColumn("portfolio_role_ref", "portfolio_id");
  pgm.dropColumn("portfolio_tool_ref", "portfolio_id");
  pgm.dropColumn("notifications", "portfolio_id");

  /**
   * 4. Criar colunas user_id (uuid)
   */
  pgm.addColumn("portfolio_formacao", {
    user_id: {
      type: "uuid",
      notNull: true,
    },
  });

  pgm.addColumn("portfolio_historico", {
    user_id: {
      type: "uuid",
      notNull: true,
    },
  });

  pgm.addColumn("portfolio_medias", {
    user_id: {
      type: "uuid",
      notNull: true,
    },
  });

  pgm.addColumn("portfolio_role_ref", {
    user_id: {
      type: "uuid",
      notNull: true,
    },
  });

  pgm.addColumn("portfolio_tool_ref", {
    user_id: {
      type: "uuid",
      notNull: true,
    },
  });

  /**
   * 5. Criar FKs corretas → users(id)
   */
  pgm.addConstraint("portfolio_formacao", "portfolio_formacao_user_id_fkey", {
    foreignKeys: {
      columns: "user_id",
      references: "users(id)",
      onDelete: "CASCADE",
    },
  });

  pgm.addConstraint("portfolio_historico", "portfolio_historico_user_id_fkey", {
    foreignKeys: {
      columns: "user_id",
      references: "users(id)",
      onDelete: "CASCADE",
    },
  });

  pgm.addConstraint("portfolio_medias", "portfolio_medias_user_id_fkey", {
    foreignKeys: {
      columns: "user_id",
      references: "users(id)",
      onDelete: "CASCADE",
    },
  });

  pgm.addConstraint("portfolio_role_ref", "portfolio_role_ref_user_id_fkey", {
    foreignKeys: {
      columns: "user_id",
      references: "users(id)",
      onDelete: "CASCADE",
    },
  });

  pgm.addConstraint("portfolio_tool_ref", "portfolio_tool_ref_user_id_fkey", {
    foreignKeys: {
      columns: "user_id",
      references: "users(id)",
      onDelete: "CASCADE",
    },
  });

  /**
   * 6. Recriar índices
   */
  pgm.createIndex("portfolio_formacao", ["user_id", "ordem"], {
    name: "idx_portfolio_formacao_user_ordem",
  });

  pgm.createIndex("portfolio_historico", ["user_id", "ordem"], {
    name: "idx_portfolio_historico_user_ordem",
  });

  /**
   * 7. Dropar tabela portfolios
   */
  pgm.dropTable("portfolios");
};
