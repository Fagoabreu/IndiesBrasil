/**
 * Migration: Add course_modules table and module_id on course_lessons
 *
 * - course_modules: groups lessons into named sections
 * - course_lessons.module_id: optional FK to course_modules (SET NULL on delete)
 */

exports.up = (pgm) => {
  pgm.createTable("course_modules", {
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
    title: {
      type: "varchar(255)",
      notNull: true,
    },
    order_index: {
      type: "integer",
      notNull: true,
      default: 0,
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
  pgm.createConstraint("course_modules", "course_modules_pkey", { primaryKey: "id" });
  pgm.createIndex("course_modules", ["course_id", "order_index"], { unique: true });

  pgm.addColumn("course_lessons", {
    module_id: {
      type: "uuid",
      references: "course_modules(id)",
      onDelete: "SET NULL",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("course_lessons", "module_id");
  pgm.dropTable("course_modules", { ifExists: true });
};
