/**
 * Migration: Courses — Cursos / Playlists de Aulas
 *
 * Tabelas criadas:
 *   courses              — cada playlist é um curso
 *   course_lessons       — aulas dentro de um curso
 *   course_tags          — tags associadas ao curso (FK -> tags)
 *   course_ratings       — avaliação com estrelas (1-5)
 *   course_progress      — progresso do usuário por aula
 *   lesson_comments      — fórum de dúvidas por aula
 */

exports.up = (pgm) => {
  /* ---------------------------------------------------------------
   * 1. courses
   * --------------------------------------------------------------- */
  pgm.createTable("courses", {
    id: {
      type: "uuid",
      notNull: true,
      default: pgm.func("gen_random_uuid()"),
    },
    owner_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    title: {
      type: "varchar(255)",
      notNull: true,
    },
    description: {
      type: "text",
    },
    slug: {
      type: "varchar(255)",
      notNull: true,
    },
    cover_image_id: {
      type: "varchar(256)",
      references: "uploaded_images(id)",
      onDelete: "SET NULL",
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
  pgm.createConstraint("courses", "courses_pkey", { primaryKey: "id" });
  pgm.createIndex("courses", ["slug"], { unique: true });

  /* ---------------------------------------------------------------
   * 2. course_lessons
   * --------------------------------------------------------------- */
  pgm.createTable("course_lessons", {
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
    description: {
      type: "text",
    },
    order_index: {
      type: "integer",
      notNull: true,
      default: 0,
    },
    video_url: {
      type: "varchar(512)",
    },
    reading_material: {
      type: "text",
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
  pgm.createConstraint("course_lessons", "course_lessons_pkey", {
    primaryKey: "id",
  });
  pgm.createIndex("course_lessons", ["course_id", "order_index"], {
    unique: true,
  });

  /* ---------------------------------------------------------------
   * 3. course_tags
   * --------------------------------------------------------------- */
  pgm.createTable("course_tags", {
    course_id: {
      type: "uuid",
      notNull: true,
      references: "courses(id)",
      onDelete: "CASCADE",
    },
    tag_id: {
      type: "uuid",
      notNull: true,
      references: "tags(id)",
      onDelete: "CASCADE",
    },
  });
  pgm.createConstraint("course_tags", "course_tags_pkey", {
    primaryKey: ["course_id", "tag_id"],
  });

  /* ---------------------------------------------------------------
   * 4. course_ratings
   * --------------------------------------------------------------- */
  pgm.createTable("course_ratings", {
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
    rating: {
      type: "integer",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });
  pgm.createConstraint("course_ratings", "course_ratings_pkey", {
    primaryKey: ["course_id", "user_id"],
  });

  /* ---------------------------------------------------------------
   * 5. course_progress
   * --------------------------------------------------------------- */
  pgm.createTable("course_progress", {
    user_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    lesson_id: {
      type: "uuid",
      notNull: true,
      references: "course_lessons(id)",
      onDelete: "CASCADE",
    },
    completed: {
      type: "boolean",
      notNull: true,
      default: false,
    },
    completed_at: {
      type: "timestamptz",
    },
  });
  pgm.createConstraint("course_progress", "course_progress_pkey", {
    primaryKey: ["user_id", "lesson_id"],
  });

  /* ---------------------------------------------------------------
   * 6. lesson_comments
   * --------------------------------------------------------------- */
  pgm.createTable("lesson_comments", {
    id: {
      type: "uuid",
      notNull: true,
      default: pgm.func("gen_random_uuid()"),
    },
    lesson_id: {
      type: "uuid",
      notNull: true,
      references: "course_lessons(id)",
      onDelete: "CASCADE",
    },
    author_id: {
      type: "uuid",
      notNull: true,
      references: "users(id)",
      onDelete: "CASCADE",
    },
    content: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("timezone('utc', now())"),
    },
  });
  pgm.createConstraint("lesson_comments", "lesson_comments_pkey", {
    primaryKey: "id",
  });
  pgm.createIndex("lesson_comments", ["lesson_id", "created_at"]);
};

exports.down = (pgm) => {
  pgm.dropTable("lesson_comments", { ifExists: true });
  pgm.dropTable("course_progress", { ifExists: true });
  pgm.dropTable("course_ratings", { ifExists: true });
  pgm.dropTable("course_tags", { ifExists: true });
  pgm.dropTable("course_lessons", { ifExists: true });
  pgm.dropTable("courses", { ifExists: true });
};
