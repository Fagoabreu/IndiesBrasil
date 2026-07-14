import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import news from "@/models/news";

export async function GET(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:news")) {
      throw new ForbiddenError({
        message: "Você não possui permissão.",
        action: 'Verifique se o seu usuário possui a feature "read:news".',
      });
    }

    const { id } = await params;
    const comments = await news.getComments(id);
    return Response.json(comments, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:news:comment")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para comentar.",
        action:
          'Verifique se o seu usuário possui a feature "create:news:comment".',
      });
    }

    const { id } = await params;
    const body = await request.json();
    const content = body.content;

    if (!content || !content.trim()) {
      return Response.json(
        { error: "Conteúdo é obrigatório." },
        { status: 400 },
      );
    }

    const comment = await news.createComment(id, user.id, content.trim());
    return Response.json(comment, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
