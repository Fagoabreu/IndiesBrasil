import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import game from "@/models/game";

/**
 * POST /api/v1/games/[slug]/images
 *
 * Body: FormData com
 *   file    — arquivo de imagem
 *   imgType — "cover" | "banner"
 *
 * Apenas admins e o dono do jogo podem fazer upload.
 */
export async function POST(request, context) {
  try {
    await controller.injectApiUser(request);
    const requestUser = request.context.user;

    const { slug } = await context.params;
    const gameData = await game.findBySlug(slug);

    const canEdit = await game.canEdit(gameData, requestUser.id);
    if (!canEdit) {
      throw new ForbiddenError({
        message:
          "Apenas administradores do estúdio podem alterar as imagens do jogo.",
      });
    }

    const formData = await request.formData();
    const imgType = formData.get("imgType") || "cover"; // "cover" | "banner"
    const file = formData.get("file");

    if (!file) {
      return Response.json(
        { message: "Nenhum arquivo enviado." },
        { status: 400 },
      );
    }

    if (!["cover", "banner"].includes(imgType)) {
      return Response.json(
        { message: "imgType inválido. Use 'cover' ou 'banner'." },
        { status: 400 },
      );
    }

    const folder = `games/${gameData.id}/${imgType}`;
    const imageData = await uploadedImages.uploadImage(file, folder);

    if (imgType === "cover") {
      await game.saveCover(slug, imageData.id);
    } else {
      await game.saveBanner(slug, imageData.id);
    }

    return Response.json({
      url: imageData.secure_url,
      id: imageData.id,
    });
  } catch (err) {
    if (err.statusCode) {
      return Response.json(
        { message: err.message },
        { status: err.statusCode },
      );
    }
    console.error(err);
    return Response.json({ message: "Erro interno." }, { status: 500 });
  }
}
