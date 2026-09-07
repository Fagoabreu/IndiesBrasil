/**
 * Gerador de PDF de press kit — sem dependências externas.
 *
 * Compatível com navegador: usa apenas Uint8Array/TextEncoder-safe helpers
 * (sem `Buffer` do Node). Produz um PDF multi-página A4 (595x842pt) usando
 * as fontes padrão Type1 (Helvetica, Helvetica-Bold, Times-Roman) com
 * codificação WinAnsi (Latin-1) — suficiente para a acentuação pt-BR sem
 * necessidade de embutir arquivos de fonte.
 *
 * O texto é desenhado com quebra de linha por largura aproximada e a
 * paginação é automática. Strings PDF escapam `(`, `)` e `\`.
 */

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN_X = 56;
const MARGIN_TOP = 64;
const MARGIN_BOTTOM = 64;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

const FONTS = {
  regular: { ref: "/F1", base: "/Helvetica", ratio: 0.55 },
  bold: { ref: "/F2", base: "/Helvetica-Bold", ratio: 0.6 },
  serif: { ref: "/F3", base: "/Times-Roman", ratio: 0.55 },
};

// Caracteres fora do intervalo Latin-1 mapeados para WinAnsi (CP1252).
const WINANSI_SPECIAL = {
  "\u20AC": 0x80, // €
  "\u201A": 0x82,
  "\u0192": 0x83,
  "\u201E": 0x84,
  "\u2026": 0x85, // …
  "\u2020": 0x86,
  "\u2021": 0x87,
  "\u02C6": 0x88,
  "\u2030": 0x89,
  "\u0160": 0x8a,
  "\u2039": 0x8b,
  "\u0152": 0x8c,
  "\u017D": 0x8e,
  "\u2018": 0x91, // ‘
  "\u2019": 0x92, // ’
  "\u201C": 0x93, // “
  "\u201D": 0x94, // ”
  "\u2022": 0x95, // •
  "\u2013": 0x96, // –
  "\u2014": 0x97, // —
  "\u02DC": 0x98,
  "\u2122": 0x99, // ™
  "\u0161": 0x9a,
  "\u203A": 0x9b,
  "\u0153": 0x9c,
  "\u017E": 0x9e,
  "\u0178": 0x9f,
};

const BLACK = "0.05 0.05 0.05";
const BODY = "0.15 0.15 0.15";
const GRAY = "0.35 0.35 0.35";
const MUTED = "0.5 0.5 0.5";

function asciiBytes(str) {
  return Uint8Array.from(str.split("").map((ch) => ch.charCodeAt(0) & 0xff));
}

function toWinAnsiBytes(str) {
  const out = [];
  for (const ch of String(str)) {
    const code = ch.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      out.push(code);
    } else if (code >= 0xa0 && code <= 0xff) {
      out.push(code);
    } else if (WINANSI_SPECIAL[ch] !== undefined) {
      out.push(WINANSI_SPECIAL[ch]);
    } else if (code === 0x09 || code === 0x0a || code === 0x0d) {
      out.push(0x20);
    } else {
      out.push(0x3f); // caractere não suportado → "?"
    }
  }
  return Uint8Array.from(out);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function escapePdfText(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/** Largura aproximada (em pt) de um texto — suficiente para a quebra de linha. */
function measure(text, font, size) {
  let units = 0;
  for (const ch of text) {
    if (ch === " ") {
      units += 0.3;
    } else if ("iIljtfr'.,:;!".includes(ch)) {
      units += 0.32;
    } else if ("mwMW".includes(ch)) {
      units += font.ratio * 1.6;
    } else {
      units += font.ratio;
    }
  }
  return units * size;
}

/** Quebra o texto em linhas que cabem em `maxWidth`. */
function wrapText(text, maxWidth, font, size) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  const appendWord = (word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate, font, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  };

  for (const word of words) {
    if (measure(word, font, size) <= maxWidth) {
      appendWord(word);
    } else {
      // Palavra maior que a linha (ex.: URL) — quebra por caractere.
      let chunk = "";
      for (const ch of word) {
        if (measure(chunk + ch, font, size) <= maxWidth || !chunk) {
          chunk += ch;
        } else {
          lines.push(line ? `${line} ${chunk}` : chunk);
          line = "";
          chunk = ch;
        }
      }
      if (chunk) {
        appendWord(chunk);
      }
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.length ? lines : [""];
}

/**
 * Transforma os blocos do press kit em páginas de linhas prontas para desenho.
 * Cada linha carrega texto, fonte, tamanho, cor, recuo e baseline (posição Y).
 */
function layoutPages(blocks) {
  const pages = [];
  let current = [];
  let y = PAGE_HEIGHT - MARGIN_TOP;

  const newPage = () => {
    pages.push(current);
    current = [];
    y = PAGE_HEIGHT - MARGIN_TOP;
  };

  const addLine = (line) => {
    const height = line.size * 1.35;
    const gap = line.gapBefore || 0;
    if (y - gap - height < MARGIN_BOTTOM) {
      newPage();
    }
    y -= gap;
    line.baseline = y;
    current.push(line);
    y -= height;
  };

  const emit = (text, font, size, color, options = {}) => {
    const indent = options.indent || 0;
    const wrapped = wrapText(text, CONTENT_WIDTH - indent, font, size);
    wrapped.forEach((lineText, index) => {
      addLine({
        text: lineText,
        font,
        size,
        color,
        indent,
        gapBefore: index === 0 ? options.gapBefore || 0 : 0,
      });
    });
    y -= options.gapAfter || 0;
  };

  for (const block of blocks) {
    switch (block.type) {
      case "title":
        emit(block.text, FONTS.bold, 24, BLACK, { gapAfter: 6 });
        break;
      case "subtitle":
        emit(block.text, FONTS.serif, 13, GRAY, { gapAfter: 20 });
        break;
      case "h2":
        emit(block.text, FONTS.bold, 15, BLACK, { gapBefore: 16, gapAfter: 6 });
        break;
      case "p":
        emit(block.text, FONTS.regular, 11, BODY, { gapAfter: 10 });
        break;
      case "bullet":
        emit(`\u2022  ${block.text}`, FONTS.regular, 11, BODY, { gapAfter: 2 });
        break;
      case "fact":
        emit(block.label, FONTS.bold, 11, BLACK, { gapAfter: 2 });
        emit(block.value, FONTS.regular, 11, BODY, { gapAfter: 8 });
        break;
      default:
        break;
    }
  }

  if (current.length || pages.length === 0) {
    pages.push(current);
  }

  return pages;
}

function buildContentStream(lines, pageIndex, totalPages) {
  const parts = [];

  for (const line of lines) {
    const x = MARGIN_X + (line.indent || 0);
    parts.push(
      asciiBytes(`BT\n${line.font.ref} ${line.size} Tf\n${line.color} rg\n${x} ${Math.round(line.baseline)} Td\n(`),
      toWinAnsiBytes(escapePdfText(line.text)),
      asciiBytes(`) Tj\nET\n`),
    );
  }

  const footer = `Indies Brasil — Press Kit  \u2022  Página ${pageIndex + 1} de ${totalPages}`;
  parts.push(
    asciiBytes(`BT\n${FONTS.regular.ref} 8 Tf\n${MUTED} rg\n${MARGIN_X} 36 Td\n(`),
    toWinAnsiBytes(escapePdfText(footer)),
    asciiBytes(`) Tj\nET\n`),
  );

  return concatBytes(parts);
}

function serialize(objects) {
  objects.sort((a, b) => a.num - b.num);

  const parts = [asciiBytes("%PDF-1.3\n%\xFF\xFF\xFF\xFF\n")];
  const offsets = [];
  let cursor = parts[0].length;

  for (const obj of objects) {
    offsets.push(cursor);

    const objHeader = asciiBytes(`${obj.num} 0 obj\n`);
    parts.push(objHeader);
    cursor += objHeader.length;

    if (obj.stream) {
      const head = asciiBytes(`${obj.dict}\nstream\n`);
      const tail = asciiBytes("\nendstream\nendobj\n");
      parts.push(head, obj.stream, tail);
      cursor += head.length + obj.stream.length + tail.length;
    } else {
      const data = asciiBytes(`${obj.data}\nendobj\n`);
      parts.push(data);
      cursor += data.length;
    }
  }

  const body = concatBytes(parts);

  const xrefParts = [asciiBytes(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`)];
  for (const offset of offsets) {
    xrefParts.push(asciiBytes(`${String(offset).padStart(10, "0")} 00000 n \n`));
  }
  xrefParts.push(asciiBytes(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF`));

  return concatBytes([body, ...xrefParts]);
}

/**
 * Monta o PDF completo a partir dos blocos do press kit.
 *
 * @param {{ blocks: { type: string; text?: string; label?: string; value?: string }[] }} data
 * @returns {Uint8Array}
 */
export function buildPressKitPdf(data) {
  const blocks = Array.isArray(data?.blocks) ? data.blocks : [];
  const pages = layoutPages(blocks);
  const totalPages = pages.length;

  let n = 1;
  const catalogNum = n++; // 1
  const pagesNum = n++; // 2
  const regularFontNum = n++; // 3
  const boldFontNum = n++; // 4
  const serifFontNum = n++; // 5

  const pageObjs = pages.map((lines) => ({
    contentNum: n++,
    pageNum: n++,
    lines,
  }));

  const objects = [
    { num: catalogNum, data: `<< /Type /Catalog /Pages ${pagesNum} 0 R >>` },
    {
      num: pagesNum,
      data: `<< /Type /Pages /Kids [${pageObjs.map((p) => `${p.pageNum} 0 R`).join(" ")}] /Count ${totalPages} >>`,
    },
    { num: regularFontNum, data: `<< /Type /Font /Subtype /Type1 /BaseFont ${FONTS.regular.base} /Encoding /WinAnsiEncoding >>` },
    { num: boldFontNum, data: `<< /Type /Font /Subtype /Type1 /BaseFont ${FONTS.bold.base} /Encoding /WinAnsiEncoding >>` },
    { num: serifFontNum, data: `<< /Type /Font /Subtype /Type1 /BaseFont ${FONTS.serif.base} /Encoding /WinAnsiEncoding >>` },
  ];

  pageObjs.forEach((page, index) => {
    const content = buildContentStream(page.lines, index, totalPages);
    objects.push({
      num: page.contentNum,
      stream: content,
      dict: `<< /Length ${content.length} >>`,
    });
    objects.push({
      num: page.pageNum,
      data: `<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${page.contentNum} 0 R /Resources << /Font << /F1 ${regularFontNum} 0 R /F2 ${boldFontNum} 0 R /F3 ${serifFontNum} 0 R >> >> >>`,
    });
  });

  return serialize(objects);
}

/**
 * Baixa o PDF do press kit em 1 clique (Blob → <a download>).
 *
 * @param {{ blocks: { type: string; text?: string; label?: string; value?: string }[] }} data
 * @param {string} [filename]
 */
export function downloadPressKitPdf(data, filename = "indies-brasil-press-kit.pdf") {
  const bytes = buildPressKitPdf(data);
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}

export default buildPressKitPdf;
