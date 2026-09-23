import meeting from "@/models/meeting";
import organization from "@/models/organization";
import controller from "@/infra/controller";
import authorization from "@/models/authorization";
import galene from "@/lib/galene";
import { ensureStudioMemberOrOwner } from "@/lib/studioAccess";
import { ForbiddenError } from "@/infra/errors";

/**
 * POST /api/v1/studios/[slug]/meetings/[meetingId]/end
 * Encerra uma reunião em andamento (irreversível). Criador, admin ou dono.
 *
 * Encerrar é uma operação na PLATAFORMA e no servidor de mídia, nesta ordem:
 *
 * 1. `meeting.end()` grava `status = 'ended'` — é a fonte da verdade, e o que
 *    faz `assertCanJoin` recusar a próxima emissão de token;
 * 2. `galene.ensureStudioGroup()` garante o grupo do estúdio. A rota não pode
 *    contar com um `join` anterior: encerrar uma reunião em que ninguém entrou
 *    é legítimo, e sem o grupo do estúdio o moderador não teria onde entrar
 *    (o arquivo da sala é filho dele);
 * 3. `galene.closeRoom()` grava a sala fechada no disco (`expires` no passado),
 *    para que ninguém entre nem depois de um reinício do Galene;
 * 4. `galene.pruneClosedRooms()` remove os arquivos de salas cuja janela já
 *    passou — o arquivo do passo 3 só é necessário enquanto `ends_at` é futuro,
 *    inclusive para a reunião recém-encerrada;
 * 5. `galene.lockRoom()` tranca a sala e EXPULSA quem está dentro.
 *
 * O passo 5 é o último de propósito: ele depende de rede, e assim uma falha ali
 * deixa a reunião já fechada no banco e no disco (fail-closed) — o erro apenas
 * sinaliza que a expulsão não aconteceu. Trancar é a única forma de expulsar:
 * `group.Delete` desiste com clientes conectados, a API administrativa só
 * apaga o arquivo, e `desc.Expires` é lido exclusivamente no `AddClient` (barra
 * entrada, não tira ninguém).
 */
export async function POST(request, { params }) {
  try {
    await controller.injectApiUser(request);
    const user = request.context.user;

    if (!authorization.can(user, "update:meeting")) {
      throw new ForbiddenError({
        message: "Você não possui permissão para encerrar reuniões.",
      });
    }

    const { slug, meetingId } = await params;
    const studio = await organization.findBySlug(slug);
    await ensureStudioMemberOrOwner(user, studio);
    await meeting.findByIdAndOrg(meetingId, studio.id);

    let data = {};
    try {
      data = await request.json();
    } catch {
      data = {};
    }

    const ended = await meeting.end(meetingId, user.id);

    await galene.ensureStudioGroup(ended.org_slug, ended.org_name);
    await galene.closeRoom(ended.org_slug, ended.room_id);

    const keep = await meeting.listRoomsWithinWindow(studio.id);
    await galene.pruneClosedRooms(ended.org_slug, keep);

    await galene.lockRoom(ended.org_slug, ended.room_id, data.message);

    const serialized = meeting.serializeMeeting(ended);
    delete serialized.room_id;

    return Response.json(serialized, { status: 200 });
  } catch (error) {
    return controller.onRouterErrorHandler(error);
  }
}
