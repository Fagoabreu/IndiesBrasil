import controller from "@/infra/controller.js";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import news from "@/models/news.js";
import uploadedImages from "@/models/uploadedImages";
import { createRouter } from "next-connect";
import formidable from "formidable";
import fs from "fs/promises";
import os from "os";

const router = createRouter();
router.use(controller.injectAnonymousOrUser);
router.get(getHandler);
router.put(controller.canRequest("update:news"), putHandler);
router.delete(controller.canRequest("delete:news"), deleteHandler);

export default router.handler(controller.errorHandlers);

// ─── GET /api/v1/news/:id ────────────────────
async function getHandler(request, response) {
  const { news_id } = request.query;
  const userTryingToGet = request.context.user;

  const newsItem = await news.findById(news_id);

  let userRating = null;
  let userFactcheck = null;
  if (userTryingToGet?.id) {
    const r = await news.getRatingByUser(newsItem.id, userTryingToGet.id);
    userRating = r?.rating || null;
    const f = await news.getFactcheckByUser(newsItem.id, userTryingToGet.id);
    userFactcheck = f?.vote || null;
  }

  const enriched = { ...newsItem, user_rating: userRating, user_factcheck: userFactcheck };
  const secureOutput = authorization.filterOutput(userTryingToGet, "read:news", enriched);
  return response.status(200).json(secureOutput);
}

// ─── PUT /api/v1/news/:id ────────────────────
async function putHandler(request, response) {
  const { news_id } = request.query;
  const userTryingToUpdate = request.context.user;

  const form = formidable({
    multiples: false,
    uploadDir: os.tmpdir(),
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024,
    filter: ({ mimetype }) => mimetype?.startsWith("image/"),
  });

  const [fields, files] = await form.parse(request);

  const input = {};
  if (fields.title?.[0]) input.title = fields.title[0];
  if (fields.summary?.[0]) input.summary = fields.summary[0];
  if (fields.body?.[0]) input.body = fields.body[0];
  if (fields.source_url?.[0] !== undefined) input.source_url = fields.source_url[0] || null;
  if (fields.source_label?.[0] !== undefined) input.source_label = fields.source_label[0] || null;

  const uploadedFile = files.file?.[0];
  if (uploadedFile) {
    const buffer = await fs.readFile(uploadedFile.filepath);
    const file = {
      arrayBuffer: async () => buffer,
      name: uploadedFile.originalFilename,
      size: buffer.length,
      type: uploadedFile.mimetype,
    };
    const imageData = await uploadedImages.uploadImage(file, "news");
    input.img = imageData.id;
  }

  const updated = await news.update(news_id, userTryingToUpdate.id, input);
  const fullNews = await news.findById(updated.id);

  let userRating = null;
  let userFactcheck = null;
  const r = await news.getRatingByUser(fullNews.id, userTryingToUpdate.id);
  userRating = r?.rating || null;
  const f = await news.getFactcheckByUser(fullNews.id, userTryingToUpdate.id);
  userFactcheck = f?.vote || null;

  const enriched = { ...fullNews, user_rating: userRating, user_factcheck: userFactcheck };
  const secureOutput = authorization.filterOutput(userTryingToUpdate, "read:news", enriched);
  return response.status(200).json(secureOutput);
}

// ─── DELETE /api/v1/news/:id ─────────────────
async function deleteHandler(request, response) {
  const { news_id } = request.query;
  const userTryingToDelete = request.context.user;

  const newsItem = await news.findById(news_id);
  if (newsItem.author_id !== userTryingToDelete.id) {
    throw new ForbiddenError({ message: "Você não é o autor desta notícia." });
  }

  if (newsItem.img) {
    uploadedImages.deleteImage(newsItem.img);
  }

  await news.deleteByIdAndAuthor(news_id, userTryingToDelete.id);

  return response.status(200).json({ message: "Notícia removida." });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
