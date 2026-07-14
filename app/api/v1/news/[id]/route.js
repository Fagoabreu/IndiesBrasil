import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import news from "@/models/news";
import uploadedImages from "@/models/uploadedImages";

export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:news")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para ler notícias.",
        action: 'Verifique se o seu usuário possui a feature "read:news".',
      });
    }

    const { id } = await params;
    const newsItem = await news.findById(id);

    let userRating = null;
    let userFactcheck = null;
    if (user?.id) {
      const r = await news.getRatingByUser(newsItem.id, user.id);
      userRating = r?.rating || null;
      const f = await news.getFactcheckByUser(newsItem.id, user.id);
      userFactcheck = f?.vote || null;
    }

    const enriched = {
      ...newsItem,
      user_rating: userRating,
      user_factcheck: userFactcheck,
    };
    const secureOutput = authorization.filterOutput(
      user,
      "read:news",
      enriched,
    );
    return Response.json(secureOutput, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

export async function PUT(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:news")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para editar notícias.",
        action: 'Verifique se o seu usuário possui a feature "update:news".',
      });
    }

    const { id } = await params;

    const formData = await request.formData();
    const input = {};

    const title = formData.get("title");
    if (title !== null) input.title = title;

    const summary = formData.get("summary");
    if (summary !== null) input.summary = summary;

    const body = formData.get("body");
    if (body !== null) input.body = body;

    const source_url = formData.get("source_url");
    if (source_url !== null) input.source_url = source_url || null;

    const source_label = formData.get("source_label");
    if (source_label !== null) input.source_label = source_label || null;

    const file = formData.get("file");
    if (file) {
      const imageData = await uploadedImages.uploadImage(file, "news");
      input.img = imageData.id;
    }

    const updated = await news.update(id, user.id, input);
    const fullNews = await news.findById(updated.id);

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
    const secureOutput = authorization.filterOutput(
      user,
      "read:news",
      enriched,
    );
    return Response.json(secureOutput, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "delete:news")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para remover notícias.",
        action: 'Verifique se o seu usuário possui a feature "delete:news".',
      });
    }

    const { id } = await params;

    const newsItem = await news.findById(id);
    if (newsItem.author_id !== user.id) {
      throw new ForbiddenError({
        message: "Você não é o autor desta notícia.",
      });
    }

    if (newsItem.img) {
      uploadedImages.deleteImage(newsItem.img);
    }

    await news.deleteByIdAndAuthor(id, user.id);
    return Response.json({ message: "Notícia removida." }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
