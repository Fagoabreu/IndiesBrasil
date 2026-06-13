import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import news from "@/models/news";

export async function POST(request, { params }) {
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
    const formData = await request.formData();
    const vote = formData.get("vote");

    if (!["factcheck", "fake"].includes(vote)) {
      return Response.json({ error: "Voto inválido. Use 'factcheck' ou 'fake'." }, { status: 400 });
    }

    await news.setFactcheck(id, user.id, vote);
    return Response.json({ message: "Factcheck atualizado." }, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
