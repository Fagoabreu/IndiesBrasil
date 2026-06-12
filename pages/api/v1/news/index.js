import controller from "@/infra/controller.js";
import { NotFoundError } from "@/infra/errors";
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
router.post(controller.canRequest("create:news"), postHandler);

export default router.handler(controller.errorHandlers);

// ─── GET /api/v1/news ────────────────────────
async function getHandler(request, response) {
  const userTryingToGet = request.context.user;
  const allNews = await news.findAll();

  // Buscar rating e factcheck do usuário logado
  const enriched = await Promise.all(
    allNews.map(async (item) => {
      let userRating = null;
      let userFactcheck = null;
      if (userTryingToGet?.id) {
        const r = await news.getRatingByUser(item.id, userTryingToGet.id);
        userRating = r?.rating || null;
        const f = await news.getFactcheckByUser(item.id, userTryingToGet.id);
        userFactcheck = f?.vote || null;
      }
      return { ...item, user_rating: userRating, user_factcheck: userFactcheck };
    }),
  );

  const secureOutput = authorization.filterOutput(userTryingToGet, "read:news:all", enriched);
  return response.status(200).json(secureOutput);
}

// ─── POST /api/v1/news ────────────────────────
async function postHandler(request, response) {
  const userTryingToPost = request.context.user;

  const form = formidable({
    multiples: false,
    uploadDir: os.tmpdir(),
    keepExtensions: true,
    maxFileSize: 5 * 1024 * 1024,
    filter: ({ mimetype }) => mimetype?.startsWith("image/"),
  });

  const [fields, files] = await form.parse(request);
  const title = fields.title?.[0];
  const summary = fields.summary?.[0];
  const body = fields.body?.[0];
  const source_url = fields.source_url?.[0] || null;
  const source_label = fields.source_label?.[0] || null;

  if (!title || !summary || !body) {
    return response.status(400).json({
      error: "title, summary e body são obrigatórios.",
    });
  }

  let imgId = null;
  const uploadedFile = files.file?.[0];
  if (uploadedFile) {
    const buffer = await fs.readFile(uploadedFile.filepath);
    // Cria um objeto File-like para o uploadFile.postFile
    const file = {
      arrayBuffer: async () => buffer,
      name: uploadedFile.originalFilename,
      size: buffer.length,
      type: uploadedFile.mimetype,
    };
    const imageData = await uploadedImages.uploadImage(file, "news");
    imgId = imageData.id;
  }

  const newsInput = {
    author_id: userTryingToPost.id,
    title,
    summary,
    body,
    img: imgId,
    source_url,
    source_label,
  };

  const created = await news.create(newsInput);
  const fullNews = await news.findById(created.id);

  let userRating = null;
  let userFactcheck = null;
  const r = await news.getRatingByUser(fullNews.id, userTryingToPost.id);
  userRating = r?.rating || null;
  const f = await news.getFactcheckByUser(fullNews.id, userTryingToPost.id);
  userFactcheck = f?.vote || null;

  const enriched = { ...fullNews, user_rating: userRating, user_factcheck: userFactcheck };
  const secureOutput = authorization.filterOutput(userTryingToPost, "read:news", enriched);
  return response.status(201).json(secureOutput);
}

export const config = {
  api: {
    bodyParser: false,
  },
};
