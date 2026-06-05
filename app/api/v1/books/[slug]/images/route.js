import controller from "@/infra/controller";
import { ForbiddenError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import book from "@/models/book";

/**
 * POST /api/v1/books/[slug]/images
 *
 * Body: FormData com
 *   file    — arquivo de imagem
 *   imgType — "cover"
 */
export async function POST(request, context) {
  try {
    await controller.injectApiUser(request);
    const requestUser = request.context.user;

    const { slug } = await context.params;
    const bookData = await book.findBySlug(slug);

    const canEdit = await book.canEdit(bookData.id, requestUser);
    if (!canEdit) {
      throw new ForbiddenError({
        message: "Apenas administradores do estúdio podem alterar as imagens do livro/quadrinho.",
      });
    }

    const formData = await request.formData();
    const imgType = formData.get("imgType") || "cover";
    const file = formData.get("file");

    if (!file) {
      return Response.json({ message: "Nenhum arquivo enviado." }, { status: 400 });
    }

    if (imgType !== "cover") {
      return Response.json({ message: "imgType inválido. Use 'cover'." }, { status: 400 });
    }

    const folder = `books/${bookData.id}/cover`;
    const imageData = await uploadedImages.uploadImage(file, folder);

    await book.saveCover(slug, imageData.id);

    return Response.json({
      url: imageData.secure_url,
      id: imageData.id,
    });
  } catch (err) {
    if (err.statusCode) {
      return Response.json({ message: err.message }, { status: err.statusCode });
    }
    console.error(err);
    return Response.json({ message: "Erro interno." }, { status: 500 });
  }
}
