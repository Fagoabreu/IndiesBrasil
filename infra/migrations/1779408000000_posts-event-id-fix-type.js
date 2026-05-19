/*
 * Fix posts.event_id column type
 *
 * The column was originally created as INTEGER (referencing the deprecated
 * calendar_events table). The 1778803200000_events-calendar migration tried to
 * ADD COLUMN IF NOT EXISTS event_id uuid, but silently no-oped because the
 * INTEGER column already existed.
 *
 * This migration drops the stale INTEGER column and re-creates it as UUID,
 * matching the type of events.id.
 */

export const up = (pgm) => {
  // Drop the stale INTEGER column (cascades to its FK constraint automatically)
  pgm.sql(`ALTER TABLE posts DROP COLUMN IF EXISTS event_id;`);

  // Re-add as UUID referencing the new events table
  pgm.sql(`
    ALTER TABLE posts
      ADD COLUMN event_id uuid REFERENCES events(id) ON DELETE SET NULL;
  `);

  // Index for querying posts by event
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_posts_event_id ON posts (event_id);
  `);
};

export const down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_posts_event_id;`);
  pgm.sql(`ALTER TABLE posts DROP COLUMN IF EXISTS event_id;`);
  pgm.sql(`ALTER TABLE posts ADD COLUMN event_id INTEGER;`);
};
