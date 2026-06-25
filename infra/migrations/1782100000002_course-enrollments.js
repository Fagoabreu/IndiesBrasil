/**
 * Migration: Add course_enrollments table
 *
 * Purpose:
 *   - Track which users are enrolled/subscribed to which courses
 *   - Enable filtering of courses by enrollment status
 *   - Support notifications when new lessons are added
 */

exports.up = (pgm) => {
  pgm.createTable("course_enrollments", {
    id: {
      type: "uuid",
      notNull: true,
      default: pgm.func("gen_random_uuid()"),
    },
    course_id: {
      type: "uuid",
      notNull: true,
      references: "courses(id)",
      onDelete: "CASCADE",
    },
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });

  pgm.createConstraint("course_enrollments", "course_enrollments_pkey", { primaryKey: "id" });
  pgm.createIndex("course_enrollments", ["course_id", "user_id"], { unique: true });
  pgm.createIndex("course_enrollments", ["user_id"]);
};

exports.down = (pgm) => {
  pgm.dropTable("course_enrollments", { ifExists: true });
};
