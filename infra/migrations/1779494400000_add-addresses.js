/**
 * Migration: Tabela de endereços estruturados
 *
 * Tabela criada:
 *   addresses — endereço completo e reutilizável (eventos, perfis, estúdios, etc.)
 *
 * Alteração em tabelas existentes:
 *   events.address_id → FK para addresses (opcional)
 *
 * Design:
 *   - A tabela é genérica (sem owner). Quem referencia é responsável pelo ciclo de vida.
 *   - Campos atendem ao padrão postal brasileiro (CEP, UF, logradouro, número, complemento, bairro).
 *   - zip_code armazenado somente dígitos (8 chars). Formatação fica na camada de apresentação.
 */

exports.up = (pgm) => {
  pgm.createTable("addresses", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("gen_random_uuid()"),
    },

    /* Logradouro (ex: "Rua das Flores", "Av. Paulista") */
    street: { type: "varchar(255)" },

    /* Número (ex: "100", "s/n") */
    number: { type: "varchar(20)" },

    /* Complemento (ex: "Sala 201", "2º andar", "Bloco B") */
    complement: { type: "varchar(100)" },

    /* Bairro */
    neighborhood: { type: "varchar(100)" },

    /* Cidade — obrigatório */
    city: { type: "varchar(100)", notNull: true },

    /* UF — 2 chars (ex: "SP", "RJ") */
    state: { type: "char(2)", notNull: true },

    /* CEP — somente 8 dígitos, sem traço (ex: "01310100") */
    zip_code: { type: "varchar(8)" },

    /* País — padrão Brasil */
    country: {
      type: "varchar(50)",
      notNull: true,
      default: "'Brasil'",
    },

    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
    updated_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  /* Índice para buscas por cidade/estado (uso futuro) */
  pgm.createIndex("addresses", ["city", "state"]);

  /* FK em events */
  pgm.addColumn("events", {
    address_id: {
      type: "uuid",
      references: "addresses(id)",
      onDelete: "SET NULL",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("events", "address_id");
  pgm.dropTable("addresses");
};
