import controller from "@/infra/controller";
import { ForbiddenError, NotFoundError } from "@/infra/errors";
import uploadedImages from "@/models/uploadedImages";
import book from "@/models/book";

/**
 * GET /api/v1/books/[slug]/pdf
 *   ?download=1  — força download com nome do livro (Content-Disposition: attachment)
 *
 * Faz proxy do PDF do Cloudinary para poder definir o nome do arquivo.
 */
export async function GET(request, context) {
  try {
    const { slug } = await context.params;
    const bookData = await book.findBySlug(slug);

    const pdfUrl = bookData.pdf_file_url || bookData.pdf_url;
    if (!pdfUrl) {
      throw new NotFoundError({
        message: "Este livro/quadrinho não possui PDF disponível.",
      });
    }

    // PDFs são enviados como resource_type "image" — a URL do Cloudinary já está correta.
    const resolvedUrl = pdfUrl;

    const { searchParams } = new URL(request.url);
    const download = searchParams.get("download") === "1";

    // Faz fetch do PDF no Cloudinary / origem externa
    const pdfResponse = await fetch(resolvedUrl);
    if (!pdfResponse.ok) {
      return Response.json({ message: "Não foi possível acessar o PDF." }, { status: 502 });
    }

    // Lê o corpo como arrayBuffer para repassar
    const pdfBuffer = await pdfResponse.arrayBuffer();

    // Nome do arquivo: título do livro + .pdf (sanitizado)
    const safeTitle = (bookData.title || slug)
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "_")
      .slice(0, 80);
    const filename = `${safeTitle}.pdf`;

    const headers = new Headers({
      "Content-Type": "application/pdf",
      "Content-Length": String(pdfBuffer.byteLength),
      "Cache-Control": "public, max-age=3600",
    });

    if (download) {
      headers.set("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    } else {
      headers.set("Content-Disposition", `inline; filename="${encodeURIComponent(filename)}"`);
    }

    return new Response(pdfBuffer, { headers });
  } catch (err) {
    if (err.statusCode) {
      return Response.json({ message: err.message }, { status: err.statusCode });
    }
    console.error(err);
    return Response.json({ message: "Erro interno." }, { status: 500 });
  }
}

/**
 * POST /api/v1/books/[slug]/pdf
 *
 * Body: FormData com
 *   file — arquivo PDF
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
        message: "Apenas administradores do estúdio podem alterar o PDF do livro/quadrinho.",
      });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return Response.json({ message: "Nenhum arquivo enviado." }, { status: 400 });
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return Response.json({ message: "O arquivo enviado precisa ser um PDF." }, { status: 400 });
    }

    const folder = `books/${bookData.id}/pdf`;

    // Valida tamanho antes de tentar upload (Cloudinary raw = 100 MB)
    const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 MB
    if (file.size > MAX_PDF_SIZE) {
      return Response.json(
        {
          message: `O arquivo excede o limite de 50 MB. O PDF enviado tem ${(file.size / (1024 * 1024)).toFixed(1)} MB.`,
        },
        { status: 413 },
      );
    }

    const pdfData = await uploadedImages.uploadPdfRaw(file, folder);

    await book.savePdf(slug, pdfData.id);

    return Response.json({
      url: pdfData.secure_url,
      id: pdfData.id,
    });
  } catch (err) {
    if (err.statusCode) {
      return Response.json({ message: err.message }, { status: err.statusCode });
    }
    console.error(err);
    return Response.json({ message: "Erro interno." }, { status: 500 });
  }
}
