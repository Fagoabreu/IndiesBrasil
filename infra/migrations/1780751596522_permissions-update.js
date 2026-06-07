exports.up = (pgm) => {
  pgm.sql(`
    UPDATE users
    SET features = ARRAY(
      SELECT DISTINCT UNNEST(
        features || ARRAY[
          'create:boardgame:review',
          'update:boardgame:review',
          'create:book:review',
          'update:book:review'
        ]
      )
    )
    WHERE 'create:session' = ANY(features);
  `);
};

exports.down = false;
