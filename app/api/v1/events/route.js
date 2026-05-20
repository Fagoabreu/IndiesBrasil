import event from "@/models/event";
import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import authorization from "@/models/authorization";

/**
 * GET /api/v1/events
 * Query params: from, to, type
 * Lista eventos num intervalo de datas para o calendário.
 */
export async function GET(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "read:event")) {
      throw new ForbiddenError({ message: "Você não possui permissão para listar eventos." });
    }

    const { searchParams } = request.nextUrl;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type");

    const events = await event.findAll({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      userId: user.id ?? null,
      type: type || undefined,
    });

    return Response.json(events, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}

/**
 * POST /api/v1/events
 * Body: { title, description, event_type, visibility, starts_at, ends_at,
 *         is_all_day, is_online, online_url, location_name, location_url,
 *         is_recurring, recurrence_rule: { frequency, interval, ... } }
 */
export async function POST(request) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "create:event")) {
      throw new ForbiddenError({ message: "Você não possui permissão para criar eventos." });
    }

    const data = await request.json();
    const newEvent = await event.create(data, user.id);

    return Response.json(newEvent, { status: 201 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
