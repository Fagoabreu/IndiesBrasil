exports.up = (pgm) => {
  /* USERS */
  pgm.addColumn("users", {
    resumo: {
      type: "varchar(128)",
    },
  });

  /* PORTFOLIOS */
  pgm.renameColumn("portfolios", "description", "bio");
  pgm.dropColumn("portfolios", "title");
  pgm.addColumn("portfolios", {
    background_image: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
    },
  });

  /* PORTFOLIO HISTORICO */
  pgm.createTable("portfolio_historico", {
    id: "id",

    portfolio_id: {
      type: "int",
      notNull: true,
      references: "portfolios(id)",
      onDelete: "CASCADE",
    },

    ordem: {
      type: "int",
      notNull: true,
    },

    cargo: {
      type: "varchar(128)",
    },

    init_date: {
      type: "date",
      notNull: true,
    },

    end_date: {
      type: "date",
    },

    company: {
      type: "varchar(256)",
      notNull: true,
    },

    cidade: {
      type: "varchar(256)",
      notNull: true,
    },

    estado: {
      type: "varchar(128)",
    },

    atribuicoes: {
      type: "varchar[]",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  pgm.createIndex("portfolio_historico", "portfolio_id", { name: "idx_portfolio_historico_portfolio_id" });

  pgm.createIndex("portfolio_historico", ["portfolio_id", "ordem"], { name: "idx_portfolio_historico_portfolio_ordem" });

  /* PORTFOLIO FORMACAO */
  pgm.createTable("portfolio_formacao", {
    id: "id",

    portfolio_id: {
      type: "int",
      notNull: true,
      references: "portfolios(id)",
      onDelete: "CASCADE",
    },

    ordem: {
      type: "int",
      notNull: true,
    },

    nome: {
      type: "varchar(256)",
    },

    init_date: {
      type: "date",
      notNull: true,
    },

    end_date: {
      type: "date",
    },

    instituicao: {
      type: "varchar(256)",
      notNull: true,
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  pgm.createIndex("portfolio_formacao", "portfolio_id", { name: "idx_portfolio_formacao_portfolio_id" });

  pgm.createIndex("portfolio_formacao", ["portfolio_id", "ordem"], { name: "idx_portfolio_formacao_portfolio_ordem" });

  /* CONTACT TYPE */
  pgm.dropConstraint("contact_type", "contact_images_id_fkey");

  pgm.renameColumn("contact_type", "name", "icon_key");
  pgm.renameColumn("contact_type", "img_ico", "icon_img");

  pgm.alterColumn("contact_type", "icon_key", {
    type: "varchar(64)",
    notNull: true,
  });

  pgm.sql(`
    INSERT INTO public.contact_type (icon_key,icon_img) VALUES
      ('Discord','discord'),
      ('Linkedin','linkedin'),
      ('GitHub','github'),
      ('Instagram','instagram'),
      ('Itch.io','itchdotio'),
      ('Website','layout'),
      ('Email','mail'),
      ('Fone','smartphone'),
      ('Steam','steam'),
      ('Telegram','telegram');
    INSERT INTO public.contact_type (icon_key,icon_img) VALUES
      ('TikTok','tiktok'),
      ('Twitch','twitch'),
      ('WhatsApp','whatsapp'),
      ('Youtube','youtube');

  `);

  pgm.addColumn("portfolio_tools", {
    icon_img: {
      type: "varchar(256)",
    },
  });
};
