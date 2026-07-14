import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import news from "@/models/news";

export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:news:rating")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para avaliar.",
        action:
          'Verifique se o seu usuário possui a feature "create:news:rating".',
      });
    }

    const { id } = await params;
    const body = await request.json();
    const rating = Number(body.rating);

    if (rating < 1 || rating > 5) {
      return Response.json(
        { error: "Rating deve ser entre 1 e 5." },
        { status: 400 },
      );
    }

    await news.setRating(id, user.id, rating);
    return Response.json({ message: "Rating atualizado." }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
