import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";
import poll from "@/models/poll";

export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:post")) {
      throw new ForbiddenError({
        message: "Você não possui permissão.",
        action: 'Verifique se o seu usuário possui a feature "read:post".',
      });
    }

    const { post_id } = await params;
    const formData = await request.formData();
    const poll_option_id = Number(formData.get("poll_option_id"));

    const result = await poll.vote(poll_option_id, user.id);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

export async function PUT(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:post")) {
      throw new ForbiddenError({
        message: "Você não possui permissão.",
        action: 'Verifique se o seu usuário possui a feature "update:post".',
      });
    }

    const { post_id } = await params;
    const result = await poll.endPoll(post_id, user.id);
    return Response.json(result, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
