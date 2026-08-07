exports.up = (pgm) => {
  pgm.addColumn("events", {
    ticket_url: { type: "text", notNull: false },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("events", "ticket_url");
};
