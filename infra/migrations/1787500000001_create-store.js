/**
 * Cria o módulo de Loja (marketplace intermediado).
 *
 * A plataforma apenas cadastra produtos e registra pedidos; a venda em si
 * (pagamento e entrega) é conduzida diretamente pelo estúdio vendedor.
 *
 * - store_products: produtos ofertados por estúdios verificados.
 * - store_orders: pedidos criados por compradores (usuários) para um produto.
 * - store_order_events: histórico de mudança de status de cada pedido.
 *
 * Também adiciona os valores 'store_order_received' e 'store_order_updated'
 * ao enum notification_type. Por limitação de snapshot do PostgreSQL, os
 * títulos/mensagens dessas notificações são definidos no cliente
 * (components/Header/NotificationButton.js) via CLIENT_NOTIF_DEFS.
 */
exports.noTransaction = true;

exports.up = (pgm) => {
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'store_order_received';`);
  pgm.sql(`ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'store_order_updated';`);

  pgm.sql(`
    CREATE TABLE store_products (
      id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      slug            varchar(255)  NOT NULL,
      name            varchar(255)  NOT NULL,
      description     text,
      type            varchar(20)   NOT NULL DEFAULT 'physical',
      price           numeric(10,2) NOT NULL,
      image_id        varchar(256)  REFERENCES uploaded_images(id) ON DELETE SET NULL,
      status          varchar(20)   NOT NULL DEFAULT 'active',
      delivery_notes  text,
      created_at      timestamptz   NOT NULL DEFAULT now(),
      updated_at      timestamptz   NOT NULL DEFAULT now(),
      CONSTRAINT store_products_type_check
        CHECK (type IN ('physical', 'digital')),
      CONSTRAINT store_products_status_check
        CHECK (status IN ('active', 'inactive')),
      CONSTRAINT store_products_price_nonnegative CHECK (price >= 0)
    );

    CREATE UNIQUE INDEX store_products_slug_unique ON store_products (slug);
    CREATE INDEX store_products_org_idx ON store_products (organization_id);
  `);

  pgm.sql(`
    CREATE TABLE store_orders (
      id                    uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id            uuid          REFERENCES store_products(id) ON DELETE SET NULL,
      organization_id       uuid          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      buyer_id              uuid          REFERENCES users(id) ON DELETE SET NULL,
      status                varchar(20)   NOT NULL DEFAULT 'pending',
      quantity              integer       NOT NULL DEFAULT 1,
      address_id            uuid          REFERENCES addresses(id) ON DELETE SET NULL,
      price_snapshot        numeric(10,2) NOT NULL,
      delivery_cost         numeric(10,2),
      delivery_deadline_days integer,
      total                 numeric(10,2) NOT NULL,
      buyer_note            text,
      created_at            timestamptz   NOT NULL DEFAULT now(),
      updated_at            timestamptz   NOT NULL DEFAULT now(),
      CONSTRAINT store_orders_status_check
        CHECK (status IN ('pending', 'quoted', 'accepted', 'paid', 'shipped', 'delivered', 'cancelled', 'declined')),
      CONSTRAINT store_orders_quantity_check CHECK (quantity > 0),
      CONSTRAINT store_orders_total_nonnegative CHECK (total >= 0)
    );

    CREATE INDEX store_orders_buyer_idx ON store_orders (buyer_id);
    CREATE INDEX store_orders_org_idx ON store_orders (organization_id);
  `);

  pgm.sql(`
    CREATE TABLE store_order_events (
      id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id    uuid         NOT NULL REFERENCES store_orders(id) ON DELETE CASCADE,
      status      varchar(20)  NOT NULL,
      note        text,
      created_by  uuid         REFERENCES users(id) ON DELETE SET NULL,
      created_at  timestamptz  NOT NULL DEFAULT now()
    );

    CREATE INDEX store_order_events_order_idx ON store_order_events (order_id, created_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS store_order_events;`);
  pgm.sql(`DROP TABLE IF EXISTS store_orders;`);
  pgm.sql(`DROP TABLE IF EXISTS store_products;`);
  // Nota: valores de enum não podem ser removidos no PostgreSQL.
};
