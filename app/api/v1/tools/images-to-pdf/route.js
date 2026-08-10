import { NextResponse } from "next/server";

/**
 * Parse JPEG dimensions from the SOF (Start of Frame) marker.
 * JPEG header: FF D8 → segments → FF C0/C1/C2 (SOF) → dimensions at offset +3/+5.
 */
function parseJpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let pos = 2;
  while (pos < buffer.length - 1) {
    if (buffer[pos] !== 0xff) break;
    const marker = buffer[pos + 1];
    pos += 2;

    // SOF0 (Baseline), SOF1 (Extended), SOF2 (Progressive)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      if (pos + 7 > buffer.length) return null;
      const height = (buffer[pos + 3] << 8) | buffer[pos + 4];
      const width = (buffer[pos + 5] << 8) | buffer[pos + 6];
      return { width, height };
    }

    if (pos + 1 >= buffer.length) break;
    const segmentLength = (buffer[pos] << 8) | buffer[pos + 1];
    pos += segmentLength;
  }

  return null;
}

/**
 * Build a minimal PDF from an array of JPEG image buffers.
 * Each image becomes its own page, sized to match the image dimensions.
 * JPEG data is embedded directly (DCTDecode) — no re-encoding.
 *
 * @param {{ data: Buffer; width: number; height: number }[]} images
 * @returns {Buffer}
 */
function buildPdf(images) {
  const objects = [];

  // --- Object numbering ---
  let n = 1;
  const catalogNum = n++; // 1
  const pagesNum = n++; // 2

  const pageNums = Array.from({ length: images.length }, () => ({
    contentNum: n++,
    imageNum: n++,
    pageNum: n++,
  }));

  // --- Catalog ---
  objects.push({ num: catalogNum, data: `<< /Type /Catalog /Pages ${pagesNum} 0 R >>` });

  // --- Pages ---
  const kids = pageNums.map((p) => `${p.pageNum} 0 R`).join(" ");
  objects.push({
    num: pagesNum,
    data: `<< /Type /Pages /Kids [${kids}] /Count ${images.length} >>`,
  });

  // --- Per image: content stream, image XObject, page ---
  for (const [i, img] of images.entries()) {
    const { contentNum, imageNum, pageNum } = pageNums[i];

    // Content stream — places the image at full page size
    const streamText = `q\n${img.width} 0 0 ${img.height} 0 0 cm\n/Im${i} Do\nQ`;

    objects.push(
      {
        num: contentNum,
        stream: Buffer.from(streamText, "ascii"),
        dict: `<< /Length ${streamText.length} >>`,
      },
      {
        num: imageNum,
        stream: img.data,
        dict: `<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>`,
      },
      {
        num: pageNum,
        data: `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${img.width} ${img.height}] /Contents ${contentNum} 0 R /Resources << /XObject << /Im${i} ${imageNum} 0 R >> >> >>`,
      },
    );
  }

  // --- Serialize and compute cross-reference offsets ---
  const header = Buffer.from("%PDF-1.3\n%\xFF\xFF\xFF\xFF\n", "ascii");
  const headerLen = header.length;

  // Sort by object number (already in order, but be safe)
  objects.sort((a, b) => a.num - b.num);

  let cursor = headerLen;
  const offsets = [];

  for (const obj of objects) {
    offsets.push(cursor);
    const entry = `${obj.num} ${0} obj\n`;
    cursor += Buffer.byteLength(entry, "ascii");

    if (obj.stream) {
      cursor += Buffer.byteLength(obj.dict + "\n", "ascii");
      cursor += Buffer.byteLength("stream\n", "ascii");
      cursor += obj.stream.length;
      cursor += Buffer.byteLength("\nendstream\nendobj\n", "ascii");
    } else {
      cursor += Buffer.byteLength(obj.data + "\n", "ascii");
      cursor += Buffer.byteLength("endobj\n", "ascii");
    }
  }

  // --- Concatenate ---
  const bodyParts = [header];

  for (const obj of objects) {
    const objHeader = Buffer.from(`${obj.num} 0 obj\n`, "ascii");
    if (obj.stream) {
      bodyParts.push(
        objHeader,
        Buffer.from(obj.dict + "\n", "ascii"),
        Buffer.from("stream\n", "ascii"),
        obj.stream,
        Buffer.from("\nendstream\nendobj\n", "ascii"),
      );
    } else {
      bodyParts.push(objHeader, Buffer.from(obj.data + "\n", "ascii"), Buffer.from("endobj\n", "ascii"));
    }
  }

  const bodyLen = bodyParts.reduce((sum, p) => sum + p.length, 0);

  // Cross-reference table
  const xref = [
    Buffer.from("xref\n", "ascii"),
    Buffer.from(`0 ${objects.length + 1}\n`, "ascii"),
    Buffer.from("0000000000 65535 f \n", "ascii"),
    ...offsets.map((off) => Buffer.from(`${String(off).padStart(10, "0")} 00000 n \n`, "ascii")),
  ];

  // Trailer
  const trailer = [
    Buffer.from("trailer\n", "ascii"),
    Buffer.from(`<< /Size ${objects.length + 1} /Root 1 0 R >>\n`, "ascii"),
    Buffer.from("startxref\n", "ascii"),
    Buffer.from(`${bodyLen}\n`, "ascii"),
    Buffer.from("%%EOF", "ascii"),
  ];

  return Buffer.concat([...bodyParts, ...xref, ...trailer]);
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const entries = formData.getAll("images");

    if (!entries || entries.length === 0) {
      return NextResponse.json({ error: "Nenhuma imagem enviada." }, { status: 400 });
    }

    if (entries.length > 100) {
      return NextResponse.json({ error: "Máximo de 100 imagens por PDF." }, { status: 400 });
    }

    // Sort alphabetically by filename (pt-BR locale for correct accent handling)
    entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));

    const images = [];

    for (const file of entries) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const dims = parseJpegDimensions(buffer);
      if (!dims) {
        return NextResponse.json({ error: `Não foi possível processar "${file.name}". Certifique-se de que é um JPEG válido.` }, { status: 400 });
      }

      images.push({ data: buffer, width: dims.width, height: dims.height });
    }

    const pdf = buildPdf(images);

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="imagens-para-pdf.pdf"',
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json({ error: "Erro interno ao gerar o PDF." }, { status: 500 });
  }
}
