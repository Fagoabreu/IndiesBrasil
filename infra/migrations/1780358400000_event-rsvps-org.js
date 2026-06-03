/**
 * Migration: RSVP de organizações em eventos
 *
 * Adiciona `organization_id` em `event_rsvps` para que um estúdio possa
 * confirmar presença num evento (via um membro autorizado).
 *
 * A coluna é nullable — RSVPs pessoais continuam sem org_id.
 * O índice único garante que cada org confirme presença uma única vez
 * por evento (ignorando instâncias por ora).
 */

exports.up = (pgm) => {
  pgm.addColumn("event_rsvps", {
    organization_id: {
      type: "uuid",
      notNull: false,
      references: '"organizations"(id)',
      onDelete: "CASCADE",
    },
  });

  pgm.addIndex("event_rsvps", ["event_id", "organization_id"], {
    unique: true,
    where: "organization_id IS NOT NULL AND instance_id IS NULL",
    name: "uq_event_rsvp_org",
  });
};

exports.down = (pgm) => {
  pgm.dropIndex("event_rsvps", ["event_id", "organization_id"], {
    name: "uq_event_rsvp_org",
  });
  pgm.dropColumn("event_rsvps", "organization_id");
};
