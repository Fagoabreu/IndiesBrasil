import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import news from "@/models/news";
import uploadedImages from "@/models/uploadedImages";

export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:news")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para ler notícias.",
        action: 'Verifique se o seu usuário possui a feature "read:news".',
      });
    }

    const allNews = await news.findAll();

    const enriched = await Promise.all(
      allNews.map(async (item) => {
        let userRating = null;
        let userFactcheck = null;
        if (user?.id) {
          const r = await news.getRatingByUser(item.id, user.id);
          userRating = r?.rating || null;
          const f = await news.getFactcheckByUser(item.id, user.id);
          userFactcheck = f?.vote || null;
        }
        return {
          ...item,
          user_rating: userRating,
          user_factcheck: userFactcheck,
        };
      }),
    );

    const secureOutput = authorization.filterOutput(user, "read:news:all", enriched);
    return Response.json(secureOutput, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:news")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para criar notícias.",
        action: 'Verifique se o seu usuário possui a feature "create:news".',
      });
    }

    const formData = await request.formData();
    const title = formData.get("title");
    const summary = formData.get("summary");
    const body = formData.get("body");
    const source_url = formData.get("source_url") || null;
    const source_label = formData.get("source_label") || null;
    const file = formData.get("file");

    if (!title || !summary || !body) {
      return Response.json({ error: "title, summary e body são obrigatórios." }, { status: 400 });
    }

    let imgId = null;
    if (file) {
      const imageData = await uploadedImages.uploadImage(file, "news");
      imgId = imageData.id;
    }

    const newsInput = {
      author_id: user.id,
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
    const r = await news.getRatingByUser(fullNews.id, user.id);
    userRating = r?.rating || null;
    const f = await news.getFactcheckByUser(fullNews.id, user.id);
    userFactcheck = f?.vote || null;

    const enriched = {
      ...fullNews,
      user_rating: userRating,
      user_factcheck: userFactcheck,
    };
    const secureOutput = authorization.filterOutput(user, "read:news", enriched);
    return Response.json(secureOutput, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
