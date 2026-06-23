import database from "infra/database";
import { NotFoundError, ValidationError, ForbiddenError } from "infra/errors";
import uploadedImages from "models/uploadedImages";

/* =========================================================
 * Helpers
 * ========================================================= */

function generateSlug(title, id) {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base}-${id.slice(0, 8)}`;
}

function validateRating(rating) {
  const n = Number(rating);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new ValidationError({
      message: "A nota deve ser um número inteiro entre 1 e 5.",
      action: "Envie um valor válido.",
    });
  }
  return n;
}

/* =========================================================
 * Courses CRUD
 * ========================================================= */

async function findAll({ page = 1, limit = 20, search = "", tag = "" } = {}) {
  const offset = (page - 1) * limit;
  const results = await database.query({
    text: `
      SELECT
        c.id, c.slug, c.title, c.description, c.created_at, c.updated_at,
        c.cover_image_id,
        ui.secure_url                AS cover_url,
        u.username                   AS owner_username,
        COUNT(DISTINCT cl.id)        AS lesson_count,
        COALESCE(AVG(cr.rating), 0)  AS avg_rating,
        COUNT(DISTINCT cr.user_id)   AS rating_count
      FROM courses c
      LEFT JOIN uploaded_images ui ON ui.id = c.cover_image_id
      LEFT JOIN users u            ON u.id = c.owner_id
      LEFT JOIN course_lessons cl  ON cl.course_id = c.id
      LEFT JOIN course_ratings cr  ON cr.course_id = c.id
      WHERE ($3 = '' OR c.title ILIKE '%' || $3 || '%' OR c.description ILIKE '%' || $3 || '%')
        AND ($4 = '' OR c.id IN (
          SELECT ct.course_id FROM course_tags ct
          INNER JOIN tags t ON t.id = ct.tag_id
          WHERE t.name = $4
        ))
      GROUP BY c.id, ui.secure_url, u.username
      ORDER BY c.created_at DESC
      LIMIT $1 OFFSET $2
    `,
    values: [limit, offset, search, tag],
  });
  return results.rows;
}

async function findBySlug(slug) {
  const results = await database.query({
    text: `
      SELECT
        c.*,
        ui.secure_url                AS cover_url,
        u.username                   AS owner_username,
        COUNT(DISTINCT cl.id)        AS lesson_count,
        COALESCE(AVG(cr.rating), 0)  AS avg_rating,
        COUNT(DISTINCT cr.user_id)   AS rating_count
      FROM courses c
      LEFT JOIN uploaded_images ui ON ui.id = c.cover_image_id
      LEFT JOIN users u            ON u.id = c.owner_id
      LEFT JOIN course_lessons cl  ON cl.course_id = c.id
      LEFT JOIN course_ratings cr  ON cr.course_id = c.id
      WHERE c.slug = $1
      GROUP BY c.id, ui.secure_url, u.username
    `,
    values: [slug],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Curso não encontrado.",
      action: "Verifique o link ou pesquise por outros cursos.",
    });
  }

  return results.rows[0];
}

async function create(ownerId, courseData) {
  const { title, description = "", coverImageId = null, tags = [] } = courseData;

  if (!title || title.trim().length < 3) {
    throw new ValidationError({
      message: "O título do curso deve ter pelo menos 3 caracteres.",
    });
  }

  const newCourse = await runInsertQuery(ownerId, title.trim(), description, coverImageId);

  // Associa tags
  if (tags.length > 0) {
    await setCourseTags(newCourse.id, tags);
  }

  return findBySlug(newCourse.slug);

  async function runInsertQuery(ownerId, title, description, coverImageId) {
    const results = await database.query({
      text: `
        INSERT INTO courses (owner_id, title, description, cover_image_id, slug)
        VALUES ($1, $2, $3, $4, 'temp')
        RETURNING *
      `,
      values: [ownerId, title, description, coverImageId],
    });

    const course = results.rows[0];
    const slug = generateSlug(title, course.id);
    await database.query({
      text: `UPDATE courses SET slug = $1 WHERE id = $2`,
      values: [slug, course.id],
    });
    course.slug = slug;
    return course;
  }
}

async function update(slug, ownerId, courseData) {
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este curso.",
    });
  }

  const { title, description, coverImageId, tags } = courseData;

  const results = await database.query({
    text: `
      UPDATE courses
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        cover_image_id = COALESCE($3, cover_image_id),
        updated_at = timezone('utc', now())
      WHERE id = $4
      RETURNING *
    `,
    values: [title || null, description !== undefined ? description : null, coverImageId || null, course.id],
  });

  // Atualiza slug se título mudou
  if (title && title.trim() !== course.title) {
    const newSlug = generateSlug(title.trim(), course.id);
    await database.query({
      text: `UPDATE courses SET slug = $1 WHERE id = $2`,
      values: [newSlug, course.id],
    });
    results.rows[0].slug = newSlug;
  }

  // Atualiza tags se enviadas
  if (tags !== undefined) {
    await setCourseTags(course.id, tags);
  }

  return findBySlug(results.rows[0].slug);
}

async function remove(slug, ownerId) {
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para remover este curso.",
    });
  }

  // Remove a imagem de capa do Cloudinary e da tabela uploaded_images
  if (course.cover_image_id) {
    try {
      await uploadedImages.deleteImage(course.cover_image_id);
    } catch {
      // best-effort: prossegue mesmo se falhar a remoção da imagem
    }
  }

  await database.query({
    text: `DELETE FROM courses WHERE id = $1`,
    values: [course.id],
  });
}

/* =========================================================
 * Cover image
 * ========================================================= */

async function updateCoverImage(slug, ownerId, coverImageId) {
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este curso.",
    });
  }

  // Remove imagem antiga se existir
  if (course.cover_image_id) {
    try {
      await uploadedImages.deleteImage(course.cover_image_id);
    } catch {
      // best-effort: prossegue mesmo se falhar a remoção da imagem antiga
    }
  }

  await database.query({
    text: `UPDATE courses SET cover_image_id = $1, updated_at = timezone('utc', now()) WHERE id = $2`,
    values: [coverImageId, course.id],
  });

  return findBySlug(slug);
}

async function removeCoverImage(slug, ownerId) {
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar este curso.",
    });
  }

  if (course.cover_image_id) {
    try {
      await uploadedImages.deleteImage(course.cover_image_id);
    } catch {
      // best-effort: prossegue mesmo se falhar a remoção da imagem
    }
  }

  await database.query({
    text: `UPDATE courses SET cover_image_id = NULL, updated_at = timezone('utc', now()) WHERE id = $1`,
    values: [course.id],
  });

  return findBySlug(slug);
}

/* =========================================================
 * Tags
 * ========================================================= */

async function getCourseTags(courseId) {
  const results = await database.query({
    text: `
      SELECT t.id, t.name
      FROM tags t
      INNER JOIN course_tags ct ON ct.tag_id = t.id
      WHERE ct.course_id = $1
      ORDER BY t.name
    `,
    values: [courseId],
  });
  return results.rows;
}

async function setCourseTags(courseId, tagNames) {
  // Remove tags existentes
  await database.query({
    text: `DELETE FROM course_tags WHERE course_id = $1`,
    values: [courseId],
  });

  if (!tagNames || tagNames.length === 0) return;

  // Garante que as tags existam e as associa
  for (const name of tagNames) {
    const tagName = name.toLowerCase().trim();
    if (tagName.length < 2) continue;

    // Upsert na tabela tags
    let tagResult = await database.query({
      text: `SELECT id FROM tags WHERE name = $1`,
      values: [tagName],
    });

    let tagId;
    if (tagResult.rowCount === 0) {
      tagResult = await database.query({
        text: `INSERT INTO tags (name) VALUES ($1) RETURNING id`,
        values: [tagName],
      });
      tagId = tagResult.rows[0].id;
    } else {
      tagId = tagResult.rows[0].id;
    }

    await database.query({
      text: `INSERT INTO course_tags (course_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      values: [courseId, tagId],
    });
  }
}

/* =========================================================
 * Lessons CRUD
 * ========================================================= */

async function findLessonsByCourseSlug(slug) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      SELECT cl.*, cm.title AS module_title
      FROM course_lessons cl
      LEFT JOIN course_modules cm ON cm.id = cl.module_id
      WHERE cl.course_id = $1
      ORDER BY cl.order_index ASC
    `,
    values: [course.id],
  });
  return results.rows;
}

async function findLessonByOrder(slug, orderIndex) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      SELECT *
      FROM course_lessons
      WHERE course_id = $1 AND order_index = $2
    `,
    values: [course.id, Number(orderIndex)],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Aula não encontrada.",
      action: "Verifique o link da aula.",
    });
  }

  return { ...results.rows[0], course_slug: slug };
}

async function createLesson(slug, ownerId, lessonData) {
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para adicionar aulas a este curso.",
    });
  }

  const { title, description = "", videoUrl = null, readingMaterial = null, orderIndex, moduleId = null } = lessonData;

  if (!title || title.trim().length < 2) {
    throw new ValidationError({
      message: "O título da aula deve ter pelo menos 2 caracteres.",
    });
  }

  // Determina o próximo order_index se não especificado
  let order = orderIndex;
  if (order === undefined || order === null) {
    const maxResult = await database.query({
      text: `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order FROM course_lessons WHERE course_id = $1`,
      values: [course.id],
    });
    order = maxResult.rows[0].next_order;
  }

  const results = await database.query({
    text: `
      INSERT INTO course_lessons (course_id, title, description, video_url, reading_material, order_index, module_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
    values: [course.id, title.trim(), description, videoUrl, readingMaterial, Number(order), moduleId],
  });

  return { ...results.rows[0], course_slug: slug };
}

async function updateLesson(slug, orderIndex, ownerId, lessonData) {
  const lesson = await findLessonByOrder(slug, orderIndex);
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar aulas deste curso.",
    });
  }

  const { title, description, videoUrl, readingMaterial, orderIndex: newOrder, moduleId } = lessonData;

  const results = await database.query({
    text: `
      UPDATE course_lessons
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        video_url = COALESCE($3, video_url),
        reading_material = COALESCE($4, reading_material),
        order_index = COALESCE($5, order_index),
        module_id = COALESCE($7, module_id),
        updated_at = timezone('utc', now())
      WHERE id = $6
      RETURNING *
    `,
    values: [
      title || null,
      description !== undefined ? description : null,
      videoUrl !== undefined ? videoUrl : null,
      readingMaterial !== undefined ? readingMaterial : null,
      newOrder !== undefined ? Number(newOrder) : null,
      lesson.id,
      moduleId !== undefined ? moduleId : null,
    ],
  });

  return { ...results.rows[0], course_slug: slug };
}

async function deleteLesson(slug, orderIndex, ownerId) {
  const lesson = await findLessonByOrder(slug, orderIndex);
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para remover aulas deste curso.",
    });
  }

  await database.query({
    text: `DELETE FROM course_lessons WHERE id = $1`,
    values: [lesson.id],
  });
}

/* =========================================================
 * Modules
 * ========================================================= */

async function findModulesByCourseSlug(slug) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      SELECT
        cm.id,
        cm.title,
        cm.order_index,
        cm.created_at,
        COUNT(cl.id) AS lesson_count
      FROM course_modules cm
      LEFT JOIN course_lessons cl ON cl.module_id = cm.id
      WHERE cm.course_id = $1
      GROUP BY cm.id, cm.title, cm.order_index, cm.created_at
      ORDER BY cm.order_index ASC
    `,
    values: [course.id],
  });
  return results.rows;
}

async function createModule(slug, ownerId, moduleData) {
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para adicionar módulos a este curso.",
    });
  }

  const { title, orderIndex } = moduleData;

  if (!title || title.trim().length < 2) {
    throw new ValidationError({
      message: "O título do módulo deve ter pelo menos 2 caracteres.",
    });
  }

  let order = orderIndex;
  if (order === undefined || order === null) {
    const maxResult = await database.query({
      text: `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_order FROM course_modules WHERE course_id = $1`,
      values: [course.id],
    });
    order = maxResult.rows[0].next_order;
  }

  const results = await database.query({
    text: `
      INSERT INTO course_modules (course_id, title, order_index)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    values: [course.id, title.trim(), Number(order)],
  });

  return { ...results.rows[0], lesson_count: 0 };
}

async function updateModule(slug, moduleId, ownerId, moduleData) {
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para editar módulos deste curso.",
    });
  }

  const { title, orderIndex } = moduleData;

  const results = await database.query({
    text: `
      UPDATE course_modules
      SET
        title = COALESCE($1, title),
        order_index = COALESCE($2, order_index),
        updated_at = timezone('utc', now())
      WHERE id = $3 AND course_id = $4
      RETURNING *
    `,
    values: [title || null, orderIndex !== undefined ? Number(orderIndex) : null, moduleId, course.id],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Módulo não encontrado.",
    });
  }

  return results.rows[0];
}

async function deleteModule(slug, moduleId, ownerId) {
  const course = await findBySlug(slug);

  if (course.owner_id !== ownerId) {
    throw new ForbiddenError({
      message: "Você não tem permissão para remover módulos deste curso.",
    });
  }

  const result = await database.query({
    text: `DELETE FROM course_modules WHERE id = $1 AND course_id = $2 RETURNING id`,
    values: [moduleId, course.id],
  });

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: "Módulo não encontrado.",
    });
  }
}

/* =========================================================
 * Ratings
 * ========================================================= */

async function upsertRating(slug, userId, rating, review = null) {
  const course = await findBySlug(slug);
  const validRating = validateRating(rating);

  await database.query({
    text: `
      INSERT INTO course_ratings (course_id, user_id, rating, review)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (course_id, user_id)
      DO UPDATE SET rating = $3, review = $4, created_at = timezone('utc', now())
    `,
    values: [course.id, userId, validRating, review],
  });

  return getUserRating(slug, userId);
}

async function getUserRating(slug, userId) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      SELECT rating, review, created_at
      FROM course_ratings
      WHERE course_id = $1 AND user_id = $2
    `,
    values: [course.id, userId],
  });

  return results.rows[0] || null;
}

async function getCourseRatings(slug) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      SELECT
        cr.rating,
        cr.review,
        cr.created_at,
        u.username
      FROM course_ratings cr
      INNER JOIN users u ON u.id = cr.user_id
      WHERE cr.course_id = $1
      ORDER BY cr.created_at DESC
    `,
    values: [course.id],
  });

  return results.rows;
}

/* =========================================================
 * Progress
 * ========================================================= */

async function markLessonCompleted(slug, orderIndex, userId) {
  const lesson = await findLessonByOrder(slug, orderIndex);

  await database.query({
    text: `
      INSERT INTO course_progress (user_id, lesson_id, completed, completed_at)
      VALUES ($1, $2, true, timezone('utc', now()))
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET completed = true, completed_at = timezone('utc', now())
    `,
    values: [userId, lesson.id],
  });
}

async function markLessonIncomplete(slug, orderIndex, userId) {
  const lesson = await findLessonByOrder(slug, orderIndex);

  await database.query({
    text: `
      INSERT INTO course_progress (user_id, lesson_id, completed, completed_at)
      VALUES ($1, $2, false, NULL)
      ON CONFLICT (user_id, lesson_id)
      DO UPDATE SET completed = false, completed_at = NULL
    `,
    values: [userId, lesson.id],
  });
}

async function getCourseProgress(slug, userId) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      SELECT
        cl.order_index,
        cl.id AS lesson_id,
        COALESCE(cp.completed, false) AS completed,
        cp.completed_at
      FROM course_lessons cl
      LEFT JOIN course_progress cp ON cp.lesson_id = cl.id AND cp.user_id = $2
      WHERE cl.course_id = $1
      ORDER BY cl.order_index ASC
    `,
    values: [course.id, userId],
  });

  const completedCount = results.rows.filter((r) => r.completed).length;
  const totalCount = results.rows.length;

  return {
    lessons: results.rows,
    completedCount,
    totalCount,
    lastCompletedOrder: results.rows.filter((r) => r.completed).pop()?.order_index ?? null,
    nextLessonOrder: results.rows.find((r) => !r.completed)?.order_index ?? null,
  };
}

/* =========================================================
 * Lesson Comments (Fórum)
 * ========================================================= */

async function findLessonComments(slug, orderIndex) {
  const lesson = await findLessonByOrder(slug, orderIndex);

  const results = await database.query({
    text: `
      SELECT
        lc.id,
        lc.content,
        lc.created_at,
        lc.author_id,
        u.username AS author_username,
        uui.secure_url AS author_avatar_url
      FROM lesson_comments lc
      INNER JOIN users u ON u.id = lc.author_id
      LEFT JOIN uploaded_images uui ON uui.id = u.avatar_image
      WHERE lc.lesson_id = $1
      ORDER BY lc.created_at ASC
    `,
    values: [lesson.id],
  });

  return results.rows;
}

async function createLessonComment(slug, orderIndex, authorId, content) {
  const lesson = await findLessonByOrder(slug, orderIndex);

  if (!content || content.trim().length === 0) {
    throw new ValidationError({
      message: "O comentário não pode estar vazio.",
    });
  }

  const results = await database.query({
    text: `
      INSERT INTO lesson_comments (lesson_id, author_id, content)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    values: [lesson.id, authorId, content.trim()],
  });

  return results.rows[0];
}

async function updateLessonComment(slug, orderIndex, commentId, authorId, content) {
  const lesson = await findLessonByOrder(slug, orderIndex);

  if (!content || content.trim().length === 0) {
    throw new ValidationError({
      message: "O comentário não pode estar vazio.",
    });
  }

  const results = await database.query({
    text: `
      UPDATE lesson_comments
      SET content = $1
      WHERE id = $2 AND lesson_id = $3 AND author_id = $4
      RETURNING *
    `,
    values: [content.trim(), commentId, lesson.id, authorId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Comentário não encontrado ou você não tem permissão para editá-lo.",
    });
  }

  return results.rows[0];
}

async function deleteLessonComment(slug, orderIndex, commentId, authorId) {
  const lesson = await findLessonByOrder(slug, orderIndex);

  const results = await database.query({
    text: `
      DELETE FROM lesson_comments
      WHERE id = $1 AND lesson_id = $2 AND author_id = $3
      RETURNING id
    `,
    values: [commentId, lesson.id, authorId],
  });

  if (results.rowCount === 0) {
    throw new NotFoundError({
      message: "Comentário não encontrado ou você não tem permissão para removê-lo.",
    });
  }
}

/* =========================================================
 * Enrollments (Inscrições)
 * ========================================================= */

async function enrollUser(slug, userId) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      INSERT INTO course_enrollments (course_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING id
    `,
    values: [course.id, userId],
  });

  return results.rowCount > 0;
}

async function unenrollUser(slug, userId) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      DELETE FROM course_enrollments
      WHERE course_id = $1 AND user_id = $2
      RETURNING id
    `,
    values: [course.id, userId],
  });

  return results.rowCount > 0;
}

async function isUserEnrolled(slug, userId) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      SELECT 1 FROM course_enrollments
      WHERE course_id = $1 AND user_id = $2
      LIMIT 1
    `,
    values: [course.id, userId],
  });

  return results.rowCount > 0;
}

async function getEnrolledCourses(userId) {
  const results = await database.query({
    text: `
      SELECT
        c.id, c.slug, c.title, c.description, c.created_at, c.updated_at,
        c.cover_image_id,
        ui.secure_url                AS cover_url,
        u.username                   AS owner_username,
        COUNT(DISTINCT cl.id)        AS lesson_count,
        COALESCE(AVG(cr.rating), 0)  AS avg_rating,
        COUNT(DISTINCT cr.user_id)   AS rating_count
      FROM courses c
      INNER JOIN course_enrollments ce ON ce.course_id = c.id
      LEFT JOIN uploaded_images ui ON ui.id = c.cover_image_id
      LEFT JOIN users u            ON u.id = c.owner_id
      LEFT JOIN course_lessons cl  ON cl.course_id = c.id
      LEFT JOIN course_ratings cr  ON cr.course_id = c.id
      WHERE ce.user_id = $1
      GROUP BY c.id, ui.secure_url, u.username, ce.created_at
      ORDER BY ce.created_at DESC
    `,
    values: [userId],
  });

  return results.rows;
}

async function getCourseEnrollments(slug) {
  const course = await findBySlug(slug);

  const results = await database.query({
    text: `
      SELECT u.id, u.username, u.avatar_url, ce.created_at
      FROM course_enrollments ce
      INNER JOIN users u ON u.id = ce.user_id
      WHERE ce.course_id = $1
      ORDER BY ce.created_at DESC
    `,
    values: [course.id],
  });

  return results.rows;
}

const courseModel = {
  findAll,
  findBySlug,
  create,
  update,
  remove,
  updateCoverImage,
  removeCoverImage,
  getCourseTags,
  setCourseTags,
  findLessonsByCourseSlug,
  findLessonByOrder,
  createLesson,
  updateLesson,
  deleteLesson,
  findModulesByCourseSlug,
  createModule,
  updateModule,
  deleteModule,
  upsertRating,
  getUserRating,
  getCourseRatings,
  markLessonCompleted,
  markLessonIncomplete,
  getCourseProgress,
  findLessonComments,
  createLessonComment,
  updateLessonComment,
  deleteLessonComment,
  enrollUser,
  unenrollUser,
  isUserEnrolled,
  getEnrolledCourses,
  getCourseEnrollments,
};

export default courseModel;
