/**
 * Migration: Relacionamentos entre estúdios
 *
 * Cria a tabela `org_relationships` para representar vínculos formais
 * entre organizações (parceria, distribuidora, cooperativa, etc.).
 *
 * O par (org_a_id, org_b_id) é normalizado via LEAST/GREATEST para
 * garantir que cada dupla de estúdios só possa ter um relacionamento ativo.
 *
 * Fluxo:
 *   1. Admin do Estúdio A solicita → status = 'pending', requested_by_org = A
 *   2. Admin do Estúdio B aprova  → status = 'accepted'
 *   3. Qualquer admin pode encerrar → DELETE
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE org_relationships (
      id                   UUID        NOT NULL DEFAULT gen_random_uuid(),
      org_a_id             UUID        NOT NULL,
      org_b_id             UUID        NOT NULL,
      relationship_type    VARCHAR(50) NOT NULL DEFAULT 'partner',
      status               VARCHAR(20) NOT NULL DEFAULT 'pending',
      requested_by_org_id  UUID        NOT NULL,
      requested_by_user_id UUID        NOT NULL,
      responded_by_user_id UUID,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      CONSTRAINT org_relationships_pkey
        PRIMARY KEY (id),

      CONSTRAINT uq_org_relationship_pair
        UNIQUE (org_a_id, org_b_id),

      CONSTRAINT chk_org_relationship_normalized
        CHECK (org_a_id < org_b_id),

      CONSTRAINT chk_org_relationship_status
        CHECK (status IN ('pending', 'accepted', 'rejected')),

      CONSTRAINT chk_org_relationship_type
        CHECK (relationship_type IN (
          'partner', 'distributor', 'cooperative',
          'workers_association', 'collective', 'publisher',
          'incubator', 'investor', 'other'
        )),

      CONSTRAINT chk_requested_by_org
        CHECK (requested_by_org_id = org_a_id OR requested_by_org_id = org_b_id),

      CONSTRAINT org_relationships_org_a_fkey
        FOREIGN KEY (org_a_id) REFERENCES organizations(id) ON DELETE CASCADE,

      CONSTRAINT org_relationships_org_b_fkey
        FOREIGN KEY (org_b_id) REFERENCES organizations(id) ON DELETE CASCADE,

      CONSTRAINT org_relationships_requested_by_user_fkey
        FOREIGN KEY (requested_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

      CONSTRAINT org_relationships_responded_by_user_fkey
        FOREIGN KEY (responded_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `);
};

exports.down = (pgm) => {
  pgm.dropTable("org_relationships");
};
