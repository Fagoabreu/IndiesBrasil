import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import news from "@/models/news";

export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:news:factcheck")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para checar fatos.",
        action:
          'Verifique se o seu usuário possui a feature "create:news:factcheck".',
      });
    }

    const { id } = await params;
    const body = await request.json();
    const vote = body.vote;

    if (!["factcheck", "fake"].includes(vote)) {
      return Response.json(
        { error: "Voto inválido. Use 'factcheck' ou 'fake'." },
        { status: 400 },
      );
    }

    await news.setFactcheck(id, user.id, vote);
    return Response.json({ message: "Factcheck atualizado." }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
